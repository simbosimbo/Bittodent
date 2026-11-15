<?php

namespace App\Modules\Integrations\Services\Ai;

use App\Modules\Integrations\Contracts\ModelClient;
use App\Modules\Integrations\Contracts\ModelDescriptor;
use App\Modules\Integrations\Contracts\ModelReply;
use App\Modules\Integrations\Contracts\ModelRequest;
use App\Modules\Integrations\Contracts\ModelUnavailable;

// Deterministic stand-in for tests and the fake-data demo. No network. Default reply depends only on the request,
// so the same request always gives the same reply. Tests can queue scripted replies or failures.
final class FakeModelClient implements ModelClient
{
    /** @var list<string|ModelUnavailable> */
    private array $script = [];

    public int $calls = 0;

    public ?ModelRequest $lastRequest = null; // tests: inspect exactly what would have been sent

    public function __construct(private ModelDescriptor $descriptor = new ModelDescriptor('fake', 'fake-deterministik-1', 'id-lokal')) {}

    public function descriptor(): ModelDescriptor
    {
        return $this->descriptor;
    }

    /** Queue the next reply text (e.g. JSON with bad citations) or a failure reason (e.g. 'timeout'). */
    public function willReply(string $text): self
    {
        $this->script[] = $text;

        return $this;
    }

    public function willFail(string $reason): self
    {
        $this->script[] = new ModelUnavailable($reason);

        return $this;
    }

    public function complete(ModelRequest $request): ModelReply
    {
        $this->calls++;
        $this->lastRequest = $request;
        $next = array_shift($this->script);
        if ($next instanceof ModelUnavailable) {
            throw $next;
        }
        $text = $next ?? self::citedSummary($request->input) ?? json_encode(['fake' => true, 'input_sha256' => $request->sha256()], JSON_THROW_ON_ERROR);

        // Token counts are a stable function of the text (≈4 chars per token), not a tokenizer.
        return new ModelReply($text, intdiv(strlen($request->system.$request->input), 4) + 1, intdiv(strlen($text), 4) + 1);
    }

    /**
     * Cited-claims protocol (input {"items": [{ref, type, fields}]}, output {"sections": [{kind, claims: [{text, refs}]}]}):
     * restates note fields verbatim with the right ref, so the fake-data demo shows a working summary. Null for other inputs.
     */
    private static function citedSummary(string $input): ?string
    {
        $in = json_decode($input, true);
        if (! is_array($in) || ! is_array($in['items'] ?? null)) {
            return null;
        }
        $out = ['keluhan' => [], 'diagnosis' => [], 'tindakan' => []];
        foreach ($in['items'] as $item) {
            if (($item['type'] ?? null) !== 'note_version') {
                continue;
            }
            $f = $item['fields'] ?? [];
            $ref = [(string) ($item['ref'] ?? '')];
            if (trim((string) ($f['S'] ?? '')) !== '') {
                $out['keluhan'][] = ['text' => mb_substr('Keluhan: '.$f['S'], 0, 300), 'refs' => $ref];
            }
            foreach (['diagnosis' => 'A', 'tindakan' => 'P'] as $kind => $k) {
                $codes = implode(', ', $f[$k]['codes'] ?? []);
                $text = trim((string) ($f[$k]['text'] ?? ''));
                if ($codes !== '' || $text !== '') {
                    $out[$kind][] = ['text' => mb_substr(ucfirst($kind).': '.trim($text.($codes !== '' ? " ($codes)" : '')), 0, 300), 'refs' => $ref];
                }
            }
        }

        return json_encode(['sections' => array_map(fn ($k) => ['kind' => $k, 'claims' => $out[$k]], array_keys($out))], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
}
