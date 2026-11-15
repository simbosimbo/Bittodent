<?php

namespace App\Modules\Clinical\Services;

use App\Modules\Clinical\Contracts\CodingRefused;
use App\Modules\Clinical\Contracts\IcdSystem;
use App\Modules\Clinical\Contracts\VisitCoding;
use App\Modules\Clinical\Domain\Soap;
use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\ClinicalNoteVersion;
use App\Modules\Clinical\Models\ToothFinding;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Tenancy\Ctx;
use Illuminate\Support\Facades\DB;

// A1 seam into the SOAP note: reads, and appends ONE code to the open draft. Same draft rules as NoteController::save
// (author = visit dentist, revision bump); a signed version is never touched, no outbox, S/O/text never change.
final class VisitCodingService implements VisitCoding
{
    private const MAX_CODES = 10; // Soap::rules() max:10 per block

    public function __construct(private PatientDirectory $patients, private UserDirectory $users) {}

    public function visit(string $visitId): ?array
    {
        $v = Visit::find($visitId);

        return $v ? ['id' => $v->id, 'patient_id' => $v->patient_id, 'branch_id' => $v->branch_id, 'dentist_id' => $v->dentist_id, 'open' => self::isOpen($v)] : null;
    }

    public function openVisitOf(string $patientId): ?string
    {
        return Visit::where('patient_id', $patientId)->where('status', 'berlangsung')->orderByDesc('started_at')->get()
            ->first(fn (Visit $v) => self::isOpen($v))?->id;
    }

    public function signedFindings(string $patientId): array
    {
        $rows = ToothFinding::where('patient_id', $patientId)->where('state', 'final')->orderBy('finalized_at')->orderBy('id')->get();
        $byId = $rows->keyBy('id');
        $superseded = $rows->pluck('supersedes_id')->filter()->flip();
        $depth = function (ToothFinding $f) use ($byId): int {
            for ($n = 1; $f->supersedes_id !== null && ($f = $byId->get($f->supersedes_id)) !== null && $n < 100; $n++);

            return $n;
        };

        return $rows->reject(fn ($f) => $superseded->has($f->id))->keyBy(fn ($f) => $f->tooth.'-'.$f->surface)->values()
            ->map(fn (ToothFinding $f) => ['id' => $f->id, 'version' => $depth($f), 'tooth' => (int) $f->tooth, 'surface' => $f->surface,
                'condition' => $f->condition, 'status' => $f->status, 'procedure_code' => $f->procedure_code])
            ->all();
    }

    public function openDraftNote(string $visitId): ?array
    {
        $draft = ClinicalNote::where('visit_id', $visitId)->orderBy('created_at')->first()?->versions->firstWhere('state', 'draft');
        if (! $draft) {
            return null;
        }
        $soap = Soap::normalize($draft->soap());

        return ['version_id' => $draft->id, 'revision' => $draft->revision, 'A' => $soap['A'], 'P' => $soap['P']];
    }

    public function redactionTerms(string $visitId): array
    {
        $v = Visit::findOrFail($visitId);
        $names = [$this->patients->summary($v->patient_id)['name'], ...array_column($this->users->namesByIds([$v->dentist_id]), 'name')];
        $words = preg_split('/[\s.,]+/u', implode(' ', $names), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return array_values(array_unique([...$names, ...array_filter($words, fn ($w) => mb_strlen($w) >= 3 && mb_strtolower($w) !== 'drg')]));
    }

    public function addDraftCode(string $visitId, IcdSystem $system, string $code): array
    {
        if (! $system->validFormat($code)) {
            throw new CodingRefused(CodingRefused::BAD_CODE);
        }
        $ctx = Ctx::current();

        return DB::transaction(function () use ($visitId, $system, $code, $ctx) {
            $visit = Visit::lockForUpdate()->find($visitId) ?? throw new CodingRefused(CodingRefused::NOT_FOUND);
            if (! $ctx->coversBranch($visit->branch_id)) {
                throw new CodingRefused(CodingRefused::BRANCH);
            }
            if (! self::isOpen($visit)) {
                throw new CodingRefused(CodingRefused::VISIT_CLOSED);
            }
            $note = ClinicalNote::where('visit_id', $visitId)->orderBy('created_at')->first()
                ?? ClinicalNote::create(['visit_id' => $visitId, 'patient_id' => $visit->patient_id, 'author_id' => $visit->dentist_id, 'first_input_at' => now()]);
            $draft = $note->versions->firstWhere('state', 'draft')
                ?? new ClinicalNoteVersion(['note_id' => $note->id, 'version' => 1, 'revision' => 0, 'state' => 'draft', 'source' => 'ai_draft', 'created_by' => $ctx->userId]);
            $soap = $draft->exists ? Soap::normalize($draft->soap()) : Soap::normalize([]);
            $block = $system->soapBlock();
            if (in_array($code, $soap[$block]['codes'], true)) {
                return ['version_id' => $draft->id, 'revision' => $draft->revision, 'codes' => $soap[$block]['codes'], 'added' => false];
            }
            if (count($soap[$block]['codes']) >= self::MAX_CODES) {
                throw new CodingRefused(CodingRefused::TOO_MANY);
            }
            $soap[$block]['codes'][] = $code;
            $draft->setSoap($soap)->fill(['revision' => $draft->revision + 1])->save();
            Audit::log($draft->revision === 1 ? 'buat' : 'ubah', 'clinical_note_version', $draft->id,
                ['revision' => $draft->revision, 'source' => 'ai_draft', 'block' => $block]);

            return ['version_id' => $draft->id, 'revision' => $draft->revision, 'codes' => $soap[$block]['codes'], 'added' => true];
        });
    }

    private static function isOpen(Visit $v): bool
    {
        return $v->status === 'berlangsung'
            && ! ClinicalNote::where('visit_id', $v->id)->whereHas('versions', fn ($q) => $q->where('state', 'signed'))->exists();
    }
}
