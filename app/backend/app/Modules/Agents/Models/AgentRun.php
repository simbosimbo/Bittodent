<?php

namespace App\Modules\Agents\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// Written only by Services\AgentRunRecorder. No prompt, reply or clinical text: hashes, counts and reference ids only.
class AgentRun extends Model
{
    use BelongsToTenant;

    protected $table = 'agent_run';

    protected $guarded = ['tenant_id'];

    public $timestamps = false;

    protected $casts = ['input_refs' => 'array', 'started_at' => 'datetime', 'finished_at' => 'datetime'];
}
