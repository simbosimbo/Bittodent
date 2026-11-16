<?php

// Owning module: Clinical (procedure_definition). Odontogram v2 "tindakan dulu": which odontogram condition codes (PDGI 2015, e.g.
// cof, rct, ipx) a clinic procedure code records. A finished tooth entry bills the code mapped to its condition (owner edits the
// mapping in Pengaturan > Harga). NULL = not mapped. Grants: procedure_definition already has SELECT, INSERT, UPDATE.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('procedure_definition', fn (Blueprint $t) => $t->json('conditions')->nullable());
    }

    public function down(): void
    {
        Schema::table('procedure_definition', fn (Blueprint $t) => $t->dropColumn('conditions'));
    }
};
