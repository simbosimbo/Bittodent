# Ide tampilan Chart Open Dental, untuk desainer

*14 Nov 2026. Untuk Pixel Dental. Ini inspirasi alur, bukan salinan tampilan. Acuan: [Chart Module](https://www.opendental.com/manual/chart.html), [Enter Treatment](https://www.opendental.com/manual/entertreatment.html), [Graphical Tooth Chart](https://www.opendental.com/manual/graphicaltoothchart.html), [Missing/Primary Teeth](https://www.opendental.com/manual/missingteeth.html), [Planned Appointments](https://www.opendental.com/manual/apptplanned.html), [Medical](https://www.opendental.com/manual/medical.html). Gaya visual tetap mengacu Zendenta, bukan Open Dental.*

- Satu layar klinis: peta gigi, kepala pasien, linimasa kunjungan, dan isi catatan SOAP — dokter tidak bolak-balik modul hanya untuk mengisi gigi.
- Di kepala pasien, peringatan medis selalu terlihat: alergi, perlu premedikasi, catatan mendesak, obat yang sedang diminum. Warna mencolok, tetap terbaca jika pengguna sulit membedakan warna (bukan andalkan warna saja).
- Alur isi odontogram: ketuk gigi (boleh beberapa, boleh diseret), ketuk permukaan, pilih status, baru pilih kondisi atau tindakan. Permukaan tidak diketik bebas.
- Status yang harus kelihatan di peta: kondisi/pantau, sudah ada di klinik ini, sudah ada di tempat lain, direncanakan, selesai, dirujuk. Bedakan dengan warna plus bentuk atau pola.
- Kunjungan pertama punya langkah jelas: tandai gigi hilang dan gigi susu/tetap/campuran dulu, baru mengisi temuan dan rencana.
- Ada cara melihat peta di tanggal lain (penggeser atau bandingkan dua kunjungan), supaya perubahan gigi langsung tampak.
- Linimasa (setara Progress Notes) menggabungkan SOAP, temuan gigi, tindakan, foto, dan persetujuan, urut waktu. Filter "hari ini" dan "semua". Item selesai tidak bisa dihapus dari sini.
- SOAP dan odontogram selaras: draf berlabel "Draf AI, perlu persetujuan dokter"; yang sudah ditandatangani terkunci dan tampak beda dari draf. Koreksi = versi baru, versi lama tetap bisa dibuka.
- Setelah merawat, dokter menandai tindakan "selesai" dari peta atau linimasa, lalu mengunci catatan dengan tanda tangan. Bukan dua dunia terpisah.
- Dari sisa rencana, dokter/asisten bisa merangkai "kunjungan berikutnya" (tindakan + perkiraan lama) di kursi; front desk hanya memilih jam di kalender.
- Foto dan rontgen tampak di samping peta, sudah tertaut ke gigi yang dipilih; klik membesar tanpa meninggalkan Chart.
- Tombol cepat untuk tindakan yang sering (tambalan, cabut, scaling) boleh ada; jangan meniru kode Amerika. Diagnosis boleh menempel di tindakan, atau berdiri sendiri sebagai kondisi.
- Jangan buat kotak "catatan bebas di bawah peta gigi" yang tidak punya riwayat. Jangan buat riwayat medis yang bisa ditimpa diam-diam.
- Tampilan offline dan "belum sinkron" tetap merujuk brief Bitto: badge jelas, data lokal terbatas, bukan salinan seluruh rekam.
- Ditunda di desain MVP: perio, gambar tangan bebas, pergerakan gigi, catatan satu untuk banyak tindakan, alur mahkota dua kunjungan. Sediakan tempat di peta, jangan dipaksa masuk sekarang.
