<?php

// Owning module: Clinical (correction_request). MySQL only.

use Database\Support\MysqlGrants;
use Illuminate\Database\Migrations\Migration;

// ehr_app: SELECT/INSERT/UPDATE (no DELETE) on correction_request, same as the other clinical tables.
// PostgreSQL equivalent: GRANT SELECT, INSERT, UPDATE ON correction_request TO ehr_app + ENABLE/FORCE RLS policy on tenant_id.
return new class extends Migration
{
    public function up(): void
    {
        MysqlGrants::grant('SELECT, INSERT, UPDATE', 'correction_request');
    }

    public function down(): void {}
};
