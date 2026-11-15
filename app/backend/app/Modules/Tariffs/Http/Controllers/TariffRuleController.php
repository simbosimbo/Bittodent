<?php

namespace App\Modules\Tariffs\Http\Controllers;

use App\Modules\Tariffs\Domain\Derivation;
use App\Modules\Tariffs\Models\Tariff;
use App\Modules\Tariffs\Models\TariffRate;
use App\Modules\Tariffs\Models\TariffRule;
use App\Modules\Tariffs\Services\PriceLookupService;
use App\Shared\Audit\Audit;
use App\Shared\Dentist\Specialty;
use App\Shared\Http\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

// Unit B: optional derivation rules, default OFF. A rule only fills an EMPTY Spesialis / bidang cell for specialists.
class TariffRuleController extends Controller
{
    private const FIELDS = ['band', 'field', 'category', 'procedure_code', 'variant', 'kind', 'value', 'rounding', 'enabled'];

    /** GET /api/tariffs/rules (owner). */
    public function index()
    {
        return response()->json(['data' => TariffRule::orderBy('scope_key')->get()->map(fn ($r) => $r->only(['id', ...self::FIELDS]))]);
    }

    /**
     * PUT /api/tariffs/rules {band, field?, category? | procedure_code?+variant?, enabled, kind?, value?, rounding?, dry_run} (owner).
     * Upserts the one rule of that scope. dry_run=true writes nothing and returns the prices it would give now (per Umum row in scope:
     * source rule | cell (explicit cell still wins) | other_rule (a more specific rule wins) | fallback). Edited in place; old values in audit.
     */
    public function put(Request $request, PriceLookupService $prices)
    {
        $d = $request->validate([
            'band' => ['required', Rule::in(['specialist', 'field'])],
            'field' => ['nullable', 'required_if:band,field', 'prohibited_unless:band,field', Rule::in(array_keys(Specialty::FIELDS))],
            'category' => ['nullable', 'regex:/^[a-z0-9_]{1,30}$/', 'prohibits:procedure_code'],
            'procedure_code' => ['nullable', 'string', 'max:10', 'required_with:variant'],
            'variant' => ['nullable', 'regex:/^[a-z0-9_]{1,10}$/', 'required_with:procedure_code'],
            'enabled' => ['required', 'boolean'],
            'kind' => ['required_if_accepted:enabled', Rule::in(Derivation::KINDS)],
            'value' => ['required_if_accepted:enabled', 'integer', $request->input('kind') === 'percent' ? 'between:-100,1000' : 'between:-1000000000,1000000000'],
            'rounding' => ['required_if_accepted:enabled', Rule::in(array_keys(Derivation::ROUNDING))],
            'dry_run' => ['required', 'boolean'],
        ]);
        $scope = ['band' => $d['band'], 'field' => $d['field'] ?? null, 'category' => $d['category'] ?? null,
            'procedure_code' => $d['procedure_code'] ?? null, 'variant' => $d['variant'] ?? null];
        $key = TariffRule::scopeKey($scope);

        return DB::transaction(function () use ($d, $scope, $key, $prices) {
            $today = now()->toDateString();
            $umum = Tariff::where('valid_from', '<=', $today)->where(fn ($q) => $q->whereNull('valid_to')->orWhere('valid_to', '>', $today))
                ->when($scope['procedure_code'], fn ($q, $c) => $q->where('procedure_code', $c)->where('variant', $scope['variant']))
                ->when($scope['category'], fn ($q, $c) => $q->where('category', $c))
                ->orderBy('procedure_code')->orderBy('level_rank')->get();
            if ($scope['procedure_code'] !== null && $umum->isEmpty()) {
                return response()->json(['error' => 'no_umum', 'message' => 'Harga Umum untuk tindakan dan tingkat ini belum ada.'], 422);
            }
            $existing = TariffRule::where('scope_key', $key)->lockForUpdate()->first();
            if ($existing === null && ! $d['enabled']) {
                return response()->json(['error' => 'no_rule', 'message' => 'Aturan ini belum ada.'], 404);
            }
            $old = $existing?->only(['kind', 'value', 'rounding', 'enabled']);
            $rule = ($existing ?? new TariffRule($scope + ['scope_key' => $key]))
                ->fill(array_intersect_key($d, array_flip(['kind', 'value', 'rounding', 'enabled'])));

            $current = TariffRule::where('enabled', true)->get();
            $after = $current->reject(fn ($r) => $r->scope_key === $key)->when($rule->enabled, fn ($c) => $c->push($rule))->values();
            $rates = TariffRate::effective($today)->whereIn('band', ['specialist', 'field'])->whereIn('procedure_code', $umum->pluck('procedure_code')->unique())
                ->orderByDesc('valid_from')->get()->groupBy(fn ($r) => "$r->procedure_code|$r->variant");
            $field = $scope['field'];
            [$negative, $affected] = [false, 0]; // affected = rows this rule prices before or after the change
            $rows = $umum->map(function ($t) use ($prices, $rates, $current, $after, $field, $key, $rule, &$negative, &$affected) {
                $rs = $rates->get("$t->procedure_code|$t->variant", collect());
                $before = $prices->resolveSpecialist($t, $rs, $current, $field);
                $now = $prices->resolveSpecialist($t, $rs, $after, $field);
                $source = match (true) {
                    $now['rule']?->scope_key === $key => 'rule',
                    $now['rule'] === null && $now['band'] === $rule->band => 'cell',
                    $now['rule'] !== null => 'other_rule',
                    default => 'fallback',
                };
                $affected += (int) ($source === 'rule' || $before['rule']?->scope_key === $key);
                if ($source === 'rule') {
                    $base = $field === null ? $t->price_rp : $prices->resolveSpecialist($t, $rs, $after, null)['price_rp'];
                    $negative = $negative || Derivation::negative($base, $rule->kind, $rule->value);
                }

                return ['procedure_code' => $t->procedure_code, 'variant' => $t->variant, 'name' => $t->name, 'category' => $t->category,
                    'umum_rp' => $t->price_rp, 'before_rp' => $before['price_rp'], 'after_rp' => $now['price_rp'], 'source' => $source];
            });
            if ($negative) { // rejected, not clamped: the owner must see the bad rule (lookup clamps at 0 only if Umum later drops)
                return response()->json(['error' => 'negative_result', 'message' => 'Aturan ini membuat harga di bawah 0.'], 422);
            }
            if (! $d['dry_run']) {
                $rule->save();
                Audit::log('tarif_aturan_diubah', 'tariff_rule', $rule->id, $scope + ['old' => $old,
                    'new' => $rule->only(['kind', 'value', 'rounding', 'enabled']), 'affected' => $affected]);
            }

            return response()->json(['dry_run' => (bool) $d['dry_run'], 'rule' => $rule->only(['id', ...self::FIELDS]),
                'affected' => $affected, 'rows' => $rows->values()]);
        });
    }
}
