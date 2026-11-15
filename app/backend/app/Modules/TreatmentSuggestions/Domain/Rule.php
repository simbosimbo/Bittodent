<?php

namespace App\Modules\TreatmentSuggestions\Domain;

// One effective rule version: odontogram condition (optionally limited to some surfaces) -> procedure code from the tariff list.
final class Rule
{
    /** @param list<string>|null $surfaces null = any surface / whole tooth */
    public function __construct(
        public readonly string $id,
        public readonly string $key,
        public readonly int $version,
        public readonly string $condition,
        public readonly ?array $surfaces,
        public readonly string $procedureCode,
        public readonly int $priority,
    ) {}

    /** @param array{condition: string, surface: ?string} $finding */
    public function matches(array $finding): bool
    {
        return $finding['condition'] === $this->condition
            && ($this->surfaces === null || in_array($finding['surface'], $this->surfaces, true));
    }
}
