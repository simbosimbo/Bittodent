<?php

// Owning module: Patients (denormalized care facts on `patient`). Spec: docs/database.md 3.2 (last_visit_at = retention clock).

use App\Modules\Patients\Domain\CareFacts;
use App\Modules\Patients\Domain\CareStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Facts are PUSHED by Clinical/Scheduling through Patients\Contracts\PatientCareState; Patients never reads their tables.
// last_dentist_name is denormalized because Patients may not call Identity. care_status is derived by Patients\Domain\CareStatus.
// No new table => no new grants (ehr_app already has UPDATE on patient).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patient', function (Blueprint $t) {
            $t->dateTime('last_visit_at')->nullable();         // UTC
            $t->uuid('last_dentist_id')->nullable();
            $t->string('last_dentist_name', 200)->nullable();
            $t->string('care_status', 20)->default('tidak_aktif'); // dalam_perawatan | perlu_kontrol | tidak_aktif
            $t->boolean('care_open_visit')->default(false);           // from Clinical
            $t->boolean('care_unfinished_procedure')->default(false); // from Clinical
            $t->dateTime('next_appointment_at')->nullable();           // from Scheduling (UTC)
            $t->boolean('care_unscheduled_plan')->default(false);     // from Scheduling
            // List filters keep the keyset order (created_at, id) in the index.
            $t->index(['tenant_id', 'care_status', 'created_at', 'id']);
            $t->index(['tenant_id', 'last_dentist_id', 'created_at', 'id']);
            $t->index(['tenant_id', 'last_visit_at']);
        });

        // Backfill (fresh installs have no rows; seeds call the contract). Every predicate carries tenant_id.
        $todayUtc = CarbonImmutable::now(CareStatus::TIMEZONE)->startOfDay()->utc();
        foreach (DB::table('patient')->distinct()->pluck('tenant_id') as $tenant) {
            foreach (DB::table('patient')->where('tenant_id', $tenant)->get(['id', 'status']) as $p) {
                $key = fn ($q) => $q->where('tenant_id', $tenant)->where('patient_id', $p->id);
                $v = DB::table('visit')->where($key)->orderByDesc('started_at')->first(['dentist_id', 'started_at', 'ended_at', 'status']);
                $last = $v ? ($v->status === 'selesai' && $v->ended_at ? $v->ended_at : $v->started_at) : null;
                $superseded = DB::table('tooth_finding')->where($key)->whereNotNull('supersedes_id')->pluck('supersedes_id');
                $facts = [
                    'last_visit_at' => $last,
                    'last_dentist_id' => $v?->dentist_id,
                    'last_dentist_name' => $v ? DB::table('users')->where('id', $v->dentist_id)->value('name') : null,
                    'care_open_visit' => DB::table('visit')->where($key)->where('status', 'berlangsung')->exists(),
                    'care_unfinished_procedure' => DB::table('tooth_finding')->where($key)->where('state', 'final')
                        ->where('status', 'direncanakan')->whereNotIn('id', $superseded)->exists(),
                    'next_appointment_at' => DB::table('appointment')->where($key)->whereNotIn('status', ['cancelled', 'no_show'])
                        ->where('starts_at', '>=', $todayUtc)->min('starts_at'),
                    'care_unscheduled_plan' => DB::table('planned_appointment')->where($key)->where('status', 'perlu_dijadwalkan')->exists(),
                ];
                $facts['care_status'] = CareStatus::of(new CareFacts($p->status, $facts['care_open_visit'],
                    $facts['next_appointment_at'] ? CarbonImmutable::parse($facts['next_appointment_at'], 'UTC') : null,
                    $facts['care_unfinished_procedure'], $facts['care_unscheduled_plan'], $last ? CarbonImmutable::parse($last, 'UTC') : null), now());
                DB::table('patient')->where('tenant_id', $tenant)->where('id', $p->id)->update($facts);
            }
        }
    }

    public function down(): void
    {
        Schema::table('patient', function (Blueprint $t) {
            $t->dropIndex(['tenant_id', 'care_status', 'created_at', 'id']);
            $t->dropIndex(['tenant_id', 'last_dentist_id', 'created_at', 'id']);
            $t->dropIndex(['tenant_id', 'last_visit_at']);
            $t->dropColumn(['last_visit_at', 'last_dentist_id', 'last_dentist_name', 'care_status', 'care_open_visit',
                'care_unfinished_procedure', 'next_appointment_at', 'care_unscheduled_plan']);
        });
    }
};
