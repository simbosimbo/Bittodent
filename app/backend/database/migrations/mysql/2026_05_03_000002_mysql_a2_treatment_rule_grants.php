<?php

// Owning module: TreatmentSuggestions (treatment_rule). MySQL only. Append-only: ehr_app SELECT/INSERT; UPDATE/DELETE refused by
// triggers (also for ehr_admin). PostgreSQL equivalent: same GRANT; plpgsql BEFORE UPDATE/DELETE guards.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection()->getDatabaseName();
        $grantee = sprintf("'%s'@'%s'", config('database.connections.mysql.username'), env('DB_APP_GRANT_HOST', '127.0.0.1'));
        DB::statement("GRANT SELECT, INSERT ON `$db`.`treatment_rule` TO $grantee");
        DB::unprepared("CREATE TRIGGER treatment_rule_no_update BEFORE UPDATE ON treatment_rule FOR EACH ROW
             SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'aturan saran berversi; buat versi baru'");
        DB::unprepared("CREATE TRIGGER treatment_rule_no_delete BEFORE DELETE ON treatment_rule FOR EACH ROW
             SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'aturan saran tidak boleh dihapus; nonaktifkan dengan versi baru'");
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS treatment_rule_no_update');
        DB::unprepared('DROP TRIGGER IF EXISTS treatment_rule_no_delete');
    }
};
