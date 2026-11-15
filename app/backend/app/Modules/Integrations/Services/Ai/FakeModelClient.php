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
        $next = array_shift($this->script);
        if ($next instanceof ModelUnavailable) {
            throw $next;
        }
        $text = $next ?? json_encode(['fake' => true, 'input_sha256' => $request->sha256()], JSON_THROW_ON_ERROR);

        // Token counts are a stable function of the text (≈4 chars per token), not a tokenizer.
        return new ModelReply($text, intdiv(strlen($request->system.$request->input), 4) + 1, intdiv(strlen($text), 4) + 1);
    }
}
