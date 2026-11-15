<?php

namespace App\Modules\Tenancy\Http\Controllers;

use App\Modules\Tenancy\Models\Branch;
use App\Modules\Tenancy\Models\Tenant;
use App\Shared\Audit\Audit;
use App\Shared\Files\PrivateImage;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Per-clinic settings (owner only, perm settings.manage). Unit A koreksi: correction window in hours (DEVIATIONS #53);
// Selesai: PIN required at Selesai, default off (DEVIATIONS #55); Pengaturan Klinik: profile (name, contact, licence) + branch
// address/phone (DEVIATIONS #71). Every changed field is audited old -> new.
class ClinicSettingsController extends Controller
{
    public const WINDOW_MIN = 1;

    public const WINDOW_MAX = 720; // 30 days

    private const PROFILE = ['name', 'address', 'phone', 'email', 'license_no', 'license_valid_until'];

    /** GET /api/settings/clinic */
    public function show()
    {
        return response()->json(self::out(Tenant::findOrFail(Ctx::current()->tenant())) + ['branches' => self::branches()]);
    }

    /** PUT /api/settings/clinic {correction_window_hours?, selesai_pin_required?, name?, address?, phone?, email?, license_no?, license_valid_until?} */
    public function update(Request $request)
    {
        $d = $request->validate([
            'correction_window_hours' => ['sometimes', 'integer', 'between:'.self::WINDOW_MIN.','.self::WINDOW_MAX],
            'selesai_pin_required' => ['sometimes', 'boolean'],
            'name' => ['sometimes', 'string', 'min:3', 'max:200'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'regex:/^[0-9+() -]{6,30}$/'],
            'email' => ['sometimes', 'nullable', 'email', 'max:120'],
            'license_no' => ['sometimes', 'nullable', 'string', 'max:60'],
            'license_valid_until' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'npwp' => ['sometimes', 'nullable', 'string', 'regex:/^[0-9.\-]{15,25}$/'],
            'receipt_paper_mm' => ['sometimes', 'integer', 'in:58,80'],
        ]);
        if ($d === []) {
            return response()->json(['message' => 'Tidak ada yang diubah.', 'errors' => ['correction_window_hours' => ['Isi minimal satu pengaturan.']]], 422);
        }
        $d = array_map(fn ($v) => is_string($v) ? (trim($v) === '' ? null : trim($v)) : $v, $d);
        if (array_key_exists('name', $d) && $d['name'] === null) {
            return response()->json(['message' => 'Nama klinik wajib diisi.', 'errors' => ['name' => ['Nama klinik wajib diisi.']]], 422);
        }

        return DB::transaction(function () use ($d) {
            $t = Tenant::lockForUpdate()->findOrFail(Ctx::current()->tenant());
            $from = self::out($t);
            $t->update($d);
            foreach (array_diff_assoc(array_map(fn ($v) => json_encode($v), self::out($t)), array_map(fn ($v) => json_encode($v), $from)) as $field => $_) {
                Audit::log('ubah_pengaturan', 'tenant', $t->id, ['field' => $field, 'from' => $from[$field], 'to' => self::out($t)[$field]]);
            }

            return response()->json(self::out($t) + ['branches' => self::branches()]);
        });
    }

    /** POST /api/settings/clinic/logo (multipart logo): one logo for every branch (KL10). */
    public function uploadLogo(Request $request)
    {
        $request->validate(['logo' => PrivateImage::RULES]);
        $t = Tenant::findOrFail(Ctx::current()->tenant());
        $t->update(['logo_path' => PrivateImage::store($request->file('logo'), $t->id, 'logo')]);
        Audit::log('ubah_pengaturan', 'tenant', $t->id, ['field' => 'logo']);

        return response()->json(self::out($t) + ['branches' => self::branches()]);
    }

    /** GET /api/clinic/letterhead: kop for receipts and reports (every clinic role; no licence dates or settings). */
    public function letterhead()
    {
        $t = Tenant::findOrFail(Ctx::current()->tenant());

        return response()->json([...$t->only(['name', 'phone', 'email', 'npwp', 'license_no']), 'receipt_paper_mm' => (int) $t->receipt_paper_mm,
            'has_logo' => (bool) $t->logo_path, 'branches' => self::branches()]);
    }

    /** GET /api/clinic/logo */
    public function logo()
    {
        return PrivateImage::serve(Tenant::findOrFail(Ctx::current()->tenant())->logo_path);
    }

    /** PUT /api/settings/branches/{id} {address?, phone?}: only branches this user works in; audited per field. */
    public function updateBranch(Request $request, string $id)
    {
        $d = $request->validate([
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'regex:/^[0-9+() -]{6,30}$/'],
        ]);
        $d = array_map(fn ($v) => is_string($v) && trim($v) !== '' ? trim($v) : null, $d);

        return DB::transaction(function () use ($d, $id) {
            $b = Branch::whereNull('archived_at')->lockForUpdate()->findOrFail($id);
            if (! Ctx::current()->coversBranch($b->id)) {
                return Audit::denied('branch:'.$b->id);
            }
            $from = $b->only(['address', 'phone']);
            $b->update($d);
            foreach ($d as $field => $to) {
                if ($from[$field] !== $to) {
                    Audit::log('ubah_pengaturan', 'branch', $b->id, ['field' => $field, 'from' => $from[$field], 'to' => $to]);
                }
            }

            return response()->json($b->only(['id', 'name', 'address', 'phone']));
        });
    }

    private static function branches(): array
    {
        return Branch::whereNull('archived_at')->orderBy('name')->get(['id', 'name', 'address', 'phone'])
            ->filter(fn ($b) => Ctx::current()->coversBranch($b->id))->map->only(['id', 'name', 'address', 'phone'])->values()->all();
    }

    private static function out(Tenant $t): array
    {
        return ['correction_window_hours' => (int) $t->correction_window_hours, 'selesai_pin_required' => (bool) $t->selesai_pin_required,
            'name' => $t->name, 'address' => $t->address, 'phone' => $t->phone, 'email' => $t->email, 'license_no' => $t->license_no,
            'license_valid_until' => $t->license_valid_until ? substr((string) $t->license_valid_until, 0, 10) : null,
            'npwp' => $t->npwp, 'receipt_paper_mm' => (int) ($t->receipt_paper_mm ?? 80), 'has_logo' => (bool) $t->logo_path];
    }
}
