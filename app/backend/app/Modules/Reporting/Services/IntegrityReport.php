<?php

namespace App\Modules\Reporting\Services;

use App\Modules\Billing\Contracts\IntegrityFacts as BillingFacts;
use App\Modules\Clinical\Contracts\IntegrityFacts as ClinicalFacts;
use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Modules\Scheduling\Contracts\AppointmentDirectory;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use Carbon\CarbonImmutable;

// Owner integrity report (unit 6, DEVIATIONS #52). Read only, assembled from other modules' Contracts (never their Models).
// Who is "the dentist" of a row: clinical work (external, tanpa tagihan) = procedure provider_id; Rp0 tariff lines = invoice_line.doctor_id;
// invoice-level adjustments (discount, write-off, Rp0) = visit dentist (an adjustment has no line); batal = appointment/visit dentist.
// Correction metrics (unit D, DEVIATIONS #58): clinical correction = provider_id of the corrected (original) row; credit note / refund =
// invoice_line.doctor_id of the credited line (fallback visit dentist); void = visit dentist. Each correction kind stays its own column:
// a credit note or void is never a "Rp0" (rp0 = approved 100% discount only; Rp0 tariff lines = tariff_zero, "anomali tarif").
final class IntegrityReport
{
    /** Alert: "perlu tinjau koreksi" still open after this many days. */
    public const REVIEW_STALE_DAYS = 2;

    private const ZERO_DENTIST = ['external' => 0, 'external_pending' => 0, 'external_rejected' => 0, 'rp0' => 0, 'rp0_pending' => 0,
        'full_discount_rp' => 0, 'discounts' => 0, 'discount_total_rp' => 0, 'full_discounts' => 0, 'self_approved' => 0,
        'tariff_zero' => 0, 'tariff_zero_pending' => 0, 'unbilled_visits' => 0, 'batal' => 0, 'closed_without_invoice' => 0,
        'corr_salah_kode' => 0, 'corr_salah_situs' => 0, 'corr_salah_provider' => 0, 'corr_tidak_dikerjakan' => 0, 'corr_total_rp' => 0,
        'corr_pending' => 0, 'corr_rejected' => 0, 'corr_outside_window' => 0, 'corr_owner_approved' => 0, 'corr_self_approved' => 0,
        'cn_partial' => 0, 'cn_partial_rp' => 0, 'cn_full' => 0, 'cn_full_rp' => 0, 'cn_pending' => 0, 'cn_pending_rp' => 0, 'cn_approved' => 0,
        'refunds' => 0, 'refund_rp' => 0, 'refund_pending' => 0, 'refund_pending_rp' => 0,
        'voids' => 0, 'void_rp' => 0, 'void_pending' => 0, 'void_pending_rp' => 0, 'reversal_self_approved' => 0];

    public function __construct(private ClinicalFacts $clinical, private BillingFacts $billing, private AppointmentDirectory $appointments,
        private UserDirectory $users, private PatientDirectory $patients, private TenancyDirectory $tenancy) {}

