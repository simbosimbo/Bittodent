<?php

// Owning module: Patients (patient_mrn_seq). MySQL only.

use Database\Support\MysqlGrants;
use Illuminate\Database\Migrations\Migration;

// ehr_app: SELECT/INSERT/UPDATE on the MRN counter (no DELETE). PostgreSQL equivalent: GRANT SELECT, INSERT, UPDATE + RLS on tenant_id.
return new class extends Migration
{
    public function up(): void
    {
        MysqlGrants::grant('SELECT, INSERT, UPDATE', 'patient_mrn_seq');
    }

    public function down(): void {}
};
