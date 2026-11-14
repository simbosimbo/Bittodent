<?php

// Owning module: Billing (payment). MySQL only.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// ehr_app: SELECT, INSERT only (append-only). Triggers reject UPDATE/DELETE even for ehr_admin.
// PostgreSQL equivalent: GRANT SELECT, INSERT + RLS on tenant_id + reject_change()/reject_truncate() triggers.
return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection()->getDatabaseName();
        $grantee = sprintf("'%s'@'%s'", config('database.connections.mysql.username'), env('DB_APP_GRANT_HOST', '127.0.0.1'));
        DB::statement("GRANT SELECT, INSERT ON `$db`.`payment` TO $grantee");
        foreach (['UPDATE', 'DELETE'] as $op) {
            DB::unprepared('CREATE TRIGGER payment_no_'.strtolower($op)." BEFORE $op ON payment FOR EACH ROW
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'payment hanya boleh ditambah'");
        }
    }

    public function down(): void {}
};
