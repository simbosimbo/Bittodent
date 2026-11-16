<?php

// Owning module: Billing. KlinikMe-style No. Faktur: every invoice gets INV-YYYY-000001, sequential per tenant and year (year of
// creation), from invoice_seq (same pattern as credit_note_seq). Invoices are never deleted (void keeps its row), so no gaps.
// Existing invoices are numbered here in creation order.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoice_seq', function (Blueprint $t) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->foreign('tenant_id')->references('id')->on('tenant');
            $t->unsignedSmallInteger('year');
            $t->unsignedInteger('last_number')->default(0);
            $t->unique(['tenant_id', 'year']);
        });
        Schema::table('invoice', function (Blueprint $t) {
            $t->string('number', 20)->nullable()->after('id');
            $t->unique(['tenant_id', 'number']);
        });

        $last = [];
        foreach (DB::table('invoice')->orderBy('tenant_id')->orderBy('created_at')->orderBy('id')->get(['tenant_id', 'id', 'created_at']) as $inv) {
            $year = (int) substr((string) $inv->created_at, 0, 4);
            $n = $last[$inv->tenant_id][$year] = ($last[$inv->tenant_id][$year] ?? 0) + 1;
            DB::table('invoice')->where('tenant_id', $inv->tenant_id)->where('id', $inv->id)->update(['number' => sprintf('INV-%d-%06d', $year, $n)]);
        }
        foreach ($last as $tenant => $years) {
            foreach ($years as $year => $n) {
                DB::table('invoice_seq')->insert(['tenant_id' => $tenant, 'id' => (string) Str::uuid7(), 'year' => $year, 'last_number' => $n]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('invoice', function (Blueprint $t) {
            $t->dropUnique(['tenant_id', 'number']);
            $t->dropColumn('number');
        });
        Schema::dropIfExists('invoice_seq');
    }
};
