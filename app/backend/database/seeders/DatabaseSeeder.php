<?php

namespace Database\Seeders;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceAdjustment;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Billing\Models\PaymentAccount;
use App\Modules\Clinical\Domain\CodingTemplate;
use App\Modules\Clinical\Domain\ProcedureCatalog;
use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\ClinicalNoteVersion;
use App\Modules\Clinical\Models\ConsentRecord;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\ToothBaseline;
use App\Modules\Clinical\Models\ToothFinding;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Identity\Models\User;
use App\Modules\Patients\Models\Guardian;
use App\Modules\Patients\Models\Household;
use App\Modules\Patients\Models\MedicalHistoryVersion;
use App\Modules\Patients\Models\Patient;
use App\Modules\Prescriptions\Models\Prescription;
use App\Modules\Prescriptions\Models\PrescriptionItem;
use App\Modules\Prescriptions\Models\PrescriptionVoid;
use App\Modules\Recall\Models\ReminderLog;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Scheduling\Models\Chair;
use App\Modules\Scheduling\Models\PlannedAppointment;
use App\Modules\Tariffs\Domain\DifficultyTemplate;
use App\Modules\Tariffs\Models\Tariff;
use App\Modules\Tenancy\Models\Branch;
use App\Modules\Tenancy\Models\DentistProfile;
use App\Modules\Tenancy\Models\Membership;
use App\Modules\Tenancy\Models\Tenant;
use App\Shared\Crypto\Crypto;
use App\Shared\Tenancy\Ctx;
use App\Shared\Terminology\CsvIcdSource;
use App\Shared\Terminology\IcdImporter;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

// SYNTHETIC DATA ONLY: invented clinics, names, NIK-like numbers (prefix 99 = no real province), 0899 phones.
class DatabaseSeeder extends Seeder
{
    public const PASSWORD = 'rahasia-dev-123';

    public const TOTP_SECRET = 'JBSWY3DPEHPK3PXP'; // well-known example secret, dev only

    private const FIRST = ['Sari', 'Budi', 'Dewi', 'Agus', 'Rina', 'Joko', 'Putri', 'Eko', 'Wulan', 'Hendra', 'Ayu', 'Rudi',
        'Fitri', 'Bayu', 'Nur', 'Dimas', 'Indah', 'Fajar', 'Lestari', 'Teguh'];

    private const LAST = ['Rahmawati', 'Santoso', 'Pratama', 'Wijaya', 'Kusuma', 'Hidayat', 'Saputra', 'Permata', 'Nugroho', 'Halim'];

