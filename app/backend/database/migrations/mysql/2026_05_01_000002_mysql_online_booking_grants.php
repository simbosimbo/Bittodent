<?php

// Owning module: Scheduling (practice_hour, clinic_service, booking_otp). MySQL only.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// ehr_app: SELECT/INSERT/UPDATE, no DELETE (expired OTP challenges stay; cleanup job later).
// PostgreSQL equivalent: same GRANTs + RLS policy on tenant_id like every tenant table.
return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection()->getDatabaseName();
        $grantee = sprintf("'%s'@'%s'", config('database.connections.mysql.username'), env('DB_APP_GRANT_HOST', '127.0.0.1'));
        foreach (['practice_hour', 'clinic_service', 'booking_otp'] as $t) {
            DB::statement("GRANT SELECT, INSERT, UPDATE ON `$db`.`$t` TO $grantee");
        }
    }

    public function down(): void {}
};
