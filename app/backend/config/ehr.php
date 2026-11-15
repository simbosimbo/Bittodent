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
    // MySQL migrations GRANT per-table privileges to the runtime account (App\Shared\Database\MysqlGrants). false = single-account
    // hosting (one DB user that cannot GRANT, e.g. Hostinger staging): grants skipped, triggers still created. Never false with real data.
    'db_app_grants' => (bool) env('DB_APP_GRANTS', true),
    // Host part of the runtime account in those GRANTs ('%' when the app connects from another IP, e.g. Docker/Cloud).
    'db_app_grant_host' => env('DB_APP_GRANT_HOST', '127.0.0.1'),
    // Run `queue:work --stop-when-empty` from the scheduler every minute (hosting without a long-running worker; one cron line).
    // staging:seed credentials for the synthetic accounts (APP_ENV=staging only; never the public dev ones on a public URL).
    'staging_demo_password' => env('STAGING_DEMO_PASSWORD'),
    'staging_demo_totp_secret' => env('STAGING_DEMO_TOTP_SECRET'),
    'queue_via_scheduler' => (bool) env('QUEUE_VIA_SCHEDULER', false),
];