    public function run(): void
    {
        // Official (not synthetic) ICD reference lists, same importer as `php artisan icd:import`.
        app(IcdImporter::class)->import(new CsvIcdSource(database_path('data/icd')));

        $users = [];
        foreach ([
            'pemilik@senyum.test' => ['Pemilik Senyum (dummy)', 'lainnya'],
            'dokter@senyum.test' => ['drg. Andi Contoh', 'dokter_gigi'],
            'asisten@senyum.test' => ['Asisten Contoh', 'lainnya'],
            'depan@senyum.test' => ['Front Desk Contoh', 'lainnya'],
            'kasir@senyum.test' => ['Kasir Senyum (dummy)', 'lainnya'],
            'dokter@ceria.test' => ['drg. Citra Contoh', 'dokter_gigi'],
            'kasir@ceria.test' => ['Kasir Ceria (dummy)', 'lainnya'],
        ] as $email => [$name, $license]) {
            $users[$email] = self::user($email, $name, $license);
        }

        $a = Tenant::create(['name' => 'Klinik Gigi Senyum Sehat', 'is_demo' => true]);
        $b = Tenant::create(['name' => 'Klinik Gigi Ceria', 'is_demo' => true]);

        Ctx::runAs($a->id, function () use ($users) {
            $b1 = $this->branch('Senyum Sehat Kemang (Jakarta)', ['Kursi 1', 'Kursi 2', 'Kursi 3']);
            $b2 = $this->branch('Senyum Sehat Rawamangun (Jakarta)', ['Kursi 1', 'Kursi 2']);
            $this->member($users['pemilik@senyum.test'], 'owner');
            $this->member($users['dokter@senyum.test'], 'dentist');
            DentistProfile::create(['user_id' => $users['dokter@senyum.test']->id, 'category' => 'general']);
            $this->member($users['asisten@senyum.test'], 'assistant', $b1->id);
            $this->member($users['depan@senyum.test'], 'front_desk', $b1->id);
            $this->member($users['kasir@senyum.test'], 'kasir', $b1->id);
            $patients = $this->patients(40, 1, [$b1->id, $b2->id]);
            $this->appointments([$b1, $b2], $users['dokter@senyum.test'], $patients);
            $this->clinicalDemo($b1, $users['dokter@senyum.test'], $patients[0]);
            $this->c3Demo($b1, $users['dokter@senyum.test'], $patients, 1);
            $this->paymentAccounts($users['pemilik@senyum.test'], [
                ['Kas Kemang', 'tunai', $b1->id], ['Kas Rawamangun', 'tunai', $b2->id], ['QRIS klinik', 'qris', null],
                ['EDC BCA klinik', 'edc', null, 'BCA'], ['Transfer BCA klinik', 'transfer', null, 'BCA', '0123']]);
        }, $users['pemilik@senyum.test']->id);

        Ctx::runAs($b->id, function () use ($users) {
            $b1 = $this->branch('Ceria Dago (Bandung)', ['Kursi A', 'Kursi B']);
            $this->member($users['dokter@ceria.test'], 'owner');
            $this->member($users['dokter@ceria.test'], 'dentist');
            DentistProfile::create(['user_id' => $users['dokter@ceria.test']->id, 'category' => 'general']);
            $this->member($users['kasir@ceria.test'], 'kasir', $b1->id);
            $patients = $this->patients(40, 2, [$b1->id]);
            $this->appointments([$b1], $users['dokter@ceria.test'], $patients);
            $this->c3Demo($b1, $users['dokter@ceria.test'], $patients, 2);
            $this->paymentAccounts($users['dokter@ceria.test'], [['Kas Dago', 'tunai', $b1->id]]);
        }, $users['dokter@ceria.test']->id);
    }

    public static function user(string $email, string $name, string $license = 'lainnya', bool $twoFactor = true): User
    {
        $u = User::create(['name' => $name, 'email' => $email, 'password' => self::PASSWORD, 'license_type' => $license]);
        if ($twoFactor) {
            $u->forceFill([
                'two_factor_secret' => encrypt(self::TOTP_SECRET),
                'two_factor_recovery_codes' => encrypt(json_encode(['dev-recovery-1', 'dev-recovery-2'])),
                'two_factor_confirmed_at' => now(),
            ])->save();
        }

        return $u;
    }

    /** Unit 5: synthetic clinic payment accounts (the only payment methods). New tenants start with none; the owner adds them. */
    private function paymentAccounts(User $owner, array $rows): void
    {
        foreach ($rows as $r) {
            PaymentAccount::create(['name' => $r[0], 'kind' => $r[1], 'branch_id' => $r[2], 'bank_name' => $r[3] ?? null,
                'account_last4' => $r[4] ?? null, 'created_by' => $owner->id]);
        }
    }

    private function branch(string $name, array $chairs): Branch
    {
        $b = Branch::create(['name' => $name, 'timezone' => 'Asia/Jakarta']);
        foreach ($chairs as $label) {
            Chair::create(['branch_id' => $b->id, 'label' => $label]);
        }

        return $b;
    }

    private function member(User $u, string $role, ?string $branchId = null): void
    {
        Membership::create(['user_id' => $u->id, 'role' => $role, 'branch_id' => $branchId]);
    }

