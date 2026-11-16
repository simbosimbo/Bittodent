<?php

// Owning module: Scheduling (practice_hour, clinic_service, booking_otp). MySQL only.

use Database\Support\MysqlGrants;
use Illuminate\Database\Migrations\Migration;

// ehr_app: SELECT/INSERT/UPDATE, no DELETE (expired OTP challenges stay; cleanup job later).
// PostgreSQL equivalent: same GRANTs + RLS policy on tenant_id like every tenant table.
return new class extends Migration
{
    public function up(): void
    {
        MysqlGrants::grant('SELECT, INSERT, UPDATE', 'practice_hour', 'clinic_service', 'booking_otp');
    }

    public function down(): void {}
};
