<?php

namespace Tests\Modules\Patients;

use App\Modules\Patients\Models\Patient;
use App\Modules\Patients\Services\PatientCareStateService;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Scheduling\Models\Chair;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PatientListTest extends TestCase
{
    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    private function byMrn(string $mrn): Patient
    {
        return $this->inA(fn () => Patient::where('mrn', $mrn)->firstOrFail());
    }

    /** All rows of tenant A, walking the cursor. */
    private function all(string $query = '', string $as = 'depan@senyum.test'): array
    {
        $rows = [];
        $cursor = null;
        do {
            $page = $this->as($as)->getJson('/api/patients?'.$query.($cursor ? '&cursor='.$cursor : ''))->assertOk();
            $rows = [...$rows, ...$page->json('data')];
            $cursor = $page->json('next_cursor');
        } while ($cursor);

        return $rows;
    }

    public function test_seeded_rows_carry_care_status_last_visit_dentist_and_allergies(): void
    {
        $rows = collect($this->all())->keyBy('mrn');
        $this->assertCount(42, $rows); // incl. the online booking demo patient
        $this->assertEqualsCanonicalizing(['dalam_perawatan', 'perlu_kontrol', 'tidak_aktif'], $rows->pluck('care_status')->unique()->values()->all());

        $p0 = $rows['BT-000001']; // open visit today + appointments
        $this->assertSame('dalam_perawatan', $p0['care_status']);
        $this->assertSame('drg. Andi Contoh', $p0['last_dentist_name']);
        $this->assertSame($this->user('dokter@senyum.test')->id, $p0['last_dentist_id']);
        $this->assertSame(['Penisilin', 'Lateks'], $p0['allergies']); // latest version only
        $this->assertMatchesRegularExpression('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/', $p0['last_visit_at']);

        $p30 = $rows['BT-000031']; // visited 60 days ago, nothing open
        $this->assertSame('perlu_kontrol', $p30['care_status']);
        $this->assertSame(['Ibuprofen (contoh)'], $p30['allergies']);
        $this->assertSame('tidak_aktif', $rows['BT-000032']['care_status']); // 400 days ago
        $this->assertNotNull($rows['BT-000032']['last_visit_at']);
        $p32 = $rows['BT-000033']; // never visited, allergy only
        $this->assertSame(['tidak_aktif', null, null, ['Lateks', 'Amoksisilin (contoh)']],
            [$p32['care_status'], $p32['last_visit_at'], $p32['last_dentist_name'], $p32['allergies']]);
        $this->assertSame([], $rows['BT-000036']['allergies']);

        foreach ($rows as $row) {
            $this->assertSame([], array_intersect(array_keys($row), ['nik', 'nik_enc', 'phone', 'phone_enc', 'address', 'address_enc',
                'medications', 'problems', 'urgent_note', 'content_enc', 'next_appointment_at', 'care_open_visit']));
        }
    }

    public function test_allergies_are_one_query_per_page(): void
    {
        DB::connection('mysql')->enableQueryLog();
        $this->as('depan@senyum.test')->getJson('/api/patients')->assertOk();
        $q = collect(DB::connection('mysql')->getQueryLog())->pluck('query');
        $this->assertSame(1, $q->filter(fn ($s) => str_contains($s, 'medical_history_version'))->count());
        $this->assertSame(0, $q->filter(fn ($s) => str_contains($s, '`visit`') || str_contains($s, '`appointment`'))->count());
    }

    public function test_filters_care_status_and_dentist_with_q_and_keyset(): void
    {
        $control = $this->all('care_status=perlu_kontrol');
        $this->assertNotEmpty($control);
        $this->assertTrue(collect($control)->every(fn ($r) => $r['care_status'] === 'perlu_kontrol'));
        $all = collect($this->all());
        $this->assertSame($all->where('care_status', 'tidak_aktif')->count(), count($this->all('care_status=tidak_aktif')));

        $dentist = $this->user('dokter@senyum.test')->id;
        $mine = collect($this->all('dentist_id='.$dentist));
        $this->assertEqualsCanonicalizing($all->where('last_dentist_id', $dentist)->pluck('id')->all(), $mine->pluck('id')->all());
        $this->assertContains('BT-000001', $mine->pluck('mrn'));

        $combo = $this->all('q=BT-000031&care_status=perlu_kontrol&dentist_id='.$dentist);
        $this->assertSame(['BT-000031'], array_column($combo, 'mrn'));
        $this->assertSame([], $this->all('q=BT-000031&care_status=dalam_perawatan'));

        $this->as('depan@senyum.test')->getJson('/api/patients?care_status=aktif')->assertUnprocessable();
        $this->as('depan@senyum.test')->getJson('/api/patients?dentist_id=bukan-uuid')->assertUnprocessable();
    }

    public function test_tenant_isolation_and_permission(): void
    {
        $senyum = $this->byMrn('BT-000031');
        $this->as('dokter@senyum.test')->putJson("/api/patients/{$senyum->id}/medical-history", ['base_version' => 1, 'medications' => [], 'problems' => [],
            'allergies' => ['Alergi Khusus Senyum (uji)'], 'urgent_note' => null, 'premedication_required' => false])->assertCreated();
        $this->assertSame(['Alergi Khusus Senyum (uji)'], collect($this->all())->firstWhere('id', $senyum->id)['allergies']);
        $rows = collect($this->all(as: 'dokter@ceria.test'));
        $this->assertNotContains($senyum->id, $rows->pluck('id'));
        $this->assertNotContains('Alergi Khusus Senyum (uji)', $rows->flatMap(fn ($r) => $r['allergies']));
        // Ceria's own row with the same MRN is Ceria's data, not Senyum's
        $this->assertSame(Ctx::runAs($this->tenantB()->id, fn () => Patient::where('mrn', 'BT-000031')->value('id')), $rows->firstWhere('mrn', 'BT-000031')['id']);
        $this->assertSame([], $this->all('dentist_id='.$this->user('dokter@senyum.test')->id, 'dokter@ceria.test'));
        $this->as('dokter@ceria.test')->getJson("/api/patients/{$senyum->id}")->assertNotFound();

        $stranger = DatabaseSeeder::user('tanpa-akses@contoh.test', 'Tanpa Akses');
        $this->actingAs($stranger)->withHeaders(['Accept' => 'application/json', 'Origin' => 'http://127.0.0.1:5173', 'Referer' => 'http://127.0.0.1:5173/'])
            ->getJson('/api/patients')->assertForbidden();
    }

    public function test_show_has_header_care_fields(): void
    {
        $p = $this->byMrn('BT-000031');
        $this->as('dokter@senyum.test')->getJson("/api/patients/{$p->id}")->assertOk()
            ->assertJsonPath('care_status', 'perlu_kontrol')->assertJsonPath('last_dentist_name', 'drg. Andi Contoh')
            ->assertJsonPath('last_visit_at', $p->last_visit_at->toIso8601ZuluString());
    }

    public function test_writers_push_visit_appointment_and_plan_facts(): void
    {
        $p = $this->byMrn('BT-000036'); // no visit, no appointment, no plan
        $this->assertSame(['tidak_aktif', null], [$p->care_status, $p->last_visit_at]);
        $chair = $this->inA(fn () => Chair::orderBy('label')->firstOrFail());
        $dentist = $this->user('dokter@senyum.test');
        $start = CarbonImmutable::now('Asia/Jakarta')->addDays(3)->setTime(16, 0);

        // Scheduling: booking => dalam perawatan; cancelling => back
        $appt = $this->as('depan@senyum.test')->postJson('/api/appointments', ['patient_id' => $p->id, 'chair_id' => $chair->id, 'dentist_id' => $dentist->id,
            'starts_at' => $start->toIso8601String(), 'ends_at' => $start->addMinutes(30)->toIso8601String()])->assertCreated()->json('id');
        $this->assertSame('dalam_perawatan', $p->fresh()->care_status);
        $this->as('depan@senyum.test')->postJson("/api/appointments/$appt/transition", ['to' => 'cancelled'])->assertOk();
        $this->assertSame(['tidak_aktif', null], [$p->fresh()->care_status, $p->fresh()->next_appointment_at]);

        // Scheduling: unscheduled plan => perlu kontrol; scheduling it => dalam perawatan
        $plan = $this->as('dokter@senyum.test')->postJson("/api/patients/{$p->id}/planned-appointments", ['procedure' => 'Kontrol (uji)', 'est_minutes' => 30])
            ->assertCreated()->json('id');
        $this->assertSame('perlu_kontrol', $p->fresh()->care_status);
        $appt2 = $this->as('depan@senyum.test')->postJson("/api/planned-appointments/$plan/schedule", ['chair_id' => $chair->id, 'starts_at' => $start->addHour()->toIso8601String()])
            ->assertCreated()->json('appointment_id');
        $this->assertSame(['dalam_perawatan', false], [$p->fresh()->care_status, $p->fresh()->care_unscheduled_plan]);

        // Clinical: visit start sets last visit + dentist, keeps Scheduling's facts
        $this->as('dokter@senyum.test')->postJson("/api/appointments/$appt2/visit")->assertCreated();
        $fresh = $p->fresh();
        $this->assertSame([$dentist->id, 'drg. Andi Contoh', true, 'dalam_perawatan'],
            [$fresh->last_dentist_id, $fresh->last_dentist_name, $fresh->care_open_visit, $fresh->care_status]);
        $this->assertNotNull($fresh->last_visit_at);
        $this->assertNotNull($fresh->next_appointment_at); // not wiped by the Clinical writer
    }

    public function test_refresh_recomputes_time_dependent_status(): void
    {
        $p = $this->byMrn('BT-000031');
        $this->inA(fn () => DB::connection('mysql')->transaction(fn () => $p->forceFill(['last_visit_at' => now()->subMonths(13)])->save()));
        $this->assertSame('perlu_kontrol', $p->fresh()->care_status); // stale until refreshed
        $this->assertGreaterThanOrEqual(1, $this->inA(fn () => app(PatientCareStateService::class)->refreshAll()));
        $this->assertSame('tidak_aktif', $p->fresh()->care_status);
        $this->assertSame(0, $this->inA(fn () => app(PatientCareStateService::class)->refreshAll())); // idempotent
    }

    public function test_dentists_endpoint_lists_this_tenant_only(): void
    {
        $this->as('depan@senyum.test')->getJson('/api/dentists')->assertOk()
            ->assertExactJson(['data' => [['id' => $this->user('dokter@senyum.test')->id, 'name' => 'drg. Andi Contoh'],
                ['id' => $this->user('dokter.bunga@senyum.test')->id, 'name' => 'drg. Bunga Contoh'],
                ['id' => $this->user('dokter.raka@senyum.test')->id, 'name' => 'drg. Raka Contoh']]]); // + booking demo dentists
        $this->as('kasir@ceria.test')->getJson('/api/dentists')->assertOk()
            ->assertExactJson(['data' => [['id' => $this->user('dokter@ceria.test')->id, 'name' => 'drg. Citra Contoh']]]);
    }
}
