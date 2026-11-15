<?php

namespace App\Modules\Ktp\Services;

use App\Modules\Ktp\Contracts\KtpPhoto;
use App\Modules\Ktp\Contracts\KtpPhotoStore;
use App\Modules\Ktp\Models\KtpPhoto as Row;
use App\Shared\Crypto\Crypto;
use App\Shared\Tenancy\Ctx;

// bytes_enc = Crypto::encrypt(base64(raw)). Tenant scope via BelongsToTenant: another tenant's id reads as null.
final class EncryptedKtpPhotoStore implements KtpPhotoStore
{
    public function store(?string $patientId, string $bytes, string $mime): KtpPhoto
    {
        $row = Row::create(['patient_id' => $patientId, 'mime' => $mime, 'bytes_enc' => Crypto::encrypt(base64_encode($bytes)),
            'created_by' => Ctx::current()->userId]);

        return self::dto($row);
    }

    public function get(string $id): ?KtpPhoto
    {
        $row = Row::find($id, ['tenant_id', 'id', 'patient_id', 'mime']);

        return $row ? self::dto($row) : null;
    }

    public function bytes(string $id): ?string
    {
        $enc = Row::whereKey($id)->value('bytes_enc');

        return $enc === null ? null : base64_decode(Crypto::decrypt($enc), true);
    }

    public function attachToPatient(string $id, string $patientId): void
    {
        Row::whereKey($id)->firstOrFail(['tenant_id', 'id', 'patient_id'])->update(['patient_id' => $patientId]);
    }

    private static function dto(Row $r): KtpPhoto
    {
        return new KtpPhoto($r->id, $r->tenant_id, $r->patient_id, $r->mime);
    }
}
