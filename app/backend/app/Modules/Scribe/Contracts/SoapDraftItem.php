<?php

namespace App\Modules\Scribe\Contracts;

final readonly class SoapDraftItem
{
    /** @param list<string> $refs transcript segment ids (T1..) */
    public function __construct(
        public string $section, // S | O | A | P
        public string $text,
        public array $refs,
    ) {}

    /** @return array{text: string, refs: list<string>, section: string} */
    public function toClaim(): array
    {
        return ['text' => $this->text, 'refs' => $this->refs, 'section' => $this->section];
    }
}
