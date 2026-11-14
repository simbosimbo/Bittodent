<?php

namespace Tests\Modules\Patients;

use App\Modules\Patients\Domain\CareFacts;
use App\Modules\Patients\Domain\CareStatus;
use Carbon\CarbonImmutable;
use PHPUnit\Framework\TestCase;

class CareStatusTest extends TestCase
{
    private function of(array $f, string $now = '2026-11-14 03:00:00'): string
    {
        return CareStatus::of(new CareFacts(...$f), CarbonImmutable::parse($now, 'UTC'));
    }

    public function test_rule_1_inactive_admin_status_wins(): void
    {
        foreach (['tidak_aktif', 'meninggal', 'diarsip'] as $s) {
            $this->assertSame('tidak_aktif', $this->of(['adminStatus' => $s, 'hasOpenVisit' => true, 'hasUnscheduledPlan' => true]));
        }
    }

    public function test_rule_2_in_treatment(): void
    {
        $this->assertSame('dalam_perawatan', $this->of(['hasOpenVisit' => true]));
        $this->assertSame('dalam_perawatan', $this->of(['hasUnfinishedProcedure' => true]));
        // today in Asia/Jakarta started 2026-11-13 17:00 UTC: an appointment earlier today still counts, yesterday does not
        $this->assertSame('dalam_perawatan', $this->of(['nextAppointmentAt' => CarbonImmutable::parse('2026-11-13 17:00', 'UTC')]));
        $this->assertSame('tidak_aktif', $this->of(['nextAppointmentAt' => CarbonImmutable::parse('2026-11-13 16:59', 'UTC')]));
        $this->assertSame('dalam_perawatan', $this->of(['hasOpenVisit' => true, 'hasUnscheduledPlan' => true])); // rule 2 before 3
    }

    public function test_rule_3_needs_control(): void
    {
        $this->assertSame('perlu_kontrol', $this->of(['hasUnscheduledPlan' => true]));
        $this->assertSame('perlu_kontrol', $this->of(['lastVisitAt' => CarbonImmutable::parse('2026-10-14 02:00', 'UTC')])); // 31 days
        $this->assertSame('perlu_kontrol', $this->of(['lastVisitAt' => CarbonImmutable::parse('2025-11-14 03:00', 'UTC')])); // exactly 12 months
    }

    public function test_rule_4_otherwise_inactive(): void
    {
        $this->assertSame('tidak_aktif', $this->of([])); // never visited
        $this->assertSame('tidak_aktif', $this->of(['lastVisitAt' => CarbonImmutable::parse('2026-11-04', 'UTC')])); // < 30 days, nothing open
        $this->assertSame('tidak_aktif', $this->of(['lastVisitAt' => CarbonImmutable::parse('2025-11-14 02:59', 'UTC')])); // > 12 months
    }
}
