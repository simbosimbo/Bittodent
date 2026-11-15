<?php

namespace Tests\Modules\Patients;

use App\Modules\Patients\Models\Patient;
use App\Modules\Patients\Models\PatientMrnSeq;
use App\Modules\Patients\Services\MrnGenerator;
use App\Shared\Tenancy\Ctx;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// No. RM: BT-%06d, sequential per tenant (synthetic seed: tenant A has 41 patients => BT-000001..BT-000041).
class MrnTest extends TestCase
{
    // Seeding starts with no patient_mrn_seq rows, so this also covers the generator's "create the tenant's row" path.
    public function test_seeded_patients_have_sequential_unique_mrns_per_tenant(): void
    {
        $a = Ctx::runAs($this->tenantA()->id, fn () => Patient::orderBy('mrn')->pluck('mrn')->all());
        $this->assertSame(array_map(fn ($n) => sprintf('BT-%06d', $n), range(1, 41)), $a);
        $b = Ctx::runAs($this->tenantB()->id, fn () => Patient::orderBy('mrn')->pluck('mrn')->all());
        $this->assertSame('BT-000001', $b[0]); // same number in the other tenant: unique per tenant only
    }

    public function test_create_returns_consecutive_mrns_and_list_show_include_it(): void
    {
        $r = $this->as('depan@senyum.test');
        $first = $r->postJson('/api/patients', ['name' => 'Rahmat Uji'])->assertCreated();
        $second = $r->postJson('/api/patients', ['name' => 'Rahmi Uji'])->assertCreated();
        $this->assertSame('BT-000042', $first->json('mrn'));
        $this->assertSame('BT-000043', $second->json('mrn'));
        $this->assertMatchesRegularExpression('/^BT-\d{6}$/', $first->json('mrn'));

        $this->assertSame('BT-000042', $r->getJson('/api/patients/'.$first->json('id'))->assertOk()->json('mrn'));
        $row = collect($r->getJson('/api/patients?q=rahmat')->assertOk()->json('data'))->firstWhere('id', $first->json('id'));
        $this->assertSame('BT-000042', $row['mrn']);
        $this->assertSame([], array_intersect(array_keys($row), ['nik', 'nik_enc', 'phone', 'phone_enc', 'address', 'address_enc']));

        $bCount = Ctx::runAs($this->tenantB()->id, fn () => Patient::count());
        $other = $this->as('dokter@ceria.test')->postJson('/api/patients', ['name' => 'Ceria Uji'])->assertCreated();
        $this->assertSame(sprintf('BT-%06d', $bCount + 1), $other->json('mrn'));
    }

    public function test_search_by_mrn_variants_stays_in_tenant(): void
    {
        $a = Ctx::runAs($this->tenantA()->id, fn () => Patient::where('mrn', 'BT-000001')->value('id'));
        $b = Ctx::runAs($this->tenantB()->id, fn () => Patient::where('mrn', 'BT-000001')->value('id'));
        $this->assertNotSame($a, $b);
        foreach (['BT-000001', 'bt-000001', 'BT-1', 'bt1', 'BT 000001', '000001', '1', ' BT-000001 '] as $q) {
            $ids = collect($this->as('dokter@senyum.test')->getJson('/api/patients?q='.urlencode($q))->assertOk()->json('data'))->pluck('id')->all();
            $this->assertSame([$a], $ids, $q);
        }
        $ids = collect($this->as('dokter@ceria.test')->getJson('/api/patients?q=BT-000001')->assertOk()->json('data'))->pluck('id')->all();
        $this->assertSame([$b], $ids);
        $this->assertCount(0, $this->as('dokter@senyum.test')->getJson('/api/patients?q=BT-999999')->assertOk()->json('data'));
    }

    public function test_generator_locks_the_sequence_row_and_skips_taken_numbers(): void
    {
        Ctx::runAs($this->tenantA()->id, function () {
            DB::connection('mysql')->enableQueryLog();
            [$x, $y] = [MrnGenerator::next(), MrnGenerator::next()];
            $this->assertSame(['BT-000042', 'BT-000043'], [$x, $y]);
            $this->assertStringContainsString('for update', collect(DB::connection('mysql')->getQueryLog())->pluck('query')->implode("\n"));

            PatientMrnSeq::query()->first()->update(['next_n' => 40]); // counter behind the data (e.g. a manual fix)
            $this->assertSame('BT-000042', MrnGenerator::next()); // BT-000040/41 are taken: skipped, not duplicated
            $this->assertSame(43, PatientMrnSeq::query()->value('next_n'));
        });
    }

    public function test_unique_index_rejects_duplicate_mrn_in_tenant(): void
    {
        $this->expectException(UniqueConstraintViolationException::class);
        Ctx::runAs($this->tenantA()->id, fn () => (new Patient)->fillIdentity(['name' => 'Duplikat Uji'])->fill(['mrn' => 'BT-000001'])->save());
    }
}
