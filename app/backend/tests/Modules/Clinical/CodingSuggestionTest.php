<?php

namespace Tests\Modules\Clinical;

use App\Modules\Clinical\Domain\CodingTemplate;
use App\Modules\Clinical\Domain\Odontogram;
use App\Modules\Clinical\Models\CodingPreference;
use App\Modules\Clinical\Models\CodingRule;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Tenancy\Models\Membership;
use App\Shared\Tenancy\Ctx;
use App\Shared\Terminology\IcdCatalog;
use Database\Seeders\DatabaseSeeder;
use Tests\TestCase;

class CodingSuggestionTest extends TestCase
{
    private const DOC = 'dokter@senyum.test';

    private function suggest(string $query, string $email = self::DOC)
    {
        return $this->as($email)->getJson("/api/coding-suggestions?$query");
    }

    private function codes(string $query, string $email = self::DOC): array
    {
        return array_column($this->suggest($query, $email)->assertOk()->json('suggestions'), 'icd10');
    }

    public function test_tooth_groups_most_specific_first(): void
    {
        $this->assertSame(['m3', 'posterior', 'any'], Odontogram::toothGroups(38));
        $this->assertSame(['sulung', 'posterior', 'any'], Odontogram::toothGroups(75));
        $this->assertSame(['sulung', 'anterior', 'any'], Odontogram::toothGroups(52));
        $this->assertSame(['anterior', 'any'], Odontogram::toothGroups(11));
        $this->assertSame(['posterior', 'any'], Odontogram::toothGroups(36));
    }

    public function test_template_is_seeded_per_tenant_with_official_codes_only(): void
    {
        $expected = array_sum(array_map(fn ($r) => count($r[3]), CodingTemplate::RULES));
        $icd = app(IcdCatalog::class);
        foreach ([$this->tenantA(), $this->tenantB()] as $t) {
            $rules = Ctx::runAs($t->id, fn () => CodingRule::all());
            $this->assertCount($expected, $rules);
            foreach ($rules as $r) {
                $this->assertTrue($icd->icd10Exists($r->icd10), $r->icd10);
                $this->assertTrue($r->icd9cm === null || $icd->icd9cmExists($r->icd9cm), (string) $r->icd9cm);
            }
            $this->assertNotContains('K02.5', $rules->pluck('icd10'));
            $this->assertNotContains('hilang', $rules->pluck('condition'));
        }
        Ctx::runAs($this->tenantA()->id, fn () => CodingTemplate::seed()); // idempotent
        $this->assertSame($expected, Ctx::runAs($this->tenantA()->id, fn () => CodingRule::count()));
    }

    public function test_suggestions_follow_the_most_specific_tooth_group(): void
    {
        $r = $this->suggest('condition=karies&tooth=36&surface=O')->assertOk();
        $this->assertSame(['K02.1', 'K02.0', 'K02.9'], array_column($r->json('suggestions'), 'icd10'));
        $r->assertJsonPath('suggestions.0.display', 'Caries of dentine')->assertJsonPath('suggestions.0.icd9cm', '23.2')
            ->assertJsonPath('suggestions.0.source', 'aturan');
        $this->assertSame(['K02.1', 'K02.0'], $this->codes('condition=karies&tooth=11'));
        $this->assertSame('K00.6', $this->codes('condition=perlu_dicabut&tooth=75')[0]);
        $this->suggest('condition=perlu_dicabut&tooth=75')->assertJsonPath('suggestions.0.icd9cm', '23.01');
        $this->suggest('condition=perlu_dicabut&tooth=38')->assertJsonCount(1, 'suggestions')
            ->assertJsonPath('suggestions.0.icd10', 'K01.1')->assertJsonPath('suggestions.0.icd9cm', '23.19');
        $this->assertSame(['K04.5', 'K04.1', 'K05.3'], $this->codes('condition=perlu_dicabut&tooth=46'));
        $this->suggest('condition=sisa_akar&tooth=46')->assertJsonPath('suggestions.0.icd10', 'K08.3')->assertJsonPath('suggestions.0.icd9cm', '23.11');
        $this->assertSame([], $this->codes('condition=hilang&tooth=46'));
    }

