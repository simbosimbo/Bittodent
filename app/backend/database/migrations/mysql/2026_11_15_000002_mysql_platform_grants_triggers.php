<?php

// Owning module: Platform + Shared\Audit (DEVIATIONS #61). MySQL only.
// platform_audit_log: append-only (grant SELECT, INSERT + triggers). platform_impersonation: only the one-time end (ended_at,
// end_reason) may be written, every other column is frozen; no delete. PostgreSQL: same grants + reject_change() triggers.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection()->getDatabaseName();
        $grantee = sprintf("'%s'@'%s'", config('database.connections.mysql.username'), env('DB_APP_GRANT_HOST', '127.0.0.1'));
        DB::statement("GRANT SELECT, INSERT, UPDATE ON `$db`.`platform_admins` TO $grantee");
        DB::statement("GRANT SELECT, INSERT, UPDATE ON `$db`.`platform_impersonation` TO $grantee");
        DB::statement("GRANT SELECT, INSERT ON `$db`.`platform_audit_log` TO $grantee");
        foreach (['UPDATE', 'DELETE'] as $op) {
            DB::unprepared('CREATE TRIGGER platform_audit_log_no_'.strtolower($op)." BEFORE $op ON platform_audit_log FOR EACH ROW
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'platform_audit_log hanya boleh ditambah'");
        }
        DB::unprepared("CREATE TRIGGER platform_impersonation_no_delete BEFORE DELETE ON platform_impersonation FOR EACH ROW
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'platform_impersonation tidak boleh dihapus'");
        $same = implode(' AND ', array_map(fn ($c) => "OLD.`$c` <=> NEW.`$c`",
            ['id', 'platform_admin_id', 'target_tenant_id', 'target_user_id', 'started_at']));
        DB::unprepared("CREATE TRIGGER platform_impersonation_end_once BEFORE UPDATE ON platform_impersonation FOR EACH ROW
             BEGIN
               IF OLD.ended_at IS NOT NULL OR NOT ($same) THEN
                 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'impersonasi hanya boleh diakhiri sekali';
               END IF;
             END");
    }

    public function down(): void
    {
        foreach (['platform_audit_log_no_update', 'platform_audit_log_no_delete', 'platform_impersonation_no_delete', 'platform_impersonation_end_once'] as $t) {
            DB::unprepared("DROP TRIGGER IF EXISTS $t");
        }
    }
};
