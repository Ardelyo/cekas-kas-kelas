# Jurnal Prompt CEKAS: dari Nol sampai V3

*Kelompok 5 · Kelas XI-F2 · SMA Kartika XIX-1 Bandung*

> **Catatan kejujuran.** Jurnal ini adalah **simulasi dari nol**: alurnya ditulis seolah proyek dimulai dari prompt pertama (riset → rencana → MVP). Pada kenyataannya, percakapan dimulai dari kode yang sudah ada, lalu dievaluasi. Prompt bertanda **[Simulasi]** adalah rekonstruksi; prompt bertanda **[Asli]** adalah kutipan persis dari percakapan. Hasil eksekusi (tes, angka, bug) semuanya nyata dan diambil dari sesi kerja.

---

## 0. Ringkasan satu halaman

| Versi | Fokus | Hasil utama | Tes |
|---|---|---|---|
| **Fase 0** | Riset + rencana | Keputusan stack pure Python, daftar fitur (25), prioritas MVP | - |
| **V1 (MVP)** | Pencatatan kas dasar | SQLite, CLI, bot, web, Excel, grafik | 6 |
| **V2 (Hardening)** | Keamanan dan integritas | PIN hash, lockout, atomik, hash chain, web login | 38 |
| **V3 (Produk)** | Fitur wow, cloud 24/7, desain, verifikasi guru | Usulan voting, insight, SPJ, GCS, Material 3 Expressive, Wali Kelas | **99** |

**Kesesuaian akhir dengan rancangan: 17/25 = 68% (strict), 18/22 = 82% (cakupan yang dipilih).** Rinciannya ada di bagian 5.

---

## 1. Fase 0: Riset dan perencanaan (sebelum menulis kode)

Prinsip kerja: **riset dulu, rencanakan, baru bangun MVP.** Tidak ada kode sebelum tiga hal ini jelas: masalah nyata, pesaing, dan batasan teknis.

### Prompt 0.1 · Riset masalah **[Simulasi]**
**Lengkap:**
> "Kami kelompok 5 kelas XI-F2 SMA Kartika XIX-1 Bandung. Uang kas kelas dicatat bendahara di buku tulis dan sering tidak jelas ke mana perginya. Riset dulu sebelum membangun apa pun: (1) bagaimana kas kelas biasanya dikelola dan apa masalahnya, (2) aplikasi pencatat kas yang sudah ada (kelebihan dan kekurangan), (3) proyek hackathon sejenis dan kriteria penilaiannya. Jangan langsung menulis kode. Beri saya temuan beserta sumbernya dan tandai mana yang belum terverifikasi."

**Ringkas:** *"Riset masalah kas kelas, aplikasi sejenis, dan kriteria hackathon. Sertakan sumber dan tandai yang belum pasti."*

**Hasil (nyata, dari riset web):**
- Kas kelas umumnya masih manual dan kurang transparan; aplikasi yang ada kebanyakan hanya **mencatat**, tanpa bukti yang bisa diperiksa orang lain.
- Hackathon Gemma 4 Good: bobot terbesar **Impact & Vision 40%** dan **Video Pitch 30%** (dari situs pihak ketiga, **belum terverifikasi** dengan halaman resmi Kaggle).
- Proyek Gemma lokal untuk keuangan (LocalLedger AI, GemmaFin) semuanya fokus **keuangan pribadi**. Kas kelas yang transparan untuk banyak orang adalah celah.

**Keputusan:** nilai jual utama = **transparansi yang bisa diverifikasi**, bukan sekadar pencatatan.

### Prompt 0.2 · Rencana arsitektur **[Simulasi]**
**Lengkap:**
> "Dari hasil riset itu, buat rencana arsitektur. Syarat: tetap **pure Python**, bisa jalan offline di laptop bendahara, murah. Bandingkan beberapa pilihan (database, antarmuka, hosting), beri rekomendasi dengan alasan, dan pecah fitur menjadi Must / Should / Could. Tentukan apa yang masuk MVP. Tulis sebagai dokumen, jangan kode."

**Ringkas:** *"Buat rencana arsitektur pure Python, offline-first. Bandingkan opsi, rekomendasikan, dan prioritaskan fitur untuk MVP."*

**Hasil:** dokumen `PYTHON_ARCHITECTURE_PLAN.md` (nyata). Berisi 25 fitur rancangan (daftar di bagian 5) dan tiga antarmuka: CLI, bot Telegram, web.

