<?php

// AI model access (D-009, D-037). Default = fake: no real model may see data until the D-030 gate (real patient data) is passed.
return [
    'driver' => env('AI_DRIVER', 'fake'), // fake | bedrock

    // agent_run.region must be one of these (also a MySQL CHECK). id-lokal = in-process fake or self-hosted in Indonesia.
    'allowed_regions' => ['ap-southeast-3', 'id-lokal'],

    'bedrock' => [
        'region' => env('AI_BEDROCK_REGION', 'ap-southeast-3'),
        'model_id' => env('AI_BEDROCK_MODEL_ID', ''), // in-region model ID only; Geo/Global inference profiles are rejected
    ],
];
