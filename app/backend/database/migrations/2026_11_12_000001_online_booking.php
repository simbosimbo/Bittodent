<?php

// Owning modules: Tenancy (tenant.slug, tenant.online_booking_enabled), Patients (patient.source), Scheduling (appointment booking columns,
// practice_hour, clinic_service, booking_otp).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Patient online booking (public page). Same rules as the other tenant tables: PK (tenant_id, id), composite tenant FKs.
return new class extends Migration
{
    public function up(): void
    {
        $tenantFk = fn (Blueprint $t, string $col, string $table) => $t->foreign(['tenant_id', $col])->references(['tenant_id', 'id'])->on($table);
        $base = function (Blueprint $t) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->foreign('tenant_id')->references('id')->on('tenant');
        };

        Schema::table('tenant', function (Blueprint $t) {
            $t->string('slug', 60)->nullable()->unique(); // public booking URL; global by design (resolves the tenant)
            $t->boolean('online_booking_enabled')->default(false);
        });

        Schema::table('patient', function (Blueprint $t) {
            $t->string('source', 10)->default('staff'); // staff | online
        });

        // Weekly practice hours per dentist, branch-local time.
        Schema::create('practice_hour', function (Blueprint $t) use ($base, $tenantFk) {
            $base($t);
            $t->foreignUuid('dentist_id')->constrained('users');
            $t->uuid('branch_id');
            $t->unsignedTinyInteger('weekday'); // ISO 1 = Senin .. 7 = Minggu
            $t->time('start_time');
            $t->time('end_time');
            $t->timestamps();
            $t->index(['tenant_id', 'dentist_id', 'weekday']);
            $tenantFk($t, 'branch_id', 'branch');
        });

        Schema::create('clinic_service', function (Blueprint $t) use ($base) {
            $base($t);
            $t->string('name', 100);
            $t->unsignedSmallInteger('duration_minutes');
            $t->boolean('online')->default(false);
            $t->boolean('active')->default(true);
            $t->timestamps();
        });

        // OTP challenge = the pending hold before a booking exists. Code hashed; phone encrypted + blind index; complaint encrypted.
        Schema::create('booking_otp', function (Blueprint $t) use ($base, $tenantFk) {
            $base($t);
            $t->foreignUuid('dentist_id')->constrained('users');
            $t->uuid('branch_id');
            $t->uuid('service_id');
            $t->dateTime('starts_at');
            $t->dateTime('ends_at');
            $t->string('name', 200); // plaintext by D-020
            $t->text('phone_enc');
            $t->char('phone_bidx', 64);
            $t->text('complaint_enc')->nullable();
            $t->string('code_hash');
            $t->unsignedTinyInteger('attempts')->default(0);
            $t->unsignedTinyInteger('sends')->default(1);
            $t->dateTime('expires_at');
            $t->dateTime('last_sent_at');
            $t->dateTime('verified_at')->nullable();
            $t->uuid('appointment_id')->nullable();
            $t->timestamps();
            $t->index(['tenant_id', 'phone_bidx', 'created_at']);
            $tenantFk($t, 'branch_id', 'branch');
            $tenantFk($t, 'service_id', 'clinic_service');
            $tenantFk($t, 'appointment_id', 'appointment');
        });

        Schema::table('appointment', function (Blueprint $t) use ($tenantFk) {
            $t->string('source', 10)->default('staff'); // staff | online
            $t->uuid('service_id')->nullable();
            $t->text('complaint_enc')->nullable();
            $t->string('booking_code', 10)->nullable();
            $t->char('manage_token_hash', 64)->nullable(); // sha256 of the manage-link token; the token itself is never stored
            $t->dateTime('manage_expires_at')->nullable();
            // "dentist_id|starts_at" while the appointment is active, NULL otherwise (Appointment model). UNIQUE = last line against
            // double booking of the same start; partial overlaps stay guarded by the row locks in AppointmentController::book (DEVIATIONS #4).
            $t->string('slot_key', 80)->nullable();
            $t->unique(['tenant_id', 'slot_key']);
            $t->unique(['tenant_id', 'booking_code']);
            $t->index(['tenant_id', 'manage_token_hash']);
            $tenantFk($t, 'service_id', 'clinic_service');
        });
    }

    public function down(): void
    {
        Schema::table('appointment', function (Blueprint $t) {
            $t->dropForeign(['tenant_id', 'service_id']);
            $t->dropUnique(['tenant_id', 'slot_key']);
            $t->dropUnique(['tenant_id', 'booking_code']);
            $t->dropIndex(['tenant_id', 'manage_token_hash']);
            $t->dropColumn(['source', 'service_id', 'complaint_enc', 'booking_code', 'manage_token_hash', 'manage_expires_at', 'slot_key']);
        });
        foreach (['booking_otp', 'clinic_service', 'practice_hour'] as $t) {
            Schema::dropIfExists($t);
        }
        Schema::table('patient', fn (Blueprint $t) => $t->dropColumn('source'));
        Schema::table('tenant', function (Blueprint $t) {
            $t->dropUnique(['slug']);
            $t->dropColumn(['slug', 'online_booking_enabled']);
        });
    }
};
