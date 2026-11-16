<?php

// Unit B koreksi (DEVIATIONS #56). Owning module: Billing. A financial correction is its own document, never a Rp0 line or a
// 100% discount: credit_note (Nota Kredit, numbered NK-YYYY-000001 per tenant), invoice_void, line_correction ("perlu tinjau
// koreksi" flag from a clinical correction), billing_decision (owner decisions / cashier review). All append-only except the
// number sequence. Original invoice lines, adjustments and payments are never changed.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $fk = fn (Blueprint $t, string $col, string $table, ?string $name = null) => $t->foreign(['tenant_id', $col], $name)->references(['tenant_id', 'id'])->on($table);
        $base = function (Blueprint $t) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->foreign('tenant_id')->references('id')->on('tenant');
        };

        // kind=correction now points at the line it corrects (+ the clinical correction, if any). Nullable: historic rows have none;
        // the API requires invoice_line_id for new kind=correction rows.
        Schema::table('invoice_adjustment', function (Blueprint $t) use ($fk) {
            $t->uuid('invoice_line_id')->nullable()->after('invoice_id');
            $t->uuid('procedure_correction_id')->nullable()->after('invoice_line_id');
            $fk($t, 'invoice_line_id', 'invoice_line', 'inv_adj_line_fk');
            $fk($t, 'procedure_correction_id', 'procedure_correction', 'inv_adj_corr_fk');
        });
        // Tariff anomaly: the line was priced Rp0 by the tariff master. Needs an owner (billing_decision), never a correction.
        Schema::table('invoice_line', fn (Blueprint $t) => $t->boolean('tariff_zero')->default(false)->after('price_rp'));

        Schema::create('credit_note_seq', function (Blueprint $t) use ($base) {
            $base($t);
            $t->unsignedSmallInteger('year');
            $t->unsignedInteger('last_number')->default(0);
            $t->unique(['tenant_id', 'year']);
        });

        Schema::create('credit_note', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->string('number', 20);                 // NK-YYYY-000001, sequential per tenant and year
            $t->uuid('invoice_id');
            $t->uuid('invoice_line_id');              // always one line: the line snapshot itself never changes
            $t->uuid('procedure_correction_id')->nullable(); // set when it comes from a clinical correction
            $t->unsignedBigInteger('amount_rp');      // > 0, <= what is still creditable on the line
            $t->boolean('is_full');                   // covers the rest of the line => owner approval
            $t->string('reason_type', 20);            // tidak_dikerjakan | salah_kode | salah_situs | salah_provider | salah_tarif | lainnya
            $t->string('reason', 500);                // admin text (plaintext like invoice_adjustment.reason; no clinical narrative)
            $t->boolean('requires_approval');
            $t->foreignUuid('created_by')->constrained('users');
            $t->timestamp('created_at')->nullable();
            $t->unique(['tenant_id', 'number']);
            $t->index(['tenant_id', 'invoice_id']);
            $t->index(['tenant_id', 'invoice_line_id']);
            $fk($t, 'invoice_id', 'invoice');
            $fk($t, 'invoice_line_id', 'invoice_line');
            $fk($t, 'procedure_correction_id', 'procedure_correction', 'credit_note_corr_fk');
        });

        Schema::create('invoice_void', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('invoice_id');
            $t->string('reason', 500);
            $t->boolean('requires_approval');         // invoice has billed (selesai) lines => owner
            $t->foreignUuid('created_by')->constrained('users');
            $t->timestamp('created_at')->nullable();
            $t->index(['tenant_id', 'invoice_id']);
            $fk($t, 'invoice_id', 'invoice');
        });

        Schema::create('line_correction', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('invoice_id');
            $t->uuid('invoice_line_id');
            $t->uuid('procedure_correction_id');
            $t->string('reason_type', 20);            // salah_kode | salah_situs | salah_provider
            $t->uuid('new_procedure_id');
            $t->json('billable')->nullable();         // structured codes of the corrected procedure (D-020) for "Tagih kode yang benar"
            $t->timestamp('created_at')->nullable();
            $t->unique(['tenant_id', 'procedure_correction_id', 'invoice_line_id'], 'line_corr_uq');
            $t->index(['tenant_id', 'invoice_id']);
            $fk($t, 'invoice_id', 'invoice');
            $fk($t, 'invoice_line_id', 'invoice_line');
            $fk($t, 'procedure_correction_id', 'procedure_correction', 'line_corr_corr_fk');
            $fk($t, 'new_procedure_id', 'procedure_record', 'line_corr_proc_fk');
        });

        // One decision per subject (exactly one of the four ids is set). approved | rejected (owner) | reviewed (cashier, line_correction).
        Schema::create('billing_decision', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('credit_note_id')->nullable();
            $t->uuid('invoice_void_id')->nullable();
            $t->uuid('invoice_line_id')->nullable();   // tariff_zero line acknowledged by an owner
            $t->uuid('line_correction_id')->nullable(); // reviewed with no money document
            $t->string('decision', 10);
            $t->string('reason', 500)->nullable();
            $t->foreignUuid('decided_by')->constrained('users');
            $t->boolean('self_approved_sole_owner')->default(false);
            $t->timestamp('created_at')->nullable();
            $t->unique(['tenant_id', 'credit_note_id']);
            $t->unique(['tenant_id', 'invoice_void_id']);
            $t->unique(['tenant_id', 'invoice_line_id']);
            $t->unique(['tenant_id', 'line_correction_id']);
            $fk($t, 'credit_note_id', 'credit_note');
            $fk($t, 'invoice_void_id', 'invoice_void');
            $fk($t, 'invoice_line_id', 'invoice_line');
            $fk($t, 'line_correction_id', 'line_correction');
        });
    }

    public function down(): void
    {
        foreach (['billing_decision', 'line_correction', 'invoice_void', 'credit_note', 'credit_note_seq'] as $t) {
            Schema::dropIfExists($t);
        }
        Schema::table('invoice_line', fn (Blueprint $t) => $t->dropColumn('tariff_zero'));
        Schema::table('invoice_adjustment', function (Blueprint $t) {
            $t->dropForeign('inv_adj_line_fk');
            $t->dropForeign('inv_adj_corr_fk');
            $t->dropColumn(['invoice_line_id', 'procedure_correction_id']);
        });
    }
};
