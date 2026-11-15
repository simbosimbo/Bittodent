<?php

// Owning module: Platform (platform_admins, platform_impersonation) + Shared\Audit (platform_audit_log). DEVIATIONS #61.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Platform tables are NOT tenant tables: no `tenant_id` column (the clinic is `target_tenant_id`), no BelongsToTenant.
// They are read across clinics by the platform only, never by tenant code.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_admins', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name', 200);
            $t->string('email', 191)->unique();
            $t->string('password');
            $t->text('totp_secret')->nullable(); // encrypted with APP_KEY; null = cannot log in (TOTP mandatory)
            $t->json('permissions');             // e.g. ["platform.impersonate"]
            $t->timestamps();
        });

        // Server-side truth of an impersonation; the session only holds this row's id. Ended rows are frozen (MySQL trigger).
        Schema::create('platform_impersonation', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('platform_admin_id')->constrained('platform_admins');
            $t->foreignUuid('target_tenant_id')->constrained('tenant');
            $t->foreignUuid('target_user_id')->constrained('users');
            $t->timestamp('started_at')->useCurrent();
            $t->timestamp('ended_at')->nullable();
            $t->string('end_reason', 40)->nullable();
            $t->index(['platform_admin_id', 'started_at']);
        });

        // Append-only. Metadata only: no request bodies, no NIK, no clinical text.
        Schema::create('platform_audit_log', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->timestamp('created_at')->useCurrent();
            $t->uuid('platform_admin_id')->nullable();
            $t->uuid('impersonation_id')->nullable();
            $t->uuid('on_behalf_of_user_id')->nullable();
            $t->uuid('target_tenant_id')->nullable();
            $t->uuid('branch_id')->nullable();
            $t->string('action', 60);
            $t->string('subject_type', 120)->nullable();
            $t->string('subject_id', 64)->nullable();
            $t->json('detail')->nullable();
            $t->string('ip', 45)->nullable();
            $t->string('user_agent', 300)->nullable();
            $t->string('method', 10)->nullable();
            $t->string('path', 300)->nullable();
            $t->string('request_id', 64)->nullable();
            $t->index(['target_tenant_id', 'created_at']);
            $t->index(['platform_admin_id', 'created_at']);
        });
    }

    public function down(): void
    {
        foreach (['platform_audit_log', 'platform_impersonation', 'platform_admins'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
