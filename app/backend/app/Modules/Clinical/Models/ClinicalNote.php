<?php

namespace App\Modules\Clinical\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ClinicalNote extends Model
{
    use BelongsToTenant;

    protected $table = 'clinical_note';

    protected $guarded = ['tenant_id'];

    protected $casts = ['first_input_at' => 'datetime'];

    public function versions()
    {
        return $this->hasMany(ClinicalNoteVersion::class, 'note_id')->orderBy('version');
    }
}
