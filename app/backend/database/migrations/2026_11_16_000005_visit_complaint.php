<?php

// Owning module: Clinical (visit). Audit P1-1: the patient's complaint (keluhan) becomes part of the medical record. Free clinical
// text: encrypted per column (Crypto), never logged. Filled from the appointment (check-in / online booking) or the walk-in form.
// Grants: visit already has SELECT, INSERT, UPDATE.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visit', fn (Blueprint $t) => $t->text('complaint_enc')->nullable());
    }

    public function down(): void
    {
        Schema::table('visit', fn (Blueprint $t) => $t->dropColumn('complaint_enc'));
    }
};
