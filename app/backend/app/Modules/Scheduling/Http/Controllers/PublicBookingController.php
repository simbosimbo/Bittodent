<?php

namespace App\Modules\Scheduling\Http\Controllers;

use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Modules\Scheduling\Contracts\OtpSender;
use App\Modules\Scheduling\Domain\AppointmentStatus;
use App\Modules\Scheduling\Http\Requests\BookingSlotsRequest;
use App\Modules\Scheduling\Http\Requests\RescheduleBookingRequest;
use App\Modules\Scheduling\Http\Requests\StartBookingRequest;
use App\Modules\Scheduling\Http\Requests\VerifyOtpRequest;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Scheduling\Models\BookingOtp;
use App\Modules\Scheduling\Models\Chair;
use App\Modules\Scheduling\Models\ClinicService;
use App\Modules\Scheduling\Models\PracticeHour;
use App\Modules\Scheduling\Services\LogOtpSender;
use App\Modules\Scheduling\Services\PatientCareSync;
use App\Modules\Scheduling\Services\SlotFinder;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Crypto\Crypto;
use App\Shared\Http\Controller;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

// Public patient booking under /api/public/booking/{clinic}. No login: the tenant comes from the slug (tenant.public middleware),
// the phone is proven by OTP, later changes by the manage-link token (only its sha256 is stored). Responses never carry clinical
// data, the complaint, or the full phone number.
class PublicBookingController extends Controller
{
    public const OTP_TTL = 300;

    public const OTP_MAX_ATTEMPTS = 5;

    public const OTP_RESEND_AFTER = 60;

    public const OTP_MAX_SENDS = 3;

    public function __construct(private SlotFinder $finder, private AppointmentController $appointments, private TenancyDirectory $tenancy,
        private UserDirectory $users, private PatientDirectory $patients) {}

    /** GET /: clinic, branches, dentists and services that can be booked online. */
    public function info(Request $request)
    {
        $clinic = $request->attributes->get('clinic');
        if (! $clinic['online_booking_enabled']) {
            return response()->json(['clinic' => $clinic, 'branches' => [], 'dentists' => [], 'services' => []]);
        }
        $hours = PracticeHour::get(['tenant_id', 'dentist_id', 'branch_id']);
        $branchIds = $hours->pluck('branch_id')->unique()->values()->all();
        $active = collect($branchIds)->flatMap(fn ($b) => $this->tenancy->dentistIdsForBranch($b))->unique()->all();
        $dentistIds = $hours->pluck('dentist_id')->unique()->intersect($active)->values()->all();

        return response()->json([
            'clinic' => $clinic,
            'branches' => array_map(fn ($b) => $this->tenancy->branchOrFail($b), $branchIds),
            'dentists' => collect($this->users->namesByIds($dentistIds))->map(fn ($u) => ['id' => $u['id'], 'name' => $u['name']])->sortBy('name')->values(),
            'services' => ClinicService::where('online', true)->where('active', true)->orderBy('name')->get(['tenant_id', 'id', 'name', 'duration_minutes'])
                ->map->only(['id', 'name', 'duration_minutes']),
        ]);
    }

    /** GET /slots?dentist_id&service_id&date */
    public function slots(BookingSlotsRequest $request)
    {
        if ($off = $this->disabled($request)) {
            return $off;
        }
        $d = $request->validated();
        $svc = $this->service($d['service_id']);
        if (! SlotFinder::inWindow($d['date'])) {
            return response()->json(['error' => 'validation', 'message' => 'Pilih tanggal hari ini sampai '.SlotFinder::DAYS_AHEAD.' hari ke depan.'], 422);
        }

        return response()->json(['date' => $d['date'], 'slots' => $this->finder->slots($d['dentist_id'], $svc->duration_minutes, $d['date'])]);
    }

