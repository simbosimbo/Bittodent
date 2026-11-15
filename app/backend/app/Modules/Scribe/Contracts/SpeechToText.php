<?php

namespace App\Modules\Scribe\Contracts;

// Turns a local audio file into a transcript. Implementations must not log audio or text.
// Production default is NotConfiguredSpeechToText: no in-region ASR exists in ap-southeast-3
// (Voxtral is not on the official Bedrock regional matrix for Jakarta; Amazon Transcribe has no
// ap-southeast-3 endpoint). Tests bind FakeSpeechToText. Do not call Bedrock in another region.
interface SpeechToText
{
    public function transcribe(string $absolutePath, string $mime, int $durationSec): Transcript;
}
