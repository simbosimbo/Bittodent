<?php

namespace App\Modules\Tariffs\Http\Controllers;

use App\Modules\Tariffs\Domain\Derivation;
use App\Modules\Tariffs\Models\Tariff;
use App\Modules\Tariffs\Models\TariffRate;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Dentist\Specialty;
use App\Shared\Http\Controller;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TariffController extends Controller
{
    /**
     * GET /api/tariffs?q=&category= (owner, perm tariff.manage): the price list for Pengaturan Klinik > Harga. One item per procedure:
     * the level set in force today, a scheduled future set (if any) and `editable_from` = the first date a new version may start
     * (today, or the day after the latest version: one version per day, see versionLevels). Reads are not audited (no patient
     * data); every change is.
     */
    public function index(Request $request)
    {
        $d = $request->validate(['q' => ['nullable', 'string', 'max:60'], 'category' => ['nullable', 'regex:/^[a-z0-9_]{1,30}$/']]);
        $today = now()->toDateString();
        $all = Tariff::when($d['category'] ?? null, fn ($q, $c) => $q->where('category', $c))
            ->when(trim($d['q'] ?? '') !== '', fn ($q) => $q->where(fn ($w) => $w->where('procedure_code', 'like', trim($d['q']).'%')
                ->orWhere('name', 'like', '%'.trim($d['q']).'%')))
            ->where(fn ($q) => $q->whereNull('valid_to')->orWhere('valid_to', '>', $today))
            ->orderBy('procedure_code')->orderBy('valid_from')->orderBy('level_rank')->get();
        $levels = fn (Collection $g) => $g->sortBy('level_rank')->map(fn ($t) => ['id' => $t->id, 'variant' => $t->variant,
            'label' => $t->level_label, 'price_rp' => $t->price_rp])->values()->all();
        $items = $all->groupBy('procedure_code')->map(function (Collection $rows, $code) use ($today, $levels) {
            $byFrom = $rows->groupBy(fn ($t) => $t->valid_from->toDateString())->sortKeys();
            $nowFrom = $byFrom->keys()->filter(fn ($f) => $f <= $today)->last();
            $next = $byFrom->keys()->filter(fn ($f) => $f > $today)->first();
            $latest = Tariff::where('procedure_code', $code)->max('valid_from');
            $first = $rows->first();

            return ['procedure_code' => $code, 'name' => $first->name, 'category' => $first->category, 'id' => $first->id,
                'valid_from' => $nowFrom, 'levels' => $nowFrom ? $levels($byFrom[$nowFrom]) : [],
                'next' => $next ? ['valid_from' => $next, 'levels' => $levels($byFrom[$next])] : null,
                'editable_from' => max($today, \Carbon\Carbon::parse($latest)->addDay()->toDateString())];
        })->values();

        return response()->json(['items' => $items, 'categories' => Tariff::whereNotNull('category')->distinct()->orderBy('category')->pluck('category')]);
    }

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
            $new = $this->versionLevels($code, $d['valid_from'], $d['levels']);
            if ($new instanceof JsonResponse) {
                return $new;
            }
            Audit::log('tarif_diubah', 'tariff', $new[0]->id, ['procedure_code' => $code, 'valid_from' => $d['valid_from'], 'levels' => $new->count()]);

            return response()->json(['procedure_code' => $code, 'valid_from' => $d['valid_from'],
                'levels' => $new->map->only(['id', 'variant', 'level_label', 'level_rank', 'price_rp'])->all()]);
        });
    }

    /**
     * POST /api/tariffs/bulk {target: umum|specialist|field, field?, category?, procedure_codes?, kind, value, rounding, valid_from, dry_run}
     * Manual helper, NOT a derivation rule: adds % or Rp to the EXISTING open prices of one band (Umum rows, or explicit Spesialis /
     * one bidang cells), optionally narrowed to a category and/or a procedure list. Never creates cells. Applies as new versions exactly
     * like levels()/rate() (Umum keeps the same level set; only price_rp changes). All-or-nothing: one conflict = 409, nothing written.
     */
    public function bulk(Request $request)
    {
        $d = $request->validate([
            'target' => ['required', Rule::in(['umum', 'specialist', 'field'])],
            'field' => ['nullable', 'required_if:target,field', 'prohibited_unless:target,field', Rule::in(array_keys(Specialty::FIELDS))],
            'category' => ['nullable', 'regex:/^[a-z0-9_]{1,30}$/'],
            'procedure_codes' => ['nullable', 'array', 'min:1', 'max:500'],
            'procedure_codes.*' => ['string', 'max:10', 'distinct'],
            'kind' => ['required', Rule::in(Derivation::KINDS)],
            'value' => ['required', 'integer', $request->input('kind') === 'percent' ? 'between:-100,1000' : 'between:-1000000000,1000000000'],
            'rounding' => ['required', Rule::in(array_keys(Derivation::ROUNDING))],
            'valid_from' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'dry_run' => ['required', 'boolean'],
        ]);
        $scope = array_intersect_key($d, array_flip(['target', 'field', 'category', 'kind', 'value', 'rounding', 'valid_from']));

        return DB::transaction(function () use ($d, $scope) {
            $umum = Tariff::whereNull('valid_to')->when($d['category'] ?? null, fn ($q, $c) => $q->where('category', $c))
                ->when($d['procedure_codes'] ?? null, fn ($q, $c) => $q->whereIn('procedure_code', $c))
                ->orderBy('procedure_code')->orderBy('level_rank')->lockForUpdate()->get();
            $items = $d['target'] === 'umum' ? $umum : TariffRate::whereNull('valid_to')->where('band', $d['target'])
                ->when($d['field'] ?? null, fn ($q, $f) => $q->where('field', $f))
                ->whereIn('procedure_code', $umum->pluck('procedure_code')->unique())->orderBy('procedure_code')->orderBy('variant')->get();
            if ($items->contains(fn ($r) => Derivation::negative($r->price_rp, $d['kind'], $d['value']))) {
                return response()->json(['error' => 'negative_result', 'message' => 'Perubahan ini membuat harga di bawah 0.'], 422);
            }
            $rows = $items->map(fn ($r) => ['procedure_code' => $r->procedure_code, 'variant' => $r->variant, 'band' => $d['target'],
                'field' => $r->field ?? null, 'old_rp' => $r->price_rp, 'new_rp' => Derivation::apply($r->price_rp, $d['kind'], $d['value'], $d['rounding'])]);
            if (! $d['dry_run']) {
                if ($rows->isEmpty()) {
                    return response()->json(['error' => 'no_rows', 'message' => 'Tidak ada harga yang cocok.'], 422);
                }
                $fail = fn ($res) => $res instanceof JsonResponse ? throw new HttpResponseException($res) : $res; // rolls back the whole bulk
                if ($d['target'] === 'umum') {
                    $umum->groupBy('procedure_code')->each(fn ($g, $code) => $fail($this->versionLevels($code, $d['valid_from'], $g->map(fn ($t) => [
                        'code' => $t->variant, 'label' => $t->level_label, 'price_rp' => Derivation::apply($t->price_rp, $d['kind'], $d['value'], $d['rounding'])])->all())));
                } else {
                    $items->each(fn ($c, $i) => $fail($this->writeCell($c->only(['procedure_code', 'variant', 'band', 'field', 'dentist_id']),
                        $rows[$i]['new_rp'], $d['valid_from'])));
                }
                Audit::log('tarif_massal_diubah', 'tariff', null, $scope + ['count' => $rows->count()]);
            }

            return response()->json(['dry_run' => (bool) $d['dry_run'], 'valid_from' => $d['valid_from'], 'count' => $rows->count(), 'rows' => $rows->values()]);
        });
    }

    /** PUT /api/tariffs/category {procedure_code, category|null} (owner): clinic-defined grouping slug, not an official classification. */
    public function category(Request $request)
    {
        $d = $request->validate(['procedure_code' => ['required', 'string', 'max:10'], 'category' => ['present', 'nullable', 'regex:/^[a-z0-9_]{1,30}$/']]);

        return DB::transaction(function () use ($d) {
            $rows = Tariff::where('procedure_code', $d['procedure_code'])->lockForUpdate()->get();
            abort_if($rows->isEmpty(), 404);
            $old = $rows->sortByDesc('valid_from')->first()->category;
            // Metadata, not a price: set on every version so rules match by code regardless of date.
            Tariff::where('procedure_code', $d['procedure_code'])->update(['category' => $d['category']]);
            Audit::log('tarif_kategori_diubah', 'tariff', $rows->first()->id, ['procedure_code' => $d['procedure_code'], 'old' => $old, 'category' => $d['category']]);

            return response()->json(['procedure_code' => $d['procedure_code'], 'category' => $d['category']]);
        });
    }

    /** New version of one procedure's level set (caller holds the transaction). @param list<array{code, label, price_rp}> $levels */
    private function versionLevels(string $code, string $validFrom, array $levels): Collection|JsonResponse
    {
        $rows = Tariff::where('procedure_code', $code)->lockForUpdate()->get();
        $latest = $rows->sortByDesc('valid_from')->first();
        // shortcut: one version per day per procedure (a same-day fix needs the next day), revisit if owners need same-day edits.
        if ($latest->valid_from->toDateString() >= $validFrom) {
            // A scheduled (future, so never billed) version may be corrected in place on its own date, same level set only.
            $sched = $rows->filter(fn ($t) => $t->valid_from->toDateString() === $validFrom)->sortBy('level_rank')->values();
            if ($validFrom > now()->toDateString() && $sched->isNotEmpty() && $sched->pluck('variant')->all() === array_column($levels, 'code')) {
                return $sched->each(fn ($t, $i) => $t->update(['level_label' => $levels[$i]['label'], 'price_rp' => $levels[$i]['price_rp']]));
            }

            return $this->notAfterCurrent();
        }
        Tariff::where('procedure_code', $code)->whereNull('valid_to')->update(['valid_to' => $validFrom]);

        return collect($levels)->values()->map(fn ($l, $i) => Tariff::create(['procedure_code' => $code, 'name' => $latest->name,
            'category' => $latest->category, 'variant' => $l['code'], 'level_label' => $l['label'], 'level_rank' => $i + 1,
            'price_rp' => $l['price_rp'], 'valid_from' => $validFrom]));
    }

    private function notAfterCurrent(): JsonResponse
    {
        return response()->json(['error' => 'not_after_current', 'message' => 'Versi baru harus berlaku setelah versi terakhir.'], 409);
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
            $res = $this->writeCell($key, $d['price_rp'], $d['valid_from']);
            if ($res instanceof JsonResponse) {
                return $res;
            }
            [$open, $new] = $res;
            Audit::log($key['band'] === 'dentist' ? 'tarif_override_diubah' : 'tarif_tingkat_diubah', 'tariff_rate', $new?->id ?? $open->id,
                $key + ['closed_id' => $open?->id, 'old_price_rp' => $open?->price_rp, 'price_rp' => $d['price_rp'], 'valid_from' => $d['valid_from']]);

            return response()->json($key + ['id' => $new?->id, 'price_rp' => $d['price_rp'], 'valid_from' => $d['valid_from']]);
        });
    }

    /** Close the open cell for $key and add a new version (or just close it when $price is null). Caller holds the per-code lock. */
    private function writeCell(array $key, ?int $price, string $validFrom): array|JsonResponse
    {
        $rows = TariffRate::where($key)->get();
        if ($rows->contains(fn ($r) => $r->valid_from->toDateString() >= $validFrom)) {
            return $this->notAfterCurrent();
        }
        $open = $rows->firstWhere('valid_to', null);
        if ($open === null && $price === null) {
            return response()->json(['error' => 'no_rate', 'message' => 'Tidak ada harga untuk dikosongkan.'], 404);
        }
        $open?->update(['valid_to' => $validFrom]);

        return [$open, $price === null ? null : TariffRate::create($key + ['price_rp' => $price, 'valid_from' => $validFrom])];
    }
}