    /** POST /start: checks the slot, stores the request as an OTP challenge (the hold) and sends the code. */
    public function start(StartBookingRequest $request, OtpSender $sender)
    {
        if ($off = $this->disabled($request)) {
            return $off;
        }
        $d = $request->validated();
        $svc = $this->service($d['service_id']);
        $slot = $this->finder->find($d['dentist_id'], $svc->duration_minutes, CarbonImmutable::parse($d['starts_at']));
        if ($slot === null) {
            return self::taken();
        }
        $code = self::newCode();
        $otp = BookingOtp::create([
            'dentist_id' => $d['dentist_id'], 'branch_id' => $slot['branch_id'], 'service_id' => $svc->id,
            'starts_at' => CarbonImmutable::parse($slot['starts_at']), 'ends_at' => CarbonImmutable::parse($slot['ends_at']),
            'name' => $d['name'], 'phone_enc' => Crypto::encrypt($d['phone']), 'phone_bidx' => Crypto::blindIndex($d['phone']),
            'complaint_enc' => Crypto::encrypt(($d['complaint'] ?? '') === '' ? null : $d['complaint']),
            'code_hash' => Hash::make($code), 'expires_at' => now()->addSeconds(self::OTP_TTL), 'last_sent_at' => now(),
        ]);
        $sender->send($d['phone'], $code);

        return response()->json(['challenge_id' => $otp->id, 'phone_masked' => LogOtpSender::mask($d['phone']),
            'expires_in' => self::OTP_TTL, 'resend_in' => self::OTP_RESEND_AFTER], 201);
    }

    /** POST /resend {challenge_id}: new code after the cooldown, at most OTP_MAX_SENDS per challenge. */
    public function resend(VerifyOtpRequest $request, OtpSender $sender)
    {
        if ($off = $this->disabled($request)) {
            return $off;
        }

        return DB::transaction(function () use ($request, $sender) {
            $otp = BookingOtp::lockForUpdate()->find($request->validated('challenge_id'));
            if ($otp === null || $otp->verified_at !== null || $otp->attempts >= self::OTP_MAX_ATTEMPTS) {
                return self::gone('challenge_closed', 'Kode tidak berlaku. Mulai booking lagi.');
            }
            $wait = self::OTP_RESEND_AFTER - (int) $otp->last_sent_at->diffInSeconds(now());
            if ($wait > 0 || $otp->sends >= self::OTP_MAX_SENDS) {
                return response()->json(['error' => 'resend_limited', 'message' => 'Tunggu sebelum kirim ulang.', 'retry_in' => max($wait, 0)], 429);
            }
            $code = self::newCode();
            $otp->update(['code_hash' => Hash::make($code), 'sends' => $otp->sends + 1, 'last_sent_at' => now(), 'expires_at' => now()->addSeconds(self::OTP_TTL)]);
            $sender->send(Crypto::decrypt($otp->phone_enc), $code);

            return response()->json(['expires_in' => self::OTP_TTL, 'resend_in' => self::OTP_RESEND_AFTER]);
        });
    }

