<?php

// Owning module: Prescriptions (prescription, prescription_item, prescription_void). MySQL only.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// ehr_app: SELECT/INSERT/UPDATE on prescription + items (drafts are editable), SELECT/INSERT on prescription_void; no DELETE.
// Triggers (even for ehr_admin): a signed prescription and its items never change, nothing is deleted, void rows are append-only.
// PostgreSQL equivalent: GRANTs as above; plpgsql BEFORE UPDATE/DELETE trigger prescription_guard (OLD.state <> 'draft' => RAISE),
// prescription_item_guard (parent state <> 'draft' => RAISE, also on INSERT), reject_change() on prescription_void, BEFORE TRUNCATE reject_truncate().
return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection()->getDatabaseName();
        $grantee = sprintf("'%s'@'%s'", config('database.connections.mysql.username'), env('DB_APP_GRANT_HOST', '127.0.0.1'));
        DB::statement("GRANT SELECT, INSERT, UPDATE ON `$db`.`prescription` TO $grantee");
        DB::statement("GRANT SELECT, INSERT, UPDATE ON `$db`.`prescription_item` TO $grantee");
        DB::statement("GRANT SELECT, INSERT ON `$db`.`prescription_void` TO $grantee");

        $parentNotDraft = fn (string $row) => "(SELECT state FROM prescription p WHERE p.tenant_id = $row.tenant_id AND p.id = $row.prescription_id) <> 'draft'";
        $sql = [
            "CREATE TRIGGER prescription_no_update_signed BEFORE UPDATE ON prescription FOR EACH ROW
             BEGIN
               IF OLD.state <> 'draft' THEN
                 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'resep sudah dikunci; koreksi = batal + terbit ulang';
               END IF;
             END",
            "CREATE TRIGGER prescription_item_no_insert_signed BEFORE INSERT ON prescription_item FOR EACH ROW
             BEGIN
               IF {$parentNotDraft('NEW')} THEN
                 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'resep sudah dikunci';
               END IF;
             END",
            "CREATE TRIGGER prescription_item_no_update_signed BEFORE UPDATE ON prescription_item FOR EACH ROW
             BEGIN
               IF {$parentNotDraft('OLD')} OR {$parentNotDraft('NEW')} THEN
                 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'resep sudah dikunci';
               END IF;
             END",
        ];
        foreach (['prescription', 'prescription_item', 'prescription_void'] as $t) {
            $sql[] = "CREATE TRIGGER {$t}_no_delete BEFORE DELETE ON $t FOR EACH ROW
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '$t tidak boleh dihapus'";
        }
        $sql[] = "CREATE TRIGGER prescription_void_no_update BEFORE UPDATE ON prescription_void FOR EACH ROW
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'prescription_void hanya boleh ditambah'";
        foreach ($sql as $s) {
            DB::unprepared($s);
        }
    }

    public function down(): void {}
};
