<?php

namespace App\Modules\IcdSuggestions\Contracts;

use App\Modules\Clinical\Contracts\IcdSystem;

// One dictionary row. code/display/version are copied verbatim from the official SATUSEHAT file (DISPLAY is English;
// there is no official Indonesian title). perluDicek = sample row, not yet checked against a complete official import.
final readonly class IcdEntry
{
    public function __construct(
        public IcdSystem $system,
        public string $code,
        public string $display,
        public string $version,
        public bool $perluDicek = true,
    ) {}

    /** @return array{system: string, code: string, display: string, version: string, perlu_dicek: bool} */
    public function toArray(): array
    {
        return ['system' => $this->system->value, 'code' => $this->code, 'display' => $this->display, 'version' => $this->version, 'perlu_dicek' => $this->perluDicek];
    }
}
