<?php

namespace App\Modules\Clinical\Domain;

// Odontogram v2 taxonomy, read from the one data table resources/odontogram/taxonomy.json (the frontend gets a generated copy).
// Components and controllers ask this class; no condition, status, surface or role list is hardcoded elsewhere.
final class OdontogramTaxonomy
{
    private static ?array $t = null;

    public static function table(): array
    {
        return self::$t ??= json_decode((string) file_get_contents(resource_path('odontogram/taxonomy.json')), true, 512, JSON_THROW_ON_ERROR);
    }

    /** @return array<string, array{key: string, label: string, code: ?string, group: string, official: bool}> */
    public static function conditions(): array
    {
        return array_column(self::table()['conditions'], null, 'key');
    }

    public static function condition(string $key): ?array
    {
        return self::conditions()[$key] ?? null;
    }

    /** v2 status key => ProcedureStatus value (ada_sebelumnya => ada_di_klinik_ini, ...). */
    public static function procedureStatus(string $status): ?string
    {
        return array_column(self::table()['statuses'], 'procedure_status', 'key')[$status] ?? null;
    }

    public static function statuses(): array
    {
        return array_column(self::table()['statuses'], 'key');
    }

    /** Official surface letter (MODVL + I) => stored letter (V is stored as B, so existing rows stay valid). */
    public static function storedSurface(string $letter): ?string
    {
        return array_column(self::table()['surfaces'], 'stored', 'key')[strtoupper($letter)] ?? null;
    }

    /** group => ProcedureCatalog treat_area */
    public static function area(string $group): ?string
    {
        return array_column(self::table()['groups'], 'area', 'key')[$group] ?? null;
    }

    public static function spanRoles(): array
    {
        return array_column(self::table()['span_roles'], 'key');
    }

    public static function materials(): array
    {
        return array_column(self::table()['span_materials'], 'key');
    }

    /** FDI permanent + primary teeth the 2D chart can take as input. */
    public static function teeth(): array
    {
        return [...self::table()['dentitions']['permanent'], ...self::table()['dentitions']['primary']];
    }
}
