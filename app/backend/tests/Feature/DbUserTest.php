<?php

namespace Tests\Feature;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

// Runs on a separate ehr_app connection outside the test transaction (DDL would implicitly commit it).
class DbUserTest extends TestCase
{
    private function probe()
    {
        config(['database.connections.mysql_probe' => config('database.connections.mysql')]);

        return DB::connection('mysql_probe');
    }

    public static function forbidden(): array
    {
        return [
            'truncate patient' => ['TRUNCATE TABLE patient'],
            'drop table' => ['DROP TABLE patient'],
            'alter table' => ['ALTER TABLE patient ADD COLUMN x INT'],
            'create table' => ['CREATE TABLE evil (id INT)'],
            'delete clinical_note_version' => ['DELETE FROM clinical_note_version'],
            'delete audit_event' => ['DELETE FROM audit_event'],
            'delete patient' => ['DELETE FROM patient'],
            'update audit_event' => ["UPDATE audit_event SET action = 'x'"],
            'insert icd10_codes' => ["INSERT INTO icd10_codes (code, display, version) VALUES ('TEST', 'test', 'TEST')"],
            'update icd9cm_codes' => ['UPDATE icd9cm_codes SET valid = 0'],
            'create trigger' => ['CREATE TRIGGER t BEFORE INSERT ON patient FOR EACH ROW SET NEW.name = NEW.name'],
        ];
    }

    #[DataProvider('forbidden')]
    public function test_ehr_app_cannot(string $sql): void
    {
        $this->assertSame('ehr_app', explode('@', $this->probe()->selectOne('select current_user() as u')->u)[0]);
        $this->expectException(QueryException::class);
        $this->probe()->unprepared($sql);
    }

    public function test_grants_have_no_ddl_or_all(): void
    {
        $grants = implode("\n", array_map(fn ($r) => array_values((array) $r)[0], $this->probe()->select('SHOW GRANTS')));
        foreach (['ALL PRIVILEGES', 'DROP', 'ALTER', 'CREATE', 'INDEX', 'TRIGGER', 'REFERENCES', 'GRANT OPTION'] as $p) {
            $this->assertStringNotContainsString($p, $grants);
        }
        $this->assertDoesNotMatchRegularExpression('/DELETE ON `[^`]+`\.`(patient|clinical_note_version|audit_event|auth_event)`/', $grants);
    }
}
