<?php

namespace App\Shared\Terminology;

// Where official ICD rows come from (local CSV, SATUSEHAT public spreadsheet, ...).
interface IcdSource
{
    /** @return iterable<array{0: string, 1: string, 2: string}> [code, display, version]; empty rows already skipped */
    public function rows(): iterable;
}