    public function test_invalid_input_and_access(): void
    {
        $this->getJson('/api/coding-suggestions?condition=karies&tooth=36')->assertUnauthorized();
        $this->suggest('condition=retak&tooth=36')->assertUnprocessable()->assertJsonValidationErrors('condition');
        $this->suggest('condition=karies&tooth=19')->assertUnprocessable()->assertJsonValidationErrors('tooth');
        $this->suggest('condition=karies&tooth=abc')->assertUnprocessable()->assertJsonValidationErrors('tooth');
        $this->suggest('condition=karies')->assertUnprocessable()->assertJsonValidationErrors('tooth');
        $this->suggest('condition=karies&tooth=36', 'asisten@senyum.test')->assertOk();
        foreach (['depan@senyum.test', 'kasir@senyum.test', 'pemilik@senyum.test'] as $email) { // no note.write
            $this->suggest('condition=karies&tooth=36', $email)->assertForbidden();
        }
    }

    public function test_saved_diagnosis_moves_code_to_front_for_that_dentist_only(): void
    {
        $other = DatabaseSeeder::user('dokter2@senyum.test', 'drg. Kedua Contoh', 'dokter_gigi');
        Ctx::runAs($this->tenantA()->id, fn () => Membership::create(['user_id' => $other->id, 'role' => 'dentist']));
        $appt = Ctx::runAs($this->tenantA()->id, fn () => Appointment::whereNotIn('id', Visit::whereNotNull('appointment_id')->pluck('appointment_id'))
            ->orderBy('starts_at')->firstOrFail());
        $visit = $this->as(self::DOC)->postJson("/api/appointments/{$appt->id}/visit")->assertCreated()->json('id');

        // no code => suggestions in the response, diagnosis_code stays empty
        $f = $this->as(self::DOC)->postJson("/api/visits/$visit/findings", ['tooth' => 46, 'surface' => null, 'condition' => 'perlu_dicabut'])
            ->assertCreated()->assertJsonPath('diagnosis_code', null)->assertJsonPath('suggestions.0.icd10', 'K04.5')->json('id');
        $this->as(self::DOC)->patchJson("/api/findings/$f", ['condition' => 'perlu_dicabut', 'diagnosis_code' => 'K04.1'])
            ->assertOk()->assertJsonPath('diagnosis_code', 'K04.1')->assertJsonMissingPath('suggestions');

        $this->assertSame(['K04.1', 'K04.5', 'K05.3'], $this->codes('condition=perlu_dicabut&tooth=46'));
        $this->suggest('condition=perlu_dicabut&tooth=46')->assertJsonPath('suggestions.0.source', 'riwayat')->assertJsonPath('suggestions.0.count', 1);
        $this->assertSame(['K04.1', 'K04.5', 'K05.3'], $this->codes("condition=perlu_dicabut&tooth=46&visit_id=$visit", 'asisten@senyum.test'));
        $this->assertSame(['K04.5', 'K04.1', 'K05.3'], $this->codes('condition=perlu_dicabut&tooth=46', $other->email)); // no clinic-wide sort
        $this->assertSame(['K04.5', 'K04.1', 'K05.3'], $this->codes('condition=perlu_dicabut&tooth=46', 'dokter@ceria.test'));
        $this->assertSame(0, Ctx::runAs($this->tenantB()->id, fn () => CodingPreference::count()));
    }

    public function test_custom_rule_does_not_leak_to_other_tenant(): void
    {
        Ctx::runAs($this->tenantA()->id, fn () => CodingRule::create(['condition' => 'karies', 'tooth_group' => 'anterior', 'icd10' => 'K02.9', 'priority' => 3]));
        $this->assertSame(['K02.1', 'K02.0', 'K02.9'], $this->codes('condition=karies&tooth=11'));
        $this->assertSame(['K02.1', 'K02.0'], $this->codes('condition=karies&tooth=11', 'dokter@ceria.test'));
    }
}
