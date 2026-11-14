<?php

// App-layer crypto keys, separate from APP_KEY. shortcut: one key per deployment from env; production needs KMS-wrapped per-tenant keys + rotation.
return [
    'encryption_key' => env('ENCRYPTION_KEY'),
    'blind_index_key' => env('BLIND_INDEX_KEY'),
    // DEV ONLY: POST /dev/quick-login (no TOTP) exists only when APP_ENV=local AND this is true.
    'dev_quick_login' => (bool) env('DEV_QUICK_LOGIN', false),
];
