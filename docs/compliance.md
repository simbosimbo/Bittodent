# Kepatuhan Regulasi Indonesia (draf 1)

*Dicek dari sumber resmi pada 14 Nov 2026. Nomor pasal hanya dicantumkan jika teksnya sudah dibaca langsung. Selain itu ditulis "perlu dicek". Dokumen ini **bukan nasihat hukum** dan **bukan klaim kepatuhan**. Perlu ditinjau konsultan hukum kesehatan sebelum dipakai.*

## 1. Permenkes 24/2022 tentang Rekam Medis
Sumber: [PDF JDIH Kemkes](https://jdih.kemkes.go.id/storage/documents/pdfs/2022permenkes024.pdf) · [peraturan.go.id](https://peraturan.go.id/id/permenkes-no-24-tahun-2022) (status: Berlaku). Mencabut Permenkes 269/2008.

| Pasal | Isi (diringkas) | Dampak ke produk |
|---|---|---|
| 3 | Semua fasyankes wajib menyelenggarakan **Rekam Medis Elektronik (RME)**, termasuk tempat praktik mandiri dokter gigi dan klinik. | Pasar wajib digital. |
| 9 ayat 3 | Penyelenggara Sistem Elektronik (PSE) RME harus **terdaftar sebagai PSE sektor kesehatan** di kementerian bidang kominfo. | Kita harus daftar PSE. |
| 10–11 | Sistem wajib bisa **interoperabilitas** (bertukar data dengan sistem lain memakai standar) dan mengikuti variabel & metadata dari Kemenkes. | Model data ikut standar Kemenkes. |
| 12 | Sistem elektronik RME **wajib diregistrasi di Kemenkes**, dengan dokumen termasuk fitur dan **lokasi penyimpanan data**. | Registrasi produk. |
| 14 | Data identitas minimal: no. RM, nama, **NIK**; data sosial: agama, pekerjaan, pendidikan, status kawin. | Field wajib di pendaftaran. |
| 16 ayat 2 & 4 | Catatan klinis harus lengkap, jelas, dicatat setelah pelayanan, dengan **nama, waktu, tanda tangan** nakes. Kesalahan boleh diperbaiki oleh nakes. | Dasar alur "draf → disetujui dokter". |
| 18 | Pengkodean klinis memakai klasifikasi internasional penyakit & tindakan terbaru (ICD). | Agen koding. |
| 20 | Penyimpanan di server / **cloud yang tersertifikasi** sesuai aturan; **wajib backup** di tempat berbeda dari lokasi fasyankes, berkala, dengan SOP. | Arsitektur backup. Jenis sertifikasi cloud: perlu dicek. |
| 21 | RME **harus terhubung** dengan platform interoperabilitas Kemenkes. | Sinkron SATUSEHAT di MVP. |
| 22 | Jika fasyankes menyimpan lewat kerja sama dengan PSE, PSE harus punya **fasilitas penyimpanan di dalam negeri**, dapat **rekomendasi** unit data Kemenkes, dilarang membuka/memanfaatkan data, wajib **pakta integritas/NDA**, dan fasyankes dapat **akses tidak terbatas** ke datanya. | Hosting di Indonesia; kontrak & ekspor data penuh. |
| 24 | Transfer RME untuk rujukan lewat platform Kemenkes. | Fitur rujukan nanti lewat SATUSEHAT. |
| 25–26 | Dokumen RM milik fasyankes; **isi RM milik pasien**. | Klinik = pemilik data; pasien berhak dapat isinya. |
| 29–30 | Prinsip kerahasiaan, integritas, ketersediaan. Hak akses (input, perbaikan, lihat) diatur pimpinan fasyankes. **Perbaikan data administratif dan klinis paling lama 2x24 jam** sejak data diinput (ayat 6). Ayat 7: bila kesalahan **data administratif** diketahui setelah lewat tenggat, perbaikan perlu persetujuan perekam medis dan/atau pimpinan. Ayat 7 **tidak menyebut data klinis**. | RBAC + kunci edit 48 jam + alur persetujuan koreksi. Untuk koreksi klinis setelah 2x24 jam (D-013, `correction_request`): dasar hukumnya **perlu dicek**. Koreksi **tindakan** (DEVIATIONS #53): tenggat bisa disetel per klinik (bawaan 48 jam), acuan = `finalized_at` tindakan (baris pertama rantai koreksi); lewat tenggat = persetujuan pemilik. Dasar hukum untuk data klinis **perlu dicek**; acuan `finalized_at` vs waktu input juga perlu dicek. |
| 31 | Boleh dilengkapi **tanda tangan elektronik**. | Pertimbangkan TTE tersertifikasi (perlu dicek penyelenggaranya). |
| 32 | Isi RM wajib dirahasiakan, juga setelah pasien meninggal. | |
| 39 | Simpan RME **paling singkat 25 tahun sejak kunjungan terakhir**. | Retensi minimal 25 tahun; tidak ada hapus otomatis. |
| 42 | Sanksi administratif ke fasyankes (teguran tertulis, rekomendasi pencabutan akreditasi). | |
| 45 | Batas penerapan RME: **31 Desember 2023** (sudah lewat). | |

**Temuan penting:** Permenkes 24/2022 **tidak menyebut odontogram**. Kewajiban "odontogram klinik" ada di Permenkes 269/2008 Pasal 3 ([PDF](https://jdih.kemkes.go.id/storage/documents/pdfs/2008permenkes269.pdf)), yang sudah dicabut. Acuan odontogram sekarang: use case "Gigi" SATUSEHAT (ada pengiriman data pemeriksaan odontogram) dan "Panduan Rekam Medis Kedokteran Gigi" Kemenkes 2015 ([katalog perpustakaan Kemenkes](https://perpustakaan.litbang.kemkes.go.id/index.php?id=36153&keywords=&p=show_detail)) — dokumen panduan 2015 belum kami baca, **perlu dicek**.

**Nama "SATUSEHAT"** tidak muncul di teks Permenkes; pasal 21 menyebut "platform layanan interoperabilitas dan integrasi data kesehatan yang dikelola Kemenkes". Bahwa ini = SATUSEHAT Platform: **perlu dicek** di pedoman/surat edaran resmi (sangat mungkin, tapi belum kami baca tertulis).

## 2. SATUSEHAT Platform
Sumber: [Dokumentasi SATUSEHAT – FHIR](https://satusehat.kemkes.go.id/platform/docs/id/fhir/) · [Endpoint](https://satusehat.kemkes.go.id/platform/docs/id/postman-workshop/endpoint-information/) · [Use case Gigi](https://satusehat.kemkes.go.id/platform/docs/id/interoperability/rawat-jalan-gigi/) · [KFA REST API](https://satusehat.kemkes.go.id/platform/docs/id/master-data/kfa/rest-api-kfa/) · [Kefarmasian](https://satusehat.kemkes.go.id/platform/docs/id/interoperability/kefarmasian/)

- Memakai **HL7 FHIR** (standar internasional format data kesehatan dan API). URL API bernama `/fhir-r4/v1`, jadi versinya **R4**.
- Login memakai **OAuth2 client credentials** (kunci aplikasi dari Kemenkes); ada lingkungan *sandbox* (uji) dan *production*.
- Sebelum kirim data: registrasi Organization, Location, dan ambil nomor IHS tenaga kesehatan (Practitioner).
- **Use case Gigi** (v1.5, 7 Agustus 2024) mencakup: pendaftaran pasien & kunjungan, anamnesis, pemeriksaan fisik (termasuk OHI-S), **pemeriksaan odontogram** (resource Observation, dengan permukaan gigi), penunjang, diagnosis, tindakan, edukasi, farmasi, prognosis, tindak lanjut. Resource yang dipakai antara lain Encounter, Condition, Observation, Procedure, MedicationRequest, MedicationDispense, ImagingStudy, QuestionnaireResponse.
- **KFA**: kode obat di `Medication.code` wajib untuk obat non-racikan; kode 92xxxxxx (template) atau 93xxxxxx (produk aktual); MedicationDispense wajib kode 93.
- Terminologi: ICD-10 untuk diagnosis, **ICD-9-CM versi 2010** untuk tindakan ([halaman ICD-9-CM](https://satusehat.kemkes.go.id/platform/docs/id/terminology/icd/icd-9-cm/)). Ada juga lampiran terminologi khusus gigi dan "Klaim BPJS Kesehatan".

## 3. UU 17/2023 tentang Kesehatan
Sumber: [peraturan.go.id PDF](https://peraturan.go.id/files/uu-no-17-tahun-2023.pdf)

- **Pasal 293**: setiap tindakan perlu persetujuan setelah penjelasan memadai (diagnosis, indikasi, tindakan & tujuan, risiko, alternatif, risiko jika tidak dilakukan, prognosis). Persetujuan boleh tertulis atau lisan; **tertulis wajib sebelum tindakan invasif/berisiko tinggi**, ditandatangani pasien/wakil dan disaksikan nakes.
- **Pasal 296**: nakes wajib membuat rekam medis; di fasyankes (bukan praktik mandiri) jadi tanggung jawab fasyankes; harus segera dilengkapi; setiap catatan diberi **nama, waktu, tanda tangan**.
- **Pasal 297**: dokumen RM milik fasyankes; pasien berhak mengakses informasinya; fasyankes wajib menjaga keamanan, keutuhan, kerahasiaan, ketersediaan.
- **Pasal 298**: Kemenkes mengelola data rekam medis untuk data kesehatan nasional.
- **Pasal 299**: rincian rekam medis diatur Peraturan Pemerintah. PP pelaksananya adalah [PP 28/2024](https://peraturan.go.id/id/pp-no-28-tahun-2024) (status Berlaku). **Isinya belum kami baca — perlu dicek**, terutama apakah mengubah aturan retensi atau RME di Permenkes 24/2022.
- **Pasal 301**: nakes wajib menjaga rahasia kesehatan pasien.

## 4. UU 27/2022 tentang Pelindungan Data Pribadi (UU PDP)
Sumber: [peraturan.go.id PDF](https://peraturan.go.id/files/Salinan+UU+Nomor+27+Tahun+2022.pdf)

- **Pasal 4**: **data dan informasi kesehatan** = data pribadi *spesifik* (perlindungan lebih ketat).
- **Pasal 20**: wajib punya dasar pemrosesan (antara lain persetujuan eksplisit, perjanjian, kewajiban hukum, kepentingan vital).
- **Pasal 34**: wajib **penilaian dampak** (DPIA) untuk pemrosesan berisiko tinggi, termasuk keputusan otomatis berdampak signifikan, data spesifik, skala besar, teknologi baru.
- **Pasal 35**: pengendali wajib melindungi dan memastikan keamanan data dengan (a) menyusun dan menerapkan langkah teknis operasional, dan (b) menentukan tingkat keamanan sesuai sifat dan risiko data.
- **Pasal 46**: jika terjadi kebocoran, beri tahu tertulis ke subjek data dan lembaga **paling lambat 3x24 jam**.
- **Pasal 53**: wajib menunjuk **petugas pelindungan data** (DPO) antara lain bila inti kegiatan memproses data spesifik skala besar.
- **Pasal 56**: transfer data ke luar negeri hanya jika negara tujuan setara/lebih tinggi perlindungannya, atau ada perlindungan mengikat, atau persetujuan subjek.
- **Pasal 74**: masa penyesuaian 2 tahun sejak diundangkan (17 Okt 2022) — **sudah berakhir**.
- Peran kita: klinik = **Pengendali Data**; kita (vendor) = **Prosesor Data** yang memproses atas nama klinik. Perlu perjanjian pemrosesan data.
- **Catatan risiko, akses pemilik ke catatan klinis (D-040, 14 Nov 2026).** Catatan klinis termasuk **data dan informasi kesehatan**, yang menurut UU PDP **Pasal 4** adalah data pribadi *spesifik* dan mendapat perlindungan lebih ketat (sumber: [PDF UU 27/2022](https://peraturan.go.id/files/Salinan+UU+Nomor+27+Tahun+2022.pdf), sudah dikutip di bagian ini). Jerome memutuskan pemilik klinik, meski bukan dokter, **boleh membuka** catatan, hanya baca. Itu memperluas siapa yang melihat data spesifik, sehingga risiko kebocoran atau penyalahgunaan lebih besar. Pengaman yang sudah diputuskan: hanya baca, tidak menandatangani, tidak mengubah; setiap buka tercatat (siapa, kapan, pasien mana) dan tampil di layar audit pemilik; hak ini dijelaskan di pemberitahuan privasi. Dasar pemrosesan tetap wajib ada (**Pasal 20**). Langkah keamanan harus sesuai sifat dan risiko data (**Pasal 35**). Isi rekam medis wajib dirahasiakan ([Permenkes 24/2022](https://peraturan.go.id/id/permenkes-no-24-tahun-2022) Pasal 32, PDF: [jdih.kemkes.go.id](https://jdih.kemkes.go.id/storage/documents/pdfs/2022permenkes024.pdf); kerahasiaan juga di Pasal 29–30, hak akses diatur pimpinan fasyankes). Tenaga kesehatan wajib menjaga rahasia kesehatan pasien (UU 17/2023 Pasal 301). Ini catatan risiko, bukan nasihat hukum. Nomor pasal lain tidak ditambahkan di sini.

## 5. BPJS Kesehatan
- Dokter gigi bisa menjadi FKTP BPJS; panduan Mobile JKN resmi menyebut pilihan "Dokter Gigi terdaftar" pada FKTP ([bpjs-kesehatan.go.id](https://bpjs-kesehatan.go.id/user-manual-mobile-jkn/pelayanan%20jkn.html)).
- Integrasi sistem (bridging) untuk FKTP umumnya lewat web service **PCare** dan **Antrean FKTP**, dengan katalog API di portal "Trust Mark" BPJS. Sumber yang kami temukan untuk ini **bukan halaman resmi** BPJS, dan portal Trust Mark tidak bisa diakses dari luar — **perlu dicek** langsung ke BPJS (proses: Consumer ID, whitelist IP, persetujuan kantor cabang).
- Aturan manfaat gigi JKN, tarif kapitasi, dan perlu-tidaknya klaim per tindakan untuk dokter gigi: **perlu dicek** (belum membaca Perpres/Permenkes terkait).

## Checklist menuju kepatuhan (yang harus dikerjakan, bukan klaim)
- [ ] **GERBANG KERAS (D-030): pindah dari MySQL ke PostgreSQL 18 + RLS `FORCE` sebelum data pasien asli pertama masuk.** Bukti yang wajib ada: migrasi selesai, tes isolasi RLS (sebagai peran aplikasi non-pemilik) lulus untuk setiap tabel tenant, peran aplikasi tanpa `TRUNCATE`/`BYPASSRLS`, fungsi pencarian ber-filter tenant terpasang. Selama gerbang ini belum lulus: **data palsu saja**, di semua lingkungan.
- [ ] Konsultasi hukum kesehatan & PDP; konfirmasi daftar regulasi di atas + PP 28/2024.
- [ ] Daftar sebagai **PSE** sektor kesehatan (Permenkes 24/2022 Pasal 9 ayat 3).
- [ ] **Registrasi sistem elektronik RME** di Kemenkes (Pasal 12), termasuk lokasi data.
- [ ] Dapat **rekomendasi** unit data Kemenkes sebagai PSE penyimpan RME (Pasal 22 ayat 2).
- [ ] Hosting & backup di **Indonesia**, di cloud yang tersertifikasi (cek jenis sertifikasi yang diminta).
- [ ] Onboarding **SATUSEHAT** (sandbox → production), lulus uji use case Gigi, mapping KFA/ICD.
- [ ] Bahan perjanjian: perjanjian pemrosesan data + NDA/pakta integritas + jaminan akses & ekspor penuh data klinik.
- [ ] **DPIA** untuk agen AI dan data kesehatan (UU PDP Pasal 34). Butir yang wajib masuk:
  - D-020: nama pasien, tanggal lahir, dan kode terstruktur (ICD, gigi, KFA) tidak dienkripsi per kolom. Risiko sisa: terbaca bila database bocor. Mitigasi: enkripsi disk/backup, RLS, peran hak minimum, audit baca.
  - D-027: dokter melihat riwayat lintas cabang dalam satu tenant, semua tercatat di audit.
  - D-026/D-028: data offline di perangkat (PIN 6 angka, maks 12 jam), risiko tebakan PIN bila perangkat dicuri.
  - D-040: pemilik (meski bukan dokter) boleh membaca catatan klinis. Data ini spesifik (UU PDP Pasal 4). Mitigasi: hanya baca, tanpa tanda tangan atau ubahan, setiap buka di jejak audit dan layar audit, dijelaskan di pemberitahuan privasi.
- [ ] Tunjuk **DPO** (UU PDP Pasal 53).
- [ ] Prosedur **kebocoran data 3x24 jam** (UU PDP Pasal 46) + latihan.
- [ ] Retensi **≥25 tahun** sejak kunjungan terakhir, tanpa hapus otomatis (Permenkes 24/2022 Pasal 39).
- [ ] Kunci edit **2x24 jam** + alur koreksi dengan persetujuan (Pasal 30).
- [ ] Formulir **persetujuan tindakan** sesuai UU 17/2023 Pasal 293.
- [ ] Penilaian transfer data ke luar negeri untuk setiap penyedia AI/SaaS (UU PDP Pasal 56).
- [ ] Dapatkan formulir **odontogram** standar resmi terbaru dan panduan rekam medis gigi.
- [ ] (Setelah MVP, D-008) pengajuan akses bridging PCare/Antrean ke BPJS.
- [ ] (Arah) ISO 27001 & ISO 27799 — audit oleh lembaga sertifikasi, bukan klaim sendiri.
