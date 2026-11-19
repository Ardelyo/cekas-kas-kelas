// Character geometry and materials from CEKAS Episode 01.
const T = window.THREE;
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
    if (s.photo) s.faceTex = load('../assets/team/face-' + s.photo + '.webp');
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

// Tokoh buatan pemain: wajah dari foto, warna kulit/rambut diambil dari foto itu.
function registerChar(k, o) {
  SPEC[k] = { skin: o.skin, hair: o.hair, top: o.top, bot: o.bot || 0x34405e, style: o.style, collar: o.top === 0xf2f5fb ? 0xffffff : undefined, faceTex: load(o.face) };
}

export { mkChar, registerChar };
