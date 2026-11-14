<?php

namespace Tests\Feature;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ArchitectureTest extends TestCase
{
    /** Files allowed to bypass the tenant scope. Must stay empty. */
    private const ALLOWLIST = [];

    private const FORBIDDEN = [
        '/withoutGlobalScopes?\s*\(/' => 'withoutGlobalScope(s)',
        '/DB::(table|select|selectOne|statement|unprepared|insert|update|delete|raw|cursor)\s*\(/' => 'DB:: raw query',
        '/->(whereRaw|selectRaw|orderByRaw|havingRaw|fromRaw|joinRaw)\s*\(/' => 'raw SQL fragment',
        '/newQueryWithoutScopes?\s*\(/' => 'newQueryWithoutScopes',
    ];

    public static function offenses(string $code): array
    {
        $found = [];
        foreach (self::FORBIDDEN as $re => $label) {
            if (preg_match($re, $code)) {
                $found[] = $label;
            }
        }

        return $found;
    }

    public function test_every_model_on_a_tenant_table_uses_belongs_to_tenant(): void
    {
        $checked = 0;
        // every class under app/ (modules + shared), PSR-4: app/X/Y.php => App\\X\\Y
        foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(app_path(), \FilesystemIterator::SKIP_DOTS)) as $f) {
            $class = 'App\\'.str_replace(['/', '.php'], ['\\', ''], substr($f->getPathname(), strlen(app_path()) + 1));
            if ($f->getExtension() !== 'php' || str_contains($f->getPathname(), '/Routes/') || ! is_subclass_of($class, Model::class)) {
                continue;
            }
            $table = (new $class)->getTable();
            if (Schema::connection('mysql_admin')->hasColumn($table, 'tenant_id')) {
                $this->assertContains(BelongsToTenant::class, class_uses_recursive($class), "$class ($table) must use BelongsToTenant");
                $checked++;
            }
        }
        $this->assertGreaterThanOrEqual(10, $checked);
        // and every tenant table has a model (so nothing is reachable only through raw queries)
        $db = Schema::connection('mysql_admin')->getConnection()->getDatabaseName();
        $tables = array_filter(array_column(Schema::connection('mysql_admin')->getTables($db), 'name'),
            fn ($t) => Schema::connection('mysql_admin')->hasColumn($t, 'tenant_id'));
        $this->assertCount($checked, $tables);
    }

    public function test_app_code_never_bypasses_the_tenant_scope(): void
    {
        $bad = [];
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(app_path()));
        foreach ($it as $f) {
            if ($f->getExtension() !== 'php' || in_array($f->getPathname(), self::ALLOWLIST, true)) {
                continue;
            }
            foreach (self::offenses(file_get_contents($f->getPathname())) as $o) {
                $bad[] = $f->getPathname().': '.$o;
            }
        }
        $this->assertSame([], $bad);
    }

    public function test_scanner_self_check_flags_offending_snippets(): void
    {
        $this->assertNotEmpty(self::offenses('Patient::withoutGlobalScope("tenant")->get();'));
        $this->assertNotEmpty(self::offenses('Patient::query()->withoutGlobalScopes()->get();'));
        $this->assertNotEmpty(self::offenses("DB::table('patient')->get();"));
        $this->assertNotEmpty(self::offenses("DB::select('select * from patient');"));
        $this->assertNotEmpty(self::offenses('$q->whereRaw("1=1");'));
        $this->assertSame([], self::offenses('Patient::where("name_normalized", "like", "sari%")->get();'));
    }
}
