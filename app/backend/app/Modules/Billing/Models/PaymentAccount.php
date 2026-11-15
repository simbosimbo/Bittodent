<?php

namespace App\Modules\Billing\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// Clinic-owned payment destination (unit 5). The only thing a payment may point to. Deactivated, never deleted (trigger).
class PaymentAccount extends Model
{
    use BelongsToTenant;

    public const KINDS = ['tunai', 'qris', 'edc', 'transfer'];

    protected $table = 'payment_account';

    protected $guarded = ['tenant_id'];

    protected $casts = ['is_active' => 'boolean'];

    /** Usable for an invoice of $branchId: active and either tenant-wide or that branch. */
    public function usableAt(string $branchId): bool
    {
        return $this->is_active && ($this->branch_id === null || $this->branch_id === $branchId);
    }
}
