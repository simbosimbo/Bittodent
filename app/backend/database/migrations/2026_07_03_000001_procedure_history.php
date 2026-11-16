<?php

// Owning module: Clinical. Unit 3 (DEVIATIONS #49): append-only procedure history.
// reason: required on a replace (both the `superseded` marker row and the new work row) and on a correction; plaintext like
// clinical_note_version.reason (precedent; DPIA item). replaces_id: the new work row points at the restoration it replaces.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('procedure_record', function (Blueprint $t) {
            $t->string('reason', 500)->nullable()->after('supersedes_id');
            $t->uuid('replaces_id')->nullable()->after('reason');
            $t->index(['tenant_id', 'replaces_id']);
            $t->foreign(['tenant_id', 'replaces_id'])->references(['tenant_id', 'id'])->on('procedure_record');
        });
    }

    public function down(): void
    {
        Schema::table('procedure_record', function (Blueprint $t) {
            $t->dropForeign(['tenant_id', 'replaces_id']);
            $t->dropIndex(['tenant_id', 'replaces_id']);
            $t->dropColumn(['reason', 'replaces_id']);
        });
    }
};
