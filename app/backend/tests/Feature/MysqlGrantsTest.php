<?php

namespace Tests\Feature;

use Database\Support\MysqlGrants;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// DB_APP_GRANTS=false (single-account hosting): the mysql migrations must drop exactly their GRANTs and keep everything else.
// Queries are captured with pretend(), nothing is executed.
class MysqlGrantsTest extends TestCase
{
    private function queries(callable $fn, bool $grants): array
    {
        config(['ehr.db_app_grants' => $grants]);

        return array_column(DB::connection('mysql_admin')->pretend(function () use ($fn) {
            DB::setDefaultConnection('mysql_admin');
            try {
                $fn();
            } finally {
                DB::setDefaultConnection('mysql');
            }
        }), 'query');
    }

    public function test_helper_grants_when_enabled_and_skips_when_disabled(): void
    {
        $this->assertSame([], $this->queries(fn () => MysqlGrants::grant('SELECT', 'patient', 'visit'), false));

        $q = $this->queries(fn () => MysqlGrants::grant('SELECT', 'patient', 'visit'), true);
        $this->assertCount(2, $q);
        $this->assertMatchesRegularExpression("/^GRANT SELECT ON `ehr_test`\\.`patient` TO 'ehr_app'@'[^']+'$/", $q[0]);
    }

    public function test_every_mysql_migration_keeps_triggers_and_drops_only_grants_when_disabled(): void
    {
        $triggers = 0;
        foreach (glob(database_path('migrations/mysql/*.php')) as $file) {
            $up = fn () => (require $file)->up();
            $on = $this->queries($up, true);
            $off = $this->queries($up, false);

            $this->assertSame(array_values(array_filter($on, fn ($q) => ! str_starts_with($q, 'GRANT '))), $off, basename($file));
            $triggers += count(array_filter($off, fn ($q) => str_starts_with($q, 'CREATE TRIGGER')));
        }
        $this->assertGreaterThan(30, $triggers);
    }

    public function test_admin_connection_falls_back_to_runtime_account_only_when_admin_user_is_empty(): void
    {
        $load = function (array $env) {
            $saved = [];
            foreach ($env as $k => $v) {
                $saved[$k] = [$_ENV[$k] ?? null, $_SERVER[$k] ?? null, getenv($k)];
                [$_ENV[$k], $_SERVER[$k]] = [$v, $v];
                putenv("$k=$v");
            }
            try {
                return (require config_path('database.php'))['connections']['mysql_admin'];
            } finally {
                foreach ($saved as $k => [$e, $s, $p]) {
                    [$_ENV[$k], $_SERVER[$k]] = [$e, $s];
                    $p === false ? putenv($k) : putenv("$k=$p");
                }
            }
        };
        $base = ['DB_USERNAME' => 'u_one', 'DB_PASSWORD' => 'p_one'];

        $single = $load($base + ['DB_ADMIN_USERNAME' => '', 'DB_ADMIN_PASSWORD' => '']);
        $this->assertSame(['u_one', 'p_one'], [$single['username'], $single['password']]);

        $split = $load($base + ['DB_ADMIN_USERNAME' => 'ehr_admin', 'DB_ADMIN_PASSWORD' => '']);
        $this->assertSame(['ehr_admin', ''], [$split['username'], $split['password']]);
    }
}
