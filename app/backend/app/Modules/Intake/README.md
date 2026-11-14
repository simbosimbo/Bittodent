# Modul Intake (anamnesis)

**Belum ada fitur.**

Akan memiliki: kuesioner pra-kunjungan dan jawaban anamnesis **berversi** (riwayat penyakit, alergi, obat rutin).

Invarian:
- Jawaban yang sudah dikirim tidak ditimpa: perubahan = versi baru (siapa, kapan), versi lama tetap.
- Isi jawaban = data kesehatan: enkripsi per kolom, tidak pernah di log/audit.
- Peringatan medis (alergi, dll.) diteruskan ke Patients **lewat `Patients\Contracts\MedicalAlerts`**, bukan menulis tabel pasien.

Bergantung pada: Patients (Contracts).

Aturan: kode baru diletakkan di sini (`Models/`, `Http/`, `Services/`, `Domain/`, `Routes/routes.php`, `Contracts/`, `Events/`). Modul lain hanya boleh memakai `Contracts/` atau `Events/` modul ini, dan hanya jika sisi (edge) tercantum di `config/modules.php`.
