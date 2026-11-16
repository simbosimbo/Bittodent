<?php

// Unit C koreksi (DEVIATIONS #57). Owning module: Billing. Refund = its own row in the payment family (invoice_refund), never a
// changed or deleted invoice_payment. Always tied to the original payment (same clinic account) and to an applied credit note.
// Always waits for an owner (billing_decision.refund_id). Append-only.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $fk = fn (Blueprint $t, string $col, string $table, ?string $name = null) => $t->foreign(['tenant_id', $col], $name)->references(['tenant_id', 'id'])->on($table);
        Schema::create('invoice_refund', function (Blueprint $t) use ($fk) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->uuid('invoice_id');
            $t->uuid('credit_note_id');               // the overpayment comes from this credit note
            $t->uuid('payment_id');                   // original payment refunded (never modified)
            $t->uuid('payment_account_id');           // = the original payment's account (checked by the API)
            $t->string('method', 10);                 // = account kind (tunai | qris | edc | transfer)
            $t->unsignedBigInteger('amount_rp');      // > 0; subtracted from payments once approved
            $t->string('reason', 500);                // admin text, no clinical narrative
            $t->foreignUuid('created_by')->constrained('users');
            $t->timestamp('created_at')->nullable();  // request time; refund date (reports) = approval time (billing_decision.created_at)
            $t->index(['tenant_id', 'invoice_id']);
            $t->index(['tenant_id', 'payment_id']);
            $t->index(['tenant_id', 'credit_note_id']);
            $fk($t, 'invoice_id', 'invoice');
            $fk($t, 'credit_note_id', 'credit_note', 'inv_refund_nk_fk');
            $fk($t, 'payment_id', 'invoice_payment', 'inv_refund_pay_fk');
            $fk($t, 'payment_account_id', 'payment_account', 'inv_refund_acc_fk');
            $t->foreign('tenant_id')->references('id')->on('tenant');
        });
        Schema::table('billing_decision', function (Blueprint $t) use ($fk) {
            $t->uuid('refund_id')->nullable()->after('line_correction_id');
            $t->unique(['tenant_id', 'refund_id']);
            $fk($t, 'refund_id', 'invoice_refund', 'billing_decision_refund_fk');
        });
    }

    public function down(): void
    {
        Schema::table('billing_decision', function (Blueprint $t) {
            $t->dropForeign('billing_decision_refund_fk');
            $t->dropUnique(['tenant_id', 'refund_id']);
            $t->dropColumn('refund_id');
        });
        Schema::dropIfExists('invoice_refund');
    }
};
