<?php

// Owning module: Ktp (clinic_ai_setting, ktp_photo, patient_ktp). MySQL only.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// ehr_app: SELECT/INSERT/UPDATE, no DELETE. Triggers (even for ehr_admin): never deleted, tenant_id never changes.
// PostgreSQL equivalent: same GRANTs; ENABLE + FORCE RLS on tenant_id; BEFORE UPDATE/DELETE guards, BEFORE TRUNCATE reject_truncate().
return new class extends Migration
{
    private const TABLES = ['clinic_ai_setting', 'ktp_photo', 'patient_ktp'];

    public function up(): void
    {
        $db = DB::connection()->getDatabaseName();
        $grantee = sprintf("'%s'@'%s'", config('database.connections.mysql.username'), env('DB_APP_GRANT_HOST', '127.0.0.1'));
        foreach (self::TABLES as $t) {
            DB::statement("GRANT SELECT, INSERT, UPDATE ON `$db`.`$t` TO $grantee");
            DB::unprepared("CREATE TRIGGER {$t}_no_delete BEFORE DELETE ON $t FOR EACH ROW
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '$t tidak boleh dihapus'");
            DB::unprepared("CREATE TRIGGER {$t}_tenant_fixed BEFORE UPDATE ON $t FOR EACH ROW
              BEGIN
                IF NEW.tenant_id <> OLD.tenant_id THEN
                  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'tenant_id tidak boleh diubah';
                END IF;
              END");
        }
    }

    public function down(): void {}
};
