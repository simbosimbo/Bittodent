<?php

namespace App\Modules\Tariffs\Contracts;

// Implemented by Services\PriceLookupService (C3). Consumer: Billing, when it generates invoice lines from recorded procedures.
interface PriceLookup
{
    /**
     * Price effective on $date (latest valid_from <= date) for an ICD-9-CM/clinic procedure code + difficulty variant.
     * Integer rupiah (no floats for money). Throws when no tariff applies (Billing must not invent a price).
     */
    public function priceFor(string $procedureCode, string $variant, \DateTimeInterface $date): int;
}
