<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Odontogram v2 (board 09 entry): a procedure row may carry the charted condition (taxonomy key), and a range row (bridge, tooth_range
// "34-36") the role per tooth (abutment/pontic) and the bridge material (meb/pob). All nullable: existing rows keep their meaning,
// nothing is rewritten (final rows are immutable by trigger). Surface V is stored as the existing B.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('procedure_record', function (Blueprint $t) {
            $t->string('condition', 40)->nullable()->after('procedure_code');
            $t->json('span_roles')->nullable()->after('tooth_range');
            $t->string('material', 3)->nullable()->after('span_roles');
        });
    }

    public function down(): void
    {
        Schema::table('procedure_record', fn (Blueprint $t) => $t->dropColumn(['condition', 'span_roles', 'material']));
    }
};
