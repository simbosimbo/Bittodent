<?php

namespace Tests\Modules\Ktp;

use App\Modules\Ktp\Contracts\KtpInput;
use App\Modules\Ktp\Domain\NikParser;
use App\Shared\Identity\NikMask;
use PHPUnit\Framework\TestCase;

// Synthetic NIKs only.
class NikParserTest extends TestCase
{
    public function test_male_and_female_dob_sex_and_wilayah(): void
    {
        $m = (new NikParser)->parse('3201011501900001');
        $this->assertSame(['32', '01', '01', '1990-01-15', 'laki_laki'], [$m->provinceCode, $m->regencyCode, $m->districtCode, $m->dateOfBirth, $m->sex]);
        $f = (new NikParser)->parse('3201 0155 0190 0001');
        $this->assertSame(['32', '01', '01', '1990-01-15', 'perempuan'], [$f->provinceCode, $f->regencyCode, $f->districtCode, $f->dateOfBirth, $f->sex]);
    }

    public function test_century_prefers_20xx_unless_future(): void
    {
        $this->assertSame('1990-01-15', (new NikParser)->parse('3201011501900001')->dateOfBirth); // 2090 is future
        $this->assertSame('2010-01-15', (new NikParser)->parse('3201011501100001')->dateOfBirth);
        $this->assertNull((new NikParser)->parse('3201013201900001')); // day 32
    }

    public function test_length_and_field_mismatches_by_key(): void
    {
        $p = new NikParser;
        $short = $p->check(new KtpInput(nik: '320101150190'));
        $this->assertFalse($short->validLength);
        $this->assertSame(['nik'], $short->mismatches);

        $this->assertSame([], $p->check(new KtpInput(nik: '3201011501900001'))->mismatches); // empty fields: nothing to compare
        $ok = $p->check(new KtpInput('3201011501900001', null, '1990-01-15', 'laki_laki', '32', '1', '01'));
        $this->assertTrue($ok->ok());
        $bad = $p->check(new KtpInput('3201011501900001', null, '1990-01-16', 'perempuan', '33', '01', '02'));
        $this->assertSame(['dob', 'sex', 'province', 'district'], $bad->mismatches);
        $this->assertTrue($p->check(new KtpInput)->ok()); // no NIK at all
    }

    public function test_mask(): void
    {
        $this->assertSame('3201********0001', NikMask::mask('3201011501900001'));
        $this->assertSame('9901********0001', NikMask::mask('9901 0000 0000 0001'));
        $this->assertNull(NikMask::mask(null));
    }
}
