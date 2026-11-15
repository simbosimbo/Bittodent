<?php

// Owning module: Shared\Terminology (icd10_codes, icd9cm_codes). MySQL only.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// ehr_app: SELECT only (read-only global reference); icd:import writes as ehr_admin (mysql_admin).
// PostgreSQL equivalent: GRANT SELECT ON icd10_codes, icd9cm_codes TO ehr_app (global table, no RLS policy).
return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection()->getDatabaseName();
        $grantee = sprintf("'%s'@'%s'", config('database.connections.mysql.username'), env('DB_APP_GRANT_HOST', '127.0.0.1'));
        foreach (['icd10_codes', 'icd9cm_codes'] as $table) {
            DB::statement("GRANT SELECT ON `$db`.`$table` TO $grantee");
        }
    }

    public function down(): void {}
};
