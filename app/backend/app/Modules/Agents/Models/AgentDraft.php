<?php

namespace App\Modules\Agents\Models;

use App\Modules\Agents\Contracts\DraftKind;
use App\Modules\Agents\Contracts\DraftState;
use App\Shared\Crypto\Crypto;
use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// One reviewable agent output item. Content only in *_enc columns. State changes only via Services\DraftReviewService.
class AgentDraft extends Model
{
    use BelongsToTenant;

    protected $table = 'agent_draft';

    protected $guarded = ['tenant_id'];

    protected $hidden = ['payload_enc', 'source_spans_enc', 'reject_reason_enc'];

    protected $casts = ['kind' => DraftKind::class, 'state' => DraftState::class, 'reviewed_at' => 'datetime', 'expires_at' => 'datetime', 'purged_at' => 'datetime'];

    public function payload(): array
    {
        return json_decode(Crypto::decrypt($this->payload_enc), true, flags: JSON_THROW_ON_ERROR);
    }
}
