<?php

namespace Tests\Modules\Agents;

use App\Modules\Agents\Contracts\AgentCall;
use App\Modules\Agents\Contracts\AgentDrafts;
use App\Modules\Agents\Contracts\AgentKind;
use App\Modules\Agents\Contracts\AgentRuns;
use App\Modules\Agents\Contracts\DraftKind;
use App\Modules\Agents\Contracts\DraftReviewDenied;
use App\Modules\Agents\Contracts\DraftState;
use App\Modules\Agents\Models\AgentDraft;
use App\Modules\Clinical\Models\ClinicalNoteVersion;
use App\Modules\Clinical\Models\ToothFinding;
use App\Modules\Integrations\Contracts\ModelClient;
use App\Modules\Integrations\Contracts\ModelRequest;
use App\Modules\Integrations\Models\Outbox;
use App\Modules\Integrations\Services\Ai\FakeModelClient;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

// Drafts stay drafts until a dentist reviews each item (D-001). Only ai_draft.review may approve/reject; ringkasan never approvable;
// approving never writes a clinical record.
class AgentDraftTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->app->instance(ModelClient::class, new FakeModelClient);
    }

    /** @return list<string> draft ids in tenant A: [kode_icd K04.0, kode_icd K02.1, ringkasan] */
    private function seedDrafts(): array
    {
        return Ctx::runAs($this->tenantA()->id, function () {
            $run = app(AgentRuns::class)->call(new AgentCall(AgentKind::Koding, 'icd-v1', new ModelRequest('s', '{}')));
            $drafts = app(AgentDrafts::class);

            return [
                $drafts->propose($run->runId, DraftKind::KodeIcd, 'visit', null, ['code' => 'K04.0', 'span' => 'S1'], ['S1' => [0, 12]]),
                $drafts->propose($run->runId, DraftKind::KodeIcd, 'visit', null, ['code' => 'K02.1', 'span' => 'S2']),
                $drafts->propose($run->runId, DraftKind::Ringkasan, 'patient', null, ['sections' => []]),
            ];
        }, $this->user('dokter@senyum.test')->id);
    }

    private function counts(): array
    {
        return Ctx::runAs($this->tenantA()->id, fn () => [ClinicalNoteVersion::count(), ToothFinding::count(), Outbox::count()]);
    }

    public function test_dentist_reviews_each_item_separately_without_touching_clinical_records(): void
    {
        [$icd1, $icd2] = $this->seedDrafts();
        $before = $this->counts();

        $this->as('dokter@senyum.test')->postJson("/api/ai-drafts/$icd1/approve")
            ->assertOk()->assertJson(['state' => 'disetujui', 'payload' => ['code' => 'K04.0']]);
        $this->as('dokter@senyum.test')->postJson("/api/ai-drafts/$icd2/reject", ['reason' => 'Tidak sesuai pemeriksaan (uji).'])
            ->assertOk()->assertJson(['state' => 'ditolak']);

        Ctx::runAs($this->tenantA()->id, function () use ($icd1, $icd2) {
            $a = AgentDraft::findOrFail($icd1);
            $this->assertSame(DraftState::Disetujui, $a->state);
            $this->assertSame($this->user('dokter@senyum.test')->id, $a->reviewer_id);
            $this->assertNotNull($a->reviewed_at);
            $this->assertSame(DraftState::Ditolak, AgentDraft::findOrFail($icd2)->state);
            $this->assertSame(1, AuditEvent::where('action', 'ai_draf_setujui')->where('entity_id', $icd1)->count());
            $this->assertSame(1, AuditEvent::where('action', 'ai_draf_tolak')->where('entity_id', $icd2)->count());
        });
        $this->assertSame($before, $this->counts());

        // reviewed = terminal
        $this->as('dokter@senyum.test')->postJson("/api/ai-drafts/$icd1/approve")->assertStatus(409);
        $this->as('dokter@senyum.test')->postJson("/api/ai-drafts/$icd2/approve")->assertStatus(409);
    }

    public static function nonReviewers(): array
    {
        return ['pemilik' => ['pemilik@senyum.test'], 'asisten' => ['asisten@senyum.test'], 'front desk' => ['depan@senyum.test'], 'kasir' => ['kasir@senyum.test']];
    }

    #[DataProvider('nonReviewers')]
    public function test_only_dentist_may_approve_or_reject(string $email): void
    {
        [$icd1] = $this->seedDrafts();
        $this->as($email)->postJson("/api/ai-drafts/$icd1/approve")->assertForbidden();
        $this->as($email)->postJson("/api/ai-drafts/$icd1/reject", ['reason' => 'uji tolak'])->assertForbidden();
        Ctx::runAs($this->tenantA()->id, function () use ($icd1) {
            $this->assertSame(DraftState::MenungguReview, AgentDraft::findOrFail($icd1)->state);
            $this->assertSame(2, AuditEvent::where('action', 'akses_ditolak')->where('detail->permission', 'ai_draft.review')->count());
        });
    }

    public function test_service_enforces_permission_even_without_the_route_guard(): void
    {
        [$icd1] = $this->seedDrafts();
        Ctx::runAs($this->tenantA()->id, function () use ($icd1) {
            Ctx::current()->roles = ['owner', 'assistant'];
            try {
                app(AgentDrafts::class)->approve($icd1);
                $this->fail('not denied');
            } catch (DraftReviewDenied $e) {
                $this->assertSame(DraftReviewDenied::FORBIDDEN, $e->reason);
            } finally {
                Ctx::current()->roles = [];
            }
            $this->assertSame(1, AuditEvent::where('action', 'akses_ditolak')->where('entity_id', $icd1)->count());
            $this->assertSame(DraftState::MenungguReview, AgentDraft::findOrFail($icd1)->state);
        }, $this->user('pemilik@senyum.test')->id);
    }

    public function test_ringkasan_can_never_be_approved(): void
    {
        [, , $summary] = $this->seedDrafts();
        $this->as('dokter@senyum.test')->postJson("/api/ai-drafts/$summary/approve")->assertStatus(422)->assertJson(['error' => 'not_approvable']);
        Ctx::runAs($this->tenantA()->id, fn () => $this->assertSame(DraftState::MenungguReview, AgentDraft::findOrFail($summary)->state));

        $this->assertFalse(DraftState::MenungguReview->canMoveTo(DraftState::Disetujui, DraftKind::Ringkasan));
        $this->assertTrue(DraftState::MenungguReview->canMoveTo(DraftState::Kedaluwarsa, DraftKind::Ringkasan));
        $this->assertFalse(DraftState::MenungguReview->canMoveTo(DraftState::Kedaluwarsa, DraftKind::KodeIcd));
        foreach (DraftKind::cases() as $kind) {
            $this->assertFalse(DraftState::Disetujui->canMoveTo(DraftState::Ditolak, $kind));
        }
    }

    public function test_other_tenant_cannot_see_or_review_drafts(): void
    {
        [$icd1] = $this->seedDrafts();
        $this->as('dokter@ceria.test')->postJson("/api/ai-drafts/$icd1/approve")->assertNotFound();
        Ctx::runAs($this->tenantB()->id, fn () => $this->assertNull(AgentDraft::find($icd1)));
        Ctx::runAs($this->tenantA()->id, fn () => $this->assertSame(DraftState::MenungguReview, AgentDraft::findOrFail($icd1)->state));
    }

    public function test_payload_is_encrypted_and_reviewed_rows_are_frozen_in_the_database(): void
    {
        [$icd1] = $this->seedDrafts();
        Ctx::runAs($this->tenantA()->id, function () use ($icd1) {
            $draft = AgentDraft::findOrFail($icd1);
            $this->assertStringNotContainsString('K04.0', $draft->payload_enc);
            $this->assertStringNotContainsString('K04.0', json_encode($draft->toArray()));
            $this->assertSame(['code' => 'K04.0', 'span' => 'S1'], $draft->payload());

            try {
                DB::transaction(fn () => $draft->update(['payload_enc' => 'ditimpa']));
                $this->fail('payload overwrite not rejected');
            } catch (QueryException $e) {
                $this->assertSame('45000', $e->errorInfo[0]);
            }

            Ctx::current()->roles = ['dentist'];
            app(AgentDrafts::class)->approve($icd1);
            Ctx::current()->roles = [];
            try {
                DB::transaction(fn () => AgentDraft::findOrFail($icd1)->update(['state' => 'menunggu_review']));
                $this->fail('reviewed draft changed');
            } catch (QueryException $e) {
                $this->assertSame('45000', $e->errorInfo[0]);
            }
        }, $this->user('dokter@senyum.test')->id);
    }

    public function test_listing_by_target_and_by_reviewer_stays_in_the_tenant(): void
    {
        $dokter = $this->user('dokter@senyum.test')->id;
        [$a, $b] = Ctx::runAs($this->tenantA()->id, function () {
            $runId = app(AgentRuns::class)->recordDeterministic(AgentKind::Koding, 'aturan-v1', [['type' => 'finding', 'id' => 'f1', 'version' => 1]], hash('sha256', 'x'));
            $d = app(AgentDrafts::class);

            return [$d->propose($runId, DraftKind::KodeIcd, 'visit', 'v-1', ['code' => 'K02.1']), $d->propose($runId, DraftKind::KodeIcd, 'visit', 'v-1', ['code' => 'K04.0'])];
        }, $dokter);
        Ctx::runAs($this->tenantA()->id, function () use ($a, $b, $dokter) {
            $d = app(AgentDrafts::class);
            Ctx::current()->roles = ['dentist'];
            try {
                $d->approve($a);
            } finally {
                Ctx::current()->roles = [];
            }
            $list = $d->forTarget(DraftKind::KodeIcd, 'visit', 'v-1');
            $this->assertSame([$a, $b], array_column($list, 'id'));
            $this->assertSame([DraftState::Disetujui, DraftState::MenungguReview], array_column($list, 'state'));
            $this->assertSame([['state' => DraftState::Disetujui, 'payload' => ['code' => 'K02.1']]], $d->reviewedBy(DraftKind::KodeIcd, $dokter));
            $this->assertSame('deterministik', DB::table('agent_run')->value('generator'));
        }, $dokter);
        Ctx::runAs($this->tenantB()->id, fn () => $this->assertSame([], app(AgentDrafts::class)->forTarget(DraftKind::KodeIcd, 'visit', 'v-1')));
    }
}
