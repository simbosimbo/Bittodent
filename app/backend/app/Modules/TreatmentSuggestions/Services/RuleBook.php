<?php

namespace App\Modules\TreatmentSuggestions\Services;

use App\Modules\Clinical\Contracts\TreatmentPlan;
use App\Modules\Tariffs\Contracts\ProcedureCatalog;
use App\Modules\TreatmentSuggestions\Domain\Rule;
use App\Modules\TreatmentSuggestions\Models\TreatmentRule;
use App\Shared\Audit\Audit;
use App\Shared\Tenancy\Ctx;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

// Per-clinic rules, versioned and append-only. Current set = newest version of each rule_key; active=false retires a key.
final class RuleBook
{
    public function __construct(private TreatmentPlan $plan, private ProcedureCatalog $catalog) {}

    /** @return list<Rule> newest version of each key, active only */
    public function effective(): array
    {
        return array_values(array_map(fn (TreatmentRule $r) => new Rule($r->id, $r->rule_key, $r->version, $r->condition, $r->surfaces, $r->procedure_code, $r->priority),
            array_filter($this->newest(), fn (TreatmentRule $r) => $r->active)));
    }

    /** For the settings screen: newest version of every key (also retired ones) with the procedure name. */
    public function list(): array
    {
        $rows = $this->newest();
        $names = $this->catalog->names(array_map(fn ($r) => $r->procedure_code, $rows));

        return array_values(array_map(fn (TreatmentRule $r) => [
            'id' => $r->id, 'rule_key' => $r->rule_key, 'version' => $r->version, 'condition' => $r->condition, 'surfaces' => $r->surfaces,
            'procedure_code' => $r->procedure_code, 'procedure_name' => $names[$r->procedure_code] ?? null, 'priority' => $r->priority,
            'active' => $r->active, 'created_at' => $r->created_at?->toIso8601String(),
        ], $rows));
    }

    /**
     * New version of $key (or version 1 of a new key). Validates against the odontogram legend and the clinic's tariff list.
     *
     * @param  array{condition: string, surfaces?: ?list<string>, procedure_code: string, priority: int, active?: bool}  $d
     *
     * @throws ValidationException
     */
    public function write(string $key, array $d): array
    {
        $conds = $this->plan->conditions();
        $surfaces = isset($d['surfaces']) && $d['surfaces'] !== [] ? array_values(array_unique($d['surfaces'])) : null;
        $errors = [];
        if (! in_array($d['condition'], [...$conds['surface'], ...$conds['whole']], true)) {
            $errors['condition'] = 'Kondisi tidak ada di legenda odontogram.';
        } elseif ($surfaces !== null && in_array($d['condition'], $conds['whole'], true)) {
            $errors['surfaces'] = 'Kondisi seluruh gigi tidak memakai permukaan.';
        }
        if ($this->catalog->names([$d['procedure_code']]) === []) {
            $errors['procedure_code'] = 'Kode tindakan tidak ada di daftar tarif klinik ini.';
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        // No SELECT ... FOR UPDATE (ehr_app has no UPDATE on this table): unique (tenant, rule_key, version) settles a race.
        return DB::transaction(function () use ($key, $d, $surfaces) {
            $prev = TreatmentRule::where('rule_key', $key)->orderByDesc('version')->first();
            try {
                $r = TreatmentRule::create(['rule_key' => $key, 'version' => ($prev?->version ?? 0) + 1, 'condition' => $d['condition'],
                    'surfaces' => $surfaces, 'procedure_code' => $d['procedure_code'], 'priority' => $d['priority'],
                    'active' => $d['active'] ?? true, 'created_by' => Ctx::current()->userId]);
            } catch (UniqueConstraintViolationException) {
                throw ValidationException::withMessages(['rule_key' => 'Aturan ini baru saja diubah orang lain. Muat ulang.']);
            }
            Audit::log('buat', 'treatment_rule', $r->id, ['rule_key' => $key, 'version' => $r->version, 'active' => $r->active]);

            return ['id' => $r->id, 'rule_key' => $key, 'version' => $r->version];
        });
    }

    /** @return list<TreatmentRule> */
    private function newest(): array
    {
        return TreatmentRule::orderBy('rule_key')->orderByDesc('version')->get()->unique('rule_key')->values()->all();
    }
}
