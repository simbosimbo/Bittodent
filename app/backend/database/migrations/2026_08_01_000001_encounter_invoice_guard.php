<?php

// Unit 4 (DEVIATIONS #50). Owning modules: Clinical (visit close/attendance columns), Billing (invoice_adjustment approval).
// Reasons are plaintext admin text like invoice_adjustment.reason (precedent; DPIA item): never put clinical content in them.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visit', function (Blueprint $t) {
            $t->uuid('closed_by')->nullable()->after('status');
            $t->string('close_reason', 500)->nullable()->after('closed_by');
            $t->boolean('closed_without_invoice')->default(false)->after('close_reason'); // owner report (unit 6)
            $t->dateTime('attendance_cancelled_at')->nullable()->after('closed_without_invoice'); // walk-in "batalkan kehadiran"
            $t->uuid('attendance_cancelled_by')->nullable()->after('attendance_cancelled_at');
            $t->string('attendance_cancel_reason', 500)->nullable()->after('attendance_cancelled_by');
        });
        // An adjustment that would bring the balance to Rp0 waits for an owner decision; it counts only once approved.
        Schema::table('invoice_adjustment', function (Blueprint $t) {
            $t->boolean('requires_approval')->default(false)->after('reason');
        });
        Schema::create('invoice_adjustment_decision', function (Blueprint $t) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->uuid('adjustment_id');
            $t->string('decision', 10); // approved | rejected
            $t->string('reason', 500)->nullable();
            $t->foreignUuid('decided_by')->constrained('users');
            $t->boolean('self_approved_sole_owner')->default(false); // owner approved own procedure, no other owner (unit 6 report)
            $t->timestamp('created_at')->nullable();
            $t->unique(['tenant_id', 'adjustment_id']); // decided once
            $t->foreign(['tenant_id', 'adjustment_id'])->references(['tenant_id', 'id'])->on('invoice_adjustment');
            $t->foreign('tenant_id')->references('id')->on('tenant');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_adjustment_decision');
        Schema::table('invoice_adjustment', fn (Blueprint $t) => $t->dropColumn('requires_approval'));
        Schema::table('visit', fn (Blueprint $t) => $t->dropColumn(['closed_by', 'close_reason', 'closed_without_invoice',
            'attendance_cancelled_at', 'attendance_cancelled_by', 'attendance_cancel_reason']));
    }
};
