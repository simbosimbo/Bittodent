<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Runs as the migration superuser (pgsql_admin): roles + extensions. Ported from archive-node 0001.
// Every object created after SET LOCAL ROLE ehr_owner is owned by a non-superuser that cannot bypass RLS.
return new class extends Migration
{
    protected $connection = 'pgsql_admin';

    public function up(): void
    {
        $db = DB::connection('pgsql_admin');
        $db->unprepared(<<<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ehr_owner') THEN CREATE ROLE ehr_owner NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ehr_app') THEN CREATE ROLE ehr_app LOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ehr_search') THEN CREATE ROLE ehr_search NOLOGIN; END IF;
END $$;
ALTER ROLE ehr_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
ALTER ROLE ehr_app LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
ALTER ROLE ehr_search NOLOGIN NOSUPERUSER BYPASSRLS NOCREATEDB NOCREATEROLE;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ehr_app, ehr_search;
GRANT USAGE, CREATE ON SCHEMA public TO ehr_owner;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS btree_gist;

SET LOCAL ROLE ehr_owner;
-- Tenant/user context: set per transaction by the TenantContext middleware via set_config(..., true).
-- Unset => NULL => every policy comparison is false => 0 rows, inserts rejected.
CREATE FUNCTION app_tenant_id() RETURNS uuid LANGUAGE sql STABLE
  AS $f$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $f$;
CREATE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE
  AS $f$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $f$;
SQL);
        // Password comes from env, never from a SQL file. ALTER ROLE cannot take bind params, so quote.
        $pw = (string) config('database.connections.pgsql.password');
        if ($pw !== '') {
            $db->unprepared('ALTER ROLE ehr_app PASSWORD '.$db->getPdo()->quote($pw));
        }
    }

    public function down(): void
    {
        throw new RuntimeException('Tidak ada rollback; pakai php artisan ehr:fresh di dev/test.');
    }
};