**Keputusan:**
- Database: **SQLite WAL** (satu berkas, ACID, mudah dicadangkan).
- Antarmuka: **bot Telegram** (semua siswa sudah punya) + **web dashboard**.
- MVP = fitur **Must** saja; fitur AI, suara, dan aplikasi desktop ditunda.

---

## 2. V1: MVP

### Prompt 1.1 · Bangun MVP **[Simulasi]**
**Lengkap:**
> "Bangun MVP sesuai rencana, hanya fitur Must: SQLite dengan transaksi atomik, 4 pos anggaran (operasional, sosial, acara, cadangan), catat pemasukan/pengeluaran, iuran mingguan per siswa, koreksi tanpa menghapus data, parser nominal gaya Indonesia (10k, 15rb, 1.5jt), CLI, bot Telegram, dashboard web, ekspor Excel dan grafik. Tulis tes untuk logika uang. Jalankan tesnya dan laporkan hasilnya apa adanya."

**Ringkas:** *"Bangun MVP fitur Must: kas, 4 pos, iuran, koreksi, parser nominal, CLI+bot+web, Excel+grafik, plus tes."*

**Hasil saat dijalankan:** MVP berjalan; 6 tes dasar lolos (format rupiah, parser, transaksi, iuran, koreksi, Excel + grafik).

### Prompt 1.2 · Evaluasi menyeluruh **[Asli]**
**Lengkap:**
> "lakukan full evaluasi, kritik, saran, dan lakukan riset berdasarkan hackathon projek ataupun projek projek atau aplikasi pencatatan uang kas lainnya, aku mau ini tetap pure python, lakukan pencarian kelemahan dan seluruhnya. carikan juga untuk menemukan wow factor atau hal sesuatu yang bagus untuk beneran bermanfaat."

**Ringkas:** *"Evaluasi penuh MVP: cari kelemahan, riset pesaing, tetap pure Python, cari wow factor."*

**Hasil saat dijalankan:** bukan sekadar dibaca, kelemahan **dibuktikan dengan skrip probe**:

| Temuan | Bukti saat dijalankan |
|---|---|
| Siapa pun jadi Bendahara | Daftar dengan NIS Tarina → `is_bendahara = True` |
| PIN bisa ditebak | 2.000 tebakan dalam 0,03 detik, tanpa lockout |
| Saldo bisa minus | Pengeluaran Rp 500.000 dari pos berisi Rp 0 diterima (saldo -490.000) |
| Koreksi iuran merusak data | Status "lunas" tetap menempel, tidak bisa dibayar ulang |
| Bayar iuran tidak atomik | Saat penulisan dibuat gagal, saldo tetap naik |
| Parser menebak | `1.5` → 15, `5000rb` → Rp 5.000.000 |
| Dokumentasi tidak sinkron | README menyebut berkas yang tidak ada |

**Keputusan:** hentikan fitur baru; **keamanan dan integritas dulu**. Ide wow dicatat untuk V3.

---

## 3. V2: Hardening (keamanan dan integritas)

### Prompt 2.1 **[Asli]**
**Lengkap:** > "execute lanjutkan"
**Ringkas:** *"Kerjakan perbaikan hasil evaluasi, mulai dari yang paling berbahaya."*

**Hasil saat dijalankan:**
- Peran Bendahara **hanya lewat PIN** (hash PBKDF2, lockout 15 menit setelah 5 salah). Satu NIS satu akun.
- Login web (cookie HttpOnly + SameSite), webhook wajib `secret_token`.
- Bayar iuran jadi satu transaksi atomik; koreksi iuran membuka kembali status lunas.
- Saldo tidak boleh minus per pos. Parser menolak bentuk ambigu.
- **Ledger hash chain** (SHA-256) + `verify`: mengubah satu baris langsung terdeteksi.
- Probe lama dijalankan ulang: impersonasi gagal, overdraft ditolak. **38 tes lolos.** Migrasi diuji di **salinan** database.

**Keputusan:** `cloud_sync` (Firestore) dibuang karena bertentangan dengan "zero-cloud" dan rawan menimpa data. Konsekuensinya: deploy cloud diblokir sampai ada penyimpanan persisten.

