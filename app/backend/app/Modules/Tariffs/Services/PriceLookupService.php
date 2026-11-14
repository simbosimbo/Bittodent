<?php

namespace App\Modules\Tariffs\Services;

use App\Modules\Tariffs\Contracts\PriceLookup;
use App\Modules\Tariffs\Models\Tariff;
use RuntimeException;

final class PriceLookupService implements PriceLookup
{
    // Effective tariff: valid_from <= date < valid_to (NULL = open); latest valid_from wins.
    public function priceFor(string $procedureCode, string $variant, \DateTimeInterface $date): int
    {
        $d = $date->format('Y-m-d');
        $t = Tariff::where('procedure_code', $procedureCode)->where('variant', $variant)->where('valid_from', '<=', $d)
            ->where(fn ($q) => $q->whereNull('valid_to')->orWhere('valid_to', '>', $d))
            ->orderByDesc('valid_from')->first();

        return $t?->price_rp ?? throw new RuntimeException('no_tariff');
    }
}
