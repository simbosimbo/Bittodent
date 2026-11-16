<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // SATUSEHAT (Kemenkes) OAuth2 client_credentials. Kosong di repo; isi lewat .env. Satu client_id = satu Organization ID.
    'satusehat' => [
        'env' => env('SATUSEHAT_ENV', 'sandbox'), // sandbox | production
        'client_id' => env('SATUSEHAT_CLIENT_ID'),
        'client_secret' => env('SATUSEHAT_CLIENT_SECRET'),
        'org_id' => env('SATUSEHAT_ORG_ID'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
