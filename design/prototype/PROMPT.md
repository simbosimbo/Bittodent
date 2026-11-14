/caveman

Build the Bitto dental EHR clickable prototype as a React + TypeScript + Vite app in this folder. The Vite React-TS scaffold + npm install are already here. Replace the default Vite demo. Do not wipe the folder. Do not start from a blank repo.

WRITE / EDIT only under:
- /workspace/ehr-dental/design/prototype/   (this app)
- /workspace/ehr-dental/design/tokens.json  (design tokens)
- /workspace/ehr-dental/design/screenshots/ (parent captures screenshots; you may ignore)

NEVER write into /workspace/ehr-dental/app (another worker owns it).
NEVER write into /workspace/ehr-dental/design/odontogram/ (another worker owns it).

# Stack
- React + TypeScript + Vite. Plain CSS variables generated from tokens.json, OR Tailwind wired to those tokens. No heavy UI kit (no MUI/Chakra/Ant/HeroUI).
- No backend calls. All data from a mock module (e.g. src/data/mock.ts).
- Components structured to lift into the real app later: screens/ (one per module), components/ (Button, Input, Badge, PinPad, PatientHeader, ActivePatientSelector, ModuleRail, Odontogram, ProcedureList, SoapEditor, Ledger, Waitboard, ...).
- Hash routes for deep-link screenshots (HashRouter or tiny custom hash router). See routes below.
- README.md: ONE command to run: `npm install && npm run dev`. `npm run build` must succeed — run it and fix errors.
- package.json name: bitto-prototype. Title: Bitto.

# Information architecture (Open Dental patterns, NEVER copy its UI)
Modern, clean medical look. Workflow is patient-centric and module-based, like Open Dental's ideas only:

1) Top bar always has "Pasien aktif" selector (search + recent). Once a patient is selected, EVERY module shows that patient. Clearing/changing patient updates all modules. Patient header facts travel with them: name, no. RM, age, ALWAYS-visible allergy chip (or "Tidak ada alergi tercatat" still visible). NIK and phone masked by default with show/hide toggle.

2) Fixed left rail (main module nav), not a loose list of unrelated pages:
   - Jadwal
   - Keluarga / Profil
   - Tagihan (Akun)
   - Rencana Perawatan
   - Charting (odontogram + daftar tindakan; SOAP lives here)
   - Gambar / Rontgen
   - Kelola (pengaturan / laporan)
   "Mode sederhana" toggle hides secondary modules (Gambar/Rontgen and Kelola at minimum) so a solo practice sees a shorter rail.

3) Jadwal: operatory/chair columns, time rows, appointment blocks with quick status colors (terjadwal, check-in, sedang merawat, selesai, batal). Side panel "Papan tunggu" (pinboard): appointments can be dragged in/out between the chair grid and the papan. Also an unscheduled list. Blocked/istirahat time visible and distinct. Click empty slot to book the pasien aktif (or open selector if none).

4) Charting: tooth chart on TOP + procedure list BELOW. Procedure statuses: rencana, selesai, kondisi yang ada. A quick-button panel adds a procedure: it marks the selected tooth/surface on the chart AND flows into Rencana Perawatan and then Tagihan (running ledger). Demonstrate this with one click in the prototype.

5) Tagihan: a running ledger per patient/family (not a one-off checkout page only). Rows: tindakan, pembayaran, klaim asuransi. Still support pay-now (tunai/transfer/kartu/QRIS), partial payment, printable receipt, WhatsApp send.

6) Rencana Perawatan: planned procedures for the pasien aktif, sourced from charting additions, with status and a path "kirim ke tagihan" if not auto-flowed yet.

7) Keluarga/Profil: identity, family members, consent, registration fields, search/create patient. New registration can set the new person as pasien aktif.

8) Gambar/Rontgen and Kelola: real-looking but lighter prototype screens (placeholder images/list + simple settings/reports). Not empty dead links.

The "Alur kunjungan pertama" is a visible stepper that MOVES BETWEEN THESE MODULES for the same patient (not a parallel fake wizard):
registrasi (Keluarga/Profil) -> jadwal (book chair) -> pemeriksaan + odontogram (Charting) -> tanda tangan SOAP (Charting) -> bayar (Tagihan).

# Hash routes
#/login #/login/totp #/login/recovery #/pin
#/jadwal #/keluarga #/keluarga/baru #/tagihan #/rencana #/charting #/charting/soap #/gambar #/kelola #/desain #/alur
Optional: #/pasien/RM-000123 as alias that selects that patient and opens #/keluarga
Query flags: ?offline=1&mode=sederhana&soap=signed|draft&pinTries=3

# Design tokens
Write /workspace/ehr-dental/design/tokens.json with color, type, spacing, radius, shadow. Fresh medical palette (teal or medical blue primary), clean neutrals, semantic statuses. App consumes them via CSS variables (generate src/styles/tokens.css from the JSON and keep in sync). #/desain shows hex, type scale, spacing, buttons, inputs, table, badges.

Font: Inter or similar (one CSS import) or system-ui. Body >=14px desktop, >=16px tablet. Touch targets >=44px. WCAG AA. Responsive 1440 desktop and 1024/768 tablet (rail may collapse/icon-only on tablet, but stay usable).

Badges: "Draf AI, perlu persetujuan dokter" (draft/warning, NEVER looks final), "Terkunci", "Offline", "Belum sinkron", "Menunggu klaim", "QRIS — perlu konfirmasi Jerome".

