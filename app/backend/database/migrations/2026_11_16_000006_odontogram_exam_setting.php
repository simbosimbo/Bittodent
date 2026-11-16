<?php

// Owning module: Tenancy (tenant). Audit S7 / owner decision 4: the "Pemeriksaan awal" entry mode is on by default and never
// mandatory; the owner can switch it off in Pengaturan RM. Grants: tenant already has SELECT, UPDATE.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenant', fn (Blueprint $t) => $t->boolean('odontogram_exam_enabled')->default(true)->after('selesai_pin_required'));
    }

    public function down(): void
    {
        Schema::table('tenant', fn (Blueprint $t) => $t->dropColumn('odontogram_exam_enabled'));
    }
};
