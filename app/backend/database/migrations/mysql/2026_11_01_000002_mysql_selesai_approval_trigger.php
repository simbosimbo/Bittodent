<?php

// Owning module: Clinical. MySQL only. Selesai (#54): approved_by/approved_at join the frozen list of the procedure_record trigger
// (same reason as unit 3: the one-time external confirmation update must not be able to change them on a final row).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const FROZEN = ['tenant_id', 'id', 'patient_id', 'visit_id', 'treat_area', 'tooth', 'surfaces', 'tooth_range', 'quadrant', 'arch',
        'status', 'procedure_code', 'variant', 'diagnosis_code', 'diagnosis_source', 'external_clinic_name', 'external_date',
        'external_date_precision', 'provider_id', 'state', 'source', 'supersedes_id', 'created_by', 'finalized_by', 'finalized_at', 'created_at',
        'reason', 'replaces_id'];

    public function up(): void
    {
        self::create([...self::FROZEN, 'approved_by', 'approved_at']);
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
