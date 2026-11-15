<?php

// Owning module: Clinical (coding_rule, coding_preference). MySQL only.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// ehr_app: SELECT/INSERT/UPDATE; no DELETE (a rule is switched off with active = 0, preferences only grow).
// PostgreSQL equivalent: same GRANTs + tenant RLS policy like every tenant table.
return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection()->getDatabaseName();
        $grantee = sprintf("'%s'@'%s'", config('database.connections.mysql.username'), env('DB_APP_GRANT_HOST', '127.0.0.1'));
        foreach (['coding_rule', 'coding_preference'] as $table) {
            DB::statement("GRANT SELECT, INSERT, UPDATE ON `$db`.`$table` TO $grantee");
        }
    }

    public function down(): void {}
};
