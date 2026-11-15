<?php

// Owning module: Ktp (clinic_ai_setting, ktp_photo, patient_ktp). A4: manual KTP entry + NIK checks; paid AI off by default.
// NIK itself stays in patient.nik_enc (Patients); nothing here stores it.

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

        // Per-clinic paid-AI switch. No row = config('ai.paid_ai.default') (FINAL: off).
        Schema::create('clinic_ai_setting', function (Blueprint $t) {
            $t->uuid('tenant_id')->primary();
            $t->foreign('tenant_id')->references('id')->on('tenant');
            $t->boolean('paid_enabled')->default(false);
            $t->timestamps();
        });

        // Optional KTP photo. Bytes only as Crypto::encrypt(base64(raw)); never plaintext.
        Schema::create('ktp_photo', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('patient_id')->nullable();
            $t->string('mime', 30);
            $t->longText('bytes_enc');
            $t->foreignUuid('created_by')->nullable()->constrained('users');
            $t->timestamps();
            $t->index(['tenant_id', 'patient_id']);
            $fk($t, 'patient_id', 'patient');
        });

        // Receptionist-verified KTP wilayah codes (BPS, 2 digits each) for a patient.
        Schema::create('patient_ktp', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('patient_id');
            $t->char('province_code', 2)->nullable();
            $t->char('regency_code', 2)->nullable();
            $t->char('district_code', 2)->nullable();
            $t->uuid('photo_id')->nullable();
            $t->string('source', 20)->default('manual'); // manual | nova_lite
            $t->foreignUuid('verified_by')->nullable()->constrained('users');
            $t->dateTime('verified_at')->nullable();
            $t->timestamps();
            $t->unique(['tenant_id', 'patient_id']);
            $fk($t, 'patient_id', 'patient');
            $fk($t, 'photo_id', 'ktp_photo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_ktp');
        Schema::dropIfExists('ktp_photo');
        Schema::dropIfExists('clinic_ai_setting');
    }
};
