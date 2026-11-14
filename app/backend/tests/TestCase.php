<?php

namespace Tests;

use App\Modules\Identity\Models\User;
use App\Modules\Patients\Models\Patient;
use App\Modules\Tenancy\Models\Tenant;
use App\Shared\Tenancy\Ctx;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

// Schema + synthetic seed are built once per run as ehr_admin (migrate:fresh --database=mysql_admin --seed);
// each test then runs as ehr_app (connection `mysql`) inside a rolled-back transaction.
abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected $seed = true;

    protected $connectionsToTransact = ['mysql', 'mysql_admin'];

    protected function migrateFreshUsing()
    {
        return ['--database' => 'mysql_admin', '--seed' => true];
    }

    protected function tenantA(): Tenant
    {
        return Tenant::where('name', 'Klinik Gigi Senyum Sehat')->firstOrFail();
    }

    protected function tenantB(): Tenant
    {
        return Tenant::where('name', 'Klinik Gigi Ceria')->firstOrFail();
    }

    protected function user(string $email): User
    {
        return User::where('email', $email)->firstOrFail();
    }

    protected function as(string $email): static
    {
        // SPA origin => Sanctum treats the request as stateful (session cookie), like the real frontend.
        return $this->actingAs($this->user($email))->withHeaders(['Accept' => 'application/json', 'Origin' => 'http://127.0.0.1:5173', 'Referer' => 'http://127.0.0.1:5173/']);
    }

    protected function patientOf(Tenant $t): Patient
    {
        return Ctx::runAs($t->id, fn () => Patient::orderBy('created_at')->firstOrFail());
    }
}
