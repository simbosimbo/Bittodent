<?php

// Owning module: Billing. Board KL06 (design/kasir-laporan@b4c5bee): a cashier's shift per branch. Open = opening cash; close = counted
// cash + recap per method/bank snapshot. A difference needs a reason; the cashier closes alone (no owner approval). Closed = frozen (trigger).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_shift', function (Blueprint $t) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->uuid('branch_id');
            $t->foreignUuid('user_id')->constrained('users');
            $t->unsignedBigInteger('opening_cash_rp');
            $t->timestamp('opened_at');
            $t->timestamp('closed_at')->nullable();
            $t->unsignedBigInteger('expected_cash_rp')->nullable(); // opening + cash received, at close
            $t->unsignedBigInteger('counted_cash_rp')->nullable();
            $t->bigInteger('difference_rp')->nullable();             // counted - expected (negative = short)
            $t->string('reason', 500)->nullable();                   // required when difference != 0
            $t->json('summary')->nullable();                         // per method + bank at close (amounts only)
            $t->timestamps();
            $t->index(['tenant_id', 'branch_id', 'user_id', 'closed_at']);
            $t->foreign(['tenant_id', 'branch_id'])->references(['tenant_id', 'id'])->on('branch');
            $t->foreign('tenant_id')->references('id')->on('tenant');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_shift');
    }
};
