<?php

namespace App\Shared\Tenancy;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use LogicException;

// MySQL mode has no RLS: this global scope IS the tenant wall. Fail closed: no tenant context => exception, never all rows.
// Required on every model whose table has tenant_id (enforced by tests/Feature/ArchitectureTest).
trait BelongsToTenant
{
    use HasUuids;

    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope('tenant', function (Builder $query) {
            $ctx = Ctx::current();
            $model = $query->getModel();
            // Membership only: before a tenant is chosen, the logged-in user may list their OWN memberships.
            if ($ctx->tenantId === null && $model->tenantlessOwnerColumn() && $ctx->userId !== null) {
                $query->where($model->qualifyColumn($model->tenantlessOwnerColumn()), $ctx->userId);

                return;
            }
            $query->where($model->qualifyColumn('tenant_id'), $ctx->tenant());
        });

        static::creating(function ($model) {
            $tenant = Ctx::current()->tenant();
            if ($model->tenant_id !== null && $model->tenant_id !== $tenant) {
                throw new LogicException('tenant_id lain dari konteks aktif ditolak.');
            }
            $model->tenant_id = $tenant;
        });
    }

    protected function tenantlessOwnerColumn(): ?string
    {
        return null;
    }

    // DB primary key is (tenant_id, id): keep tenant_id in UPDATE ... WHERE so it hits the PK.
    protected function setKeysForSaveQuery($query)
    {
        return parent::setKeysForSaveQuery($query)->where('tenant_id', $this->getOriginal('tenant_id') ?? $this->tenant_id);
    }
}
