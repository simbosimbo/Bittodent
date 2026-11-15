<?php

namespace App\Modules\Tariffs\Contracts;

// Implemented by Services\PriceLookupService (C3). Consumer: Billing, when it generates invoice lines from recorded procedures.
interface PriceLookup
{
    /**
     * Price effective on $date (latest valid_from <= date) for an ICD-9-CM/clinic procedure code + difficulty variant.
     * Without $dentist: the stored Umum price (never derived). With it: per-dentist cell > field cell > field rule > Spesialis cell >
     * Spesialis rule > Umum. Rules (unit B) are optional, default off, and only fill empty cells for specialists.
     * Integer rupiah (no floats for money). Throws when no Umum tariff applies (Billing must not invent a price).
     */
    public function priceFor(string $procedureCode, string $variant, \DateTimeInterface $date, ?PriceContext $dentist = null): int;

    /** Same lookup, plus the tariff name and which band won. @return array{price_rp: int, band: string, name: string, derived: bool} band: umum|specialist|field|dentist; derived = a rule made the price */
    public function quote(string $procedureCode, string $variant, \DateTimeInterface $date, ?PriceContext $dentist = null): array;
}
