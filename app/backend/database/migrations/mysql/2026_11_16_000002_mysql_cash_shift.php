<?php

// Owning module: Billing (cash_shift). MySQL only.
// PostgreSQL: GRANT SELECT, INSERT, UPDATE + trigger rejecting UPDATE of a closed row and any DELETE; tenant RLS.

use Database\Support\MysqlGrants;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        MysqlGrants::grant('SELECT, INSERT, UPDATE', 'cash_shift'); // the single UPDATE is the close
        DB::unprepared("CREATE TRIGGER cash_shift_no_delete BEFORE DELETE ON cash_shift FOR EACH ROW
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'cash_shift tidak dihapus'");
        DB::unprepared("CREATE TRIGGER cash_shift_closed_frozen BEFORE UPDATE ON cash_shift FOR EACH ROW
          BEGIN IF OLD.closed_at IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'shift sudah ditutup'; END IF; END");
    }

    public function down(): void {}
};
