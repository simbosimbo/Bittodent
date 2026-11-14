<?php

namespace App\Console\Commands;

use App\Modules\Clinical\Domain\Soap;
use App\Modules\Patients\Models\Patient;
use App\Shared\Crypto\Crypto;
use Carbon\CarbonImmutable;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PDO;

// SYNTHETIC DATA ONLY. Bulk-loads ehr_bench (never ehr_dev/ehr_test). See tools/bench/CLAIMS.md.
class BenchSeedCommand extends Command
{
    protected $signature = 'bench:seed
        {--fresh : migrate:fresh --database=mysql_admin (ehr_bench only, no default seeder)}
        {--append : add tenants; do not wipe}
        {--tenants=1}
        {--patients=10000}
        {--years=10}
        {--visits-per-patient-year=1.2}
        {--findings-per-visit=8}
        {--note-versions-per-visit=1.3}
        {--audit-per-visit=30}
        {--audit-per-patient-year=5}
        {--chairs=5}
        {--label=A}';

    protected $description = 'Bulk-load synthetic scale data into ehr_bench only';

    private PDO $pdo;

    private string $passwordHash;

    private string $soapEnc;

    private string $soapHash;

    private string $addrEnc;

    /** @var list<string> */
    private array $auditBuf = [];

    private int $auditBufN = 0;

    private int $auditWritten = 0;

