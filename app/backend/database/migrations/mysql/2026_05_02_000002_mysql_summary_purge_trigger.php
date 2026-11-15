<?php

// Owning module: Agents (agent_draft). MySQL only. Replaces agent_draft_no_update_reviewed (A0) so that a superseded
// `ringkasan` can be emptied after expiry too (design 2.8/5.5), not only an expired one. Everything else unchanged.
// PostgreSQL equivalent: same condition in the plpgsql BEFORE UPDATE guard.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS agent_draft_no_update_reviewed');
        DB::unprepared("CREATE TRIGGER agent_draft_no_update_reviewed BEFORE UPDATE ON agent_draft FOR EACH ROW
             BEGIN
               -- Only exception: emptying an expired or superseded `ringkasan` once (a reading aid, not a medical record).
               IF NOT (OLD.kind = 'ringkasan' AND OLD.state IN ('kedaluwarsa', 'digantikan') AND OLD.purged_at IS NULL
                       AND NEW.payload_enc IS NULL AND NEW.source_spans_enc IS NULL AND NEW.purged_at IS NOT NULL
                       AND NEW.state = OLD.state AND NEW.kind = OLD.kind) THEN
                 IF OLD.state <> 'menunggu_review' THEN
                   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'draf agen sudah ditinjau; tidak boleh diubah';
                 END IF;
                 IF NOT (NEW.payload_enc <=> OLD.payload_enc) OR NEW.kind <> OLD.kind OR NEW.run_id <> OLD.run_id THEN
                   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'isi draf agen tidak boleh ditimpa; buat draf baru';
                 END IF;
               END IF;
             END");
    }

    public function down(): void {}
};
