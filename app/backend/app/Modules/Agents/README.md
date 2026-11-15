# Modul Agents

Fondasi AI (unit A0). Pemilik tabel `agent_run` dan `agent_draft` (docs/database.md 3.9).

- `Contracts\AgentRuns::call()` — satu-satunya jalan memanggil model. Setiap panggilan menulis satu baris `agent_run` (dibuat **sebelum** panggilan, diisi selesai **sekali**) dan satu `audit_event` `ai_panggil`, untuk berhasil maupun gagal. Yang disimpan hanya hash SHA-256 input/output, token, latensi, model, versi prompt, dan referensi ID. **Tidak ada** prompt, jawaban model, atau teks klinis.
- `Contracts\AgentDrafts` — keluaran agen menunggu tinjauan dokter (D-001). Satu baris = satu item. `menunggu_review` → `disetujui` / `ditolak` / `digantikan` (`kedaluwarsa` khusus ringkasan). Hanya izin `ai_draft.review` (dokter gigi) yang boleh menyetujui/menolak. Jenis `ringkasan` tidak pernah bisa disetujui. Menyetujui **tidak** menulis catatan klinis; modul pemilik catatan yang membuat versi draf lalu dokter menandatangani (D-041).
- Model diakses lewat `Integrations\Contracts\ModelClient` (Fake untuk tes/demo, Bedrock Jakarta in-region). Validator sitasi generik: `App\Shared\Ai\CitationValidator`.

Sambungan: `Agents → Integrations` (config/modules.php). Modul fitur nanti memakai `Agents\Contracts` saja.
