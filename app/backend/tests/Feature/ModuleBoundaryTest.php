<?php

namespace Tests\Feature;

use Tests\TestCase;

// Module boundaries (config/modules.php): a module may reference another module only through its Contracts\ or Events\
// namespace and only along a declared edge; App\Shared references no module; nothing depends on Reporting.
class ModuleBoundaryTest extends TestCase
{
    /** @return list<string> violations for one file's code, given the module it lives in (null = Shared). */
    public static function violations(?string $module, string $code, array $edges): array
    {
        $bad = [];
        preg_match_all('/\\\\?App\\\\Modules\\\\(\w+)(?:\\\\(\w+))?/', $code, $m, PREG_SET_ORDER);
        foreach ($m as $hit) {
            [$ref, $target, $area] = [$hit[0], $hit[1], $hit[2] ?? ''];
            if ($target === $module) {
                continue;
            }
            if ($module === null) {
                $bad[] = "Shared -> $ref";
            } elseif (! in_array($target, $edges[$module] ?? [], true)) {
                $bad[] = "$module -> $ref (edge $module->$target not in config/modules.php)";
            } elseif (! in_array($area, ['Contracts', 'Events'], true)) {
                $bad[] = "$module -> $ref (only Contracts\\ or Events\\ allowed)";
            }
        }

        return $bad;
    }

    public function test_module_map_matches_directories_and_nobody_depends_on_reporting(): void
    {
        $edges = config('modules');
        $dirs = array_map('basename', glob(app_path('Modules/*'), GLOB_ONLYDIR));
        $this->assertEqualsCanonicalizing($dirs, array_keys($edges));
        foreach ($edges as $from => $to) {
            $this->assertNotContains('Reporting', $to, "$from must not depend on Reporting");
            $this->assertNotContains($from, $to);
            $this->assertSame([], array_diff($to, array_keys($edges)), "$from has an unknown edge");
            $this->assertFileExists(app_path("Modules/$from/{$from}ServiceProvider.php"));
        }
    }

    public function test_code_respects_module_boundaries(): void
    {
        $bad = [];
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(app_path(), \FilesystemIterator::SKIP_DOTS));
        foreach ($files as $f) {
            if ($f->getExtension() !== 'php') {
                continue;
            }
            $rel = substr($f->getPathname(), strlen(app_path()) + 1);
            $module = preg_match('#^Modules/(\w+)/#', $rel, $mm) ? $mm[1] : null;
            if ($module === null && ! str_starts_with($rel, 'Shared/')) {
                continue; // app/Providers: composition root (registers modules from config)
            }
            foreach (self::violations($module, file_get_contents($f->getPathname()), config('modules')) as $v) {
                $bad[] = "$rel: $v";
            }
        }
        $this->assertSame([], $bad);
    }

    // Pricing rule: the dentist never sees/sets prices (Clinical has no path to Billing/Tariffs, even transitively);
    // Compensation reads Billing only through Contracts (not Events/internals).
    public function test_pricing_and_reporting_edges(): void
    {
        $edges = config('modules');
        $reach = ['Clinical'];
        for ($i = 0; $i < count($reach); $i++) {
            $reach = array_values(array_unique([...$reach, ...$edges[$reach[$i]]]));
        }
        $this->assertSame([], array_intersect($reach, ['Billing', 'Tariffs']), 'Clinical must not reach Billing/Tariffs');
        $this->assertContains('Clinical', $edges['Billing']);
        $this->assertContains('Tariffs', $edges['Billing']);
        $this->assertSame([], array_keys(array_filter($edges, fn ($to) => in_array('Reporting', $to, true))));

        $this->assertSame([], self::compensationBillingRefs(self::moduleCode('Compensation')));
        $this->assertNotEmpty(self::compensationBillingRefs('use App\\Modules\\Billing\\Events\\InvoiceFinalized;'));
        $this->assertSame([], self::compensationBillingRefs('use App\\Modules\\Billing\\Contracts\\FinalizedRevenue;'));
    }

    /** @return list<string> Billing references that are not Billing\Contracts\ */
    private static function compensationBillingRefs(string $code): array
    {
        preg_match_all('/App\\\\Modules\\\\Billing\\\\(?!Contracts\\\\)\w+/', $code, $m);

        return $m[0];
    }

    private static function moduleCode(string $module): string
    {
        $code = '';
        foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(app_path("Modules/$module"), \FilesystemIterator::SKIP_DOTS)) as $f) {
            $code .= $f->getExtension() === 'php' ? file_get_contents($f->getPathname()) : '';
        }

        return $code;
    }

    public function test_scanner_self_check_flags_forbidden_imports(): void
    {
        $edges = ['Clinical' => ['Patients', 'Scheduling'], 'Scheduling' => ['Patients'], 'Billing' => [], 'Patients' => []];
        $this->assertSame([], self::violations('Clinical', "use App\\Modules\\Patients\\Contracts\\PatientDirectory;\nuse App\\Modules\\Clinical\\Models\\Visit;", $edges));
        $this->assertSame([], self::violations('Clinical', 'use App\\Modules\\Scheduling\\Events\\AppointmentDone;', $edges));
        // internals of an allowed module
        $this->assertNotEmpty(self::violations('Scheduling', 'use App\\Modules\\Patients\\Models\\Patient;', $edges));
        $this->assertNotEmpty(self::violations('Scheduling', '$x = \\App\\Modules\\Patients\\Services\\PatientSearch::query("a");', $edges));
        // undeclared edge, even via Contracts
        $this->assertNotEmpty(self::violations('Clinical', 'use App\\Modules\\Billing\\Contracts\\Invoices;', $edges));
        $this->assertNotEmpty(self::violations('Billing', 'use App\\Modules\\Reporting\\Contracts\\Report;', $edges));
        // Shared must not know modules
        $this->assertNotEmpty(self::violations(null, 'use App\\Modules\\Tenancy\\Models\\Branch;', $edges));
        $this->assertSame([], self::violations(null, 'use App\\Shared\\Tenancy\\Ctx;', $edges));
    }
}
