<?php

// Owning modules: Tariffs (tariff_rate), Tenancy (dentist_profile). MySQL only.

use Database\Support\MysqlGrants;
use Illuminate\Database\Migrations\Migration;

// ehr_app: SELECT/INSERT/UPDATE, no DELETE (a price cell is cleared by closing it: valid_to). invoice_line keeps its existing grant + triggers.
// PostgreSQL equivalent: same GRANTs + tenant RLS policy like every tenant table.
return new class extends Migration
{
    public function up(): void
    {
        MysqlGrants::grant('SELECT, INSERT, UPDATE', 'tariff_rate', 'dentist_profile');
    }

    public function down(): void {}
};
