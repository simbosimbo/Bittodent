<?php

// Owning module: Clinical (UNIT C2: chart, sign, corrections).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Draft revision counter (optimistic concurrency), provenance (manual | ai_draft; ai_draft is only ever a draft until a
// dentist signs), and correction_request for corrections after 2x24h (D-013, database.md 3.4).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('correction_request', function (Blueprint $t) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->foreign('tenant_id')->references('id')->on('tenant');
            $t->uuid('note_id');
            $t->uuid('base_version_id');             // version being corrected (must still be current at approval)
            $t->text('proposed_soap_enc');           // ENCRYPTION_KEY
            $t->string('reason', 500);
            $t->string('state', 12)->default('diajukan'); // diajukan | disetujui | ditolak
            $t->foreignUuid('requested_by')->constrained('users');
            $t->foreignUuid('approved_by')->nullable()->constrained('users');
            $t->dateTime('approved_at')->nullable();
            $t->string('approval_reason', 500)->nullable();
            $t->boolean('self_approved')->default(false); // solo practice only (D-013)
            $t->timestamps();
            $t->index(['tenant_id', 'note_id', 'state']);
            $t->foreign(['tenant_id', 'note_id'])->references(['tenant_id', 'id'])->on('clinical_note');
            $t->foreign(['tenant_id', 'base_version_id'])->references(['tenant_id', 'id'])->on('clinical_note_version');
        });

        Schema::table('clinical_note_version', function (Blueprint $t) {
            $t->unsignedInteger('revision')->default(1)->after('version'); // draft edit counter
            $t->string('source', 10)->default('manual')->after('state');   // manual | ai_draft
            $t->uuid('correction_request_id')->nullable()->after('reason');
            $t->foreign(['tenant_id', 'correction_request_id'])->references(['tenant_id', 'id'])->on('correction_request');
        });

        Schema::table('tooth_finding', function (Blueprint $t) {
            $t->string('source', 10)->default('manual')->after('state'); // manual | ai_draft
            $t->index(['tenant_id', 'visit_id', 'state']);
            $t->foreign(['tenant_id', 'visit_id'])->references(['tenant_id', 'id'])->on('visit');
        });
    }

    public function down(): void
    {
        Schema::table('tooth_finding', fn (Blueprint $t) => $t->dropColumn('source'));
        Schema::table('clinical_note_version', fn (Blueprint $t) => $t->dropColumn(['revision', 'source', 'correction_request_id']));
        Schema::dropIfExists('correction_request');
    }
};
