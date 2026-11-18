/* CEKAS "Langit" — Tentang: "Episode 01", film pendek 3D blok bergaya anime yang dimainkan lewat gulir.
   Babak 1 masalah -> Babak 2 solusi -> Babak 3 hasil. Waktu cerita t berjalan 0..TOTAL mengikuti gulir. */
(function () {
  'use strict';
  var sec = document.querySelector('#cerita'); if (!sec) return;
  var stage = sec.querySelector('.s3d__stage');

  /* ================= naskah ================= */
  var TOTAL = 116;
  var CH = [[0, 'Pembuka'], [10, 'Bab 1 · Pagi'], [28, 'Jam pertama'], [40, 'Istirahat'], [52, 'Bab 2 · Pulang sekolah'], [64, 'Malam'], [76, 'Cara kerjanya'], [88, 'Bab 3 · Senin berikutnya'], [103, 'Masuk ke langit']];
  var NAMES = { nabila: 'Nabila', jahfal: 'Jahfal', rafa: 'Rafa', tarina: 'Tarina', revalina: 'Revalina', cinta: 'Cinta', ardellio: 'Ardellio', bendahara: 'Bendahara', wali: 'Bu Wali' };
  var NPC = { bendahara: 1, wali: 1 };
  // [t0, t1, siapa, teks, jenis, label waktu]
  var LINES = [
    [5, 9.3, null, 'Senin pagi. Seperti biasa, hari di XI-F2 dimulai dengan satu ritual kecil: bayar kas.', 'narr', 'Senin · 06.45'],
    [13, 18.8, null, 'Kenalan dulu dengan anak-anak XI-F2.', 'narr', 'Kelas XI-F2'],
    [19.4, 21.6, 'bendahara', 'Kas minggu ini lima ribu, ya!', 'shout'],
    [21.8, 24.0, 'jahfal', 'Nih, lima ribu. Jangan lupa dicatat, ya!'],
    [24.2, 26.4, 'bendahara', 'Siap! Nanti kucatat di buku kas.'],
    [26.5, 28.0, 'rafa', 'Minggu lalu aku udah bayar belum, ya...?', 'think'],
    [28.4, 31.2, 'wali', 'Anak-anak, untuk study tour nanti, saldo kas kita ada berapa?'],
    [31.4, 33.8, 'bendahara', 'Sebentar, Bu... kok ada halaman yang hilang, ya?'],
    [34.0, 36.2, 'nabila', 'Lho? Katanya kemarin masih banyak?'],
    [36.3, 38.4, 'jahfal', 'Terus kas kelas bulan ini ke mana aja?', 'shout'],
    [38.6, 40.0, null, 'Tidak ada yang tahu jawabannya.', 'narr', 'Jam pertama'],
    [40.6, 42.9, 'rafa', 'Aku udah bayar kok... kayaknya. Nggak ada yang ngingetin.'],
    [43.0, 45.2, 'tarina', 'Aku malah nggak tahu udah nunggak berapa minggu.'],
    [45.4, 47.9, 'revalina', 'Kalau catatannya bisa dilihat semua orang, kan nggak perlu ribut.'],
    [48.1, 51.8, null, 'Bukan karena ada yang curang. Hanya saja, tidak ada yang bisa memeriksa.', 'narr', 'Istirahat'],
    [55.4, 57.8, 'cinta', 'Gimana kalau kita bikin sendiri catatan kasnya?'],
    [58.0, 60.4, 'ardellio', 'Bisa. Asal catatannya terbuka untuk semua...'],
    [60.5, 62.6, 'ardellio', '...dan nggak bisa diubah diam-diam!', 'shout'],
    [62.7, 64.2, 'revalina', 'Aku ikut!'],
    [64.5, 67.4, null, 'Malam itu, grup kelas mendadak ramai.', 'narr', 'Malam · 22.15'],
    [65.2, 73.6, 'nabila', 'Desainnya harus kayak langit!', 'chat'],
    [66.2, 73.6, 'rafa', 'Tambahin pengingat bayar kas dong.', 'chat'],
    [67.2, 73.6, 'tarina', 'Wali Kelas harus menyetujui dulu.', 'chat'],
    [68.2, 73.6, 'jahfal', 'Biar bisa dibuka dari HP juga.', 'chat'],
    [69.2, 73.6, 'revalina', 'Tampilannya harus rapi, ya.', 'chat'],
    [70.2, 73.6, 'cinta', 'Semangat, Del!', 'chat'],
    [72.4, 75.8, 'ardellio', 'Oke. Malam ini CEKAS lahir.'],
    [76.6, 79.6, null, 'Setiap catatan dikunci ke catatan sebelumnya, seperti mata rantai.', 'narr', 'Cara kerjanya'],
    [79.8, 83.2, null, 'Ada yang mencoba mengubah satu catatan diam-diam? Rantainya langsung putus.', 'narr', 'Cara kerjanya'],
    [83.4, 87.6, null, 'Lalu Wali Kelas mengesahkan, dan semua orang bisa memeriksanya.', 'narr', 'Cara kerjanya'],
    [91.4, 93.6, 'wali', 'Jadi, saldo kas kita ada berapa?'],
    [94.0, 96.4, 'bendahara', 'Semua bisa cek sendiri, Bu. Ada di CEKAS!', 'shout'],
    [96.6, 98.2, 'nabila', 'Wow banget!', 'shout'],
    [97.6, 99.2, 'jahfal', 'Keren, cok!', 'shout'],
    [98.6, 100.2, 'tarina', 'Keren sekali.'],
    [99.6, 101.2, 'revalina', 'TECHNOLOGIA!', 'shout'],
    [100.6, 102.4, 'rafa', 'Tercatat rapi. Pengingatnya juga bunyi.']
  ];

  function staticMode() {
    sec.classList.add('is-static');
    var box = document.createElement('div'); box.className = 's3d__static';
    var html = '';
    CH.forEach(function (c, i) {
      var lo = c[0], hi = CH[i + 1] ? CH[i + 1][0] : TOTAL, rows = LINES.filter(function (l) { return l[0] >= lo && l[0] < hi; });
      if (!rows.length) return;
      html += '<section class="st__ch"><h3>' + c[1] + '</h3>' + rows.map(function (l) {
        return l[2] ? '<p class="st__line"><b>' + NAMES[l[2]] + '</b> ' + l[3] + '</p>' : '<p class="st__narr">' + l[3] + '</p>';
      }).join('') + '</section>';
    });
    box.innerHTML = html; stage.appendChild(box);
  }
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function webgl() { try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; } }
  if (reduce || !window.THREE || !window.gsap || !window.ScrollTrigger || !webgl()) { staticMode(); return; }
  gsap.registerPlugin(ScrollTrigger);

  /* ================= util ================= */
  var T = THREE;
  function cl(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function sm(x) { x = cl(x); return x * x * (3 - 2 * x); }
  function seg(t, a, b) { return cl((t - a) / (b - a)); }
  function win(t, a, b, f) { f = f || 0.5; return sm(seg(t, a, a + f)) * (1 - sm(seg(t, b - f, b))); }
  function bump(t, c, w) { return Math.max(0, 1 - Math.abs(t - c) / w); }
  function spring(x) { x = cl(x); return 1 - Math.cos(x * 7.5) * Math.exp(-x * 6.5); }
  function $(s) { return stage.querySelector(s); }

  var canvas = $('#s3d');
  var mobile = window.matchMedia('(max-width: 759px)').matches;
  var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.4 : 1.6));
  var scene = new T.Scene(), cam = new T.PerspectiveCamera(45, 1, 0.1, 400);
  scene.background = new T.Color(0xbfdcff);
  var hemi = new T.HemisphereLight(0xffffff, 0x8fb0e6, 1.0), sun = new T.DirectionalLight(0xffffff, 1.2), lamp = new T.PointLight(0x9ad0ff, 0, 7, 1.4), rim = new T.DirectionalLight(0xbfe0ff, 0.0);
  sun.position.set(-6, 10, 7); rim.position.set(3, 4, -8); scene.add(hemi, sun, lamp, rim);

  var GRAD = (function () { var d = new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]); var t = new T.DataTexture(d, 3, 1, T.RGBAFormat); t.minFilter = t.magFilter = T.NearestFilter; t.needsUpdate = true; return t; })();
  var MATS = {};
  function toon(c) { if (!MATS[c]) MATS[c] = new T.MeshToonMaterial({ color: c, gradientMap: GRAD }); return MATS[c]; }
  var OUT = new T.MeshBasicMaterial({ color: 0x0b1b3a, side: T.BackSide });
  var GEO = {};
  function bgeo(w, h, d) { var k = w + '|' + h + '|' + d; if (!GEO[k]) GEO[k] = new T.BoxGeometry(w, h, d); return GEO[k]; }
  function bx(w, h, d, mat, x, y, z, parent) { var m = new T.Mesh(bgeo(w, h, d), typeof mat === 'number' ? toon(mat) : mat); m.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(m); return m; }
  function ob(w, h, d, mat, x, y, z, parent, e) { e = e || 0.045; var g = new T.Group(); g.position.set(x || 0, y || 0, z || 0); g.add(bx(w, h, d, mat)); g.add(new T.Mesh(bgeo(w + e, h + e, d + e), OUT)); if (parent) parent.add(g); return g; }
  function ctex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; }
  function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  var loader = new T.TextureLoader();
  function load(url, cb) { var t = loader.load(url, cb); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; }
  var FONT = '"Inter Tight", "Segoe UI", system-ui, sans-serif';

  /* ================= wajah ================= */
  function drawnFace(o) {
    return ctex(256, 256, function (x, w, h) {
      x.fillStyle = o.skin; x.fillRect(0, 0, w, h);
      if (o.hijab) { x.fillStyle = o.hijab; x.fillRect(0, 0, w, 46); x.fillRect(0, 0, 26, h); x.fillRect(w - 26, 0, 26, h); }
      else if (o.hair) { x.fillStyle = o.hair; x.fillRect(0, 0, w, 56); x.beginPath(); x.moveTo(0, 56); x.lineTo(70, 56); x.lineTo(30, 100); x.lineTo(0, 110); x.fill(); x.beginPath(); x.moveTo(w, 56); x.lineTo(w - 90, 56); x.lineTo(w - 30, 96); x.lineTo(w, 104); x.fill(); }
      var ey = 128, ex = 72, mood = o.mood || 'ok';
      x.strokeStyle = '#2a2018'; x.lineWidth = 7; x.lineCap = 'round';
      [-1, 1].forEach(function (s) {
        var cx = w / 2 + s * ex / 1.05;
        x.beginPath(); if (mood === 'worry') { x.moveTo(cx - 22, ey - 40 - s * 8); x.lineTo(cx + 22, ey - 40 + s * 8); } else { x.moveTo(cx - 22, ey - 38); x.quadraticCurveTo(cx, ey - 46, cx + 22, ey - 38); } x.stroke();
        if (mood === 'happy') { x.beginPath(); x.arc(cx, ey + 6, 18, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); }
        else { x.fillStyle = '#1b2440'; x.beginPath(); x.ellipse(cx, ey, 15, 21, 0, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + 5, ey - 7, 5.5, 0, 7); x.fill(); x.beginPath(); x.arc(cx - 5, ey + 7, 2.5, 0, 7); x.fill(); }
      });
      if (o.glasses) { x.lineWidth = 5; x.strokeStyle = '#1b2440'; [-1, 1].forEach(function (s) { x.strokeRect(w / 2 + s * ex / 1.05 - 30, ey - 26, 60, 50); }); x.beginPath(); x.moveTo(w / 2 - 8, ey - 6); x.lineTo(w / 2 + 8, ey - 6); x.stroke(); }
      x.strokeStyle = '#2a2018'; x.lineWidth = 6; x.beginPath();
      if (mood === 'worry') { x.moveTo(w / 2 - 18, 196); x.quadraticCurveTo(w / 2, 186, w / 2 + 18, 196); }
      else if (mood === 'happy') { x.moveTo(w / 2 - 24, 186); x.quadraticCurveTo(w / 2, 214, w / 2 + 24, 186); }
      else { x.moveTo(w / 2 - 16, 190); x.quadraticCurveTo(w / 2, 202, w / 2 + 16, 190); }
      x.stroke();
      x.fillStyle = 'rgba(214,120,110,.16)'; x.beginPath(); x.ellipse(w / 2 - 82, 170, 20, 10, 0, 0, 7); x.ellipse(w / 2 + 82, 170, 20, 10, 0, 0, 7); x.fill();
    });
  }

  /* ================= tokoh ================= */
  var SPEC = {
    jahfal: { skin: 0xc9946b, hair: 0x211b18, top: 0xcdbb55, bot: 0x34405e, style: 'short', photo: 'jahfal' },
    ardellio: { skin: 0xd9a67f, hair: 0x16130f, top: 0xf2f5fb, bot: 0x72839f, style: 'short', photo: 'ardellio', collar: 0xffffff },
    nabila: { skin: 0xe5b894, hair: 0xd8d9d6, top: 0x8b9097, bot: 0x40454f, style: 'hijab', photo: 'nabila' },
    rafa: { skin: 0xb98863, hair: 0x14110e, top: 0x1b1c20, bot: 0x3a3d46, style: 'short', photo: 'rafa' },
    revalina: { skin: 0xe0a98a, hair: 0x141414, top: 0x23285e, bot: 0x343a52, style: 'long', photo: 'revalina' },
    tarina: { skin: 0xe3b494, hair: 0x17120f, top: 0xbcd3ee, bot: 0x44546e, style: 'long', photo: 'tarina' },
    cinta: { skin: 0xe8c4a8, hair: 0x141414, top: 0xf6f7fa, bot: 0x7f93b8, style: 'long', photo: 'cinta', collar: 0xffffff },
    bendahara: { skin: 0xe4b48f, hair: 0x231a14, top: 0xf2f5fb, bot: 0x5f7396, style: 'short', drawn: { skin: '#e8b994', hair: '#231a14' } },
    wali: { skin: 0xe2b08a, hair: 0x6d84b0, top: 0x1f3468, bot: 0x2b3a5c, style: 'hijab', drawn: { skin: '#e6b48e', hijab: '#6d84b0', glasses: 1 } }
  };
  Object.keys(SPEC).forEach(function (k) {
    var s = SPEC[k];
    if (s.photo) s.faceTex = load('assets/team/face-' + s.photo + '.webp');
    if (s.drawn) { s.faceTex = drawnFace(s.drawn); s.faceWorry = drawnFace(Object.assign({ mood: 'worry' }, s.drawn)); s.faceHappy = drawnFace(Object.assign({ mood: 'happy' }, s.drawn)); }
  });

  function hair(S, head, hs) {
    var m = S.hair, st = S.style;
    if (st === 'none') return;
    if (st === 'short' || st === 'long') {
      ob(hs + 0.08, 0.18, hs + 0.08, m, 0, hs + 0.04, -0.01, head, 0.04);
      ob(hs + 0.08, hs * (st === 'long' ? 1.25 : 0.78), 0.12, m, 0, st === 'long' ? hs * 0.42 : hs * 0.62, -hs / 2 - 0.04, head, 0.04);
      [-1, 1].forEach(function (s) { ob(0.09, st === 'long' ? hs * 1.1 : hs * 0.46, hs * 0.86, m, s * (hs / 2 + 0.04), st === 'long' ? hs * 0.42 : hs * 0.74, -0.04, head, 0.04); });
    }
    if (st === 'hijab') {
      ob(hs + 0.1, 0.16, hs + 0.1, m, 0, hs + 0.04, 0, head, 0.04);
      ob(hs + 0.1, hs + 0.1, 0.12, m, 0, hs * 0.5, -hs / 2 - 0.05, head, 0.04);
      [-1, 1].forEach(function (s) { ob(0.1, hs + 0.08, hs + 0.08, m, s * (hs / 2 + 0.05), hs * 0.5, 0, head, 0.04); });
      ob(hs + 0.22, 0.34, hs + 0.2, m, 0, -0.12, 0, head, 0.04);
    }
  }
  function mkChar(k, seated) {
    var S = SPEC[k], root = new T.Group(), body = new T.Group(); root.add(body);
    var hip = seated ? 0.56 : 0.78, hs = 0.72;
    ob(0.58, 0.64, 0.34, S.top, 0, hip + 0.32, 0, body);
    if (S.collar) { [-1, 1].forEach(function (s) { var c = bx(0.2, 0.06, 0.14, S.collar, s * 0.12, hip + 0.63, 0.12, body); c.rotation.z = s * 0.4; }); }
    var head = new T.Group(); head.position.set(0, hip + 0.66, 0); body.add(head);
    ob(hs, hs, hs, S.skin, 0, hs / 2, 0, head);
    var faceMat = new T.MeshBasicMaterial({ map: S.faceTex }); var face = new T.Mesh(new T.PlaneGeometry(hs * 0.94, hs * 0.94), faceMat); face.position.set(0, hs / 2, hs / 2 + 0.004); head.add(face);
    hair(S, head, hs);
    function arm(sx) { var p = new T.Group(); p.position.set(sx * 0.4, hip + 0.58, 0); ob(0.2, 0.42, 0.22, S.top, 0, -0.19, 0, p); ob(0.18, 0.16, 0.2, S.skin, 0, -0.48, 0, p); body.add(p); return p; }
    var aL = arm(-1), aR = arm(1), lL = new T.Group(), lR = new T.Group();
    [[lL, -1], [lR, 1]].forEach(function (a) {
      var g = a[0], s = a[1]; g.position.set(s * 0.15, hip, 0); body.add(g);
      if (seated) { ob(0.24, 0.24, 0.56, S.bot, 0, 0, 0.26, g); ob(0.24, 0.48, 0.24, S.bot, 0, -0.26, 0.5, g); ob(0.26, 0.1, 0.34, 0x1d2740, 0, -0.52, 0.56, g); }
      else { ob(0.24, 0.7, 0.26, S.bot, 0, -0.35, 0, g); ob(0.26, 0.1, 0.36, 0x1d2740, 0, -0.73, 0.04, g); }
    });
    root.userData = { k: k, body: body, head: head, aL: aL, aR: aR, lL: lL, lR: lR, faceMat: faceMat, hip: hip, seated: seated };
    return root;
  }
  var HEADV = new T.Vector3();
  function headTop(c, out) { c.userData.head.getWorldPosition(out); out.y += 0.95; return out; }

  /* ================= dunia 1: sekolah dari luar ================= */
  var ext = new T.Group(); scene.add(ext);
  (function () {
    var ground = new T.Mesh(new T.PlaneGeometry(260, 260), toon(0xd5e3f6)); ground.rotation.x = -Math.PI / 2; ext.add(ground);
    var court = new T.Mesh(new T.PlaneGeometry(44, 26), new T.MeshBasicMaterial({ map: ctex(512, 300, function (x, w, h) { x.fillStyle = '#e9f1fc'; x.fillRect(0, 0, w, h); x.strokeStyle = '#cbdaf0'; x.lineWidth = 3; for (var i = 0; i < w; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); } for (var j = 0; j < h; j += 32) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); } x.strokeStyle = '#ffffff'; x.lineWidth = 8; x.strokeRect(120, 70, 272, 160); x.beginPath(); x.arc(256, 150, 34, 0, 7); x.stroke(); }) }));
    court.rotation.x = -Math.PI / 2; court.position.set(0, 0.02, 18); ext.add(court);
    var facade = ctex(1024, 420, function (x, w, h) {
      x.fillStyle = '#f4f8ff'; x.fillRect(0, 0, w, h);
      for (var f = 0; f < 3; f++) { x.fillStyle = '#dfe9f8'; x.fillRect(0, f * 140 + 128, w, 12); for (var i = 0; i < 9; i++) { var X = 36 + i * 110, Y = f * 140 + 30; x.fillStyle = '#9fc6f5'; x.fillRect(X, Y, 78, 76); x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.moveTo(X, Y + 50); x.lineTo(X + 30, Y); x.lineTo(X + 44, Y); x.lineTo(X, Y + 72); x.fill(); x.strokeStyle = '#ffffff'; x.lineWidth = 6; x.strokeRect(X, Y, 78, 76); x.beginPath(); x.moveTo(X + 39, Y); x.lineTo(X + 39, Y + 76); x.stroke(); } }
    });
    var bmat = toon(0xeef4ff);
    var bld = new T.Mesh(bgeo(30, 12.6, 10), [bmat, bmat, toon(0x7da6e6), bmat, new T.MeshBasicMaterial({ map: facade }), bmat]); bld.position.set(0, 6.3, 0); ext.add(bld);
    ob(31, 0.5, 11, 0x5d8fdf, 0, 12.85, 0, ext, 0.08);
    ob(9, 9, 9, 0xeef4ff, -19, 4.5, -2, ext, 0.08); ob(9.6, 0.5, 9.6, 0x5d8fdf, -19, 9.25, -2, ext, 0.08);
    ob(4, 3.4, 0.3, 0x1e6fe8, 0, 1.7, 5.1, ext, 0.06);
    var hl = new T.Mesh(new T.PlaneGeometry(2.6, 1.9), new T.MeshBasicMaterial({ color: 0xd6ff3f, transparent: true, opacity: 0.0 })); hl.position.set(5.3, 7.6, 5.02); ext.add(hl); ext.userData.hl = hl;
    var plaque = new T.Mesh(new T.PlaneGeometry(1.5, 0.5), new T.MeshBasicMaterial({ map: ctex(256, 84, function (x, w, h) { rr(x, 4, 4, w - 8, h - 8, 20); x.fillStyle = '#0b1b3a'; x.fill(); x.fillStyle = '#d6ff3f'; x.font = '800 50px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('XI-F2', w / 2, h / 2 + 2); }) })); plaque.position.set(5.3, 8.85, 5.03); ext.add(plaque);
    [[-11, 13], [11, 12], [-15, 22], [15, 24], [-6, 30], [8, 32], [-22, 8], [22, 6]].forEach(function (p, i) {
      ob(0.6, 2.2, 0.6, 0x7d6a58, p[0], 1.1, p[1], ext, 0.06);
      ob(2.6, 2.2, 2.6, i % 2 ? 0xbfe94a : 0x9fd84a, p[0], 3.1, p[1], ext, 0.08); ob(1.7, 1.4, 1.7, i % 2 ? 0xd6ff3f : 0xbfe94a, p[0] + 0.2, 4.6, p[1] - 0.1, ext, 0.07);
    });
    ob(0.25, 9, 0.25, 0xdfe7f3, -6, 4.5, 14, ext, 0.04);
  })();

  /* ================= awan ================= */
  var CLOUDS = [];
  function cloud(parent, kind, w, x, y, z, op) {
    var m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: load('assets/sky/cloud-' + kind + '.webp'), transparent: true, depthWrite: false, opacity: op || 0.96 }));
    var r = { a: 0.58, b: 0.74, d: 0.74 }[kind]; m.scale.set(w, w * r, 1); m.position.set(x, y, z); parent.add(m); CLOUDS.push(m); return m;
  }
  var curtain = [];
  [['a', 40, -16, 45, 44], ['a', 40, 16, 44, 45], ['b', 22, -4, 47, 47], ['d', 20, 6, 42, 48], ['b', 24, 0.5, 40, 43]].forEach(function (c) { curtain.push({ m: cloud(ext, c[0], c[1], c[2], c[3], c[4]), x: c[2] }); });
  [['a', 70, -40, 34, -30], ['b', 40, 40, 38, -50], ['d', 30, -10, 26, -60], ['a', 60, 30, 22, -80], ['b', 26, -30, 18, -20], ['d', 22, 26, 16, -16], ['b', 30, 0, 30, -40]].forEach(function (c) { cloud(ext, c[0], c[1], c[2], c[3], c[4], 0.9); });

  /* ================= dunia 2: ruang kelas ================= */
  var room = new T.Group(); scene.add(room); room.visible = false;
  var R = {};
  (function () {
    var tiles = ctex(512, 512, function (x, w, h) { x.fillStyle = '#e6eef9'; x.fillRect(0, 0, w, h); x.fillStyle = '#dbe6f5'; x.fillRect(0, 0, w / 2, h / 2); x.fillRect(w / 2, h / 2, w / 2, h / 2); x.strokeStyle = '#cad8ee'; x.lineWidth = 4; x.strokeRect(0, 0, w, h); x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke(); });
    tiles.wrapS = tiles.wrapT = T.RepeatWrapping; tiles.repeat.set(8, 6);
    var floor = new T.Mesh(new T.PlaneGeometry(15, 11), new T.MeshToonMaterial({ map: tiles, gradientMap: GRAD })); floor.rotation.x = -Math.PI / 2; floor.position.z = -0.5; room.add(floor);
    var wallM = toon(0xa9c9f4), wallS = toon(0xb8d3f7);
    bx(15, 5, 0.2, wallM, 0, 2.5, -6.1, room); bx(0.2, 5, 11, wallS, -7.6, 2.5, -0.5, room); bx(0.2, 5, 11, wallS, 7.6, 2.5, -0.5, room);
    bx(15, 0.3, 0.12, 0x6f98dd, 0, 0.15, -5.98, room); bx(0.12, 0.3, 11, 0x6f98dd, -7.48, 0.15, -0.5, room); bx(0.12, 0.3, 11, 0x6f98dd, 7.48, 0.15, -0.5, room);
    bx(15, 0.18, 0.1, 0xffffff, 0, 3.6, -5.98, room);
    var front = new T.Group(); room.add(front); R.front = front;
    bx(15, 5, 0.2, wallM, 0, 2.5, 5.0, front);
    R.winMats = [];
    var skyTex = load('assets/sky/sky-day-sm.jpg'), nightTex = ctex(256, 192, function (x, w, h) { var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#071433'); g.addColorStop(1, '#16306e'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; for (var i = 0; i < 60; i++) { x.globalAlpha = Math.random() * 0.9 + 0.1; x.fillRect(Math.random() * w, Math.random() * h * 0.8, 1.6, 1.6); } x.globalAlpha = 1; x.beginPath(); x.arc(196, 52, 18, 0, 7); x.fill(); x.fillStyle = '#16306e'; x.beginPath(); x.arc(204, 46, 15, 0, 7); x.fill(); });
    R.skyTex = skyTex; R.nightTex = nightTex;
    [-3.6, -0.4, 2.8].forEach(function (z) {
      var m = new T.MeshBasicMaterial({ map: skyTex }); R.winMats.push(m);
      var p = new T.Mesh(new T.PlaneGeometry(2.6, 2.1), m); p.rotation.y = Math.PI / 2; p.position.set(-7.48, 2.7, z); room.add(p);
      bx(0.16, 0.14, 2.8, 0xffffff, -7.44, 3.8, z, room); bx(0.16, 0.14, 2.8, 0xffffff, -7.44, 1.6, z, room); bx(0.16, 2.3, 0.12, 0xffffff, -7.44, 2.7, z - 1.35, room); bx(0.16, 2.3, 0.12, 0xffffff, -7.44, 2.7, z + 1.35, room); bx(0.16, 2.2, 0.08, 0xffffff, -7.44, 2.7, z, room);
      bx(0.12, 2.5, 0.42, 0xdbeaff, -7.32, 2.75, z - 1.55, room);
    });
    var shaftTex = ctex(64, 256, function (x, w, h) { var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    R.shafts = [];
    [-3.6, -0.4, 2.8].forEach(function (z) { var m = new T.Mesh(new T.PlaneGeometry(2.2, 6), new T.MeshBasicMaterial({ map: shaftTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.4, side: T.DoubleSide })); m.position.set(-5.2, 2.1, z); m.rotation.set(0, Math.PI / 2, -0.85); room.add(m); R.shafts.push(m); });
    function wb(a, b, ok) { return ctex(1024, 420, function (x, w, h) { x.fillStyle = '#f7fbff'; x.fillRect(0, 0, w, h); x.strokeStyle = ok ? '#d6ff3f' : '#9db2d6'; x.lineWidth = 16; x.strokeRect(8, 8, w - 16, h - 16); x.fillStyle = '#0b1b3a'; x.textAlign = 'center'; x.font = '800 104px ' + FONT; x.fillText(a, w / 2, 180); x.fillStyle = ok ? '#1e6fe8' : '#6f8fc4'; x.font = '700 64px ' + FONT; x.fillText(b, w / 2, 300); }); }
    R.wb = [wb('Senin', 'Kas minggu ini: Rp5.000', false), wb('Rencana Study Tour', 'Saldo kas: ???', false), wb('Saldo kas?', 'Cek sendiri di CEKAS ✓', true)];
    R.wbMat = new T.MeshBasicMaterial({ map: R.wb[0] });
    var board = new T.Mesh(new T.PlaneGeometry(6.6, 2.7), R.wbMat); board.rotation.y = Math.PI; board.position.set(0, 2.7, 4.88); front.add(board);
    ob(6.9, 0.14, 0.18, 0x6b7fa3, 0, 1.3, 4.84, front, 0.03);
    ob(2.4, 0.1, 1.1, 0xf2f6ff, -4.6, 0.92, 3.5, room); [[-1.1, -0.45], [1.1, -0.45], [-1.1, 0.45], [1.1, 0.45]].forEach(function (o) { bx(0.1, 0.9, 0.1, 0x8aa0c9, -4.6 + o[0], 0.45, 3.5 + o[1], room); });
    var tinTex = ctex(256, 128, function (x, w, h) { x.fillStyle = '#d6ff3f'; x.fillRect(0, 0, w, h); x.fillStyle = '#1a2400'; x.font = '800 72px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('KAS', w / 2, h / 2 + 4); });
    var tm = toon(0xd6ff3f), tinFace = new T.MeshBasicMaterial({ map: tinTex });
    R.tin = new T.Group(); room.add(R.tin);
    R.tin.add(new T.Mesh(bgeo(0.6, 0.42, 0.42), [tm, tm, tm, tm, tinFace, tinFace])); R.tin.add(new T.Mesh(bgeo(0.64, 0.46, 0.46), OUT));
    ob(0.5, 0.08, 0.38, 0x1e6fe8, -5.1, 1.0, 3.4, room, 0.03);
    ob(3.6, 2.0, 0.08, 0xe7f0fd, -3.2, 2.6, -5.98, room, 0.04);
    [[-4.4, 3.1, 0xffffff], [-3.4, 3.0, 0xd6ff3f], [-2.3, 3.15, 0x9fc6f5], [-4.0, 2.2, 0x9fc6f5], [-2.8, 2.1, 0xffffff], [-1.9, 2.3, 0xd6ff3f]].forEach(function (p, i) { var q = bx(0.7, 0.8, 0.02, p[2], p[0], p[1], -5.92, room); q.rotation.z = ((i * 7) % 3 - 1) * 0.06; });
    var clock = new T.Group(); clock.position.set(3.6, 3.9, -5.95); room.add(clock);
    clock.add(new T.Mesh(new T.CircleGeometry(0.5, 32), new T.MeshBasicMaterial({ color: 0xffffff })));
    clock.add(new T.Mesh(new T.RingGeometry(0.5, 0.58, 32), new T.MeshBasicMaterial({ color: 0x0b1b3a })));
    R.hourH = new T.Group(); R.minH = new T.Group(); clock.add(R.hourH, R.minH);
    bx(0.06, 0.28, 0.02, new T.MeshBasicMaterial({ color: 0x0b1b3a }), 0, 0.13, 0.02, R.hourH); bx(0.04, 0.42, 0.02, new T.MeshBasicMaterial({ color: 0x1e6fe8 }), 0, 0.2, 0.03, R.minH);
    var pen = new T.Mesh(new T.PlaneGeometry(1.8, 0.9), new T.MeshBasicMaterial({ transparent: true, map: ctex(360, 180, function (x, w, h) { x.fillStyle = '#1e6fe8'; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, h / 2); x.lineTo(0, h); x.fill(); x.fillStyle = '#fff'; x.font = '800 64px ' + FONT; x.textBaseline = 'middle'; x.fillText('XI-F2', 22, h / 2 + 2); }) })); pen.position.set(1.0, 3.9, -5.95); room.add(pen);
    for (var i = 0; i < 4; i++) ob(0.7, 2.2, 0.6, 0x7da6e6, 5.0 + i * 0.72, 1.1, -5.65, room, 0.03);
    ob(0.6, 0.6, 0.6, 0xffffff, -6.6, 0.3, -5.3, room, 0.04); ob(0.7, 0.7, 0.7, 0xbfe94a, -6.6, 0.95, -5.3, room, 0.05); ob(0.45, 0.45, 0.45, 0xd6ff3f, -6.5, 1.45, -5.35, room, 0.04);
    ob(0.1, 3.0, 1.5, 0x5d8fdf, 7.46, 1.5, 2.6, room, 0.03); bx(0.04, 0.6, 0.6, 0xbfdcff, 7.4, 2.2, 2.6, room); bx(0.08, 0.08, 0.2, 0xd6ff3f, 7.38, 1.4, 2.1, room);
    ob(0.4, 0.5, 1.8, 0xffffff, 7.3, 4.2, -1.5, room, 0.03);
  })();

  var SEATS = { nabila: [-3.9, -0.8], jahfal: [-1.3, -0.8], rafa: [1.3, -0.8], tarina: [3.9, -0.8], revalina: [-2.6, -3.4], cinta: [0, -3.4], ardellio: [2.6, -3.4] };
  var STU = ['nabila', 'jahfal', 'rafa', 'tarina', 'revalina', 'cinta', 'ardellio'];
  var C = {};
  STU.forEach(function (k) {
    var p = SEATS[k], c = mkChar(k, true); c.position.set(p[0], 0, p[1]); room.add(c); C[k] = c;
    ob(0.62, 0.08, 0.6, 0x8aa0c9, p[0], 0.5, p[1], room, 0.03); ob(0.62, 0.7, 0.08, 0x8aa0c9, p[0], 0.88, p[1] - 0.3, room, 0.03);
    ob(1.7, 0.09, 0.9, 0xf2f6ff, p[0], 0.88, p[1] + 0.85, room, 0.035);
    [[-0.78, -0.38], [0.78, -0.38], [-0.78, 0.38], [0.78, 0.38]].forEach(function (o) { bx(0.07, 0.84, 0.07, 0x8aa0c9, p[0] + o[0], 0.42, p[1] + 0.85 + o[1], room); });
    var sh = new T.Mesh(new T.CircleGeometry(0.7, 20), new T.MeshBasicMaterial({ color: 0x1a2a55, transparent: true, opacity: 0.13, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.set(p[0], 0.02, p[1] + 0.3); sh.scale.set(1.4, 1, 1.2); room.add(sh);
  });
  C.bendahara = mkChar('bendahara', false); room.add(C.bendahara);
  C.wali = mkChar('wali', false); room.add(C.wali); C.wali.position.set(-1.6, 0, 3.8); C.wali.rotation.y = Math.PI;
  ob(0.36, 0.46, 0.08, 0x1e6fe8, 0, -0.5, 0.12, C.bendahara.userData.aR, 0.03);
  var lapCode = ctex(256, 160, function (x, w, h) { x.fillStyle = '#0b1b3a'; x.fillRect(0, 0, w, h); var cols = ['#d6ff3f', '#7fb8ff', '#ffffff', '#7fb8ff']; for (var i = 0; i < 9; i++) { x.fillStyle = cols[i % 4]; x.fillRect(14 + (i % 3) * 16, 12 + i * 16, 36 + ((i * 41) % 130), 8); } });
  var lapScr = new T.MeshBasicMaterial({ color: 0x24345e });
  var lap = new T.Group(); lap.position.set(2.6, 0.95, -2.55); room.add(lap);
  ob(0.95, 0.05, 0.62, 0x3b4660, 0, 0, 0, lap, 0.03);
  var lid = new T.Group(); lid.position.set(0, 0.03, 0.28); lid.rotation.x = -0.18; lap.add(lid);
  ob(0.95, 0.62, 0.04, 0x3b4660, 0, 0.31, 0, lid, 0.03);
  var lapS = new T.Mesh(new T.PlaneGeometry(0.86, 0.54), lapScr); lapS.rotation.y = Math.PI; lapS.position.set(0, 0.31, -0.025); lid.add(lapS);
  lamp.position.set(2.6, 1.9, -2.0);

  var dustN = 160, dustG = new T.BufferGeometry(), dustP = new Float32Array(dustN * 3);
  for (var di = 0; di < dustN; di++) { dustP[di * 3] = -7 + Math.random() * 9; dustP[di * 3 + 1] = Math.random() * 4.5; dustP[di * 3 + 2] = -5.5 + Math.random() * 10; }
  dustG.setAttribute('position', new T.BufferAttribute(dustP, 3));
  var dotTex = ctex(64, 64, function (x, w, h) { var g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  var dust = new T.Points(dustG, new T.PointsMaterial({ map: dotTex, size: 0.06, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.8 })); room.add(dust);

  var chain = new T.Group(); chain.position.set(0, 3.25, -2.0); chain.scale.setScalar(0.86); room.add(chain);
  var HASH = ['9d28', '0c5d', 'cbb4', 'b360', 'e7a1', '----'], CHN = [];
  function hashTex(h, mode) { return ctex(256, 150, function (x, w, hh) { rr(x, 6, 6, w - 12, hh - 12, 28); x.fillStyle = mode === 'ok' ? '#d6ff3f' : mode === 'bad' ? '#ffffff' : '#0d2a66'; x.fill(); x.lineWidth = 7; x.strokeStyle = mode === 'ok' ? '#ffffff' : '#d6ff3f'; x.stroke(); x.fillStyle = mode === 'ok' ? '#1a2400' : mode === 'bad' ? '#0b1b3a' : '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = mode === 'ok' ? '800 52px ' + FONT : '700 60px ui-monospace, Consolas, monospace'; x.fillText(mode === 'ok' ? '✓ SAH' : mode === 'bad' ? '#@!?' : h, w / 2, hh / 2 + 3); }); }
  HASH.forEach(function (h, i) {
    var face = new T.MeshBasicMaterial({ map: hashTex(h) }), side = toon(0x0d2a66);
    var g = new T.Group(); g.position.set(-4.3 + i * 1.72, Math.sin(i * 0.9) * 0.22, 0); chain.add(g);
    g.add(new T.Mesh(bgeo(1.3, 0.76, 0.3), [side, side, side, side, face, side])); g.add(new T.Mesh(bgeo(1.36, 0.82, 0.36), OUT));
    var link = null; if (i > 0) { link = new T.Mesh(bgeo(0.42, 0.1, 0.1), new T.MeshBasicMaterial({ color: 0xd6ff3f })); link.position.set(g.position.x - 0.86, (g.position.y + CHN[i - 1].y) / 2, 0); chain.add(link); }
    CHN.push({ g: g, face: face, link: link, y: g.position.y, base: face.map });
  });
  var BAD = hashTex('', 'bad'), OKT = hashTex('', 'ok');
  var hand = ob(0.34, 1.6, 0.34, 0x0b1b3a, 0, 6, 0, chain, 0.03);
  var stamp = new T.Group(); chain.add(stamp); ob(0.5, 0.2, 0.5, 0xd6ff3f, 0, 0, 0, stamp, 0.03); ob(0.16, 0.6, 0.16, 0x0b1b3a, 0, 0.4, 0, stamp, 0.03); ob(0.34, 0.16, 0.34, 0x0b1b3a, 0, 0.74, 0, stamp, 0.03);

  function iconTex(kind) {
    return ctex(128, 128, function (x) {
      x.lineJoin = 'round';
      if (kind === 'sweat') { x.fillStyle = '#9ccaff'; x.strokeStyle = '#0b1b3a'; x.lineWidth = 6; x.beginPath(); x.moveTo(64, 12); x.bezierCurveTo(100, 64, 104, 82, 92, 98); x.arc(64, 90, 30, 0.3, Math.PI - 0.3); x.bezierCurveTo(24, 82, 28, 64, 64, 12); x.fill(); x.stroke(); return; }
      if (kind === 'spark') { x.fillStyle = '#d6ff3f'; x.strokeStyle = '#0b1b3a'; x.lineWidth = 5; x.beginPath(); for (var i = 0; i < 8; i++) { var r = i % 2 ? 14 : 54, a = i * Math.PI / 4 - Math.PI / 2; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } x.closePath(); x.fill(); x.stroke(); return; }
      if (kind === 'idea') { x.fillStyle = '#d6ff3f'; x.strokeStyle = '#0b1b3a'; x.lineWidth = 6; x.beginPath(); x.arc(64, 54, 34, 0, 7); x.fill(); x.stroke(); x.fillStyle = '#0b1b3a'; x.fillRect(48, 88, 32, 20); x.strokeStyle = '#d6ff3f'; x.lineWidth = 6; [[-1, -1], [1, -1], [-1.3, 0.2], [1.3, 0.2]].forEach(function (d) { x.beginPath(); x.moveTo(64 + d[0] * 44, 54 + d[1] * 34); x.lineTo(64 + d[0] * 58, 54 + d[1] * 46); x.stroke(); }); return; }
      if (kind === 'phone') { rr(x, 34, 10, 60, 108, 14); x.fillStyle = '#0b1b3a'; x.fill(); rr(x, 40, 18, 48, 90, 8); var g = x.createLinearGradient(0, 18, 0, 108); g.addColorStop(0, '#5ea3f4'); g.addColorStop(1, '#1e6fe8'); x.fillStyle = g; x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(56, 38, 7, 0, 7); x.arc(66, 35, 9, 0, 7); x.arc(75, 39, 6, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(46, 54, 36, 10); x.fillRect(46, 70, 28, 8); x.fillStyle = '#d6ff3f'; x.fillRect(46, 86, 36, 12); return; }
      if (kind === 'coin') { x.fillStyle = '#d6ff3f'; x.strokeStyle = '#0b1b3a'; x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 40, 0, 7); x.fill(); x.stroke(); x.fillStyle = '#1a2400'; x.font = '800 40px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('5K', 64, 66); return; }
      x.fillStyle = kind === '!' ? '#d6ff3f' : '#ffffff'; x.strokeStyle = '#0b1b3a'; x.lineWidth = 7; x.beginPath(); x.arc(64, 64, 52, 0, 7); x.fill(); x.stroke();
      x.fillStyle = '#0b1b3a'; x.font = '800 78px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(kind, 64, 70);
    });
  }
  var ICONS = {}; ['?', '!', 'sweat', 'spark', 'idea', 'phone', 'coin'].forEach(function (k) { ICONS[k] = iconTex(k); });
  var EMOTES = [
    [26.6, 28, ['rafa'], '?'], [31.6, 34, ['bendahara'], 'sweat'], [34.1, 36, ['nabila'], '!'],
    [38.4, 40.2, STU, '?'], [41, 43, ['rafa'], 'sweat'], [43.2, 45.2, ['tarina'], 'sweat'],
    [60.6, 62.8, ['ardellio'], 'idea'], [62.8, 64.3, ['revalina', 'cinta'], 'spark'],
    [95.0, 103, STU, 'phone'], [96.6, 103, STU, 'spark']
  ];
  var emoteSprites = [];
  EMOTES.forEach(function (e) {
    e[2].forEach(function (k, j) {
      var s = new T.Sprite(new T.SpriteMaterial({ map: ICONS[e[3]], transparent: true, depthTest: false })); s.renderOrder = 20; s.visible = false; room.add(s);
      var late = e[3] === 'phone' && e[0] > 90;
      emoteSprites.push({ s: s, t0: e[0] + (late ? j * 0.18 : (e[2].length > 2 ? j * 0.08 : 0)), t1: e[1], k: k, kind: e[3], off: late ? 0 : (e[3] === 'spark' ? 0.55 : 0.35), up: late ? 0.15 : (e[3] === 'spark' && e[0] > 90 ? 0.75 : 0) });
    });
  });
  var COINS = [[20.4, 'nabila'], [22.6, 'jahfal'], [24.6, 'rafa'], [26.2, 'tarina']].map(function (c) { var s = new T.Sprite(new T.SpriteMaterial({ map: ICONS.coin, transparent: true, depthTest: false })); s.scale.set(0.42, 0.42, 1); s.renderOrder = 21; s.visible = false; room.add(s); return { t: c[0], k: c[1], s: s }; });

  var spN = 90, spG = new T.BufferGeometry(), spP = new Float32Array(spN * 3);
  for (var si = 0; si < spN; si++) { spP[si * 3] = -6 + Math.random() * 12; spP[si * 3 + 1] = 0.6 + Math.random() * 4; spP[si * 3 + 2] = -4 + Math.random() * 5; }
  spG.setAttribute('position', new T.BufferAttribute(spP, 3));
  var sparkTex = ctex(64, 64, function (x) { x.fillStyle = '#ffffff'; x.beginPath(); for (var i = 0; i < 8; i++) { var r = i % 2 ? 5 : 30, a = i * Math.PI / 4; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.fill(); });
  var sparks = new T.Points(spG, new T.PointsMaterial({ map: sparkTex, size: 0.22, transparent: true, depthWrite: false, opacity: 0, color: 0xeaff9a })); scene.add(sparks);

  /* ================= ponsel CEKAS ================= */
  var phone = new T.Group(); phone.position.set(0, 2.6, 2.6); room.add(phone); phone.visible = false;
  ob(1.3, 2.62, 0.14, 0x0a1a44, 0, 0, 0, phone, 0.05);
  var screenTex = ctex(512, 1024, function (x, w, h) {
    var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5ea3f4'); g.addColorStop(1, '#1e6fe8'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.28)'; x.beginPath(); x.arc(110, 900, 120, 0, 7); x.arc(250, 930, 150, 0, 7); x.arc(400, 890, 110, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(70, 80, 24, 0, 7); x.arc(104, 74, 30, 0, 7); x.arc(138, 82, 22, 0, 7); x.fill(); x.font = '800 54px ' + FONT; x.textBaseline = 'middle'; x.fillText('cekas', 168, 80);
    rr(x, 36, 150, w - 72, 230, 36); x.fillStyle = 'rgba(255,255,255,.96)'; x.fill(); x.fillStyle = '#5b6b8c'; x.font = '600 28px ' + FONT; x.fillText('Kas kelas XI-F2', 70, 200); x.fillStyle = '#0b1b3a'; x.font = '800 66px ' + FONT; x.fillText('Terbuka', 70, 275); x.fillStyle = '#1e6fe8'; x.font = '700 30px ' + FONT; x.fillText('✓ Disahkan Wali Kelas', 70, 340);
    for (var i = 0; i < 3; i++) { rr(x, 36, 410 + i * 108, w - 72, 90, 26); x.fillStyle = 'rgba(255,255,255,.9)'; x.fill(); x.fillStyle = i === 1 ? '#d6ff3f' : '#cfe0fb'; x.beginPath(); x.arc(84, 455 + i * 108, 22, 0, 7); x.fill(); x.fillStyle = '#0b1b3a'; rr(x, 124, 436 + i * 108, 190 - i * 24, 16, 8); x.fill(); x.fillStyle = '#9db2d6'; rr(x, 124, 464 + i * 108, 120, 12, 6); x.fill(); }
    rr(x, 36, 770, w - 72, 100, 50); x.fillStyle = '#d6ff3f'; x.fill(); x.fillStyle = '#1a2400'; x.font = '800 40px ' + FONT; x.textAlign = 'center'; x.fillText('+ Catat kas', w / 2, 822);
  });
  var phoneScreen = new T.Mesh(new T.PlaneGeometry(1.2, 2.42), new T.MeshBasicMaterial({ map: screenTex })); phoneScreen.position.z = 0.075; phone.add(phoneScreen);

  /* ================= dunia 3: langit ================= */
  var sky = new T.Group(); sky.visible = false; scene.add(sky);
  [['a', 40, -26, 6, -30], ['b', 18, -16, 10, -10], ['d', 14, 14, 8, -12], ['b', 20, 20, 13, -20], ['a', 46, 4, 15, -50], ['d', 12, -10, 4, -6], ['b', 16, 22, 4, -8], ['d', 16, -24, 12, -24]].forEach(function (c) { cloud(sky, c[0], c[1], c[2], c[3], c[4]); });
  [['a', 13, -5, -1.4, 1.6], ['a', 13, 5, -1.5, 1.8], ['b', 7, 0, -1.2, 2.2], ['d', 8, -8.5, -0.9, 1.0], ['d', 8, 8.5, -0.9, 1.1], ['a', 18, 0, -1.0, -1.2]].forEach(function (c) { cloud(sky, c[0], c[1], c[2], c[3], c[4], 1); });
  var SKYC = [];
  ['ardellio', 'rafa', 'nabila', 'jahfal', 'revalina', 'tarina', 'cinta'].forEach(function (k, i) { var c = mkChar(k, false); c.position.set((i - 3) * 1.65, 0.15, (i % 2) * 0.3 - 0.1); sky.add(c); SKYC.push(c); });

  /* ================= kamera ================= */
  var KEXT = [[0, 0, 46, 60, 0, 44, 0], [3, 0, 44, 56, 0, 40, 0], [6.5, 10, 20, 34, 3, 6, 0], [9.0, 5.6, 7.9, 9.4, 5.3, 7.6, 5], [9.75, 5.3, 7.6, 5.7, 5.3, 7.6, 4]];
  var KROOM = [
    [9.7, 0, 14, 10, 0, 0, -1.5], [13, 0, 9.5, 9.6, 0, 0.6, -1.8],
    [15.5, -4.6, 2.7, 3.3, -2.6, 1.45, -1.6], [18.6, 4.6, 2.9, 3.3, 1.6, 1.5, -2.6],
    [19.3, 3.2, 3.3, 4.6, -0.8, 1.3, -0.4], [27.9, 2.2, 3.1, 4.6, 0.6, 1.3, -0.4],
    [28.0, 2.6, 3.1, -5.7, -0.6, 2.0, 4, 1], [33.9, 1.2, 2.6, -4.6, -0.4, 1.9, 4],
    [34.0, -2.6, 2.0, 2.7, -2.6, 1.45, -0.8, 1], [38.2, -2.2, 2.2, 3.3, -2.0, 1.45, -0.8], [39.4, 0, 4.4, 4.7, 0, 1.2, -2], [40.3, 0, 4.4, 4.7, 0, 1.2, -2],
    [40.4, 2.6, 2.0, 2.7, 2.6, 1.45, -0.8, 1], [45.2, 2.9, 2.1, 2.9, 2.6, 1.45, -0.8],
    [45.3, -2.6, 2.15, -1.55, -2.6, 1.5, -3.4, 1], [47.9, -2.6, 2.25, -1.35, -2.6, 1.5, -3.4],
    [48.0, 0, 5.6, 4.7, 0, 1.0, -2, 1], [55.2, 0, 5.0, 4.4, 0, 1.0, -2],
    [55.3, 1.3, 2.4, 0.4, 1.3, 1.5, -3.4, 1], [62.6, 1.0, 2.45, 0.5, 1.0, 1.5, -3.4], [64.2, -0.2, 2.6, 0.9, -0.4, 1.5, -3.4],
    [64.3, 2.6, 1.95, -2.0, 2.6, 1.45, -3.4, 1], [67.6, 2.3, 2.6, -0.9, 3.2, 2.6, -6], [72.2, 2.6, 2.0, -1.9, 2.6, 1.45, -3.4], [75.9, 2.6, 2.0, -1.8, 2.6, 1.45, -3.4],
    [76.0, 0, 3.1, 4.7, 0, 2.45, -2, 1], [87.9, 0, 3.3, 4.6, 0, 2.4, -2], [90.9, 0, 9.5, 9.6, 0, 0.6, -1.8],
    [91.0, 2.6, 3.1, -5.7, -0.6, 2.0, 4, 1], [93.8, 1.2, 2.6, -4.6, -0.4, 1.9, 4],
    [93.9, 0, 3.9, 4.7, 0, 1.4, -1.8, 1], [96.4, 0, 3.6, 4.6, 0, 1.4, -1.6], [102.4, 0, 3.3, 4.6, 0, 1.5, -1.4],
    [103.4, 0, 2.6, 4.75, 0, 2.6, 2.6], [107.2, 0, 2.6, 2.7, 0, 2.6, 2.0]
  ];
  var KSKY = [[107.3, 0, 4.4, 14, 0, 3.6, 0], [112, 0, 3.8, 10.2, 0, 3.5, 0], [116, 0, 3.8, 9.9, 0, 3.5, 0]];
  var P3 = [0, 0, 0], L3 = [0, 0, 0];
  function pathAt(list, t) {
    var i = 0; while (i < list.length - 2 && t >= list[i + 1][0]) i++;
    var a = list[i], b = list[i + 1], u;
    if (t <= a[0]) u = 0; else if (t >= b[0]) u = 1; else if (b[7]) u = 0; else u = sm((t - a[0]) / (b[0] - a[0]));
    for (var j = 0; j < 3; j++) { P3[j] = a[1 + j] + (b[1 + j] - a[1 + j]) * u; L3[j] = a[4 + j] + (b[4 + j] - a[4 + j]) * u; }
  }

  /* ================= suasana ================= */
  var MOOD = [[0, 0xbfdcff, 1.0, 1.2, 0, 0], [39, 0xbfdcff, 1.0, 1.2, 0, 0], [41, 0x9fb6d8, 0.78, 0.55, 0, 1], [52, 0x9fb6d8, 0.78, 0.55, 0, 1], [54, 0xb3cdf0, 0.92, 0.85, 0, 0.3], [63.6, 0xb3cdf0, 0.92, 0.85, 0, 0.3], [64.6, 0x07122e, 0.28, 0.12, 1, 0], [75.6, 0x07122e, 0.28, 0.12, 1, 0], [76.4, 0x0b1d4d, 0.45, 0.3, 0.75, 0], [87.6, 0x0b1d4d, 0.45, 0.3, 0.75, 0], [89.6, 0xc8e2ff, 1.1, 1.3, 0, 0], [200, 0xc8e2ff, 1.1, 1.3, 0, 0]];
  var mood = { bg: new T.Color(), hemi: 1, sun: 1, night: 0, over: 0 }, cA = new T.Color(), cB = new T.Color();
  function moodAt(t) { var i = 0; while (i < MOOD.length - 2 && t >= MOOD[i + 1][0]) i++; var a = MOOD[i], b = MOOD[i + 1], u = sm((t - a[0]) / (b[0] - a[0])); mood.bg.copy(cA.setHex(a[1])).lerp(cB.setHex(b[1]), u); mood.hemi = a[2] + (b[2] - a[2]) * u; mood.sun = a[3] + (b[3] - a[3]) * u; mood.night = a[4] + (b[4] - a[4]) * u; mood.over = a[5] + (b[5] - a[5]) * u; }
  var CLOCK = [[0, 6.75], [28, 7.25], [40, 10], [55, 15.2], [64.3, 22.25], [75.9, 25.2], [90.5, 25.2], [91, 31.0], [200, 31.3]];
  function clockAt(t) { var i = 0; while (i < CLOCK.length - 2 && t >= CLOCK[i + 1][0]) i++; var a = CLOCK[i], b = CLOCK[i + 1]; return a[1] + (b[1] - a[1]) * sm((t - a[0]) / (b[0] - a[0])); }

  /* ================= lapisan HTML ================= */
  var bubLayer = $('.s3d__bubbles'), lblLayer = $('.s3d__labels'), narrEl = $('.s3d__narr'), narrWhen = narrEl.querySelector('.narr__when'), narrTxt = narrEl.querySelector('.narr__txt');
  var chatEl = $('.s3d__chat'), chatList = chatEl.querySelector('.chat__list'), stepsEl = $('.s3d__steps'), impactEl = $('.s3d__impact'), endEl = $('.s3d__end');
  var cards = Array.prototype.slice.call(stage.querySelectorAll('.s3d__card')), flashEl = $('.s3d__flash');
  var speedCv = $('.s3d__speed'), sctx = speedCv.getContext('2d');
  var BUBS = [];
  LINES.forEach(function (l) {
    if (l[4] === 'narr') return;
    if (l[4] === 'chat') { var m = document.createElement('div'); m.className = 'msg'; m.innerHTML = '<b>' + NAMES[l[2]] + '</b><span>' + l[3] + '</span>'; chatList.appendChild(m); BUBS.push({ l: l, el: m, chat: true }); return; }
    var el = document.createElement('div'); el.className = 'bub bub--' + (l[4] || 'say') + (NPC[l[2]] ? ' bub--npc' : '');
    el.innerHTML = '<b>' + NAMES[l[2]] + '</b><span></span>'; bubLayer.appendChild(el);
    BUBS.push({ l: l, el: el, txt: el.querySelector('span'), n: -1, on: false });
  });
  var NARRS = LINES.filter(function (l) { return l[4] === 'narr'; });
  var ROLES = { nabila: 'XI-F2', jahfal: 'XI-F2', rafa: 'XI-F2', tarina: 'XI-F2', revalina: 'XI-F2', cinta: 'XI-F2', ardellio: 'Developer' };
  var ROLL = [['nabila', 13.4], ['jahfal', 14.0], ['rafa', 14.6], ['tarina', 15.2], ['revalina', 16.0], ['cinta', 16.6], ['ardellio', 17.2]];
  var LBL = ROLL.map(function (r) { var el = document.createElement('div'); el.className = 'lbl'; el.innerHTML = NAMES[r[0]] + '<small>' + ROLES[r[0]] + '</small>'; lblLayer.appendChild(el); return { k: r[0], t: r[1], el: el, sky: false }; });
  SKYC.forEach(function (c, i) { var k = c.userData.k, el = document.createElement('div'); el.className = 'lbl lbl--sky'; el.innerHTML = NAMES[k] + ''; lblLayer.appendChild(el); LBL.push({ k: k, t: 108.4 + i * 0.25, el: el, sky: true, c: c }); });

  /* ================= suara (disintesis, tanpa berkas) ================= */
  var AC = null, master = null, noiseBuf = null, windG = null, soundOn = !!(window.motion && motion.state && motion.state.sound);
  function audioInit() {
    if (AC) return; var A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    AC = new A(); master = AC.createGain(); master.gain.value = 0.55; var comp = AC.createDynamicsCompressor(); master.connect(comp); comp.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    var n = AC.createBufferSource(); n.buffer = noiseBuf; n.loop = true; var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; windG = AC.createGain(); windG.gain.value = 0; n.connect(f); f.connect(windG); windG.connect(master); n.start();
  }
  function tone(type, f0, f1, dur, vol, when, attack) {
    var o = AC.createOscillator(), g = AC.createGain(), t0 = AC.currentTime + (when || 0); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + (attack || 0.008)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, vol, type, f0, f1, when, q) {
    var s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(), t0 = AC.currentTime + (when || 0); s.buffer = noiseBuf; f.type = type || 'bandpass'; f.Q.value = q || 1; f.frequency.setValueAtTime(f0, t0); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  }
  var SFX = {
    pop: function () { tone('sine', 520, 1150, 0.09, 0.22); },
    shout: function () { tone('triangle', 300, 900, 0.12, 0.25); noise(0.08, 0.12, 'highpass', 2500, 0, 0.01); },
    think: function () { tone('sine', 480, 0, 0.07, 0.12); tone('sine', 700, 0, 0.07, 0.1, 0.08); },
    whoosh: function () { noise(0.9, 0.5, 'bandpass', 260, 2600, 0, 0.8); },
    whoosh2: function () { noise(0.7, 0.45, 'bandpass', 2400, 320, 0, 0.9); },
    coin: function () { tone('sine', 1568, 0, 0.35, 0.16); tone('sine', 2093, 0, 0.45, 0.13, 0.05); tone('triangle', 3136, 0, 0.1, 0.06, 0.05); },
    page: function () { noise(0.12, 0.25, 'highpass', 1800, 0); noise(0.12, 0.2, 'highpass', 2200, 0, 0.16); },
    huh: function () { tone('sine', 300, 620, 0.28, 0.18); },
    ding: function () { tone('sine', 1318, 0, 1.1, 0.18); tone('sine', 1975, 0, 0.8, 0.08, 0.01); tone('sine', 2637, 0, 0.5, 0.05, 0.02); },
    ping: function () { tone('sine', 1320, 0, 0.18, 0.15); tone('sine', 1760, 0, 0.28, 0.13, 0.09); },
    key: function () { noise(0.03, 0.18, 'bandpass', 3200 + Math.random() * 1200, 0, 0, 3); tone('square', 180, 0, 0.02, 0.03); },
    lock: function () { tone('square', 1800, 0, 0.03, 0.06); tone('sine', 900, 600, 0.08, 0.12, 0.02); },
    impact: function () { tone('sine', 110, 38, 0.6, 0.5); noise(0.4, 0.35, 'lowpass', 1600, 200); tone('square', 92, 0, 0.12, 0.08, 0.02); },
    glitch: function () { for (var i = 0; i < 6; i++) tone('square', 200 + Math.random() * 1400, 0, 0.04, 0.05, i * 0.05); },
    stamp: function () { tone('sine', 150, 55, 0.3, 0.45); noise(0.18, 0.3, 'lowpass', 900, 0); },
    sparkle: function () { [1568, 2093, 2637, 3136].forEach(function (f, i) { tone('sine', f, 0, 0.35, 0.07, i * 0.06); }); },
    chime: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone('sine', f, 0, 1.6, 0.08, i * 0.09, 0.05); }); },
    cheer: function () { [784, 988, 1175, 1568].forEach(function (f, i) { tone('triangle', f, 0, 0.25, 0.08, i * 0.05); }); },
    cricket: function () { for (var i = 0; i < 3; i++) tone('sine', 4300, 0, 0.035, 0.025, i * 0.06); }
  };
  function play(n) { if (!soundOn || !AC) return; if (AC.state === 'suspended') AC.resume(); try { SFX[n](); } catch (e) {} }
  var EVENTS = [[0.4, 'chime'], [3.1, 'whoosh'], [9.35, 'whoosh2'], [10.1, 'shout'], [31.4, 'page'], [38.5, 'huh'], [52.1, 'shout'], [60.6, 'ding'], [62.9, 'sparkle'], [76.8, 'lock'], [77.2, 'lock'], [77.6, 'lock'], [78.0, 'lock'], [78.4, 'lock'], [81.5, 'impact'], [81.7, 'glitch'], [84.6, 'stamp'], [85.0, 'sparkle'], [88.1, 'shout'], [96.6, 'cheer'], [97.0, 'sparkle'], [103.4, 'whoosh'], [106.6, 'whoosh2'], [107.4, 'chime'], [108.6, 'sparkle']];
  COINS.forEach(function (c) { EVENTS.push([c.t + 0.55, 'coin']); });
  LINES.forEach(function (l) { if (l[4] === 'chat') EVENTS.push([l[0], 'ping']); });
  for (var ki = 0; ki < 26; ki++) EVENTS.push([64.6 + ki * 0.42 + (ki % 3) * 0.07, 'key']);
  for (var pi = 0; pi < 7; pi++) EVENTS.push([95.0 + pi * 0.18, 'ping']);
  EVENTS.sort(function (a, b) { return a[0] - b[0]; });

  var sndBtn = document.getElementById('s3dSound'), sndBtn2 = document.getElementById('s3dSound2');
  function syncSound() { [sndBtn, sndBtn2].forEach(function (b) { if (!b) return; b.setAttribute('aria-pressed', soundOn ? 'true' : 'false'); b.classList.toggle('is-on', soundOn); var s = b.querySelector('.snd__t'); if (s) s.textContent = soundOn ? 'Suara nyala' : (b === sndBtn2 ? 'Nyalakan suara' : 'Suara mati'); }); }
  function toggleSound() { var v = !soundOn; if (window.motion) motion.set('sound', v); soundOn = v; if (soundOn) { audioInit(); if (AC && AC.state === 'suspended') AC.resume(); play('chime'); } syncSound(); }
  if (window.motion && motion.onchange) motion.onchange(function (s) { var v = !!s.sound; if (v !== soundOn) { soundOn = v; if (v) audioInit(); syncSound(); } });
  [sndBtn, sndBtn2].forEach(function (b) { if (b) b.addEventListener('click', toggleSound); });
  syncSound();
  document.addEventListener('pointerdown', function once() { if (soundOn) { audioInit(); if (AC && AC.state === 'suspended') AC.resume(); } document.removeEventListener('pointerdown', once); });

  /* ================= garis kecepatan ================= */
  var SPEED = [[0, 2.6, 0.35], [2.8, 5.8, 0.9], [8.8, 9.9, 1], [10, 11.4, 0.6], [38.4, 39.6, 0.55], [52, 53.4, 0.6], [60.5, 61.6, 0.6], [81.4, 82.8, 1], [88, 89.4, 0.6], [96.5, 97.6, 0.6], [104.6, 107.4, 1]];
  function speedAt(t) { var v = 0; SPEED.forEach(function (s) { if (t > s[0] && t < s[1]) v = Math.max(v, s[2] * Math.sin(Math.PI * (t - s[0]) / (s[1] - s[0]))); }); return v; }
  function drawSpeed(v) {
    var w = speedCv.width, h = speedCv.height; sctx.clearRect(0, 0, w, h); if (v < 0.02) return;
    var cx = w / 2, cy = h / 2, R0 = Math.min(w, h) * (0.32 - v * 0.08), R1 = Math.hypot(w, h) * 0.6;
    sctx.fillStyle = 'rgba(255,255,255,' + (0.55 * v).toFixed(3) + ')';
    for (var i = 0; i < 90; i++) { var a = Math.random() * Math.PI * 2, wd = (0.004 + Math.random() * 0.012), r0 = R0 + Math.random() * R0 * 0.6; sctx.beginPath(); sctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); sctx.lineTo(cx + Math.cos(a - wd) * R1, cy + Math.sin(a - wd) * R1); sctx.lineTo(cx + Math.cos(a + wd) * R1, cy + Math.sin(a + wd) * R1); sctx.fill(); }
  }

  /* ================= bingkai ================= */
  var W = 1, H = 1, aspectK = 1, cur = 0, target = 0, prevT = 0, world = '', t0 = performance.now(), V = new T.Vector3(), lastSpeed = 0;
  function project(v) { V.copy(v).project(cam); return { x: (V.x + 1) / 2 * W, y: (1 - V.y) / 2 * H, ok: V.z < 1 && V.z > -1 }; }
  function setWorld(w) { if (w === world) return; world = w; ext.visible = w === 'ext'; room.visible = w === 'room'; sky.visible = w === 'sky'; }
  function speakerAt(k, t) { for (var j = 0; j < LINES.length; j++) { var l = LINES[j]; if (l[2] === k && l[4] !== 'chat' && t >= l[0] && t <= l[1]) return l; } return null; }

  function animStudents(t, now) {
    STU.forEach(function (k, i) {
      var c = C[k], u = c.userData, h = u.head, bob = Math.sin(now * 1.7 + i) * 0.015;
      c.visible = !((i < 4 && t > 54.9 && t < 76) || ((k === 'revalina' || k === 'cinta') && t > 64.25 && t < 76));
      u.body.position.y = 0; h.rotation.set(0, 0, 0); h.position.y = u.hip + 0.66 + bob;
      u.aL.rotation.set(-1.2, 0, -0.08); u.aR.rotation.set(-1.2, 0, 0.08);
      var sp = speakerAt(k, t);
      if (sp) { h.rotation.x = Math.sin(now * 9) * 0.05; h.rotation.y = Math.sin(now * 2.3) * 0.12; if (sp[4] === 'shout') { u.aR.rotation.x = -2.5 + Math.sin(now * 8) * 0.2; u.body.position.y = Math.abs(Math.sin(now * 6)) * 0.05; } }
      if (t > 13 && t < 19) { for (var r = 0; r < ROLL.length; r++) if (ROLL[r][0] === k && t > ROLL[r][1] && t < ROLL[r][1] + 0.9) u.aR.rotation.x = -2.9 + Math.sin(now * 10) * 0.25; }
      if (k === 'jahfal' && t > 21.8 && t < 23.4) u.aR.rotation.x = -1.6;
      if (t > 19.4 && t < 28 && !sp) h.rotation.y = Math.max(-0.7, Math.min(0.7, (C.bendahara.position.x - c.position.x) * 0.12));
      if (t > 28.4 && t < 34 && !sp) h.rotation.y = 0;
      if (t > 38.4 && t < 40.3) h.rotation.z = Math.sin(now * 3 + i) * 0.15;
      if (k === 'rafa' && t > 40.6 && t < 43) { u.aR.rotation.x = -2.6; u.aR.rotation.z = 0.5; h.rotation.z = -0.12; }
      if (t > 48 && t < 52) h.rotation.x = 0.22;
      if (t > 55 && t < 64.3 && !sp && (k === 'cinta' || k === 'ardellio' || k === 'revalina')) h.rotation.y = k === 'cinta' ? -0.45 : k === 'ardellio' ? 0.45 : -0.35;
      if (k === 'cinta' && t > 55.4 && t < 57.8) u.aR.rotation.x = -2.2;
      if (k === 'ardellio' && t > 64.3 && t < 76) { h.rotation.x = 0.2; u.aL.rotation.x = -1.32 + Math.sin(now * 16) * 0.12; u.aR.rotation.x = -1.32 + Math.sin(now * 16 + 2) * 0.12; }
      if (k !== 'ardellio' && t > 64.3 && t < 76) { u.aR.rotation.x = -2.1; u.aR.rotation.z = 0.3; h.rotation.x = 0.25; }
      if (t > 76 && t < 88) h.rotation.x = -0.32;
      if (t > 95 && t < 96.6) { u.aR.rotation.x = -2.1; h.rotation.x = 0.2; }
      if (t > 96.6 && t < 103.4) { u.aL.rotation.x = -2.9 + Math.sin(now * 7 + i) * 0.3; u.aR.rotation.x = -2.9 + Math.sin(now * 7 + i + 1) * 0.3; u.body.position.y = Math.abs(Math.sin(now * 4.5 + i)) * 0.12; }
    });
  }
  function bendX(t) { var stops = [[19.4, -5.6], [20.2, -3.9], [21.6, -3.9], [22.4, -1.3], [24.2, -1.3], [24.9, 1.3], [25.6, 1.3], [26.0, 3.9], [27.9, 3.9]]; var i = 0; while (i < stops.length - 2 && t >= stops[i + 1][0]) i++; var a = stops[i], b = stops[i + 1]; return a[1] + (b[1] - a[1]) * sm((t - a[0]) / (b[0] - a[0])); }
  function animNPC(t, now) {
    var b = C.bendahara, bu = b.userData, w = C.wali, wu = w.userData;
    b.visible = (t > 19 && t < 40.3) || (t > 90.9 && t < 103.4);
    w.visible = (t > 27.9 && t < 40.3) || (t > 90.9 && t < 103.4);
    bu.lL.rotation.x = bu.lR.rotation.x = 0; bu.aL.rotation.set(-0.15, 0, -0.1); bu.aR.rotation.set(-1.1, 0, 0.1); bu.head.rotation.set(0, 0, 0); bu.body.position.y = 0;
    if (t < 28) {
      var x = bendX(t), dx = bendX(t + 0.05) - x; b.position.set(x, 0, 1.4);
      var moving = Math.abs(dx) > 0.004; b.rotation.y = moving ? Math.PI / 2 : Math.PI;
      if (moving) { var sw = Math.sin(now * 11) * 0.5; bu.lL.rotation.x = sw; bu.lR.rotation.x = -sw; bu.body.position.y = Math.abs(Math.sin(now * 11)) * 0.04; }
      bu.aL.rotation.x = -1.3;
    } else { b.position.set(2.5, 0, 3.3); b.rotation.y = Math.PI; }
    if (speakerAt('bendahara', t)) bu.head.rotation.x = Math.sin(now * 9) * 0.05;
    if (t > 31.4 && t < 33.8) { bu.aR.rotation.x = -1.3 + Math.sin(now * 14) * 0.2; bu.head.rotation.x = 0.3; }
    if (t > 94 && t < 96.4) bu.aR.rotation.x = -2.8;
    bu.faceMat.map = (t > 31.4 && t < 40.3) ? SPEC.bendahara.faceWorry : (t > 94 ? SPEC.bendahara.faceHappy : SPEC.bendahara.faceTex);
    wu.lL.rotation.x = wu.lR.rotation.x = 0; wu.aL.rotation.set(-0.1, 0, -0.06); wu.aR.rotation.set(-0.1, 0, 0.06); wu.head.rotation.set(0, Math.sin(now * 0.8) * 0.15, 0);
    if (speakerAt('wali', t)) { wu.aR.rotation.x = -1.6 + Math.sin(now * 3) * 0.2; wu.head.rotation.x = Math.sin(now * 8) * 0.04; }
    wu.faceMat.map = t > 96 ? SPEC.wali.faceHappy : SPEC.wali.faceTex;
  }
  function animChain(t, now) {
    chain.visible = t > 76 && t < 88.6;
    if (!chain.visible) return;
    var out = 1 - sm(seg(t, 87.6, 88.4));
    CHN.forEach(function (c, i) {
      var s = spring(seg(t, 76.6 + i * 0.4, 77.3 + i * 0.4)) * out; c.g.scale.setScalar(Math.max(0.0001, s)); c.g.position.y = c.y + Math.sin(now * 1.5 + i) * 0.06; c.g.rotation.y = Math.sin(now * 0.9 + i) * 0.08;
      if (c.link) c.link.scale.x = Math.max(0.0001, sm(seg(t, 76.9 + i * 0.4, 77.4 + i * 0.4)) * out);
      c.face.map = c.base;
    });
    var bi = 2, broken = t > 81.5 && t < 83.3;
    if (broken) { var bb = CHN[bi]; bb.g.position.x = -4.3 + bi * 1.72 + (Math.random() - 0.5) * 0.12; bb.g.rotation.z = Math.sin(now * 40) * 0.08; bb.face.map = BAD; CHN[bi].link.scale.x = 0.0001; CHN[bi + 1].link.scale.x = 0.0001; }
    else { CHN[bi].g.position.x = -4.3 + bi * 1.72; CHN[bi].g.rotation.z = 0; }
    var hx = -4.3 + bi * 1.72, hd = sm(seg(t, 80, 81.4)) * (1 - sm(seg(t, 82.2, 83))); hand.position.set(hx, 6 - hd * 4.6, 0.25); hand.visible = hd > 0.01;
    var last = CHN[5], sp = seg(t, 83.8, 84.6), sd = sm(sp) * (1 - sm(seg(t, 85.4, 86.2)));
    stamp.visible = t > 83.8 && t < 86.2; stamp.position.set(last.g.position.x, 3.2 - sd * 2.6, 0.3);
    if (t >= 84.6) last.face.map = OKT;
  }
  function animEmotes(t, now) {
    emoteSprites.forEach(function (e) {
      var on = t >= e.t0 && t <= e.t1 && C[e.k].visible !== false;
      e.s.visible = on; if (!on) return;
      headTop(C[e.k], e.s.position); e.s.position.x += e.off; e.s.position.y += e.up + (e.kind === 'phone' ? -0.15 : 0.1 + Math.sin(now * 4) * 0.04);
      var p = spring(seg(t, e.t0, e.t0 + 0.6)) * (1 - sm(seg(t, e.t1 - 0.3, e.t1))), sc = e.kind === 'phone' ? 0.6 : 0.5; e.s.scale.set(Math.max(0.0001, sc * p), Math.max(0.0001, sc * p), 1);
      e.s.material.rotation = e.kind === 'spark' ? now * 1.5 : e.kind === '?' ? Math.sin(now * 5) * 0.15 : 0;
    });
    COINS.forEach(function (c) {
      var u = seg(t, c.t, c.t + 0.55), on = u > 0 && u < 1; c.s.visible = on; if (!on) return;
      var a = C[c.k].position, b2 = R.tin.position; c.s.position.set(a.x + (b2.x - a.x) * u, 1.6 + Math.sin(u * Math.PI) * 0.9, a.z + 0.8 + (b2.z - a.z - 0.8) * u); c.s.material.rotation = u * 8;
    });
  }
  function updateHUD(t) {
    var spoken = 0;
    BUBS.forEach(function (b) {
      var l = b.l, on = t >= l[0] && t <= l[1];
      if (b.chat) { b.el.classList.toggle('on', on); return; }
      var ch = C[l[2]];
      if (!on || world !== 'room' || !ch || !ch.visible) { if (b.on) { b.el.classList.remove('on'); b.on = false; } return; }
      headTop(ch, HEADV); var p = project(HEADV);
      if (!p.ok) { if (b.on) { b.el.classList.remove('on'); b.on = false; } return; }
      if (!b.on) { b.el.classList.add('on'); b.on = true; }
      var len = l[3].length, n = Math.round(len * cl((t - l[0]) / Math.max(0.6, (l[1] - l[0]) * 0.5)));
      if (n !== b.n) { b.txt.textContent = l[3].slice(0, Math.max(1, n)); b.n = n; }
      var bw = b.el.offsetWidth, bh = b.el.offsetHeight, x = p.x - bw * 0.35, y = p.y - bh - 18 - (spoken % 2) * 22;
      var minY = mobile ? 128 : 88; x = Math.max(12, Math.min(W - bw - 12, x)); y = Math.max(minY, Math.min(H - bh - (mobile ? 110 : 30), y));
      b.el.style.left = x.toFixed(1) + 'px'; b.el.style.top = y.toFixed(1) + 'px'; b.el.style.setProperty('--tx', Math.max(18, Math.min(bw - 18, p.x - x)).toFixed(0) + 'px');
      spoken++;
    });
    var nl = null; for (var i = 0; i < NARRS.length; i++) if (t >= NARRS[i][0] && t <= NARRS[i][1]) nl = NARRS[i];
    narrEl.classList.toggle('on', !!nl);
    if (nl) { if (narrEl._l !== nl) { narrEl._l = nl; narrWhen.textContent = nl[5] || ''; } var n2 = Math.round(nl[3].length * cl((t - nl[0]) / Math.max(0.8, (nl[1] - nl[0]) * 0.55))); if (narrEl._n !== n2) { narrTxt.textContent = nl[3].slice(0, n2); narrEl._n = n2; } }
    chatEl.classList.toggle('on', t > 64.8 && t < 73.8);
    stepsEl.classList.toggle('on', t > 76.4 && t < 87.8);
    Array.prototype.forEach.call(stepsEl.children, function (s, i) { s.classList.toggle('lit', t > [76.6, 79.8, 83.6][i]); });
    impactEl.classList.toggle('on', t > 81.5 && t < 83.0);
    endEl.classList.toggle('on', t > 109.2);
    cards.forEach(function (c) { var a = +c.getAttribute('data-t0'), b2 = +c.getAttribute('data-t1'); c.classList.toggle('on', t >= a && t <= b2); });
    LBL.forEach(function (lb) {
      var c = lb.sky ? lb.c : C[lb.k], on = lb.sky ? (world === 'sky' && t > lb.t) : (world === 'room' && t > lb.t && t < 19.2);
      lb.el.classList.toggle('on', on); if (!on) return;
      headTop(c, HEADV); HEADV.y -= 0.05; var p = project(HEADV); lb.el.style.left = p.x.toFixed(1) + 'px'; lb.el.style.top = p.y.toFixed(1) + 'px';
    });
  }
  function frame(nowMs) {
    var now = (nowMs - t0) / 1000; cur += (target - cur) * 0.085; if (Math.abs(target - cur) < 0.00005) cur = target;
    var t = cur * TOTAL;
    if (soundOn && AC) {
      var dt = t - prevT;
      if (dt > 0 && dt < 3) { for (var i = 0; i < EVENTS.length; i++) { var e = EVENTS[i]; if (e[0] > prevT && e[0] <= t) play(e[1]); } BUBS.forEach(function (b) { if (!b.chat && b.l[0] > prevT && b.l[0] <= t) play(b.l[4] === 'shout' ? 'shout' : b.l[4] === 'think' ? 'think' : 'pop'); }); }
      else if (Math.abs(dt) >= 3) play('whoosh2');
      if (windG) windG.gain.setTargetAtTime((world !== 'room' ? 0.06 : 0) + mood.over * 0.03, AC.currentTime, 0.4);
      if (mood.night > 0.7 && Math.random() < 0.012) play('cricket');
    }
    prevT = t;
    setWorld(t < 9.75 ? 'ext' : t < 107.3 ? 'room' : 'sky');
    moodAt(t);
    if (world === 'ext') {
      scene.background.setHex(0x9fcbff); hemi.intensity = 1.05; sun.intensity = 1.25; lamp.intensity = 0; rim.intensity = 0;
      var part = sm(seg(t, 0.2, 3.2)); curtain.forEach(function (c) { c.m.position.x = c.x + (c.x < 0 ? -1 : 1) * part * 46; c.m.material.opacity = 0.96 * (1 - part * 0.6); });
      ext.userData.hl.material.opacity = (0.35 + 0.3 * Math.sin(now * 4)) * win(t, 6, 9.8);
      pathAt(KEXT, t);
    } else if (world === 'room') {
      scene.background.copy(mood.bg); hemi.intensity = mood.hemi; sun.intensity = mood.sun; lamp.intensity = mood.night * 2.6; rim.intensity = mood.night * 0.6;
      R.winMats.forEach(function (m) { m.map = mood.night > 0.5 ? R.nightTex : R.skyTex; m.color.setRGB(1 - mood.over * 0.35, 1 - mood.over * 0.3, 1 - mood.over * 0.2); });
      R.shafts.forEach(function (s, i) { s.material.opacity = 0.42 * (1 - mood.night) * (1 - mood.over * 0.85) * (0.85 + Math.sin(now * 0.7 + i) * 0.15); });
      dust.material.opacity = 0.75 * (1 - mood.night * 0.6); var dp = dustG.attributes.position.array; for (var d = 0; d < dustN; d++) { dp[d * 3 + 1] += 0.0016; if (dp[d * 3 + 1] > 4.6) dp[d * 3 + 1] = 0.1; dp[d * 3] += Math.sin(now * 0.5 + d) * 0.0012; } dustG.attributes.position.needsUpdate = true;
      R.wbMat.map = t < 28 ? R.wb[0] : t < 90.9 ? R.wb[1] : R.wb[2];
      var lit = mood.night > 0.3 || (t > 55 && t < 64.3); if ((lapScr.map === lapCode) !== lit) { lapScr.map = lit ? lapCode : null; lapScr.color.setHex(lit ? 0xffffff : 0x24345e); lapScr.needsUpdate = true; }
      var hrs = clockAt(t); R.hourH.rotation.z = -(hrs % 12) / 12 * Math.PI * 2; R.minH.rotation.z = -(hrs % 1) * Math.PI * 2;
      if (t < 28) { R.tin.position.set(C.bendahara.position.x - 0.42, 1.12, 1.62); R.tin.rotation.y = Math.sin(now * 3) * 0.1; } else { R.tin.position.set(-4.2, 1.18, 3.5); R.tin.rotation.y = 0; }
      animStudents(t, now); animNPC(t, now); animChain(t, now); animEmotes(t, now);
      var ps = spring(seg(t, 102.6, 103.5)) * (1 + 1.4 * sm(seg(t, 103.5, 107.2))); phone.visible = t > 102.6; phone.scale.setScalar(Math.max(0.0001, ps)); phone.rotation.y = (1 - sm(seg(t, 102.6, 103.6))) * Math.PI * 2;
      pathAt(KROOM, t);
    } else {
      scene.background.setHex(0x5ea3f4); hemi.intensity = 1.1; sun.intensity = 1.2; lamp.intensity = 0; rim.intensity = 0.4;
      SKYC.forEach(function (c, i) { var u = c.userData, up = spring(seg(t, 107.8 + i * 0.22, 108.8 + i * 0.22)); c.position.y = 0.15 - (1 - up) * 3 + 0 * 0 + Math.abs(Math.sin(now * 2.4 + i * 0.8)) * 0.1; c.visible = up > 0.001; u.aL.rotation.x = -2.8 + Math.sin(now * 5 + i) * 0.35; u.aR.rotation.x = -2.8 + Math.sin(now * 5 + i + 1.3) * 0.35; u.head.rotation.y = Math.sin(now * 1.1 + i) * 0.25; var sw = Math.sin(now * 5 + i) * 0.12; u.lL.rotation.x = sw; u.lR.rotation.x = -sw; });
      pathAt(KSKY, t); if (cam.aspect < 0.8) { P3[1] += 1.9; L3[1] += 2.3; }
    }
    sparks.visible = (world === 'room' && t > 96.6 && t < 103.5) || world === 'sky';
    if (sparks.visible) { sparks.material.opacity = 0.6 + Math.sin(now * 6) * 0.3; sparks.position.set(0, world === 'sky' ? -0.3 : 0, world === 'sky' ? 0.5 : -0.6); sparks.rotation.y = now * 0.1; }
    var k = aspectK, shake = bump(t, 81.6, 0.9) * 0.09 + bump(t, 84.6, 0.4) * 0.05 + bump(t, 96.8, 0.5) * 0.03;
    cam.position.set(L3[0] + (P3[0] - L3[0]) * k + Math.sin(now * 0.6) * 0.03 + (Math.random() - 0.5) * shake, L3[1] + (P3[1] - L3[1]) * k + Math.sin(now * 0.8) * 0.02 + (Math.random() - 0.5) * shake, L3[2] + (P3[2] - L3[2]) * k);
    if (world === 'room' && cam.position.y < 6) { cam.position.x = Math.max(-7.1, Math.min(7.1, cam.position.x)); cam.position.z = Math.max(-5.75, Math.min(4.8, cam.position.z)); }
    cam.lookAt(L3[0], L3[1], L3[2]);
    CLOUDS.forEach(function (m, i) { if (m.parent.visible) { m.quaternion.copy(cam.quaternion); } });
    if (world === 'room') R.front.visible = cam.position.z < 4.85;
    var flash = Math.max(bump(t, 9.75, 0.45), bump(t, 107.3, 0.5), bump(t, 81.5, 0.25) * 0.7, bump(t, 84.6, 0.18) * 0.4);
    flashEl.style.opacity = flash.toFixed(3);
    stage.style.setProperty('--tone', Math.max(win(t, 48, 51.9, 0.6) * 0.5, win(t, 81.4, 83.1, 0.2) * 0.6, win(t, 38.4, 40.2, 0.3) * 0.3).toFixed(3));
    stage.style.setProperty('--bars', Math.max(win(t, 40.3, 52, 0.8), win(t, 64.3, 76, 0.8) * 0.8, win(t, 103.4, 107.3, 0.6)).toFixed(3));
    stage.style.setProperty('--part', sm(seg(t, 0.1, 2.4)).toFixed(3));
    var sv = speedAt(t); if (sv > 0.02 || lastSpeed > 0.02) drawSpeed(sv); lastSpeed = sv;
    updateHUD(t);
    for (var q = 0; q < dots.length; q++) dots[q].classList.toggle('on', t >= CH[q][0] && (q === CH.length - 1 || t < CH[q + 1][0]));
    if (skipBtn) skipBtn.classList.toggle('off', t > 107);
    renderer.render(scene, cam);
  }

  function resize() {
    W = stage.clientWidth; H = stage.clientHeight; if (!W || !H) return;
    renderer.setSize(W, H, false); cam.aspect = W / H; cam.fov = cam.aspect < 0.8 ? 62 : cam.aspect < 1.2 ? 52 : 45; aspectK = cam.aspect < 0.8 ? 1.45 : cam.aspect < 1.2 ? 1.18 : 1; cam.updateProjectionMatrix();
    speedCv.width = Math.round(W * 0.75); speedCv.height = Math.round(H * 0.75);
    var portrait = cam.aspect < 0.8; SKYC.forEach(function (c, i) { if (portrait) { var back = i >= 4, j = back ? i - 4 : i; c.position.set(back ? (j - 1) * 1.7 : (j - 1.5) * 1.6, 0.15, back ? -1.3 : 0.5); } else c.position.set((i - 3) * 1.65, 0.15, (i % 2) * 0.3 - 0.1); });
  }

  /* ================= navigasi ================= */
  var dotsWrap = stage.querySelector('.story2__dots'); dotsWrap.innerHTML = '';
  var dots = CH.map(function (c) { var d = document.createElement('i'); d.setAttribute('role', 'button'); d.setAttribute('tabindex', '0'); d.setAttribute('aria-label', 'Ke ' + c[1]); d.title = c[1]; dotsWrap.appendChild(d); return d; });
  var tween = null;
  var play = document.getElementById('s3dPlay');
  var autoStart = null, autoProgress = 0;
  function stopAuto() {
    if (autoStart === null) return;
    autoStart = null;
    document.documentElement.style.scrollBehavior = '';
    if (play) play.textContent = 'Putar otomatis';
  }
  function storyTop() { return sec.getBoundingClientRect().top + window.scrollY; }
  function startAuto() {
    stopTween();
    var progress = (window.scrollY - storyTop()) / Math.max(1, range());
    autoProgress = progress >= 0.999 ? 0 : Math.max(0, progress);
    autoStart = performance.now();
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, storyTop() + range() * autoProgress);
    if (play) play.textContent = 'Jeda cerita';
  }
  function advanceAuto(now) {
    if (autoStart === null) return;
    var progress = Math.min(1, autoProgress + Math.max(0, now - autoStart) / (TOTAL * 1000));
    window.scrollTo(0, storyTop() + range() * progress);
    target = progress;
    if (progress === 1) stopAuto();
  }
  function manual() { stopAuto(); stopTween(); }
  if (play) play.addEventListener('click', function () {
    if (autoStart === null) startAuto(); else stopAuto();
  });
  function stopTween() { if (tween) { tween.kill(); tween = null; document.documentElement.style.scrollBehavior = ''; } }
  function scrollToY(y) {
    manual(); var html = document.documentElement, o = { v: window.pageYOffset }; html.style.scrollBehavior = 'auto';
    tween = gsap.to(o, { v: y, duration: Math.min(2.4, 0.6 + Math.abs(y - o.v) / 5000), ease: 'power2.inOut', onUpdate: function () { window.scrollTo(0, o.v); }, onComplete: function () { html.style.scrollBehavior = ''; tween = null; } });
  }
  function range() { return sec.offsetHeight - stage.clientHeight; }
  function toT(t) { scrollToY(storyTop() + range() * (t / TOTAL)); }
  dots.forEach(function (d, i) { var go = function () { toT(CH[i][0] + (i ? 0.6 : 0)); }; d.addEventListener('click', go); d.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); });
  var replay = document.getElementById('s3dReplay'), skipBtn = document.getElementById('s3dSkip');
  if (replay) replay.addEventListener('click', function () { toT(0); });
  if (skipBtn) skipBtn.addEventListener('click', function () { scrollToY(storyTop() + sec.offsetHeight); });
  window.addEventListener('wheel', manual, { passive: true });
  window.addEventListener('touchmove', manual, { passive: true });
  window.addEventListener('keydown', function (event) {
    if (event.defaultPrevented || event.target.closest('input, textarea, select, [contenteditable]')) return;
    if (event.key === ' ' && event.target.closest('button, a')) return;
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) manual();
  });

  resize(); window.addEventListener('resize', resize);
  ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom bottom', onUpdate: function (s) { target = s.progress; } });
  ScrollTrigger.create({ trigger: sec, start: 'top bottom', end: 'top top', onUpdate: function (s) { stage.style.setProperty('--enter', s.progress.toFixed(3)); } });
  var raf = null, inView = false;
  function loop(now) {
    advanceAuto(now);
    frame(now);
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (raf === null && inView && !document.hidden) {
      resize();
      raf = requestAnimationFrame(loop);
    }
  }
  function stop() {
    manual();
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
  }
  new IntersectionObserver(function (entries) {
    inView = entries[0].isIntersecting;
    if (inView) start(); else stop();
  }, { rootMargin: '20% 0px' }).observe(sec);
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  window.__s3d = { set: function (t) { target = cur = t / TOTAL; prevT = t; frame(performance.now()); }, TOTAL: TOTAL };
})();
