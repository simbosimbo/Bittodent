<?php

namespace App\Modules\Scribe\Models;

use App\Modules\Scribe\Contracts\ScribeSessionState;
use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ScribeSession extends Model
{
    use BelongsToTenant;

    protected $table = 'scribe_session';

    protected $guarded = ['tenant_id'];

    protected $casts = [
        'duration_sec' => 'integer',
        'audio_deleted_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function state(): ScribeSessionState
    {
        return ScribeSessionState::from($this->state);
    }
}
