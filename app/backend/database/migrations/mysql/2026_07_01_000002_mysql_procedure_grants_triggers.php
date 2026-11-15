<?php

// Owning module: Clinical (procedure_record, procedure_definition). MySQL only.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// ehr_app: SELECT/INSERT/UPDATE, no DELETE. Final procedure rows are frozen like tooth_finding (drafts stay editable; discard = state).
// invoice_line keeps its grant + append-only triggers (they name no column, so the finding_id -> procedure_id rename needs nothing).
// PostgreSQL equivalent: same GRANTs + tenant RLS; BEFORE UPDATE trigger rejecting OLD.state = 'final', BEFORE DELETE reject_change().
return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection()->getDatabaseName();
        $grantee = sprintf("'%s'@'%s'", config('database.connections.mysql.username'), env('DB_APP_GRANT_HOST', '127.0.0.1'));
        foreach (['procedure_record', 'procedure_definition'] as $t) {
            DB::statement("GRANT SELECT, INSERT, UPDATE ON `$db`.`$t` TO $grantee");
        }
        DB::unprepared("CREATE TRIGGER procedure_record_no_update_final BEFORE UPDATE ON procedure_record FOR EACH ROW
             BEGIN
               IF OLD.state = 'final' THEN
                 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'tindakan final tidak boleh diubah; perubahan = baris baru';
               END IF;
             END");
        DB::unprepared("CREATE TRIGGER procedure_record_no_delete BEFORE DELETE ON procedure_record FOR EACH ROW
               SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'procedure_record tidak boleh dihapus'");
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS procedure_record_no_update_final');
        DB::unprepared('DROP TRIGGER IF EXISTS procedure_record_no_delete');
    }
};
