<?php

namespace Tests\Modules\Agents;

use App\Modules\Agents\Contracts\AgentCall;
use App\Modules\Agents\Contracts\AgentCallResult;
use App\Modules\Agents\Contracts\AgentKind;
use App\Modules\Agents\Contracts\AgentRuns;
use App\Modules\Agents\Contracts\ReplyCheck;
use App\Modules\Agents\Models\AgentRun;
use App\Modules\Integrations\Contracts\ModelClient;
use App\Modules\Integrations\Contracts\ModelDescriptor;
use App\Modules\Integrations\Contracts\ModelNotAllowed;
use App\Modules\Integrations\Contracts\ModelRequest;
use App\Modules\Integrations\Services\Ai\FakeModelClient;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

// Every model call => one agent_run + one audit row, success or failure; tenant scope mandatory; no clinical text stored.
class AgentRunTest extends TestCase
{
    // Synthetic clinical text (never real data). Must never appear in agent_run or audit_event.
    private const SOAP = 'Pasien Sintetis Uji mengeluh nyeri berdenyut gigi 46 sejak tiga hari, diagnosis K04.0 contoh';

    private FakeModelClient $fake;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fake = new FakeModelClient;
        $this->app->instance(ModelClient::class, $this->fake);
    }

    private function runAgent(?callable $accept = null, ?string $patientId = null): AgentCallResult
    {
        return app(AgentRuns::class)->call(new AgentCall(AgentKind::Ringkasan, 'ringkasan-v1',
            new ModelRequest('Ringkas dengan sitasi.', json_encode(['N1' => self::SOAP])), [['type' => 'note_version', 'id' => 'N1-uuid', 'version' => 2, 'text' => self::SOAP]], $patientId), $accept);
    }

    private function asDentistOfA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn, $this->user('dokter@senyum.test')->id);
    }

    public function test_success_writes_completed_run_and_audit(): void
    {
        $patient = $this->patientOf($this->tenantA());
        $this->asDentistOfA(function () use ($patient) {
            $res = $this->runAgent(patientId: $patient->id);
            $this->assertTrue($res->ok());
            $run = AgentRun::findOrFail($res->runId);
            $this->assertSame('berhasil', $run->outcome);
            $this->assertSame(['ringkasan', 'fake', 'id-lokal', 'ringkasan-v1', $patient->id, $this->user('dokter@senyum.test')->id],
                [$run->agent, $run->provider, $run->region, $run->prompt_version, $run->patient_id, $run->requested_by]);
            $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $run->input_hash);
            $this->assertSame(hash('sha256', $res->reply->text), $run->output_hash);
            $this->assertGreaterThan(0, $run->tokens_in);
            $this->assertNotNull($run->latency_ms);
            $this->assertNotNull($run->finished_at);
            $this->assertEquals([['type' => 'note_version', 'id' => 'N1-uuid', 'version' => 2]], $run->input_refs); // 'text' stripped

            $audit = AuditEvent::where('action', 'ai_panggil')->where('entity_id', $run->id)->sole();
            $this->assertSame('berhasil', $audit->detail['outcome']);
            $this->assertSame($this->user('dokter@senyum.test')->id, $audit->actor_id);
        });
    }

    public function test_failure_writes_failed_run_and_audit_with_code_only(): void
    {
        $this->fake->willFail('timeout');
        $this->asDentistOfA(function () {
            $res = $this->runAgent();
            $this->assertFalse($res->ok());
            $this->assertNull($res->reply);
            $run = AgentRun::findOrFail($res->runId);
            $this->assertSame(['gagal', 'timeout'], [$run->outcome, $run->error_code]);
            $this->assertNull($run->output_hash);
            $this->assertNotNull($run->finished_at);
            $audit = AuditEvent::where('action', 'ai_panggil')->where('entity_id', $run->id)->sole();
            $this->assertSame(['gagal', 'timeout'], [$audit->detail['outcome'], $audit->detail['error_code']]);
        });
    }

    public function test_rejected_reply_stops_for_a_human_and_records_claim_counts(): void
    {
        $this->asDentistOfA(function () {
            $bool = $this->runAgent(fn () => false);
            $this->assertSame('berhenti_minta_manusia', AgentRun::findOrFail($bool->runId)->outcome);
            $this->assertNull($bool->reply);

            $res = $this->runAgent(fn () => new ReplyCheck(true, 10, 2));
            $run = AgentRun::findOrFail($res->runId);
            $this->assertSame(['berhasil', 10, 2], [$run->outcome, $run->claims_total, $run->claims_dropped]);
        });
    }

    public function test_no_clinical_text_in_agent_run_or_audit(): void
    {
        $this->fake->willReply('{"claims":[{"text":"'.self::SOAP.'","refs":["N1"]}]}');
        $this->asDentistOfA(function () {
            $res = $this->runAgent();
            $this->fake->willFail('Galat SDK berisi potongan: '.self::SOAP);
            $failed = $this->runAgent();
            $rows = json_encode([AgentRun::whereIn('id', [$res->runId, $failed->runId])->get()->toArray(), AuditEvent::where('action', 'ai_panggil')->get()->toArray()]);
            foreach (['nyeri berdenyut', 'Pasien Sintetis', 'K04.0', 'Ringkas dengan sitasi'] as $needle) {
                $this->assertStringNotContainsString($needle, $rows);
            }
            $this->assertSame('unavailable', AgentRun::findOrFail($failed->runId)->error_code); // non-code reason never stored
        });
    }

    public function test_tenant_scope_is_mandatory_and_isolates_runs(): void
    {
        $runId = $this->asDentistOfA(fn () => $this->runAgent()->runId);
        Ctx::runAs($this->tenantB()->id, function () use ($runId) {
            $this->assertNull(AgentRun::find($runId));
            $this->assertSame(0, AgentRun::count());
        }, $this->user('dokter@ceria.test')->id);

        $this->expectException(RuntimeException::class);
        $this->runAgent(); // no tenant context
    }

    public function test_client_outside_indonesia_is_refused_before_any_call(): void
    {
        $fake = new FakeModelClient(new ModelDescriptor('fake', 'fake-x', 'us-east-1'));
        $this->app->instance(ModelClient::class, $fake);
        $this->asDentistOfA(function () use ($fake) {
            try {
                $this->runAgent();
                $this->fail('not refused');
            } catch (ModelNotAllowed) {
            }
            $this->assertSame(0, $fake->calls);
            $this->assertSame(0, AgentRun::count());
            $this->assertSame('region_not_allowed', AuditEvent::where('action', 'ai_panggil')->sole()->detail['error_code']);
        });
    }

    public function test_database_rejects_region_outside_indonesia_and_changes_after_finish(): void
    {
        $this->asDentistOfA(function () {
            $run = AgentRun::findOrFail($this->runAgent()->runId);
            foreach ([fn () => $run->update(['tokens_out' => 1]),
                fn () => AgentRun::create(array_merge($run->only(['agent', 'provider', 'model_id', 'prompt_version', 'input_refs', 'input_hash', 'started_at']), ['region' => 'us-east-1'])),
                fn () => $run->delete()] as $op) {
                try {
                    DB::transaction($op);
                    $this->fail('not rejected');
                } catch (QueryException $e) {
                    $this->assertContains($e->errorInfo[0], ['45000', 'HY000', '42000'], $e->getMessage());
                }
            }
        });
    }
}
