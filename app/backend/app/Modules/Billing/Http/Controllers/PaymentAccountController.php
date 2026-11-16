<?php

namespace App\Modules\Billing\Http\Controllers;

use App\Modules\Billing\Models\PaymentAccount;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Files\PrivateImage;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

// Unit 5: clinic-owned payment accounts (the only payment methods). Owner manages (billing.accounts); list = billing.read.
// No DELETE: deactivate. kind/branch/bank/last4 are fixed after creation so old payments keep their meaning (create a new one instead).
class PaymentAccountController extends Controller
{
    private const FIELDS = ['id', 'branch_id', 'name', 'kind', 'bank_name', 'account_last4', 'is_active', 'created_at', 'updated_at'];

    /** GET /api/payment-accounts: tenant-wide accounts + those of branches the user works in (inactive too, flagged). */
    public function index()
    {
        return response()->json(PaymentAccount::orderBy('name')->get()
            ->filter(fn ($a) => $a->branch_id === null || Ctx::current()->coversBranch($a->branch_id))
            ->map(fn ($a) => self::out($a))->values());
    }

    /** POST /api/payment-accounts {name, kind, branch_id?, bank_name?, account_last4?} */
    public function store(Request $request, TenancyDirectory $tenancy)
    {
        if ($bad = self::unknownKeys($request, ['name', 'kind', 'branch_id', 'bank_name', 'account_last4'])) {
            return $bad;
        }
        $d = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'kind' => ['required', Rule::in(PaymentAccount::KINDS)],
            'branch_id' => ['nullable', 'uuid'],
            'bank_name' => ['nullable', 'string', 'max:60'],
            'account_last4' => ['nullable', 'digits:4'],
        ]);
        if (($d['branch_id'] ?? null) !== null && (! $tenancy->branchExists($d['branch_id']) || ! Ctx::current()->coversBranch($d['branch_id']))) {
            return response()->json(['message' => 'Cabang tidak dikenal.', 'errors' => ['branch_id' => ['Cabang tidak dikenal.']]], 422);
        }
        $a = PaymentAccount::create([...$d, 'created_by' => Ctx::current()->userId]);
        Audit::log('akun_bayar_dibuat', 'payment_account', $a->id, ['kind' => $a->kind, 'branch_id' => $a->branch_id]);

        return response()->json(self::out($a->fresh()), 201);
    }

    /** PATCH /api/payment-accounts/{id} {name?, is_active?} */
    public function update(Request $request, string $id)
    {
        if ($bad = self::unknownKeys($request, ['name', 'is_active'])) {
            return $bad;
        }
        $d = $request->validate(['name' => ['sometimes', 'string', 'min:2', 'max:100'], 'is_active' => ['sometimes', 'boolean']]);
        $a = PaymentAccount::findOrFail($id);
        if ($a->branch_id !== null && ! Ctx::current()->coversBranch($a->branch_id)) {
            return Audit::denied('branch:'.$a->branch_id);
        }
        $a->update($d);
        Audit::log(($d['is_active'] ?? true) ? 'akun_bayar_diubah' : 'akun_bayar_dinonaktifkan', 'payment_account', $a->id, ['changed' => array_keys($d)]);

        return response()->json(self::out($a));
    }

    /** POST /api/payment-accounts/{id}/qris-image (multipart image): static QRIS photo of a QRIS account (KL12), owner. */
    public function uploadQris(Request $request, string $id)
    {
        $request->validate(['image' => PrivateImage::RULES]);
        $a = self::covered($id);
        if ($a->kind !== 'qris') {
            return response()->json(['message' => 'Foto QRIS hanya untuk akun QRIS.', 'errors' => ['image' => ['Bukan akun QRIS.']]], 422);
        }
        $a->update(['qris_image_path' => PrivateImage::store($request->file('image'), $a->tenant_id, 'qris')]);
        Audit::log('akun_bayar_diubah', 'payment_account', $a->id, ['changed' => ['qris_image']]);

        return response()->json(self::out($a));
    }

    /** GET /api/payment-accounts/{id}/qris-image: shown to the patient at the cashier (KL04). */
    public function qrisImage(string $id)
    {
        return PrivateImage::serve(self::covered($id)->qris_image_path);
    }

    private static function covered(string $id): PaymentAccount
    {
        $a = PaymentAccount::findOrFail($id);
        abort_if($a->branch_id !== null && ! Ctx::current()->coversBranch($a->branch_id), 403);

        return $a;
    }

    private static function out(PaymentAccount $a): array
    {
        return [...$a->only(self::FIELDS), 'has_qris_image' => (bool) $a->qris_image_path];
    }

    /** Strict allow-list: a stray field (e.g. a typed nomor rekening) is rejected, never silently stored or ignored. */
    public static function unknownKeys(Request $request, array $allowed)
    {
        $extra = array_values(array_diff(array_keys($request->all()), $allowed));

        return $extra === [] ? null : response()->json(['error' => 'unknown_fields', 'message' => 'Field tidak dikenal: '.implode(', ', $extra).'.',
            'errors' => array_fill_keys($extra, ['Tidak diizinkan. Pembayaran hanya ke akun klinik.'])], 422);
    }
}
