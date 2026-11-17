# Daftar Ide — Jadwal, Waktu, dan Animasi CEKAS "Langit"

Status: ✅ sudah ada di prototipe · 🔜 usulan berikutnya · 💡 ide lepas. Semua ide mengikuti aturan: palet langit saja, mobile-first, offline-first, mati di reduced-motion.

## A. Jadwal iuran

### A1. Model waktu (✅)
1. Hanya **4 minggu per bulan**, Senin sampai Minggu, mulai dari Senin pertama bulan itu.
2. Minggu berjalan dihitung dari **tanggal hari ini** (bukan angka tetap).
3. **Batas bayar** tiap minggu: Jumat pukul 15.00.
4. Status tiap minggu: Selesai, Minggu ini, Segera (terkunci, dibuka Senin 00.00).
5. Bulan belum mulai (sebelum Senin pertama) dan bulan sudah selesai (setelah Minggu minggu ke-4) punya penanda sendiri.
6. Jam hidup (hari, tanggal, jam) di kepala jadwal, diperbarui tiap 30 detik.

### A2. Cara mengecek jadwal (✅)
7. Alat desain → **Tanggal** (Hari ini, Mgg 1 sampai 4) untuk melihat setiap keadaan.
8. Tautan uji `kas.html?tanggal=2026-11-04` untuk membuka tanggal tertentu.
9. Daftar **Semua jadwal bulan ini**: empat baris dengan rentang, batas, status, dan jumlah lunas. Ketuk baris untuk memilih minggu.
10. **Tambah ke kalender**: unduh `.ics` berisi 4 batas bayar, lengkap dengan pengingat H-1 dan 2 jam sebelumnya.
11. **Salin jadwal** sebagai teks siap tempel ke grup.
12. Uji otomatis: 182 tanggal di 6 bulan dibandingkan dengan hitungan independen, semuanya cocok.

### A3. Visual jadwal (✅)
13. Garis waktu empat minggu dengan garis yang terisi sampai posisi hari ini.
14. Penanda **Hari ini** di jalur tersendiri di atas node, jadi tidak pernah menimpa angka minggu.
15. Kartu minggu: nomor (centang bila selesai, gembok bila terkunci), rentang tanggal, chip status, bilah lunas.
16. Panel batas bayar gelap dengan **hitung mundur ubin** (hari : jam : menit) dan digit yang bergulir.
17. Bilah "waktu minggu ini sudah berjalan" dengan persen.
18. **Strip 7 hari** dengan hari ini disorot dan bendera di hari batas.
19. Minggu depan tampil terkunci dengan motif garis dan penjelasan kapan dibuka.
20. Minggu lewat yang masih ada tunggakan tampil merah, "sudah lewat batas · N belum bayar".

### A4. Usulan jadwal berikutnya (🔜 dan 💡)
21. 🔜 **Pengingat dalam aplikasi**: lencana "Batas besok" di H-1 dan banner "Tinggal 2 jam" di hari-H.
22. 🔜 **Notifikasi bot Telegram** otomatis ke yang belum bayar (H-1 dan hari-H), memakai teks pengingat sopan yang sudah ada.
23. 🔜 **Pilihan hari batas** per kelas (Jumat, Kamis, Senin), disimpan Bendahara.
24. 🔜 **Libur dan ujian**: tandai minggu tanpa iuran dan geser batas otomatis.
25. 🔜 **Riwayat per siswa**: baris kecil "tepat waktu / telat" tiap minggu, tanpa mempermalukan.
26. 🔜 **Pembayaran di muka**: bayar 2 sampai 4 minggu sekaligus, kisi menandai otomatis.
27. 💡 **Navigasi bulan**: panah ke bulan lalu dan depan, arsip bulan lama.
28. 💡 **Kalender sebulan penuh** (grid 7×5) sebagai tampilan kedua, dengan titik di hari batas.
29. 💡 **Zona waktu dan format jam** mengikuti perangkat, selalu "WIB" di label.
30. 💡 **Langganan kalender** (`webcal://`) yang terus diperbarui, bukan sekali unduh.
31. 💡 **Target kelas**: bilah "bulan ini 78% terkumpul" yang naik tiap pengesahan.

## B. Animasi dan mikro-interaksi

### B1. Sudah ada (✅)
32. Jadwal: node masuk bergantian, garis dan penanda meluncur dengan pegas, ubin hitung mundur bergulir saat angka berganti, strip hari membal satu per satu, panel detail meluncur sesuai arah pindah minggu, chip siswa muncul bergelombang, cincin terisi, ikon gembok mengayun, titik "sekarang" berdenyut, bendera batas bergoyang.
33. Aksi: tombol memuat → centang, stempel DISAHKAN, angka terbang ke saldo, percikan, sapuan cahaya di angka, riak sentuh, toast dengan hitung mundur.
34. Hero: karusel kartu melingkar yang melambat saat disentuh dan bisa diseret.
35. Langit: waktu (fajar sampai malam), cuaca (foto mendung, petir, bintang, kabut), parallax awan, bulan dan matahari.
36. Scene: naik menembus awan saat masuk, malam turun saat keluar, fajar di halaman masuk.
37. Landing: judul dibuka per kata, tiga langkah dengan garis terisi dan visual hidup, tab peran, FAQ dengan tinggi halus, spotlight kursor, magnet tombol, ticker.

