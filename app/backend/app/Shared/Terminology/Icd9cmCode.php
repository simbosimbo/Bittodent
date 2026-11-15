<?php

namespace App\Shared\Terminology;

use Illuminate\Database\Eloquent\Model;

// Global ICD-9-CM 2010 procedure code (official SATUSEHAT list, no tenant_id). Read-only for ehr_app; written only by IcdImporter.
class Icd9cmCode extends Model
{
    protected $table = 'icd9cm_codes';

    protected $primaryKey = 'code';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $guarded = [];

    protected $casts = ['valid' => 'boolean'];
}
