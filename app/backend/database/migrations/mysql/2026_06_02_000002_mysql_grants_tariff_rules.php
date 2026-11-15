<?php

// Owning module: Tariffs (tariff_rule). MySQL only.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// ehr_app: SELECT/INSERT/UPDATE, no DELETE (a rule is switched off with enabled = false). PostgreSQL: same GRANT + tenant RLS policy.
return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection()->getDatabaseName();
        $grantee = sprintf("'%s'@'%s'", config('database.connections.mysql.username'), env('DB_APP_GRANT_HOST', '127.0.0.1'));
        DB::statement("GRANT SELECT, INSERT, UPDATE ON `$db`.`tariff_rule` TO $grantee");
    }

    public function down(): void {}
};
