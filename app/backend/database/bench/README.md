# Bench scale seeder (synthetic only)

Never pointed at `ehr_dev` or `ehr_test`. The command refuses to run unless the admin connection database is `ehr_bench`.

```bash
# from app/backend, with .env APP_ENV=local DB_DATABASE=ehr_bench BENCH_ENDPOINTS=true DEV_QUICK_LOGIN=true
php artisan bench:seed --fresh --tenants=1 --patients=10000 --years=10 --chairs=5 --label=A
php artisan bench:seed --append --tenants=20 --patients=2500 --years=1 --chairs=3 --label=B
```

Manifests land in `database/bench/out/manifest-*.json` (gitignored). HTTP and imaging harnesses live in `tools/bench/`.
