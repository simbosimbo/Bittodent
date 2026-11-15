<?php

// Owning module: Scribe. MySQL only. ehr_app: SELECT/INSERT/UPDATE, no DELETE (audio wipe nulls columns / unlinks the file).

use Database\Support\MysqlGrants;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        MysqlGrants::grant('SELECT, INSERT, UPDATE', 'clinic_ai_setting', 'scribe_session');
        DB::unprepared("CREATE TRIGGER scribe_session_no_delete BEFORE DELETE ON scribe_session FOR EACH ROW
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'scribe_session tidak dihapus; audio dikosongkan'");
        DB::unprepared("CREATE TRIGGER clinic_ai_setting_no_delete BEFORE DELETE ON clinic_ai_setting FOR EACH ROW
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'clinic_ai_setting tidak dihapus'");
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS scribe_session_no_delete');
        DB::unprepared('DROP TRIGGER IF EXISTS clinic_ai_setting_no_delete');
    }
};
