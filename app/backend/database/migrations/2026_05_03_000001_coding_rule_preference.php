<?php

// Owning module: Clinical. Usulan (proposal) condition -> ICD mapping per tenant + per-dentist code usage; codes plaintext by D-020.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $base = function (Blueprint $t) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->foreign('tenant_id')->references('id')->on('tenant');
        };

        // Editable template (CodingTemplate), NOT an official mapping. icd10/icd9cm must be valid official 2010 codes (checked on write).
        Schema::create('coding_rule', function (Blueprint $t) use ($base) {
            $base($t);
            $t->string('condition', 20); // Odontogram condition
            $t->string('tooth_group', 10)->default('any'); // m3 | sulung | anterior | posterior | any (not null: keeps the unique key strict)
            $t->unsignedTinyInteger('surface_count')->nullable(); // null = any
            $t->string('icd10', 16);
            $t->string('icd9cm', 16)->nullable();
            $t->unsignedSmallInteger('priority')->default(1); // 1 = first
            $t->boolean('active')->default(true);
            $t->timestamps();
            $t->unique(['tenant_id', 'condition', 'tooth_group', 'icd10']);
        });

        // How often a dentist chose an ICD-10 code for a condition (sorts suggestions). No clinical text.
        Schema::create('coding_preference', function (Blueprint $t) use ($base) {
            $base($t);
            $t->foreignUuid('dentist_id')->constrained('users');
            $t->string('condition', 20);
            $t->string('icd10', 16);
            $t->unsignedInteger('count')->default(0);
            $t->timestamp('last_used_at')->nullable();
            $t->timestamps();
            $t->unique(['tenant_id', 'dentist_id', 'condition', 'icd10']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coding_preference');
        Schema::dropIfExists('coding_rule');
    }
};
