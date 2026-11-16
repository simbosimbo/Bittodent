<?php

// Owning module: Shared\Terminology (global ICD reference, no tenant_id). Filled by `php artisan icd:import`.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Official SATUSEHAT lists (ICD10_2010, ICD9CM_2010); display = official English text. Codes are never deleted:
// codes missing from a later import get valid=false because old records may still reference them.
return new class extends Migration
{
    public function up(): void
    {
        foreach (['icd10_codes', 'icd9cm_codes'] as $table) {
            Schema::create($table, function (Blueprint $t) {
                $t->string('code', 16)->primary();
                $t->string('display', 500);
                $t->string('version', 20);
                $t->boolean('valid')->default(true);
                $t->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('icd9cm_codes');
        Schema::dropIfExists('icd10_codes');
    }
};