    /** POST /verify {challenge_id, code}: creates the patient (if new) and the appointment `pending_confirmation`, source online. */
    public function verify(VerifyOtpRequest $request)
    {
        if ($off = $this->disabled($request)) {
            return $off;
        }
        $d = $request->validated();
        try {
            return DB::transaction(function () use ($d) {
                $otp = BookingOtp::lockForUpdate()->find($d['challenge_id']);
                if ($otp === null || $otp->verified_at !== null) {
                    return self::gone('challenge_closed', 'Kode tidak berlaku. Mulai booking lagi.');
                }
                if ($otp->expires_at->isPast()) {
                    return self::gone('otp_expired', 'Kode kedaluwarsa. Kirim ulang kode.');
                }
                if ($otp->attempts >= self::OTP_MAX_ATTEMPTS) {
                    return self::gone('otp_locked', 'Terlalu banyak percobaan. Mulai booking lagi.');
                }
                if (! Hash::check($d['code'], $otp->code_hash)) {
                    $otp->increment('attempts'); // committed: the transaction returns normally

                    return response()->json(['error' => 'otp_wrong', 'message' => 'Kode salah.', 'attempts_left' => self::OTP_MAX_ATTEMPTS - $otp->attempts], 422);
                }
                $svc = ClinicService::findOrFail($otp->service_id);
                $slot = $this->finder->find($otp->dentist_id, $svc->duration_minutes, CarbonImmutable::instance($otp->starts_at));
                $a = $slot && $slot['branch_id'] === $otp->branch_id ? $this->claim($slot, $otp->dentist_id) : self::taken();
                if (! $a instanceof Appointment) {
                    return $a;
                }
                $token = Str::random(48);
                $a->fill([
                    'patient_id' => $this->patients->findOrCreateForBooking($otp->name, Crypto::decrypt($otp->phone_enc), $otp->branch_id),
                    'status' => 'pending_confirmation', 'source' => 'online', 'service_id' => $svc->id, 'reason' => $svc->name,
                    'complaint_enc' => $otp->complaint_enc, 'booking_code' => self::newBookingCode(),
                    'manage_token_hash' => hash('sha256', $token), 'manage_expires_at' => $a->starts_at,
                ])->save();
                $otp->update(['verified_at' => now(), 'appointment_id' => $a->id]);
                Audit::log('buat_online', 'appointment', $a->id, ['source' => 'online', 'patient_id' => $a->patient_id, 'service_id' => $svc->id]);
                app(PatientCareSync::class)->push($a->patient_id); // patient list: next appointment

                return response()->json(['code' => $a->booking_code, 'manage_token' => $token, 'status' => $a->status,
                    'starts_at' => $a->starts_at->toIso8601ZuluString(), 'ends_at' => $a->ends_at->toIso8601ZuluString()], 201);
            });
        } catch (UniqueConstraintViolationException) {
            return self::taken(); // a parallel claim of the same dentist + start won (UNIQUE tenant_id, slot_key)
        }
    }

    /** GET /manage/{token}: what the patient needs to see, nothing clinical. */
    public function show(Request $request, string $clinic, string $token)
    {
        $a = $this->byToken($token);
        if (! $a instanceof Appointment) {
            return $a;
        }

        return response()->json($this->summary($request, $a));
    }

    /** POST /manage/{token}/cancel: the token is used up (later calls 404). */
    public function cancel(Request $request, string $clinic, string $token)
    {
        return DB::transaction(function () use ($request, $token) {
            $a = $this->byToken($token, lock: true);
            if (! $a instanceof Appointment) {
                return $a;
            }
            if (! AppointmentStatus::canMove($a->status, 'cancelled')) {
                return response()->json(['error' => 'not_changeable', 'message' => 'Janji ini tidak bisa dibatalkan.'], 409);
            }
            $from = $a->status;
            $a->update(['status' => 'cancelled', 'manage_token_hash' => null]);
            Audit::log('batal_online', 'appointment', $a->id, ['from' => $from, 'to' => 'cancelled']);
            app(PatientCareSync::class)->push($a->patient_id);

            return response()->json($this->summary($request, $a));
        });
    }

    /** POST /manage/{token}/reschedule {starts_at}: same dentist + service, another free slot; back to `pending_confirmation`. */
    public function reschedule(RescheduleBookingRequest $request, string $clinic, string $token)
    {
        if ($off = $this->disabled($request)) {
            return $off;
        }
        try {
            return DB::transaction(function () use ($request, $token) {
                $a = $this->byToken($token, lock: true); // lock order: appointment row, then chairs, then dentist (like staff reschedule)
                if (! $a instanceof Appointment) {
                    return $a;
                }
                if (! in_array($a->status, ['pending_confirmation', 'booked'], true)) {
                    return response()->json(['error' => 'not_changeable', 'message' => 'Janji ini tidak bisa diubah.'], 409);
                }
                $svc = ClinicService::findOrFail($a->service_id);
                $slot = $this->finder->find($a->dentist_id, $svc->duration_minutes, CarbonImmutable::parse($request->validated('starts_at')), $a->id);
                $r = $slot ? $this->claim($slot, $a->dentist_id, $a) : self::taken();
                if (! $r instanceof Appointment) {
                    return $r;
                }
                $from = $a->getOriginal('starts_at')->toIso8601ZuluString();
                if ($a->status === 'booked') {
                    AppointmentStatus::assertCanMove('booked', 'pending_confirmation');
                }
                $a->fill(['status' => 'pending_confirmation', 'manage_expires_at' => $a->starts_at])->save();
                Audit::log('jadwal_ulang', 'appointment', $a->id, ['from' => $from, 'to' => $a->starts_at->toIso8601ZuluString(), 'source' => 'online']);
                app(PatientCareSync::class)->push($a->patient_id);

                return response()->json($this->summary($request, $a));
            });
        } catch (UniqueConstraintViolationException) {
            return self::taken();
        }
    }

