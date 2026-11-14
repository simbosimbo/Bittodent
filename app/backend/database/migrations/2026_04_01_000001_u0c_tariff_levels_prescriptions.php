<?php

// Owning modules: Tariffs (tariff.level_label/level_rank: difficulty levels, D-035), Prescriptions (prescription, prescription_item,
// prescription_void: D-036 MVP skeleton, no endpoints yet).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $fk = fn (Blueprint $t, string $col, string $table) => $t->foreign(['tenant_id', $col])->references(['tenant_id', 'id'])->on($table);
        $base = function (Blueprint $t) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->foreign('tenant_id')->references('id')->on('tenant');
        };

        // Difficulty level of a tariff version: `variant` = level code, rank 1 = lowest; the highest rank needs a reason when chosen.
        Schema::table('tariff', function (Blueprint $t) {
            $t->string('level_label', 60)->nullable()->after('variant');
            $t->unsignedTinyInteger('level_rank')->default(1)->after('level_label');
        });

        // Prescription (MVP: printed + signed on paper by the dentist). state: draft -> signed (locked + printed; trigger: immutable).
        // Correction = prescription_void (reason) + new prescription (new number) with supersedes_id.
        Schema::create('prescription', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->string('number', 30);
            $t->uuid('patient_id');
            $t->uuid('visit_id');
            $t->uuid('branch_id');
            $t->foreignUuid('dentist_id')->constrained('users');
            $t->string('state', 10)->default('draft');
            $t->uuid('supersedes_id')->nullable();
            $t->char('content_hash', 64)->nullable(); // SHA-256 of the printed copy (sidik isi)
            $t->timestamp('signed_at')->nullable();
            $t->foreignUuid('created_by')->constrained('users');
            $t->timestamps();
            $t->unique(['tenant_id', 'number']);
            $t->unique(['tenant_id', 'supersedes_id']); // reissued once
            $t->index(['tenant_id', 'patient_id']);
            $fk($t, 'patient_id', 'patient');
            $fk($t, 'visit_id', 'visit');
            $fk($t, 'branch_id', 'branch');
            $fk($t, 'supersedes_id', 'prescription');
        });
        Schema::create('prescription_item', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('prescription_id');
            $t->string('kfa_code', 20); // plaintext structured code (D-020)
            $t->text('dosage_enc'); // encrypted JSON {dose, route, frequency, duration_days, ...}
            $t->timestamps();
            $t->index(['tenant_id', 'prescription_id']);
            $fk($t, 'prescription_id', 'prescription');
        });
        Schema::create('prescription_void', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('prescription_id');
            $t->text('reason_enc');
            $t->foreignUuid('voided_by')->constrained('users');
            $t->timestamp('created_at')->nullable();
            $t->unique(['tenant_id', 'prescription_id']);
            $fk($t, 'prescription_id', 'prescription');
        });
    }

    public function down(): void
    {
        foreach (['prescription_void', 'prescription_item', 'prescription'] as $t) {
            Schema::dropIfExists($t);
        }
        Schema::table('tariff', fn (Blueprint $t) => $t->dropColumn(['level_label', 'level_rank']));
    }
};
