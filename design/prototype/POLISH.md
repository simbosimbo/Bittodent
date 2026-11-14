/caveman

Polish the existing Bitto Vite+TS prototype in /workspace/ehr-dental/design/prototype/. Do NOT start over. Do NOT rewrite the app from scratch. Keep the current module nav, tokens, mock data, and screens. Edit in place. NEVER write into /workspace/ehr-dental/app or /workspace/ehr-dental/design/odontogram/.

Goals for this pass only:

1) Mobbin takeaways (patterns only, never copy screens). Read /workspace/ehr-dental/design/research/mobbin-patterns.md and apply, especially:
- Jadwal: sticky toolbar (prev/next, Hari ini, cabang), red now-line, dense blocks (time+nama+prosedur), waitlist as a count-badged SIDE LIST (Papan tunggu may keep drag in/out as Jerome asked — style it as a pinboard/list, not a Kanban board). Right rail to create an appointment.
- Registrasi: search-before-create; stepped form (Identitas → Kontak → Asuransi → Konfirmasi) with sticky footer Batal / Simpan draf / Lanjut.
- Rail: cabang name at top of sidebar; icon rail that can collapse on tablet; user identity in the nav, not in patient records.
- Sticky patient header: initials, name, age/DOB, ALWAYS-visible allergy chip (colour + label). NIK/phone masked until deliberate click. Status chips next to the name.
- SOAP AI: draft card (dashed/tinted/watermark), persistent footer "Tinjau catatan ini sebelum dipakai", confirm modal "Saya sudah meninjau / Setujui dan kunci", Simpan draf vs Setujui as two actions.
- Kasir: left method cards, right line items + sticky Konfirmasi pembayaran; disabled methods stay visible with a reason; receipt without diagnosis.
- TOTP centred card, no trust-device; recovery codes 8–10 in two columns with Salin/Cetak; PIN pad, no patient data, remaining-tries warning.
- Offline slim full-width bar, no PHI; distinguish Offline vs Belum sinkron (colour + label, AA contrast). Repeat constraint on disabled controls.

2) Odontogram assets. If not already wired, USE /workspace/ehr-dental/design/odontogram/ (import/copy into src, do not modify that folder): legend.json, odontogram.css, odontogram-full.svg or teeth/*.svg, ID scheme from its README (t16-O, data-state draft|signed, data-condition). Legend labelled "Legenda internal".

3) Surface labels: data IDs stay `L` for lingual/palatal. Visible label = `P` on upper teeth (rahang atas), `L` on lower (rahang bawah).

4) Procedure STATUS is a separate layer from condition (kondisi gigi). Do not collapse them into one enum.
   Statuses (see /workspace/ehr-dental/docs/research/opendental-chart-ux.md and, if present, `statuses` in /workspace/ehr-dental/design/odontogram/legend.json):
   - kondisi
   - sudah ada di sini
   - sudah ada di tempat lain
   - direncanakan
   - selesai
   - dirujuk
   Show a status chip on every row in the Charting procedure list. Mark this status model in the UI as "kemungkinan MVP" (a small note or badge near the list/legend). Chart entry flow idea: tap tooth → surface → status → condition/procedure.
   Keep condition keys (sehat, karies, tambalan, mahkota, hilang, sisa akar, perlu dicabut, implan) on the tooth/surface. Prefer legend.json keys (sisa_akar, perlu_dicabut) if you align them.

5) Other Charting ideas from the Open Dental UX note (ideas only, don't copy UI): medical alerts always visible in the header; visit compare; timeline; mark procedure selesai then lock SOAP; photos can appear beside the chart as a light strip if easy. Skip perio and other deferred items.

6) Run `npm run build` and fix until it passes.

Summary only (no source): what changed, Mobbin takeaways applied, whether odontogram assets were wired, status model notes, known gaps, open questions.
