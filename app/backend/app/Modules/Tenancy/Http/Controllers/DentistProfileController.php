<?php

namespace App\Modules\Tenancy\Http\Controllers;

use App\Modules\Tenancy\Models\DentistProfile;
use App\Modules\Tenancy\Models\Membership;
use App\Shared\Audit\Audit;
use App\Shared\Dentist\Specialty;
use App\Shared\Http\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class DentistProfileController extends Controller
{
    /**
     * PUT /api/dentists/{userId}/profile {category, field?} (owner, perm tariff.manage: the profile only decides which price band applies).
     * field only for specialists. 404 when the user is not a dentist of this tenant.
     */
    public function update(Request $request, string $userId)
    {
        $d = $request->validate([
            'category' => ['required', Rule::in(Specialty::CATEGORIES)],
            'field' => ['nullable', Rule::in(array_keys(Specialty::FIELDS)), 'prohibited_unless:category,specialist'],
        ]);
        abort_unless(Membership::where('user_id', $userId)->where('role', 'dentist')->exists(), 404);

        return DB::transaction(function () use ($d, $userId) {
            $p = DentistProfile::where('user_id', $userId)->lockForUpdate()->first() ?? new DentistProfile(['user_id' => $userId]);
            $from = $p->exists ? ['category' => $p->category, 'field' => $p->field] : null;
            $p->fill(['category' => $d['category'], 'field' => $d['field'] ?? null])->save();
            Audit::log('profil_dokter_diubah', 'dentist_profile', $p->id, ['user_id' => $userId, 'from' => $from,
                'to' => ['category' => $p->category, 'field' => $p->field]]);

            return response()->json($p->only(['user_id', 'category', 'field']));
        });
    }
}
