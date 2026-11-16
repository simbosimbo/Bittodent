<?php

namespace App\Modules\Billing\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    use BelongsToTenant;

    protected $table = 'invoice';

    protected $guarded = ['tenant_id', 'number'];

    protected static function booted(): void
    {
        // every invoice is numbered at creation (INV-YYYY-000001); the number never changes (MySQL trigger)
        static::creating(fn (self $inv) => $inv->number = self::nextNumber());
    }

    /** INV-YYYY-000001, sequential per tenant and year. Inside a transaction the counter row lock serializes numbering. */
    private static function nextNumber(): string
    {
        $year = (int) now()->format('Y');
        $seq = InvoiceSeq::createOrFirst(['year' => $year], ['last_number' => 0]);
        $seq = InvoiceSeq::lockForUpdate()->findOrFail($seq->id);
        $seq->update(['last_number' => $seq->last_number + 1]);

        return sprintf('INV-%d-%06d', $year, $seq->last_number);
    }
}
