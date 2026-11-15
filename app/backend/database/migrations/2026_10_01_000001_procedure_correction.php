<?php

// Unit A koreksi (DEVIATIONS #53). Owning modules: Tenancy (tenant.correction_window_hours), Clinical (procedure_correction*).
// A new table, not correction_request: that one is SOAP-shaped (note_id, base_version_id, proposed_soap_enc NOT NULL) and mutable
// (state UPDATE). Procedure corrections are append-only: request row + one decision row (applied directly, approved or rejected).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Free-edit window for procedure corrections (Permenkes 24/2022 Pasal 30: 2x24 jam; clinical basis perlu dicek), per clinic.
        Schema::table('tenant', fn (Blueprint $t) => $t->unsignedSmallInteger('correction_window_hours')->default(48)->after('is_demo'));

        $fk = fn (Blueprint $t, string $col, string $table) => $t->foreign(['tenant_id', $col])->references(['tenant_id', 'id'])->on($table);
        $base = function (Blueprint $t) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->foreign('tenant_id')->references('id')->on('tenant');
        };

        Schema::create('procedure_correction', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('procedure_id');                 // the final row being corrected
            $t->string('reason_type', 20);            // salah_kode | salah_situs | salah_provider | tidak_dikerjakan
            $t->json('proposed')->nullable();         // structured fields only (codes, site, provider; D-020); null for tidak_dikerjakan
            $t->text('reason_enc');                   // ENCRYPTION_KEY: may hold clinical narrative
            $t->foreignUuid('requested_by')->constrained('users');
            $t->boolean('within_window');             // decided at request time against the tenant window
            $t->timestamp('created_at')->nullable();
            $t->index(['tenant_id', 'procedure_id']);
            $fk($t, 'procedure_id', 'procedure_record');
        });

        Schema::create('procedure_correction_decision', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('correction_id');
            $t->string('decision', 12);               // diterapkan (within window) | disetujui | ditolak
            $t->foreignUuid('decided_by')->constrained('users');
            $t->string('reason', 500)->nullable();    // owner's admin note; never clinical content
            $t->uuid('result_procedure_id')->nullable();
            $t->boolean('self_approved_sole_owner')->default(false); // same semantics as invoice_adjustment_decision (unit 4)
            $t->timestamp('created_at')->nullable();  // = decided_at
            $t->unique(['tenant_id', 'correction_id']); // decided once
            $fk($t, 'correction_id', 'procedure_correction');
            $t->foreign(['tenant_id', 'result_procedure_id'], 'proc_corr_decision_result_fk')->references(['tenant_id', 'id'])->on('procedure_record');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('procedure_correction_decision');
        Schema::dropIfExists('procedure_correction');
        Schema::table('tenant', fn (Blueprint $t) => $t->dropColumn('correction_window_hours'));
    }
};