### Prompt 2.2 **[Asli]**
**Lengkap:** > "untuk pin: ... untuk password ..." (nilainya sengaja tidak ditulis di jurnal)
**Ringkas:** *"Set PIN Bendahara dan password web."*

**Hasil:** `.env` dan database diperbarui (dengan backup lebih dulu); ledger tetap terverifikasi. **Keputusan:** password dinilai **lemah**; diberi peringatan, keputusan ganti ada pada kelompok.

---

## 4. V3: Fitur wow, cloud 24/7, desain, verifikasi guru

### Prompt 3.1 · Semua fitur + cloud + desain **[Asli]**
**Lengkap:**
> "lanjutkan semuanya, aku juga butuh 24/7 cloud kalau bisa, dan juga aku mau semuanya working, desain lebih bagus tapi konsisten desain, make the desain web no ai slop, carikan skill deslop atau ui ux desain bagus, dan juga untuk telegram outputnya buat bagus dan konsisten dan interaktif."

**Ringkas:** *"Selesaikan semua fitur, cloud 24/7, desain web bagus dan konsisten, Telegram interaktif."*

**Hasil saat dijalankan:**
- Fitur baru: usulan belanja dengan voting siswa, insight (runway + anomali), rekap WhatsApp, laporan SPJ, pembaca nota via Ollama, QR.
- Cloud: replikasi SQLite ke Cloud Storage dengan `ifGenerationMatch` (instance basi tidak bisa menimpa). **Simulasi restart:** proses B memulihkan saldo Rp 123.000 dan ledger lolos.
- Bot Telegram: semua layar lewat satu sistem tampilan, navigasi tombol, wizard `/catat`, ketuk-nama-untuk-bayar.
- **62 tes → 73 tes** (setelah tes alur bot).
- Skill "deslop" **tidak ada**; dipakai panduan desain bawaan + hasil pencarian web.
- Deploy **diblokir pengaman**; kelompok menjalankannya sendiri.

**Keputusan:** satu instance Cloud Run (SQLite hanya boleh satu penulis). Bug nyata yang ditemukan: tombol deploy lama menganggap kredensial `gcloud` wajib padahal ADC lama masih valid.

### Prompt 3.2 · Deploy **[Asli]** (dijalankan kelompok)
**Lengkap:** > `python deploy_gcp.py`
**Ringkas:** *"Deploy ke Cloud Run."*

**Hasil saat dijalankan:** 6 tahap sukses; health OK, replikasi OK, webhook terpasang. **Temuan:** data cloud (10 transaksi, Rp 695.000) berbeda dari lokal (9 transaksi): ada satu transaksi uji di cloud. **Keputusan:** data cloud dianggap yang utama.

### Prompt 3.3 · Ganti desain **[Asli]**
**Lengkap:**
> "untuk desain gunakan playful desain emotion style, expressive desain, warna subtle google material design style expressive, dan easy to use for student or other and have a good dashboard or website or other output. friendly for student and more"

**Ringkas:** *"Ganti desain jadi Material 3 Expressive yang playful dan ramah siswa."*

**Hasil saat dijalankan:** tangkapan layar desktop dan mobile sesuai; kartu avatar untuk iuran, riwayat per hari, navigasi bawah, tombol aksi mengambang. **Bug nyata:** kelas CSS `.in` bentrok dengan `.in` pada nominal masuk (kotak aneh di baris koreksi) → diganti `.field`. 73 tes lolos.

**Keputusan:** arah "folio buku kas" yang sebelumnya dipakai **digantikan** sesuai kata pengguna. Laporan SPJ sengaja tetap formal.

### Prompt 3.4 · Tampilan lama masih muncul **[Asli]**
**Lengkap:** > "yang lama masih muncul euy susah. ctrl shift r juga ga bisa"
**Ringkas:** *"Desain lama masih tampil."*

**Hasil saat dijalankan:** dicek ke server: CSS live masih lama, artinya **deploy ulang belum dijalankan**, bukan masalah cache browser. Setelah deploy ulang, server menyajikan versi baru. **Perbaikan:** CSS/JS bertanda versi dan cache service worker dinaikkan.

### Prompt 3.5 · Verifikasi guru **[Asli]**
**Lengkap:**
> "aku melihat masalah di bagian verifikasi harus ada yaitu saat pengeluaran atau penambahan harus ada verifikasi guru."

**Ringkas:** *"Wajibkan verifikasi guru untuk setiap pemasukan dan pengeluaran."*

