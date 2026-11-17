# CEKAS "Langit" — Daftar Halaman, Alur, dan Ide Interaksi

Dasar: rute dan template nyata di `cekas_app/web.py` dan `templates/` (dashboard, login, report), plus fitur di README (verifikasi Wali Kelas, usulan belanja, iuran per minggu, SPJ, QR, rekap WhatsApp).
Aturan desain tetap: palet langit saja (tanpa pink/oranye/ungu), mobile-first, offline-first (font dan aset lokal), semua gerak mati di `prefers-reduced-motion`.
Status: ✅ sudah ada di prototipe · 🔜 berikutnya · 💡 opsional.

---

## A. Halaman penuh (URL)

| # | Halaman | Rute nyata | Siapa | Isi utama | Status |
|---|---|---|---|---|---|
| 1 | **Intro** | overlay di `/` | umum | Langit malam → siang, wordmark, lewati | ✅ |
| 2 | **Landing** | `/` (belum ada; sekarang `/` = dashboard) | umum | Hero, pernyataan, fitur, coba hash, cara kerja, penutup | ✅ |
| 3 | **Dashboard publik** | `/` atau `/kas` | semua siswa | Lihat bagian B | ✅ (`design/kas.html`) |
| 4 | **Login Bendahara** | `/login` | Bendahara | Satu kolom kata sandi, status kunci 15 menit | 🔜 |
| 5 | **Login Wali Kelas** | `/guru/login` | Guru | Satu kolom PIN, terpisah dari sesi Bendahara | 🔜 |
| 6 | **Laporan SPJ** | `/laporan` | Bendahara/Guru | Kertas siap cetak, tanda tangan, kode verifikasi | 🔜 |
| 7 | **Cek keaslian** | `/cek` (halaman untuk `/api/ledger/verify`) | umum | Hasil verifikasi rantai hash besar, bisa dibagikan | 🔜 |
| 8 | **Tentang / Tim** | `/tentang` | umum, juri | Kelompok 5 XI-F2, cara kerja keamanan, kredit foto & font | 💡 |
| 9 | **Offline** | dilayani `sw.js` | semua | "Kamu sedang offline", tampilkan saldo terakhir yang tersimpan | 🔜 |
| 10 | **404 / Error** | otomatis | semua | Awan tersesat, tombol kembali | 🔜 |
| 11 | **Terkunci** | respons login 429/423 | Bendahara/Guru | Hitung mundur sisa kunci 15 menit | 🔜 |

## B. Bagian di dalam Dashboard publik (satu halaman, banyak seksi)

Urutan mengikuti `dashboard.html`. Dibuat sebagai satu halaman gulir dengan navigasi bawah di HP.

1. **Langit saldo (ringkasan).** Latar langit dengan "cuaca kas", total saldo besar, selisih minggu ini, lencana Terverifikasi/Perlu diperiksa, prakiraan "cukup ±17 minggu".
2. **Pos anggaran** ("Uangnya dipakai buat apa?"). Operasional, Sosial, Event, Cadangan: saldo per pos, bar/cincin, warna biru berbeda (tanpa pink/oranye).
3. **Tahu nggak?** (insight). Kartu satu kalimat: peringatan input ganda, belanja janggal, tren.
4. **Menunggu guru.** Antrean pengajuan yang belum disahkan; mode Guru menampilkan tombol Setujui/Tolak dan Setujui semua minggu.
5. **Usulan belanja.** Belanja ≥ Rp 50.000 yang menunggu suara siswa (kuorum 3). Tampilan baca di web, suara lewat bot.
6. **Iuran kas.** Kisi siswa × minggu, status lunas/belum, navigasi minggu (`?week=`), mode Bendahara bisa centang.
7. **Riwayat kas.** Daftar transaksi terbaru, tiap baris ada sidik jari hash, filter masuk/keluar/pos.
8. **Ajak teman-teman.** Kode QR, salin tautan, rekap siap tempel ke WhatsApp, pengingat iuran sopan.
9. **Bilah tindakan** (Bendahara/Guru): tombol Catat, SPJ, Excel, grafik, Keluar.

## C. Sheet, modal, dan komponen layar

- **Catat kas** (pemasukan/pengeluaran): nominal, pos, keterangan, foto nota (draf dari model vision, wajib konfirmasi).
- **Konfirmasi** ("Yakin?"): untuk koreksi, tolak, batalkan; tombol bahaya tahan-lama (tahan 0,8 dtk).
- **Bayar iuran**: pilih siswa dan minggu, bayar banyak sekaligus.
- **Koreksi transaksi**: membalik tanpa menghapus, menambah baris baru yang menjelaskan.
- **Detail transaksi**: hash, hash sebelumnya, siapa mencatat, siapa menyetujui (nama guru ikut terkunci).
- **Sheet bagikan**: QR besar, salin tautan, bagikan rekap WA.
- **Panel pengajuan guru**: daftar tunggu, ringkasan per minggu.
- **Toast / snackbar**, **skeleton** (kerangka memuat), **empty state**, **error state**, **banner offline**, **dialog instal PWA**.
- **Gaya cetak** untuk SPJ (hitam-putih, tanpa gerak).

