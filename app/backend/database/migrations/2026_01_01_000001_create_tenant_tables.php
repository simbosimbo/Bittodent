<?php

// Owning modules: Tenancy (branch, membership), Scheduling (chair, appointment), Patients (patient), Clinical (visit, clinical_note, clinical_note_version, tooth_finding), Shared\Audit (audit_event), Integrations (outbox).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tenant tables (docs/database.md §3, ported from archive-node 0002 / postgres-target 0002).
// Rules: tenant_id first in every PK/index; PK (tenant_id, id); FKs composite (tenant_id, x_id) -> parent (tenant_id, id)
// so a row can never point into another tenant. Enum-like columns are strings (portable); values checked in PHP.
// Checks that PostgreSQL enforces with CHECK/EXCLUDE live in PHP here (see app/DEVIATIONS.md).
return new class extends Migration
{
    public function up(): void
    {
        $tenantFk = fn (Blueprint $t, string $col, string $table) => $t->foreign(['tenant_id', $col])->references(['tenant_id', 'id'])->on($table);
        $base = function (Blueprint $t) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->foreign('tenant_id')->references('id')->on('tenant');
        };

        Schema::create('branch', function (Blueprint $t) use ($base) {
            $base($t);
            $t->string('name', 200);
            $t->string('timezone', 40)->default('Asia/Jakarta'); // Asia/Jakarta | Asia/Makassar | Asia/Jayapura
            $t->timestamps();
            $t->timestamp('archived_at')->nullable();
        });

        Schema::create('chair', function (Blueprint $t) use ($base, $tenantFk) {
            $base($t);
            $t->uuid('branch_id');
            $t->string('label', 50);
            $t->boolean('active')->default(true);
            $t->timestamps();
            $t->unique(['tenant_id', 'branch_id', 'id']);
            $tenantFk($t, 'branch_id', 'branch');
        });

        Schema::create('membership', function (Blueprint $t) use ($base, $tenantFk) {
            $base($t);
            $t->foreignUuid('user_id')->constrained('users');
            $t->uuid('branch_id')->nullable(); // NULL = all branches of the tenant
            $t->string('role', 20);            // owner | dentist | assistant | front_desk | kasir
            $t->timestamps();
            $t->timestamp('revoked_at')->nullable();
            $t->index(['tenant_id', 'user_id']);
            // Exception to "tenant_id first": the middleware lists a user's own tenants before a tenant is chosen.
            $t->index(['user_id', 'revoked_at']);
            $tenantFk($t, 'branch_id', 'branch');
        });

        Schema::create('patient', function (Blueprint $t) use ($base, $tenantFk) {
            $base($t);
            $t->uuid('home_branch_id')->nullable();
            $t->string('name', 200);              // plaintext by D-020
            $t->string('name_normalized', 200);   // lower, letters/digits/spaces only: search key
            $t->date('dob')->nullable();          // plaintext by D-020
            $t->string('sex', 12)->nullable();    // laki_laki | perempuan
            $t->text('nik_enc')->nullable();      // ENCRYPTION_KEY (not APP_KEY)
            $t->char('nik_bidx', 64)->nullable(); // HMAC-SHA256, BLIND_INDEX_KEY
            $t->text('phone_enc')->nullable();
            $t->char('phone_bidx', 64)->nullable();
            $t->text('address_enc')->nullable();
            // Payer, BPJS-ready (D-008). BPJS itself is not built yet.
            $t->string('payer_type', 20)->default('umum'); // umum | asuransi | bpjs
            $t->string('payer_name', 200)->nullable();
            $t->string('payer_member_no', 64)->nullable();
            $t->string('payer_class', 10)->nullable();
            $t->string('status', 20)->default('aktif');
            $t->uuid('created_by')->nullable();
            $t->timestamps();
            $t->unique(['tenant_id', 'nik_bidx']); // MySQL/PG UNIQUE both allow many NULLs
            $t->index(['tenant_id', 'phone_bidx']);
            $t->index(['tenant_id', 'created_at', 'id']); // keyset list
            $tenantFk($t, 'home_branch_id', 'branch');
            $t->foreign('created_by')->references('id')->on('users');
        });

        Schema::create('appointment', function (Blueprint $t) use ($base, $tenantFk) {
            $base($t);
            $t->uuid('branch_id');
            $t->uuid('chair_id');
            $t->foreignUuid('dentist_id')->constrained('users');
            $t->uuid('patient_id');
            $t->dateTime('starts_at'); // UTC
            $t->dateTime('ends_at');
            $t->string('status', 20)->default('booked'); // App\Modules\Scheduling\Domain\AppointmentStatus
            $t->string('reason', 300)->nullable();
            $t->uuid('created_by')->nullable();
            $t->timestamps();
            $t->index(['tenant_id', 'branch_id', 'starts_at']);
            $t->index(['tenant_id', 'chair_id', 'starts_at']);
            $t->index(['tenant_id', 'patient_id', 'starts_at']);
            $t->foreign(['tenant_id', 'branch_id', 'chair_id'])->references(['tenant_id', 'branch_id', 'id'])->on('chair');
            $tenantFk($t, 'patient_id', 'patient');
            $t->foreign('created_by')->references('id')->on('users');
        });

        Schema::create('visit', function (Blueprint $t) use ($base, $tenantFk) {
            $base($t);
            $t->uuid('patient_id');
            $t->uuid('branch_id');
            $t->foreignUuid('dentist_id')->constrained('users');
            $t->uuid('appointment_id')->nullable(); // NULL = walk-in
            $t->dateTime('started_at');
            $t->dateTime('ended_at')->nullable();
            $t->string('status', 20)->default('berlangsung'); // berlangsung | selesai
            $t->uuid('created_by')->nullable();
            $t->timestamps();
            $t->unique(['tenant_id', 'id', 'patient_id']);
            $t->unique(['tenant_id', 'appointment_id']);
            $t->index(['tenant_id', 'patient_id', 'started_at']);
            $tenantFk($t, 'patient_id', 'patient');
            $tenantFk($t, 'branch_id', 'branch');
            $tenantFk($t, 'appointment_id', 'appointment');
        });

        // Note identity; content lives in clinical_note_version.
        Schema::create('clinical_note', function (Blueprint $t) use ($base) {
            $base($t);
            $t->uuid('visit_id');
            $t->uuid('patient_id');
            $t->foreignUuid('author_id')->constrained('users');
            $t->dateTime('first_input_at'); // basis for the 2x24h rule
            $t->timestamps();
            $t->index(['tenant_id', 'patient_id', 'created_at']);
            $t->foreign(['tenant_id', 'visit_id', 'patient_id'])->references(['tenant_id', 'id', 'patient_id'])->on('visit');
        });

        // Signed versions are append-only (MySQL triggers in migrations/mysql). Correction = new version with supersedes_id.
        Schema::create('clinical_note_version', function (Blueprint $t) use ($base, $tenantFk) {
            $base($t);
            $t->uuid('note_id');
            $t->unsignedInteger('version');
            $t->uuid('supersedes_id')->nullable();
            $t->text('soap_enc');               // ENCRYPTION_KEY
            $t->char('content_hash', 64);       // SHA-256 of plaintext
            $t->string('reason', 500)->nullable(); // required for corrections
            $t->string('state', 10)->default('draft'); // draft | signed
            $t->foreignUuid('signed_by')->nullable()->constrained('users');
            $t->dateTime('signed_at')->nullable();
            $t->foreignUuid('created_by')->constrained('users');
            $t->timestamps();
            $t->unique(['tenant_id', 'note_id', 'version']);
            $t->unique(['tenant_id', 'supersedes_id']); // one correction per version; NULLs allowed
            $tenantFk($t, 'note_id', 'clinical_note');
            $tenantFk($t, 'supersedes_id', 'clinical_note_version');
        });

        // Odontogram finding (FDI). Final rows append-only; correction = new row with supersedes_id.
        Schema::create('tooth_finding', function (Blueprint $t) use ($base, $tenantFk) {
            $base($t);
            $t->uuid('patient_id');
            $t->uuid('visit_id')->nullable();
            $t->unsignedTinyInteger('tooth');      // FDI, e.g. 11..48, 51..85
            $t->string('surface', 10)->nullable(); // M O D B L (combination)
            $t->string('condition', 40);           // structured code, plaintext by D-020
            $t->string('state', 10)->default('draft'); // draft | final
            $t->uuid('supersedes_id')->nullable();
            $t->foreignUuid('created_by')->constrained('users');
            $t->foreignUuid('finalized_by')->nullable()->constrained('users');
            $t->dateTime('finalized_at')->nullable();
            $t->timestamps();
            $t->unique(['tenant_id', 'supersedes_id']);
            $t->index(['tenant_id', 'patient_id', 'tooth']);
            $tenantFk($t, 'patient_id', 'patient');
            $tenantFk($t, 'supersedes_id', 'tooth_finding');
        });

        // Append-only (triggers + no UPDATE/DELETE grant). Metadata only, never sensitive values.
        Schema::create('audit_event', function (Blueprint $t) use ($base) {
            $base($t);
            $t->timestamp('occurred_at')->useCurrent();
            $t->string('actor_type', 10); // user | agen | sistem
            $t->uuid('actor_id')->nullable();
            $t->string('action', 40);     // buat, baca, akses_ditolak, ...
            $t->string('entity_type', 40);
            $t->uuid('entity_id')->nullable();
            $t->uuid('branch_id')->nullable();
            $t->string('ip', 45)->nullable();
            $t->string('user_agent', 300)->nullable();
            $t->json('detail')->nullable();
            $t->index(['tenant_id', 'entity_type', 'entity_id', 'occurred_at']);
            $t->index(['tenant_id', 'actor_id', 'occurred_at']);
            $t->index(['tenant_id', 'occurred_at']);
        });

        // Seam only (no worker yet): every outbound send (SATUSEHAT, WhatsApp) goes through here.
        Schema::create('outbox', function (Blueprint $t) use ($base) {
            $base($t);
            $t->string('kind', 20); // satusehat | whatsapp
            $t->string('idempotency_key', 191);
            $t->text('payload_enc');
            $t->string('status', 10)->default('pending'); // pending | leased | sent | failed
            $t->unsignedInteger('attempts')->default(0);
            $t->uuid('lease_token')->nullable(); // fence: only the lease holder may write the result
            $t->dateTime('lease_until')->nullable();
            $t->text('last_error')->nullable();
            $t->dateTime('sent_at')->nullable();
            $t->timestamps();
            $t->unique(['tenant_id', 'idempotency_key']);
            $t->index(['tenant_id', 'status', 'created_at']);
        });
    }

    public function down(): void
    {
        foreach (['outbox', 'audit_event', 'tooth_finding', 'clinical_note_version', 'clinical_note', 'visit', 'appointment', 'patient', 'membership', 'chair', 'branch'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