    public function handle(): int
    {
        ini_set('memory_limit', '1024M');
        $db = (string) config('database.connections.mysql_admin.database');
        if (! app()->environment('local', 'bench') || $db !== 'ehr_bench') {
            $this->error("bench:seed hanya untuk APP_ENV=local|bench dan database ehr_bench (sekarang env=".app()->environment().", db=$db).");

            return 1;
        }
        if ($this->option('fresh')) {
            if ($this->option('append')) {
                $this->error('--fresh dan --append tidak bisa bersamaan.');

                return 1;
            }
            $this->info('migrate:fresh --database=mysql_admin (tanpa DatabaseSeeder)');
            $this->call('migrate:fresh', ['--database' => 'mysql_admin', '--force' => true]);
        }
        $this->pdo = DB::connection('mysql_admin')->getPdo();
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->exec('SET FOREIGN_KEY_CHECKS=0, UNIQUE_CHECKS=0, autocommit=1');
        $this->passwordHash = Hash::make(DatabaseSeeder::PASSWORD);
        $soap = Soap::normalize([
            'S' => 'SYNTHETIC bench note: keluhan gigi fiktif, bukan data pasien.',
            'O' => 'Pemeriksaan sintetis. Bukan radiograf atau temuan klinis nyata.',
            'A' => ['codes' => ['K02.1'], 'text' => 'Karies sintetis'],
            'P' => ['codes' => ['23.2'], 'text' => 'Rencana fiktif'],
        ]);
        $this->soapHash = Soap::hash($soap);
        $this->soapEnc = Crypto::encrypt(Soap::canonicalJson($soap));
        $this->addrEnc = Crypto::encrypt('Jl. Sintetis No. 1, Kota Fiktif (BUKAN ALAMAT NYATA)');

        $tenants = (int) $this->option('tenants');
        $patients = (int) $this->option('patients');
        $years = (int) $this->option('years');
        $vppy = (float) $this->option('visits-per-patient-year');
        $fpv = (int) $this->option('findings-per-visit');
        $nvpv = (float) $this->option('note-versions-per-visit');
        $apv = (int) $this->option('audit-per-visit');
        $appy = (int) $this->option('audit-per-patient-year');
        $nChairs = (int) $this->option('chairs');
        $label = strtolower((string) $this->option('label'));
        $t0 = microtime(true);
        $manifest = ['synthetic' => true, 'label' => $label, 'generated_at' => now('Asia/Jakarta')->toIso8601String(), 'tenants' => []];

        for ($t = 1; $t <= $tenants; $t++) {
            $this->info(sprintf('Tenant %s-%02d: %d patients, %d years ...', $label, $t, $patients, $years));
            $manifest['tenants'][] = $this->seedTenant($label, $t, $patients, $years, $vppy, $fpv, $nvpv, $apv, $appy, $nChairs);
        }
        $this->flushAudit();
        $this->pdo->exec('SET FOREIGN_KEY_CHECKS=1, UNIQUE_CHECKS=1');
        $elapsed = microtime(true) - $t0;
        $manifest['seed_seconds'] = round($elapsed, 2);
        $manifest['audit_rows_written'] = $this->auditWritten;
        $dir = database_path('bench/out');
        if (! is_dir($dir)) {
            mkdir($dir, 0770, true);
        }
        $path = $dir.'/manifest-'.$label.'.json';
        file_put_contents($path, json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        $this->info(sprintf('Selesai dalam %.1f s. Manifest: %s', $elapsed, $path));

        return 0;
    }

    private function seedTenant(string $label, int $seq, int $nPatients, int $years, float $vppy, int $fpv, float $nvpv, int $apv, int $appy, int $nChairs): array
    {
        $tag = sprintf('bench-%s-%02d', $label, $seq);
        $now = gmdate('Y-m-d H:i:s');
        $tenantId = $this->id();
        $this->row('tenant', ['id', 'name', 'mode', 'is_demo', 'created_at', 'updated_at'],
            [$tenantId, 'Klinik Sintetis '.strtoupper($tag).' (BUKAN KLINIK NYATA)', 'standar', 0, $now, $now]);

        $branchId = $this->id();
        $this->row('branch', ['tenant_id', 'id', 'name', 'timezone', 'created_at', 'updated_at', 'archived_at'],
            [$tenantId, $branchId, 'Cabang Sintetis '.$tag, 'Asia/Jakarta', $now, $now, null]);

        $chairIds = [];
        $chairRows = [];
        for ($i = 1; $i <= $nChairs; $i++) {
            $chairIds[] = $cid = $this->id();
            $chairRows[] = [$tenantId, $cid, $branchId, 'Kursi '.$i, 1, $now, $now];
        }
        $this->rows('chair', ['tenant_id', 'id', 'branch_id', 'label', 'active', 'created_at', 'updated_at'], $chairRows);

        $roles = [
            'pemilik' => ['owner', 'lainnya', 'Pemilik Sintetis '.$tag],
            'dokter' => ['dentist', 'dokter_gigi', 'drg. Sintetis '.$tag],
            'asisten' => ['assistant', 'lainnya', 'Asisten Sintetis '.$tag],
            'depan' => ['front_desk', 'lainnya', 'Front Desk Sintetis '.$tag],
            'kasir' => ['kasir', 'lainnya', 'Kasir Sintetis '.$tag],
        ];
        $users = [];
        $secret = encrypt(DatabaseSeeder::TOTP_SECRET);
        $codes = encrypt(json_encode(['dev-recovery-1', 'dev-recovery-2']));
        foreach ($roles as $local => [$role, $license, $name]) {
            $uid = $this->id();
            $email = $local.'@'.$tag.'.test';
            $this->row('users', ['id', 'name', 'email', 'email_verified_at', 'password', 'remember_token', 'license_type', 'two_factor_secret', 'two_factor_recovery_codes', 'two_factor_confirmed_at', 'created_at', 'updated_at'],
                [$uid, $name, $email, $now, $this->passwordHash, null, $license, $secret, $codes, $now, $now, $now]);
            $mid = $this->id();
            $branchForRole = $role === 'owner' || $role === 'dentist' ? null : $branchId;
            $this->row('membership', ['tenant_id', 'id', 'user_id', 'branch_id', 'role', 'created_at', 'updated_at', 'revoked_at'],
                [$tenantId, $mid, $uid, $branchForRole, $role, $now, $now, null]);
            $users[$local] = ['id' => $uid, 'email' => $email, 'role' => $role];
        }
        $dentistId = $users['dokter']['id'];
        $actorId = $users['pemilik']['id'];

        $this->row('tariff', ['tenant_id', 'id', 'procedure_code', 'name', 'variant', 'level_label', 'level_rank', 'price_rp', 'valid_from', 'valid_to', 'created_at', 'updated_at'],
            [$tenantId, $this->id(), '23.2', 'Restorasi sintetis', 'standar', 'Standar', 1, 250000, '2015-01-01', null, $now, $now]);

        $first = ['Sari', 'Budi', 'Dewi', 'Agus', 'Rina', 'Joko', 'Putri', 'Eko', 'Wulan', 'Hendra', 'Ayu', 'Rudi', 'Fitri', 'Bayu', 'Nur', 'Dimas', 'Indah', 'Fajar', 'Lestari', 'Teguh'];
        $last = ['Rahmawati', 'Santoso', 'Pratama', 'Wijaya', 'Kusuma', 'Hidayat', 'Saputra', 'Permata', 'Nugroho', 'Halim'];

        $patientIds = [];
        $niks = [];
        $phones = [];
        $pRows = [];
        for ($i = 0; $i < $nPatients; $i++) {
            $id = $this->id();
            $patientIds[] = $id;
            $name = $first[$i % 20].' '.$last[($i * 3 + $seq) % 10].' '.sprintf('%04d', $i + 1);
            $nik = sprintf('99%02d%012d', $seq, $i + 1); // prefix 99 = bukan NIK provinsi nyata
            $phone = sprintf('0899%02d%06d', $seq, $i + 1);
            $niks[] = $nik;
            $phones[] = $phone;
            $nikN = Crypto::normalizeNik($nik);
            $phoneN = Crypto::normalizePhone($phone);
            $pRows[] = [
                $tenantId, $id, $branchId, $name, Patient::normalizeName($name),
                sprintf('%04d-%02d-%02d', 1960 + ($i * 7) % 55, 1 + $i % 12, 1 + $i % 28),
                $i % 2 ? 'laki_laki' : 'perempuan',
                Crypto::encrypt($nikN), Crypto::blindIndex($nikN),
                Crypto::encrypt($phoneN), Crypto::blindIndex($phoneN),
                $this->addrEnc,
                $i % 5 === 0 ? 'asuransi' : 'umum',
                $i % 5 === 0 ? 'Asuransi Fiktif Sejahtera' : null,
                $i % 5 === 0 ? 'SYN-'.$nik : null,
                null, 'aktif', $actorId, $now, $now,
            ];
            if (count($pRows) >= 500) {
                $this->rows('patient', $this->patientCols(), $pRows);
                $pRows = [];
                $this->line('  patients '.($i + 1).'/'.$nPatients);
            }
        }
        if ($pRows) {
            $this->rows('patient', $this->patientCols(), $pRows);
        }

        $today = CarbonImmutable::now('Asia/Jakarta')->startOfDay();
        $startDay = $today->subYears($years);
        $workdays = [];
        for ($d = $startDay; $d->lt($today); $d = $d->addDay()) {
            if ($d->dayOfWeek !== 0) { // skip Sunday
                $workdays[] = $d;
            }
        }
        $slotsPerDay = 18; // 08:00-17:00, 30 min
        $capacity = count($workdays) * $nChairs * $slotsPerDay;
        $visitsTarget = (int) round($nPatients * $vppy * $years);
        // Patient 0 is the "heavy" chart case (~40 visits) when years allow it.
        $extraHeavy = max(0, 40 - (int) round($vppy * $years));
        $visitsTarget = min($capacity - 200, $visitsTarget + $extraHeavy); // leave room for today/future/drafts
        if ($visitsTarget < 1) {
            $this->warn('  kapasitas kursi tidak cukup; kurangi pasien/tahun atau tambah kursi');
        }

        $visitOf = array_fill(0, $nPatients, 0);
        $assign = [];
        $ptr = 0;
        $want = array_fill(0, $nPatients, (int) round($vppy * $years));
        $want[0] += $extraHeavy;
        // Round-robin so early patients are not the only ones with history.
        $left = $visitsTarget;
        $p = 0;
        while ($left > 0) {
            if ($visitOf[$p] < $want[$p]) {
                $slot = $this->slotAt($ptr++, $nChairs, $slotsPerDay, $workdays);
                if ($slot === null) {
                    break;
                }
                $assign[] = [$p, $slot];
                $visitOf[$p]++;
                $left--;
            }
            $p = ($p + 1) % $nPatients;
            // if everyone is filled, break
            if ($p === 0 && $left > 0 && $visitOf[$p] >= $want[$p]) {
                $full = true;
                for ($k = 0; $k < $nPatients; $k++) {
                    if ($visitOf[$k] < $want[$k]) {
                        $full = false;
                        break;
                    }
                }
                if ($full) {
                    break;
                }
            }
        }

        $openToday = [];
        $openFuture = [];
        $draftVisits = [];
        // Today booked slots (no visit) for GET /schedule.
        $todaySlots = 80;
        for ($i = 0; $i < $todaySlots; $i++) {
            $chair = $i % $nChairs;
            $slot = intdiv($i, $nChairs);
            $starts = $today->addMinutes(8 * 60 + $slot * 30);
            $pid = $patientIds[$i % $nPatients];
            $openToday[] = $this->putAppointment($tenantId, $branchId, $chairIds[$chair], $dentistId, $pid, $actorId, $starts, 'booked', false);
        }
        // Tomorrow booked, no visit: encounter-create bench.
        $tomorrow = $today->addDay();
        for ($i = 0; $i < 40; $i++) {
            $starts = $tomorrow->addMinutes(8 * 60 + $i * 30);
            $chair = $i % $nChairs;
            $pid = $patientIds[($i + 17) % $nPatients];
            $openFuture[] = $this->putAppointment($tenantId, $branchId, $chairIds[$chair], $dentistId, $pid, $actorId, $starts, 'booked', false);
        }

        $teeth = [11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27, 31, 36];
        $conditions = ['karies', 'tambalan', 'hilang', 'gigi_sempurna', 'karang'];
        $aRows = $vRows = $nRows = $nvRows = $fRows = $invRows = $rxRows = $rxiRows = [];
        $signedVisitIds = [];
        $draftInfo = [];
        $nAssign = count($assign);
        $secondVersionEvery = $nvpv > 1 ? max(1, (int) round(1 / ($nvpv - 1))) : 0;
        $rxEvery = 5; // 20% visits get a prescription
        $historyStart = $startDay->utc();

        foreach ($assign as $vi => [$pi, $slot]) {
            [$starts, $chairIdx] = $slot;
            $isDraft = $vi >= $nAssign - 40; // last 40: signed appointment done? keep as berlangsung + draft note
            $pid = $patientIds[$pi];
            $apptId = $this->id();
            $visitId = $this->id();
            $noteId = $this->id();
            $verId = $this->id();
            $ends = $starts->addMinutes(30);
            $st = $starts->utc()->format('Y-m-d H:i:s');
            $en = $ends->utc()->format('Y-m-d H:i:s');
            $statusAppt = $isDraft ? 'in_treatment' : 'done';
            $aRows[] = [$tenantId, $apptId, $branchId, $chairIds[$chairIdx], $dentistId, $pid, $st, $en, $statusAppt, 'Kunjungan sintetis', $actorId, $st, $st,
                $isDraft ? $st : $st, $isDraft ? $st : $st, $isDraft ? null : $en];
            $vRows[] = [$tenantId, $visitId, $pid, $branchId, $dentistId, $apptId, $st, $isDraft ? null : $en, $isDraft ? 'berlangsung' : 'selesai', $actorId, $st, $st];
            $nRows[] = [$tenantId, $noteId, $visitId, $pid, $dentistId, $st, $st, $st];
            // Re-encrypt periodically so ciphertext is not a single reused blob (GCM IV uniqueness).
            $enc = ($vi % 17 === 0) ? Crypto::encrypt(Soap::canonicalJson(Soap::normalize([
                'S' => 'SYNTHETIC bench note #'.$vi, 'O' => 'Pemeriksaan sintetis.', 'A' => ['codes' => ['K02.1'], 'text' => 'Karies sintetis'], 'P' => ['codes' => ['23.2'], 'text' => 'Rencana fiktif'],
            ]))) : $this->soapEnc;
            $hash = $this->soapHash;
            if ($isDraft) {
                $nvRows[] = [$tenantId, $verId, $noteId, 1, 1, null, $enc, $hash, null, 'draft', 'manual', null, null, $dentistId, $st, $st];
                $draftInfo[] = ['visit_id' => $visitId, 'note_id' => $noteId, 'version_id' => $verId, 'patient_id' => $pid, 'revision' => 1];
            } else {
                $nvRows[] = [$tenantId, $verId, $noteId, 1, 1, null, $enc, $hash, null, 'signed', 'manual', $dentistId, $st, $dentistId, $st, $st];
                $signedVisitIds[] = $visitId;
                if ($secondVersionEvery && $vi % $secondVersionEvery === 0) {
                    $ver2 = $this->id();
                    $st2 = $starts->utc()->addHours(2)->format('Y-m-d H:i:s');
                    $nvRows[] = [$tenantId, $ver2, $noteId, 2, 1, $verId, $enc, $hash, 'Koreksi sintetis', 'signed', 'manual', $dentistId, $st2, $dentistId, $st2, $st2];
                }
            }
            for ($f = 0; $f < $fpv; $f++) {
                $fid = $this->id();
                $tooth = $teeth[$f % count($teeth)];
                $cond = $conditions[$f % count($conditions)];
                $fRows[] = [$tenantId, $fid, $pid, $visitId, $tooth, 'O', $cond, $isDraft ? 'kondisi_pantau' : 'selesai', $isDraft ? null : '23.2', 'standar', $isDraft ? 'draft' : 'final', 'manual', null, $dentistId, $isDraft ? null : $dentistId, $isDraft ? null : $st, $st, $st];
                if (! $isDraft && $f === 0) {
                    // one invoice line needs a finding id; store on invoice via first finding
                    $invId = $this->id();
                    $invRows[] = [$tenantId, $invId, $visitId, $pid, $pid, $branchId, $isDraft ? 'terbuka' : 'terbuka', $actorId, $st, $st];
                }
            }
            if (! $isDraft && $vi % $rxEvery === 0) {
                $rxId = $this->id();
                $rxRows[] = [$tenantId, $rxId, 'RX-'.$tag.'-'.($vi + 1), $pid, $visitId, $branchId, $dentistId, 'draft', null, null, null, $dentistId, $st, $st];
                $rxiRows[] = [$tenantId, $this->id(), $rxId, 'SYN-KFA-1', Crypto::encrypt('{"dose":"1 tablet","route":"oral","frequency":"2x sehari","duration_days":5,"note":"SYNTHETIC"}'), $st, $st];
            }
            // audit: 30/visit + later per-patient-year
            $occurred = $st;
            $actions = ['buat', 'baca', 'ubah', 'tanda_tangan', 'buat', 'baca'];
            for ($a = 0; $a < $apv; $a++) {
                $etype = $a % 5 === 0 ? 'patient' : ($a % 5 === 1 ? 'visit' : ($a % 5 === 2 ? 'chart' : ($a % 5 === 3 ? 'clinical_note_version' : 'appointment')));
                $eid = $etype === 'patient' ? $pid : ($etype === 'appointment' ? $apptId : ($etype === 'clinical_note_version' ? $verId : $visitId));
                $this->queueAudit($tenantId, $actorId, $branchId, $actions[$a % 6], $etype, $eid, $occurred);
            }

            if (count($aRows) >= 400) {
                $this->flushClinical($aRows, $vRows, $nRows, $nvRows, $fRows, $invRows, $rxRows, $rxiRows);
                $aRows = $vRows = $nRows = $nvRows = $fRows = $invRows = $rxRows = $rxiRows = [];
                if ($vi % 4000 === 0) {
                    $this->line("  visits ".($vi + 1)."/$nAssign");
                }
            }
        }
        $this->flushClinical($aRows, $vRows, $nRows, $nvRows, $fRows, $invRows, $rxRows, $rxiRows);

        // 5 audit rows per patient per year (entity=patient), spread over the window.
        for ($i = 0; $i < $nPatients; $i++) {
            for ($y = 0; $y < $years; $y++) {
                for ($k = 0; $k < $appy; $k++) {
                    $at = $startDay->addYears($y)->addDays(($i + $k * 37) % 360)->utc()->format('Y-m-d H:i:s');
                    $this->queueAudit($tenantId, $actorId, $branchId, 'baca', 'patient', $patientIds[$i], $at);
                }
            }
        }
        $this->flushAudit();

        return [
            'id' => $tenantId,
            'tag' => $tag,
            'branch_id' => $branchId,
            'chair_ids' => $chairIds,
            'users' => $users,
            'password' => DatabaseSeeder::PASSWORD,
            'totp_secret' => DatabaseSeeder::TOTP_SECRET,
            'patients' => $nPatients,
            'visits_seeded' => $nAssign,
            'heavy_patient_id' => $patientIds[0],
            'heavy_patient_visits' => $visitOf[0] ?? 0,
            'typical_patient_id' => $patientIds[min(100, $nPatients - 1)],
            'typical_patient_visits' => $visitOf[min(100, $nPatients - 1)] ?? 0,
            'search_name' => 'sari',
            'search_name_exact_prefix' => 'sari rahmawati',
            'search_nik' => $niks[0],
            'search_phone' => $phones[0],
            'open_today_appointment_ids' => array_column($openToday, 'id'),
            'open_future_appointment_ids' => array_column($openFuture, 'id'),
            'draft_visits' => $draftInfo,
            'today' => $today->toDateString(),
        ];
    }

    /** @return list<string> */
    private function patientCols(): array
    {
        return ['tenant_id', 'id', 'home_branch_id', 'name', 'name_normalized', 'dob', 'sex', 'nik_enc', 'nik_bidx', 'phone_enc', 'phone_bidx', 'address_enc', 'payer_type', 'payer_name', 'payer_member_no', 'payer_class', 'status', 'created_by', 'created_at', 'updated_at'];
    }

    /** @return array{0: CarbonImmutable, 1: int}|null */
    private function slotAt(int $ptr, int $nChairs, int $slotsPerDay, array $workdays): ?array
    {
        $perDay = $nChairs * $slotsPerDay;
        $day = intdiv($ptr, $perDay);
        if ($day >= count($workdays)) {
            return null;
        }
        $in = $ptr % $perDay;
        $chair = $in % $nChairs;
        $slot = intdiv($in, $nChairs);
        $starts = $workdays[$day]->addMinutes(8 * 60 + $slot * 30);

        return [$starts, $chair];
    }

    private function putAppointment(string $tenantId, string $branchId, string $chairId, string $dentistId, string $patientId, string $actorId, CarbonImmutable $starts, string $status, bool $flush): array
    {
        $id = $this->id();
        $st = $starts->utc()->format('Y-m-d H:i:s');
        $en = $starts->addMinutes(30)->utc()->format('Y-m-d H:i:s');
        $now = $st;
        $this->row('appointment', ['tenant_id', 'id', 'branch_id', 'chair_id', 'dentist_id', 'patient_id', 'starts_at', 'ends_at', 'status', 'reason', 'created_by', 'created_at', 'updated_at', 'arrived_at', 'seated_at', 'dismissed_at'],
            [$tenantId, $id, $branchId, $chairId, $dentistId, $patientId, $st, $en, $status, 'Janji sintetis', $actorId, $now, $now, null, null, null]);

        return ['id' => $id, 'patient_id' => $patientId, 'starts_at' => $st];
    }

    private function flushClinical(array $a, array $v, array $n, array $nv, array $f, array $inv, array $rx, array $rxi): void
    {
        if ($a) {
            $this->rows('appointment', ['tenant_id', 'id', 'branch_id', 'chair_id', 'dentist_id', 'patient_id', 'starts_at', 'ends_at', 'status', 'reason', 'created_by', 'created_at', 'updated_at', 'arrived_at', 'seated_at', 'dismissed_at'], $a);
        }
        if ($v) {
            $this->rows('visit', ['tenant_id', 'id', 'patient_id', 'branch_id', 'dentist_id', 'appointment_id', 'started_at', 'ended_at', 'status', 'created_by', 'created_at', 'updated_at'], $v);
        }
        if ($n) {
            $this->rows('clinical_note', ['tenant_id', 'id', 'visit_id', 'patient_id', 'author_id', 'first_input_at', 'created_at', 'updated_at'], $n);
        }
        if ($nv) {
            $this->rows('clinical_note_version', ['tenant_id', 'id', 'note_id', 'version', 'revision', 'supersedes_id', 'soap_enc', 'content_hash', 'reason', 'state', 'source', 'signed_by', 'signed_at', 'created_by', 'created_at', 'updated_at'], $nv);
        }
        if ($f) {
            $this->rows('tooth_finding', ['tenant_id', 'id', 'patient_id', 'visit_id', 'tooth', 'surface', 'condition', 'status', 'procedure_code', 'variant', 'state', 'source', 'supersedes_id', 'created_by', 'finalized_by', 'finalized_at', 'created_at', 'updated_at'], $f);
        }
        if ($inv) {
            $this->rows('invoice', ['tenant_id', 'id', 'visit_id', 'patient_id', 'payer_patient_id', 'branch_id', 'status', 'created_by', 'created_at', 'updated_at'], $inv);
        }
        if ($rx) {
            $this->rows('prescription', ['tenant_id', 'id', 'number', 'patient_id', 'visit_id', 'branch_id', 'dentist_id', 'state', 'supersedes_id', 'content_hash', 'signed_at', 'created_by', 'created_at', 'updated_at'], $rx);
        }
        if ($rxi) {
            $this->rows('prescription_item', ['tenant_id', 'id', 'prescription_id', 'kfa_code', 'dosage_enc', 'created_at', 'updated_at'], $rxi);
        }
    }

    private function queueAudit(string $tenantId, string $actorId, string $branchId, string $action, string $etype, string $eid, string $at): void
    {
        // Pre-render tuples; flush in batches of 2000.
        $id = $this->id();
        $this->auditBuf[] = $tenantId;
        $this->auditBuf[] = $id;
        $this->auditBuf[] = $at;
        $this->auditBuf[] = 'user';
        $this->auditBuf[] = $actorId;
        $this->auditBuf[] = $action;
        $this->auditBuf[] = $etype;
        $this->auditBuf[] = $eid;
        $this->auditBuf[] = $branchId;
        $this->auditBuf[] = '127.0.0.1';
        $this->auditBuf[] = 'BittodentBench/1.0';
        $this->auditBuf[] = '{"synthetic":true}';
        $this->auditBufN++;
        if ($this->auditBufN >= 2000) {
            $this->flushAudit();
        }
    }

    private function flushAudit(): void
    {
        if ($this->auditBufN === 0) {
            return;
        }
        $cols = ['tenant_id', 'id', 'occurred_at', 'actor_type', 'actor_id', 'action', 'entity_type', 'entity_id', 'branch_id', 'ip', 'user_agent', 'detail'];
        $ph = '('.implode(',', array_fill(0, count($cols), '?')).')';
        $sql = 'INSERT INTO `audit_event` (`'.implode('`,`', $cols).'`) VALUES '.implode(',', array_fill(0, $this->auditBufN, $ph));
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($this->auditBuf);
        $this->auditWritten += $this->auditBufN;
        $this->auditBuf = [];
        $this->auditBufN = 0;
    }

    private function row(string $table, array $cols, array $vals): void
    {
        $this->rows($table, $cols, [$vals]);
    }

    private function rows(string $table, array $cols, array $rows): void
    {
        if (! $rows) {
            return;
        }
        $ph = '('.implode(',', array_fill(0, count($cols), '?')).')';
        $sql = 'INSERT INTO `'.$table.'` (`'.implode('`,`', $cols).'`) VALUES '.implode(',', array_fill(0, count($rows), $ph));
        $bind = [];
        foreach ($rows as $r) {
            foreach ($r as $v) {
                $bind[] = $v;
            }
        }
        $this->pdo->prepare($sql)->execute($bind);
    }

    private function id(): string
    {
        return (string) Str::uuid7();
    }
}
