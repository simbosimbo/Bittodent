<?php

namespace Tests\Modules\Billing;

use App\Modules\Clinical\Models\Visit;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Tenancy\Models\Membership;
use App\Modules\Tenancy\Models\Tenant;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\Cache;
use PragmaRX\Google2FA\Google2FA;

// Shared by the unit B (credit note) and unit C (refund) tests: a signed visit with billed work, plus small request helpers.
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

    /** Signed visit with billed `selesai` work by $doc. Returns [visit id, procedure id, invoice id]. */
    private function billed(string $doc = self::DOC, array $proc = ['tooth' => 26, 'surfaces' => 'MOD', 'procedure_code' => '23.2']): array
    {
        $tenant = $doc === self::DOC ? $this->tenantA() : $this->tenantB();
        $appt = $this->in($tenant, fn () => Appointment::where('dentist_id', $this->user($doc)->id)
            ->when($doc === self::DOC, fn ($q) => $q->where('branch_id', Membership::where('user_id', $this->user(self::DESK)->id)->value('branch_id')))
            ->whereNotIn('patient_id', Visit::select('patient_id'))->orderBy('starts_at')->firstOrFail());
        $visit = $this->as($doc)->postJson("/api/appointments/{$appt->id}/visit")->assertCreated()->json('id');
        $this->as($doc)->putJson("/api/visits/$visit/note", ['soap' => ['S' => 'Kontrol.', 'O' => 'Periksa.']])->assertOk();
        $id = $this->as($doc)->postJson("/api/visits/$visit/procedures", $proc + ['status' => 'selesai', 'diagnosis_code' => 'K02.1'])
            ->assertCreated()->json('id');
        Cache::flush();
        $this->as($doc)->postJson("/api/visits/$visit/sign", ['revision' => 1, 'confirm' => true,
            'code' => app(Google2FA::class)->getCurrentOtp(DatabaseSeeder::TOTP_SECRET)])->assertOk();

        $kasir = $doc === self::DOC ? self::KASIR : 'kasir@ceria.test';

        return [$visit, $id, $this->as($kasir)->getJson("/api/visits/$visit/invoice")->assertOk()->json('id')];
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