**Hasil saat dijalankan:** AI bertanya dulu (keputusan di bawah), lalu membangun peran Wali Kelas (PIN terpisah), antrean `pending_tx`, serta perintah `/klaimwali` dan `/verifikasi`. **16 tes verifikasi lolos; seluruh suite 99 tes lolos.**

**Keputusan kelompok:**
- Transaksi **ditahan** dan saldo baru berubah setelah guru setuju.
- Iuran diverifikasi guru **per minggu sekaligus**, agar guru tidak menyetujui 33 baris.
- Nama guru ikut terkunci di hash ledger. Koreksi juga butuh guru. Bendahara tidak bisa memverifikasi sendiri.

### Prompt 3.6 · Repositori **[Asli]**
**Lengkap:** > "push repo ini ke git dulu" → "jadikan repo privat dan repo nya kita buat baru aja" → "sudah, repo baru saja"
**Ringkas:** *"Push ke repo privat baru."*

**Hasil saat dijalankan:** Git dan `gh` dipasang, **pindai rahasia: 0 temuan**, repo privat `Ardelyo/cekas-kas-kelas` dibuat dan terkirim. Nama `cekas` ternyata sudah dipakai repo lama, jadi tidak ditimpa. **Keputusan:** roster siswa asli tetap di repo **privat**; jangan jadikan publik sebelum diganti nama samaran.

---

## 5. Pemeriksaan kode terhadap rancangan kelompok

Sumber rancangan: `PYTHON_ARCHITECTURE_PLAN.md` + README (25 fitur). Setiap fitur diperiksa terhadap kode akhir (keberadaan berkas, tes, dan hasil dijalankan).

| No | Fitur rancangan | V1 | V2 | V3 | Bukti di kode V3 |
|---|---|:-:|:-:|:-:|---|
| 1 | SQLite lokal WAL dan transaksi ACID | Ya | Ya | Ya | `database.py` |
| 2 | Idempotency pesan | Ya | Ya | Ya | `check_and_mark_message` |
| 3 | RBAC whitelist NIS dan PIN | Ya | Ya | Ya | `_claim_role` |
| 4 | Perintah bot inti | Ya | Ya | Ya | `bot.py` |
| 5 | Notifikasi ke anggota | Ya | Ya | Ya | `broadcast_tx` |
| 6 | Koreksi append-only | Ya | Ya | Ya | `_reverse_core` |
| 7 | Iuran mingguan per siswa | Ya | Ya | Ya | `_dues_core` |
| 8 | Parser nominal dan kategori | Ya | Ya | Ya | `formatters.py` |
| 9 | Excel multi-sheet dengan SUM | Ya | Ya | Ya | `export_excel.py` |
| 10 | Grafik alokasi ke Telegram | Ya | Ya | Ya | `generate_chart.py` |
| 11 | Laporan SPJ resmi | Tidak | Tidak | Ya | `report.py` (HTML cetak, bukan PDF langsung) |
| 12 | Web dashboard dan PWA | Ya | Ya | Ya | `web.py`, `sw.js` |
| 13 | Prakiraan runway | Tidak | Tidak | Ya | `insights.py` |
| 14 | Deteksi anomali | Tidak | Tidak | Ya | `insights.py` |
| 15 | Foto nota OCR lokal | Tidak | Tidak | Ya | `receipt_ai.py` (diuji dengan Ollama palsu) |
| 16 | Replikasi atau cadangan cloud | Ya | Tidak | Ya | V1: Firestore; V2: dibuang; V3: `gcs_store.py` |
| 17 | Tes otomatis | Ya | Ya | Ya | 99 tes |
| 18 | Matriks atau heatmap iuran | Tidak | Tidak | Tidak | diganti kartu avatar |
| 19 | NLP bahasa natural (LLM) | Tidak | Tidak | Tidak | tidak ada |
| 20 | Voice note ke transaksi | Tidak | Tidak | Tidak | tidak ada |
| 21 | Prediktor keterlambatan iuran | Tidak | Tidak | Tidak | tidak ada |
| 22 | Telegram Mini App | Tidak | Tidak | Tidak | tidak ada |
| 23 | Aplikasi desktop (exe) | Tidak | Tidak | Tidak | tidak ada |
| 24 | TUI Textual | Tidak | Tidak | Tidak | tidak ada |
| 25 | SQLModel dan `pyproject.toml` | Tidak | Tidak | Tidak | sengaja tidak (pure `sqlite3`) |