    /** @return array{dentists: list<array>, totals: array, average: array, alerts: list<array>} */
    public function build(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array
    {
        $rows = [];
        $alerts = [];
        $add = function (?string $dentist, string $key, int $n = 1) use (&$rows) {
            $dentist ??= '-';
            $rows[$dentist] ??= self::ZERO_DENTIST;
            $rows[$dentist][$key] += $n;
        };
        foreach ($this->tenancy->activeUserIdsWithRole('dentist') as $id) {
            $rows[$id] = self::ZERO_DENTIST;
        }

        // Tindakan luar. pending/confirmed = recorded on a day that already had `selesai` work ("Luar setelah datang").
        foreach ($this->clinical->externals($from, $to, $branchIds) as $e) {
            $add($e['provider_id'], match ($e['confirmation']) {
                'pending' => 'external_pending', 'rejected' => 'external_rejected', default => 'external'
            });
            if (in_array($e['confirmation'], ['pending', 'confirmed'], true)) {
                $alerts[] = self::alert('luar_setelah_datang', $e['recorded_at'], $e['provider_id'], $e['patient_id'], $e['visit_id'], $e['id'],
                    ['procedure_code' => $e['procedure_code'], 'tooth' => $e['tooth'], 'confirmation' => $e['confirmation']]);
            }
        }

        // Tanpa tagihan: completed work without an invoice line. Visits closed without invoice (cancelled attendance) are batal, not here.
        $visits = $this->clinical->visitsWithCompletedWork($from, $to, $branchIds);
        $billed = array_flip($this->billing->billedProcedureIds(array_merge(...array_map(fn ($v) => array_column($v['procedures'], 'id'), $visits ?: [['procedures' => []]]))));
        foreach ($visits as $v) {
            $unbilled = array_values(array_filter($v['procedures'], fn ($p) => ! isset($billed[$p['id']])));
            if ($unbilled === [] || $v['closed_without_invoice']) {
                continue;
            }
            foreach (array_unique(array_column($unbilled, 'provider_id')) as $provider) {
                $add($provider, 'unbilled_visits');
            }
            $alerts[] = self::alert('tanpa_tagihan', $v['started_at'], $unbilled[0]['provider_id'], $v['patient_id'], $v['visit_id'], $v['visit_id'],
                ['visit_status' => $v['status'], 'procedures' => array_map(fn ($p) => ['procedure_code' => $p['procedure_code'], 'tooth' => $p['tooth']], $unbilled)]);
        }

        // Diskon / hapus / Rp0 (invoice level => visit dentist).
        $adjustments = $this->billing->adjustments($from, $to, $branchIds);
        $zeroLines = $this->billing->zeroPriceLines($from, $to, $branchIds);
        $dentistOf = $this->clinical->dentistsOfVisits(array_values(array_unique([...array_column($adjustments, 'visit_id'), ...array_column($zeroLines, 'visit_id')])));
        foreach ($adjustments as $a) {
            $dentist = $dentistOf[$a['visit_id']] ?? null;
            if (in_array($a['status'], ['applied', 'approved'], true)) {
                $add($dentist, 'discounts');
                $add($dentist, 'discount_total_rp', $a['amount_rp']);
            }
            if ($a['zero']) {
                $add($dentist, 'full_discounts'); // 100% asked, whatever the decision
                $add($dentist, 'rp0', (int) ($a['status'] === 'approved'));
                $add($dentist, 'full_discount_rp', $a['status'] === 'approved' ? $a['amount_rp'] : 0);
                $add($dentist, 'rp0_pending', (int) ($a['status'] === 'pending'));
            }
            if ($a['status'] === 'pending') {
                $alerts[] = self::alert('rp0_menunggu', $a['created_at'], $dentist, $a['patient_id'], $a['visit_id'], $a['id'],
                    ['invoice_id' => $a['invoice_id'], 'kind' => $a['kind'], 'amount_rp' => $a['amount_rp']]);
            }
            if ($a['self_approved_sole_owner']) {
                $add($dentist, 'self_approved');
                $alerts[] = self::alert('disetujui_sendiri', $a['decided_at'], $dentist, $a['patient_id'], $a['visit_id'], $a['id'],
                    ['invoice_id' => $a['invoice_id'], 'kind' => $a['kind'], 'amount_rp' => $a['amount_rp']]);
            }
        }
        // Anomali tarif: lines priced Rp0 by the tariff master. Not a discount, not a correction.
        foreach ($zeroLines as $l) {
            $dentist = $l['doctor_id'] ?? $dentistOf[$l['visit_id']] ?? null;
            $add($dentist, 'tariff_zero');
            if ($l['tariff_status'] === 'pending') {
                $add($dentist, 'tariff_zero_pending');
                $alerts[] = self::alert('tarif_nol', $l['created_at'], $dentist, $l['patient_id'], $l['visit_id'], $l['id'],
                    ['invoice_id' => $l['invoice_id'], 'procedure_code' => $l['procedure_code']]);
            }
        }

        $this->corrections($from, $to, $branchIds, $add, $alerts);

        // Batal: cancelled / no-show appointments + walk-in "batalkan kehadiran"; visits closed without invoice listed as exceptions.
        foreach ($this->appointments->cancelledStartingBetween($from, $to, $branchIds) as $ap) {
            $add($ap['dentist_id'], 'batal');
        }
        foreach ($this->clinical->cancelledVisits($from, $to, $branchIds) as $v) {
            if ($v['appointment_id'] === null && $v['attendance_cancelled_at'] !== null && $v['attendance_cancelled_at'] >= self::z($from)
                && $v['attendance_cancelled_at'] < self::z($to)) {
                $add($v['dentist_id'], 'batal'); // appointment visits are already counted through the appointment status
            }
            if ($v['closed_without_invoice'] && $v['ended_at'] >= self::z($from) && $v['ended_at'] < self::z($to)) {
                $add($v['dentist_id'], 'closed_without_invoice');
                $alerts[] = self::alert('batal_tanpa_tagihan', $v['ended_at'], $v['dentist_id'], $v['patient_id'], $v['visit_id'], $v['visit_id'],
                    ['close_reason' => $v['close_reason'], 'walk_in' => $v['appointment_id'] === null]);
            }
        }

        return $this->present($rows, $alerts);
    }

    /** Unit D: clinical corrections, credit notes, voids, refunds, "perlu tinjau" flags. Counts = in force; pending kept apart. */
    private function corrections(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds, callable $add, array &$alerts): void
    {
        $corr = $this->clinical->procedureCorrections($from, $to, $branchIds);
        $prices = $this->billing->linePricesByProcedure(array_values(array_unique(array_merge(...array_column($corr, 'chain_procedure_ids') ?: [[]]))));
        foreach ($corr as $c) {
            $d = $c['provider_id'];
            $add($d, 'corr_outside_window', (int) ! $c['within_window']);
            match ($c['status']) {
                'pending' => $add($d, 'corr_pending'),
                'ditolak' => $add($d, 'corr_rejected'),
                default => null,
            };
            if (in_array($c['status'], ['diterapkan', 'disetujui'], true)) {
                $add($d, 'corr_'.$c['reason_type']);
                $add($d, 'corr_total_rp', array_sum(array_intersect_key($prices, array_flip($c['chain_procedure_ids']))));
                $add($d, 'corr_owner_approved', (int) ($c['status'] === 'disetujui'));
                $add($d, 'corr_self_approved', (int) $c['self_approved_sole_owner']);
            }
            if ($c['status'] === 'pending') {
                $alerts[] = self::alert('koreksi_menunggu', $c['created_at'], $d, $c['patient_id'], $c['visit_id'], $c['id'],
                    ['reason_type' => $c['reason_type'], 'procedure_id' => $c['procedure_id']]);
            }
        }

        $rev = $this->billing->reversals($from, $to, $branchIds);
        $flags = $this->billing->lineCorrections($from, $to, $branchIds);
        $dentistOf = $this->clinical->dentistsOfVisits(array_values(array_unique(array_column([...array_merge(...array_values($rev)), ...$flags], 'visit_id'))));
        foreach (array_merge(...array_values($rev)) as $r) {
            $d = $r['doctor_id'] ?? $dentistOf[$r['visit_id']] ?? null;
            $live = in_array($r['status'], ['applied', 'approved'], true);
            $pending = $r['status'] === 'pending';
            [$n, $rp, $pn, $prp] = match ($r['kind']) {
                'nota_kredit' => [$r['is_full'] ? 'cn_full' : 'cn_partial', ($r['is_full'] ? 'cn_full' : 'cn_partial').'_rp', 'cn_pending', 'cn_pending_rp'],
                'void' => ['voids', 'void_rp', 'void_pending', 'void_pending_rp'],
                'refund' => ['refunds', 'refund_rp', 'refund_pending', 'refund_pending_rp'],
            };
            $add($d, $n, (int) $live);
            $add($d, $rp, $live ? $r['amount_rp'] : 0);
            $add($d, $pn, (int) $pending);
            $add($d, $prp, $pending ? $r['amount_rp'] : 0);
            $add($d, 'cn_approved', (int) ($r['kind'] === 'nota_kredit' && $r['status'] === 'approved'));
            $detail = ['type' => $r['kind'], 'invoice_id' => $r['invoice_id'], 'amount_rp' => $r['amount_rp'], 'number' => $r['number']];
            if ($pending) {
                $alerts[] = self::alert('pembalikan_menunggu', $r['created_at'], $d, $r['patient_id'], $r['visit_id'], $r['id'], $detail);
            }
            if ($r['self_approved_sole_owner']) {
                $add($d, 'reversal_self_approved');
                $alerts[] = self::alert('pembalikan_disetujui_sendiri', $r['decided_at'], $d, $r['patient_id'], $r['visit_id'], $r['id'], $detail);
            }
        }

        $stale = CarbonImmutable::now()->subDays(self::REVIEW_STALE_DAYS);
        foreach ($flags as $f) {
            if (! $f['handled'] && CarbonImmutable::parse($f['created_at'])->lt($stale)) {
                $alerts[] = self::alert('tinjau_koreksi_lama', $f['created_at'], $f['doctor_id'] ?? $dentistOf[$f['visit_id']] ?? null,
                    $f['patient_id'], $f['visit_id'], $f['id'], ['invoice_id' => $f['invoice_id'], 'reason_type' => $f['reason_type']]);
            }
        }
    }

    private function present(array $rows, array $alerts): array
    {
        $names = array_column($this->users->namesByIds(array_values(array_filter(array_keys($rows), fn ($k) => $k !== '-'))), 'name', 'id');
        $dentists = [];
        foreach ($rows as $id => $r) {
            $dentists[] = ['dentist_id' => $id === '-' ? null : $id, 'name' => $names[$id] ?? 'Tanpa dokter', ...$r];
        }
        usort($dentists, fn ($a, $b) => strcmp($a['name'], $b['name']));
        $totals = array_map(fn ($k) => array_sum(array_column($dentists, $k)), array_combine(array_keys(self::ZERO_DENTIST), array_keys(self::ZERO_DENTIST)));
        $n = max(1, count(array_filter($dentists, fn ($d) => $d['dentist_id'] !== null)));

        $patients = array_column($this->patients->namesByIds(array_values(array_unique(array_filter(array_column($alerts, 'patient_id'))))), 'name', 'id');
        foreach ($alerts as &$a) {
            $a['dentist_name'] = $names[$a['dentist_id']] ?? null;
            $a['patient_name'] = $patients[$a['patient_id']] ?? null;
        }
        unset($a);
        usort($alerts, fn ($x, $y) => strcmp((string) $y['at'], (string) $x['at'])); // newest first (ISO UTC strings sort)

        return ['dentists' => $dentists, 'totals' => $totals, 'average' => array_map(fn ($v) => round($v / $n, 1), $totals), 'alerts' => $alerts];
    }

    private static function alert(string $kind, ?string $at, ?string $dentist, ?string $patient, ?string $visit, string $ref, array $detail): array
    {
        return ['kind' => $kind, 'at' => $at, 'dentist_id' => $dentist, 'patient_id' => $patient, 'visit_id' => $visit, 'ref_id' => $ref, 'detail' => $detail];
    }

    private static function z(\DateTimeInterface $t): string
    {
        return CarbonImmutable::instance($t)->utc()->toIso8601ZuluString();
    }
}
