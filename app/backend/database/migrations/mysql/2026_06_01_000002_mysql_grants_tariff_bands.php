<?php

// Owning modules: Tariffs (tariff_rate), Tenancy (dentist_profile). MySQL only.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// ehr_app: SELECT/INSERT/UPDATE, no DELETE (a price cell is cleared by closing it: valid_to). invoice_line keeps its existing grant + triggers.
// PostgreSQL equivalent: same GRANTs + tenant RLS policy like every tenant table.
return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection()->getDatabaseName();
        $grantee = sprintf("'%s'@'%s'", config('database.connections.mysql.username'), env('DB_APP_GRANT_HOST', '127.0.0.1'));
        foreach (['tariff_rate', 'dentist_profile'] as $table) {
            DB::statement("GRANT SELECT, INSERT, UPDATE ON `$db`.`$table` TO $grantee");
        }
    }

    public function down(): void {}
};
