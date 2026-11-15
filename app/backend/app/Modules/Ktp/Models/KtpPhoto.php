<?php

namespace App\Modules\Ktp\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// Encrypted KTP photo. Only Services\EncryptedKtpPhotoStore reads/writes bytes_enc.
class KtpPhoto extends Model
{
    use BelongsToTenant;

    protected $table = 'ktp_photo';

    protected $guarded = ['tenant_id'];

    protected $hidden = ['bytes_enc'];
}
