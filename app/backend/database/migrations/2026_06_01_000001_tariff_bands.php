<?php

// Owning modules: Tariffs (tariff_rate: explicit Spesialis / bidang / per-dokter price cells), Tenancy (dentist_profile),
// Billing (invoice_line snapshot of who did the procedure + which price applied). Unit A tarif bertingkat.

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

        // One explicit price cell above Umum (tariff.price_rp). No row = no cell (fallback); never auto-computed.
        // band specialist: field/dentist_id null; band field: field set; band dentist: dentist_id set. Versioned like tariff.
        Schema::create('tariff_rate', function (Blueprint $t) use ($base) {
            $base($t);
            $t->string('procedure_code', 10);
            $t->string('variant', 10);
            $t->string('band', 10); // specialist | field | dentist
            $t->string('field', 10)->nullable(); // sp_ort | sp_bm | sp_kg | sp_pros | sp_perio | sp_kga
            $t->foreignUuid('dentist_id')->nullable()->constrained('users');
            $t->unsignedBigInteger('price_rp');
            $t->date('valid_from');
            $t->date('valid_to')->nullable(); // exclusive; NULL = open
            $t->timestamps();
            $t->index(['tenant_id', 'procedure_code', 'variant', 'band']);
        });

        // Per-tenant (a dentist may work in two clinics with different roles). No row = general.
        Schema::create('dentist_profile', function (Blueprint $t) use ($base) {
            $base($t);
            $t->foreignUuid('user_id')->constrained('users');
            $t->string('category', 10)->default('general'); // general | specialist
            $t->string('field', 10)->nullable(); // only when specialist
            $t->timestamps();
            $t->unique(['tenant_id', 'user_id']);
        });

        // Append-only table: adding nullable columns keeps the UPDATE/DELETE triggers; old lines stay NULL.
        Schema::table('invoice_line', function (Blueprint $t) {
            $t->foreignUuid('doctor_id')->nullable()->after('tooth')->constrained('users');
            $t->string('dentist_category', 10)->nullable()->after('doctor_id');
            $t->string('dentist_field', 10)->nullable()->after('dentist_category');
            $t->string('surface', 10)->nullable()->after('tooth');
            $t->string('procedure_name', 200)->nullable()->after('procedure_code'); // tariff.name at sign time
        });
    }

    public function down(): void
    {
        Schema::table('invoice_line', function (Blueprint $t) {
            $t->dropForeign(['doctor_id']);
            $t->dropColumn(['doctor_id', 'dentist_category', 'dentist_field', 'surface', 'procedure_name']);
        });
        Schema::dropIfExists('dentist_profile');
        Schema::dropIfExists('tariff_rate');
    }
};
