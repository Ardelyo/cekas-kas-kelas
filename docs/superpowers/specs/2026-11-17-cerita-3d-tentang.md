# Cerita 3D halaman Tentang (konsep)

Tujuan: orang merasakan siapa tim CEKAS lewat film pendek yang dimainkan lewat gulir, bukan kartu profil.
Gaya: tokoh dan ruang berbentuk blok 3D (Three.js, tanpa file model). Foto datar tiap anggota ditempel di sisi depan kepala blok. Warna rambut/baju diambil dari foto (keputusan pembuat, boleh diubah).

Alur (masalah -> solusi -> hasil):
1. Senin pagi, kelas XI-F2 dilihat dari atas. "Setiap kelas punya uang kas. Tapi ke mana perginya?"
2. Jahfal dan Nabila bertanya; kas ada di buku yang dipegang satu orang.
3. Rafa lupa bayar, tidak ada yang mengingatkan. Bukan ada yang curang, hanya tidak bisa diperiksa.
4. Malam, Ardellio mengetik: catatan harus terbuka dan tidak bisa diubah diam-diam.
5. Rantai catatan (hash) terbentuk dan disahkan Wali Kelas.
6. Ponsel muncul dengan CEKAS di layar; mereka bersorak.
7. Kamera masuk ke layar, kilatan putih, lalu dunia langit: tujuh tokoh berdiri di awan, tiga kursi "?" menunggu anggota baru. Tombol ke dashboard.

Dialog di adegan adalah dramatisasi (hanya kutipan di adegan 6 yang berasal dari ucapan asli). Fallback: tanpa WebGL atau dengan "kurangi gerakan", cerita tampil sebagai daftar kartu statis.
Menambah anggota: tambah satu entri di PEOPLE dan satu di SKYSEAT pada js/story3d.js, plus foto wajah assets/team/face-<nama>.webp.
