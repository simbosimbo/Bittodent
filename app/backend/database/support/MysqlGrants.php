<?php

namespace Database\Support;

use Illuminate\Support\Facades\DB;

// Migration-only (lives outside app/, where raw DB:: calls are banned by ArchitectureTest).
// Per-table GRANTs for the runtime account (DB_USERNAME, normally ehr_app), used by every migration in database/migrations/mysql.
// DB_APP_GRANTS=false (single-account hosting whose only DB user cannot GRANT): grants are skipped, while triggers and
// indexes in the same migrations still run. Privilege separation is then lost (app/DEVIATIONS.md #59, staging only).
final class MysqlGrants
{
    public static function enabled(): bool
    {
        return (bool) config('ehr.db_app_grants', true);
    }

    public static function grant(string $privileges, string ...$tables): void
    {
        if (! self::enabled()) {
            return;
        }
        $db = DB::connection()->getDatabaseName();
        $grantee = sprintf("'%s'@'%s'", config('database.connections.mysql.username'), config('ehr.db_app_grant_host'));
        foreach ($tables as $t) {
            DB::statement("GRANT $privileges ON `$db`.`$t` TO $grantee");
        }
    }
}
