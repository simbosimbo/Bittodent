# Catatan: checklist pindah data Open Dental
Sumber: https://www.opendental.com/site/checklistconverteddb.html (diakses 2026-11-14). Diambil idenya saja, tidak disalin.

## Ide untuk Bitto (fitur "pindahan klinik", setelah MVP)
- Wizard setup klinik: profil klinik/cabang, dokter, staf + peran, kursi, jadwal dokter, daftar tindakan + tarif, jenis recall, printer struk.
- Cocokkan saldo piutang: total piutang di software lama = total di Bitto saat hari pindah; laporan disimpan sebagai bukti.
- Cek pasien ganda lalu gabungkan (merge tercatat di audit log, bisa dilacak).
- Pasien tanpa cabang ditandai untuk ditetapkan.
- Janji ke depan: cek kursi, dokter, dan tindakan yang terpasang.
- Odontogram hasil impor dicek ulang (gigi hilang, dll.).
- Rapikan daftar induk: alergi, penyakit, obat, asuransi, lab, rujukan.
- Template catatan dan tombol tindakan cepat.
- Rencana backup.

## Aturan Bitto (berbeda / tambahan)
- Impor data nyata hanya setelah gerbang D-030 (PostgreSQL + RLS) dan persetujuan Jerome.
- Data klinis hasil impor ditandai "data impor, belum diverifikasi", tidak dianggap catatan yang ditandatangani dokter Bitto; catatan asli tetap disimpan apa adanya.
- File impor dienkripsi, dihapus setelah selesai, dan setiap impor tercatat di audit log.
- Uji coba impor hanya dengan data palsu.
