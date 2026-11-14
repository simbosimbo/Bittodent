<?php

// Owning module: Clinical (correction_request). MySQL only.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// ehr_app: SELECT/INSERT/UPDATE (no DELETE) on correction_request, same as the other clinical tables.
// PostgreSQL equivalent: GRANT SELECT, INSERT, UPDATE ON correction_request TO ehr_app + ENABLE/FORCE RLS policy on tenant_id.
return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection()->getDatabaseName();
        $grantee = sprintf("'%s'@'%s'", config('database.connections.mysql.username'), env('DB_APP_GRANT_HOST', '127.0.0.1'));
        DB::statement("GRANT SELECT, INSERT, UPDATE ON `$db`.`correction_request` TO $grantee");
    }

    public function down(): void {}
};
