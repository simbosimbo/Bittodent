<?php

// Owning module: Agents (agent_run, agent_draft). MySQL only.

use Database\Support\MysqlGrants;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// ehr_app: SELECT/INSERT/UPDATE, no DELETE. Triggers (even for ehr_admin):
// - agent_run: completed once (no UPDATE after finished_at), identity/hash columns never change, never deleted; region CHECK (D-009).
// - agent_draft: a reviewed/superseded draft never changes again (except a one-time purge of an expired ringkasan), never deleted.
// PostgreSQL equivalent: same GRANTs; CHECK (region IN (...)); plpgsql BEFORE UPDATE/DELETE guards, BEFORE TRUNCATE reject_truncate().
return new class extends Migration
{
    public function up(): void
    {
        MysqlGrants::grant('SELECT, INSERT, UPDATE', 'agent_run', 'agent_draft');

        $regions = implode(', ', array_map(fn ($r) => "'".str_replace("'", '', $r)."'", config('ai.allowed_regions')));
        $sql = [
            "ALTER TABLE agent_run ADD CONSTRAINT agent_run_region_indonesia CHECK (region IN ($regions))",
            "CREATE TRIGGER agent_run_complete_once BEFORE UPDATE ON agent_run FOR EACH ROW
             BEGIN
               IF OLD.finished_at IS NOT NULL THEN
                 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'agent_run sudah selesai; tidak boleh diubah';
               END IF;
               IF NEW.input_hash <> OLD.input_hash OR NEW.agent <> OLD.agent OR NEW.model_id <> OLD.model_id
                  OR NEW.region <> OLD.region OR NEW.started_at <> OLD.started_at THEN
                 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'identitas agent_run tidak boleh diubah';
               END IF;
             END",
            "CREATE TRIGGER agent_draft_no_update_reviewed BEFORE UPDATE ON agent_draft FOR EACH ROW
             BEGIN
               -- Only exception: emptying an expired `ringkasan` once (it is a reading aid, not a medical record).
               IF NOT (OLD.kind = 'ringkasan' AND OLD.state = 'kedaluwarsa' AND OLD.purged_at IS NULL
                       AND NEW.payload_enc IS NULL AND NEW.source_spans_enc IS NULL AND NEW.purged_at IS NOT NULL
                       AND NEW.state = OLD.state AND NEW.kind = OLD.kind) THEN
                 IF OLD.state <> 'menunggu_review' THEN
                   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'draf agen sudah ditinjau; tidak boleh diubah';
                 END IF;
                 IF NOT (NEW.payload_enc <=> OLD.payload_enc) OR NEW.kind <> OLD.kind OR NEW.run_id <> OLD.run_id THEN
                   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'isi draf agen tidak boleh ditimpa; buat draf baru';
                 END IF;
               END IF;
             END",
        ];
        foreach (['agent_run', 'agent_draft'] as $t) {
            $sql[] = "CREATE TRIGGER {$t}_no_delete BEFORE DELETE ON $t FOR EACH ROW
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '$t tidak boleh dihapus'";
        }
        foreach ($sql as $s) {
            DB::unprepared($s);
        }
    }

    public function down(): void {}
};
