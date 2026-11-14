<?php

// Owning module: Patients (patient_mrn_seq). MySQL only.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// ehr_app: SELECT/INSERT/UPDATE on the MRN counter (no DELETE). PostgreSQL equivalent: GRANT SELECT, INSERT, UPDATE + RLS on tenant_id.
return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection()->getDatabaseName();
        $grantee = sprintf("'%s'@'%s'", config('database.connections.mysql.username'), env('DB_APP_GRANT_HOST', '127.0.0.1'));
        DB::statement("GRANT SELECT, INSERT, UPDATE ON `$db`.`patient_mrn_seq` TO $grantee");
    }

    public function down(): void {}
};