    /** @return list<Patient> */
    private function patients(int $n, int $seed, array $branchIds): array
    {
        $out = [];
        for ($i = 0; $i < $n; $i++) {
            $name = self::FIRST[($i + $seed) % 20].' '.self::LAST[($i * 3 + $seed) % 10];
            $p = (new Patient)->fillIdentity([
                'name' => $name,
                'nik' => sprintf('99%02d%012d', $seed, $i + 1),
                'phone' => sprintf('0899%02d%06d', $seed, $i + 1),
                'address' => 'Jl. Contoh No. '.($i + 1).', Kota Fiktif',
            ])->fill([
                'dob' => CarbonImmutable::create(1960 + ($i * 7) % 55, 1 + $i % 12, 1 + $i % 28)->format('Y-m-d'),
                'sex' => $i % 2 ? 'laki_laki' : 'perempuan',
                'home_branch_id' => $branchIds[$i % count($branchIds)],
                'payer_type' => $i % 5 === 0 ? 'asuransi' : 'umum',
                'payer_name' => $i % 5 === 0 ? 'Asuransi Fiktif Sejahtera' : null,
                'created_by' => Ctx::current()->userId,
            ]);
            $p->save();
            $out[] = $p;
        }

        return $out;
    }

    /** ~25 non-overlapping appointments today + tomorrow (Asia/Jakarta), 45-minute slots per chair. */
    private function appointments(array $branches, User $dentist, array $patients): void
    {
        $chairs = Chair::whereIn('branch_id', array_map(fn ($b) => $b->id, $branches))->orderBy('label')->get();
        $today = CarbonImmutable::now('Asia/Jakarta')->startOfDay();
        $n = 0;
        foreach ([0, 1] as $day) {
            foreach ($chairs as $c => $chair) {
                $slots = max(2, intdiv(13, $chairs->count())); // spread ~25 over both days
                for ($s = 0; $s < $slots; $s++) {
                    // one dentist per tenant: chairs take turns in 50-min steps so the dentist is never double-booked either
                    $start = $today->addDays($day)->setTime(9, 0)->addMinutes($s * 50 * $chairs->count() + $c * 50);
                    Appointment::create([
                        'branch_id' => $chair->branch_id, 'chair_id' => $chair->id, 'dentist_id' => $dentist->id,
                        'patient_id' => $patients[$n++ % count($patients)]->id,
                        'starts_at' => $start->utc(), 'ends_at' => $start->addMinutes(45)->utc(),
                        'status' => 'booked', 'reason' => 'Kontrol rutin',
                        'created_by' => Ctx::current()->userId,
                    ]);
                }
            }
        }
    }

