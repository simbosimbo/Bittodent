# Riset pola POS — prototipe Kasir Bittodent

Tanggal: Sabtu, 14 November 2026 (WIB). Sumber: Mobbin MCP (`search_screens`, `search_flows`).  
Koleksi (privat, hanya Yohanes dan tim): [Bittodent Kasir](https://mobbin.com/collections/b21a9cdb-38c2-476e-ab03-be28e46e4c44/mobile/screens).

## Batasan katalog Mobbin

Pencarian bertarget **tidak menemukan** aplikasi POS merchant yang diminta:

- Square POS / Square Point of Sale / Square for Retail — 0 layar (hanya Square Go, onboarding konsumen).
- Toast, Clover, Lightspeed, Loyverse — tidak muncul sebagai aplikasi di hasil.
- Moka, Majoo, Pawoon (kasir Indonesia) — tidak ada di katalog; kueri “Moka POS” mengembalikan checkout e-commerce acak (Weverse, Woolworths, Jobber, dll.).

Yang tersedia, dan dipakai sebagai acuan, adalah **aplikasi merchant yang paling dekat dengan kasir** (Shopify Create order / Collect payment, Jobber Collect Payment) plus pola keypad, metode bayar, struk digital, dan refund dari aplikasi pembayaran/ritel konsumen.

Pola *close drawer / Z-report / hitung pecahan uang* juga **tidak ada** di Mobbin. Untuk Tutup Shift, prototipe mengikuti praktik POS klasik (hitung per pecahan, bandingkan dengan kas sistem, catat selisih) — bukan salinan layar Mobbin.

## Pola yang diadopsi

### 1. Mode charge terfokus + jumlah besar
Kasir sungguhan tidak mengetik nominal di field kecil di samping daftar item. Layar charge berdiri sendiri: jumlah tertagih sangat besar, metode, lalu aksi utama.

- [Jobber — Collect Payment](https://mobbin.com/screens/33fe54a9-4b98-486a-8d71-9df2224fc173): “Payment Amount” `Rp150,000.00` di tengah, lalu baris besar Cash / Check / Other.
- [Grab — Pay bill](https://mobbin.com/screens/a305ba9b-d834-4205-88b3-b4a7b47461fc): nominal sangat besar, rincian di bawah, CTA “Pay bill” penuh lebar (berguna untuk konteks rupiah).
- [Shopify iOS — Collect payment](https://mobbin.com/screens/5648bedf-5315-484b-9b77-6efc5412a22d): keranjang + total, lalu tombol **Collect payment** menonjol di bawah.

**Untuk Bittodent:** dari Detail Tagihan, “Terima Pembayaran” membuka **mode charge penuh** (bukan panel sempit 4 kolom). Jumlah sisa dibayar ditampilkan besar.

### 2. Keypad numerik besar + nominal cepat
Hampir semua aplikasi pembayaran memakai keypad full-width, bukan input teks.

- [World App — Buy](https://mobbin.com/screens/59400b3c-9dea-4c79-906b-f67eea3b5fee): jumlah besar + chip cepat (€100 / €1000 / €10000) di atas keypad 3×4 + Continue. Ini acuan terdekat untuk “uang pas / pecahan”.
- [Cash App — Pay](https://mobbin.com/screens/f8759514-a3c9-49df-a0d8-02439b6ad357): keypad memenuhi layar, CTA Pay menempel di bawah — mode charge yang sangat terfokus.
- [PayPal — How much is the total?](https://mobbin.com/screens/ae1974f2-3414-42be-87bd-0ab155b527ea) dan [Zomato — Enter bill amount](https://mobbin.com/screens/3d9363e8-3b5e-40b9-abc0-22a784643083): jumlah di atas, keypad di bawah, CTA di antara keduanya.

**Untuk Bittodent (Tunai):** keypad 1–9, 0, 000, hapus; chip **Uang pas** plus pecahan rupiah (Rp 50.000, 100.000, 200.000, 500.000, 1.000.000). Kembalian dihitung langsung, target sentuh ≥ 44px (lebih besar di mode charge).

### 3. Ubin metode bayar yang besar
- [Jobber — Collect Payment](https://mobbin.com/screens/33fe54a9-4b98-486a-8d71-9df2224fc173): satu metode = satu baris penuh, ikon + label + chevron.
- [CHOPT — Checkout](https://mobbin.com/screens/ad62f62c-f060-4927-ab58-be71fd25cd1b): dua CTA besar bertumpuk (Apple Pay, Pay with Card), lalu Place Order.
- [Careem — Select payment method](https://mobbin.com/screens/4d525d6e-1aef-4c37-963c-0c8b6cc72816): daftar metode termasuk **Cash**, konfirmasi di bawah.

**Untuk Bittodent:** ubin besar Tunai, QRIS, EDC, Transfer, Split — bukan kotak 56px berjajar 3 kolom.

### 4. Antrean / draft sebagai antrian kerja
- [Shopify web — Create order / Drafts](https://mobbin.com/screens/e5109465-9d39-4fb9-9455-ad720dad78a1) dan [draft #D9](https://mobbin.com/screens/068a5a10-0221-4070-9a4a-e66edb66aae7): sidebar Drafts sebagai antrean, kanvas item + ringkasan bayar, pelanggan di kolom kanan. Cocok untuk tata letak tablet.
- Alur [Shopify iOS — Creating an order](https://mobbin.com/flows/692ed2c6-d91b-4376-8aba-568048415be1) (11 layar): buat pesanan → item → Collect payment / Mark as paid → pesanan tertutup dengan linimasa.

**Untuk Bittodent:** Antrean Kasir tetap menjadi “open bills” (tagihan dari tindakan bertanda tangan hari ini), dipadatkan agar KPI, daftar menunggu, Tutup Shift, dan kartu piutang terlihat di 1440×900.

### 5. Layar sukses + opsi struk digital
Bukan hanya banner “lunas”, melainkan layar fokus dengan aksi struk.

- [Jobber — Payment Recorded](https://mobbin.com/screens/ffc24d22-55cf-4e32-afa6-39c76c713375): centang, “A Rp150,000.00 payment has been recorded”, **View Receipt** + **Done**.
- [Jobber — Email Receipt](https://mobbin.com/screens/d581d1cf-9f9c-4aa5-8cf3-d9185b9f5e81): rincian tunai + tombol hijau **Email Receipt**.
- [Gojek — Share receipt](https://mobbin.com/screens/2f6ecfe8-194f-438f-8eac-28743c2fb4db): status Completed, **Share receipt** (konteks Indonesia).
- [Crate & Barrel — Order Confirmation](https://mobbin.com/screens/69b701de-bf55-4cd6-9607-480c2b43c309): struk bergigi + **Print Receipt**.
- [CRED](https://mobbin.com/screens/afc4ae67-96ec-4ef5-b3ad-06429f738d00), [Setel](https://mobbin.com/screens/04020309-c2eb-4e19-ad07-2bd1458f2883), [Vipps](https://mobbin.com/screens/5728a722-78c7-44eb-897b-bb3d3342f45e): sukses + Share receipt (Vipps juga “Split the cost”).

**Untuk Bittodent:** layar Lunas penuh dengan Cetak, WhatsApp, Email, lalu Buat janji kontrol. Void/refund diakses dari struk/lunas, bukan dari tagihan yang masih terbuka.

### 6. Refund dari struk, dengan alasan
Mobbin hanya menampilkan sisi *konsumen*, tetapi polanya jelas: bukti, alasan, jumlah, metode pengembalian.

- [Walmart — Refunded confirmation](https://mobbin.com/screens/85ac4e44-63d4-4ab6-888b-eb75e96c4564): item, alasan (“Past Expiration”), jumlah, metode, Done.
- [Eventbrite — Refund request](https://mobbin.com/screens/28ca9704-2d86-41bc-adee-8528dd08d89f): **Refund reason** wajib, status “in process”.

**Untuk Bittodent:** alur void/refund dimulai dari struk atau layar Lunas; alasan wajib; di atas Rp 500.000 menunggu persetujuan pemilik.

### 7. Tata letak tablet (keranjang + bayar)
[Shopify web Create order](https://mobbin.com/screens/e5109465-9d39-4fb9-9455-ad720dad78a1) adalah acuan terkuat untuk 1024×768: item di kiri, pembayaran + CTA di blok yang sama, pelanggan di kanan, Drafts di sisi kiri. Diskon default $0.00 (bukan persentase yang sudah terisi).

## Yang tidak ditiru begitu saja

- Checkout langganan Shopify / paywall — bukan kasir klinik.
- Tip, Apple Pay, gift card, “Payment due later” e-commerce — di Bittodent diganti deposit pasien dan metode Tunai/QRIS/EDC/Transfer/Split.
- Mark as paid tanpa metode ([Shopify Mark as paid](https://mobbin.com/screens/5b500d71-c405-4812-96e8-eedee89540b3) / [sheet iOS](https://mobbin.com/screens/305e5f9d-ed72-4469-b0a8-ec7b634eceb8)) — di klinik, setiap pelunasan harus punya metode dan (untuk tunai) uang diterima + kembalian.

## Keputusan produk yang tetap (bukan dari Mobbin)

- Tagihan hanya dari tindakan bertanda tangan hari ini; temuan odontogram tidak ditagihkan.
- Semua pasien Umum; belum ada asuransi.
- Saldo deposit lintas kunjungan bisa dipakai untuk membayar (termasuk sisa tagihan / “angsuran” = sisa saldo, bukan skema cicilan formal).
- Diskon default 0%; di atas batas kasir perlu PIN dokter/admin.
- Visual tetap Bittodent v2 / Zendenta (kanvas `#F3F5F9`, primer `#0B6B62`, Plus Jakarta Sans, kartu 20px tanpa bayangan).
