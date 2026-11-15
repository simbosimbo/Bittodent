<?php

// Owning module: Tariffs (tariff_rule: optional derivation rules, default OFF; tariff.category: clinic-defined grouping). Unit B.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Clinic-defined grouping slug (tambalan, scaling, ...). NOT an official classification (SATUSEHAT/ICD have none for this).
        Schema::table('tariff', fn (Blueprint $t) => $t->string('category', 30)->nullable()->after('name'));

        // One rule per scope, edited in place (old values kept in the audit trail). No rows = no derivation (unit A behaviour).
        // Scope: band specialist | field (+field), optionally narrowed to a category OR one procedure_code+variant.
        Schema::create('tariff_rule', function (Blueprint $t) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->foreign('tenant_id')->references('id')->on('tenant');
            $t->string('scope_key', 80); // band|field|category|procedure_code|variant ('' for null): unique without nullable-column gaps
            $t->string('band', 10); // specialist | field
            $t->string('field', 10)->nullable();
            $t->string('category', 30)->nullable();
            $t->string('procedure_code', 10)->nullable();
            $t->string('variant', 10)->nullable();
            $t->string('kind', 10); // percent | amount
            $t->bigInteger('value'); // percent: whole percent (30 = +30%); amount: rupiah, may be negative
            $t->string('rounding', 15);
            $t->boolean('enabled')->default(false);
            $t->timestamps();
            $t->unique(['tenant_id', 'scope_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tariff_rule');
        Schema::table('tariff', fn (Blueprint $t) => $t->dropColumn('category'));
    }
};