    /** Patient 0: visit -5d (signed + corrected note), visit -2d (signed note), today's appointment (draft odontogram + SOAP). */
    private function clinicalDemo(Branch $branch, User $dentist, Patient $patient): void
    {
        $visit = fn (int $daysAgo, ?string $apptId = null) => Visit::create(['patient_id' => $patient->id, 'branch_id' => $branch->id,
            'dentist_id' => $dentist->id, 'appointment_id' => $apptId, 'started_at' => now()->subDays($daysAgo),
            'ended_at' => $daysAgo ? now()->subDays($daysAgo)->addHour() : null, 'status' => $daysAgo ? 'selesai' : 'berlangsung']);
        $note = fn (Visit $v) => ClinicalNote::create(['visit_id' => $v->id, 'patient_id' => $patient->id, 'author_id' => $dentist->id,
            'first_input_at' => $v->started_at]);
        $finding = fn (Visit $v, int $tooth, ?string $surface, string $cond, string $state = 'final', string $source = 'manual') => ToothFinding::create([
            'patient_id' => $patient->id, 'visit_id' => $v->id, 'tooth' => $tooth, 'surface' => $surface, 'condition' => $cond,
            'state' => $state, 'source' => $source, 'created_by' => $dentist->id,
            'finalized_by' => $state === 'final' ? $dentist->id : null, 'finalized_at' => $state === 'final' ? $v->started_at : null]);
        // treatments (DEVIATIONS #47): one procedure_record per act; surfaces is a combination, e.g. "MOD"
        $procedure = fn (Visit $v, int $tooth, ?string $surfaces, string $status, string $code, ?string $dx = null, string $state = 'final') => self::procedure(
            $v, $tooth, $surfaces, $status, $code, $dx, $state, $dentist);
        $soap = fn (string $s, string $o, string $a, array $icd10, string $p, array $icd9 = []) => ['S' => $s, 'O' => $o,
            'A' => ['codes' => $icd10, 'text' => $a], 'P' => ['codes' => $icd9, 'text' => $p]];

        $v1 = $visit(5);
        $n1 = $note($v1);
        $x1 = self::version($n1, 1, null, $soap('Ngilu gigi kanan bawah saat minum dingin.', 'Karies dentin gigi 36 oklusal.', 'Karies dentin', ['K02.1'], 'Tumpatan komposit.', ['23.2']), $dentist, at: $v1->started_at);
        self::version($n1, 2, $x1, $soap('Ngilu gigi kanan bawah saat minum dingin.', 'Karies dentin gigi 46 oklusal.', 'Karies dentin', ['K02.1'], 'Tumpatan komposit.', ['23.2']), $dentist, 'Salah nomor gigi (36 -> 46)', $v1->started_at->addHours(3));
        $procedure($v1, 46, 'O', 'selesai', '23.2');

        $v2 = $visit(2);
        self::version($note($v2), 1, null, $soap('Kontrol tumpatan, tidak ada keluhan.', 'Tumpatan 46 baik. Gigi 18 goyang derajat 3.', 'Periodontitis kronis', ['K05.3'], 'Rencana cabut 18.'), $dentist, at: $v2->started_at);
        $finding($v2, 18, null, 'perlu_dicabut');
        $procedure($v2, 18, null, 'direncanakan', '23.09');
        $finding($v2, 11, 'I', 'karies');

        $appt = Appointment::where('patient_id', $patient->id)->orderBy('starts_at')->firstOrFail();
        $v3 = $visit(0, $appt->id);
        $draft = (new ClinicalNoteVersion(['note_id' => $note($v3)->id, 'version' => 1, 'revision' => 1, 'state' => 'draft',
            'source' => 'manual', 'created_by' => $dentist->id]))->setSoap($soap('Gigi depan atas berlubang.', 'Karies email 11 insisal, 26 oklusal.', 'Karies email', ['K02.0'], 'Tumpatan 11 dan 26.', ['23.2']));
        $draft->save();
        $procedure($v3, 11, 'I', 'selesai', '23.2', 'K02.0', 'draft');
        $finding($v3, 26, 'O', 'karies', 'draft', 'ai_draft');
    }

