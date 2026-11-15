<?php

// Unit 5 (DEVIATIONS #51). Owning module: Billing. Payments go only to clinic-owned accounts (Yohanes, 15 Nov 2026: pencegahan
// undertable). There is deliberately NO column for a destination account / nomor rekening typed at pay time.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $fk = fn (Blueprint $t, string $col, string $table) => $t->foreign(['tenant_id', $col])->references(['tenant_id', 'id'])->on($table);
        // Clinic master data, owner only. Never deleted: deactivated (is_active). kind/branch/bank are fixed after creation.
        Schema::create('payment_account', function (Blueprint $t) use ($fk) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->uuid('branch_id')->nullable(); // NULL = every branch of the tenant
            $t->string('name', 100);
            $t->string('kind', 10);            // tunai | qris | edc | transfer (board screens 22-23)
            $t->string('bank_name', 60)->nullable();
            $t->char('account_last4', 4)->nullable(); // last 4 digits only; the full number is never stored
            $t->boolean('is_active')->default(true);
            $t->foreignUuid('created_by')->constrained('users');
            $t->timestamps();
            $t->index(['tenant_id', 'branch_id']);
            $fk($t, 'branch_id', 'branch');
            $t->foreign('tenant_id')->references('id')->on('tenant');
        });
        // Append-only. Sum of payments is subtracted from the invoice balance (computed, never stored).
        Schema::create('invoice_payment', function (Blueprint $t) use ($fk) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->uuid('invoice_id');
            $t->uuid('payment_account_id');
            $t->unsignedBigInteger('amount_rp');
            $t->uuid('request_key')->nullable(); // optional client key: a resend returns the stored payment instead of paying twice
            $t->foreignUuid('created_by')->constrained('users');
            $t->timestamp('paid_at');
            $t->timestamp('created_at')->nullable();
            $t->index(['tenant_id', 'invoice_id']);
            $t->index(['tenant_id', 'payment_account_id']);
            $t->unique(['tenant_id', 'request_key']);
            $fk($t, 'invoice_id', 'invoice');
            $fk($t, 'payment_account_id', 'payment_account');
            $t->foreign('tenant_id')->references('id')->on('tenant');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_payment');
        Schema::dropIfExists('payment_account');
    }
};
