<?php

namespace App\Modules\Ktp\Domain;

use App\Modules\Ktp\Contracts\KtpInput;
use App\Modules\Ktp\Contracts\NikCheck;
use App\Modules\Ktp\Contracts\NikData;
use App\Modules\Ktp\Contracts\NikValidator;
use App\Shared\Crypto\Crypto;

/** Pure NIK parse and field comparison. No I/O, no logging. */
final class NikParser implements NikValidator
{
    public function parse(string $nik): ?NikData
    {
        $d = Crypto::normalizeNik($nik) ?? '';
        if (strlen($d) !== 16) {
            return null;
        }
        $province = substr($d, 0, 2);
        $regency = substr($d, 2, 2);
        $district = substr($d, 4, 2);
        $dayRaw = (int) substr($d, 6, 2);
        $month = (int) substr($d, 8, 2);
        $yy = (int) substr($d, 10, 2);
        $sex = 'laki_laki';
        $day = $dayRaw;
        if ($dayRaw > 40) {
            $sex = 'perempuan';
            $day = $dayRaw - 40;
        }
        $year = self::century($yy, $month, $day);
        if ($year === null || ! checkdate($month, $day, $year)) {
            return null;
        }

        return new NikData(
            nik: $d,
            provinceCode: $province,
            regencyCode: $regency,
            districtCode: $district,
            dateOfBirth: sprintf('%04d-%02d-%02d', $year, $month, $day),
            sex: $sex,
        );
    }

    public function check(KtpInput $input): NikCheck
    {
        $nik = Crypto::normalizeNik($input->nik);
        if ($nik === null) {
            return new NikCheck(validLength: true, mismatches: [], parsed: null);
        }
        if (strlen($nik) !== 16) {
            return new NikCheck(validLength: false, mismatches: ['nik'], parsed: null);
        }
        $parsed = $this->parse($nik);
        if ($parsed === null) {
            return new NikCheck(validLength: true, mismatches: ['nik'], parsed: null);
        }
        $mismatches = [];
        if (self::filled($input->dateOfBirth) && $input->dateOfBirth !== $parsed->dateOfBirth) {
            $mismatches[] = 'dob';
        }
        if (self::filled($input->sex) && $input->sex !== $parsed->sex) {
            $mismatches[] = 'sex';
        }
        if (self::filled($input->provinceCode) && self::pad2($input->provinceCode) !== $parsed->provinceCode) {
            $mismatches[] = 'province';
        }
        if (self::filled($input->regencyCode) && self::pad2($input->regencyCode) !== $parsed->regencyCode) {
            $mismatches[] = 'regency';
        }
        if (self::filled($input->districtCode) && self::pad2($input->districtCode) !== $parsed->districtCode) {
            $mismatches[] = 'district';
        }

        return new NikCheck(validLength: true, mismatches: $mismatches, parsed: $parsed);
    }

    /** Prefer 20xx; if that date is in the future, use 19xx. */
    private static function century(int $yy, int $month, int $day): ?int
    {
        $y20 = 2000 + $yy;
        $y19 = 1900 + $yy;
        if (checkdate($month, $day, $y20) && ! self::future($y20, $month, $day)) {
            return $y20;
        }
        if (checkdate($month, $day, $y19)) {
            return $y19;
        }
        if (checkdate($month, $day, $y20)) {
            return $y20;
        }

        return null;
    }

    private static function future(int $year, int $month, int $day): bool
    {
        return (int) sprintf('%04d%02d%02d', $year, $month, $day) > (int) gmdate('Ymd');
    }

    private static function filled(?string $v): bool
    {
        return $v !== null && $v !== '';
    }

    private static function pad2(string $v): string
    {
        return str_pad(preg_replace('/\D/', '', $v) ?? '', 2, '0', STR_PAD_LEFT);
    }
}
