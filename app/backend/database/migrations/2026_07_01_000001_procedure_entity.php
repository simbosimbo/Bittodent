<?php

// Owning modules: Clinical (procedure_record, procedure_definition), Billing (invoice_line.finding_id -> procedure_id).
// P0 (research opendental-tindakan-odontogram §5): tooth_finding = visual condition; procedure_record = treatment (Open Dental procedurelog).
// One procedure with surfaces "MOD" = one price = one invoice_line. DEVIATIONS #47.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $fk = fn (Blueprint $t, string $col, string $table) => $t->foreign(['tenant_id', $col])->references(['tenant_id', 'id'])->on($table);
        $base = function (Blueprint $t) {
            $t->uuid('tenant_id');
            $t->uuid('id');
            $t->primary(['tenant_id', 'id']);
            $t->foreign('tenant_id')->references('id')->on('tenant');
        };

        // Clinical procedure catalog (Clinical cannot read Tariffs): how a code is charted. Seeded by Domain/ProcedureCatalog.
        Schema::create('procedure_definition', function (Blueprint $t) use ($base) {
            $base($t);
            $t->string('procedure_code', 10);
            $t->string('treat_area', 10); // surface | tooth | range | quadrant | arch | mouth
            $t->string('paint_type', 20); // Filling | Crown | Extraction | ... | Text | Watch
            $t->string('name', 200);
            $t->string('layman', 200)->nullable();
            $t->timestamps();
            $t->unique(['tenant_id', 'procedure_code']);
        });

        // `procedure` is a reserved word in MySQL. Final rows append-only (trigger); change = new row with supersedes_id.
        Schema::create('procedure_record', function (Blueprint $t) use ($base, $fk) {
            $base($t);
            $t->uuid('patient_id');
            $t->uuid('visit_id')->nullable(); // null only for rows migrated from findings without a visit
            $t->string('treat_area', 10);
            $t->unsignedTinyInteger('tooth')->nullable();   // FDI
            $t->string('surfaces', 6)->nullable();          // canonical order M O D I B L, e.g. "MOD"
            $t->string('tooth_range', 20)->nullable();      // "13-23" (treat_area range)
            $t->unsignedTinyInteger('quadrant')->nullable(); // 1-4
            $t->string('arch', 5)->nullable();              // atas | bawah
            $t->string('status', 20);                       // Domain/ProcedureStatus
            $t->string('procedure_code', 10)->nullable();   // ICD-9-CM 2010, plaintext by D-020
            $t->string('variant', 10)->default('standar');
            $t->string('diagnosis_code', 16)->nullable();
            $t->string('diagnosis_source', 10)->nullable();
            $t->foreignUuid('provider_id')->constrained('users'); // dentist who performs it; PriceLookup band
            $t->string('state', 10)->default('draft');      // draft | final | discarded
            $t->string('source', 10)->default('manual');
            $t->uuid('supersedes_id')->nullable();
            $t->foreignUuid('created_by')->constrained('users');
            $t->foreignUuid('finalized_by')->nullable()->constrained('users');
            $t->dateTime('finalized_at')->nullable();
            $t->timestamps();
            $t->unique(['tenant_id', 'supersedes_id']);
            $t->index(['tenant_id', 'patient_id', 'tooth']);
            $t->index(['tenant_id', 'visit_id', 'state']);
            $fk($t, 'patient_id', 'patient');
            $fk($t, 'visit_id', 'visit');
            $fk($t, 'supersedes_id', 'procedure_record');
        });

        self::copyFindings('finding_id');

        // procedure_record.id = tooth_finding.id for migrated rows, so the line keeps its value: rename only, no UPDATE of
        // the append-only invoice_line, no orphan, no duplicate.
        Schema::table('invoice_line', function (Blueprint $t) {
            $t->dropForeign(['tenant_id', 'finding_id']);
            $t->dropUnique(['tenant_id', 'finding_id']);
        });
        Schema::table('invoice_line', fn (Blueprint $t) => $t->renameColumn('finding_id', 'procedure_id'));
        Schema::table('invoice_line', function (Blueprint $t) use ($fk) {
            $t->unique(['tenant_id', 'procedure_id']); // a procedure is billed once
            $fk($t, 'procedure_id', 'procedure_record');
        });
    }

    /**
     * 1:1 copy of every finding that is a treatment (procedure_code, or a status other than kondisi_pantau, or already billed)
     * into procedure_record with the SAME id. Multi-surface history is never merged (we cannot know it was one act).
     * provider = visit dentist, else finalized_by, else created_by. Idempotent (skips ids already copied). Public for the test.
     */
    public static function copyFindings(string $lineColumn): int
    {
        $db = DB::connection();
        $billed = $db->table('invoice_line')->pluck($lineColumn)->flip();
        $done = $db->table('procedure_record')->pluck('id')->flip();
        $rows = $db->table('tooth_finding as f')
            ->leftJoin('visit as v', fn ($j) => $j->on('v.tenant_id', '=', 'f.tenant_id')->on('v.id', '=', 'f.visit_id'))
            ->where(fn ($q) => $q->whereIn('f.state', ['draft', 'final'])->orWhereIn('f.id', $billed->keys()))
            ->where(fn ($q) => $q->whereNotNull('f.procedure_code')->orWhere('f.status', '<>', 'kondisi_pantau')->orWhereIn('f.id', $billed->keys()))
            ->orderBy('f.created_at')->orderBy('f.id') // uuid7: a superseded row is inserted before its successor (FK)
            ->get(['f.*', 'v.dentist_id']);
        $ids = $rows->pluck('id')->flip();
        $n = 0;
        foreach ($rows as $f) {
            if ($done->has($f->id)) {
                continue;
            }
            $db->table('procedure_record')->insert([
                'tenant_id' => $f->tenant_id, 'id' => $f->id, 'patient_id' => $f->patient_id, 'visit_id' => $f->visit_id,
                'treat_area' => $f->surface === null ? 'tooth' : 'surface', 'tooth' => $f->tooth, 'surfaces' => $f->surface,
                'status' => $f->status, 'procedure_code' => $f->procedure_code, 'variant' => $f->variant,
                'diagnosis_code' => $f->diagnosis_code, 'diagnosis_source' => $f->diagnosis_source,
                'provider_id' => $f->dentist_id ?? $f->finalized_by ?? $f->created_by,
                'state' => $f->state, 'source' => $f->source,
                'supersedes_id' => $f->supersedes_id !== null && $ids->has($f->supersedes_id) ? $f->supersedes_id : null,
                'created_by' => $f->created_by, 'finalized_by' => $f->finalized_by, 'finalized_at' => $f->finalized_at,
                'created_at' => $f->created_at, 'updated_at' => $f->updated_at,
            ]);
            $n++;
        }

        return $n;
    }

    /** shortcut: works only while every line still points at a migrated finding id; after new procedures are billed, restore from backup instead. */
    public function down(): void
    {
        Schema::table('invoice_line', function (Blueprint $t) {
            $t->dropForeign(['tenant_id', 'procedure_id']);
            $t->dropUnique(['tenant_id', 'procedure_id']);
        });
        Schema::table('invoice_line', fn (Blueprint $t) => $t->renameColumn('procedure_id', 'finding_id'));
        Schema::table('invoice_line', function (Blueprint $t) {
            $t->unique(['tenant_id', 'finding_id']);
            $t->foreign(['tenant_id', 'finding_id'])->references(['tenant_id', 'id'])->on('tooth_finding'); // ids were copied 1:1
        });
        Schema::dropIfExists('procedure_record');
        Schema::dropIfExists('procedure_definition');
    }
};
