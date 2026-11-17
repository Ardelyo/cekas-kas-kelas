# Tanggung Jawab, Sumber, dan Batasan CEKAS

Dokumen ini menjelaskan apa yang menjadi inti sistem, apa yang hanya tampilan, siapa/apa yang membuat tiap bagian, dan apa yang belum final. Tujuannya: siapa pun (guru, juri, teman sekelas) bisa menelusuri dan menilai proyek ini dengan jujur.

## 1. Dua lapisan, satu sumber kebenaran

| Lapisan | Isi | Peran |
|---|---|---|
| **Inti (Python)** | `cekas_app/`, `cekas_core/`, `run.py`, `tests/` (sekitar 4.600 baris Python) | **Sumber kebenaran.** Saldo, buku kas berantai hash SHA-256, verifikasi Wali Kelas, iuran, usulan belanja, login, batas percobaan, bot Telegram, ekspor, backup. |
| **Tampilan (desain "Langit")** | `design/` (HTML, CSS, JavaScript biasa, sekitar 4.800 baris) | **Hanya presentasi.** Tidak menghitung uang dan tidak memutuskan hak akses. |

Aturan yang dijaga:
- Semua angka uang, status verifikasi, dan hak akses dihitung/diputuskan **di server Python**. Desain hanya menampilkan dan mengirim permintaan.
- Penghubungnya: `cekas_app/langit.py` (modul terpisah, sekitar 120 baris) dan 6 baris di akhir `cekas_app/web.py`. Halaman lama (`/`, `/login`, `/laporan`, bot) **tidak diubah** dan tetap berjalan tanpa desain baru.
- Login Bendahara/Wali Kelas, batas 5 percobaan lalu kunci 15 menit, cookie sesi, dan notifikasi Telegram semuanya memakai kode yang sama dengan halaman lama.
- Menghapus `design/` dan `langit.py` mengembalikan sistem ke bentuk sebelumnya tanpa memengaruhi Python.

## 2. Dua cara menjalankan desain

| Mode | Alamat | Data | Login |
|---|---|---|---|
| **Terhubung server** | `/langit/` di server Python (`python run.py web` atau Docker) | **Nyata**, dari database yang sama dengan bot | **Nyata**, divalidasi server |
| **Prototipe statis** | Situs di Vercel (hosting statis) | **Fiktif** (contoh) | **Palsu**, hanya untuk menguji tampilan |

Situs di Vercel adalah **prototipe desain**, bukan sistem produksi. Sandi contoh di sana tidak melindungi apa pun karena memang tidak ada data nyata.

## 3. Siapa/apa yang membuat

- **Inti Python:** dikembangkan oleh Kelompok 5, kelas XI-F2, SMA Kartika XIX-1 Bandung (lihat riwayat git dan `JURNAL_PROMPT_CEKAS.md`).
- **Desain "Langit" (HTML/CSS/JS), halaman statis, dan modul `langit.py`:** **dihasilkan dengan bantuan AI** (Claude, Anthropic) berdasarkan arahan tim, lalu diperiksa dan disetujui secara bertahap. Arahan visual (langit, biru, tanpa warna pink/oranye, mobile-first, tampilan lega) dari tim. Kode ditulis oleh AI.
- **Yang diputuskan manusia:** arah dan selera desain, isi cerita, nama tim, dan apa yang dipublikasikan. **Yang dikerjakan AI:** penulisan kode, pengolahan foto, tata letak, animasi, pengujian otomatis.
- Pengembang wajib memahami dan bisa menjelaskan kode yang dipakai. Kalau ada bagian yang belum dipahami, jangan diklaim sebagai buatan sendiri.

## 4. Pihak ketiga dan lisensi

| Aset | Sumber | Lisensi |
|---|---|---|
| Foto langit (hero) | Lance Vanlewen, Wikimedia Commons | CC BY-SA 4.0 |
| Foto awan mendung | Ranjithsiji, Wikimedia Commons | CC BY-SA 4.0 |
| Foto petir | Muhammadphoto, Wikimedia Commons | CC BY-SA 4.0 |
| Foto langit berbintang | Kulish Kateryna, Wikimedia Commons | CC BY 4.0 |
| Font Inter Tight | The Inter Project Authors, via Fontsource | SIL OFL 1.1 |
| Font Bricolage Grotesque | Mathieu Triay (proyek Bricolage) | SIL OFL 1.1 |
| GSAP 3.12 (animasi, disimpan lokal di `design/assets/vendor/`) | GreenSock | Lisensi standar GSAP (gratis) |
| Cuaca sekitar (opsional, mati secara bawaan) | Open-Meteo | Hanya koordinat kasar (±11 km) yang dikirim, dengan izin pengguna |

Foto sudah diubah ukuran dan warnanya. Kredit tercantum di halaman dan di `design/assets/*/credits.json`. Tidak ada CDN dan tidak ada pelacak.

## 5. Pengujian

- **Python:** 115 tes otomatis di `tests/` (`python -m unittest discover -s tests -t .`), lulus saat dokumen ini ditulis.
- **Desain:** pengujian jadwal (182 tanggal di 6 bulan), tata letak, target sentuh, dan alur dilakukan dengan skrip sementara yang **tidak disimpan di repo**. Ini bagian yang paling lemah: perilaku desain belum dilindungi tes yang bisa dijalankan ulang oleh siapa saja.
- **Belum diuji:** perangkat Android lama, iOS Safari, dan mode terhubung server di browser nyata dengan data kelas sungguhan.

## 6. Yang masih contoh atau belum final

- Nama anggota tim dan peran di halaman Tentang (placeholder "Nama anggota").
- Testimoni di landing (contoh teks berlabel, bukan kutipan asli).
- Cerita di halaman Tentang ditulis dari README dan perlu disesuaikan.
- Data contoh di desain statis (saldo, iuran, nama siswa) fiktif.
- Aksi tulis dari desain (catat, setujui, tandai lunas) hanya aktif di mode terhubung server dan belum diuji di browser dengan data sungguhan.
- Pengingat batas bayar otomatis lewat Telegram dan tautan bot ke `/langit/` belum dibuat.
- Aturan "tanpa JavaScript buatan sendiri" tidak terpenuhi: desain memakai sekitar 2.000 baris JS. Kalau sekolah mensyaratkan Python murni, pilih jalan kembali ke templat Jinja lama (lihat bagian 7).

## 7. Cara mundur

1. **Kembali ke versi lama sepenuhnya:** `git revert` PR #2 (integrasi Langit), atau hapus `design/`, `cekas_app/langit.py`, dan 6 baris terakhir `web.py`. Python tidak terpengaruh.
2. **Matikan hanya situs desain publik:** hapus proyek di Vercel atau nonaktifkan deploy dari `main`.
3. **Hentikan mode terhubung server tanpa menghapus desain:** hapus pemasangan `_langit.setup(app, ...)` di `web.py`. `/langit` dan `/api/langit/*` hilang, rute lama tetap.

## 8. Keamanan singkat

- Validasi, sesi, dan batas percobaan ada di server; klien tidak dipercaya.
- Saldo per pos tidak boleh minus dan koreksi tidak menghapus data (aturan lama tetap berlaku).
- Cookie sesi: `HttpOnly`, `SameSite=Strict`, `Secure` bila HTTPS.
- Jangan unggah `.env`, `cekas.db`, atau `backups/` ke tempat publik. Repo mengabaikannya lewat `.gitignore`.
- Cuaca opsional: tanpa izin lokasi pengguna, tidak ada permintaan ke luar.
