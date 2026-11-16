<?php

namespace Tests\Modules\Billing;

use App\Modules\Billing\Models\PaymentAccount;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Patients\Models\Patient;
use App\Modules\Tenancy\Models\Branch;
use App\Modules\Tenancy\Models\DentistProfile;
use App\Modules\Tenancy\Models\Membership;
use App\Shared\Permissions\Permissions;
use App\Shared\Tenancy\Ctx;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

// An owner who also treats patients (DEVIATIONS #69): clinical write comes ONLY from a second, dentist membership; the owner role
// itself never gets it. With both roles the owner runs the whole flow: walk-in -> RM -> Selesai -> tagihan -> bayar (lunas).
class OwnerDentistFlowTest extends TestCase
{
    private const OWNER = 'pemilik@senyum.test';

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    public function test_owner_role_alone_has_no_clinical_write(): void
    {
        foreach (['note.write', 'note.sign'] as $p) {
            $this->assertFalse(Permissions::allows(['owner'], $p), $p);
            $this->assertTrue(Permissions::allows(['owner', 'dentist'], $p), $p);
        }
    }

    public function test_owner_with_a_dentist_membership_runs_walk_in_to_paid_invoice(): void
    {
        $p = $this->inA(fn () => Patient::whereNotIn('id', Visit::where('status', 'berlangsung')->pluck('patient_id'))->orderBy('created_at')->firstOrFail()->id);
        // owner only: may register arrival (visit.register) but is no dentist, so must name one; the RM stays read-only
        $this->as(self::OWNER)->postJson("/api/patients/$p/visits/walk-in")->assertUnprocessable()->assertJsonValidationErrors('dentist_id');

        $owner = $this->user(self::OWNER)->id;
        $this->inA(function () use ($owner) {
            Membership::create(['user_id' => $owner, 'role' => 'dentist', 'branch_id' => Branch::where('name', 'like', 'Senyum Sehat Kemang%')->value('id')]);
            DentistProfile::firstOrCreate(['user_id' => $owner], ['category' => 'general']);
        });
        Cache::flush();
        $me = $this->as(self::OWNER)->getJson('/api/me')->assertOk();
        $this->assertEqualsCanonicalizing(['owner', 'dentist'], $me->json('roles'));
        foreach (['note.write', 'note.sign', 'billing.adjust', 'appointment.refer'] as $perm) {
            $this->assertContains($perm, $me->json('permissions'), $perm);
        }

        $visit = $this->as(self::OWNER)->postJson("/api/patients/$p/visits/walk-in")->assertCreated()->assertJsonPath('dentist_id', $owner)->json('id');
        $this->as(self::OWNER)->putJson("/api/visits/$visit/note", ['soap' => ['S' => 'Nyeri gigi.', 'O' => 'Karies 26.']])->assertOk();
        $this->as(self::OWNER)->postJson("/api/visits/$visit/procedures", ['tooth' => 26, 'surfaces' => 'MOD', 'procedure_code' => '23.2',
            'status' => 'selesai', 'diagnosis_code' => 'K02.1'])->assertCreated();
        Cache::flush();
        $this->as(self::OWNER)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true])->assertOk();

        $inv = $this->as(self::OWNER)->getJson("/api/visits/$visit/invoice")->assertOk();
        $this->assertContains($inv->json('id'), collect($this->as(self::OWNER)->getJson('/api/billing/invoices')->json('invoices'))->pluck('id'));
        $acct = $this->inA(fn () => PaymentAccount::where('name', 'Kas Kemang')->value('id'));
        $this->as(self::OWNER)->postJson('/api/invoices/'.$inv->json('id').'/payments', ['payment_account_id' => $acct, 'amount_rp' => $inv->json('balance_rp')])
            ->assertCreated()->assertJsonPath('status', 'lunas')->assertJsonPath('balance_rp', 0);
    }
}
