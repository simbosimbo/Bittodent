<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Partial-name search (database.md §7.2). Under RLS the non-leakproof LIKE operator forces a seq scan, so
// search runs as ehr_search (BYPASSRLS, column SELECT on non-sensitive patient columns only) and filters the
// tenant itself. Tenant comes ONLY from app.tenant_id: there is no tenant parameter to spoof. No context => 0 rows.
// Runs as superuser on purpose: only a superuser may hand the function to ehr_search.
return new class extends Migration
{
    protected $connection = 'pgsql_admin';

    public function up(): void
    {
        DB::connection('pgsql_admin')->unprepared(<<<'SQL'
GRANT SELECT (tenant_id, id, mrn, full_name, name_search, birth_date, sex, status, created_at) ON patient TO ehr_search;

CREATE FUNCTION search_patient(q text, max_rows int DEFAULT 20)
RETURNS TABLE (id uuid, mrn text, full_name text, birth_date date, sex patient_sex, status patient_status)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  tid uuid := nullif(current_setting('app.tenant_id', true), '')::uuid;
  -- Same normalisation as patient.name_search; also strips LIKE wildcards (%, _, \).
  needle text := lower(regexp_replace(coalesce(q, ''), '[^[:alnum:][:space:]]', '', 'g'));
BEGIN
  IF tid IS NULL OR length(trim(needle)) < 2 THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p.id, p.mrn, p.full_name, p.birth_date, p.sex, p.status
    FROM public.patient p
    WHERE p.tenant_id = tid AND p.name_search LIKE '%' || needle || '%'
    ORDER BY public.similarity(p.name_search, needle) DESC, p.full_name, p.id
    LIMIT least(greatest(coalesce(max_rows, 20), 1), 50);
END $$;

ALTER FUNCTION search_patient(text, int) OWNER TO ehr_search;
REVOKE ALL ON FUNCTION search_patient(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_patient(text, int) TO ehr_app;
SQL);
    }

    public function down(): void
    {
        throw new RuntimeException('Tidak ada rollback; pakai php artisan ehr:fresh di dev/test.');
    }
};
