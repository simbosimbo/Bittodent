<?php

// Owning module: Identity (users, auth_event via Shared\Audit), framework (sessions, cache, jobs), Tenancy (tenant).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Global (non-tenant) tables: login identity, sessions, queue, cache, auth log, tenant root.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name', 200);
            $t->string('email', 191)->unique();
            $t->timestamp('email_verified_at')->nullable();
            $t->string('password');
            $t->rememberToken();
            $t->string('license_type', 20)->default('lainnya'); // dokter_gigi | lainnya
            $t->text('two_factor_secret')->nullable();          // Fortify, encrypted with APP_KEY
            $t->text('two_factor_recovery_codes')->nullable();
            $t->timestamp('two_factor_confirmed_at')->nullable();
            $t->timestamps();
        });

        Schema::create('sessions', function (Blueprint $t) {
            $t->string('id')->primary();
            $t->foreignUuid('user_id')->nullable()->index();
            $t->string('ip_address', 45)->nullable();
            $t->text('user_agent')->nullable();
            $t->longText('payload');
            $t->integer('last_activity')->index();
        });

        Schema::create('cache', function (Blueprint $t) {
            $t->string('key')->primary();
            $t->mediumText('value');
            $t->bigInteger('expiration')->index();
        });
        Schema::create('cache_locks', function (Blueprint $t) {
            $t->string('key')->primary();
            $t->string('owner');
            $t->bigInteger('expiration')->index();
        });

        Schema::create('jobs', function (Blueprint $t) {
            $t->id();
            $t->string('queue')->index();
            $t->longText('payload');
            $t->unsignedTinyInteger('attempts');
            $t->unsignedInteger('reserved_at')->nullable();
            $t->unsignedInteger('available_at');
            $t->unsignedInteger('created_at');
        });
        Schema::create('failed_jobs', function (Blueprint $t) {
            $t->id();
            $t->string('uuid')->unique();
            $t->text('connection');
            $t->text('queue');
            $t->longText('payload');
            $t->longText('exception');
            $t->timestamp('failed_at')->useCurrent();
        });

        // Login happens before a tenant is chosen, so auth events live here. No PII: email only as HMAC.
        Schema::create('auth_event', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->timestamp('occurred_at')->useCurrent();
            $t->string('action', 40); // login, login_gagal, 2fa_gagal, logout
            $t->uuid('user_id')->nullable();
            $t->string('email_hash', 64)->nullable();
            $t->string('ip', 45)->nullable();
            $t->string('user_agent', 300)->nullable();
            $t->index(['user_id', 'occurred_at']);
        });

        Schema::create('tenant', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name', 200);
            $t->string('mode', 20)->default('standar'); // sederhana | standar (D-007)
            $t->boolean('is_demo')->default(false);
            $t->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['tenant', 'auth_event', 'failed_jobs', 'jobs', 'cache_locks', 'cache', 'sessions', 'users'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
