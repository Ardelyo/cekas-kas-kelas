# CEKAS — Buku Kas Kelas yang Terbuka dan Bisa Diverifikasi
*Kelompok 5 — Kelas XI-F2 SMA Kartika XIX-1 Bandung · Pure Python 3.11+*

Uang kas kelas biasanya dicatat di satu buku yang hanya dipegang Bendahara. CEKAS membuat catatan itu **terbuka untuk semua siswa** dan **tidak bisa diubah diam-diam**.

## Yang membuatnya berbeda
- **Buku kas anti-manipulasi.** Setiap transaksi memuat hash SHA-256 yang mengikat transaksi sebelumnya. Mengubah atau menghapus satu baris membuat lencana **Terverifikasi** berubah menjadi **Perlu diperiksa** (web, `/cek` di bot, atau `python run.py verify`).
- **Terbuka untuk semua.** Dashboard publik read-only, ada kode QR untuk ditempel di kelas. Hanya Bendahara yang bisa mencatat.
- **Verifikasi Wali Kelas.** Semua pemasukan, pengeluaran, iuran, dan koreksi **ditahan** sampai guru menyetujui; saldo baru berubah setelah itu. Iuran diverifikasi per minggu sekaligus (satu ketukan). Nama guru ikut terkunci di hash transaksi. Antrean terlihat publik.
- **Pengeluaran besar perlu persetujuan.** Belanja ≥ Rp 50.000 (atur lewat `APPROVAL_THRESHOLD`) menjadi *usulan* yang dikirim ke siswa lewat bot; dicatat otomatis setelah 3 siswa setuju.
- **Rekap siap tempel ke WhatsApp**, plus teks pengingat iuran yang sopan.
- **Prakiraan saldo** ("cukup sekitar 17 minggu") dan peringatan input ganda atau belanja janggal, dihitung dengan statistik biasa.
- **Laporan SPJ** siap cetak (Cetak → Simpan sebagai PDF) dengan kolom tanda tangan Wali Kelas dan kode verifikasi.
- **Foto nota → draf pengeluaran** (opsional, model vision lokal via Ollama, mis. Gemma). Selalu minta konfirmasi Bendahara.
- **Offline-first.** Font ditanam sendiri, tanpa CDN. SQLite lokal, tanpa layanan eksternal.

## Menjalankan lokal
```bash
pip install -r requirements.txt
cp .env.example .env          # isi PIN_BENDAHARA, WEB_ADMIN_PASSWORD, TELEGRAM_BOT_TOKEN
python run.py seed            # roster contoh + transaksi awal (opsional)
python run.py all             # web http://127.0.0.1:8000 + bot Telegram
```
Perintah lain: `status`, `tambah`, `kurang`, `verify`, `backup`, `set-pin`, `export-excel`, `export-chart`, `web`, `bot`.

## Bot Telegram
Semua layar memakai tampilan yang sama dan bisa dinavigasi dengan tombol (menu, riwayat berhalaman, tagihan per minggu, voting usulan). Perintah: `/start /saldo /riwayat /tagihan /usulan /insight /rekap /grafik /excel /cek /daftar /profil /notif`. Wali Kelas: `/klaimwali`, `/verifikasi`. Bendahara: `/catat` (wizard tombol), `/tambah`, `/kurang`, `/bayar` (ketuk nama), `/koreksi`, `/spj`, `/lepas`. Kirim foto nota di chat pribadi untuk draf otomatis.

## Jalan 24/7 di Google Cloud Run
```bash
python deploy_gcp.py --dry-run    # cek konfigurasi, tidak mengubah apa pun
gcloud auth application-default login
python deploy_gcp.py              # deploy
```
Database SQLite direplikasi ke bucket Cloud Storage (**versioning aktif**) setiap ada perubahan dan dipulihkan saat instance restart. Cloud Run dipasang **1 instance** (SQLite hanya boleh punya satu penulis); unggahan memakai `ifGenerationMatch` sehingga instance basi tidak bisa menimpa data yang lebih baru. Biaya: satu instance selalu aktif; cek harga Cloud Run dan Storage untuk region Anda.

## Verifikasi Wali Kelas
1. Atur PIN guru: isi `PIN_WALI` di `.env`, atau `python run.py set-wali-pin <PIN>` (minimal 6 karakter, harus berbeda dari PIN Bendahara).
2. Guru membuka bot lalu mengetik `/klaimwali <PIN>` di chat pribadi. Guru tidak bisa memberi suara usulan dan tidak dikenai iuran.
3. Bendahara mencatat seperti biasa (bot, web, atau CLI). Pengajuan masuk antrean dan guru mendapat notifikasi dengan tombol **Setujui / Tolak**. Iuran menumpuk per minggu dan diverifikasi dengan satu tombol.
4. Pengeluaran besar: siswa memberi suara lebih dulu; setelah kuorum tercapai, usulan masuk antrean guru.
5. Bendahara tidak bisa menyetujui pengajuannya sendiri. Jika saldo berubah sebelum disetujui, pengajuan berstatus *gagal* dan tidak mencatat apa pun.

Mematikan fitur ini: `TEACHER_VERIFICATION=0`. Tanpa `PIN_WALI` saat fitur aktif, antrean tidak bisa dibuka siapa pun (aplikasi memberi peringatan, dan `deploy_gcp.py` menolak deploy).

## Keamanan
Peran Bendahara hanya lewat PIN (hash PBKDF2, kunci 15 menit setelah 5 salah). Satu NIS = satu akun Telegram. Login web memakai cookie HttpOnly + SameSite=Strict. Webhook wajib `secret_token`. Saldo tidak boleh minus per pos. Koreksi tidak menghapus data, hanya menambah catatan baru.

## Tes
```bash
pip install httpx
python -m unittest discover -s tests -t .      # 99 tes: keamanan, ledger, web, bot, usulan, verifikasi guru, replikasi
python -m unittest cekas_core.test_core
```
Tes memakai database sementara dan server palsu untuk Cloud Storage dan Ollama; tidak menyentuh `cekas.db` maupun Telegram sungguhan.

## Struktur
```
cekas_app/
  database.py   ledger, hash chain, usulan, iuran         tg_ui.py      layar Telegram (murni)
  bot.py        handler bot + tombol                       web.py        FastAPI: publik + admin
  insights.py   runway & anomali                           viewmodel.py  data tampilan web
  recap.py      teks WhatsApp                              report.py     laporan SPJ
  gcs_store.py  replikasi Cloud Storage                    receipt_ai.py pembaca nota (Ollama)
  templates/ static/ (cekas.css, app.js, fonts/)
tests/  deploy_gcp.py  Dockerfile
```
Font: IBM Plex Sans & Mono (SIL OFL).
