<?php

namespace Tests\Modules\Agents;

use App\Shared\Ai\CitationValidator;
use PHPUnit\Framework\TestCase;

// Pure unit test (no DB). Synthetic text only.
class CitationValidatorTest extends TestCase
{
    private const SOURCES = ['N1' => 'note_version', 'N2' => 'note_version', 'F1' => 'finding', 'M1' => 'medical_history'];

    public function test_keeps_only_claims_whose_every_ref_is_in_the_input(): void
    {
        $r = CitationValidator::validate([
            ['text' => 'Keluhan ngilu gigi 36 (contoh sintetis).', 'refs' => ['N1']],
            ['text' => 'Tanpa sitasi.', 'refs' => []],
            ['text' => 'Sitasi hilang.'],
            ['text' => 'Sumber karangan.', 'refs' => ['N9']],
            ['text' => 'Sebagian karangan.', 'refs' => ['N1', 'X7']],
            ['text' => 'Dua sumber sah.', 'refs' => ['N1', 'F1', 'N1']],
            ['text' => '   ', 'refs' => ['N1']],
            'bukan objek',
            ['text' => 'Ref bukan string.', 'refs' => [1]],
        ], self::SOURCES);

        $this->assertSame(['Keluhan ngilu gigi 36 (contoh sintetis).', 'Dua sumber sah.'], array_column($r->kept, 'text'));
        $this->assertSame(['N1', 'F1'], $r->kept[1]['refs']);
        $this->assertSame([
            ['index' => 1, 'reason' => 'citation_missing'], ['index' => 2, 'reason' => 'citation_missing'],
            ['index' => 3, 'reason' => 'citation_unknown'], ['index' => 4, 'reason' => 'citation_unknown'],
            ['index' => 6, 'reason' => 'malformed'], ['index' => 7, 'reason' => 'malformed'], ['index' => 8, 'reason' => 'citation_unknown'],
        ], $r->dropped);
        $this->assertEqualsWithDelta(7 / 9, $r->droppedRatio(), 1e-9);
    }

    public function test_section_may_only_cite_allowed_source_types(): void
    {
        $r = CitationValidator::validate([
            ['section' => 'diagnosis', 'text' => 'Dari catatan.', 'refs' => ['N2']],
            ['section' => 'diagnosis', 'text' => 'Dari riwayat medis.', 'refs' => ['M1']],
            ['section' => 'alergi', 'text' => 'Tidak dibatasi.', 'refs' => ['M1']],
        ], self::SOURCES, ['diagnosis' => ['note_version', 'finding']]);

        $this->assertSame(['Dari catatan.', 'Tidak dibatasi.'], array_column($r->kept, 'text'));
        $this->assertSame([['index' => 1, 'reason' => 'citation_wrong_type']], $r->dropped);
    }

    public function test_empty_input_is_not_an_error(): void
    {
        $r = CitationValidator::validate([], self::SOURCES);
        $this->assertSame([], $r->kept);
        $this->assertSame(0.0, $r->droppedRatio());
    }
}
