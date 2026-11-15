<?php

// Owning module: Billing (unit B koreksi). MySQL only. Documents are append-only (grant SELECT, INSERT + triggers);
// credit_note_seq is the only mutable row (number counter, SELECT ... FOR UPDATE).
// PostgreSQL: GRANT SELECT, INSERT (seq: + UPDATE) + tenant RLS policy + reject_change() trigger.

use App\Shared\Database\MysqlGrants;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const APPEND_ONLY = ['credit_note', 'invoice_void', 'line_correction', 'billing_decision'];

    public function up(): void
    {
        MysqlGrants::grant('SELECT, INSERT, UPDATE', 'credit_note_seq');
        foreach (self::APPEND_ONLY as $t) {
            MysqlGrants::grant('SELECT, INSERT', $t);
            foreach (['UPDATE', 'DELETE'] as $op) {
                DB::unprepared("CREATE TRIGGER {$t}_no_".strtolower($op)." BEFORE $op ON $t FOR EACH ROW
                  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '$t hanya boleh ditambah'");
            }
        }
    }

    public function down(): void
    {
        foreach (self::APPEND_ONLY as $t) {
            DB::unprepared("DROP TRIGGER IF EXISTS {$t}_no_update");
            DB::unprepared("DROP TRIGGER IF EXISTS {$t}_no_delete");
        }
    }
};
