<?php

namespace Tests\Modules\Scheduling;

use App\Modules\Patients\Models\Patient;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Scheduling\Models\BookingOtp;
use App\Modules\Scheduling\Models\Chair;
use App\Modules\Scheduling\Models\ClinicService;
use App\Modules\Scheduling\Services\FakeOtpSender;
use App\Modules\Tenancy\Models\Branch;
use App\Modules\Tenancy\Models\Tenant;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class OnlineBookingTest extends TestCase
{
    private const URL = '/api/public/booking/senyum';

    private const PHONE = '0899-0100-0777'; // synthetic

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    private function bunga(): string
    {
        return $this->user('dokter.bunga@senyum.test')->id;
    }

    private function service(string $name, ?Tenant $t = null): string
    {
        return Ctx::runAs(($t ?? $this->tenantA())->id, fn () => ClinicService::where('name', $name)->value('id'));
    }

    /** A day far enough from the seeded appointments (today/tomorrow). */
    private function day(): CarbonImmutable
    {
        return CarbonImmutable::now('Asia/Jakarta')->addDays(3)->startOfDay();
    }

    private function at(string $hhmm): string
    {
        return CarbonImmutable::parse($this->day()->format('Y-m-d').' '.$hhmm, 'Asia/Jakarta')->utc()->toIso8601ZuluString();
    }

    private function slotTimes(string $dentist, string $service, ?string $date = null, string $url = self::URL): array
    {
        return array_column($this->getJson("$url/slots?dentist_id=$dentist&service_id=$service&date=".($date ?? $this->day()->format('Y-m-d')))
            ->assertOk()->json('slots'), 'time');
    }

    private function start(string $hhmm = '14:00', array $over = [], string $url = self::URL)
    {
        return $this->postJson("$url/start", [...['dentist_id' => $this->bunga(), 'service_id' => $this->service('Konsultasi'),
            'starts_at' => $this->at($hhmm), 'name' => 'Rani Uji Contoh', 'phone' => self::PHONE, 'complaint' => 'Gigi geraham ngilu'], ...$over]);
    }

    private function book(string $hhmm = '14:00', array $over = [])
    {
        $c = $this->start($hhmm, $over)->assertCreated()->json('challenge_id');

        return $this->postJson(self::URL.'/verify', ['challenge_id' => $c, 'code' => FakeOtpSender::lastCode($over['phone'] ?? self::PHONE)]);
    }

    private function staffAppt(string $dentistId, string $chairId, string $from, string $to): Appointment
    {
        return $this->inA(fn () => Appointment::create(['branch_id' => Chair::findOrFail($chairId)->branch_id, 'chair_id' => $chairId, 'dentist_id' => $dentistId,
            'patient_id' => $this->patientOf($this->tenantA())->id, 'starts_at' => $this->at($from), 'ends_at' => $this->at($to), 'status' => 'booked']));
    }

    private function kemangChairs()
    {
        return $this->inA(fn () => Chair::where('branch_id', Branch::where('name', 'like', '%Kemang%')->value('id'))->orderBy('label')->pluck('id'));
    }

    public function test_info_lists_online_dentists_and_services_only(): void
    {
        $r = $this->getJson(self::URL)->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $this->assertTrue($r->json('clinic.online_booking_enabled'));
        $this->assertEqualsCanonicalizing(['drg. Andi Contoh', 'drg. Bunga Contoh', 'drg. Raka Contoh'], array_column($r->json('dentists'), 'name'));
        $this->assertEqualsCanonicalizing(['Konsultasi', 'Scaling', 'Tambal gigi'], array_column($r->json('services'), 'name')); // Cabut gigi: not online
        $this->assertCount(2, $r->json('branches'));
        $this->getJson('/api/public/booking/tidak-ada')->assertNotFound();
    }

    public function test_slots_are_hours_minus_busy_at_service_granularity(): void
    {
        $konsul = $this->service('Konsultasi');
        // Bunga: 13:00-20:00, 30 min => 14 slots
        $this->assertSame(['13:00', '13:30', '14:00', '14:30', '15:00'], array_slice($this->slotTimes($this->bunga(), $konsul), 0, 5));
        $this->assertCount(14, $this->slotTimes($this->bunga(), $konsul));
        // 45 min service => 13:00, 13:45, ... 19:00
        $scaling = $this->slotTimes($this->bunga(), $this->service('Scaling'));
        $this->assertSame(['13:00', '13:45', '14:30'], array_slice($scaling, 0, 3));
        $this->assertSame('19:00', end($scaling));

        // existing appointment 14:00-14:45 (any channel) removes 14:00 and 14:30
        $chairs = $this->kemangChairs();
        $this->staffAppt($this->bunga(), $chairs[0], '14:00', '14:45');
        $times = $this->slotTimes($this->bunga(), $konsul);
        $this->assertNotContains('14:00', $times);
        $this->assertNotContains('14:30', $times);
        $this->assertContains('15:00', $times);
        // all chairs of the branch busy at 16:00 => no slot even though Bunga is free
        foreach ([$this->user('dokter@senyum.test')->id, $this->user('dokter.raka@senyum.test')->id, $this->user('dokter@ceria.test')->id] as $i => $doc) {
            $this->staffAppt($doc, $chairs[$i], '16:00', '16:30');
        }
        $this->assertNotContains('16:00', $this->slotTimes($this->bunga(), $konsul));
        // a cancelled appointment frees its time
        $this->inA(fn () => Appointment::where('dentist_id', $this->bunga())->where('starts_at', $this->at('14:00'))->firstOrFail()->update(['status' => 'cancelled']));
        $this->assertContains('14:00', $this->slotTimes($this->bunga(), $konsul));
    }

    public function test_past_times_today_are_hidden_and_window_is_limited(): void
    {
        $day = $this->day();
        $past = $this->at('15:00');
        $this->travelTo($day->setTime(15, 10));
        $this->assertSame('15:30', $this->slotTimes($this->bunga(), $this->service('Konsultasi'), $day->format('Y-m-d'))[0]);
        $q = '?dentist_id='.$this->bunga().'&service_id='.$this->service('Konsultasi').'&date=';
        $this->getJson(self::URL.'/slots'.$q.$day->subDay()->format('Y-m-d'))->assertStatus(422);
        $this->getJson(self::URL.'/slots'.$q.$day->addDays(31)->format('Y-m-d'))->assertStatus(422);
        $this->start('15:00', ['starts_at' => $past])->assertStatus(409)->assertJsonPath('error', 'slot_taken'); // in the past now
    }

    public function test_full_flow_creates_pending_online_appointment_and_patient(): void
    {
        Log::spy();
        $start = $this->start()->assertCreated()->assertJsonPath('phone_masked', '+62899****777');
        $code = FakeOtpSender::lastCode(self::PHONE);
        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);
        Log::shouldHaveReceived('info')->withArgs(fn ($m, $c = []) => $m === 'booking_otp_sent' && $c === ['to' => '+62899****777']);
        Log::shouldNotHaveReceived('info', fn ($m, $c = []) => str_contains($m.json_encode($c), $code) || str_contains(json_encode($c), '62899010007'));

        $otp = $this->inA(fn () => BookingOtp::findOrFail($start->json('challenge_id')));
        $this->assertStringNotContainsString('0777', $otp->phone_enc.$otp->complaint_enc.$otp->code_hash);
        $this->assertStringNotContainsString($code, $otp->code_hash);

        $r = $this->postJson(self::URL.'/verify', ['challenge_id' => $start->json('challenge_id'), 'code' => $code])->assertCreated()
            ->assertJsonPath('status', 'pending_confirmation');
        $this->assertMatchesRegularExpression('/^BK-[A-Z2-9]{6}$/', $r->json('code'));
        $a = $this->inA(fn () => Appointment::where('booking_code', $r->json('code'))->firstOrFail());
        $this->assertSame(['online', 'pending_confirmation', 'Konsultasi'], [$a->source, $a->status, $a->reason]);
        $this->assertSame(hash('sha256', $r->json('manage_token')), $a->manage_token_hash);
        $this->assertStringNotContainsString('ngilu', $a->complaint_enc);
        $p = $this->inA(fn () => Patient::findOrFail($a->patient_id));
        $this->assertSame(['Rani Uji Contoh', 'online'], [$p->name, $p->source]);
        $audit = $this->inA(fn () => AuditEvent::where('entity_id', $a->id)->where('action', 'buat_online')->firstOrFail());
        $this->assertSame('publik', $audit->actor_type);
        $this->assertStringNotContainsString('Rani', json_encode($audit->detail));

        // the same code cannot be used twice; same phone + name later reuses the patient
        $this->postJson(self::URL.'/verify', ['challenge_id' => $start->json('challenge_id'), 'code' => $code])->assertStatus(410);
        $this->book('16:00')->assertCreated();
        $this->assertSame(1, $this->inA(fn () => Patient::where('name', 'Rani Uji Contoh')->count()));

        // staff schedule shows it with source + pending status, without complaint/token
        $branch = $a->branch_id;
        $s = $this->as('depan@senyum.test')->getJson("/api/schedule?branch_id=$branch&date=".$this->day()->format('Y-m-d'))->assertOk();
        $row = collect($s->json('chairs'))->flatMap(fn ($c) => $c['appointments'])->firstWhere('id', $a->id);
        $this->assertSame(['online', 'pending_confirmation'], [$row['source'], $row['status']]);
        $this->assertArrayNotHasKey('complaint_enc', $row);
        $this->assertArrayNotHasKey('manage_token_hash', $row);
    }

    public function test_double_booking_second_verification_fails_and_unique_constraint_holds(): void
    {
        $c1 = $this->start()->assertCreated()->json('challenge_id');
        $code1 = FakeOtpSender::lastCode(self::PHONE);
        $c2 = $this->start('14:00', ['phone' => '089901000778', 'name' => 'Dodi Uji Contoh'])->assertCreated()->json('challenge_id');
        $code2 = FakeOtpSender::lastCode('089901000778');
        $this->postJson(self::URL.'/verify', ['challenge_id' => $c1, 'code' => $code1])->assertCreated();
        $this->postJson(self::URL.'/verify', ['challenge_id' => $c2, 'code' => $code2])->assertStatus(409)->assertJsonPath('error', 'slot_taken');
        $this->assertSame(1, $this->inA(fn () => Appointment::where('dentist_id', $this->bunga())->where('starts_at', $this->at('14:00'))->count()));

        // DB-level guard: a second active appointment for the same dentist + start is rejected even without the PHP checks
        $this->expectException(UniqueConstraintViolationException::class);
        $this->staffAppt($this->bunga(), $this->kemangChairs()[1], '14:00', '14:30');
    }

    public function test_otp_wrong_code_attempt_limit_expiry_and_resend_cooldown(): void
    {
        $c = $this->start()->json('challenge_id');
        $code = FakeOtpSender::lastCode(self::PHONE);
        $wrong = $code === '000000' ? '111111' : '000000';
        $this->postJson(self::URL.'/verify', ['challenge_id' => $c, 'code' => $wrong])->assertStatus(422)->assertJsonPath('attempts_left', 4);
        foreach (range(1, 4) as $_) {
            $this->postJson(self::URL.'/verify', ['challenge_id' => $c, 'code' => $wrong])->assertStatus(422);
        }
        $this->postJson(self::URL.'/verify', ['challenge_id' => $c, 'code' => $code])->assertStatus(410)->assertJsonPath('error', 'otp_locked');

        $c = $this->start('15:00')->json('challenge_id');
        $this->postJson(self::URL.'/resend', ['challenge_id' => $c])->assertStatus(429)->assertJsonPath('error', 'resend_limited');
        $this->travel(61)->seconds();
        $this->postJson(self::URL.'/resend', ['challenge_id' => $c])->assertOk();
        $code = FakeOtpSender::lastCode(self::PHONE);
        $this->travel(6)->minutes();
        $this->postJson(self::URL.'/verify', ['challenge_id' => $c, 'code' => $code])->assertStatus(410)->assertJsonPath('error', 'otp_expired');
        $this->postJson(self::URL.'/verify', ['challenge_id' => $c, 'code' => '12'])->assertStatus(422); // FormRequest
    }

    public function test_start_validates_input(): void
    {
        $this->start('14:00', ['phone' => '123'])->assertStatus(422)->assertJsonValidationErrors('phone');
        $this->start('14:00', ['complaint' => str_repeat('a', 201)])->assertStatus(422)->assertJsonValidationErrors('complaint');
        $this->start('14:10')->assertStatus(409); // not on the slot grid
        $this->start('14:00', ['service_id' => $this->service('Cabut gigi')])->assertNotFound(); // not bookable online
    }

    public function test_tenant_isolation(): void
    {
        $ceria = '/api/public/booking/ceria';
        $info = $this->getJson($ceria)->assertOk();
        $this->assertSame(['drg. Citra Contoh'], array_column($info->json('dentists'), 'name'));
        // tenant A's dentist/service through tenant B's slug: nothing visible, nothing bookable
        $this->getJson("$ceria/slots?dentist_id={$this->bunga()}&service_id={$this->service('Konsultasi', $this->tenantB())}&date=".$this->day()->format('Y-m-d'))
            ->assertOk()->assertJsonPath('slots', []);
        $this->getJson("$ceria/slots?dentist_id={$this->bunga()}&service_id={$this->service('Konsultasi')}&date=".$this->day()->format('Y-m-d'))->assertNotFound();
        $this->start('14:00', ['service_id' => $this->service('Konsultasi', $this->tenantB())], $ceria)->assertStatus(409);
        // A's challenge and manage token do not work on B
        $c = $this->start()->json('challenge_id');
        $this->postJson("$ceria/verify", ['challenge_id' => $c, 'code' => FakeOtpSender::lastCode(self::PHONE)])->assertStatus(410);
        $this->getJson("$ceria/manage/demo-kelola-senyum")->assertNotFound();
        $this->postJson("$ceria/manage/demo-kelola-senyum/cancel")->assertNotFound();
        $this->getJson(self::URL.'/manage/demo-kelola-senyum')->assertOk();
    }

    public function test_booking_disabled(): void
    {
        $this->tenantA()->update(['online_booking_enabled' => false]);
        $this->getJson(self::URL)->assertOk()->assertJsonPath('clinic.online_booking_enabled', false)->assertJsonPath('dentists', []);
        $this->getJson(self::URL.'/slots?dentist_id='.$this->bunga().'&service_id='.$this->service('Konsultasi').'&date='.$this->day()->format('Y-m-d'))
            ->assertForbidden()->assertJsonPath('error', 'booking_disabled');
        $this->start()->assertForbidden();
    }

    public function test_rate_limits_per_phone_and_per_ip(): void
    {
        foreach (range(1, 5) as $i) {
            $this->assertNotSame(429, $this->start(sprintf('%02d:00', 13 + $i))->status());
        }
        $this->start('19:00')->assertStatus(429); // 6th code for one number within an hour

        // per IP: 10 per minute across numbers
        $statuses = array_map(fn ($i) => $this->start('13:00', ['phone' => '08990100080'.$i])->status(), range(1, 6));
        $this->assertNotSame(429, $statuses[0]);
        $this->assertContains(429, $statuses);
    }

    public function test_manage_page_shows_no_clinical_data_and_supports_reschedule_and_cancel(): void
    {
        $r = $this->book()->assertCreated();
        $url = self::URL.'/manage/'.$r->json('manage_token');
        $m = $this->getJson($url)->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $this->assertEqualsCanonicalizing(['clinic', 'code', 'status', 'starts_at', 'ends_at', 'branch', 'dentist', 'service', 'can_change'], array_keys($m->json()));
        $this->assertSame(['Konsultasi', 'drg. Bunga Contoh', $r->json('code')], [$m->json('service.name'), $m->json('dentist.name'), $m->json('code')]);
        $body = $m->getContent();
        foreach (['ngilu', 'Rani', '0777', 'patient'] as $secret) {
            $this->assertStringNotContainsString($secret, $body);
        }

        // reschedule to a free slot; the old time is free again; a taken time is refused
        $this->staffAppt($this->bunga(), $this->kemangChairs()[1], '17:00', '17:30');
        $this->postJson("$url/reschedule", ['starts_at' => $this->at('17:00')])->assertStatus(409);
        $this->postJson("$url/reschedule", ['starts_at' => $this->at('15:30')])->assertOk()
            ->assertJsonPath('starts_at', $this->at('15:30'))->assertJsonPath('status', 'pending_confirmation');
        $this->assertContains('14:00', $this->slotTimes($this->bunga(), $this->service('Konsultasi')));
        $this->assertSame(1, $this->inA(fn () => AuditEvent::where('action', 'jadwal_ulang')->where('actor_type', 'publik')->count()));

        $this->postJson("$url/cancel")->assertOk()->assertJsonPath('status', 'cancelled');
        $this->getJson($url)->assertNotFound()->assertJsonPath('error', 'link_invalid'); // token used up
        $this->assertContains('15:30', $this->slotTimes($this->bunga(), $this->service('Konsultasi')));
        $this->assertSame(1, $this->inA(fn () => AuditEvent::where('action', 'batal_online')->count()));
    }

    public function test_manage_link_expires_at_appointment_start(): void
    {
        $url = self::URL.'/manage/'.$this->book()->json('manage_token');
        $this->getJson($url)->assertOk();
        $this->travelTo($this->day()->setTime(14, 1)); // day() before travelling = the booked day
        $this->getJson($url)->assertStatus(410)->assertJsonPath('error', 'link_expired');
        $this->postJson("$url/cancel")->assertStatus(410);
        $this->getJson(self::URL.'/manage/'.str_repeat('x', 48))->assertNotFound();
    }

    public function test_staff_confirm_and_reject_need_appointment_confirm(): void
    {
        $id = fn ($r) => $this->inA(fn () => Appointment::where('booking_code', $r->json('code'))->value('id'));
        $a = $id($this->book());
        $this->as('asisten@senyum.test')->postJson("/api/appointments/$a/transition", ['to' => 'booked'])->assertForbidden();
        $this->as('depan@senyum.test')->postJson("/api/appointments/$a/transition", ['to' => 'checked_in'])->assertStatus(409); // must confirm first
        $this->as('depan@senyum.test')->postJson("/api/appointments/$a/transition", ['to' => 'booked'])->assertOk()->assertJsonPath('status', 'booked');
        $this->assertTrue($this->inA(fn () => AuditEvent::where('entity_id', $a)->where('action', 'ubah_status')->exists()));

        $b = $id($this->book('16:00'));
        $this->as('dokter.bunga@senyum.test')->postJson("/api/appointments/$b/transition", ['to' => 'rejected'])->assertOk()->assertJsonPath('status', 'rejected');
        $this->assertContains('16:00', $this->slotTimes($this->bunga(), $this->service('Konsultasi'))); // rejected frees the slot
        $this->as('depan@senyum.test')->postJson("/api/appointments/$b/transition", ['to' => 'booked'])->assertStatus(409);
    }
}
