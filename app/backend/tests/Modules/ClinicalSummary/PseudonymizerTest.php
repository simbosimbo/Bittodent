<?php

namespace Tests\Modules\ClinicalSummary;

use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\Visit;
use App\Modules\ClinicalSummary\Domain\HistoryScope;
use App\Modules\ClinicalSummary\Services\DeterministicSummarizer;
use App\Modules\ClinicalSummary\Services\Pseudonymizer;
use App\Modules\ClinicalSummary\Services\SourceCollector;
use App\Modules\Identity\Models\User;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Modules\Patients\Models\Patient;
use App\Shared\Tenancy\Ctx;
use Database\Seeders\DatabaseSeeder;
use Tests\TestCase;

// Unit 3: what reaches the model has no name/NIK/phone/address/email/date/record number/UUID. Synthetic identities only.
class PseudonymizerTest extends TestCase
{
    public const NIK = '3273011234567890';

    /** Gives patient A0 synthetic identifiers and a signed note whose free text leaks all of them. */
    public static function leakyNote(TestCase $t, string $patientId): void
    {
        $dentist = User::where('email', 'dokter@senyum.test')->firstOrFail();
        $p = Patient::findOrFail($patientId);
        $p->fillIdentity(['name' => $p->name, 'nik' => self::NIK, 'phone' => '0812-3456-7890', 'address' => 'Jl. Melati Sintetis No. 7'])->save();
        $v = Visit::create(['patient_id' => $p->id, 'branch_id' => Visit::where('patient_id', $p->id)->value('branch_id'), 'dentist_id' => $dentist->id,
            'started_at' => now()->subDay(), 'ended_at' => now()->subDay()->addHour(), 'status' => 'selesai']);
        $n = ClinicalNote::create(['visit_id' => $v->id, 'patient_id' => $p->id, 'author_id' => $dentist->id, 'first_input_at' => $v->started_at]);
        DatabaseSeeder::version($n, 1, null, ['S' => "Pasien {$p->name} (NIK ".self::NIK.', HP +62 812 3456 7890, sari.uji@contoh.test) datang 12 Maret 2026, kontrol 01/04/2026.',
            'O' => 'Gigi 36 karies dentin. No. RM-000123. Alamat Jl. Melati Sintetis No. 7. Diperiksa drg. Andi Contoh.',
            'A' => ['codes' => ['K02.1'], 'text' => 'Karies dentin'], 'P' => ['codes' => ['23.2'], 'text' => 'Tumpatan']], $dentist, at: now()->subDay());
    }

    public function test_model_input_contains_no_identifiers_or_ids(): void
    {
        $p = $this->patientOf($this->tenantA());
        [$input, $p] = Ctx::runAs($this->tenantA()->id, function () use ($p) {
            self::leakyNote($this, $p->id);
            $src = app(SourceCollector::class)->collect($p->id, new HistoryScope);
            $terms = [...app(PatientDirectory::class)->redactionTerms($p->id), 'drg. Andi Contoh', 'Andi Contoh'];

            return [app(Pseudonymizer::class)->build($src, new HistoryScope, $terms, app(PatientDirectory::class)->summary($p->id), new DeterministicSummarizer), $p];
        });

        $leaks = [$p->name, self::NIK, '0812', '812 3456', '3456 7890', 'sari.uji@', 'Melati', '12 Maret 2026', '01/04/2026', 'RM-000123', 'Andi Contoh',
            $this->tenantA()->id];
        foreach (array_merge($leaks, explode(' ', $p->name)) as $leak) {
            if (mb_strlen($leak) >= 4) {
                $this->assertStringNotContainsStringIgnoringCase($leak, $input->json, "leak: $leak");
            }
        }
        $this->assertDoesNotMatchRegularExpression('/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i', $input->json);
        $this->assertStringNotContainsString('dob', $input->json);
        $this->assertGreaterThanOrEqual(8, $input->redactions);

        // clinical content and codes survive; refs map back to the real signed version on the server only
        $this->assertStringContainsString('K02.1', $input->json);
        $this->assertStringContainsString('Gigi 36 karies dentin', $input->json);
        $this->assertStringContainsString('[IDENTITAS]', $input->json); // known NIK/address of this patient
        $this->assertSame(['N1', 'N2', 'N3', 'F1', 'F2', 'F3'], array_keys($input->refs));
        $this->assertSame('note_version', $input->manifest()['N1']);
        $this->assertMatchesRegularExpression('/^[0-9a-f-]{36}$/', $input->refs['N1']['citation']->sourceId);
    }

    public function test_patterns_catch_identifiers_not_known_from_the_database(): void
    {
        $out = app(Pseudonymizer::class)->scrub('Wali: NIK 3174 0912 3456 7801, HP 081398765432, email wali@contoh.test, lahir 3 Jan 2010, Jl Kenanga Contoh 9, MRN A-77821.',
            [], new HistoryScope);
        $this->assertSame('Wali: NIK [NIK], HP [TELP], email [EMAIL], lahir [TANGGAL], [ALAMAT], [NO_RM].', $out);
        $this->assertSame('Karies K02.1 gigi 46, tindakan 23.09.', app(Pseudonymizer::class)->scrub('Karies K02.1 gigi 46, tindakan 23.09.', [], new HistoryScope));
    }
}
