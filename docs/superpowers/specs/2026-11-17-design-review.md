# Review Desain CEKAS "Langit" — apa yang perlu dikonsistenkan

Tanggal: 17 Nov 2026 · Cakupan: `design/` (landing, Tentang, Fitur, dashboard, masuk, 404/offline) · Metode: audit otomatis CSS/HTML, uji overlap di 5 lebar layar, hitung kontras, cek jadwal 182 tanggal, tangkapan layar tiap halaman.

## 1. Ringkasan

| Area | Nilai | Catatan singkat |
|---|---|---|
| Identitas visual (langit, biru, satu aksen lime) | **Kuat** | Sangat dikenali, tidak mirip template. Palet bebas pink/oranye/ungu. |
| Sistem token | **Cukup → sudah diperbaiki** | Ada dua set token yang nilainya berbeda. Kini satu sumber: `css/tokens.css`. |
| Komponen | **Perlu kerja** | Tombol, chip, badge, kartu, nav, hero didefinisikan ganda di `site.css` dan `app.css`. |
| Gerak dan mikro-interaksi | **Kuat, perlu dibakukan** | Pola bagus tetapi durasi dan kurva tersebar. |
| Kontras dan aksesibilitas | **Cukup, ada celah** | Beberapa pasangan warna di bawah 4,5:1, target sentuh di bawah 44 px. |
| Konten dan istilah | **Baik setelah diperbaiki** | Istilah, CTA, dan data contoh sudah diseragamkan. |
| Performa | **Baik** | Aset 1,5 MB, CSS 176 KB, JS 144 KB (belum diminify). |

Temuan kunci: desain **konsisten di tingkat rasa** (langit, gerak, bentuk) tetapi **belum konsisten di tingkat kode dan komponen**, karena landing dan aplikasi tumbuh sebagai dua sistem paralel.

## 2. Yang sudah konsisten (pertahankan)

- Satu metafora: langit terang, transparan, dengan awan sebagai lapisan hidup. Terbaca di semua halaman.
- Bentuk: sudut besar, pil untuk aksi, kartu putih di atas langit.
- Tipografi: Inter Tight variabel, judul rapat (`letter-spacing` negatif), wordmark Bricolage hanya untuk logo.
- Aksen lime hanya untuk aksi utama, lencana Terverifikasi, dan penanda penting.
- Reduced-motion ditangani di setiap berkas CSS dan JS.
- Alur masuk dan keluar memakai bahasa gerak yang sama (naik menembus awan, malam turun).
- Semua gambar punya `alt`, semua halaman `lang="id"`.

## 3. Temuan dan rekomendasi

Prioritas: **P0** harus sebelum dipasang ke aplikasi · **P1** sebaiknya · **P2** bagus bila sempat. Status: ✅ sudah diperbaiki di putaran ini.

### A. Token dan sistem

| # | Temuan | Bukti | Rekomendasi | Prioritas |
|---|---|---|---|---|
| A1 | Dua set token berbeda nilai | `--ok` #17a34a vs #129a45, `--bad`, `--r-m` 24/22, `--r-l` 32/30, `--gutter`, `--maxw` 1200/1180 | Satu `tokens.css`, dimuat paling awal | ✅ P0 |
| A2 | Variabel dipakai tetapi tak didefinisikan di halaman landing | `--shadow-card`, `--line`, `--ok-bg` | Masuk ke `tokens.css` | ✅ P0 |
| A3 | Komponen yang sama didefinisikan dua kali | `.btn`, `.btn--*`, `.chip`, `.badge`, `.card`, `.nav`, `.hero`, `.bubble` ada di `site.css` dan `app.css` (27 kelas bentrok) | Pecah menjadi `base.css` + `components.css` yang dimuat semua halaman, sisakan `landing.css` dan `app.css` hanya untuk yang khas | P0 |
| A4 | 14 breakpoint berbeda | 560, 620, 640, 700, 720, 760, 820, 860, 899, 900, 940, 979, 980, 1000 | Cukup 4: 560, 760, 980, 1200. Dokumentasikan di token | P1 |
| A5 | 56 warna hex literal | Banyak turunan yang sebenarnya token (`#0b6b30`, `#162a55`, `#ffe1e1`, `#8bf0ac`) | Tambah token turunan (`--ok-ink`, `--ink-2`, `--bad-bg`), ganti literal | P1 |
| A6 | Radius literal tersebar | 14, 12, 18, 8, 26, 10 px | Pakai skala `--r-s/m/l/xl`, tambah `--r-xs: 10px` | P1 |
| A7 | 22 nilai `z-index` | -1 sampai 700 | Skala tokenized (`--z-sheet`, `--z-fab`, `--z-nav`, `--z-veil`, `--z-popover`). Token sudah ada, tinggal dipakai | P2 |
| A8 | Durasi dan kurva gerak beragam | 16 durasi umum, 4 kurva (`--ease`, `--spring`, `--glide` baru, plus yang ditulis langsung) | Pakai `--dur-1..4` dan 3 kurva baku. Token sudah ada | P1 |

