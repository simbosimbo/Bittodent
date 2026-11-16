<?php

// Owning module: Clinical (procedure_definition). Audit S8 (P2-1): the clinic's default ICD-10 for a procedure, set by a dentist in
// Pengaturan RM, used when the procedure is saved without a diagnosis and no coding_rule pairs one. Never seeded: diagnosis pairs are a
// licensed dentist's call. Structured code, not encrypted (D-020). Grants: procedure_definition already has SELECT, INSERT, UPDATE.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('procedure_definition', fn (Blueprint $t) => $t->string('default_icd10', 16)->nullable());
    }

    public function down(): void
    {
        Schema::table('procedure_definition', fn (Blueprint $t) => $t->dropColumn('default_icd10'));
    }
};
