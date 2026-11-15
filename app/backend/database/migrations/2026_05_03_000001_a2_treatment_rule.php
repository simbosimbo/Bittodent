<?php

// Owning module: TreatmentSuggestions (treatment_rule). A2: per-clinic, versioned rules "odontogram finding -> procedure".
// A rule never changes: editing = a new row with version+1 for the same rule_key (the newest version wins; active=false retires it).
// procedure_code must exist in the clinic's tariff list when the version is written (checked in Services\RuleBook, not by FK:
// tariff rows are versioned by valid_from and not unique per code).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('treatment_rule', function (Blueprint $t) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->foreign('tenant_id')->references('id')->on('tenant');
            $t->string('rule_key', 40);              // stable across versions, e.g. karies-tumpatan
            $t->unsignedSmallInteger('version');
            $t->string('condition', 40);             // odontogram legend code (plaintext structured code, D-020)
            $t->json('surfaces')->nullable();        // null = any surface (or whole tooth); else e.g. ["O","M"]
            $t->string('procedure_code', 10);        // ICD-9-CM/clinic code present in tariff
            $t->unsignedSmallInteger('priority');    // lower = shown first
            $t->boolean('active')->default(true);
            $t->foreignUuid('created_by')->nullable()->constrained('users'); // null = seeded template
            $t->timestamp('created_at')->useCurrent();
            $t->unique(['tenant_id', 'rule_key', 'version']);
            $t->index(['tenant_id', 'condition']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('treatment_rule');
    }
};
