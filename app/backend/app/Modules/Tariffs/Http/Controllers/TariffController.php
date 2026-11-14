<?php

namespace App\Modules\Tariffs\Http\Controllers;

use App\Modules\Tariffs\Models\Tariff;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TariffController extends Controller
{
    /**
     * PUT /api/tariffs/{id}/levels {valid_from, levels: [{code, label, price_rp}]} (owner, perm tariff.manage).
     * Replaces the level set of {id}'s procedure from valid_from on: open rows get valid_to = valid_from, new rows are inserted.
     * Past versions keep their prices; invoice lines keep their own snapshot. Order = rank (last = highest).
     */
    public function levels(Request $request, string $id)
    {
        $d = $request->validate([
            'valid_from' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'levels' => ['required', 'array', 'min:1', 'max:10'],
            'levels.*.code' => ['required', 'string', 'regex:/^[a-z0-9_]{1,10}$/', 'distinct'],
            'levels.*.label' => ['required', 'string', 'max:60'],
            'levels.*.price_rp' => ['required', 'integer', 'min:0', 'max:1000000000'],
        ]);

        return DB::transaction(function () use ($d, $id) {
            $code = Tariff::findOrFail($id)->procedure_code;
            $rows = Tariff::where('procedure_code', $code)->lockForUpdate()->get();
            $latest = $rows->sortByDesc('valid_from')->first();
            // shortcut: one version per day per procedure (a same-day fix needs the next day), revisit if owners need same-day edits.
            if ($latest->valid_from->toDateString() >= $d['valid_from']) {
                return response()->json(['error' => 'not_after_current', 'message' => 'Versi baru harus berlaku setelah versi terakhir.'], 409);
            }
            Tariff::where('procedure_code', $code)->whereNull('valid_to')->update(['valid_to' => $d['valid_from']]);
            $new = collect($d['levels'])->values()->map(fn ($l, $i) => Tariff::create(['procedure_code' => $code, 'name' => $latest->name,
                'variant' => $l['code'], 'level_label' => $l['label'], 'level_rank' => $i + 1, 'price_rp' => $l['price_rp'], 'valid_from' => $d['valid_from']]));
            Audit::log('tarif_diubah', 'tariff', $new[0]->id, ['procedure_code' => $code, 'valid_from' => $d['valid_from'], 'levels' => $new->count()]);

            return response()->json(['procedure_code' => $code, 'valid_from' => $d['valid_from'],
                'levels' => $new->map->only(['id', 'variant', 'level_label', 'level_rank', 'price_rp'])->all()]);
        });
    }
}
