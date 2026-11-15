<?php

// Owning module: Billing (payment_account, invoice_payment). MySQL only.
// PostgreSQL: GRANT SELECT, INSERT, UPDATE on payment_account; GRANT SELECT, INSERT + reject_change() trigger on invoice_payment; tenant RLS.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection()->getDatabaseName();
        $grantee = sprintf("'%s'@'%s'", config('database.connections.mysql.username'), env('DB_APP_GRANT_HOST', '127.0.0.1'));
        DB::statement("GRANT SELECT, INSERT, UPDATE ON `$db`.`payment_account` TO $grantee"); // deactivate, never DELETE
        DB::statement("GRANT SELECT, INSERT ON `$db`.`invoice_payment` TO $grantee");
        foreach (['UPDATE', 'DELETE'] as $op) {
            DB::unprepared('CREATE TRIGGER invoice_payment_no_'.strtolower($op)." BEFORE $op ON invoice_payment FOR EACH ROW
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invoice_payment hanya boleh ditambah'");
        }
        DB::unprepared("CREATE TRIGGER payment_account_no_delete BEFORE DELETE ON payment_account FOR EACH ROW
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'payment_account dinonaktifkan, tidak dihapus'");
    }

    public function down(): void {}
};
