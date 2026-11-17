# CEKAS "Langit" — prototipe desain (statis)

Branch `design/sky-ui`. Tanpa Python, tanpa build. Buka dengan server statis apa saja:

    cd design && python -m http.server 8765      # lalu buka http://127.0.0.1:8765
    # lewati intro: http://127.0.0.1:8765/#nointro

- `index.html` — intro + landing page
- `css/site.css`, `js/main.js` — gaya dan gerak (GSAP 3.12.5 lokal di `assets/vendor`)
- `assets/sky/` — langit hasil olahan foto (kredit di `credits.json` dan footer halaman)
- Rencana lengkap: `docs/superpowers/specs/2026-11-17-sky-ui-landing-design.md`

Gerak mati otomatis jika perangkat memakai "reduce motion". Data di halaman adalah contoh fiktif.
