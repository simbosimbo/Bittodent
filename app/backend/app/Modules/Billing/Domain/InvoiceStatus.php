<?php

namespace App\Modules\Billing\Domain;

use App\Modules\Billing\Models\Invoice;
use LogicException;

// invoice.status state machine. terbuka <-> lunas follows the computed balance; void (unit B) is terminal and only via an
// approved/allowed void request. The invoice row and its lines stay; a void invoice owes Rp0 and accepts no new money documents.
final class InvoiceStatus
{
    public const TRANSITIONS = [
        'terbuka' => ['lunas', 'void'],
        'lunas' => ['terbuka', 'void'], // lunas without payment (approved 100% discount) may still be voided
        'void' => [],
    ];

    public static function move(Invoice $inv, string $to): void
    {
        if ($inv->status === $to) {
            return;
        }
        if (! in_array($to, self::TRANSITIONS[$inv->status] ?? [], true)) {
            throw new LogicException("invoice {$inv->status} -> $to tidak diizinkan.");
        }
        $inv->update(['status' => $to]);
    }
}