    /**
     * UNIT C3 examples (synthetic): fake tariffs; patient 0 with allergy + premedication + urgent note (2 versions), baseline,
     * household with a minor (guardian = patient 0, guarantor = patient 0) + consent signed by the guardian; a planned appointment;
     * a reminder already sent for the first booked appointment; patient 1: signed visit with a billed procedure + a discount.
     */
    private function c3Demo(Branch $branch, User $dentist, array $patients, int $seed): void
    {
        DifficultyTemplate::seed('2026-01-01');
        CodingTemplate::seed(); // usulan condition -> ICD mapping (not a national standard)
        ProcedureCatalog::seed(); // how codes are charted (treat_area / paint_type); not prices
        Tariff::create(['procedure_code' => '23.2', 'name' => 'Tumpatan (contoh)', 'variant' => 'standar', 'level_label' => '1 permukaan',
            'price_rp' => 200000, 'valid_from' => '2025-01-01', 'valid_to' => '2026-01-01']);

        $p0 = $patients[0];
        $history = fn (int $v, array $c, bool $premed) => MedicalHistoryVersion::create(['patient_id' => $p0->id, 'version' => $v,
            'content_enc' => Crypto::encrypt(json_encode($c)), 'premedication_required' => $premed, 'created_by' => $dentist->id]);
        $history(1, ['medications' => [], 'problems' => [], 'allergies' => ['Penisilin'], 'urgent_note' => null], false);
        $history(2, ['medications' => ['Warfarin (contoh)'], 'problems' => ['Katup jantung buatan (contoh)'], 'allergies' => ['Penisilin', 'Lateks'],
            'urgent_note' => 'Konsultasi dokter jantung sebelum tindakan invasif (contoh sintetis).'], true);
        ToothBaseline::create(['patient_id' => $p0->id, 'version' => 1, 'dentition' => 'tetap', 'teeth' => ['38' => 'hilang', '48' => 'belum_tumbuh'], 'created_by' => $dentist->id]);

        $home = Household::create(['name' => 'Keluarga '.explode(' ', $p0->name)[1].' (contoh)']);
        $minor = (new Patient)->fillIdentity(['name' => 'Nadia Anak Contoh', 'nik' => sprintf('99%02d%012d', $seed, 900), 'phone' => null])
            ->fill(['dob' => now()->subYears(9)->format('Y-m-d'), 'sex' => 'perempuan', 'home_branch_id' => $branch->id, 'household_id' => $home->id,
                'guarantor_id' => $p0->id, 'created_by' => Ctx::current()->userId]);
        $minor->save();
        $p0->update(['household_id' => $home->id]);
        $guardian = (new Guardian)->forceFill(['patient_id' => $minor->id, 'name' => $p0->name, 'relationship' => 'ibu', 'guardian_patient_id' => $p0->id,
            'nik_enc' => Crypto::encrypt(sprintf('99%02d%012d', $seed, 1)), 'nik_bidx' => Crypto::blindIndex(sprintf('99%02d%012d', $seed, 1)),
            'phone_enc' => Crypto::encrypt(sprintf('6289%02d%06d', $seed, 1)), 'phone_bidx' => Crypto::blindIndex(sprintf('6289%02d%06d', $seed, 1))]);
        $guardian->save();
        ConsentRecord::create(['patient_id' => $minor->id, 'kind' => 'pemeriksaan_umum', 'signer' => 'wali', 'guardian_id' => $guardian->id,
            'document_hash' => hash('sha256', 'formulir contoh'), 'witness_name' => 'Asisten Contoh', 'device' => 'Tablet resepsi (contoh)',
            'signed_at' => now(), 'created_by' => $dentist->id]);

        PlannedAppointment::create(['patient_id' => $p0->id, 'branch_id' => $branch->id, 'dentist_id' => $dentist->id, 'procedure_code' => '23.09',
            'procedure_enc' => Crypto::encrypt('Cabut gigi 18'), 'note_enc' => Crypto::encrypt('Pasien minta jam pagi'), 'est_minutes' => 45,
            'priority' => 'normal', 'created_by' => $dentist->id]);
        PlannedAppointment::create(['patient_id' => $patients[1]->id, 'branch_id' => $branch->id, 'dentist_id' => $dentist->id,
            'procedure_enc' => Crypto::encrypt('Kontrol pasca tumpatan'), 'est_minutes' => 30, 'priority' => 'segera', 'created_by' => $dentist->id]);

        $first = Appointment::where('status', 'booked')->orderBy('starts_at')->firstOrFail();
        ReminderLog::create(['appointment_id' => $first->id, 'kind' => 'h_minus_1', 'channel' => 'noop', 'scheduled_for' => $first->starts_at->copy()->subDay(),
            'appointment_starts_at' => $first->starts_at, 'sent_at' => $first->starts_at->copy()->subDay()]);

        $p1 = $patients[1];
        $visit = Visit::create(['patient_id' => $p1->id, 'branch_id' => $branch->id, 'dentist_id' => $dentist->id, 'started_at' => now()->subDays(10),
            'ended_at' => now()->subDays(10)->addHour(), 'status' => 'selesai']);
        $done = self::procedure($visit, 36, 'O', 'selesai', '23.2', null, 'final', $dentist);
        $invoice = Invoice::create(['visit_id' => $visit->id, 'patient_id' => $p1->id, 'payer_patient_id' => $p1->id, 'branch_id' => $branch->id, 'created_by' => $dentist->id]);
        InvoiceLine::create(['invoice_id' => $invoice->id, 'procedure_id' => $done->id, 'procedure_code' => '23.2', 'variant' => 'standar', 'tooth' => 36, 'price_rp' => 250000]);
        InvoiceAdjustment::create(['invoice_id' => $invoice->id, 'kind' => 'discount', 'amount_rp' => 25000, 'reason' => 'Diskon pelanggan lama (contoh)', 'created_by' => $dentist->id]);

        // U0c prescription (D-036): #1 signed, voided with a reason, reissued as #2 (supersedes #1). KFA codes are synthetic.
        $rx = fn (string $no, ?string $supersedes) => Prescription::create(['number' => $no, 'patient_id' => $p1->id, 'visit_id' => $visit->id,
            'branch_id' => $branch->id, 'dentist_id' => $dentist->id, 'supersedes_id' => $supersedes, 'created_by' => $dentist->id]);
        $sign = function (Prescription $p, array $dosage) {
            (new PrescriptionItem(['prescription_id' => $p->id, 'kfa_code' => 'KFA-CONTOH-01']))->setDosage($dosage)->save();
            $p->update(['state' => 'signed', 'signed_at' => now()->subDays(10), 'content_hash' => hash('sha256', 'cetakan contoh '.$p->number)]);
        };
        $rx1 = $rx("R-$seed-0001", null);
        $sign($rx1, ['dose' => '500 mg', 'route' => 'oral', 'frequency' => '3x sehari', 'duration_days' => 3]);
        PrescriptionVoid::create(['prescription_id' => $rx1->id, 'reason_enc' => Crypto::encrypt('Salah durasi (contoh)'), 'voided_by' => $dentist->id]);
        $sign($rx("R-$seed-0002", $rx1->id), ['dose' => '500 mg', 'route' => 'oral', 'frequency' => '3x sehari', 'duration_days' => 5]);
    }

