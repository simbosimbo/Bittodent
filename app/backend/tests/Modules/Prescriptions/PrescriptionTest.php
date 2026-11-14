<?php

namespace Tests\Modules\Prescriptions;

use App\Modules\Clinical\Models\Visit;
use App\Modules\Prescriptions\Models\Prescription;
use App\Modules\Prescriptions\Models\PrescriptionItem;
use App\Modules\Prescriptions\Models\PrescriptionVoid;
use App\Shared\Tenancy\Ctx;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PrescriptionTest extends TestCase
{
    public static function models(): array
    {
        return ['Prescription' => [Prescription::class], 'PrescriptionItem' => [PrescriptionItem::class], 'PrescriptionVoid' => [PrescriptionVoid::class]];
    }

    #[DataProvider('models')]
    public function test_tenant_b_rows_are_invisible(string $model): void
    {
        $bIds = Ctx::runAs($this->tenantB()->id, fn () => $model::pluck('id')->all());
        $this->assertNotEmpty($bIds);
        Ctx::runAs($this->tenantA()->id, function () use ($model, $bIds) {
            $this->assertSame([$this->tenantA()->id], $model::pluck('tenant_id')->unique()->values()->all());
            $this->assertSame(0, $model::whereIn('id', $bIds)->count());
        });
    }

    public function test_draft_is_editable_signed_is_immutable_for_ehr_app(): void
    {
        Ctx::runAs($this->tenantA()->id, function () {
            $v = Visit::orderBy('created_at')->firstOrFail();
            $p = Prescription::create(['number' => 'R-UJI-1', 'patient_id' => $v->patient_id, 'visit_id' => $v->id, 'branch_id' => $v->branch_id,
                'dentist_id' => $v->dentist_id, 'created_by' => $v->dentist_id]);
            $item = (new PrescriptionItem(['prescription_id' => $p->id, 'kfa_code' => 'KFA-CONTOH-02']))
                ->setDosage(['dose' => '1 tablet', 'route' => 'oral', 'frequency' => '2x sehari', 'duration_days' => 3]);
            $item->save();
            $item->update(['kfa_code' => 'KFA-CONTOH-03']); // draft: allowed
            $p->update(['state' => 'signed', 'signed_at' => now()]);
            $this->assertSame(3, $item->fresh()->dosage()['duration_days']);

            foreach ([fn () => $p->update(['number' => 'R-UJI-2']), fn () => $item->update(['kfa_code' => 'KFA-CONTOH-04']),
                fn () => (new PrescriptionItem(['prescription_id' => $p->id, 'kfa_code' => 'X', 'dosage_enc' => 'x']))->save()] as $op) {
                try {
                    DB::transaction($op); // savepoint: keeps the test transaction usable after the trigger error
                    $this->fail('not rejected');
                } catch (QueryException $e) {
                    $this->assertSame('45000', $e->errorInfo[0]);
                }
            }
        });
    }

    public function test_dosage_fields_are_required(): void
    {
        $this->expectException(InvalidArgumentException::class);
        (new PrescriptionItem)->setDosage(['dose' => '500 mg', 'route' => 'oral', 'frequency' => '3x sehari']);
    }

    public function test_signed_rows_reject_update_and_delete_even_for_admin(): void
    {
        config(['database.connections.mysql_admin_probe' => config('database.connections.mysql_admin')]);
        $admin = DB::connection('mysql_admin_probe'); // committed seed rows, autocommit connection
        $rx = $admin->table('prescription')->where('state', 'signed')->value('id');
        $item = $admin->table('prescription_item')->where('prescription_id', $rx)->value('id');
        $void = $admin->table('prescription_void')->value('id');
        $sql = ['UPDATE prescription SET number = number WHERE id = ?' => $rx, 'DELETE FROM prescription WHERE id = ?' => $rx,
            'UPDATE prescription_item SET kfa_code = kfa_code WHERE id = ?' => $item, 'DELETE FROM prescription_item WHERE id = ?' => $item,
            'UPDATE prescription_void SET created_at = created_at WHERE id = ?' => $void, 'DELETE FROM prescription_void WHERE id = ?' => $void];
        foreach ($sql as $q => $id) {
            $this->assertNotNull($id, $q);
            try {
                $admin->affectingStatement($q, [$id]);
                $this->fail("Not rejected: $q");
            } catch (QueryException $e) {
                $this->assertSame('45000', $e->errorInfo[0], $q);
            }
        }
    }
}
