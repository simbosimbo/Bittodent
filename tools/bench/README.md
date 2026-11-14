# Bench harness (synthetic only)

See `docs/architecture/BENCHMARK.md` and `docs/architecture/IMAGING.md`.

- `CLAIMS.md` — written before the run
- `imaging_bench.py` — synthetic 12/16-bit pano/periapical, lossless codecs, envelope crypto
- `http_load.py` — authenticated HTTP p50/p95/p99 against `ehr_bench`
- `start_php_single.sh` / `start_php_workers.sh` — the 4-worker proxy is a poor man's experiment and failed this run; use a real multi-process server to retest C1/noisy-neighbor
- `out/*.json` — measured results (large images are gitignored)

`php artisan bench:seed` refuses any database other than `ehr_bench`.
