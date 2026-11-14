# Catatan: warna odontogram yang bisa diatur (CareStack)
Sumber: https://carestack.zendesk.com/hc/en-us/articles/25172259253140-Set-Up-Tooth-Chart-Colors-in-Odontogram-Settings (diakses 2026-11-14)
Isi: admin praktik bisa mengganti warna tiap status di peta gigi (pemilih warna HEX/RGB), dan legenda warna bisa dibuka dari layar Chart.

## Sikap Bitto (usulan)
- MVP: legenda tetap (warna + bentuk), tidak bisa diubah klinik.
- Setelah MVP: klinik boleh pilih warna HANYA dari palet yang lolos uji kontras (AA); bentuk simbol tidak bisa diubah, supaya tetap terbaca tanpa warna.
- Berlaku per klinik (tenant), sama di semua cabang dan semua pengguna, supaya dokter lintas cabang tidak salah baca.
- Perubahan tercatat di audit log; legenda selalu tampil di layar dan ikut tercetak di setiap ekspor/cetak.
- Jika formulir odontogram resmi keluar, legenda resmi menggantikan pilihan klinik.
