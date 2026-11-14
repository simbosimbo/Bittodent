<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Slice schema (docs/database.md §3), ported from archive-node 0002. Rules: uuidv7 ids, tenant_id first in
// every PK/index, composite (tenant_id, id) FKs (FK checks bypass RLS), signed clinical rows append-only.
return new class extends Migration
{
    protected $connection = 'pgsql_admin';

    public function up(): void
    {
        DB::connection('pgsql_admin')->unprepared(<<<'SQL'
SET LOCAL ROLE ehr_owner;

CREATE TYPE tenant_mode AS ENUM ('sederhana', 'standar');
CREATE TYPE license_type AS ENUM ('dokter_gigi', 'lainnya');
CREATE TYPE member_role AS ENUM ('owner', 'dentist', 'assistant', 'front_desk');
CREATE TYPE patient_sex AS ENUM ('laki_laki', 'perempuan');
CREATE TYPE patient_status AS ENUM ('aktif', 'meninggal', 'diarsip');
CREATE TYPE appointment_state AS ENUM ('dipesan', 'dikonfirmasi', 'perlu_jadwal_ulang', 'check_in', 'dalam_perawatan', 'selesai', 'batal', 'tidak_datang');
CREATE TYPE booked_via AS ENUM ('front_desk', 'agen_wa', 'web');
CREATE TYPE visit_state AS ENUM ('berlangsung', 'selesai');
CREATE TYPE actor_type AS ENUM ('user', 'agen', 'sistem');
CREATE TYPE outbox_status AS ENUM ('pending', 'leased', 'sent', 'failed');

-- ───────── Global (no tenant): Laravel users + sessions + auth log ─────────
CREATE TABLE app_user (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified_at timestamptz,
  password text NOT NULL,
  remember_token text,
  license_type license_type NOT NULL DEFAULT 'lainnya',
  two_factor_secret text,            -- Fortify, encrypted with APP_KEY
  two_factor_recovery_codes text,    -- Fortify, encrypted with APP_KEY
  two_factor_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id text PRIMARY KEY,
  user_id uuid REFERENCES app_user(id) ON DELETE CASCADE,
  ip_address text,
  user_agent text,
  payload text NOT NULL,
  last_activity integer NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_last_activity_idx ON sessions (last_activity);

-- Login happens before a tenant is chosen, so login/logout events live here (no PII: email is an HMAC).
CREATE TABLE auth_event (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL, -- login, login_gagal, logout, 2fa_gagal
  user_id uuid,
  email_hash text,
  ip inet,
  user_agent text
);
CREATE INDEX auth_event_user_idx ON auth_event (user_id, occurred_at DESC);

-- ───────── Tenancy ─────────
CREATE TABLE tenant (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  name text NOT NULL,
  mode tenant_mode NOT NULL DEFAULT 'standar',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE branch (
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  id uuid NOT NULL DEFAULT uuidv7(),
  name text NOT NULL,
  timezone text NOT NULL CHECK (timezone IN ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE chair (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT uuidv7(),
  branch_id uuid NOT NULL,
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, branch_id, id),
  FOREIGN KEY (tenant_id, branch_id) REFERENCES branch(tenant_id, id)
);

CREATE TABLE membership (
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  id uuid NOT NULL DEFAULT uuidv7(),
  user_id uuid NOT NULL REFERENCES app_user(id),
  branch_id uuid, -- NULL = all branches of the tenant
  role member_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, branch_id) REFERENCES branch(tenant_id, id)
);
CREATE UNIQUE INDEX membership_unique ON membership (tenant_id, user_id, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'), role) WHERE revoked_at IS NULL;
-- Exception to "tenant_id first": the middleware lists a user's tenants before a tenant is chosen.
CREATE INDEX membership_user_idx ON membership (user_id) WHERE revoked_at IS NULL;

-- ───────── Patients ─────────
CREATE TABLE patient (
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  id uuid NOT NULL DEFAULT uuidv7(),
  mrn text NOT NULL,
  full_name text NOT NULL CHECK (length(trim(full_name)) > 0),      -- plaintext by D-020
  name_search text GENERATED ALWAYS AS (lower(regexp_replace(full_name, '[^[:alnum:][:space:]]', '', 'g'))) STORED,
  birth_date date,                                                   -- plaintext by D-020
  sex patient_sex,
  nik_enc text, nik_bidx text,       -- app-layer encrypted (ENCRYPTION_KEY) + HMAC blind index (BLIND_INDEX_KEY)
  phone_enc text, phone_bidx text,
  address_enc text,
  status patient_status NOT NULL DEFAULT 'aktif',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  CHECK ((nik_enc IS NULL) = (nik_bidx IS NULL)),
  CHECK ((phone_enc IS NULL) = (phone_bidx IS NULL))
);
CREATE UNIQUE INDEX patient_mrn_uq ON patient (tenant_id, mrn);
CREATE UNIQUE INDEX patient_nik_bidx_uq ON patient (tenant_id, nik_bidx) WHERE nik_bidx IS NOT NULL;
CREATE INDEX patient_phone_bidx_idx ON patient (tenant_id, phone_bidx) WHERE phone_bidx IS NOT NULL;
CREATE INDEX patient_name_trgm_idx ON patient USING gin (tenant_id, name_search gin_trgm_ops);
CREATE INDEX patient_list_idx ON patient (tenant_id, created_at DESC, id DESC); -- keyset list

-- ───────── Scheduling ─────────
CREATE TABLE appointment (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT uuidv7(),
  branch_id uuid NOT NULL,
  chair_id uuid NOT NULL,
  dentist_id uuid NOT NULL REFERENCES app_user(id),
  patient_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  state appointment_state NOT NULL DEFAULT 'dipesan',
  booked_via booked_via NOT NULL DEFAULT 'front_desk',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  CHECK (ends_at > starts_at),
  FOREIGN KEY (tenant_id, branch_id, chair_id) REFERENCES chair(tenant_id, branch_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient(tenant_id, id),
  -- The database itself refuses double booking.
  CONSTRAINT appointment_no_chair_overlap EXCLUDE USING gist
    (tenant_id WITH =, chair_id WITH =, tstzrange(starts_at, ends_at) WITH &&)
    WHERE (state IN ('dipesan', 'dikonfirmasi', 'check_in', 'dalam_perawatan')),
  CONSTRAINT appointment_no_dentist_overlap EXCLUDE USING gist
    (tenant_id WITH =, dentist_id WITH =, tstzrange(starts_at, ends_at) WITH &&)
    WHERE (state IN ('dipesan', 'dikonfirmasi', 'check_in', 'dalam_perawatan'))
);
CREATE INDEX appointment_schedule_idx ON appointment (tenant_id, branch_id, starts_at)
  INCLUDE (chair_id, dentist_id, patient_id, state, ends_at);
CREATE INDEX appointment_patient_idx ON appointment (tenant_id, patient_id, starts_at);

-- State machine (database.md §4.1). Only listed transitions are allowed.
CREATE FUNCTION appointment_transition_allowed(from_state appointment_state, to_state appointment_state)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (from_state, to_state) IN (
    ('dipesan', 'dikonfirmasi'), ('dipesan', 'batal'), ('dipesan', 'perlu_jadwal_ulang'),
    ('dipesan', 'check_in'), ('dipesan', 'tidak_datang'),
    ('dikonfirmasi', 'batal'), ('dikonfirmasi', 'perlu_jadwal_ulang'),
    ('dikonfirmasi', 'check_in'), ('dikonfirmasi', 'tidak_datang'),
    ('perlu_jadwal_ulang', 'dipesan'), ('perlu_jadwal_ulang', 'batal'),
    ('check_in', 'dalam_perawatan'), ('dalam_perawatan', 'selesai'))
$$;

CREATE FUNCTION appointment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.state NOT IN ('dipesan', 'dikonfirmasi') THEN
      RAISE EXCEPTION 'janji baru harus berstatus dipesan/dikonfirmasi' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW.state IS DISTINCT FROM OLD.state
        AND NOT appointment_transition_allowed(OLD.state, NEW.state) THEN
    RAISE EXCEPTION 'perpindahan status janji % -> % tidak diizinkan', OLD.state, NEW.state USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER appointment_guard BEFORE INSERT OR UPDATE ON appointment FOR EACH ROW EXECUTE FUNCTION appointment_guard();

-- ───────── Visit + clinical notes ─────────
CREATE TABLE visit (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT uuidv7(),
  patient_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  dentist_id uuid NOT NULL REFERENCES app_user(id),
  appointment_id uuid, -- NULL = walk-in
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  state visit_state NOT NULL DEFAULT 'berlangsung',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient(tenant_id, id),
  FOREIGN KEY (tenant_id, branch_id) REFERENCES branch(tenant_id, id),
  FOREIGN KEY (tenant_id, appointment_id) REFERENCES appointment(tenant_id, id),
  CHECK ((state = 'selesai') = (ended_at IS NOT NULL))
);
CREATE UNIQUE INDEX visit_appointment_uq ON visit (tenant_id, appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX visit_patient_idx ON visit (tenant_id, patient_id, started_at DESC, id DESC);

CREATE FUNCTION visit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state = 'selesai' AND NEW.state <> 'selesai' THEN
    RAISE EXCEPTION 'kunjungan selesai tidak bisa dibuka lagi' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER visit_guard BEFORE UPDATE ON visit FOR EACH ROW EXECUTE FUNCTION visit_guard();

-- Note identity; content lives in clinical_note_version (state derived from versions, never stored twice).
CREATE TABLE clinical_note (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT uuidv7(),
  visit_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  author_id uuid NOT NULL REFERENCES app_user(id),
  first_input_at timestamptz NOT NULL DEFAULT now(), -- basis for the 2x24h rule
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, visit_id, patient_id) REFERENCES visit(tenant_id, id, patient_id)
);
CREATE INDEX clinical_note_visit_idx ON clinical_note (tenant_id, visit_id);
CREATE INDEX clinical_note_patient_idx ON clinical_note (tenant_id, patient_id, created_at DESC);

CREATE TABLE clinical_note_version (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT uuidv7(),
  note_id uuid NOT NULL,
  version int NOT NULL CHECK (version >= 1),
  supersedes_id uuid,            -- correction = new version pointing at the signed one it replaces
  soap_enc text NOT NULL,        -- app-layer encrypted (ENCRYPTION_KEY)
  content_hash text NOT NULL,    -- SHA-256 of plaintext
  reason text,                   -- required for corrections
  signed_by uuid REFERENCES app_user(id),
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES app_user(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, note_id, version),
  FOREIGN KEY (tenant_id, note_id) REFERENCES clinical_note(tenant_id, id),
  FOREIGN KEY (tenant_id, supersedes_id) REFERENCES clinical_note_version(tenant_id, id),
  CHECK ((version = 1) = (supersedes_id IS NULL)),
  CHECK (supersedes_id IS NULL OR coalesce(length(trim(reason)), 0) > 0),
  CHECK ((signed_by IS NULL) = (signed_at IS NULL))
);
CREATE UNIQUE INDEX clinical_note_version_one_draft ON clinical_note_version (tenant_id, note_id) WHERE signed_at IS NULL;
CREATE UNIQUE INDEX clinical_note_version_supersedes_uq ON clinical_note_version (tenant_id, supersedes_id) WHERE supersedes_id IS NOT NULL;

-- Licensed dentist with an active dentist membership in the current tenant.
CREATE FUNCTION app_user_is_dentist(p_user uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM app_user u WHERE u.id = p_user AND u.license_type = 'dokter_gigi')
     AND EXISTS (SELECT 1 FROM membership m WHERE m.tenant_id = app_tenant_id() AND m.user_id = p_user
                  AND m.role = 'dentist' AND m.revoked_at IS NULL)
$$;

-- DELETE never. Signed rows frozen. Drafts editable by creator or a dentist. Signing only by the
-- logged-in dentist. Identity columns never change. Corrections must sit on top of a signed version.
CREATE FUNCTION clinical_note_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  prev record;
  mutable text[] := ARRAY['soap_enc','content_hash','signed_by','signed_at','updated_at'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'clinical_note_version tidak boleh dihapus' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.signed_at IS NOT NULL THEN
      RAISE EXCEPTION 'versi sudah ditandatangani; koreksi = versi baru' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF (to_jsonb(NEW) - mutable) IS DISTINCT FROM (to_jsonb(OLD) - mutable) THEN
      RAISE EXCEPTION 'kolom identitas versi tidak boleh diubah' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF app_user_id() IS DISTINCT FROM OLD.created_by AND NOT app_user_is_dentist(app_user_id()) THEN
      RAISE EXCEPTION 'draf hanya boleh diubah penulisnya atau dokter gigi' USING ERRCODE = 'insufficient_privilege';
    END IF;
    NEW.updated_at := now();
  END IF;
  IF NEW.signed_at IS NOT NULL THEN
    IF NEW.signed_by IS DISTINCT FROM app_user_id() OR NOT app_user_is_dentist(NEW.signed_by) THEN
      RAISE EXCEPTION 'hanya dokter gigi yang sedang login yang boleh menandatangani' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS DISTINCT FROM app_user_id() THEN
      RAISE EXCEPTION 'created_by harus pengguna yang sedang login' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.supersedes_id IS NOT NULL THEN
      SELECT v.note_id, v.version, v.signed_at INTO prev FROM clinical_note_version v
        WHERE v.tenant_id = NEW.tenant_id AND v.id = NEW.supersedes_id;
      IF prev.signed_at IS NULL OR prev.note_id IS DISTINCT FROM NEW.note_id OR NEW.version <> prev.version + 1 THEN
        RAISE EXCEPTION 'koreksi harus menunjuk versi sebelumnya yang sudah ditandatangani' USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER clinical_note_version_guard BEFORE INSERT OR UPDATE OR DELETE ON clinical_note_version
  FOR EACH ROW EXECUTE FUNCTION clinical_note_version_guard();

CREATE FUNCTION reject_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% hanya boleh ditambah', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END $$;
CREATE TRIGGER clinical_note_frozen BEFORE UPDATE OR DELETE ON clinical_note FOR EACH ROW EXECUTE FUNCTION reject_change();
CREATE TRIGGER auth_event_append_only BEFORE UPDATE OR DELETE ON auth_event FOR EACH ROW EXECUTE FUNCTION reject_change();

-- ───────── Audit (append-only, partitioned by month) ─────────
CREATE TABLE audit_event (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT uuidv7(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_type actor_type NOT NULL,
  actor_id uuid,
  action text NOT NULL, -- baca, buat, tanda_tangan, akses_ditolak, ...
  entity_type text NOT NULL,
  entity_id uuid,
  branch_id uuid,
  cross_branch boolean NOT NULL DEFAULT false,
  ip inet,
  user_agent text,
  detail jsonb NOT NULL DEFAULT '{}', -- metadata only, never sensitive values
  PRIMARY KEY (tenant_id, id, occurred_at)
) PARTITION BY RANGE (occurred_at);
CREATE INDEX audit_entity_idx ON audit_event (tenant_id, entity_type, entity_id, occurred_at DESC);
CREATE INDEX audit_actor_idx ON audit_event (tenant_id, actor_id, occurred_at DESC);
CREATE INDEX audit_occurred_idx ON audit_event (tenant_id, occurred_at DESC);
CREATE TRIGGER audit_event_append_only BEFORE UPDATE OR DELETE ON audit_event FOR EACH ROW EXECUTE FUNCTION reject_change();

-- shortcut: partitions pre-created for 2026-2027 + DEFAULT; add the monthly partition job before 2028.
DO $$
DECLARE m date := date '2026-01-01';
BEGIN
  WHILE m < date '2028-01-01' LOOP
    EXECUTE format('CREATE TABLE audit_event_%s PARTITION OF audit_event FOR VALUES FROM (%L) TO (%L)',
                   to_char(m, 'YYYY_MM'), m, (m + interval '1 month')::date);
    m := (m + interval '1 month')::date;
  END LOOP;
END $$;
CREATE TABLE audit_event_default PARTITION OF audit_event DEFAULT;

-- ───────── Outbox (seam only: no worker yet) ─────────
CREATE TABLE outbox (
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  id uuid NOT NULL DEFAULT uuidv7(),
  kind text NOT NULL,              -- satusehat, whatsapp
  idempotency_key text NOT NULL,
  payload_enc text NOT NULL,
  status outbox_status NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  lease_token uuid,                -- fence: a worker may only write its result while it holds this token
  lease_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, idempotency_key),
  CHECK ((status = 'leased') = (lease_token IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE INDEX outbox_pending_idx ON outbox (tenant_id, status, created_at) WHERE status IN ('pending', 'leased');

-- TRUNCATE skips row triggers and RLS: statement-level guard on clinical/audit tables (and every audit partition).
CREATE FUNCTION reject_truncate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% tidak boleh di-TRUNCATE', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END $$;
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['patient','visit','clinical_note','clinical_note_version','audit_event','auth_event'])
           UNION ALL SELECT c.relname FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid
                     WHERE i.inhparent = 'audit_event'::regclass LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION reject_truncate()',
                   t || '_no_truncate', t);
  END LOOP;
END $$;

-- 'digantikan' = a newer signed version supersedes this one. security_invoker => caller's RLS applies.
CREATE VIEW clinical_note_version_status WITH (security_invoker = true) AS
SELECT v.tenant_id, v.id, v.note_id, v.version, v.supersedes_id, v.signed_by, v.signed_at, v.created_at,
       CASE WHEN v.signed_at IS NULL THEN 'draf'
            WHEN EXISTS (SELECT 1 FROM clinical_note_version n
                         WHERE n.tenant_id = v.tenant_id AND n.supersedes_id = v.id AND n.signed_at IS NOT NULL) THEN 'digantikan'
            ELSE 'berlaku' END AS status
FROM clinical_note_version v;
SQL);
    }

    public function down(): void
    {
        throw new RuntimeException('Tidak ada rollback; pakai php artisan ehr:fresh di dev/test.');
    }
};
