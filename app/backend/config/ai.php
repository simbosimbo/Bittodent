<?php

// AI model access (D-009, D-037). Default = fake: no real model may see data until the D-030 gate (real patient data) is passed.
return [
    'driver' => env('AI_DRIVER', 'fake'), // fake | bedrock

    // agent_run.region must be one of these (also a MySQL CHECK). id-lokal = in-process fake or self-hosted in Indonesia.
    'allowed_regions' => ['ap-southeast-3', 'id-lokal'],

    // A0.1: exact Bedrock model IDs allowed in ap-southeast-3 (in-region IDs; docs/ai/arsitektur-ai.md, PR #56).
    // Anything else is refused, including every Geo/Global inference profile and every ARN. Add IDs only by a reviewed change.
    'allowed_model_ids' => [
        'qwen.qwen3-235b-a22b-2507-v1:0', // main text LLM
        'qwen.qwen3-32b-v1:0',            // light text LLM
        'deepseek.v3.2',                  // challenger, evaluation only
        'openai.gpt-oss-120b-1:0',        // challenger, evaluation only
        'amazon.nova-lite-v1:0',          // optional KTP OCR (A4), paid switch only; in-region Jakarta, no Geo/Global
    ],

    // A4 FINAL (Yohanes, 15 Nov 2026 22:07 WIB): paid AI off for every clinic unless clinic_ai_setting.paid_enabled says otherwise.
    'paid_ai' => ['default' => (bool) env('AI_PAID_ENABLED', false)],

    // A4 FINAL: KTP = manual entry + deterministic NIK checks (no Tesseract on Hostinger). nova_lite = paid skeleton.
    'ktp' => [
        'extractor' => env('AI_KTP_EXTRACTOR', 'manual'), // manual | nova_lite
        'model_id' => 'amazon.nova-lite-v1:0',
    ],

    'bedrock' => [
        'region' => env('AI_BEDROCK_REGION', 'ap-southeast-3'),
        'model_id' => env('AI_BEDROCK_MODEL_ID', ''), // must be one of allowed_model_ids
    ],
];
