<?php

// Owning module: IcdSuggestions (icd_entry, icd_synonym) + clinic_ai_setting grants. MySQL only.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// ehr_app: SELECT only on the global ICD tables (import/seed run as mysql_admin); clinic_ai_setting SELECT/INSERT/UPDATE, no DELETE.
// No triggers here: A4 (2026_05_04_000002) adds the clinic_ai_setting no-delete/tenant-fixed triggers; GRANTs are idempotent.
// PostgreSQL equivalent: GRANT SELECT on the ICD tables; clinic_ai_setting with FORCE RLS on tenant_id.
return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection()->getDatabaseName();
        $grantee = sprintf("'%s'@'%s'", config('database.connections.mysql.username'), env('DB_APP_GRANT_HOST', '127.0.0.1'));
        foreach (['icd_entry', 'icd_synonym'] as $t) {
            DB::statement("GRANT SELECT ON `$db`.`$t` TO $grantee");
        }
        DB::statement("GRANT SELECT, INSERT, UPDATE ON `$db`.`clinic_ai_setting` TO $grantee");
    }

    public function down(): void {}
};