## D. Alur utama (cek kesinambungan layar)

1. **Siswa baru:** scan QR → Intro (sekali) → Dashboard publik → scroll ke Iuran → temukan namanya.
2. **Bendahara mencatat:** Login → Dashboard → Catat → konfirmasi → baris masuk "Menunggu guru" (saldo belum berubah).
3. **Wali Kelas mengesahkan:** Login Guru → "Menunggu guru" → Setujui (atau Setujui semua minggu) → saldo berubah, lencana tetap hijau.
4. **Pengeluaran besar:** Bendahara catat → jadi usulan → siswa memberi suara lewat bot → kuorum → masuk antrean guru.
5. **Verifikasi publik:** Dashboard/Landing → Cek keaslian → rantai utuh atau "mulai baris N".
6. **Akhir periode:** Bendahara → SPJ → cetak/PDF → tanda tangan.
7. **Gagal:** salah PIN berulang → layar Terkunci; koneksi hilang → Offline.

---

## E. Sistem desain yang perlu dibuat (sebelum halaman lain)

- **Token:** warna langit (`--sky-1..3`, `--sky-deep`, `--sky-night`), kertas, tinta, status (ok hijau, bad merah, netral abu-biru), lime hanya aksen.
- **Tipografi:** Inter Tight variabel (judul rapat, isi), Bricolage hanya wordmark, angka tabular.
- **Bentuk:** sudut 14/24/32/44, pil untuk aksi, kartu putih di atas langit.
- **Gerak:** durasi 120/240/480/900 ms, kurva `--ease` dan `--spring`, aturan "satu gerak utama per layar".
- **Komponen:** tombol (lime/gelap/kaca/ghost), chip, lencana, kartu saldo, bar/cincin pos, baris transaksi, sel iuran, toggle, sheet bawah, dialog, toast, input nominal, tab minggu, nav bawah (HP) / nav pil (desktop), skeleton, empty state, ikon (set garis satu bobot).

---

## F. Ide mikro-interaksi dan interaktivitas

### F1. Sistem langit (identitas utama)
1. **Cuaca kas:** langit dashboard mengikuti kesehatan saldo. Cerah dan awan putih bila prakiraan > 12 minggu, berawan tipis 6–12 minggu, awan abu-biru rendah bila < 6 minggu. Hanya biru, putih, dan abu-biru.
2. **Jam langit:** warna latar halus mengikuti jam perangkat (pagi biru muda, siang biru jenuh, malam biru tua). Tetap dalam keluarga biru.
3. **Awan parallax** (sudah ada di hero) dipakai ulang di header dashboard, lebih tipis supaya data tetap terbaca.
4. **Pull-to-refresh:** menarik ke bawah membuat awan "terbelah", lalu menutup saat data baru masuk.
5. **Transisi halaman:** halaman lama "terangkat" seperti tirai intro (cukup 300 ms) dengan awan lewat.
6. **Gulir menurunkan langit:** header mengecil dan langit memudar jadi kertas, pola yang sama dengan hero.
7. **Skeleton langit:** kerangka memuat berupa kilau lembut seperti cahaya melintas di awan.
8. **Pointer parallax** di desktop, **gyro** halus di HP (izin opsional, bisa dimatikan).

### F2. Angka dan uang
9. Saldo menghitung naik/turun saat berubah, digit bergulir seperti odometer.
10. Tombol mata menyembunyikan saldo (jadi titik), disimpan lokal.
11. Selisih minggu ini muncul sebagai pil hijau/merah yang "pop" sekali.
12. Prakiraan saldo: garis proyeksi digambar bertahap, titik habisnya berkedip pelan.
13. Cincin pos terisi saat terlihat, hover/tap memperbesar satu pos dan meredupkan yang lain.
14. Sparkline bisa disentuh: titik mengikuti jari dan menampilkan nilai pada hari itu.

### F3. Buku kas dan keaslian (nilai jual utama)
15. **Rantai hash visual:** setiap baris menyambung ke yang sebelumnya dengan garis kecil; saat verifikasi, cahaya putih menyapu dari atas ke bawah (sudah ada di demo).
16. **Lencana Terverifikasi** berdenyut sekali setelah sapuan; bila putus, bergetar dan titik putus disorot.
17. **Tekan lama baris** untuk melihat hash penuh dan menyalinnya; haptic ringan di HP.
18. **Bandingkan dengan sebelumnya:** menggeser baris memperlihatkan hash sebelumnya dan alasan baris ini sah.
19. **Mode "kenapa ini aman":** tombol kecil memutar animasi 5 detik menjelaskan rantai (untuk juri dan guru).
20. **Koreksi** ditampilkan sebagai baris baru yang menyambung ke baris lama dengan garis putus-putus (data tidak pernah dihapus).

