<?php

// Owning module: Shared\Terminology (icd10_codes, icd9cm_codes). MySQL only.

use App\Shared\Database\MysqlGrants;
use Illuminate\Database\Migrations\Migration;

// ehr_app: SELECT only (read-only global reference); icd:import writes as ehr_admin (mysql_admin).
// PostgreSQL equivalent: GRANT SELECT ON icd10_codes, icd9cm_codes TO ehr_app (global table, no RLS policy).
return new class extends Migration
{
    public function up(): void
    {
        MysqlGrants::grant('SELECT', 'icd10_codes', 'icd9cm_codes');
    }

    public function down(): void {}
};
