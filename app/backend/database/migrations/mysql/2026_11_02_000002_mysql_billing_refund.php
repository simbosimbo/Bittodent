<?php

// Owning module: Billing (unit C koreksi). MySQL only. invoice_refund is append-only (grant SELECT, INSERT + triggers).
// PostgreSQL: GRANT SELECT, INSERT + tenant RLS policy + reject_change() trigger.

use App\Shared\Database\MysqlGrants;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        MysqlGrants::grant('SELECT, INSERT', 'invoice_refund');
        foreach (['UPDATE', 'DELETE'] as $op) {
            DB::unprepared('CREATE TRIGGER invoice_refund_no_'.strtolower($op)." BEFORE $op ON invoice_refund FOR EACH ROW
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invoice_refund hanya boleh ditambah'");
        }
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS invoice_refund_no_update');
        DB::unprepared('DROP TRIGGER IF EXISTS invoice_refund_no_delete');
    }
};