### F4. Wali Kelas (verifikasi)
21. **Geser untuk menyetujui** per baris, **tahan 0,8 detik** untuk menolak (cincin terisi).
22. **Setujui semua iuran minggu ini**: satu ketukan, sel-sel iuran berubah lunas berurutan seperti gelombang.
23. Setelah disetujui, baris "terbang" dari antrean ke Riwayat dan saldo menghitung ulang.
24. Nama guru ikut muncul di lencana baris ("disahkan oleh …") dengan efek segel menempel.
25. Haptic dan getaran lembut hanya pada aksi yang tidak bisa dibatalkan.

### F5. Bendahara (input)
26. **Input nominal** dengan keypad besar, pemisah ribuan otomatis, tombol cepat (+5.000, +10.000, iuran penuh).
27. **Foto nota → draf:** pindai dengan bingkai yang "mengunci" ke tepi nota, kolom terisi satu per satu, wajib konfirmasi.
28. **Centang iuran** dengan efek tanda centang tergambar, siswa lunas berurutan; undo toast 5 detik.
29. **Kunci otomatis:** hitung mundur sisa kunci 15 menit dengan jam awan, bukan angka merah menakutkan.
30. Tombol Simpan tidak aktif sampai data valid; pesan galat langsung di bawah kolom, bukan di akhir.

### F6. Siswa (membaca dan terlibat)
31. **Cari nama** di Iuran dengan sorotan baris dan lompat otomatis ke minggu yang belum lunas.
32. **Usulan belanja:** bilah suara terisi, kuorum 3 ditandai tiga titik yang menyala satu per satu.
33. **"Tahu nggak?"** sebagai kartu yang bisa dibalik; tiap kartu satu fakta pendek.
34. **Bagikan:** salin tautan memberi toast "Tersalin" dan ikon berubah jadi centang; rekap WA tampil pratinjau gelembung chat.
35. **QR** besar dengan tepi awan; tahan untuk menyimpan sebagai gambar.

### F7. Navigasi dan umpan balik
36. **Nav bawah di HP** dengan indikator geser dan pegas; ikon aktif mengisi.
37. **Nav pil** (desktop) mengecil, menyembunyi saat gulir turun, muncul saat naik (sudah ada).
38. **Bagian aktif** disorot saat digulir (scroll-spy) di nav samping/tab.
39. **Toast** dengan tombol Urungkan; menumpuk rapi, hilang sendiri, bisa disapu.
40. **Tombol** punya tekan (skala 0.96), pegas kembali, dan magnet halus di desktop (sudah ada).
41. **Fokus keyboard** jelas (cincin lime + tepi), urutan tab logis, pintasan (`/` cari, `c` catat).
42. **Offline:** banner kecil turun dari atas, data terakhir tetap bisa dibaca, antrean aksi menunggu.

### F8. Jiwa dan kejutan kecil (hemat, jangan berlebihan)
43. Easter egg: ketuk logo awan 3x, awan lewat dan wordmark berubah sebentar.
44. Pesan kosong yang ramah ("Belum ada pengeluaran. Langit cerah.") dengan awan kecil bergerak pelan.
45. Saat saldo naik rekor, cahaya putih lembut menyapu header (tanpa konfeti).
46. Salam sesuai jam dan peran ("Selamat pagi, Bendahara").
47. Lencana pencapaian kelas bernada tenang ("8 minggu iuran penuh") berbentuk awan, bukan medali.

---

## G. Urutan pengerjaan yang saya sarankan

1. **Sistem desain + komponen dasar** (token, tombol, kartu, baris, sheet, toast) di `design/`.
2. **Dashboard publik** (halaman paling sering dibuka siswa) dengan cuaca kas.
3. **Login Bendahara dan Guru** (dua layar sederhana, polesan tinggi).
4. **Alur Catat kas + konfirmasi + antrean guru** (inti nilai CEKAS).
5. **Cek keaslian + detail transaksi** (bukti anti-manipulasi).
6. **SPJ cetak, Offline, 404, Terkunci.**
7. **Pasang ke template Jinja** (`base.html`, `dashboard.html`, `login.html`, `report.html`) setelah desain statis disetujui.

Prinsip tiap putaran: satu halaman, dites di HP, baru lanjut. Semua teks demo tetap fiktif dan berlabel "contoh".
