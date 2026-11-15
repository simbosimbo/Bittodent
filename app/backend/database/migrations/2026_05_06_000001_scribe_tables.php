<?php

// Owning module: Scribe (scribe_session). clinic_ai_setting is shared with A1/A4: create only when missing, then add monthly_token_cap if absent.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('clinic_ai_setting')) {
            Schema::create('clinic_ai_setting', function (Blueprint $t) {
                $t->uuid('tenant_id')->primary();
                $t->foreign('tenant_id')->references('id')->on('tenant');
                $t->boolean('paid_enabled')->default(false);
                $t->timestamps();
            });
        }
        if (! Schema::hasColumn('clinic_ai_setting', 'monthly_token_cap')) {
            Schema::table('clinic_ai_setting', function (Blueprint $t) {
                $t->unsignedInteger('monthly_token_cap')->nullable()->after('paid_enabled');
            });
        }

        $fk = fn (Blueprint $t, string $col, string $table) => $t->foreign(['tenant_id', $col])->references(['tenant_id', 'id'])->on($table);
        Schema::create('scribe_session', function (Blueprint $t) use ($fk) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->foreign('tenant_id')->references('id')->on('tenant');
            $t->uuid('visit_id');
            $t->foreignUuid('dentist_id')->constrained('users');
            $t->string('state', 20);
            $t->string('mime', 80);
            $t->unsignedInteger('duration_sec');
            $t->string('audio_key', 64)->nullable();
            $t->longText('transcript_enc')->nullable();
            $t->string('error_code', 40)->nullable();
            $t->string('stt_driver', 80)->nullable();
            $t->uuid('soap_run_id')->nullable();
            $t->dateTime('audio_deleted_at')->nullable();
            $t->timestamps();
            $t->index(['tenant_id', 'visit_id', 'created_at']);
            $fk($t, 'visit_id', 'visit');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scribe_session');
        // clinic_ai_setting may be owned by A1/A4 after merge — do not drop it here.
    }
};
