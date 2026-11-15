<?php

// Owning module: Clinical (procedure_correction, procedure_correction_decision). MySQL only. Append-only like invoice_adjustment_decision.
// PostgreSQL: GRANT SELECT, INSERT + tenant RLS policy + reject_change() trigger.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const TABLES = ['procedure_correction', 'procedure_correction_decision'];

    public function up(): void
    {
        $db = DB::connection()->getDatabaseName();
        $grantee = sprintf("'%s'@'%s'", config('database.connections.mysql.username'), env('DB_APP_GRANT_HOST', '127.0.0.1'));
        foreach (self::TABLES as $t) {
            DB::statement("GRANT SELECT, INSERT ON `$db`.`$t` TO $grantee");
            foreach (['UPDATE', 'DELETE'] as $op) {
                DB::unprepared("CREATE TRIGGER {$t}_no_".strtolower($op)." BEFORE $op ON $t FOR EACH ROW
                  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '$t hanya boleh ditambah'");
            }
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $t) {
            DB::unprepared("DROP TRIGGER IF EXISTS {$t}_no_update");
            DB::unprepared("DROP TRIGGER IF EXISTS {$t}_no_delete");
        }
    }
};
