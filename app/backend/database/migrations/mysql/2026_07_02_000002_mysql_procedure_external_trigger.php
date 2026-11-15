<?php

// Owning module: Clinical. MySQL only. Unit 2: a FINAL external row waiting for confirmation may change ONLY its confirmation
// columns, once, from `pending` to `confirmed`/`rejected`. Every other final update is still refused (append-only).
// The table grant (SELECT, INSERT, UPDATE; no DELETE) from 2026_07_01_000002 covers the new columns.
// PostgreSQL equivalent: same rule in the BEFORE UPDATE trigger function (compare OLD/NEW with IS DISTINCT FROM).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // every column except the four confirmation columns and updated_at
    private const FROZEN = ['tenant_id', 'id', 'patient_id', 'visit_id', 'treat_area', 'tooth', 'surfaces', 'tooth_range', 'quadrant', 'arch',
        'status', 'procedure_code', 'variant', 'diagnosis_code', 'diagnosis_source', 'external_clinic_name', 'external_date',
        'external_date_precision', 'provider_id', 'state', 'source', 'supersedes_id', 'created_by', 'finalized_by', 'finalized_at', 'created_at'];

    public function up(): void
    {
        $same = implode(' AND ', array_map(fn ($c) => "OLD.`$c` <=> NEW.`$c`", self::FROZEN));
        DB::unprepared('DROP TRIGGER IF EXISTS procedure_record_no_update_final');
        DB::unprepared("CREATE TRIGGER procedure_record_no_update_final BEFORE UPDATE ON procedure_record FOR EACH ROW
             BEGIN
               IF OLD.state = 'final' AND NOT (OLD.external_confirmation = 'pending'
                    AND NEW.external_confirmation IN ('confirmed', 'rejected') AND $same) THEN
                 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'tindakan final tidak boleh diubah; perubahan = baris baru';
               END IF;
             END");
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS procedure_record_no_update_final');
        DB::unprepared("CREATE TRIGGER procedure_record_no_update_final BEFORE UPDATE ON procedure_record FOR EACH ROW
             BEGIN
               IF OLD.state = 'final' THEN
                 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'tindakan final tidak boleh diubah; perubahan = baris baru';
               END IF;
             END");
    }
};
