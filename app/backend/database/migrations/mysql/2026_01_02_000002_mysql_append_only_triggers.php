<?php

// Owning module: Clinical (clinical_note*, tooth_finding) + Shared\Audit (audit_event, auth_event).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// MySQL only. Append-only rules enforced by the database, even for ehr_admin (grants alone would not stop the owner).
// PostgreSQL equivalent: postgres-target/0002 plpgsql triggers clinical_note_version_guard, reject_change()
// (clinical_note, audit_event, auth_event) and BEFORE TRUNCATE reject_truncate(); there they RAISE EXCEPTION
// with ERRCODE insufficient_privilege, here SIGNAL SQLSTATE '45000'.
return new class extends Migration
{
    public function up(): void
    {
        $sql = [
            "CREATE TRIGGER cnv_no_update_signed BEFORE UPDATE ON clinical_note_version FOR EACH ROW
             BEGIN
               IF OLD.state = 'signed' OR OLD.signed_at IS NOT NULL THEN
                 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'versi sudah ditandatangani; koreksi = versi baru';
               END IF;
             END",
            "CREATE TRIGGER cnv_no_delete BEFORE DELETE ON clinical_note_version FOR EACH ROW
               SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'clinical_note_version tidak boleh dihapus'",
            "CREATE TRIGGER clinical_note_no_delete BEFORE DELETE ON clinical_note FOR EACH ROW
               SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'clinical_note tidak boleh dihapus'",
            "CREATE TRIGGER tooth_finding_no_update_final BEFORE UPDATE ON tooth_finding FOR EACH ROW
             BEGIN
               IF OLD.state = 'final' THEN
                 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'temuan final tidak boleh diubah; koreksi = baris baru';
               END IF;
             END",
            "CREATE TRIGGER tooth_finding_no_delete BEFORE DELETE ON tooth_finding FOR EACH ROW
               SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'tooth_finding tidak boleh dihapus'",
        ];
        foreach (['audit_event', 'auth_event'] as $t) {
            foreach (['UPDATE', 'DELETE'] as $op) {
                $sql[] = "CREATE TRIGGER {$t}_no_".strtolower($op)." BEFORE $op ON $t FOR EACH ROW
                  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '$t hanya boleh ditambah'";
            }
        }
        foreach ($sql as $s) {
            DB::unprepared($s);
        }
    }

    public function down(): void {}
};
