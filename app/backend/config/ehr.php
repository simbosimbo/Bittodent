<?php

// App-layer crypto keys, separate from APP_KEY. shortcut: one key per deployment from env; production needs KMS-wrapped per-tenant keys + rotation.
return [
    'encryption_key' => env('ENCRYPTION_KEY'),
    'blind_index_key' => env('BLIND_INDEX_KEY'),
    // DEV ONLY: POST /dev/quick-login (no TOTP) exists only when APP_ENV=local AND this is true.
    'dev_quick_login' => (bool) env('DEV_QUICK_LOGIN', false),
    // Redirect HTTP -> HTTPS (except /up, /ready) and generate https:// URLs. Default on for staging/production.
    'force_https' => (bool) env('FORCE_HTTPS', in_array(env('APP_ENV'), ['staging', 'production'], true)),
    // Load balancer / reverse proxy in front of the app: "*" (only when the app is unreachable except through it) or a CSV of IPs/CIDRs.
    'trusted_proxies' => env('TRUSTED_PROXIES'),
];
