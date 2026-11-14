<?php

namespace App\Modules\Clinical\Models;

use App\Modules\Clinical\Domain\Soap;
use App\Shared\Crypto\Crypto;
use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ClinicalNoteVersion extends Model
{
    use BelongsToTenant;

    protected $table = 'clinical_note_version';

    protected $guarded = ['tenant_id'];

    protected $casts = ['signed_at' => 'datetime'];

    protected $hidden = ['soap_enc'];

    public function soap(): array
    {
        return json_decode(Crypto::decrypt($this->soap_enc), true, flags: JSON_THROW_ON_ERROR);
    }

    /** Encrypts canonical JSON and keeps content_hash = sha256 of it. */
    public function setSoap(array $soap): static
    {
        $soap = Soap::normalize($soap);

        return $this->forceFill(['soap_enc' => Crypto::encrypt(Soap::canonicalJson($soap)), 'content_hash' => Soap::hash($soap)]);
    }
}
