# Cerita 3D halaman Tentang: "Episode 01 · Ke Mana Kas Kita?"

Tujuan: orang paham masalah kas kelas dan siapa tim CEKAS lewat film pendek yang dimainkan dengan gulir.
Gaya: tokoh dan ruang dari blok 3D (Three.js, tanpa file model), shading toon dua nada dengan garis tepi gelap ala anime. Foto datar anggota ditempel di sisi depan kepala blok. 
Bendahara dan Bu Wali adalah tokoh fiksi berwajah gambar, supaya tidak ada anggota sungguhan yang memerankan pihak yang "bermasalah". Dialog adalah dramatisasi; hanya reaksi di Bab 3 yang memakai kutipan asli tim.

## Alur (waktu cerita t = 0..116, mengikuti gulir)
- Pembuka (0-10): kartu judul "Episode 01", awan terbelah, kamera turun dari langit ke gedung sekolah dan masuk lewat jendela XI-F2.
- Bab 1 · Kas yang Hilang Arah (10-52): perkenalan tokoh; Bendahara menarik kas (koin masuk kaleng); Bu Wali menanyakan saldo, buku kas ada halaman hilang; semua bingung; saat istirahat Rafa, Tarina, Revalina mengungkapkan masalahnya.
- Bab 2 · Kita Bikin Sendiri (52-88): sepulang sekolah Cinta mengusulkan, Ardellio mendapat ide; malam hari grup kelas ramai dan Ardellio membangun CEKAS; penjelasan Catat, Kunci, Sahkan dengan rantai hash, percobaan mengubah catatan langsung "KETAHUAN!", lalu stempel Wali Kelas.
- Bab 3 · Seterang Langit (88-116): Bu Wali bertanya lagi, semua membuka CEKAS di ponsel dan bereaksi; kamera masuk ke layar ponsel menuju langit, tujuh tokoh berdiri di atas awan, tombol ke dashboard dan putar ulang.

## Efek
Balon ucapan komik yang menempel ke kepala tokoh dengan teks yang mengetik mengikuti gulir, kotak narasi, panel chat grup, kartu bab, garis kecepatan, nada titik (halftone), bilah sinematik, kilatan, guncangan kamera, emote (?, !, keringat, bohlam, bintang, ponsel), debu dalam berkas cahaya jendela, jam dinding yang berputar sesuai waktu cerita, suasana pagi/mendung/sore/malam.
Suara: efek disintesis Web Audio (tanpa berkas, tanpa suara bicara), mati secara bawaan, dinyalakan lewat tombol; pilihan diingat di localStorage.
Fallback: tanpa WebGL atau dengan "kurangi gerakan", naskah tampil sebagai daftar bab statis.

## Menambah atau mengganti anggota
Foto wajah: assets/team/face-<nama>.webp (persegi 256 px). Data: SPEC, SEATS, STU, NAMES, ROLES di js/story3d.js. Ketujuh anggota sudah berfoto.
