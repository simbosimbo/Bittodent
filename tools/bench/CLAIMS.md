# Pre-run claims (written before measurements, 14 Nov 2026, Asia/Jakarta)

These are claims, not results. Numbers below are hypotheses. Do not treat them as measured.

## What we are trying to decide

1. At 1 tenant / 10,000 patients / 10 years of synthetic history on this box, do the current MySQL endpoints meet or miss the `docs/database.md` §7.2 targets (Q4 name search < 50 ms DB, Q5 NIK/phone exact, Q6 open record < 60 ms DB / < 300 ms screen, Q7 current odontogram < 20 ms DB, Q13 entity audit < 100 ms for a recent window)?
2. Is the limiter the PHP built-in server (`php artisan serve` / `php -S`, single-request), the unpartitioned `audit_event` table, `PatientSearch` LIKE, chart loading+decrypting every SOAP version, or something else? Name the limiter from counters, not from a guess.
3. For radiographs: which lossless codec (JPEG-XL lossless, JPEG 2000 lossless, PNG, raw+zstd) has the best size × encode-time tradeoff on synthetic 12/16-bit panoramic (2900×1400) and periapical (1500×1000) images, and what does compress-then-encrypt (AES-256-GCM envelope) add to size and to upload+view latency?

A single run is a ballpark. We still count errors and confirm the work happened inside the timer (rows returned, ciphertext round-trips, hashes match). Comparing codecs or "before/after" index changes uses ≥5 timed runs after warmup, reporting p50 and the range, plus the limiter.

## Claims (to be accepted or rejected by the run)

C1. With `php artisan serve` (one request at a time) and MySQL 8.4 `innodb_buffer_pool_size=2G`, concurrency 10 and 50 on the same port will inflate p95/p99 because the server queues, not because the queries themselves got slower. A small multi-process `php -S` front (several workers, still not production) should drop that queueing; leftover p95 is the app+DB.

C2. `GET /api/patients?q=sari` (name prefix / mid-word `LIKE '% sari%'`) at 10,000 patients will miss the Q4 50 ms DB target at p95 even at concurrency 1, because the second LIKE cannot use the `(tenant_id, name_normalized(64))` prefix index for every row.

C3. `GET /api/patients?q=<16-digit NIK>` and phone search will be well under 50 ms at concurrency 1 (blind index equality + unique/index on `(tenant_id, nik_bidx)` / `phone_bidx`).

C4. `GET /api/patients/{id}/chart` for a typical ~12-visit patient will spend most of its time decrypting every historical SOAP version in PHP (chart returns `soap` for all versions) plus writing an `audit_event` row; the DB part of "current odontogram" is not isolated. A worst-case heavier patient will miss the Q6 300 ms screen target and will not meet Q7 as specified (Q7 is a DISTINCT ON current-surface query, which this endpoint does in PHP after loading all findings).

C5. `GET /api/schedule?date=today` will be fast at concurrency 1 (one branch, a day's appointments, constant query count) and is not the scale limiter.

C6. An entity audit query over 4 million unpartitioned `audit_event` rows, even with `(tenant_id, entity_type, entity_id, occurred_at)`, will be close to or slower than the Q13 100 ms target once the working set is not all in the buffer pool; a tenant-wide recent-window scan will be worse. This is the likely DB-size limiter at 10k patients (A5 radiographs are only ~100 files/clinic/year).

C7. Multi-tenant isolation: a name or NIK search authenticated as tenant A will return zero rows from tenant B, including when the same synthetic NIK digits are reused across tenants.

C8. JPEG-XL lossless will beat PNG and be close to or better than JPEG 2000 lossless on ratio for these 16-bit grayscale synthetic radiographs, with encode time under 1 s for a 2900×1400 frame on this box. Raw+zstd will be fast to encode but a worse ratio than the image codecs. Envelope AES-256-GCM (compress-then-encrypt, per-file DEK wrapped by a per-tenant KEK stand-in) will add a small constant (header + tag + wrapped DEK), not a percentage, and decrypt+stream of a panoramic original will be dominated by decode, not GCM, at this size.

## What would change a decision

- If C2 or C4 or C6 is confirmed, the ranked fixes in BENCHMARK.md should start with search/index or chart pagination/decrypt, or audit partitioning — not object storage (D-047 is optional after the A5 revision).
- If C8 picks a clear lossless winner, IMAGING.md should name that codec for diagnostic originals, with lossy used only for separate UI thumbnails.
- php -S numbers must not be used to choose a production application server (FrankenPHP/Octane/FPM not in this run unless a binary is quick to add). They may be used to decide that the built-in server is unusable for a 10k-patient demo.

## Method notes (locked before the run)

- Data: synthetic only, database `ehr_bench` (not `ehr_dev` / `ehr_test`). Images are generated and labeled SYNTHETIC.
- Scenario A target: 1 tenant, 10,000 patients, 10 years, ~1.2 visits/patient/year, ~1.3 note versions/visit, ~8 findings/visit, ~30 audit rows/visit + 5/patient/year (~4M audit rows).
- Scenario B: 20–50 tenants × 5,000 patients, scaled down if disk/RAM require it, and the scale-down will be stated.
- HTTP: warmup, then multiple runs, concurrency 1/10/50, p50/p95/p99, error counts, query counts (`X-Bench-Query-Count`), confirmation that responses contain the expected rows.
- Imaging: ≥5 timed runs after warmup for codec compare; hash of decompressed pixels must match the source; ciphertext must fail to decrypt if a bit is flipped.
