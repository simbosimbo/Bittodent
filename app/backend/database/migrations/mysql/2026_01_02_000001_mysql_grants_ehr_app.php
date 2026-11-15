<?php

// Owning module: Shared (platform; grants for every module table).

use App\Shared\Database\MysqlGrants;
use Illuminate\Database\Migrations\Migration;

// MySQL only. Runtime account ehr_app gets per-table SELECT/INSERT/UPDATE; DELETE only on framework tables.
// No DROP/ALTER/CREATE/INDEX/TRIGGER/REFERENCES/GRANT, so also no TRUNCATE (MySQL TRUNCATE needs DROP).
// PostgreSQL equivalent: postgres-target/0003 (ehr_app NOLOGIN-owner split, GRANT SELECT,INSERT,UPDATE, no DELETE/TRUNCATE,
// plus ENABLE + FORCE ROW LEVEL SECURITY policies on tenant_id = current_setting('app.tenant_id')).
return new class extends Migration
{
    private const READ_WRITE = ['users', 'tenant', 'branch', 'chair', 'membership', 'patient', 'appointment', 'visit',
        'clinical_note', 'clinical_note_version', 'tooth_finding', 'outbox'];

    private const APPEND_ONLY = ['audit_event', 'auth_event'];

    private const WITH_DELETE = ['sessions', 'cache', 'cache_locks', 'jobs', 'failed_jobs'];

    public function up(): void
    {
        MysqlGrants::grant('SELECT, INSERT, UPDATE', ...self::READ_WRITE);
        MysqlGrants::grant('SELECT, INSERT', ...self::APPEND_ONLY);
        MysqlGrants::grant('SELECT, INSERT, UPDATE, DELETE', ...self::WITH_DELETE);
    }

    public function down(): void {}
};
