<?php

// Owning module: Billing (payment_account, invoice_payment). MySQL only.
// PostgreSQL: GRANT SELECT, INSERT, UPDATE on payment_account; GRANT SELECT, INSERT + reject_change() trigger on invoice_payment; tenant RLS.

use Database\Support\MysqlGrants;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        MysqlGrants::grant('SELECT, INSERT, UPDATE', 'payment_account'); // deactivate, never DELETE
        MysqlGrants::grant('SELECT, INSERT', 'invoice_payment');
        foreach (['UPDATE', 'DELETE'] as $op) {
            DB::unprepared('CREATE TRIGGER invoice_payment_no_'.strtolower($op)." BEFORE $op ON invoice_payment FOR EACH ROW
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invoice_payment hanya boleh ditambah'");
        }
        DB::unprepared("CREATE TRIGGER payment_account_no_delete BEFORE DELETE ON payment_account FOR EACH ROW
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'payment_account dinonaktifkan, tidak dihapus'");
    }

    public function down(): void {}
};
