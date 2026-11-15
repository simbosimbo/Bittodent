<?php

// Owning module: Clinical. MySQL only. Unit 3: the unit-2 trigger lists frozen columns explicitly, so the new reason/replaces_id
// columns must join that list (else a pending external could change them during its one-time confirmation update).
// Rule unchanged otherwise: a final row is frozen except pending -> confirmed/rejected confirmation columns.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const FROZEN = ['tenant_id', 'id', 'patient_id', 'visit_id', 'treat_area', 'tooth', 'surfaces', 'tooth_range', 'quadrant', 'arch',
        'status', 'procedure_code', 'variant', 'diagnosis_code', 'diagnosis_source', 'external_clinic_name', 'external_date',
        'external_date_precision', 'provider_id', 'state', 'source', 'supersedes_id', 'created_by', 'finalized_by', 'finalized_at', 'created_at'];

    public function up(): void
    {
        self::create([...self::FROZEN, 'reason', 'replaces_id']);
    }

    public function down(): void
    {
        self::create(self::FROZEN);
    }

    private static function create(array $frozen): void
    {
        $same = implode(' AND ', array_map(fn ($c) => "OLD.`$c` <=> NEW.`$c`", $frozen));
        DB::unprepared('DROP TRIGGER IF EXISTS procedure_record_no_update_final');
        DB::unprepared("CREATE TRIGGER procedure_record_no_update_final BEFORE UPDATE ON procedure_record FOR EACH ROW
             BEGIN
               IF OLD.state = 'final' AND NOT (OLD.external_confirmation = 'pending'
                    AND NEW.external_confirmation IN ('confirmed', 'rejected') AND $same) THEN
                 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'tindakan final tidak boleh diubah; perubahan = baris baru';
               END IF;
             END");
    }
};
