<?php

namespace App\Shared\Audit;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

// Global, append-only login/logout log (written before a tenant is chosen). Email only as HMAC.
class AuthEvent extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $table = 'auth_event';

    protected $guarded = [];
}
