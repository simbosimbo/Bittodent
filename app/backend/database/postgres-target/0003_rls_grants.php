<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// RLS ENABLE + FORCE on every tenant table, one direct column comparison per policy. Least-privilege grants.
return new class extends Migration
{
    protected $connection = 'pgsql_admin';

    public function up(): void
    {
        DB::connection('pgsql_admin')->unprepared(<<<'SQL'
SET LOCAL ROLE ehr_owner;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['branch','chair','membership','patient','appointment','visit',
                           'clinical_note','clinical_note_version','audit_event','outbox'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I FOR ALL TO ehr_app
                      USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())', t);
  END LOOP;
END $$;

-- A user may read their own memberships (all tenants) to pick a tenant. Read only.
CREATE POLICY own_memberships ON membership FOR SELECT TO ehr_app USING (user_id = app_user_id());

ALTER TABLE tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_visible ON tenant FOR SELECT TO ehr_app USING (
  id = app_tenant_id()
  OR id IN (SELECT m.tenant_id FROM membership m WHERE m.user_id = app_user_id() AND m.revoked_at IS NULL));

-- No DELETE/TRUNCATE on any tenant table. Clinical rows further guarded by triggers.
GRANT SELECT ON tenant TO ehr_app;
GRANT SELECT, INSERT, UPDATE ON branch, chair, membership, patient, appointment, visit, outbox TO ehr_app;
GRANT SELECT, INSERT ON clinical_note TO ehr_app;
GRANT SELECT, INSERT, UPDATE ON clinical_note_version TO ehr_app; -- UPDATE = draft edit / sign only (trigger)
GRANT SELECT, INSERT ON audit_event, auth_event TO ehr_app;      -- partitions get no grants
GRANT SELECT ON clinical_note_version_status TO ehr_app;
-- Global (pre-tenant) tables: no RLS, see DEVIATIONS.md.
GRANT SELECT, INSERT, UPDATE ON app_user TO ehr_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO ehr_app; -- Laravel session GC deletes expired rows
SQL);
    }

    public function down(): void
    {
        throw new RuntimeException('Tidak ada rollback; pakai php artisan ehr:fresh di dev/test.');
    }
};
