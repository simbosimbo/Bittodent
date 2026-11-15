<?php

namespace App\Modules\Tenancy\Services;

use App\Modules\Tenancy\Contracts\DentistProfileDirectory;
use App\Modules\Tenancy\Models\DentistProfile;

final class DentistProfileDirectoryService implements DentistProfileDirectory
{
    public function of(string $userId): array
    {
        $p = DentistProfile::where('user_id', $userId)->first();

        return ['category' => $p->category ?? 'general', 'field' => $p?->field];
    }
}
