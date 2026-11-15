<?php

namespace Tests\Modules\Clinical;

use App\Modules\Clinical\Domain\OdontogramTaxonomy;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\Visit;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Tests\TestCase;

// POST /api/visits/{id}/tooth-entries: odontogram v2 entry (board 09). One draft procedure per Simpan; dentist only; taxonomy-driven.
class ToothEntryTest extends TestCase
{
    private const DOC = 'dokter@senyum.test';

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    private function visit(): Visit
    {
        return $this->inA(fn () => Visit::whereNotNull('appointment_id')->where('patient_id', $this->patientOf($this->tenantA())->id)->firstOrFail());
    }

    public function test_taxonomy_is_one_data_table_with_official_lowercase_codes(): void
    {
        $c = OdontogramTaxonomy::conditions();
        foreach ($c as $row) {
            $this->assertTrue($row['code'] === null || $row['code'] === strtolower($row['code']), $row['key']);
        }
        $this->assertSame('ipx', $c['implan']['code']);
        $this->assertSame('B', OdontogramTaxonomy::storedSurface('V'));
        $this->assertSame('direncanakan', OdontogramTaxonomy::procedureStatus('rencana'));
        $this->assertContains(55, OdontogramTaxonomy::teeth());
        $this->assertSame(['meb', 'pob'], OdontogramTaxonomy::materials());
        // the frontend copy is generated from the same file (npm run taxonomy)
        $front = base_path('../frontend/src/modules/clinical/odontogram/taxonomy.json');
        if (is_file($front)) {
            $this->assertSame(OdontogramTaxonomy::table(), json_decode((string) file_get_contents($front), true));
        }
    }

    public function test_dentist_saves_a_surface_entry_as_one_draft_procedure_with_v_stored_as_b_and_audit(): void
    {
        $v = $this->visit();
        $res = $this->as(self::DOC)->postJson("/api/visits/{$v->id}/tooth-entries", ['tooth' => 46, 'surfaces' => ['M', 'O', 'V'],
            'condition' => 'karies', 'status' => 'selesai', 'procedure_code' => '23.2'])->assertCreated()
            ->assertJsonPath('status', 'selesai')->assertJsonPath('surfaces', 'MOB')->assertJsonPath('condition', 'karies')
            ->assertJsonPath('state', 'draft')->assertJsonPath('procedure_code', '23.2');
        $id = $res->json('id');
        $this->assertTrue($this->inA(fn () => AuditEvent::where('entity_id', $id)->where('action', 'buat')->exists()));
        // a condition without a procedure code is recorded per surface/tooth (treat area from the taxonomy group)
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/tooth-entries", ['tooth' => 18, 'condition' => 'hilang', 'status' => 'ada_sebelumnya'])
            ->assertCreated()->assertJsonPath('treat_area', 'tooth')->assertJsonPath('status', 'ada_di_klinik_ini');
        // primary teeth are valid input
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/tooth-entries", ['tooth' => 55, 'surfaces' => ['O'], 'condition' => 'karies', 'status' => 'rencana'])
            ->assertCreated()->assertJsonPath('tooth', 55);
    }

    public function test_bridge_span_with_roles_and_material(): void
    {
        $v = $this->visit();
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/tooth-entries", ['tooth' => 34, 'span_to' => 36, 'condition' => 'bridge',
            'status' => 'rencana', 'span_roles' => ['34' => 'abutment', '35' => 'pontic', '36' => 'abutment'], 'material' => 'pob'])
            ->assertCreated()->assertJsonPath('tooth_range', '34-36')->assertJsonPath('material', 'pob')->assertJsonPath('span_roles.35', 'pontic');
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/tooth-entries", ['tooth' => 34, 'condition' => 'bridge', 'status' => 'rencana'])
            ->assertUnprocessable()->assertJsonValidationErrors('span_to');
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/tooth-entries", ['tooth' => 14, 'span_to' => 44, 'condition' => 'bridge', 'status' => 'rencana'])
            ->assertUnprocessable()->assertJsonValidationErrors('span_to'); // across jaws
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/tooth-entries", ['tooth' => 34, 'span_to' => 36, 'condition' => 'karies', 'status' => 'rencana'])
            ->assertUnprocessable();
    }

    public function test_validation_from_the_taxonomy(): void
    {
        $v = $this->visit();
        $post = fn (array $b) => $this->as(self::DOC)->postJson("/api/visits/{$v->id}/tooth-entries", $b + ['tooth' => 46, 'condition' => 'karies', 'status' => 'rencana', 'surfaces' => ['O']]);
        $post(['tooth' => 19])->assertUnprocessable()->assertJsonValidationErrors('tooth');
        $post(['condition' => 'kacau'])->assertUnprocessable()->assertJsonValidationErrors('condition');
        $post(['status' => 'direncanakan'])->assertUnprocessable()->assertJsonValidationErrors('status'); // v2 keys only
        $post(['surfaces' => ['B']])->assertUnprocessable()->assertJsonValidationErrors('surfaces.0'); // official letter is V
    }

    public function test_dentist_only_and_tenant_scoped(): void
    {
        $v = $this->visit();
        $body = ['tooth' => 46, 'surfaces' => ['O'], 'condition' => 'karies', 'status' => 'rencana'];
        foreach (['asisten@senyum.test', 'depan@senyum.test', 'kasir@senyum.test', 'pemilik@senyum.test'] as $who) {
            $this->as($who)->postJson("/api/visits/{$v->id}/tooth-entries", $body)->assertForbidden();
        }
        $this->as('dokter@ceria.test')->postJson("/api/visits/{$v->id}/tooth-entries", $body)->assertNotFound();
        $this->assertSame(0, $this->inA(fn () => ProcedureRecord::where('visit_id', $v->id)->whereNotNull('condition')->count()));
    }
}
