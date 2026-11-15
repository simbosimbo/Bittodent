<?php

namespace App\Modules\Tariffs\Contracts;

// Implemented by Services\PriceLookupService (C3). Consumer: Billing, when it generates invoice lines from recorded procedures.
interface PriceLookup
{
    /**
     * Price effective on $date (latest valid_from <= date) for an ICD-9-CM/clinic procedure code + difficulty variant.
     * Without $dentist: the Umum price. With it, most specific explicit cell first: per-dentist > specialist field > Spesialis > Umum.
     * Integer rupiah (no floats for money). Throws when no Umum tariff applies (Billing must not invent a price).
     */
    public function priceFor(string $procedureCode, string $variant, \DateTimeInterface $date, ?PriceContext $dentist = null): int;

    /** Same lookup, plus the tariff name and which band won. @return array{price_rp: int, band: string, name: string} band: umum|specialist|field|dentist */
    public function quote(string $procedureCode, string $variant, \DateTimeInterface $date, ?PriceContext $dentist = null): array;
}
