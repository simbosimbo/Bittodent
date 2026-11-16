<?php

// Owning module: Billing. invoice_seq is a mutable counter (SELECT ... FOR UPDATE). An invoice number, once given, never changes.
// PostgreSQL: GRANT SELECT, INSERT, UPDATE on invoice_seq + tenant RLS policy + the same trigger.

use Database\Support\MysqlGrants;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        MysqlGrants::grant('SELECT, INSERT, UPDATE', 'invoice_seq');
        DB::unprepared("CREATE TRIGGER invoice_number_fixed BEFORE UPDATE ON invoice FOR EACH ROW
          IF OLD.number IS NOT NULL AND NOT (NEW.number <=> OLD.number) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'nomor tagihan tidak boleh diubah';
          END IF");
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS invoice_number_fixed');
    }
};
