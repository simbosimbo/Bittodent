<?php

namespace App\Shared\Files;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

// Clinic images (logo, QRIS photo): raster only (no SVG: script risk), max 1 MB, private disk under the tenant's folder,
// served only through authenticated, tenant-scoped API routes. Not patient data.
final class PrivateImage
{
    public const RULES = ['required', 'file', 'image', 'mimes:png,jpg,jpeg,webp', 'max:1024'];

    public static function store(UploadedFile $file, string $tenantId, string $kind): string
    {
        return $file->storeAs("clinic/$tenantId", $kind.'-'.Str::uuid().'.'.$file->extension(), 'local');
    }

    public static function serve(?string $path)
    {
        abort_if(! $path || ! Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response($path, null, ['X-Content-Type-Options' => 'nosniff', 'Cache-Control' => 'private, max-age=300']);
    }
}