    /**
     * Inside a transaction: lock the branch's chairs (id order), then reuse the staff double-booking guard (chair row, dentist
     * membership, overlap checks) on the first chair that is free. Errors are mapped to one generic 409 (no ids leak to the public).
     */
    private function claim(array $slot, string $dentistId, ?Appointment $existing = null): Appointment|JsonResponse
    {
        [$s, $e] = [CarbonImmutable::parse($slot['starts_at'])->utc(), CarbonImmutable::parse($slot['ends_at'])->utc()];
        foreach (Chair::where('branch_id', $slot['branch_id'])->where('active', true)->orderBy('id')->lockForUpdate()->pluck('id') as $chairId) {
            $r = $this->appointments->book($chairId, $dentistId, $s, $e, $existing);
            if ($r instanceof Appointment) {
                return $r;
            }
            if (($r->getData(true)['error'] ?? null) !== 'chair_busy') {
                break;
            }
        }

        return self::taken();
    }

    private function byToken(string $token, bool $lock = false): Appointment|JsonResponse
    {
        $a = Appointment::where('manage_token_hash', hash('sha256', $token))->when($lock, fn ($q) => $q->lockForUpdate())->first();
        if ($a === null) {
            return response()->json(['error' => 'link_invalid', 'message' => 'Tautan tidak berlaku.'], 404);
        }
        if ($a->manage_expires_at === null || $a->manage_expires_at->isPast()) {
            return self::gone('link_expired', 'Tautan sudah kedaluwarsa.');
        }

        return $a;
    }

    private function summary(Request $request, Appointment $a): array
    {
        $svc = ClinicService::find($a->service_id, ['tenant_id', 'id', 'name', 'duration_minutes']);
        $dentist = $this->users->namesByIds([$a->dentist_id])[0] ?? null;

        return [
            'clinic' => ['name' => $request->attributes->get('clinic')['name']],
            'code' => $a->booking_code, 'status' => $a->status,
            'starts_at' => $a->starts_at->toIso8601ZuluString(), 'ends_at' => $a->ends_at->toIso8601ZuluString(),
            'branch' => $this->tenancy->branchOrFail($a->branch_id),
            'dentist' => $dentist ? ['id' => $dentist['id'], 'name' => $dentist['name']] : null,
            'service' => $svc?->only(['id', 'name', 'duration_minutes']),
            'can_change' => in_array($a->status, ['pending_confirmation', 'booked'], true) && $a->starts_at->isFuture(),
        ];
    }

    private function disabled(Request $request): ?JsonResponse
    {
        return $request->attributes->get('clinic')['online_booking_enabled'] ? null
            : response()->json(['error' => 'booking_disabled', 'message' => 'Booking online belum dibuka.'], 403);
    }

    private function service(string $id): ClinicService
    {
        return ClinicService::where('online', true)->where('active', true)->findOrFail($id);
    }

    private static function taken(): JsonResponse
    {
        return response()->json(['error' => 'slot_taken', 'message' => 'Jam ini sudah terisi. Pilih jam lain.'], 409);
    }

    private static function gone(string $error, string $message): JsonResponse
    {
        return response()->json(['error' => $error, 'message' => $message], 410);
    }

    private static function newCode(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    /** Short human code, unique per tenant (UNIQUE tenant_id, booking_code backs this check). */
    private static function newBookingCode(): string
    {
        do {
            $code = 'BK-'.collect(range(1, 6))->map(fn () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[random_int(0, 31)])->implode('');
        } while (Appointment::where('booking_code', $code)->exists());

        return $code;
    }
}