Top bar also: Bitto brand, branch switcher (Menteng active / Kelapa Gading), "Mode sederhana" toggle, "Mode offline" preview toggle.
Offline banner: "Mode offline" + badge "Belum sinkron". Banner contains NO patient data.

# Copy and data
All UI copy in Indonesian. English only for Bitto, QRIS, SOAP, PIN, NIK, FDI, TOTP.
Fake Indonesian data only. Patients: Siti Rahmawati RM-000123 (38 th, alergi penisilin, kunjungan hari ini), Ahmad Fauzi RM-000089, Dewi Kusuma RM-000156. Staff: drg. Budi Santoso, resepsionis Ayu Lestari. Clinic: Bitto Dental Menteng (active), Bitto Dental Kelapa Gading (switcher). Today: Sabtu, 14 November 2026, times labeled WIB.
NIK must be obviously fake, e.g. NIK-CONTOH-0001 or 0000 0000 0000 0001. Masked by default. Phone masked by default (0812••••6789).

# Auth screens (no patient data)
1) Login #/login — email + password, then 6-digit authenticator TOTP (#/login/totp). TOTP only. No "trust this device", no WhatsApp/email OTP, no remember me. One-time recovery-codes at setup (#/login/recovery). Fake login: any non-empty email/password then any 6-digit code proceeds (after recovery confirm).

2) PIN lock #/pin — 6-digit pad for registered offline branch devices. Warning: "5x salah = data lokal di perangkat dihapus". Stronger warning near last tries. NO patient data on this screen. After 5 failures, show wipe state (prototype only).

# Registration (Keluarga/Profil #/keluarga/baru)
no. RM (suggest RM-000124), nama, NIK (fake format), tgl lahir, HP, alamat, short data sosial, required checkbox "Saya menyetujui pemrosesan data sesuai UU PDP". Submit disabled until consent checked. Sets pasien aktif and continues the first-visit flow to Jadwal.

# Charting details (odontogram + procedures + SOAP)
- Before building, CHECK if /workspace/ehr-dental/design/odontogram/ exists and has README.md + legend.json. If yes, use legend.json and the surface ID scheme from that README (do not modify that folder; import/copy into src as needed). If not, build your own component using the SAME id scheme so it can be swapped later: ids like t16-O (tooth FDI + surface), data-state="draft|signed", data-condition="<condition key>".
- FDI numbering. Permanent 18–11, 21–28, 48–41, 31–38. Primary 55–51, 61–65, 85–81, 71–75.
- 5 surfaces: M mesial, D distal, O/I occlusal (posterior) or incisal (anterior), B bukal/fasial, L lingual/palatal.
- Tap a tooth, then set condition per surface in a panel (not hover-only). Selected tooth highlighted.
- OUR OWN legend, labelled "Legenda internal". Do NOT present as official Kemenkes/PDGI/SATUSEHAT. Conditions: sehat, karies, tambalan, mahkota, hilang, akar tertinggal / sisa akar, perlu dicabut, implan.
- Each condition = color PLUS a distinct shape/pattern/glyph. Never color only.
- Legend is one swappable config object (or imported legend.json).
- History compare: visit selector and/or side-by-side "Kunjungan sebelumnya vs sekarang" with changes highlighted.
- Draft vs signed findings: AI/draft badge "Draf AI, perlu persetujuan dokter"; signed = "Terkunci" + signer + time. Prior visit locked, current visit draft until SOAP is signed.
- SOAP in Charting (#/charting/soap): S, O, A, P. Every AI-drafted block has distinct draft background/border + badge "Draf AI, perlu persetujuan dokter". AI content must NEVER look final. "Setujui & tanda tangani" opens a deliberate confirm modal (signer drg. Budi Santoso; note will lock). After sign: locked, "Terkunci", signer + time, read-only. "Buat versi baru" requires a mandatory reason; previous signed version stays in history. Guided exam step starts in draft.

# Tagihan / payment
Ledger lines for procedures + amounts in Rupiah, payments, and insurance claims. No diagnosis on the ledger or receipt.
Methods: Tunai, Transfer, Kartu debit/kredit, QRIS tagged "perlu konfirmasi Jerome". Partial payment (sisa visible). Private insurance split: one insurer (Prudential), insurer portion + patient portion, status "menunggu klaim".
"Cetak kwitansi" (printable view) and "Kirim via WhatsApp". Receipt: procedures and amounts only.
Offline: only Tunai enabled; other methods and WhatsApp greyed with a short reason.

# Visual inspiration
Clean, simple, fresh medical look. Zendenta (Fikri Studio) as feel only — NEVER copy screens, assets, icons, or text. Open Dental as workflow/nav patterns only — NEVER copy its UI, icons, or layout pixel-for-pixel.
If /workspace/ehr-dental/design/research/mobbin-patterns.md exists when you start, read it and apply takeaways as patterns only (never copy screens). If it does not exist yet, proceed without it (a later polish pass will apply it). In the summary, list which Mobbin takeaways you applied (or say "file not present"). Do not wait for 21st.dev.

# Docs
Requirements above are enough. Optional peeks only: decisions.md D-021, D-026/D-028, D-007. Do not read architecture.md or database.md.

# Done
Run `npm run build` and fix until it passes.
Use caveman mode. Do not dump source in the chat.
Print a SHORT summary only: how to run, token palette hex + font, hash routes, how patient-centric nav and procedure-to-plan-to-ledger flow work, odontogram source used (own vs design/odontogram), Mobbin takeaways applied, known gaps, and a short list of open questions for Jerome / the architect. No source code in the summary.
