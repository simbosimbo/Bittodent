<?php

namespace App\Modules\Ktp\Services;

use App\Modules\Agents\Contracts\AgentCall;
use App\Modules\Agents\Contracts\AgentDrafts;
use App\Modules\Agents\Contracts\AgentKind;
use App\Modules\Agents\Contracts\AgentRuns;
use App\Modules\Agents\Contracts\DraftKind;
use App\Modules\Integrations\Contracts\ModelRequest;
use App\Modules\Ktp\Contracts\ClinicAiSettings;
use App\Modules\Ktp\Contracts\KtpExtraction;
use App\Modules\Ktp\Contracts\KtpExtractor;
use App\Modules\Ktp\Contracts\KtpInput;
use App\Modules\Ktp\Contracts\KtpPhoto;
use App\Modules\Ktp\Contracts\NikValidator;
use App\Modules\Ktp\Contracts\PaidAiDisabled;

// SKELETON (paid, optional): KTP photo -> proposed fields via Nova Lite in ap-southeast-3, only through AgentRuns::call.
// Refuses before touching the photo when the clinic's paid switch is off. Output = agent_draft `pendaftaran` until a
// receptionist saves the patient / PUT .../ktp.
final class BedrockNovaLiteKtpExtractor implements KtpExtractor
{
    public const PROMPT_VERSION = 'ktp-nova-lite-v1';

    private const FIELDS = ['nik', 'name', 'dob', 'sex', 'province_code', 'regency_code', 'district_code'];

    public function __construct(private ClinicAiSettings $settings, private AgentRuns $runs, private AgentDrafts $drafts,
        private NikValidator $validator) {}

    public function extract(KtpInput $input, ?KtpPhoto $photo = null): KtpExtraction
    {
        if (! $this->settings->paidAiEnabled()) {
            throw new PaidAiDisabled;
        }
        if ($photo === null) {
            return (new ManualKtpExtractor($this->validator))->extract($input);
        }
        // shortcut: image bytes are not attached yet (BedrockJakartaModelClient::complete is not_configured); attach them
        // as an image block when the Bedrock client is wired. The typed NIK is never part of the request.
        $request = new ModelRequest(
            'Baca KTP pada gambar. Balas JSON saja dengan kunci: '.implode(', ', self::FIELDS).'. Kosongkan yang tidak terbaca.',
            json_encode(['image' => ['photo_id' => $photo->id, 'mime' => $photo->mime]], JSON_THROW_ON_ERROR),
            maxOutputTokens: 300,
        );
        $result = $this->runs->call(new AgentCall(AgentKind::Pendaftaran, self::PROMPT_VERSION, $request,
            [['type' => 'ktp_photo', 'id' => $photo->id]], $photo->patientId), fn ($reply) => self::parse($reply->text) !== null);
        if (! $result->ok()) {
            return new KtpExtraction($input, $this->validator->check($input), 'nova_lite', runId: $result->runId);
        }
        $fields = self::parse($result->reply->text);
        $proposed = new KtpInput($fields['nik'], $fields['name'], $fields['dob'], $fields['sex'], $fields['province_code'],
            $fields['regency_code'], $fields['district_code'], $photo->id);
        $draftId = $this->drafts->propose($result->runId, DraftKind::Pendaftaran, 'patient', $photo->patientId, $fields);

        return new KtpExtraction($proposed, $this->validator->check($proposed), 'nova_lite', $draftId, $result->runId);
    }

    /** @return array<string, ?string>|null every FIELDS key, strings or null; null when the reply is not a JSON object */
    private static function parse(string $text): ?array
    {
        $j = json_decode($text, true);
        if (! is_array($j) || array_is_list($j)) {
            return null;
        }

        return array_combine(self::FIELDS, array_map(fn ($k) => is_scalar($j[$k] ?? null) && (string) $j[$k] !== '' ? (string) $j[$k] : null, self::FIELDS));
    }
}
