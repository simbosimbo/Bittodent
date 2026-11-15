<?php

// Owning module: Agents (agent_run, agent_draft). docs/database.md 3.9 + PR #1 design 2.8 (hashes, latency, outcome, requester).
// No clinical text in agent_run: only hashes, counts, ids. Draft content only encrypted in agent_draft.payload_enc.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $fk = fn (Blueprint $t, string $col, string $table) => $t->foreign(['tenant_id', $col])->references(['tenant_id', 'id'])->on($table);
        $base = function (Blueprint $t) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->foreign('tenant_id')->references('id')->on('tenant');
        };

        // One row per model call. Inserted before the call (outcome berjalan), completed once (trigger: no change after finished_at).
        Schema::create('agent_run', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('branch_id')->nullable();
            $t->string('agent', 20);               // AgentKind
            $t->foreignUuid('requested_by')->nullable()->constrained('users');
            $t->uuid('patient_id')->nullable();
            $t->boolean('cross_branch')->default(false); // D-027: patient data read from another branch of the tenant
            $t->string('provider', 20);
            $t->string('model_id', 120);
            $t->string('region', 20);              // config ai.allowed_regions; MySQL CHECK in mysql/ migration (D-009)
            $t->string('prompt_version', 40);
            $t->json('input_refs');                // [{type, id, version?}] references only, never content
            $t->char('input_hash', 64);            // SHA-256 of the exact request sent
            $t->char('output_hash', 64)->nullable();
            $t->unsignedInteger('tokens_in')->nullable();
            $t->unsignedInteger('tokens_out')->nullable();
            $t->unsignedInteger('latency_ms')->nullable();
            $t->unsignedSmallInteger('claims_total')->nullable();   // filled by the caller's reply check (e.g. CitationValidator)
            $t->unsignedSmallInteger('claims_dropped')->nullable();
            $t->string('outcome', 30)->default('berjalan'); // RunOutcome
            $t->string('error_code', 40)->nullable();       // short reason code, never an SDK message
            $t->dateTime('started_at', 3);
            $t->dateTime('finished_at', 3)->nullable();
            $t->index(['tenant_id', 'agent', 'started_at']);
            $t->index(['tenant_id', 'patient_id', 'started_at']);
            $fk($t, 'branch_id', 'branch');
            $fk($t, 'patient_id', 'patient');
        });

        // One row per reviewable item. Content encrypted (Crypto). State changes only from menunggu_review (trigger).
        Schema::create('agent_draft', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('run_id');
            $t->string('kind', 20);                // DraftKind
            $t->string('target_type', 30);         // e.g. visit, patient
            $t->uuid('target_id')->nullable();
            $t->longText('payload_enc')->nullable(); // NULL only after purge of an expired `ringkasan` (not a medical record)
            $t->longText('source_spans_enc')->nullable();
            $t->string('state', 20)->default('menunggu_review'); // DraftState
            $t->foreignUuid('reviewer_id')->nullable()->constrained('users');
            $t->dateTime('reviewed_at')->nullable();
            $t->text('reject_reason_enc')->nullable();
            $t->dateTime('expires_at')->nullable();  // ringkasan only (PR #1 design 5.5)
            $t->dateTime('purged_at')->nullable();
            $t->timestamps();
            $t->index(['tenant_id', 'state', 'created_at']); // database.md Q8 review queue
            $t->index(['tenant_id', 'run_id']);
            $t->index(['tenant_id', 'target_type', 'target_id']);
            $fk($t, 'run_id', 'agent_run');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_draft');
        Schema::dropIfExists('agent_run');
    }
};
