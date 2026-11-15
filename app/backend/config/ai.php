<?php

// AI model access (D-009, D-037, D-048). Default = fake: no real model may see data until the D-030 gate is passed.
return [
    'driver' => env('AI_DRIVER', 'fake'), // fake | bedrock

    // agent_run.region must be one of these (also a MySQL CHECK). id-lokal = in-process fake or self-hosted in Indonesia.
    'allowed_regions' => ['ap-southeast-3', 'id-lokal'],

    // A0.1: exact Bedrock model IDs allowed in ap-southeast-3 (in-region IDs; docs/ai/arsitektur-ai.md, PR #56).
    // Anything else is refused, including every Geo/Global inference profile and every ARN. Add IDs only by a reviewed change.
    // Do not add Voxtral: it is not in-region in ap-southeast-3 (official regional matrix, 15 Nov 2026).
    'allowed_model_ids' => [
        'qwen.qwen3-235b-a22b-2507-v1:0', // main text LLM
        'qwen.qwen3-32b-v1:0',            // light text LLM (scribe SOAP default)
        'deepseek.v3.2',                  // challenger, evaluation only
        'openai.gpt-oss-120b-1:0',        // challenger, evaluation only
    ],

    // Global kill switch (default off). Scribe requires this AND clinic_ai_setting.paid_enabled.
    'paid_ai' => [
        'default' => (bool) env('AI_PAID_ENABLED', false),
        'monthly_token_cap' => (int) env('AI_MONTHLY_TOKEN_CAP', 200000),
    ],

    'scribe' => [
        'soap_model_id' => 'qwen.qwen3-32b-v1:0',
        'max_bytes' => 25 * 1024 * 1024,
        'max_duration_sec' => 15 * 60,
        'audio_mimes' => ['audio/webm', 'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/webm;codecs=opus'],
    ],

    'bedrock' => [
        'region' => env('AI_BEDROCK_REGION', 'ap-southeast-3'),
        'model_id' => env('AI_BEDROCK_MODEL_ID', ''), // must be one of allowed_model_ids
    ],
];
