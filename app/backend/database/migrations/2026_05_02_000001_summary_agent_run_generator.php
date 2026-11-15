<?php

// Owning module: Agents (agent_run). PR #1 design 2.8: generator (llm | deterministik) and redactions (count of PII replacements).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agent_run', function (Blueprint $t) {
            $t->string('generator', 15)->default('llm')->after('prompt_version');
            $t->unsignedSmallInteger('redactions')->nullable()->after('claims_dropped');
        });
    }

    public function down(): void
    {
        Schema::table('agent_run', fn (Blueprint $t) => $t->dropColumn(['generator', 'redactions']));
    }
};
