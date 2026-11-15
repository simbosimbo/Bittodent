<?php

namespace Database\Seeders;

use App\Modules\IcdSuggestions\Models\IcdCode;
use App\Modules\IcdSuggestions\Models\IcdTerm;
use App\Modules\IcdSuggestions\Services\IcdCsv;
use Illuminate\Database\Seeder;

// A1 sample ICD dictionary (database/data/icd, verbatim from the official SATUSEHAT files; SOURCE.md) + unofficial Indonesian
// synonyms. Every row perlu_dicek. Global tables: run as mysql_admin (ehr_app has SELECT only).
class IcdSampleSeeder extends Seeder
{
    public function run(): void
    {
        $dir = database_path('data/icd');
        foreach (['icd10-sample.csv', 'icd9cm-sample.csv'] as $f) {
            IcdCode::upsert(array_map(fn ($r) => $r + ['perlu_dicek' => true], IcdCsv::entries("$dir/$f")), ['system', 'code'], ['display', 'version']);
        }
        IcdTerm::upsert(array_map(fn ($r) => $r + ['perlu_dicek' => true], array_values(IcdCsv::read("$dir/synonyms-id.csv", ['term', 'system', 'code']))),
            ['term', 'system', 'code'], ['perlu_dicek']);
    }
}