### Perhitungan (strict: seluruh 25 fitur)
- **V1:** 13 ÷ 25 × 100% = **52%**
- **V2:** 12 ÷ 25 × 100% = **48%** (turun karena replikasi Firestore dibuang demi keamanan, padahal kualitas naik)
- **V3:** 17 ÷ 25 × 100% = **68%**

Target 80% **belum tercapai** pada hitungan strict.

### Perhitungan (cakupan yang dipilih kelompok)
Fitur 22, 23, 24 adalah platform alternatif yang tidak dipilih, dan fitur 25 adalah keputusan sengaja tetap memakai `sqlite3`. Fitur "verifikasi guru" ditambahkan sebagai kebutuhan baru (terverifikasi: ada `/klaimwali`, `/verifikasi`, antrean `pending_tx`, dan 16 tes).

- Fitur terhitung: 25 − 4 (alternatif/sengaja) + 1 (verifikasi guru) = **22**
- Fitur sesuai: 17 + 1 = **18**
- **V3: 18 ÷ 22 × 100% = 82%** → **melampaui target 80%**

> **Peringatan.** Angka 82% bergantung pada keputusan mengeluarkan empat fitur. Itu sah hanya jika kelompok memang sepakat. Jika tidak, angka resminya 68%. Penilaian "Ya/Tidak" ini adalah penilaian saya atas kode; kelompok sebaiknya memeriksa ulang.

---

## 6. Yang belum teruji (jujur)
- **Bot di Telegram sungguhan** belum diuji; alurnya diuji dengan objek Update tiruan.
- **Foto nota** belum dijalankan dengan model asli.
- **Mode gelap** belum dilihat langsung; lebar layar di bawah 500px belum dicek.
- **Alur guru di Telegram sungguhan** (klaim PIN, tombol verifikasi) belum dicoba; hanya lewat tes.
- **Password web** masih lemah sementara dashboard bersifat publik.

---

## 7. Pelajaran dari cara kerja

1. **Riset dan rencana dulu, MVP kemudian.** Keputusan terbesar (transparansi sebagai nilai jual, pure Python, SQLite) diambil **sebelum** satu baris kode.
2. **Bukti, bukan klaim.** Setiap bug dibuktikan dengan skrip, dan setiap perbaikan dibuktikan dengan probe yang sama dijalankan ulang.
3. **Keamanan sebelum fitur.** V2 sengaja menghentikan fitur baru sampai celah paling berbahaya tertutup.
4. **Jujur soal batas.** Deploy yang diblokir, tes dengan objek tiruan, dan angka kesesuaian yang tergantung keputusan semuanya dicatat apa adanya.
5. **Pengguna yang memutuskan arah.** Desain diganti total, verifikasi guru diwajibkan, dan repo dibuat baru karena kata kelompok.

---

## 8. Prompt tunggal ringkas (untuk mengulang dari nol)

**Lengkap:**
> "Riset dulu kas kelas, aplikasi sejenis, dan kriteria hackathon, lalu buat rencana arsitektur pure Python offline-first dan prioritaskan MVP. Bangun MVP: SQLite WAL, 4 pos, iuran, koreksi append-only, parser nominal Indonesia, CLI + bot Telegram + web, Excel + grafik, dan tes. Setelah itu evaluasi sendiri dengan skrip bukti, perbaiki keamanan (PIN ber-hash dan lockout, satu NIS satu akun, login web, secret webhook, transaksi atomik, ledger hash chain), lalu tambah: Wali Kelas via PIN terpisah yang wajib memverifikasi semua pemasukan/pengeluaran/koreksi (iuran per minggu), usulan belanja besar divoting siswa, bot Telegram interaktif, dashboard publik bergaya Material 3 Expressive yang ramah siswa, rekap WhatsApp, laporan SPJ, prakiraan saldo, replikasi SQLite ke Cloud Storage untuk Cloud Run satu instance, dan tes otomatis. Laporkan hasil tes apa adanya dan tandai yang belum teruji."

**Ringkas:**
> *"Riset → rencana → MVP kas kelas pure Python → evaluasi dan perketat keamanan → tambah verifikasi guru, voting, bot interaktif, dashboard Material 3 Expressive, SPJ, cloud 24/7 → tes dan laporan jujur."*
