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
        $this->assertSame(['acr', 'frm'], OdontogramTaxonomy::materials()); // protesa materials; meb/pob are span conditions
        $this->assertCount(31, $c); // 30 official conditions + sou (design/odontogram-kondisi.md)
        $this->assertSame(['cof', 'rct', 'pob'], [$c['tambalan_komposit']['code'], $c['psa']['code'], $c['jembatan_porselen']['code']]);
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
            'condition' => 'tambalan_komposit', 'status' => 'selesai'])->assertCreated() // code from the mapping, not typed
            ->assertJsonPath('status', 'selesai')->assertJsonPath('surfaces', 'MOB')->assertJsonPath('condition', 'tambalan_komposit')
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
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/tooth-entries", ['tooth' => 34, 'span_to' => 36, 'condition' => 'jembatan_porselen',
            'status' => 'rencana', 'span_roles' => ['34' => 'abutment', '35' => 'pontic', '36' => 'abutment']])
            ->assertCreated()->assertJsonPath('tooth_range', '34-36')->assertJsonPath('condition', 'jembatan_porselen')->assertJsonPath('span_roles.35', 'pontic');
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/tooth-entries", ['tooth' => 14, 'span_to' => 16, 'condition' => 'gts', 'status' => 'rencana', 'material' => 'acr'])
            ->assertCreated()->assertJsonPath('material', 'acr');
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/tooth-entries", ['tooth' => 34, 'condition' => 'jembatan_logam', 'status' => 'rencana'])
            ->assertUnprocessable()->assertJsonValidationErrors('span_to');
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/tooth-entries", ['tooth' => 14, 'span_to' => 44, 'condition' => 'jembatan_logam', 'status' => 'rencana'])
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

    public function test_tindakan_dulu_a_finished_entry_bills_the_code_mapped_to_its_condition(): void
    {
        $v = $this->visit();
        $post = fn (array $b) => $this->as(self::DOC)->postJson("/api/visits/{$v->id}/tooth-entries", $b + ['status' => 'selesai']);
        // one candidate: picked automatically (cof -> 23.2 in the starter mapping)
        $auto = $post(['tooth' => 26, 'surfaces' => ['O'], 'condition' => 'tambalan_komposit'])->assertCreated()->assertJsonPath('procedure_code', '23.2')
            ->assertJsonPath('diagnosis_source', 'aturan'); // ICD-10 from the clinic rule paired with 23.2 on this tooth group
        $this->assertMatchesRegularExpression('/^K02\\./', $auto->json('diagnosis_code'));
        $post(['tooth' => 27, 'surfaces' => ['O'], 'condition' => 'tambalan_komposit', 'diagnosis_code' => 'K02.9'])->assertCreated()
            ->assertJsonPath('diagnosis_code', 'K02.9')->assertJsonPath('diagnosis_source', 'manual'); // the dentist can override
        // several candidates (cabut: 23.01/23.09/23.11/23.19 record "mis"): the dentist picks one; a code outside the mapping is refused
        $pick = $post(['tooth' => 48, 'condition' => 'hilang'])->assertUnprocessable()->assertJsonPath('error', 'pick_code');
        $this->assertContains('23.09', collect($pick->json('candidates'))->pluck('procedure_code')->all());
        $post(['tooth' => 48, 'condition' => 'hilang', 'procedure_code' => '23.2'])->assertUnprocessable()->assertJsonValidationErrors('procedure_code');
        $post(['tooth' => 48, 'condition' => 'hilang', 'procedure_code' => '23.09'])->assertCreated()->assertJsonPath('procedure_code', '23.09');
        // not mapped yet (sealant fis): refused with a message for the owner; planned/existing entries need no code
        $post(['tooth' => 37, 'surfaces' => ['O'], 'condition' => 'sealant'])->assertUnprocessable()->assertJsonValidationErrors('condition');
        $post(['tooth' => 37, 'surfaces' => ['O'], 'condition' => 'sealant', 'status' => 'rencana'])->assertCreated();

        // the owner maps it in Pengaturan > Harga (dentist cannot); then it bills
        $this->as(self::DOC)->putJson('/api/procedure-catalog/23.2/conditions', ['conditions' => ['amf', 'cof', 'gif', 'fis']])->assertForbidden();
        $this->as('pemilik@senyum.test')->putJson('/api/procedure-catalog/23.2/conditions', ['conditions' => ['amf', 'xyz']])->assertUnprocessable();
        $this->as('pemilik@senyum.test')->putJson('/api/procedure-catalog/23.2/conditions', ['conditions' => ['amf', 'cof', 'gif', 'fis']])->assertOk()
            ->assertJsonPath('conditions.3', 'fis');
        $post(['tooth' => 47, 'surfaces' => ['O'], 'condition' => 'sealant'])->assertCreated()->assertJsonPath('procedure_code', '23.2');
        $this->assertContains('cof', collect($this->as(self::DOC)->getJson('/api/procedure-catalog')->assertOk()->json())->firstWhere('procedure_code', '23.2')['conditions']);
    }
}
