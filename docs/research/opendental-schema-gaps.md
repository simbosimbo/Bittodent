# Celah model data dibanding Open Dental 26.2

*14 Nov 2026. Acuan konsep saja, bukan salinan skema. Semua klaim tentang Open Dental menunjuk ke dokumentasi mereka.*

Sumber skema (setiap tabel dan kolom, MySQL, versi 26.2): [OpenDentalDocumentation26-2.html](https://www.opendental.com/OpenDentalDocumentation26-2.html). Halaman itu sudah diunduh ke `/workspace/src/opendental-schema-26-2.html` dan diurai: **430 tabel**. Tautan ke satu tabel: tambahkan `#namatabel` di belakang URL itu, misalnya `#procedurelog`.

Sumber alur layar Chart: [manual Chart Module](https://www.opendental.com/manual/chart.html), [Enter Treatment](https://www.opendental.com/manual/entertreatment.html), [Graphical Tooth Chart](https://www.opendental.com/manual/graphicaltoothchart.html), [Missing/Primary Teeth](https://www.opendental.com/manual/missingteeth.html), [Planned Appointments](https://www.opendental.com/manual/apptplanned.html), [Medical](https://www.opendental.com/manual/medical.html). Manual itu merinci cara pakai, bukan skema 26.2; idenya tetap relevan.

Pembanding kita: [database.md](../database.md), [product.md](../product.md) (peta modul), [user-stories.md](../user-stories.md). Dokumen ini **tidak** mengubah ketiga file itu.

## Ringkasan: 8 celah yang sebaiknya masuk MVP

1. Status di peta gigi: kondisi/pantau, sudah ada di klinik ini, sudah ada di tempat lain, direncanakan, selesai, dirujuk — supaya kunjungan pertama bisa membedakan tambalan lama dan yang baru dikerjakan (`procedurelog.ProcStatus`).
2. Keadaan dasar gigi pasien: hilang, gigi susu atau tetap, gigi campuran — diisi di kunjungan pertama (`toothinitial`).
3. Keluarga dan penanggung biaya (orang yang membayar tagihan keluarga) plus wali (`patient.Guarantor`, `guardian`).
4. Peringatan medis yang selalu terlihat: obat yang sedang diminum, daftar penyakit, catatan mendesak, perlu premedikasi, popup saat pasien dibuka (`medicationpat`, `disease`, `patient.Premed` / `MedUrgNote`, `popup`). Alergi kita sudah punya.
5. Janji terencana untuk kunjungan berikutnya, disusun di kursi lalu hanya dijadwalkan oleh front desk (`appointment.AptStatus = Planned`).
6. Stempel waktu datang, duduk di kursi, dan selesai merawat (`appointment.DateTimeArrived` / `DateTimeSeated` / `DateTimeDismissed`).
7. Log pengiriman pengingat supaya pesan yang sama tidak terkirim dua kali, termasuk jika janji dipindah (`apptremindersent`).
8. Catatan penyesuaian keuangan (diskon, penghapusan, koreksi) yang terpisah dari tagihan (`adjustment`).

## 1. Yang mereka punya, kita belum, dan sebaiknya masuk MVP

### Status tindakan di peta gigi — modul odontogram + rencana perawatan
Open Dental menyimpan setiap tindakan pasien di tabel [`procedurelog`](https://www.opendental.com/OpenDentalDocumentation26-2.html#procedurelog), dengan status: rencana (TP), selesai (Complete), sudah dikerjakan di klinik ini (Existing Current), sudah dikerjakan di tempat lain (Existing Other), dirujuk (Referred), kondisi/pantau (Condition). Area kerja ditulis di `ToothNum`, `Surf` (permukaan gigi, misalnya M/D/O), `ToothRange`, atau kuadran/lengkung. Peta gigi menggambar dari status dan jenis gambar di [`procedurecode.PaintType`](https://www.opendental.com/OpenDentalDocumentation26-2.html#procedurecode) ([Enter Treatment](https://www.opendental.com/manual/entertreatment.html), [Graphical Tooth Chart](https://www.opendental.com/manual/graphicaltoothchart.html)).

Kita memisahkan temuan odontogram (`tooth_finding`) dan item rencana (`treatment_plan_item`). Itu bagus, tapi belum ada cara resmi untuk menandai "ini sudah ada dari dulu" versus "baru dikerjakan hari ini", atau "dirujuk ke klinik lain". Tanpa itu, peta gigi kunjungan pertama dan rencana perawatan mudah rancu. Tambahkan status itu pada temuan atau tindakan, dan izinkan area kerja lebih dari satu gigi (rentang, kuadran, lengkung).

### Gigi hilang dan gigi susu — modul odontogram
Tabel [`toothinitial`](https://www.opendental.com/OpenDentalDocumentation26-2.html#toothinitial) mencatat gigi hilang, gigi tersembunyi, gigi susu versus tetap, dan pergerakan. Manual meminta ini diisi di kunjungan pertama, sebelum merawat, karena memengaruhi gambar, pemilihan pontik (gigi palsu jembatan), dan nanti charting gusi ([Missing/Primary Teeth](https://www.opendental.com/manual/missingteeth.html)). Nomor FDI kita sudah mendukung gigi susu (51–85), tetapi belum ada keadaan pasien "gigi ini hilang / ini masih susu". Perlu ada, dan perubahannya tetap berversi seperti temuan lain.

### Keluarga dan penanggung biaya — modul pendaftaran + kasir + persetujuan
Di [`patient`](https://www.opendental.com/OpenDentalDocumentation26-2.html#patient), kolom `Guarantor` menunjuk kepala keluarga yang menanggung biaya. Tabel [`guardian`](https://www.opendental.com/OpenDentalDocumentation26-2.html#guardian) menghubungkan pasien dengan wali. Di Indonesia ini sehari-hari: orang tua membayar tagihan anak, dan wali menandatangani persetujuan (UU 17/2023). Kita punya hubungan penanda tangan di `consent_signature`, tetapi belum ada keluarga atau siapa yang membayar. Tambahkan kelompok keluarga, satu penanggung biaya, dan wali; tagihan anak mengarah ke penanggung itu.

### Daftar obat, penyakit, dan peringatan mendesak — modul pasien + resep + SOAP
Mereka memisahkan alergi ([`allergy`](https://www.opendental.com/OpenDentalDocumentation26-2.html#allergy)), obat yang sedang diminum ([`medicationpat`](https://www.opendental.com/OpenDentalDocumentation26-2.html#medicationpat)), dan masalah/penyakit ([`disease`](https://www.opendental.com/OpenDentalDocumentation26-2.html#disease), di layar disebut Problems). Di pasien ada `Premed` (perlu obat pencegah sebelum tindakan) dan `MedUrgNote` (catatan medis mendesak). Tabel [`popup`](https://www.opendental.com/OpenDentalDocumentation26-2.html#popup) menampilkan peringatan saat pasien dibuka; jika diubah, salinan lama diarsip dulu. Di layar Chart, ringkasan medis selalu tampak di area berwarna ([Medical](https://www.opendental.com/manual/medical.html)).

Kita sudah punya `allergy` dan `medical_history` sebagai satu paket. Untuk keselamatan klinis (prioritas kedua kita), MVP perlu: daftar obat yang sedang diminum (bukan hanya resep yang kita tulis), daftar penyakit, catatan mendesak, tanda premedikasi, dan popup peringatan. Ketiganya harus tampil di kepala profil pasien, di samping chip alergi.

### Janji terencana untuk kunjungan berikutnya — modul jadwal
Satu baris [`appointment`](https://www.opendental.com/OpenDentalDocumentation26-2.html#appointment) bisa berstatus `Planned`: belum ada tanggal, tidak tampil di kalender, hanya di Chart. Janji itu **tidak dijadwalkan**, melainkan **disalin** saat front desk menaruhnya ke kalender (`NextAptNum` menunjuk ke janji terencana asalnya). Alurnya: di kursi, dokter/asisten merangkai tindakan rencana + lama waktu; pasien ke front desk hanya untuk memilih jam ([Planned Appointments](https://www.opendental.com/manual/apptplanned.html)).

Kita punya daftar tunggu (`waitlist_entry`) dan status `perlu_jadwal_ulang`, tetapi belum "paket kunjungan berikutnya". Ini alur harian klinik gigi (setelah tambalan hari ini, mahkota minggu depan). Tambahkan jenis janji terencana yang bisa disalin ke slot nyata, tanpa mengubah janji terencana aslinya.

### Stempel waktu datang, duduk, selesai — modul jadwal
Kolom `DateTimeArrived`, `DateTimeSeated`, dan `DateTimeDismissed` di [`appointment`](https://www.opendental.com/OpenDentalDocumentation26-2.html#appointment) mencatat kapan pasien check-in, duduk di kursi, dan bangun dari kursi. Kolom `Confirmed` juga bisa dipakai untuk status "sudah datang / di kursi". Kita sudah punya keadaan `check_in`, `dalam_perawatan`, `selesai`, tetapi tabel janji belum menyimpan tiga waktu itu. Simpan waktu tiap perpindahan keadaan. Berguna untuk antrean, laporan lama tunggu, dan selisih "dijadwalkan versus benar-benar mulai".

Dua hal dekat yang juga layak ikut, meski lebih kecil: daftar janji yang batal/lepas jadwal tetap perlu dijadwalkan ulang (mereka punya status `UnschedList`; kita sudah dekat dengan `perlu_jadwal_ulang` — pastikan ada daftar kerjanya), dan prioritas "bisa datang lebih awal" (mereka punya `Priority = ASAP` dan tabel [`asapcomm`](https://www.opendental.com/OpenDentalDocumentation26-2.html#asapcomm)). Daftar tunggu kita bisa menampung prioritas ini tanpa tabel baru.

### Log pengiriman pengingat — modul recall & pengingat
Tabel [`apptreminderrule`](https://www.opendental.com/OpenDentalDocumentation26-2.html#apptreminderrule) menyimpan aturan (kapan dikirim, template, per klinik). Tabel [`apptremindersent`](https://www.opendental.com/OpenDentalDocumentation26-2.html#apptremindersent) mencatat setiap kiriman "supaya pengingat yang sama tidak dikirim ulang", termasuk `ApptDateTime` asli: jika janji dipindah, pengingat baru boleh dikirim. Ada tabel serupa untuk terima kasih dan pesan umum.

Kita punya `outbox` dengan kunci `idempotency_key`, template, dan izin di `patient_permission_event`. Itu arah yang benar, tetapi aturan "satu pengingat per janji per jenjang waktu" dan "janji pindah = boleh kirim lagi" perlu dicatat jelas ( entah di outbox atau tabel log kirim). Tanpa itu, agen recall/pengingat mudah mengirim ganda atau sebaliknya diam setelah janji diubah.

### Penyesuaian tagihan — modul kasir
Tabel [`adjustment`](https://www.opendental.com/OpenDentalDocumentation26-2.html#adjustment) adalah catatan uang terpisah (bisa plus atau minus), bisa dilekatkan ke satu tindakan, misalnya diskon. Cerita KSR-5 sudah bilang diskon atau penghapusan hanya boleh disetujui pemilik, tetapi di [database.md](../database.md) belum ada tabelnya. Jangan menimpa angka di `invoice_line`; buat catatan penyesuaian yang hanya bisa ditambah, dengan alasan, pemberi izin, dan jejak audit.

## 2. Layak ditambah nanti (bukan MVP)

- **Kode tindakan otomatis (autocode)** — tabel [`autocode`](https://www.opendental.com/OpenDentalDocumentation26-2.html#autocode), [`autocodeitem`](https://www.opendental.com/OpenDentalDocumentation26-2.html#autocodeitem), [`autocodecond`](https://www.opendental.com/OpenDentalDocumentation26-2.html#autocodecond): pilih "tambalan komposit", sistem memilih kode menurut jumlah permukaan dan posisi gigi. Berguna setelah katalog tindakan kita stabil; jangan meniru kode ADA CDT.
- **Pola waktu 5 menit** — `appointment.Pattern` (`X` waktu dokter, `/` waktu asisten). Untuk MVP, `starts_at` / `ends_at` cukup.
- **Pemicu recall otomatis** — [`recalltrigger`](https://www.opendental.com/OpenDentalDocumentation26-2.html#recalltrigger) mengubah jatuh tempo saat tindakan tertentu selesai. Dokter menetapkan interval (RCL-1) cukup untuk MVP. Hati-hati jika meniru sinkronisasi tanggal mereka (lihat bagian 4).
- **Tindakan lintas kunjungan** (misalnya preparasi mahkota lalu pemasangan) — [`procmultivisit`](https://www.opendental.com/OpenDentalDocumentation26-2.html#procmultivisit). Sering terjadi di klinik gigi; masukkan segera setelah MVP.
- **Catatan kelompok untuk beberapa tindakan hari yang sama** — [`procgroupitem`](https://www.opendental.com/OpenDentalDocumentation26-2.html#procgroupitem) + catatan di [`procnote`](https://www.opendental.com/OpenDentalDocumentation26-2.html#procnote).
- **Riwayat ubahan janji** — [`histappointment`](https://www.opendental.com/OpenDentalDocumentation26-2.html#histappointment). Kita sudah punya `audit_event`; pastikan setiap ubahan janji tercatat lengkap dulu.
- **Charting periodontal (poket gusi)** — [`perioexam`](https://www.opendental.com/OpenDentalDocumentation26-2.html#perioexam), [`periomeasure`](https://www.opendental.com/OpenDentalDocumentation26-2.html#periomeasure). Sudah "nanti" di product.md.
- **Rencana cicilan** — [`payplan`](https://www.opendental.com/OpenDentalDocumentation26-2.html#payplan), [`payplancharge`](https://www.opendental.com/OpenDentalDocumentation26-2.html#payplancharge).
- **Asuransi rumit** — [`carrier`](https://www.opendental.com/OpenDentalDocumentation26-2.html#carrier), [`insplan`](https://www.opendental.com/OpenDentalDocumentation26-2.html#insplan), [`benefit`](https://www.opendental.com/OpenDentalDocumentation26-2.html#benefit), [`claim`](https://www.opendental.com/OpenDentalDocumentation26-2.html#claim), [`claimproc`](https://www.opendental.com/OpenDentalDocumentation26-2.html#claimproc). Untuk MVP, bagi tagihan asuransi swasta vs pasien (KSR-3) cukup. BPJS menyusul (D-008).
- **Hak akses halus** — [`grouppermission`](https://www.opendental.com/OpenDentalDocumentation26-2.html#grouppermission) (ratusan jenis izin, termasuk "hanya boleh ubah data lebih baru dari N hari"). Peran kita (RBA-1) cukup untuk MVP; percepat izin halus jika klinik besar memintanya.
- **Gambar maju** — [`document`](https://www.opendental.com/OpenDentalDocumentation26-2.html#document) (kuncian tanda tangan ke isi file, potong/putar, pengaturan kontras rontgen), [`mount`](https://www.opendental.com/OpenDentalDocumentation26-2.html#mount) (bingkai beberapa foto), [`imagedraw`](https://www.opendental.com/OpenDentalDocumentation26-2.html#imagedraw). MVP: unggah terenkripsi, taut ke gigi (ODO-4).
- Lainnya yang sadar ditunda: laboratorium gigi, ortodonti, inventaris, surat tagihan/penagihan (`statement`, `dunning`), "superfamily", jembatan alat rontgen.

## 3. Yang sengaja kita bedakan, dan mengapa

- **Catatan yang sudah ditandatangani hanya bisa ditambah, tidak diubah.** Mereka merancang tanda tangan di [`procnote`](https://www.opendental.com/OpenDentalDocumentation26-2.html#procnote) begitu: isi catatan + nomor pengguna di-hash (diubah jadi sidik), lalu sidik itu dipakai mengenkripsi goresan tanda tangan. Jika isi catatan berubah, sidiknya tidak cocok, tanda tangan "hilang" dari layar. Mereka juga bilang pengguna tidak pernah mengubah baris catatan; "edit" = baris baru. Kita lebih tegas: versi final ditolak `UPDATE`/`DELETE` di database, versi lama tetap ada, koreksi = versi baru + alasan (SOAP-4, Permenkes 24/2022). Itu lebih aman daripada mengandalkan tanda tangan yang "lenyap" jika isinya diubah.
- **Banyak klinik pelanggan dalam satu sistem (multi-tenant).** Open Dental merancang satu praktik, dengan cabang di tabel [`clinic`](https://www.opendental.com/OpenDentalDocumentation26-2.html#clinic) dan pembatas pengguna di [`userclinic`](https://www.opendental.com/OpenDentalDocumentation26-2.html#userclinic). Kita punya `tenant` → `branch` → `chair`, dan targetnya kunci per baris di PostgreSQL (RLS: aturan di database yang menyembunyikan baris milik klinik lain). Cabang kita mirip `clinic` mereka; isolasi antar pelanggan adalah milik kita.
- **Kode Indonesia, bukan kode Amerika.** Mereka memakai kode tindakan ADA CDT di `procedurecode`. Kita memakai ICD-10, ICD-9-CM, dan KFA (kamus obat Kemenkes), plus kiriman SATUSEHAT. Jangan menyalin kode CDT.
- **BPJS menyusul; asuransi AS tidak kita tiru utuh.** Model `coverage` / `payer` kita sudah disiapkan untuk BPJS (D-008). Manfaat, klaim elektronik, dan "writeoff" ala AS tidak masuk MVP.
- **WhatsApp, bukan SMS/email sebagai saluran utama.** Mereka memakai SMS/email (`apptreminderrule.SendOrder`, [`smstomobile`](https://www.opendental.com/OpenDentalDocumentation26-2.html#smstomobile)). Kita memakai WhatsApp + izin tercatat + template yang disetujui pemilik (D-011, RCL, JDW-3).
- **Persetujuan tindakan mengikuti UU 17/2023.** Mereka menandatangani rencana di [`treatplan.Signature`](https://www.opendental.com/OpenDentalDocumentation26-2.html#treatplan) (terikat ke catatan, tanggal, dan jumlah). Kita mewajibkan 7 butir penjelasan, persetujuan tertulis untuk tindakan invasif, saksi, dan sidik dokumen (RPC-2 s.d. RPC-4).
- **Tagihan sebagai faktur, bukan buku besar yang dihitung ulang dari setiap tindakan.** Mereka memasukkan biaya tindakan langsung ke akun pasien, lalu pembayaran dipecah (`paysplit`) per penyedia. Kita memakai `invoice` / `invoice_line` / `payment` dan saldo dihitung dari situ. Jangan menyalin saldo umur utang yang disimpan di baris penanggung biaya (lihat bagian 4).
- **Tidak ada hapus rekam medis; retensi 25 tahun.** Mereka sering "hapus" dengan mengganti status menjadi Deleted (`procedurelog`, `patient.PatStatus`). Kita memakai arsip, tanpa hak hapus pada data klinis.
- **Draf AI tidak pernah jadi rekam medis sendiri.** Ini tidak ada di Open Dental. Tetap: dokter harus menyetujui (D-001).

## 4. Peringatan dari rancangan mereka

- **Kotak catatan di bawah peta gigi tidak disimpan riwayatnya.** Manual Chart berkata terbuka: catatan itu "tidak disimpan atau dilacak riwayatnya" ([Chart Module](https://www.opendental.com/manual/chart.html), bagian Odontogram Notes). Jangan ditiru. Semua catatan klinis harus berversi.
- **Riwayat medis bebas di layar Medical "tidak diarsip"** dan manual meminta staf menyalinnya ke catatan chart juga ([Medical](https://www.opendental.com/manual/medical.html)). Itu mudah tidak sinkron. `medical_history` kita harus berversi, bukan teks yang ditimpa.
- **Tanda tangan yang "lenyap" jika catatan diubah** itu peringatan sekaligus pelajaran. Idenya bagus: tanda tangan terikat ke isi. Risikonya: jika ada jalur yang mengubah baris yang sama (kueri manual, migrasi, galat program), bukti tanda tangan hilang tanpa versi lama. Kita mengikat sidik isi (`content_hash`) **dan** menolak ubahan pada versi tertandatangan. Jangan hanya mengenkripsi goresan dengan kunci dari isi.
- **Saldo keluarga yang disimpan ulang mudah miring.** `Bal_0_30`, `BalTotal`, dan sejenisnya di [`patient`](https://www.opendental.com/OpenDentalDocumentation26-2.html#patient) hanya diisi pada penanggung biaya, dan harus selalu cocok dengan transaksi. Itu sumber selisih kas yang sulit dilacak. Tetap hitung saldo dari tagihan dan pembayaran.
- **Tanggal recall yang harus selalu diseragamkan dengan tindakan.** Dokumentasi [`recall`](https://www.opendental.com/OpenDentalDocumentation26-2.html#recall) sendiri bilang sinkronisasi ini sulit dan "diharapkan ada beberapa kutu". Jangan simpan dua tanggal yang bisa bertentangan tanpa sumber kebenaran tunggal. Lebih aman: jatuh tempo dihitung ulang dari aturan + kunjungan terakhir, atau satu tanggal yang hanya berubah lewat fungsi resmi.
- **Tautan rencana ke tindakan dihapus saat tindakan selesai** (`treatplanattach`, lihat deskripsi tabel). Jejak "item ini berasal dari rencana mana" bisa hilang. Kita tidak menghapus tautan; item rencana pindah keadaan menjadi `selesai` / `ditagih`.
- **Sidik anti-ubah yang hanya mencakup sebagian kolom.** [`securityloghash`](https://www.opendental.com/OpenDentalDocumentation26-2.html#securityloghash) mengamankan jejak audit (mirip `audit_checkpoint` kita — pertahankan). Tetapi `appointment.SecurityHash` hanya mencakup status, konfirmasi, dan waktu janji, bukan catatan atau kursi. Jangan mengira sidik sebagian setara dengan jejak utuh. `DateTStamp` yang berubah otomatis setiap ubahan juga bisa menutupi siapa mengubah apa, jika tidak ada tabel riwayat atau audit.
- **Satu sumber izin komunikasi.** Mereka memisahkan `commoptout`, `TxtMsgOk`, dan preferensi saluran. Kita sudah memakai `patient_permission_event` (kejadian beri/cabut). Tetap satu sumber, supaya "berhenti" di WhatsApp tidak tertinggal di kolom lain.

## 5. Alur Chart Open Dental, dan ide yang kita ambil

Ringkasan dari [Chart Module](https://www.opendental.com/manual/chart.html) dan [Enter Treatment](https://www.opendental.com/manual/entertreatment.html). File singkat untuk desainer: [opendental-chart-ux.md](opendental-chart-ux.md).

**Cara kerja mereka.** Layar Chart adalah rumah klinis: peta gigi di kiri atas, ringkasan medis dan data pasien di kiri bawah, grid "Progress Notes" (daftar jejak berurutan: tindakan, janji, formulir, pesan) di kanan, tab masukkan tindakan di tengah. Dokter atau asisten memilih gigi di peta (bisa banyak gigi, bisa diseret), memilih permukaan (B/F, V, M, O/I, D, L), memilih status (rencana, selesai, sudah ada, rujukan, kondisi), lalu menekan tombol tindakan atau mengetik kode. Hasilnya langsung tampak di peta dan di daftar jejak. Ada penggeser di bawah peta untuk melihat perubahan dari waktu ke waktu. Tindakan selesai tidak bisa dihapus dari daftar itu. Catatan tindakan ditandatangani; "edit" membuat baris baru. Tab terpisah untuk gigi hilang/susu, janji terencana, dan (nanti) perio. Foto/rontgen bisa tampil di tab bawah Chart.

**Yang patut kita pakai di alur odontogram + SOAP MVP**

1. Kepala pasien selalu menampilkan peringatan medis (alergi, premedikasi, catatan mendesak) — jangan sampai dokter harus membuka halaman lain.
2. Peta gigi adalah cara masuk: ketuk gigi dan permukaan, lalu isi temuan atau tindakan rencana. Jangan paksa mulai dari formulir panjang.
3. Satu peta memuat kondisi yang sudah ada dan rencana/perawatan selesai, dibedakan warna **dan** bentuk (bukan warna saja), plus status tertulis.
4. Ada penggeser atau bandingkan tanggal (kita sudah punya ODO-3): jangan hanya "versi terkini".
5. Satu linimasa kunjungan menggabungkan SOAP, odontogram, tindakan, foto, dan persetujuan — bukan silo terpisah.
6. "Tandai selesai" dari peta atau linimasa, setelah dokter mengunci catatan.
7. Janji terencana disusun di kursi; front desk hanya memilih slot (lihat bagian 1).
8. Diagnosis bisa dilekatkan ke tindakan, atau dicatat sebagai kondisi terpisah jika belum ada rencana.
9. Foto/rontgen tampak di samping peta, sudah tertaut ke gigi (ODO-4).
10. Jangan meniru kotak "catatan odontogram" tanpa riwayat, dan jangan meniru riwayat medis yang bisa ditimpa diam-diam.

Yang ditunda: tombol kode otomatis, gambar tangan bebas di peta, pergerakan gigi ortodonti, perio, catatan kelompok, tindakan lintas kunjungan.
