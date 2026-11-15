<?php

// Owning module: IcdSuggestions (icd_entry, icd_synonym: GLOBAL, no tenant_id). Plus clinic_ai_setting (paid-AI switch,
// shared with A4 KTP): created only when missing, so A1 and A4 can merge in either order.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Official SATUSEHAT terminology rows, copied verbatim (code, English display, version). Import/seed via mysql_admin only.
        Schema::create('icd_entry', function (Blueprint $t) {
            $t->id();
            $t->string('system', 6);                 // icd10 | icd9cm
            $t->string('code', 10);
            $t->string('display', 255);
            $t->string('version', 20);               // ICD10_2010 | ICD9CM_2010
            $t->boolean('perlu_dicek')->default(true);
            $t->timestamps();
            $t->unique(['system', 'code']);
            $t->fullText('display');
        });

        // Unofficial Indonesian glosses for retrieval only (never shown as the official title).
        Schema::create('icd_synonym', function (Blueprint $t) {
            $t->id();
            $t->string('term', 100);
            $t->string('system', 6);
            $t->string('code', 10);
            $t->boolean('perlu_dicek')->default(true);
            $t->timestamps();
            $t->unique(['term', 'system', 'code']);
            $t->foreign(['system', 'code'])->references(['system', 'code'])->on('icd_entry');
            $t->fullText('term');
        });

        if (! Schema::hasTable('clinic_ai_setting')) {
            // Per-clinic paid-AI switch. No row = config('ai.paid_ai.default') (off). Same shape as A4 (2026_05_04_000001_ktp_tables).
            Schema::create('clinic_ai_setting', function (Blueprint $t) {
                $t->uuid('tenant_id')->primary();
                $t->foreign('tenant_id')->references('id')->on('tenant');
                $t->boolean('paid_enabled')->default(false);
                $t->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('icd_synonym');
        Schema::dropIfExists('icd_entry');
        // clinic_ai_setting is left alone: A4 may own it too.
    }
};