### B2. Ide 38–50 (semuanya ✅ sudah dikerjakan)
38. ✅ **Satu bahasa gerak**: tiga durasi (200/350/600 ms) dan tiga kurva, dipakai di semua komponen.
39. ✅ **Angka saldo bergulir digit** seperti hitung mundur, bukan hitung naik biasa.
40. ✅ **Skeleton langit**: kilau lembut seperti cahaya melintas awan saat memuat.
41. ✅ **Pull-to-refresh**: awan terbelah lalu menutup saat data baru masuk.
42. ✅ **Transisi halaman** antar rute: halaman lama terangkat, awan lewat 300 ms.
43. ✅ **Tombol jeda** untuk karusel dan awan (aksesibilitas gerak).
44. ✅ **Gelombang ucapan** di hari batas: "Hari ini batas bayar" dengan awan kecil lewat.
45. ✅ **Perayaan tenang** saat semua lunas: cahaya putih menyapu header, tanpa konfeti.
46. ✅ **Haptic berpola**: getar pendek untuk centang, ganda untuk tolak, panjang untuk kunci.
47. ✅ **Suara opsional** (mati secara bawaan): denting halus saat pengesahan.
48. ✅ **Tema ikut cuaca** untuk elemen UI (bukan hanya langit): kartu sedikit lebih teduh saat mendung.
49. ✅ **Mode hemat**: matikan awan, bintang, dan hujan otomatis di perangkat lemah atau Save-Data.
50. ✅ **Pratinjau gerak** di Alat desain: slider kecepatan animasi untuk uji.

## C. Ide produk lain yang muncul selama pengerjaan

51. 🔜 Halaman **Cek keaslian** (verifikasi rantai hash, bisa dibagikan).
52. 🔜 **Laporan SPJ** cetak dengan jadwal iuran sebagai lampiran.
53. 🔜 Tombol **Keluar** yang terlihat di dashboard.
54. 💡 **Ringkasan bulanan** dibagikan sebagai gambar (grafik + saldo) ke WhatsApp.
55. 💡 **Peran tamu**: orang tua melihat ringkasan tanpa nama siswa.
56. 💡 **Tantangan kelas**: target dana event dengan bilah awan yang "terisi".
57. 💡 **Mode presentasi** untuk juri: dashboard layar penuh dengan data contoh dan narasi singkat.
58. 💡 **Ekspor Excel dan PDF** berwarna langit, selaras dengan aplikasi.
59. 💡 **Bahasa**: Indonesia dan Inggris, memakai satu berkas kamus.
60. 💡 **Mode gelap** penuh (bukan hanya langit malam), dengan token yang sama.

## D. Catatan implementasi ide 38–50

- **38 Bahasa gerak:** `--dur-1/2/3` = 200/350/600 ms di `tokens.css`, dan semua `transition`/`animation` berdurasi itu memakai token.
- **39 Saldo bergulir digit:** tiap digit punya kolom 0–9 yang meluncur dengan jeda bertingkat dari kanan. Teks asli tetap ada untuk pembaca layar.
- **40 Skeleton langit:** kilau bergerak menggantikan isi saat tanggal contoh berganti dan saat tarik-untuk-memuat.
- **41 Tarik untuk memuat:** hanya di layar sentuh, awan terbelah makin lebar sesuai tarikan, matahari kecil berputar saat memuat.
- **42 Transisi halaman:** halaman lama memudar dan mengabur, awan lewat 320 ms, halaman baru muncul halus. Tidak aktif saat gerak dijeda, mode hemat, atau reduced-motion.
- **43 Jeda gerak:** saklar di panel Langit menghentikan awan, karusel, dan semua animasi berulang.
- **44 Hari batas:** banner lime dengan awan kecil yang melayang, "Hari ini batas bayar · pukul 15.00 · N teman belum bayar", berubah merah lembut bila sudah lewat jam. (Uji: tombol "Hari batas" di Alat desain.)
- **45 Perayaan tenang:** saat iuran satu minggu lunas semua, header disapu cahaya dan angka saldo berkilau, tanpa konfeti.
- **46 Haptic berpola:** centang pendek, tolak ganda, kunci panjang, hanya setelah pengguna menyentuh layar.
- **47 Suara halus:** disintesis dengan Web Audio (tanpa berkas), mati secara bawaan, mengikuti pola haptic.
- **48 Tema ikut cuaca:** kertas dan permukaan sedikit lebih teduh saat mendung, hujan, badai, kabut, dan malam.
- **49 Mode hemat:** otomatis aktif bila Save-Data, jaringan 2G, memori kecil, prosesor sedikit, atau baterai di bawah 20%. Bisa dipaksa dari panel.
- **50 Kecepatan gerak:** slider 0,25× sampai 2× yang mengatur animasi CSS, GSAP, dan karusel sekaligus.
