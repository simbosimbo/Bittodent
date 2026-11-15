<?php

namespace App\Shared\Permissions;

// The one RBAC matrix. Route guard: ->middleware('perm:<permission>').
final class Permissions
{
    public const MATRIX = [
        // owner: clinical read-only (never note.write/note.sign/prescription sign); every chart/baseline/medical-history read is audited.
        'owner' => ['patient.read', 'patient.read_nik', 'patient.create', 'appointment.read', 'appointment.create',
            'appointment.transition', 'note.read', 'audit.read', 'correction.approve', 'patient.update', 'billing.read', 'billing.adjust', 'tariff.manage',
            'billing.approve_zero'], // unit 4: approve a Rp0 / 100% discount; owner ONLY (not front desk, kasir, dentist)
        'dentist' => ['patient.read', 'patient.read_nik', 'patient.create', 'appointment.read', 'appointment.create',
            'appointment.transition', 'note.read', 'note.write', 'note.sign', 'patient.update', 'appointment.plan'],
        // procedure.confirm_external: second pair of eyes on an external entry made on a visit with `selesai` work that day (unit 2).
        // Not the dentist (who records it), not kasir; owner is an open decision (DEVIATIONS #48).
        'assistant' => ['patient.read', 'appointment.read', 'appointment.transition', 'note.read', 'note.write', 'appointment.plan',
            'procedure.confirm_external'],
        'front_desk' => ['patient.read', 'patient.create', 'appointment.read', 'appointment.create', 'appointment.transition',
            'patient.update', 'billing.read', 'billing.adjust', 'procedure.confirm_external'],
        'kasir' => ['patient.read', 'appointment.read', 'billing.read', 'billing.adjust'],
    ];

    public const LABELS = [
        'owner' => 'Pemilik',
        'dentist' => 'Dokter gigi',
        'assistant' => 'Asisten',
        'front_desk' => 'Front desk',
        'kasir' => 'Kasir',
    ];

    /** @param list<string> $roles */
    public static function allows(array $roles, string $permission): bool
    {
        foreach ($roles as $role) {
            if (in_array($permission, self::MATRIX[$role] ?? [], true)) {
                return true;
            }
        }

        return false;
    }

    /** @param list<string> $roles */
    public static function for(array $roles): array
    {
        return array_values(array_unique(array_merge(...array_map(fn ($r) => self::MATRIX[$r] ?? [], $roles ?: ['_']))));
    }
}
