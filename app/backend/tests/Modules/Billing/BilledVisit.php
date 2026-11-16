<?php

namespace Tests\Modules\Billing;

use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\ClinicalNoteVersion;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Tenancy\Models\Membership;
use App\Modules\Tenancy\Models\Tenant;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Illuminate\Support\Facades\Cache;

// Shared by the unit B (credit note) and unit C (refund) tests: a Selesai visit with billed work, plus small request helpers.
trait BilledVisit
{
    private const DOC = 'dokter@senyum.test';

    private const OWNER = 'pemilik@senyum.test';

    private const KASIR = 'kasir@senyum.test';

    private const DESK = 'depan@senyum.test';

    private function in(Tenant $t, callable $fn): mixed
    {
        return Ctx::runAs($t->id, $fn);
    }

    /**
     * Selesai visit with billed `selesai` work by $doc. Returns [visit id, procedure id, invoice id, unbilled procedure id|null].
     * Billed work alone: Selesai signs and closes. Work without a tariff, or $open (adds an unbilled `selesai` row, no tariff):
     * Selesai signs but the invoice guard keeps the visit open (#55), so close-guard assertions run on a signed, open visit.
     */
    private function billed(string $doc = self::DOC, array $proc = ['tooth' => 26, 'surfaces' => 'MOD', 'procedure_code' => '23.2'], bool $open = false): array
    {
        $tenant = $doc === self::DOC ? $this->tenantA() : $this->tenantB();
        $appt = $this->in($tenant, fn () => Appointment::where('dentist_id', $this->user($doc)->id)
            ->when($doc === self::DOC, fn ($q) => $q->where('branch_id', Membership::where('user_id', $this->user(self::DESK)->id)->value('branch_id')))
            ->whereNotIn('patient_id', Visit::select('patient_id'))->orderBy('starts_at')->firstOrFail());
        $visit = $this->as($doc)->postJson("/api/appointments/{$appt->id}/visit")->assertCreated()->json('id');
        $this->as($doc)->putJson("/api/visits/$visit/note", ['soap' => ['S' => 'Kontrol.', 'O' => 'Periksa.']])->assertOk();
        $id = $this->as($doc)->postJson("/api/visits/$visit/procedures", $proc + ['status' => 'selesai', 'diagnosis_code' => 'K02.1'])
            ->assertCreated()->json('id');
        $unbilled = $open ? $this->as($doc)->postJson("/api/visits/$visit/procedures", ['tooth' => 21, 'procedure_code' => '23.41',
            'status' => 'selesai', 'diagnosis_code' => 'K02.1'])->assertCreated()->json('id') : null;
        Cache::flush();
        $res = $this->as($doc)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true]);
        $this->assertTrue($res->status() === 200 || ($res->status() === 409 && $res->json('signed') === true), $res->getContent());
        if ($open) {
            $res->assertConflict()->assertJsonPath('error', 'invoice_required'); // signed, visit stays open
        }

        $kasir = $doc === self::DOC ? self::KASIR : 'kasir@ceria.test';

        return [$visit, $id, $this->as($kasir)->getJson("/api/visits/$visit/invoice")->assertOk()->json('id'), $unbilled];
    }

    private function selesai(string $visit, string $as = self::DOC)
    {
        return $this->as($as)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true]);
    }

    /** Note signed, all work final, visit still `berlangsung`, no `tutup` audit (#55: invoice guard refused the close). */
    private function assertSignedOpen(string $visit): void
    {
        $this->in($this->tenantA(), function () use ($visit) {
            $this->assertSame('berlangsung', Visit::findOrFail($visit)->status);
            $this->assertSame(['signed'], ClinicalNoteVersion::whereIn('note_id', ClinicalNote::where('visit_id', $visit)->select('id'))->pluck('state')->all());
            $this->assertFalse(ProcedureRecord::where('visit_id', $visit)->where('state', 'draft')->exists());
            $this->assertFalse(AuditEvent::where('action', 'tutup')->where('entity_id', $visit)->exists());
        });
    }

    private function invoice(string $id, string $as = self::KASIR): array
    {
        return $this->as($as)->getJson("/api/invoices/$id")->assertOk()->json();
    }

    private function correct(string $procedure, array $body, string $as = self::DOC)
    {
        return $this->as($as)->postJson("/api/procedures/$procedure/corrections", $body + ['reason' => 'Salah input saat pencatatan.']);
    }

    private function credit(string $inv, string $line, int $amount, string $as = self::KASIR, array $extra = [])
    {
        return $this->as($as)->postJson("/api/invoices/$inv/credit-notes", ['invoice_line_id' => $line, 'amount_rp' => $amount,
            'reason_type' => 'salah_tarif', 'reason' => 'Tarif salah dipilih'] + $extra);
    }

    private function audited(string $action, Tenant $t): bool
    {
        return $this->in($t, fn () => AuditEvent::where('action', $action)->exists());
    }
}
