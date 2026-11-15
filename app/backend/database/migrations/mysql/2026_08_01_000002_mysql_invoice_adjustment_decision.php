<?php

// Owning module: Billing (invoice_adjustment_decision). MySQL only. Append-only like invoice_adjustment.
// PostgreSQL: GRANT SELECT, INSERT + tenant RLS policy + reject_change() trigger.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection()->getDatabaseName();
        $grantee = sprintf("'%s'@'%s'", config('database.connections.mysql.username'), env('DB_APP_GRANT_HOST', '127.0.0.1'));
        DB::statement("GRANT SELECT, INSERT ON `$db`.`invoice_adjustment_decision` TO $grantee");
        foreach (['UPDATE', 'DELETE'] as $op) {
            DB::unprepared('CREATE TRIGGER invoice_adjustment_decision_no_'.strtolower($op)." BEFORE $op ON invoice_adjustment_decision FOR EACH ROW
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invoice_adjustment_decision hanya boleh ditambah'");
        }
    }

    public function down(): void {}
};
