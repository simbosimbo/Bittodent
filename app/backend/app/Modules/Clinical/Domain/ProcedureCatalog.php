<?php

namespace App\Modules\Clinical\Domain;

use App\Modules\Clinical\Models\ProcedureDefinition;
use App\Shared\Terminology\IcdCatalog;
use LogicException;

// Clinical procedure catalog starter (how a code is charted; NOT prices, those live in Tariffs). Editable per tenant later.
// Codes are official ICD-9-CM 2010 (checked at seed); treat_area / paint_type / names are our charting choice, not a standard.
// A code without a row: the client must send treat_area and the paint falls back to DEFAULT_PAINT (plain text mark).
final class ProcedureCatalog
{
    public const TREAT_AREAS = ['surface', 'tooth', 'range', 'quadrant', 'arch', 'mouth'];

    public const PAINT_TYPES = ['Filling', 'Crown', 'Extraction', 'Implant', 'RCT', 'Sealant', 'Veneer', 'Bridge', 'Denture', 'PostBU', 'RetainedRoot', 'Text', 'Watch'];

    public const DEFAULT_PAINT = 'Text';

    /** code => [treat_area, paint_type, name, layman, odontogram condition codes (starter mapping, the owner edits it)] */
    public const STARTER = [
        '23.2' => ['surface', 'Filling', 'Tumpatan', 'Tambal gigi', ['amf', 'cof', 'gif']],
        '23.3' => ['surface', 'Filling', 'Inlay', 'Tambal inlay', ['inl', 'onl']],
        '23.41' => ['tooth', 'Crown', 'Mahkota', 'Mahkota / selubung gigi', ['fmc', 'poc', 'mpc', 'gmc']],
        '23.42' => ['range', 'Bridge', 'Jembatan cekat', 'Gigi tiruan jembatan', ['meb', 'pob']],
        '23.43' => ['arch', 'Denture', 'Gigi tiruan lepasan', 'Gigi palsu lepas', ['prd', 'fld']],
        '23.01' => ['tooth', 'Extraction', 'Pencabutan gigi sulung', 'Cabut gigi susu', ['mis']],
        '23.09' => ['tooth', 'Extraction', 'Pencabutan gigi', 'Cabut gigi', ['mis']],
        '23.11' => ['tooth', 'Extraction', 'Pengambilan sisa akar', 'Cabut sisa akar', ['mis']],
        '23.19' => ['tooth', 'Extraction', 'Pencabutan bedah', 'Cabut gigi dengan bedah kecil', ['mis']],
        '23.5' => ['tooth', 'Implant', 'Implantasi gigi', 'Tanam gigi', ['ipx']],
        '23.6' => ['tooth', 'Implant', 'Implan gigi prostetik', 'Implan gigi', ['ipx']],
        '23.70' => ['tooth', 'RCT', 'Perawatan saluran akar', 'Perawatan akar gigi', ['rct']],
        '23.71' => ['tooth', 'RCT', 'Perawatan saluran akar dengan irigasi', 'Perawatan akar gigi', ['rct']],
        '96.54' => ['mouth', 'Text', 'Scaling', 'Pembersihan karang gigi', []],
    ];

    /** Idempotent for the current tenant (Ctx): existing rows are left as the clinic edited them. Fails closed on a non-official code. */
    public static function seed(): void
    {
        $icd = app(IcdCatalog::class);
        foreach (self::STARTER as $code => [$area, $paint, $name, $layman, $conditions]) {
            if (! $icd->icd9cmExists($code)) {
                throw new LogicException("Kode $code tidak ada di daftar resmi ICD-9-CM 2010.");
            }
            $d = ProcedureDefinition::firstOrCreate(['procedure_code' => $code], ['treat_area' => $area, 'paint_type' => $paint, 'name' => $name,
                'layman' => $layman, 'conditions' => $conditions]);
            if ($d->conditions === null) { // rows from before the v2 mapping: give them the starter mapping once
                $d->update(['conditions' => $conditions]);
            }
        }
    }

    /** Odontogram v2: procedure codes whose mapping contains this condition code (the candidates to bill a finished entry). */
    public static function codesFor(string $conditionCode): array
    {
        return ProcedureDefinition::orderBy('procedure_code')->get(['procedure_code', 'conditions'])
            ->filter(fn ($d) => in_array($conditionCode, $d->conditions ?? [], true))->pluck('procedure_code')->values()->all();
    }
}
