<?php

namespace App\Modules\Tariffs\Services;

use App\Modules\Tariffs\Contracts\PriceContext;
use App\Modules\Tariffs\Contracts\PriceLookup;
use App\Modules\Tariffs\Models\Tariff;
use App\Modules\Tariffs\Models\TariffRate;
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
        $umum = ['price_rp' => $t->price_rp, 'band' => 'umum', 'name' => $t->name];
        if ($dentist === null) {
            return $umum;
        }
        $specialist = $dentist->category === 'specialist';
        $rates = TariffRate::where('procedure_code', $procedureCode)->where('variant', $variant)->effective($d)
            ->where(fn ($q) => $q->where(fn ($q) => $q->where('band', 'dentist')->where('dentist_id', $dentist->dentistId))
                ->when($specialist, fn ($q) => $q->orWhere('band', 'specialist')
                    ->when($dentist->field !== null, fn ($q) => $q->orWhere(fn ($q) => $q->where('band', 'field')->where('field', $dentist->field)))))
            ->orderByDesc('valid_from')->get();
        foreach (['dentist', 'field', 'specialist'] as $band) { // most specific first; a general dentist only ever matches 'dentist'
            if ($r = $rates->firstWhere('band', $band)) {
                return ['price_rp' => $r->price_rp, 'band' => $band, 'name' => $t->name];
            }
        }

        return $umum;
    }
}
