<?php

// Owning module: Tariffs (tariff_rule). MySQL only.

use App\Shared\Database\MysqlGrants;
use Illuminate\Database\Migrations\Migration;

// ehr_app: SELECT/INSERT/UPDATE, no DELETE (a rule is switched off with enabled = false). PostgreSQL: same GRANT + tenant RLS policy.
return new class extends Migration
{
    public function up(): void
    {
        MysqlGrants::grant('SELECT, INSERT, UPDATE', 'tariff_rule');
    }

    public function down(): void {}
};
