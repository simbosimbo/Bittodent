<?php

// Owning module: Billing (invoice_adjustment_decision). MySQL only. Append-only like invoice_adjustment.
// PostgreSQL: GRANT SELECT, INSERT + tenant RLS policy + reject_change() trigger.

use Database\Support\MysqlGrants;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        MysqlGrants::grant('SELECT, INSERT', 'invoice_adjustment_decision');
        foreach (['UPDATE', 'DELETE'] as $op) {
            DB::unprepared('CREATE TRIGGER invoice_adjustment_decision_no_'.strtolower($op)." BEFORE $op ON invoice_adjustment_decision FOR EACH ROW
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invoice_adjustment_decision hanya boleh ditambah'");
        }
    }

    public function down(): void {}
};
