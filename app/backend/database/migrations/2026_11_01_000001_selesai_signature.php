<?php

// Selesai = tanda tangan elektronik (DEVIATIONS #54). Owning modules: Clinical (signature + approval columns), Tenancy
// (tenant.selesai_pin_required), Identity (users.selesai_pin_*: the PIN belongs to the person, so it lives on the global users row).
// Signature on the signed clinical_note_version row itself (not a separate table): it is written once in the same UPDATE that
// moves draft -> signed, after which the existing cnv_no_update_signed trigger freezes it. content_hash stays SOAP-only (#23).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const APPROVABLE = ['clinical_note_version', 'tooth_finding', 'procedure_record'];

    public function up(): void
    {
        Schema::table('clinical_note_version', function (Blueprint $t) {
            $t->char('signature_hash', 64)->nullable()->after('content_hash'); // SHA-256 of SelesaiSignature::canonical (SOAP + procedures + diagnoses)
            $t->unsignedSmallInteger('attestation_version')->nullable()->after('signature_hash');
            $t->string('attestation_text', 300)->nullable()->after('attestation_version'); // server-side wording of that version
        });
        // explicit "Setujui" of an agent draft; source stays ai_draft for provenance
        foreach (self::APPROVABLE as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->foreignUuid('approved_by')->nullable()->constrained('users');
                $t->timestamp('approved_at')->nullable();
            });
        }
        Schema::table('tenant', fn (Blueprint $t) => $t->boolean('selesai_pin_required')->default(false)->after('correction_window_hours'));
        Schema::table('users', function (Blueprint $t) {
            $t->string('selesai_pin_hash')->nullable();                      // Hash::make (framework default); never returned or logged
            $t->unsignedTinyInteger('selesai_pin_failures')->default(0);     // consecutive wrong PINs
            $t->timestamp('selesai_pin_locked_until')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn(['selesai_pin_hash', 'selesai_pin_failures', 'selesai_pin_locked_until']));
        Schema::table('tenant', fn (Blueprint $t) => $t->dropColumn('selesai_pin_required'));
        foreach (self::APPROVABLE as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->dropConstrainedForeignId('approved_by');
                $t->dropColumn('approved_at');
            });
        }
        Schema::table('clinical_note_version', fn (Blueprint $t) => $t->dropColumn(['signature_hash', 'attestation_version', 'attestation_text']));
    }
};
