<?php

// Owning modules: Clinical (tooth_baseline, consent_record), Patients (household, guardian, medical_history_version),
// Scheduling (planned_appointment), Recall (reminder_log), Tariffs (tariff), Billing (invoice*). MySQL only.

use Database\Support\MysqlGrants;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// ehr_app: SELECT/INSERT/UPDATE on mutable tables, SELECT/INSERT only on append-only tables (no DELETE anywhere).
// Triggers reject UPDATE/DELETE on append-only tables even for ehr_admin.
// PostgreSQL equivalent: GRANT SELECT, INSERT[, UPDATE] ... TO ehr_app; ENABLE + FORCE RLS on tenant_id;
// BEFORE UPDATE OR DELETE trigger reject_change() + BEFORE TRUNCATE reject_truncate() on the append-only tables.
return new class extends Migration
{
    private const READ_WRITE = ['household', 'guardian', 'planned_appointment', 'tariff', 'invoice'];

    private const APPEND_ONLY = ['tooth_baseline', 'consent_record', 'medical_history_version', 'reminder_log', 'invoice_line', 'invoice_adjustment'];

    public function up(): void
    {
        foreach (self::READ_WRITE as $t) {
            MysqlGrants::grant('SELECT, INSERT, UPDATE', $t);
        }
        foreach (self::APPEND_ONLY as $t) {
            MysqlGrants::grant('SELECT, INSERT', $t);
            foreach (['UPDATE', 'DELETE'] as $op) {
                DB::unprepared("CREATE TRIGGER {$t}_no_".strtolower($op)." BEFORE $op ON $t FOR EACH ROW
                  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '$t hanya boleh ditambah'");
            }
        }
    }

    public function down(): void {}
};