    public static function procedure(Visit $v, int $tooth, ?string $surfaces, string $status, string $code, ?string $dx, string $state, User $dentist): ProcedureRecord
    {
        return ProcedureRecord::create(['patient_id' => $v->patient_id, 'visit_id' => $v->id, 'treat_area' => $surfaces ? 'surface' : 'tooth',
            'tooth' => $tooth, 'surfaces' => $surfaces, 'status' => $status, 'procedure_code' => $code, 'diagnosis_code' => $dx,
            'diagnosis_source' => $dx ? 'manual' : null, 'provider_id' => $v->dentist_id, 'state' => $state, 'created_by' => $dentist->id,
            'finalized_by' => $state === 'final' ? $dentist->id : null, 'finalized_at' => $state === 'final' ? $v->started_at : null]);
    }

    public static function version(ClinicalNote $note, int $n, ?ClinicalNoteVersion $supersedes, array $soap, User $signer, ?string $reason = null, $at = null): ClinicalNoteVersion
    {
        $v = (new ClinicalNoteVersion([
            'note_id' => $note->id, 'version' => $n, 'supersedes_id' => $supersedes?->id, 'reason' => $reason,
            'state' => 'signed', 'signed_by' => $signer->id, 'signed_at' => $at ?? now(), 'created_by' => $signer->id,
        ]))->setSoap($soap);
        $v->save();

        return $v;
    }
}
