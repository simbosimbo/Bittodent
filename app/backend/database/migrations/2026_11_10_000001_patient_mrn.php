<?php

// Owning module: Patients (patient.mrn + patient_mrn_seq). Spec: docs/database.md 3.2.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// No. RM format BT-000001: "BT-" + 6 zero-padded digits, sequential per tenant (not globally unique, no branch code).
// Allocated by App\Modules\Patients\Services\MrnGenerator (row lock on patient_mrn_seq); the unique index is the last defence.
// Nullable: a draft registration may lack an MRN; every patient created through the API/seeder gets one.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patient', function (Blueprint $t) {
            $t->string('mrn', 20)->nullable()->after('id'); // plaintext identifier (list + search), not encrypted
            $t->unique(['tenant_id', 'mrn']);
        });
        Schema::create('patient_mrn_seq', function (Blueprint $t) {
            $t->uuid('tenant_id')->primary();
            $t->unsignedInteger('next_n')->default(1);
            $t->timestamps();
            $t->foreign('tenant_id')->references('id')->on('tenant');
        });

        // Backfill existing rows per tenant in (created_at, id) order, then continue the counter at last+1.
        foreach (DB::table('patient')->distinct()->pluck('tenant_id') as $tenant) {
            $n = 0;
            foreach (DB::table('patient')->where('tenant_id', $tenant)->whereNull('mrn')->orderBy('created_at')->orderBy('id')->pluck('id') as $id) {
                DB::table('patient')->where('tenant_id', $tenant)->where('id', $id)->update(['mrn' => sprintf('BT-%06d', ++$n)]);
            }
            DB::table('patient_mrn_seq')->insert(['tenant_id' => $tenant, 'next_n' => $n + 1, 'created_at' => now(), 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_mrn_seq');
        Schema::table('patient', function (Blueprint $t) {
            $t->dropUnique(['tenant_id', 'mrn']);
            $t->dropColumn('mrn');
        });
    }
};
