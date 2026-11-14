# Bitto — Mobbin UI pattern notes

Patterns only (layout, hierarchy, behaviour, states). Do not copy screens, assets, or brand. Fake Indonesian data only in the prototype.

Private collection: [Bitto - referensi UI](https://mobbin.com/collections/25bf03e9-f59b-4305-800f-9c612276bd9c/mobile/screens) (visible to Jerome and teammates). Researched 14 Nov 2026 (WIB) for the desktop + tablet prototype in `design/prototype/`.

---

## 1. Appointment calendar by chair / waitlist

- **Fresha** — [staff day calendar](https://mobbin.com/screens/f8925220-1238-43a1-ac64-1b45d649ee86): resource columns, Waitlist in the toolbar, location switcher.
- **Fresha** — [add-appointment rail](https://mobbin.com/screens/f57f35c4-b94c-4965-aa8b-7da79429fa00): now-line, walk-in option, searchable service list.
- **Wix** — [booking calendar](https://mobbin.com/screens/710a5c70-57fb-4177-ad6f-5a1a2e14c397): staff columns, left month calendar, Service / Staff / Location filters.
- **Fresha** — [Upcoming vs Waitlist](https://mobbin.com/screens/f0e0bac9-e382-46c7-b193-87b616d15c49): two stacks with count badges (customer-facing; adapt as a staff side panel).

Takeaways:

1. Build the day view as one column per kursi (or dokter), with a compact time gutter, a red “now” line, and dense blocks showing time + patient name + prosedur.
2. Put date prev/next, “Hari ini”, Day/Week, cabang, and a Waitlist control in one sticky toolbar above the grid — not buried in a menu.
3. Open a right rail to create an appointment: search or “tambah walk-in”, then pick a service from a grouped, searchable list with duration and price.
4. Keep a waitlist as a side list (name, requested slot, count badge), not a separate page. Mobbin has no strong staff waitlist board — do not invent a Kanban.
5. Filter by layanan, staf, and lokasi so a multi-chair clinic can hide unused columns.

## 2. Patient search + multi-step registration

- **Contractbook** — [search modal](https://mobbin.com/screens/3f1e8ca8-cb28-4f3c-9b7d-1dc28e97ab71)
- **Mercury** — [left stepper form](https://mobbin.com/screens/bdc369b8-aa88-4826-8c21-c52a19c5fa50)
- **Deel** — [search list + right steps](https://mobbin.com/screens/292409fc-d1cd-4fa3-ac29-d2d6f712f4f5)
- **Gusto** — [horizontal steps + table](https://mobbin.com/screens/a0d75b9d-384f-4830-8178-3e76e17fa545)

Takeaways:

1. Search before creating: “cari berdasarkan” radios (nama / NIK / telepon), a result count, and rows with name + masked secondary ID + address. “Pasien baru” appears after zero or weak matches, not as the default.
2. Registration is stepped (Identitas → Kontak → Asuransi/penjamin → Konfirmasi). Show n/total, checkmarks on completed steps, and a sticky footer with Batal / Simpan draf / Lanjut — never one long required-field scroll.
3. On tablet, keep the step list visible (left or right). On desktop a horizontal numbered bar with a progress underline also works.
4. “Tambah baris” (extra phone, penjamin) is an in-form row action, not a new page.

## 3. Dashboard, sidebar, branch switcher

- **Fibery** — [workspace switcher](https://mobbin.com/screens/e470f040-82a2-44ec-8954-c70e56ce695b)
- **Toggl Track** — [org switcher](https://mobbin.com/screens/854d7329-a1f2-4196-88c2-718688ea73f0)
- **Plane** — [icon rail + expanded nav](https://mobbin.com/screens/ad54112b-2f34-41e7-8c99-e386df93d5a2)

Takeaways:

1. Put the current cabang name at the top of the sidebar. Opening it lists other branches, marks the current one “Utama”, and offers “Kelola cabang”. Solo-practice mode hides the switcher and shows a single clinic name.
2. Use a compact icon rail that expands to labelled items (Kalender, Pasien, Kasir, …). Active item is filled; collapse on tablet to recover width for the chair grid.
3. User identity (name, role) lives at the top or bottom of the nav, never mixed into patient records.
4. The dashboard is secondary: a few KPI cards and a table, not a widget wall. Daily work starts on the calendar.

## 4. Record / detail: sticky header + alert chips

- **Heidi** — [patient note with review footer](https://mobbin.com/screens/cd52355e-48d4-48d0-884d-4173ee9a308f): name, condition chips, sticky review cue.
- **Shopify** — [customer profile](https://mobbin.com/screens/bdacd18e-3af1-43fb-964e-d59299a27ce6)
- **Customer.io** — [profile + top banner](https://mobbin.com/screens/98aef2de-372a-4571-84fc-3635864db07d)
- **Klaviyo** — [consent chips](https://mobbin.com/screens/7a9377d8-6bc4-4746-bcde-a55418e9f376)

Takeaways:

1. Keep a sticky patient header: initials, name, date of birth/age, and alert chips that never scroll away. Alergi is always visible (high-contrast chip, colour + label). Mask NIK and phone by default; reveal on a deliberate click.
2. Status chips (asuransi, kunjungan, draf AI) sit next to the name — short, colour + text, like “Payment pending” or “Subscribed”.
3. A slim full-width warning banner can sit above the header for clinic-level alerts; keep it out of the patient identity block.
4. Use tabs under the header (Ringkasan, Odontogram, SOAP, Pembayaran, Berkas), a right rail for kontak / riwayat singkat, and a visit timeline below.

## 5. AI draft vs approved

- **Heidi** — [review-before-use modal](https://mobbin.com/screens/f85a7441-fa22-4f03-9b2c-69b6ff534a4d)
- **Attio** — [review-and-edit draft](https://mobbin.com/screens/f56c62bf-1ca6-4fa5-bd1d-f9f0baf7cc52)
- **Square** — [write a first draft before AI](https://mobbin.com/screens/8d25364c-a526-4014-8b57-a642262c8d61)
- **Klaviyo** — [Draft vs Published](https://mobbin.com/screens/cd19443d-d489-439d-8e93-a80ed79243a7)

Takeaways:

1. Label every AI SOAP “Draf AI, perlu persetujuan dokter”. Style it as a draft card (dashed or tinted, watermark), never as a signed clinical note.
2. Keep a persistent footer: “Tinjau catatan ini sebelum dipakai — harus mencerminkan kunjungan.” Approve is a separate primary button, not auto-save.
3. Approving opens a confirm modal (“ini hanya panduan, dokter wajib meninjau”) with “Saya sudah meninjau / Setujui dan kunci”. After sign, the note is locked; a correction starts a new version with a required reason.
4. Keep “Simpan draf” and “Setujui” as two different actions. Copy should say the dokter stays in control and AI can be wrong.

## 6. Checkout, split pay, receipt

- **Sweatpals** — [POS checkout](https://mobbin.com/screens/08d0ffb9-2107-43d7-b564-e956086a9ec3)
- **GetYourGuide** — [payment methods](https://mobbin.com/screens/344b84fb-4aa5-45c6-9d32-38fa6f94a1aa)
- **Upwork** — [disabled methods with reason](https://mobbin.com/screens/d31a10ec-6fde-48fd-b0ae-75456a051801)
- **H&M** — [receipt](https://mobbin.com/screens/d3061f92-d7ab-42be-a5e7-079281366d55)

Also: [Square payment](https://mobbin.com/screens/e89ef674-df07-4351-901a-7ca09689a46e) greys methods behind a warning; Fresha appointment detail (area 1) shows deposit vs “left to pay”.

Takeaways:

1. Cashier layout: left = method cards (Tunai, Transfer, Kartu, QRIS marked “perlu konfirmasi”); right = line items, pajak, total, and a sticky “Konfirmasi pembayaran”. Attach the patient as a chip, not a hidden field.
2. Reveal method-specific fields only after a method is selected (card form appears under Kartu).
3. When a method is unavailable (offline, reader disconnected), keep the card visible but disabled, with a short reason — do not hide it. Offline: only Tunai stays enabled.
4. Split / partial pay is not clearly shown in Mobbin. Adapt: amount due, a “Bayar sebagian” field, one insurer row with status “menunggu klaim”, and a remaining “sisa di kasir” line.
5. Receipt: items, amounts, method, sisa, invoice ref. Buttons: Cetak and Kirim via WhatsApp. No diagnosis. A QR or receipt-id is enough.

## 7. 2FA, recovery codes, PIN lock

- **Klaviyo** — [authenticator code](https://mobbin.com/screens/37801d88-21fa-4125-b943-468767e7e11e)
- **Customer.io** — [recovery codes](https://mobbin.com/screens/adb4bd53-6f53-48fc-9255-eed744f48fae)
- **Starling** — [6-digit passcode](https://mobbin.com/screens/021f5482-3c8f-4a6a-ab72-fb5e4fc16d96) (iOS; adapt to tablet web)
- **Jomo** — [unlock passcode](https://mobbin.com/screens/408e49a0-b167-47a1-af1a-f8b69b399a24) (iOS)

Takeaways:

1. TOTP screen: centred card, “Masukkan kode dari aplikasi autentikator”, one 6-digit field, Masuk, plus “Gunakan kode pemulihan” and “Pemulihan akun”. No “percayai perangkat ini”, no WhatsApp/email OTP.
2. Show recovery codes once at setup: a warning that they must be stored safely, 8–10 codes in two columns, Download / Cetak / Salin, then Lanjut. One-time use.
3. PIN lock (registered offline devices only): 6 empty slots + numeric pad (≥44px targets), title like “Masukkan PIN perangkat”. No patient names, no schedule, no clinic census. Hint: jangan pakai tanggal lahir atau PIN kartu.
4. After failed attempts, show remaining tries and a clear warning before the last tries (5 wrong wipes local data). Do not add “ingat saya”.

## 8. Offline / sync banners

Mobbin web is thin on true “you are offline” chrome. Adapt from these:

- **Customer.io** — [full-width top banner](https://mobbin.com/screens/98aef2de-372a-4571-84fc-3635864db07d)
- **Klaviyo** — [connection toast](https://mobbin.com/screens/edd5d1e3-a036-4831-afd6-0f31beff2e9b)
- **Sweatpals** — [Disconnected on a method](https://mobbin.com/screens/08d0ffb9-2107-43d7-b564-e956086a9ec3)
- **Square** — [warning that limits methods](https://mobbin.com/screens/e89ef674-df07-4351-901a-7ca09689a46e)

Takeaways:

1. Use a slim full-width bar under the app chrome: “Offline — hanya tunai” or “Belum sinkron (n antrean)”. No patient names or identifiers in the bar.
2. A dismissible centred pill works for success (“Tersambung — sinkron selesai”), not for Offline (Offline stays until the network returns).
3. Repeat the constraint on the affected control (grey non-cash methods with the same reason) so the banner is not the only cue.
4. Distinguish Offline (no network) from Belum sinkron (queued local writes) with different colour + label, both meeting contrast AA.

## 9. E-signature / consent on tablet

- **WeTransfer Sign** — [document + fields](https://mobbin.com/screens/405640dd-36a7-4305-852d-e02bc7f4d63c)
- **Square** — [typed name + drawn signature](https://mobbin.com/screens/a68a2387-4575-4650-b2d0-14a850560ce2)
- **Docusign** — [required signature field](https://mobbin.com/screens/fdffced9-b8d1-4f9b-b869-8beb4ea07bb8)

Takeaways:

1. Present consent as a document canvas with large, tappable fields (Tanda tangan, Tanggal, Nama). Show remaining required fields and a Selesai control; do not ask the patient to hunt for a tiny line.
2. Capture both a typed legal name and a drawn signature (finger/stylus), plus date, on one step. Include a short legal line that the e-sign counts as the original, and a confirm before lock.
3. Offer “Simpan draf” vs “Selesai” as separate actions. Required fields are flagged; the primary button stays disabled until they are filled.
4. On tablet, give the canvas most of the screen, keep chrome thin, and use ≥44px hit targets. After sign, the document is locked like a signed SOAP.

---

## Gaps to invent, not copy

- No strong staff-side waitlist board in Mobbin — use a count-badged side list next to the chair grid.
- Split payment (insurer + pasien) is not clearly shown — use amount due + one insurer row + sisa.
- Almost no web “you are offline” banners — use the top-bar + disabled-control pattern above, with no PHI.
