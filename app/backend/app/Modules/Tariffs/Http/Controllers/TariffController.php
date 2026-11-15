<?php

namespace App\Modules\Tariffs\Http\Controllers;

use App\Modules\Tariffs\Models\Tariff;
use App\Modules\Tariffs\Models\TariffRate;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Dentist\Specialty;
use App\Shared\Http\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

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

    /**
     * PUT /api/tariffs/rates {procedure_code, variant, band, field?, dentist_id?, price_rp|null, valid_from} (owner, perm tariff.manage).
     * Sets (price_rp) or clears (null) one explicit cell above Umum from valid_from on: the open cell gets valid_to = valid_from and a new
     * row is added when a price is given. Same versioning limit as levels: valid_from >= today and > the cell's latest version.
     */
    public function rate(Request $request, TenancyDirectory $tenancy)
    {
        $d = $request->validate([
            'procedure_code' => ['required', 'string', 'max:10'],
            'variant' => ['required', 'string', 'regex:/^[a-z0-9_]{1,10}$/'],
            'band' => ['required', Rule::in(TariffRate::BANDS)],
            'field' => ['nullable', 'required_if:band,field', 'prohibited_unless:band,field', Rule::in(array_keys(Specialty::FIELDS))],
            'dentist_id' => ['nullable', 'uuid', 'required_if:band,dentist', 'prohibited_unless:band,dentist'],
            'price_rp' => ['present', 'nullable', 'integer', 'min:0', 'max:1000000000'],
            'valid_from' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
        ]);
        $key = ['procedure_code' => $d['procedure_code'], 'variant' => $d['variant'], 'band' => $d['band'],
            'field' => $d['field'] ?? null, 'dentist_id' => $d['dentist_id'] ?? null];

        return DB::transaction(function () use ($d, $key, $tenancy) {
            // Same lock as levels(): one writer per procedure code.
            $umum = Tariff::where('procedure_code', $key['procedure_code'])->lockForUpdate()->get()
                ->contains(fn ($t) => $t->variant === $key['variant'] && $t->valid_to === null);
            if (! $umum) {
                return response()->json(['error' => 'no_umum', 'message' => 'Harga Umum untuk tindakan dan tingkat ini belum ada.'], 422);
            }
            if ($key['dentist_id'] !== null && ! $tenancy->lockActiveDentist($key['dentist_id'])) {
                abort(404);
            }
            $rows = TariffRate::where($key)->get();
            if ($rows->contains(fn ($r) => $r->valid_from->toDateString() >= $d['valid_from'])) {
                return response()->json(['error' => 'not_after_current', 'message' => 'Versi baru harus berlaku setelah versi terakhir.'], 409);
            }
            $open = $rows->firstWhere('valid_to', null);
            if ($open === null && $d['price_rp'] === null) {
                return response()->json(['error' => 'no_rate', 'message' => 'Tidak ada harga untuk dikosongkan.'], 404);
            }
            $open?->update(['valid_to' => $d['valid_from']]);
            $new = $d['price_rp'] === null ? null : TariffRate::create($key + ['price_rp' => $d['price_rp'], 'valid_from' => $d['valid_from']]);
            Audit::log($key['band'] === 'dentist' ? 'tarif_override_diubah' : 'tarif_tingkat_diubah', 'tariff_rate', $new?->id ?? $open->id,
                $key + ['closed_id' => $open?->id, 'old_price_rp' => $open?->price_rp, 'price_rp' => $d['price_rp'], 'valid_from' => $d['valid_from']]);

            return response()->json($key + ['id' => $new?->id, 'price_rp' => $d['price_rp'], 'valid_from' => $d['valid_from']]);
        });
    }
}
