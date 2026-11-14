<?php

namespace Tests\Modules\Clinical;

use App\Modules\Clinical\Domain\Soap;
use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\ClinicalNoteVersion;
use App\Modules\Clinical\Models\ToothFinding;
use App\Shared\Tenancy\Ctx;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

// Uses ehr_admin (full privileges) to prove the TRIGGER blocks changes, not just the missing grants.
// Separate autocommit admin connection on committed seed rows: no lock waits against the ehr_app test transaction.
class AppendOnlyTest extends TestCase
{
    private function admin()
    {
        config(['database.connections.mysql_admin_probe' => config('database.connections.mysql_admin')]);

        return DB::connection('mysql_admin_probe');
    }

    private function rejects(string $sql, array $bindings): void
    {
        try {
            $this->admin()->affectingStatement($sql, $bindings);
            $this->fail("Not rejected: $sql");
        } catch (QueryException $e) {
            $this->assertSame('45000', $e->errorInfo[0]);
        }
    }

    public function test_signed_version_is_frozen_and_correction_is_new_version(): void
    {
        $a = $this->tenantA()->id;
        $dentist = $this->user('dokter@senyum.test');
        Ctx::runAs($a, function () use ($dentist) {
            $v1 = ClinicalNoteVersion::where('state', 'signed')->firstOrFail();
            $before = $v1->getAttributes();

            $this->rejects('UPDATE clinical_note_version SET content_hash = ? WHERE tenant_id = ? AND id = ?', ['x', $v1->tenant_id, $v1->id]);
            $this->rejects('DELETE FROM clinical_note_version WHERE tenant_id = ? AND id = ?', [$v1->tenant_id, $v1->id]);
            $this->assertEquals($before, ClinicalNoteVersion::find($v1->id)->getAttributes());

            // fresh note: v1 signed, then correction v2
            $note = ClinicalNote::firstOrFail();
            $n2 = ClinicalNote::create(['visit_id' => $note->visit_id, 'patient_id' => $note->patient_id, 'author_id' => $dentist->id, 'first_input_at' => now()]);
            $x1 = DatabaseSeeder::version($n2, 1, null, ['S' => 'uji'], $dentist);
            $x2 = DatabaseSeeder::version($n2, 2, $x1, ['S' => 'uji koreksi'], $dentist, 'Koreksi uji');
            $this->assertSame($x1->id, $x2->supersedes_id);
            $this->assertSame(Soap::hash(Soap::normalize(['S' => 'uji'])), $x1->fresh()->content_hash);
            // a second correction of the same version is refused (unique supersedes_id)
            $this->expectException(QueryException::class);
            DatabaseSeeder::version($n2, 3, $x1, ['S' => 'lagi'], $dentist, 'lagi');
        });
    }

    public function test_ehr_app_update_of_signed_version_is_also_rejected(): void
    {
        Ctx::runAs($this->tenantA()->id, function () {
            $v1 = ClinicalNoteVersion::where('state', 'signed')->firstOrFail();
            $this->expectException(QueryException::class);
            $v1->update(['reason' => 'ubah diam-diam']);
        });
    }

    public function test_final_tooth_finding_is_frozen_and_correction_is_new_row(): void
    {
        Ctx::runAs($this->tenantA()->id, function () {
            $f = ToothFinding::where('state', 'final')->where('condition', 'karies')->firstOrFail();
            // before the FK insert below: ehr_app's FK check holds a shared lock on $f until the test transaction ends
            $this->rejects('UPDATE tooth_finding SET `condition` = ? WHERE tenant_id = ? AND id = ?', ['sehat', $f->tenant_id, $f->id]);
            $this->rejects('DELETE FROM tooth_finding WHERE tenant_id = ? AND id = ?', [$f->tenant_id, $f->id]);

            $fix = ToothFinding::create([...$f->only(['patient_id', 'visit_id', 'tooth', 'surface', 'created_by']),
                'condition' => 'tumpatan', 'state' => 'final', 'supersedes_id' => $f->id]);
            $this->assertSame('karies', $f->fresh()->condition);
            $this->assertSame($f->id, $fix->supersedes_id);

            // drafts stay editable until final
            $draft = ToothFinding::create([...$f->only(['patient_id', 'tooth', 'created_by']), 'condition' => 'karies']);
            $draft->update(['condition' => 'sisa_akar']);
            $this->assertSame('sisa_akar', $draft->fresh()->condition);

            $this->assertSame('karies', $f->fresh()->condition);
        });
    }

    public function test_audit_and_auth_event_reject_update_and_delete(): void
    {
        $admin = $this->admin(); // committed rows (test DB is rebuilt every run)
        $admin->table('auth_event')->insert(['id' => (string) Str::uuid7(), 'action' => 'login']);
        $admin->table('audit_event')->insert(['tenant_id' => $this->tenantA()->id, 'id' => (string) Str::uuid7(),
            'actor_type' => 'sistem', 'action' => 'uji', 'entity_type' => 'uji']);
        foreach (['UPDATE audit_event SET action = ?', 'UPDATE auth_event SET action = ?'] as $sql) {
            $this->rejects($sql.' LIMIT 1', ['x']);
        }
        foreach (['audit_event', 'auth_event'] as $t) {
            $this->rejects("DELETE FROM $t LIMIT 1", []);
        }
    }
}