### B. Warna dan kontras

Hasil hitung (WCAG, target 4,5:1 untuk teks biasa, 3:1 untuk teks besar):

| Pasangan | Rasio | Status |
|---|---|---|
| Putih di atas `--sky-3` #8ccbf5 | 1,75 | **Gagal.** Dipakai di gradien kartu langit (tile "Buku kas", visual langkah, kartu "Cuaca kas") |
| Putih di atas `--sky-2` #4d9bf0 | 2,89 | **Gagal** untuk teks kecil |
| `--ink-3` di atas paper-2 | 3,95 | Perlu diperbaiki (✅ `--ink-3` digelapkan ke #5f6c88) |
| `--ok` hijau di atas putih | 3,66 → naik | ✅ `--ok` diganti #0f8a3e |
| Putih di atas tombol Setujui | 3,66 → naik | ✅ ikut `--ok` baru |
| Biru `--sky-1` sebagai teks di putih | 4,67 | Lolos |
| Lime-ink di atas lime | 14,0 | Lolos |
| Lime di atas navy (angka hitung mundur) | 14,8 | Lolos |

Rekomendasi: (B1) di gradien terang pakai teks navy atau gelapkan gradien ke `--sky-1` → `--sky-2` saja; (B2) tetapkan aturan: teks putih hanya di atas `--sky-1`, `--sky-deep`, `--ink`; (B3) status tidak boleh hanya warna, selalu tambah ikon atau kata (sudah dilakukan di lencana dan baris transaksi).

### C. Tipografi

- C1: ukuran terkecil 10–12 px dipakai 49 kali (label chip, `small`). Naikkan batas bawah ke 12 px, kecuali label huruf kapital berspasi.
- C2: Inter Tight membuat huruf "I" besar mirip "l" kecil ("Iuran" terbaca "luran"). Uji fitur `cv05`/`ss` (l berekor) atau pakai "I" bertitik di judul pendek. Cek apakah subset woff2 memuatnya.
- C3: skala judul tersebar (`clamp` berbeda di tiap seksi). Tetapkan 5 langkah: display, h1, h2, h3, body, dengan token `--fs-*`.
- C4: letter-spacing negatif besar (-0,045em) pada judul sangat rapat di layar kecil. Longgarkan di bawah 560 px.

### D. Pola dan komponen

- D1 **Nav punya empat varian**: pil tengah di landing/Tentang/Fitur, pil lebar penuh di dashboard, tanpa pil di login dan 404, plus tautan berbeda. Tetapkan satu komponen `nav` dengan varian (`--center`, `--wide`, `--bare`).
- D2 **Hero punya empat varian**: landing penuh, subhalaman pendek, login penuh dengan panel, 404 raksasa. Tidak salah, tetapi dokumentasikan sebagai variasi resmi.
- D3 **Dua set ikon**: sprite `i-` (32 simbol, aplikasi) dan `s-` (18, landing) plus SVG sebaris. Gabung jadi satu `icons.svg` dengan prefiks tunggal.
- D4 **Tombol**: nama varian bercampur (`--dark`, `--tonal`, `--ghost`, `--glass`, `--lime`, `--ok`). Tetapkan tiga peran: primer (lime), sekunder (dark/tonal), tersier (ghost/glass), dengan dua ukuran (`sm`, `lg`).
- D5 **Overlay**: sheet (dialog), popover langit, toast, scene veil memakai animasi dan radius berbeda. Samakan radius dan durasi masuk.
- D6 **Keadaan**: kosong, memuat, galat sudah ada di dashboard tetapi tidak di landing, Tentang, dan Fitur. Tambahkan keadaan memuat (skeleton langit) dan galat jaringan di tiap permintaan cuaca.
- D7 **Panel "Alat desain"** menutupi konten di layar kecil. Pastikan dibuang atau disembunyikan di versi produksi.

### E. Gerak

- E1 Bakukan: tekan = skala .96 + pegas, masuk = 600 ms `--ease`, keluar = 260 ms, scene = 1,6 hingga 2,3 detik `--glide`.
- E2 Tiga loop `requestAnimationFrame` (karusel hero, langit, jam jadwal). Sudah berhenti saat tab tersembunyi. Tambahkan jeda saat baterai rendah (`navigator.getBattery` bila ada) dan saat `Save-Data`.
- E3 Animasi hitung mundur memakai satu pola gulir digit. Terapkan pola yang sama di angka saldo (kini hitung naik biasa) supaya seragam.
- E4 Uji performa di Android lama: karusel hero memakai `translate3d` + 8 kartu, awan memakai `filter`. Ukur dengan profiler sebelum rilis.

### F. Konten dan istilah

✅ Diperbaiki:
- Istilah peran: selalu **Wali Kelas** (sebelumnya sesekali "guru").
- CTA utama: **Buka kas kelas** (sebelumnya "Lihat kas kelas" dan "Buka kas kelas").
- Tombol **Masuk** di landing kini mengarah ke halaman masuk, bukan dashboard.
- Data contoh seragam di semua halaman: saldo **Rp 1.445.000**, **13 minggu**, iuran **24 dari 34**, **9 catatan**. Sebelumnya ada 1.284.000, 1.785.000, 17 minggu, 31/34, dan 48 transaksi.

Masih terbuka:
- F1 Tagline ada tiga ("seterang langit", "Kas yang terang, kelas yang tenang", "kas yang bisa dipercaya"). Pilih satu tagline dan satu kalimat pendukung.
- F2 Testimoni dan nama tim masih placeholder berlabel. Isi sebelum dipublikasikan.
- F3 Angka di dashboard bergantung pada tanggal hari ini (jadwal dinamis), sedangkan landing statis. Beri catatan "contoh" atau hubungkan dengan data yang sama saat dipasang ke aplikasi.
- F4 Panjang kalimat dan gaya kapital: judul memakai kapital kalimat, label kecil memakai huruf kapital berspasi. Pertahankan, tulis aturannya.

### G. Aksesibilitas

- G1 Target sentuh: banyak kontrol 34 hingga 40 px (`.btn--sm`, `.skybtn`, `.eye`, chip). Naikkan jadi minimal 44 px di layar sentuh (`@media (pointer: coarse)`). **P0**.
- G2 Fokus: cincin lime di atas langit dan biru di atas kertas sudah benar, tetapi tombol di kartu putih berlatar lime hampir tak terlihat. Tambah garis luar navy ganda. P1.
- G3 ✅ Dashboard kini punya `h1` tersembunyi dan tautan "Langsung ke isi" (juga di login dan 404).
- G4 Karusel hero perlu tombol jeda (WCAG 2.2.2) dan `aria-hidden` pada kartu di luar layar. **P0**.
- G5 Ada 47 tombol berisi ikon saja tanpa `aria-label` di sprite statis. Audit satu per satu; sebagian sudah ber-label lewat JS. P1.
- G6 Warna cuaca langit tidak mengubah teks, tetapi kontras teks putih di atas foto mendung terang perlu dites di tiap kondisi. P1.

### H. Performa dan aset

- H1 Total aset 1,5 MB (tanpa foto mentah). Foto cuaca dimuat hanya saat dibutuhkan, baik.
- H2 CSS 176 KB dan JS 144 KB belum diminify; GSAP hanya di landing. Saat dipasang, jalankan minify dan gabungkan menjadi dua berkas per rute.
- H3 `skyfx.js` menyuntik 12 lapisan per langit. Cukup bila tab aktif, tetapi pertimbangkan satu kanvas bila ada masalah.
- H4 Foto langit 2000 px dan 1000 px sudah ada; pertimbangkan AVIF.

### I. Arsitektur informasi

- I1 Peta halaman sudah jelas: Beranda, Fitur, Tentang, Dashboard, Masuk, 404/offline. Belum ada: **Cek keaslian** dan **Laporan SPJ**.
- I2 Alur masuk (landing → Masuk → login → dashboard) dan keluar sudah konsisten. Tambahkan tombol "Keluar" yang lebih terlihat di dashboard (kini hanya lewat label peran).
- I3 Jadwal iuran menjadi pola baru yang bagus untuk dipakai ulang di Laporan SPJ.

## 4. Urutan kerja yang disarankan

1. **Fondasi (P0):** pecah `components.css` dan hapus definisi ganda; seragamkan nav dan ikon; target sentuh 44 px; jeda karusel.
2. **Pembakuan (P1):** token breakpoint, warna turunan, radius, durasi; skala tipografi; gelapkan gradien terang; uji font `l`.
3. **Kelengkapan (P1):** Cek keaslian, SPJ, keadaan memuat dan galat, aturan tagline.
4. **Rilis (P2):** minify, AVIF, profiler Android, pasang ke template aplikasi, hapus Alat desain.

## 5. Yang sudah saya perbaiki di putaran ini

1. `css/tokens.css` sebagai satu sumber token, dimuat paling awal di enam halaman (menggantikan dua blok `:root` yang berbeda).
2. `--ok` digelapkan agar kontras tombol Setujui naik, `--ink-3` digelapkan untuk teks sekunder.
3. Token yang hilang di halaman landing ditambahkan (`--shadow-card`, `--line`, `--ok-bg`, `--paper-3`, `--sky-4`, dan lainnya).
4. Istilah Wali Kelas, CTA, dan tombol Masuk diseragamkan.
5. Data contoh diseragamkan di landing, Fitur, Tentang, dan dashboard.
6. `h1` tersembunyi dan tautan lewati ke isi di dashboard, login, dan 404.
7. Pengecekan: 182 tanggal di 6 bulan cocok dengan hitungan independen untuk jadwal; 100 skenario tata letak jadwal tanpa tabrakan; tanpa error di console.
