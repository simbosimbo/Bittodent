<?php

// Owning module: Clinical (coding_rule, coding_preference). MySQL only.

use Database\Support\MysqlGrants;
use Illuminate\Database\Migrations\Migration;

// ehr_app: SELECT/INSERT/UPDATE; no DELETE (a rule is switched off with active = 0, preferences only grow).
// PostgreSQL equivalent: same GRANTs + tenant RLS policy like every tenant table.
return new class extends Migration
{
    public function up(): void
    {
        MysqlGrants::grant('SELECT, INSERT, UPDATE', 'coding_rule', 'coding_preference');
    }

    public function down(): void {}
};
