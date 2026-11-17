# CEKAS "Langit" — prototipe desain (statis)

Branch `design/sky-ui`. Tanpa Python, tanpa build. Buka dengan server statis apa saja:

    cd design && python -m http.server 8765      # lalu buka http://127.0.0.1:8765
    # lewati intro: http://127.0.0.1:8765/#nointro

- `index.html` — intro + landing (tentang, fitur, peran, coba hash, testimoni, FAQ, outro). `css/landing-extra.css`, `js/landing-extra.js`
- `tentang.html`, `fitur.html` — halaman terpisah (`css/pages.css`, `js/page.js`)
- `assets/weather/` — foto cuaca asli (mendung, petir, bintang) hasil olahan; kredit di `credits.json`
- `css/skyfx.css`, `js/skyfx.js` — langit hidup: ikut waktu perangkat dan (opsional) cuaca sekitar via Open-Meteo; tombol cuaca di nav tiap halaman
- `login.html` — masuk Bendahara / Wali Kelas (peran, percobaan 5x, kunci 15 menit, transisi sukses). Sandi contoh di panel Alat desain
- `status.html` — 404 dan offline (`?s=offline`)
- `kas.html` — dashboard publik (cuaca kas, antrean Wali Kelas, iuran, riwayat, catat kas). Panel "Alat desain" di pojok untuk ganti peran dan cuaca
- `css/site.css`, `js/main.js` — landing; `css/app.css`, `js/kas.js`, `js/sha256.js` — dashboard; `css/fx.css`, `js/fx.js` — sistem mikro-interaksi aksi; `css/auth.css`, `js/login.js` — masuk/status (GSAP 3.12.5 lokal di `assets/vendor`)
- `assets/sky/` — langit hasil olahan foto (kredit di `credits.json` dan footer halaman)
- Rencana lengkap: `docs/superpowers/specs/2026-11-17-sky-ui-landing-design.md`

Gerak mati otomatis jika perangkat memakai "reduce motion". Data di halaman adalah contoh fiktif.
