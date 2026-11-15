<?php

namespace Tests\Modules\Clinical;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\Visit;
use App\Shared\Audit\AuditEvent;
use App\Shared\Permissions\Permissions;
use App\Shared\Tenancy\Ctx;
use Tests\TestCase;

// UNIT 0d: owner = clinical read-only + every read audited; kasir = billing + demographics + schedule, no clinical.
class RoleAccessTest extends TestCase
{
    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    private function reads(string $email, string $patientId): int
    {
        return $this->inA(fn () => AuditEvent::where('actor_id', $this->user($email)->id)->where('action', 'baca')
            ->where('entity_id', $patientId)->count());
    }

    private function denials(string $email): int
    {
        return $this->inA(fn () => AuditEvent::where('actor_id', $this->user($email)->id)->where('action', 'akses_ditolak')->count());
    }

    public function test_owner_matrix_has_no_clinical_write_or_sign(): void
    {
        foreach (Permissions::MATRIX['owner'] as $perm) {
            $this->assertDoesNotMatchRegularExpression('/^(note|odontogram|prescription)\.(?!read$)/', $perm);
            $this->assertStringNotContainsString('sign', $perm);
        }
    }

    public function test_confirm_external_is_front_desk_and_assistant_only(): void
    {
        $holders = array_keys(array_filter(Permissions::MATRIX, fn ($perms) => in_array('procedure.confirm_external', $perms, true)));
        $this->assertSame(['assistant', 'front_desk'], $holders); // not the recording dentist, not kasir; owner = open decision (DEVIATIONS #48)
    }

    public function test_owner_reads_chart_and_each_read_writes_exactly_one_audit_row(): void
    {
        $owner = 'pemilik@senyum.test';
        $pid = $this->patientOf($this->tenantA())->id;
        foreach (["/api/patients/$pid/chart", "/api/patients/$pid/baseline", "/api/patients/$pid/medical-history"] as $url) {
            $before = $this->reads($owner, $pid);
            $res = $this->as($owner)->getJson($url)->assertOk();
            $this->assertSame($before + 1, $this->reads($owner, $pid), $url);
            $row = $this->inA(fn () => AuditEvent::where('actor_id', $this->user($owner)->id)->where('entity_id', $pid)->latest('id')->firstOrFail());
            $this->assertNotNull($row->occurred_at);
            $this->assertNotEmpty($row->entity_type); // what was read (chart / tooth_baseline / medical_history), no content
            $this->assertStringNotContainsString('Karies', json_encode($row->detail));
            $this->assertNotEmpty($res->json());
        }
    }

    public function test_owner_cannot_edit_sign_or_correct(): void
    {
        $owner = 'pemilik@senyum.test';
        [$visit, $note] = $this->inA(fn () => [Visit::orderBy('created_at')->firstOrFail()->id, ClinicalNote::orderBy('created_at')->firstOrFail()->id]);
        $pid = $this->patientOf($this->tenantA())->id;
        $before = $this->denials($owner);
        $r = $this->as($owner);
        $r->putJson("/api/visits/$visit/note", ['soap' => ['S' => 'x']])->assertForbidden();
        $r->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true])->assertForbidden();
        $r->postJson("/api/notes/$note/corrections", ['reason' => 'uji'])->assertForbidden();
        $r->postJson("/api/visits/$visit/findings", [])->assertForbidden();
        $r->putJson("/api/patients/$pid/baseline", [])->assertForbidden();
        $this->assertSame($before + 5, $this->denials($owner));
    }

    public function test_kasir_billing_yes_clinical_no(): void
    {
        $kasir = 'kasir@senyum.test';
        $pid = $this->patientOf($this->tenantA())->id;
        $inv = $this->inA(fn () => Invoice::orderBy('created_at')->firstOrFail()->id);
        $before = $this->denials($kasir);
        foreach (["/api/patients/$pid/chart", "/api/patients/$pid/baseline", "/api/patients/$pid/medical-history"] as $url) {
            $this->as($kasir)->getJson($url)->assertForbidden();
        }
        $this->assertSame($before + 3, $this->denials($kasir));
        $this->as($kasir)->getJson("/api/invoices/$inv")->assertOk();
        $this->as($kasir)->postJson("/api/invoices/$inv/adjustments", ['kind' => 'discount', 'amount_rp' => 1000, 'reason' => 'Uji kasir'])->assertCreated();
        $nik = $this->as($kasir)->getJson("/api/patients/$pid")->assertOk()->json('nik');
        $this->assertMatchesRegularExpression('/^\*+\d{4}$/', (string) $nik); // demographics only, NIK masked
        // alerts: front-desk view only (no free-text note, diseases, medications)
        $alerts = $this->as($kasir)->getJson("/api/patients/$pid/alerts")->assertOk()->json();
        $front = $this->as('depan@senyum.test')->getJson("/api/patients/$pid/alerts")->assertOk()->json();
        $this->assertSame(array_keys($front), array_keys($alerts));
        $this->as($kasir)->getJson('/api/me')->assertOk()->assertJsonPath('roles', ['kasir'])->assertJsonPath('role_label', 'Kasir');
    }
}
