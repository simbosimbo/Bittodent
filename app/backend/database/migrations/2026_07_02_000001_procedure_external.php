<?php

// Owning module: Clinical. Unit 2 (DEVIATIONS #48): status ada_di_tempat_lain (`external`) carries the other clinic's name, an
// approximate date (+ precision day|month|year) and, when entered on a visit that already has `selesai` work that day, a
// confirmation by front desk / assistant (procedure.confirm_external). All columns null for every other status.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('procedure_record', function (Blueprint $t) {
            $t->string('external_clinic_name', 120)->nullable()->after('diagnosis_source');
            $t->date('external_date')->nullable()->after('external_clinic_name');        // first day of month/year when coarser
            $t->string('external_date_precision', 5)->nullable()->after('external_date'); // day | month | year
            $t->string('external_confirmation', 12)->nullable()->after('external_date_precision'); // not_required | pending | confirmed | rejected
            $t->foreignUuid('external_confirmed_by')->nullable()->after('external_confirmation')->constrained('users');
            $t->dateTime('external_confirmed_at')->nullable()->after('external_confirmed_by');
            $t->string('external_confirmation_reason', 300)->nullable()->after('external_confirmed_at'); // administrative, not clinical text
            $t->index(['tenant_id', 'external_confirmation']);
        });
    }

    public function down(): void
    {
        Schema::table('procedure_record', function (Blueprint $t) {
            $t->dropIndex(['tenant_id', 'external_confirmation']);
            $t->dropConstrainedForeignId('external_confirmed_by');
            $t->dropColumn(['external_clinic_name', 'external_date', 'external_date_precision', 'external_confirmation',
                'external_confirmed_at', 'external_confirmation_reason']);
        });
    }
};
