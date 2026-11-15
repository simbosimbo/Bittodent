<?php

// Owning module: Clinical. ICD-10 diagnosis per finding (official ICD10_2010 list, checked in FindingRequest), plaintext by D-020.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tooth_finding', function (Blueprint $t) {
            $t->string('diagnosis_code', 16)->nullable()->after('procedure_code');
            $t->string('diagnosis_source', 10)->nullable()->after('diagnosis_code'); // aturan | riwayat | manual | agen; null when no code
        });
    }

    public function down(): void
    {
        Schema::table('tooth_finding', fn (Blueprint $t) => $t->dropColumn(['diagnosis_code', 'diagnosis_source']));
    }
};
