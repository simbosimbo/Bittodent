<?php

// UNIT C3 (docs/research/opendental-schema-gaps.md §1). Owning modules:
// Clinical (tooth_finding.status/procedure_code, tooth_baseline, consent_record), Patients (household, patient.household_id/guarantor_id,
// guardian, medical_history_version), Scheduling (appointment arrived/seated/dismissed, planned_appointment), Recall (reminder_log),
// Tariffs (tariff), Billing (invoice, invoice_line, invoice_adjustment).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $fk = fn (Blueprint $t, string $col, string $table) => $t->foreign(['tenant_id', $col])->references(['tenant_id', 'id'])->on($table);
        $base = function (Blueprint $t) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->foreign('tenant_id')->references('id')->on('tenant');
        };

        // 1. Procedure status, separate from condition (App\Modules\Clinical\Domain\ProcedureStatus).
        Schema::table('tooth_finding', function (Blueprint $t) {
            $t->string('status', 20)->default('kondisi_pantau')->after('condition');
            $t->string('procedure_code', 10)->nullable()->after('status'); // ICD-9-CM, plaintext by D-020
            $t->string('variant', 10)->default('standar')->after('procedure_code'); // tingkat kesulitan (clinical), standar | sulit
        });

        // 2. Baseline (first visit): one row per change, never updated. teeth = {"18": "hilang", "55": "belum_tumbuh"} (default ada).
        Schema::create('tooth_baseline', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('patient_id');
            $t->unsignedInteger('version');
            $t->string('dentition', 10); // tetap | sulung | campuran
            $t->json('teeth');           // structured codes only (D-020)
            $t->foreignUuid('created_by')->constrained('users');
            $t->timestamps();
            $t->unique(['tenant_id', 'patient_id', 'version']);
            $fk($t, 'patient_id', 'patient');
        });

        // 3. Family / guarantor / guardian.
        Schema::create('household', function (Blueprint $t) use ($base) {
            $base($t);
            $t->string('name', 200);
            $t->uuid('created_by')->nullable();
            $t->timestamps();
        });
        Schema::table('patient', function (Blueprint $t) use ($fk) {
            $t->uuid('household_id')->nullable()->after('home_branch_id');
            $t->uuid('guarantor_id')->nullable()->after('household_id'); // penanggung biaya (another patient, or NULL = self)
            $t->index(['tenant_id', 'household_id']);
            $fk($t, 'household_id', 'household');
            $fk($t, 'guarantor_id', 'patient');
        });
        Schema::create('guardian', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('patient_id');
            $t->string('name', 200);              // plaintext like patient.name (D-020)
            $t->string('relationship', 20);       // ayah | ibu | kakek_nenek | saudara | wali_lain
            $t->uuid('guardian_patient_id')->nullable();
            $t->text('nik_enc')->nullable();
            $t->char('nik_bidx', 64)->nullable();
            $t->text('phone_enc')->nullable();
            $t->char('phone_bidx', 64)->nullable();
            $t->uuid('created_by')->nullable();
            $t->timestamps();
            $t->unique(['tenant_id', 'id', 'patient_id']);
            $t->index(['tenant_id', 'patient_id']);
            $t->index(['tenant_id', 'nik_bidx']);
            $fk($t, 'patient_id', 'patient');
            $fk($t, 'guardian_patient_id', 'patient');
        });

        // Consent record (D-012 minimal: who signed, witness, device, document hash). signer = pasien | wali (guardian_id required).
        Schema::create('consent_record', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('patient_id');
            $t->uuid('visit_id')->nullable();
            $t->string('kind', 40);
            $t->string('signer', 10);
            $t->uuid('guardian_id')->nullable();
            $t->char('document_hash', 64);
            $t->string('witness_name', 200)->nullable();
            $t->string('device', 200)->nullable();
            $t->dateTime('signed_at');
            $t->foreignUuid('created_by')->constrained('users');
            $t->timestamps();
            $t->index(['tenant_id', 'patient_id', 'signed_at']);
            $fk($t, 'patient_id', 'patient');
            $fk($t, 'visit_id', 'visit');
            $t->foreign(['tenant_id', 'guardian_id', 'patient_id'])->references(['tenant_id', 'id', 'patient_id'])->on('guardian');
        });

        // 4. Medical history: every change = new version (append-only trigger). Content encrypted; premed flag plaintext for the header.
        Schema::create('medical_history_version', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('patient_id');
            $t->unsignedInteger('version');
            $t->text('content_enc'); // {medications[], problems[], allergies[], urgent_note}
            $t->boolean('premedication_required')->default(false);
            $t->foreignUuid('created_by')->constrained('users');
            $t->timestamps();
            $t->unique(['tenant_id', 'patient_id', 'version']);
            $fk($t, 'patient_id', 'patient');
        });

        // 5 + 6. Appointment timestamps (set by transitions) and planned appointments.
        Schema::table('appointment', function (Blueprint $t) {
            $t->dateTime('arrived_at')->nullable()->after('status');
            $t->dateTime('seated_at')->nullable()->after('arrived_at');
            $t->dateTime('dismissed_at')->nullable()->after('seated_at');
        });
        Schema::create('planned_appointment', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('patient_id');
            $t->uuid('branch_id');
            $t->foreignUuid('dentist_id')->constrained('users');
            $t->string('procedure_code', 10)->nullable(); // ICD-9-CM
            $t->text('procedure_enc');                    // label, encrypted (may name a tooth/condition)
            $t->text('note_enc')->nullable();
            $t->unsignedSmallInteger('est_minutes');
            $t->string('priority', 10)->default('normal'); // normal | segera
            $t->string('status', 20)->default('perlu_dijadwalkan'); // perlu_dijadwalkan | dijadwalkan
            $t->uuid('appointment_id')->nullable();
            $t->foreignUuid('created_by')->constrained('users');
            $t->uuid('scheduled_by')->nullable();
            $t->timestamps();
            $t->unique(['tenant_id', 'appointment_id']);
            $t->index(['tenant_id', 'branch_id', 'status', 'created_at']);
            $fk($t, 'patient_id', 'patient');
            $fk($t, 'branch_id', 'branch');
            $fk($t, 'appointment_id', 'appointment');
        });

        // 7. Reminder log (append-only). Idempotency = appointment + kind + scheduled_for (due time of that slot).
        Schema::create('reminder_log', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('appointment_id');
            $t->string('kind', 20);    // h_minus_1 | h_minus_2jam
            $t->string('channel', 10); // noop (whatsapp later, via outbox)
            $t->dateTime('scheduled_for');
            $t->dateTime('appointment_starts_at');
            $t->dateTime('sent_at');
            $t->timestamp('created_at')->nullable();
            $t->unique(['tenant_id', 'appointment_id', 'kind', 'scheduled_for']);
            $fk($t, 'appointment_id', 'appointment');
        });

        // 8. Tariffs + billing. Integer rupiah everywhere.
        Schema::create('tariff', function (Blueprint $t) use ($base) {
            $base($t);
            $t->string('procedure_code', 10);
            $t->string('name', 200);
            $t->string('variant', 10)->default('standar'); // standar | sulit
            $t->unsignedBigInteger('price_rp');
            $t->date('valid_from');
            $t->date('valid_to')->nullable(); // exclusive; NULL = open
            $t->timestamps();
            $t->unique(['tenant_id', 'procedure_code', 'variant', 'valid_from']);
        });
        Schema::create('invoice', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('visit_id');
            $t->uuid('patient_id');
            $t->uuid('payer_patient_id'); // guarantor at creation (self when none)
            $t->uuid('branch_id');
            $t->string('status', 10)->default('terbuka');
            $t->foreignUuid('created_by')->constrained('users');
            $t->timestamps();
            $t->unique(['tenant_id', 'visit_id']);
            $fk($t, 'visit_id', 'visit');
            $fk($t, 'patient_id', 'patient');
            $fk($t, 'payer_patient_id', 'patient');
            $fk($t, 'branch_id', 'branch');
        });
        Schema::create('invoice_line', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('invoice_id');
            $t->uuid('finding_id');           // source procedure (tooth_finding with status selesai)
            $t->string('procedure_code', 10);
            $t->string('variant', 10);
            $t->unsignedTinyInteger('tooth')->nullable();
            $t->unsignedBigInteger('price_rp'); // snapshot
            $t->timestamp('created_at')->nullable();
            $t->unique(['tenant_id', 'finding_id']); // a procedure is billed once
            $t->index(['tenant_id', 'invoice_id']);
            $fk($t, 'invoice_id', 'invoice');
            $fk($t, 'finding_id', 'tooth_finding');
        });
        Schema::create('invoice_adjustment', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('invoice_id');
            $t->string('kind', 12);      // discount | write_off | correction
            $t->bigInteger('amount_rp'); // subtracted from the balance (correction may be negative)
            $t->string('reason', 500);
            $t->foreignUuid('created_by')->constrained('users');
            $t->timestamp('created_at')->nullable();
            $t->index(['tenant_id', 'invoice_id']);
            $fk($t, 'invoice_id', 'invoice');
        });
    }

    public function down(): void
    {
        foreach (['invoice_adjustment', 'invoice_line', 'invoice', 'tariff', 'reminder_log', 'planned_appointment',
            'medical_history_version', 'consent_record', 'guardian', 'tooth_baseline'] as $t) {
            Schema::dropIfExists($t);
        }
        Schema::table('appointment', fn (Blueprint $t) => $t->dropColumn(['arrived_at', 'seated_at', 'dismissed_at']));
        Schema::table('patient', function (Blueprint $t) {
            $t->dropForeign(['tenant_id', 'household_id']);
            $t->dropForeign(['tenant_id', 'guarantor_id']);
            $t->dropColumn(['household_id', 'guarantor_id']);
        });
        Schema::dropIfExists('household');
        Schema::table('tooth_finding', fn (Blueprint $t) => $t->dropColumn(['status', 'procedure_code', 'variant']));
    }
};
