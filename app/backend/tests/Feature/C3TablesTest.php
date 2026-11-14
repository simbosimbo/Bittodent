<?php

namespace Tests\Feature;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceAdjustment;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Billing\Models\Payment;
use App\Modules\Clinical\Models\ConsentRecord;
use App\Modules\Clinical\Models\ToothBaseline;
use App\Modules\Patients\Models\Guardian;
use App\Modules\Patients\Models\Household;
use App\Modules\Patients\Models\MedicalHistoryVersion;
use App\Modules\Recall\Models\ReminderLog;
use App\Modules\Scheduling\Models\PlannedAppointment;
use App\Modules\Tariffs\Models\Tariff;
use App\Shared\Tenancy\Ctx;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

// UNIT C3 tables: tenant isolation for every new table + DB-enforced append-only rules.
class C3TablesTest extends TestCase
{
    public const MODELS = [ToothBaseline::class, ConsentRecord::class, Household::class, Guardian::class, MedicalHistoryVersion::class,
        PlannedAppointment::class, ReminderLog::class, Tariff::class, Invoice::class, InvoiceLine::class, InvoiceAdjustment::class,
        Payment::class];

    public const APPEND_ONLY = ['tooth_baseline', 'consent_record', 'medical_history_version', 'reminder_log', 'invoice_line', 'invoice_adjustment', 'payment'];

    public static function models(): array
    {
        return array_combine(array_map('class_basename', self::MODELS), array_map(fn ($m) => [$m], self::MODELS));
    }

    #[DataProvider('models')]
    public function test_tenant_b_rows_are_invisible(string $model): void
    {
        $bIds = Ctx::runAs($this->tenantB()->id, fn () => $model::pluck('id')->all());
        $this->assertNotEmpty($bIds, "seed has tenant B rows for $model");
        Ctx::runAs($this->tenantA()->id, function () use ($model, $bIds) {
            $rows = $model::all();
            $this->assertNotEmpty($rows);
            $this->assertSame([$this->tenantA()->id], $rows->pluck('tenant_id')->unique()->values()->all());
            $this->assertSame(0, $model::whereIn('id', $bIds)->count());
        });
    }

    public function test_api_returns_404_for_tenant_b_records(): void
    {
        $b = $this->patientOf($this->tenantB())->id;
        $r = $this->as('dokter@senyum.test');
        foreach (['alerts', 'medical-history', 'family', 'baseline'] as $path) {
            $r->getJson("/api/patients/$b/$path")->assertNotFound();
        }
        $r->putJson("/api/patients/$b/medical-history", ['base_version' => 2, 'medications' => [], 'problems' => [], 'allergies' => [],
            'urgent_note' => null, 'premedication_required' => false])->assertNotFound();
        $r->postJson("/api/patients/$b/planned-appointments", ['procedure' => 'x', 'est_minutes' => 30])->assertNotFound();
        [$inv, $plan] = Ctx::runAs($this->tenantB()->id, fn () => [Invoice::firstOrFail()->id, PlannedAppointment::firstOrFail()->id]);
        $this->as('depan@senyum.test')->getJson("/api/invoices/$inv")->assertNotFound();
        $this->as('depan@senyum.test')->postJson("/api/invoices/$inv/adjustments", ['kind' => 'discount', 'amount_rp' => 1, 'reason' => 'lintas tenant'])->assertNotFound();
        $this->as('depan@senyum.test')->postJson("/api/planned-appointments/$plan/schedule", ['chair_id' => $plan, 'starts_at' => '2030-01-01T02:00:00Z'])->assertNotFound();
        // guarantor / household from another tenant cannot be linked
        $a = $this->patientOf($this->tenantA())->id;
        $this->as('depan@senyum.test')->putJson("/api/patients/$a/family", ['guarantor_id' => $b])->assertNotFound();
    }

    public static function appendOnly(): array
    {
        return array_combine(self::APPEND_ONLY, array_map(fn ($t) => [$t], self::APPEND_ONLY));
    }

    #[DataProvider('appendOnly')]
    public function test_append_only_tables_reject_update_and_delete_even_for_admin(string $table): void
    {
        config(['database.connections.mysql_admin_probe' => config('database.connections.mysql_admin')]);
        $admin = DB::connection('mysql_admin_probe'); // committed seed rows, separate autocommit connection
        $id = $admin->table($table)->value('id');
        $this->assertNotNull($id);
        foreach (["UPDATE $table SET created_at = created_at WHERE id = ?", "DELETE FROM $table WHERE id = ?"] as $sql) {
            try {
                $admin->affectingStatement($sql, [$id]);
                $this->fail("Not rejected: $sql");
            } catch (QueryException $e) {
                $this->assertSame('45000', $e->errorInfo[0]);
            }
        }
        // and ehr_app has no UPDATE grant at all
        $grants = implode("\n", array_map(fn ($r) => array_values((array) $r)[0], DB::select('SHOW GRANTS')));
        $this->assertMatchesRegularExpression("/GRANT SELECT, INSERT ON `[^`]+`\\.`$table`/", $grants);
    }
}
