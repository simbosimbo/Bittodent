<?php

namespace App\Modules\Ktp\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// Receptionist-verified KTP wilayah codes for one patient. The NIK stays in patient.nik_enc.
class PatientKtp extends Model
{
    use BelongsToTenant;

    protected $table = 'patient_ktp';

    protected $guarded = ['tenant_id'];

    protected $casts = ['verified_at' => 'datetime'];
}
