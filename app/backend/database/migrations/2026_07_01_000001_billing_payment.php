<?php

// Owning module: Billing (payment). Cash collected against an invoice; append-only (grants + triggers in mysql/2026_07_01_000002).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment', function (Blueprint $t) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->foreign('tenant_id')->references('id')->on('tenant');
            $t->uuid('invoice_id');
            $t->uuid('branch_id');                // copied from the invoice at insert (daily KPI needs no join)
            $t->unsignedBigInteger('amount_rp');  // > 0, checked in Billing\Services\PaymentService
            $t->string('method', 10);             // tunai | transfer | kartu | qris
            $t->dateTime('paid_at');              // UTC
            $t->foreignUuid('created_by')->constrained('users');
            $t->timestamp('created_at')->nullable();
            $t->index(['tenant_id', 'invoice_id']);
            $t->index(['tenant_id', 'branch_id', 'paid_at']); // daily revenue per branch
            $t->foreign(['tenant_id', 'invoice_id'])->references(['tenant_id', 'id'])->on('invoice');
            $t->foreign(['tenant_id', 'branch_id'])->references(['tenant_id', 'id'])->on('branch');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment');
    }
};
