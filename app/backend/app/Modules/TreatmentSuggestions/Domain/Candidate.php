<?php

namespace App\Modules\TreatmentSuggestions\Domain;

// One suggestion: one procedure on one tooth, citing every odontogram finding it came from (id + version). Never a diagnosis:
// condition is copied from the cited findings, nothing is inferred.
final class Candidate
{
    /**
     * @param  list<string>  $surfaces
     * @param  list<array{type: string, id: string, version: int, tooth: int, surface: ?string, condition: string}>  $citations
     */
    public function __construct(
        public readonly Rule $rule,
        public readonly int $tooth,
        public readonly array $surfaces,
        public readonly string $condition,
        public readonly array $citations,
        public readonly int $approvals = 0, // how often this dentist approved this rule before: ordering signal only
    ) {}

    /** Dedupe key inside one visit: one suggestion per tooth + rule, whatever version or findings. */
    public function key(): string
    {
        return $this->tooth.'|'.$this->rule->key;
    }

    public function payload(string $visitId, string $patientId, string $procedureName): array
    {
        return [
            'visit_id' => $visitId, 'patient_id' => $patientId, 'key' => $this->key(),
            'rule' => ['id' => $this->rule->id, 'key' => $this->rule->key, 'version' => $this->rule->version, 'priority' => $this->rule->priority],
            'tooth' => $this->tooth, 'surfaces' => $this->surfaces, 'condition' => $this->condition,
            'procedure_code' => $this->rule->procedureCode, 'procedure_name' => $procedureName,
            'citations' => $this->citations, 'signal' => ['approvals' => $this->approvals],
        ];
    }
}
