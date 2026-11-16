<?php

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Contracts\UserDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Set / change one's own 6-digit Selesai PIN. Never logs or returns the PIN or its hash.
class SelesaiPinController extends Controller
{
    /** PUT /api/me/selesai-pin {pin, current_pin?}: first set needs no current PIN; change does. */
    public function update(Request $request, UserDirectory $users)
    {
        $d = $request->validate(['pin' => ['required', 'string', 'regex:/^\d{6}$/'], 'current_pin' => ['nullable', 'string']]);
        $me = Ctx::current()->userId;

        return DB::transaction(function () use ($d, $me, $users) {
            $had = $users->hasSelesaiPin($me);
            $r = $users->setSelesaiPin($me, $d['pin'], $d['current_pin'] ?? null);
            if ($r['result'] !== 'ok') {
                return self::pinRefused($r);
            }
            Audit::log($had ? 'pin_diubah' : 'pin_diatur', 'user', $me);

            return response()->json(['has_pin' => true]);
        });
    }

    /** 403 for a refused PIN (wrong / locked); the failure itself is audited by UserDirectory. */
    public static function pinRefused(array $r)
    {
        $locked = in_array($r['result'], ['locked', 'lockout'], true);

        return response()->json(['error' => $locked ? 'pin_locked' : 'pin_wrong', 'locked_until' => $r['locked_until'],
            'message' => $locked ? 'PIN terkunci 15 menit karena 5 kali salah. Coba lagi nanti.' : 'PIN salah.'], 403);
    }
}
