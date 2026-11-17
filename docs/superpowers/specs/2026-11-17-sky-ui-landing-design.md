# CEKAS "Langit" — Desain UI/UX: Intro + Landing Page

Branch: `design/sky-ui` · Folder: `design/` (HTML/CSS/JS statis, tanpa build, tanpa Python)
Status: prototipe desain untuk dites dan dinilai. Belum menyentuh `cekas_app`.

## Intent
CEKAS menjual satu hal: **kas kelas yang terang, tidak ada yang disembunyikan**. Metafora desainnya adalah langit cerah. Transparan, lapang, bisa dilihat semua orang. Pengunjung umum/siswa harus merasa "ini rapi, modern, dan bisa dipercaya" dalam beberapa detik pertama.

Anti-goal: terlihat seperti template AI (gradien ungu, kartu kaca generik, emoji berserakan). Anti-goal kedua: langit yang berat sampai HP Android murah tersendat.

## Referensi yang dibaca
Langit sebagai suasana yang memudar jadi permukaan putih (fintech biru, Aeline, app finansial awan piksel); panel kaca buram + jendela (Railroad); kartu miring melayang dengan satu aksen lime (Aeline); kehangatan kertas krem + serif + sorotan stabilo (Umi); tipografi besar dan rapat.

## Arah visual
- **Palet:** langit `#1E6FE8 → #8CCBF5`, permukaan kertas `#F7F9FC`, tinta navy `#0B1B3A`, aksen lime `#D6FF3F` (dipakai hemat: CTA, status "Terverifikasi", stabilo). Hanya warna langit: biru muda ke biru tua (`#0A2A78`, `#06173F`) untuk intro dan penutup. Tidak ada pink, oranye, atau ungu (keputusan pemilik: terasa seperti template AI).
- **Tipografi (ditanam sendiri):** Inter Tight variabel (judul besar rapat + isi), Bricolage 800 hanya untuk wordmark. Skala fluid `clamp()`.
- **Bentuk:** sudut besar (28–40px), pil untuk aksi, kartu putih di atas langit. Modernis = grid tegas, banyak ruang kosong, satu ide per layar.
- **Foto:** langit cumulus asli (Wikimedia Commons, CC BY-SA 4.0, kredit di footer) sebagai latar. Awan dipotong dari foto menjadi sprite transparan (WebP) untuk parallax. Foto senja ditolak karena suram.

## Struktur halaman
0. **Intro screen** (sekali per sesi, bisa dilewati): langit malam biru tua → cahaya putih-biru naik → langit "terangkat" menyingkap hero. Wordmark `cekas` muncul. ±2,6 dtk. Tombol "Lewati".
1. **Hero:** nav pil kaca; judul "Uang kas kelas, seterang langit."; dua CTA (Lihat kas kelas / Masuk); busur kartu melayang miring (saldo, terverifikasi, iuran minggu ini, persetujuan guru).
2. **Pernyataan:** teks besar yang terang kata demi kata saat di-scroll.
3. **Bento fitur (4 kartu):** buku kas anti-manipulasi, verifikasi Wali Kelas, rekap WhatsApp, prakiraan saldo.
4. **Coba sendiri:** buku kas mini dengan rantai hash SHA-256 sungguhan di browser. Tombol "Ubah satu baris" membuat lencana berubah jadi "Perlu diperiksa".
5. **Cara kerja:** tiga langkah (Bendahara catat → Wali Kelas setujui → semua lihat).
6. **Penutup langit tinggi:** langit makin biru dalam mengikuti scroll, awan naik dari bawah, CTA besar, footer + kredit foto.

## Gerak & mikro-interaksi
- Langit hidup: foto latar drift sangat pelan; 3 lapis awan dengan kecepatan beda (parallax scroll; di desktop ditambah parallax pointer). Di HP hanya scroll.
- Kartu hero: masuk bertahap (stagger), melayang ±6px dengan fase berbeda, miring 3D kecil mengikuti pointer.
- Tombol: tekan = skala 0.97 + pegas kembali; panah bergeser; fokus-ring jelas.
- Nav: berubah dari transparan ke kaca saat scroll; sembunyi saat scroll turun, muncul saat naik.
- Angka saldo menghitung naik saat terlihat; sparkline tergambar (stroke-dashoffset).
- Lencana "Terverifikasi" berdenyut sekali saat valid; getar kecil saat rusak.
- Reveal: fade + naik 24px, sekali saja, memakai IntersectionObserver/ScrollTrigger.
- **Reduced motion:** semua loop mati, parallax mati, intro dilewati, reveal jadi instan.
- **Performa:** hanya `transform`/`opacity`; animasi dijeda saat tab tersembunyi; total aset di bawah ±1 MB (tanpa GSAP ±75 KB).

## Non-goal (putaran ini)
Login, dashboard, laporan, dark mode, integrasi Python. Itu giliran berikutnya setelah landing disetujui.

## Pendekatan yang dipertimbangkan
A) HTML+CSS+JS biasa + GSAP lokal (dipilih: ringan, offline, mudah dipindah ke Jinja). B) Vite+Astro/React (ditolak: build step, terlalu berat). C) WebGL sky shader (ditolak untuk sekarang: berat di HP murah; mungkin sebagai upgrade intro).

## Pilihan saya (bisa diubah)
Nama tagline, warna lime, Inter Tight, isi teks demo (data kelas fiktif, diberi label "contoh"), dan urutan seksi adalah keputusan saya, bukan hasil kesepakatan.
