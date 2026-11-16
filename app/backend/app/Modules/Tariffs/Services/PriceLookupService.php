<?php

namespace App\Modules\Tariffs\Services;

use App\Modules\Tariffs\Contracts\PriceContext;
use App\Modules\Tariffs\Contracts\PriceLookup;
use App\Modules\Tariffs\Domain\Derivation;
use App\Modules\Tariffs\Models\Tariff;
use App\Modules\Tariffs\Models\TariffRate;
use App\Modules\Tariffs\Models\TariffRule;
use Illuminate\Support\Collection;
use RuntimeException;

final class PriceLookupService implements PriceLookup
{
    public function priceFor(string $procedureCode, string $variant, \DateTimeInterface $date, ?PriceContext $dentist = null): int
    {
        return $this->quote($procedureCode, $variant, $date, $dentist)['price_rp'];
    }

    // Effective tariff: valid_from <= date < valid_to (NULL = open); latest valid_from wins. Umum must exist even when a band cell does.
    public function quote(string $procedureCode, string $variant, \DateTimeInterface $date, ?PriceContext $dentist = null): array
    {
        $d = $date->format('Y-m-d');
        $t = Tariff::where('procedure_code', $procedureCode)->where('variant', $variant)->where('valid_from', '<=', $d)
            ->where(fn ($q) => $q->whereNull('valid_to')->orWhere('valid_to', '>', $d))
            ->orderByDesc('valid_from')->first() ?? throw new RuntimeException('no_tariff');
        if ($dentist === null) {
            return ['price_rp' => $t->price_rp, 'band' => 'umum', 'name' => $t->name, 'label' => $t->level_label, 'derived' => false];
        }
        $specialist = $dentist->category === 'specialist';
        $rates = TariffRate::where('procedure_code', $procedureCode)->where('variant', $variant)->effective($d)
            ->where(fn ($q) => $q->where(fn ($q) => $q->where('band', 'dentist')->where('dentist_id', $dentist->dentistId))
                ->when($specialist, fn ($q) => $q->orWhere('band', 'specialist')
                    ->when($dentist->field !== null, fn ($q) => $q->orWhere(fn ($q) => $q->where('band', 'field')->where('field', $dentist->field)))))
            ->orderByDesc('valid_from')->get();
        if ($r = $rates->firstWhere('band', 'dentist')) { // overrides are explicit only, never derived
            return ['price_rp' => $r->price_rp, 'band' => 'dentist', 'name' => $t->name, 'label' => $t->level_label, 'derived' => false];
        }
        if (! $specialist) { // a general dentist never gets Spesialis/bidang prices or rules
            return ['price_rp' => $t->price_rp, 'band' => 'umum', 'name' => $t->name, 'label' => $t->level_label, 'derived' => false];
        }
        $q = $this->resolveSpecialist($t, $rates, TariffRule::where('enabled', true)->get(), $dentist->field);

        return ['price_rp' => $q['price_rp'], 'band' => $q['band'], 'name' => $t->name, 'label' => $t->level_label, 'derived' => $q['rule'] !== null];
    }

    /**
     * Specialist price for one Umum row: field cell > field rule > Spesialis cell > Spesialis rule > Umum. A field rule's base is the
     * already-resolved Spesialis price. Also used by the rule preview with a hypothetical rule set.
     *
     * @return array{price_rp: int, band: string, rule: ?TariffRule}
     */
    public function resolveSpecialist(Tariff $t, Collection $rates, Collection $rules, ?string $field): array
    {
        $pick = fn (string $band, ?string $f) => Derivation::pick($rules, $band, $f, $t->procedure_code, $t->variant, $t->category);
        $derive = fn (int $base, TariffRule $r) => Derivation::apply($base, $r->kind, $r->value, $r->rounding);
        $out = ['price_rp' => $t->price_rp, 'band' => 'umum', 'rule' => null];
        if ($c = $rates->firstWhere('band', 'specialist')) {
            $out = ['price_rp' => $c->price_rp, 'band' => 'specialist', 'rule' => null];
        } elseif ($r = $pick('specialist', null)) {
            $out = ['price_rp' => $derive($t->price_rp, $r), 'band' => 'specialist', 'rule' => $r];
        }
        if ($field === null) {
            return $out;
        }
        if ($c = $rates->first(fn ($c) => $c->band === 'field' && $c->field === $field)) {
            return ['price_rp' => $c->price_rp, 'band' => 'field', 'rule' => null];
        }
        if ($r = $pick('field', $field)) {
            return ['price_rp' => $derive($out['price_rp'], $r), 'band' => 'field', 'rule' => $r];
        }

        return $out;
    }
}
