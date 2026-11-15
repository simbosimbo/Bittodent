<?php

namespace App\Modules\Clinical\Domain;

use App\Modules\Clinical\Models\ProcedureDefinition;

// Where a procedure sits (Open Dental TreatArea). treat_area comes from the catalog row of the code; a client value must match it.
// A code without a catalog row (or no code) needs treat_area from the client. Fields that do not belong to the area must be empty.
final class ProcedureLocation
{
    private const FIELDS = ['tooth', 'surfaces', 'tooth_range', 'quadrant', 'arch'];

    /** @return array{0: ?array, 1: ?array{string, string}} [columns, null] or [null, [field, Indonesian message]] */
    public static function resolve(array $d, ?ProcedureDefinition $def): array
    {
        $area = $def?->treat_area ?? ($d['treat_area'] ?? null);
        if ($area === null) {
            return [null, ['treat_area', 'Area tindakan wajib (kode ini belum ada di katalog tindakan klinik).']];
        }
        if ($def && isset($d['treat_area']) && $d['treat_area'] !== $def->treat_area) {
            return [null, ['treat_area', "Kode {$def->procedure_code} dicatat per {$def->treat_area}, bukan {$d['treat_area']}."]];
        }
        $need = ['surface' => ['tooth', 'surfaces'], 'tooth' => ['tooth'], 'range' => ['tooth_range'], 'quadrant' => ['quadrant'], 'arch' => ['arch'], 'mouth' => []][$area];
        foreach (self::FIELDS as $f) {
            $has = isset($d[$f]) && $d[$f] !== '' && $d[$f] !== [];
            if (in_array($f, $need, true) && ! $has) {
                return [null, [$f, $f === 'surfaces' ? 'Permukaan wajib untuk tindakan per permukaan.' : "Kolom $f wajib untuk area $area."]];
            }
            if (! in_array($f, $need, true) && $has) {
                return [null, [$f, $f === 'surfaces' ? 'Tindakan ini untuk seluruh gigi/area, tanpa permukaan.' : "Kolom $f tidak dipakai untuk area $area."]];
            }
        }
        $out = ['treat_area' => $area] + array_fill_keys(self::FIELDS, null);
        if (in_array('tooth', $need, true)) {
            if (! Odontogram::validTooth((int) $d['tooth'])) {
                return [null, ['tooth', 'Nomor gigi FDI tidak dikenal.']];
            }
            $out['tooth'] = (int) $d['tooth'];
        }
        if ($area === 'surface') {
            [$out['surfaces'], $e] = Odontogram::surfaces($out['tooth'], $d['surfaces']);
            if ($e) {
                return [null, ['surfaces', $e]];
            }
        }
        if ($area === 'range') {
            [$a, $b] = array_map('intval', explode('-', $d['tooth_range']));
            if (! Odontogram::validTooth($a) || ! Odontogram::validTooth($b) || $a === $b) {
                return [null, ['tooth_range', 'Rentang gigi wajib dua nomor FDI berbeda, mis. 13-23.']];
            }
            $out['tooth_range'] = $d['tooth_range'];
        }
        $out['quadrant'] = $area === 'quadrant' ? (int) $d['quadrant'] : null;
        $out['arch'] = $area === 'arch' ? $d['arch'] : null;

        return [$out, null];
    }
}
