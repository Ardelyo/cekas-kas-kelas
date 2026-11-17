/* CEKAS "Langit" — Tentang: film pendek 3D (blok) yang dimainkan lewat gulir.
   Kelas blok -> masalah kas -> malam -> rantai catatan -> ponsel -> masuk ke langit. */
(function () {
  'use strict';
  var sec = document.querySelector('#cerita'); if (!sec) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function webgl() { try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; } }
  if (reduce || !window.THREE || !window.gsap || !window.ScrollTrigger || !webgl()) { sec.classList.add('is-static'); return; }
  gsap.registerPlugin(ScrollTrigger);
  var T = THREE, stage = sec.querySelector('.s3d__stage'), canvas = sec.querySelector('#s3d');
  var sk0 = null;
  var caps = Array.prototype.slice.call(sec.querySelectorAll('.cap')), dots = Array.prototype.slice.call(sec.querySelectorAll('.story2__dots i')), flashEl = sec.querySelector('.s3d__flash');

  var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  var scene = new T.Scene(), cam = new T.PerspectiveCamera(45, 1, 0.1, 120);
  var DAY = new T.Color(0xbfdcff), NIGHT = new T.Color(0x07122e), SKY = new T.Color(0x5ea3f4);
  scene.background = DAY.clone();
  var hemi = new T.HemisphereLight(0xffffff, 0x9bb8e8, 1.0), sun = new T.DirectionalLight(0xffffff, 1.1), lamp = new T.PointLight(0x9ad0ff, 0, 9);
  sun.position.set(4, 9, 8); lamp.position.set(3.6, 2.4, 0.2); scene.add(hemi, sun, lamp);

  function lam(c) { return new T.MeshLambertMaterial({ color: c }); }
  function box(w, h, d, mat, x, y, z) { var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x || 0, y || 0, z || 0); return m; }
  function ctex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; }
  function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  var loader = new T.TextureLoader();
  function load(url) { var t = loader.load(url); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; }

  /* ---------- data tokoh ---------- */
  var PEOPLE = {
    jahfal: { name: 'Jahfal', skin: 0xc9946b, hair: 0x211b18, top: 0xcdbb55, bot: 0x3b4a6b },
    ardellio: { name: 'Ardellio', skin: 0xd9a67f, hair: 0x16130f, top: 0xf0f3f9, bot: 0x72839f },
    nabila: { name: 'Nabila', skin: 0xe5b894, hair: 0xd8d9d6, top: 0x8b9097, bot: 0x40454f },
    rafa: { name: 'Rafa', skin: 0xb98863, hair: 0x14110e, top: 0x1b1c20, bot: 0x3a3d46 },
    revalina: { name: 'Revalina', skin: 0xe0a98a, hair: 0x141414, top: 0x2a2158, bot: 0x3a3d52 },
    tarina: { name: 'Tarina', skin: 0xe3b494, hair: 0x17120f, top: 0xbcd3ee, bot: 0x44546e }
  };
  Object.keys(PEOPLE).forEach(function (k) { PEOPLE[k].face = load('assets/team/face-' + k + '.webp'); });
  var QTEX = ctex(256, 256, function (x, w, h) { x.fillStyle = '#dbe8fb'; x.fillRect(0, 0, w, h); x.fillStyle = '#6f8fc4'; x.font = '700 170px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', w / 2, h / 2 + 8); x.strokeStyle = '#6f8fc4'; x.lineWidth = 8; x.setLineDash([22, 16]); x.strokeRect(10, 10, w - 20, h - 20); });
  var SLOT = { name: 'Segera', skin: 0xc7d2e6, hair: 0xaec0de, top: 0xe6eefb, bot: 0x9db2d6, face: QTEX };

  function label(text, dark) {
    var t = ctex(256, 64, function (x, w, h) { rr(x, 6, 8, w - 12, h - 16, 24); x.fillStyle = dark ? 'rgba(10,30,80,.9)' : 'rgba(255,255,255,.95)'; x.fill(); x.fillStyle = dark ? '#fff' : '#0b1b3a'; x.font = '700 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 2); });
    var s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(1.3, 0.33, 1); s.renderOrder = 10; return s;
  }
  function mkChar(P, seated) {
    var g = new T.Group(), by = seated ? 0.6 : 0.75;
    var mS = lam(P.skin), mH = lam(P.hair), mT = lam(P.top), mB = lam(P.bot);
    var mF = new T.MeshLambertMaterial({ map: P.face, emissive: 0xffffff, emissiveMap: P.face, emissiveIntensity: 0.4 });
    var head = box(0.64, 0.64, 0.64, [mH, mH, mH, mS, mF, mH]); head.position.y = by + 0.65 + 0.34; g.add(head);
    g.add(box(0.56, 0.66, 0.32, mT, 0, by + 0.33, 0));
    function arm(sx) { var p = new T.Group(); p.position.set(sx * 0.39, by + 0.6, 0); p.add(box(0.2, 0.46, 0.2, mT, 0, -0.23, 0)); p.add(box(0.19, 0.16, 0.19, mS, 0, -0.54, 0)); g.add(p); return p; }
    var aL = arm(-1), aR = arm(1);
    if (seated) { [-1, 1].forEach(function (s) { g.add(box(0.23, 0.23, 0.56, mB, s * 0.15, 0.55, 0.26)); g.add(box(0.23, 0.5, 0.23, mB, s * 0.15, 0.26, 0.52)); }); }
    else { [-1, 1].forEach(function (s) { g.add(box(0.24, 0.75, 0.26, mB, s * 0.15, 0.375, 0)); }); }
    var tag = label(P.name); tag.position.y = by + 1.75; g.add(tag);
    g.userData = { head: head, aL: aL, aR: aR, baseHeadY: head.position.y, tag: tag };
    return g;
  }

  /* ---------- ruang kelas ---------- */
  var room = new T.Group(); scene.add(room);
  var floor = new T.Mesh(new T.PlaneGeometry(15, 11), lam(0xdfe8f7)); floor.rotation.x = -Math.PI / 2; room.add(floor);
  var stripe = new T.Mesh(new T.PlaneGeometry(15, 11), new T.MeshLambertMaterial({ color: 0xcfdcf2 })); stripe.rotation.x = -Math.PI / 2; stripe.position.set(0, 0.01, 0); stripe.scale.set(1, 0.0001, 1); // placeholder agar urutan tetap
  var back = box(15, 6.4, 0.2, lam(0x9ec3f5), 0, 3.2, -5.6), left = box(0.2, 6.4, 11, lam(0xaec9f2), -7.5, 3.2, 0), right = box(0.2, 6.4, 11, lam(0xaec9f2), 7.5, 3.2, 0);
  room.add(back, left, right, box(15, 0.35, 0.3, lam(0x7da6e6), 0, 0.17, -5.4));
  var winMat = new T.MeshBasicMaterial({ color: 0xe6f3ff }); var win = new T.Mesh(new T.PlaneGeometry(4.2, 2.6), winMat); win.rotation.y = Math.PI / 2; win.position.set(-7.38, 3.3, -0.5); room.add(win);
  room.add(box(0.12, 2.8, 4.4, lam(0xffffff), -7.36, 3.3, -0.5));
  function wbTex(line1, line2, ok) { return ctex(1024, 380, function (x, w, h) { x.fillStyle = '#f7fbff'; x.fillRect(0, 0, w, h); x.strokeStyle = ok ? '#d6ff3f' : '#9db2d6'; x.lineWidth = 14; x.strokeRect(7, 7, w - 14, h - 14); x.fillStyle = '#0b1b3a'; x.textAlign = 'center'; x.font = '800 118px sans-serif'; x.fillText(line1, w / 2, 170); x.fillStyle = ok ? '#1e6fe8' : '#6f8fc4'; x.font = '600 62px sans-serif'; x.fillText(line2, w / 2, 290); }); }
  var wbA = wbTex('Kas kelas?', 'Ke mana perginya?', false), wbB = wbTex('Kas terbuka.', 'Terverifikasi. Bisa dilihat semua.', true);
  var wbMat = new T.MeshBasicMaterial({ map: wbA }); var wb = new T.Mesh(new T.PlaneGeometry(7.4, 2.75), wbMat); wb.position.set(0, 3.3, -5.46); room.add(wb);
  room.add(box(7.7, 0.14, 0.16, lam(0x6b7fa3), 0, 1.9, -5.45));

  var SEAT = [['revalina', -6], ['jahfal', -3.6], ['nabila', -1.2], ['rafa', 1.2], ['ardellio', 3.6], ['tarina', 6]], chars = {}, deskMat = lam(0xf2f6ff), legMat = lam(0x8aa0c9);
  SEAT.forEach(function (s) {
    var k = s[0], x = s[1], c = mkChar(PEOPLE[k], true); c.position.set(x, 0, -1.6); room.add(c); chars[k] = c;
    room.add(box(0.9, 0.1, 0.9, legMat, x, 0.5, -1.62)); // bangku
    var top = box(1.9, 0.09, 0.95, deskMat, x, 0.88, -0.75); room.add(top);
    [[-0.85, -0.38], [0.85, -0.38], [-0.85, 0.38], [0.85, 0.38]].forEach(function (o) { room.add(box(0.08, 0.84, 0.08, legMat, x + o[0], 0.42, -0.75 + o[1])); });
    var sh = new T.Mesh(new T.CircleGeometry(0.75, 20), new T.MeshBasicMaterial({ color: 0x1a2a55, transparent: true, opacity: 0.18 })); sh.rotation.x = -Math.PI / 2; sh.position.set(x, 0.02, -1.0); sh.scale.set(1.3, 1, 1.1); room.add(sh);
  });
  // laptop Ardellio
  var lapGlow = new T.MeshBasicMaterial({ color: 0x1b2a55 }), lap = new T.Group(); lap.position.set(3.6, 0.93, -0.7);
  lap.add(box(0.95, 0.05, 0.65, lam(0x3b4660), 0, 0, 0)); var scr = box(0.95, 0.62, 0.05, [lam(0x3b4660), lam(0x3b4660), lam(0x3b4660), lam(0x3b4660), lam(0x3b4660), lapGlow]); scr.position.set(0, 0.33, -0.3); scr.rotation.x = -0.12; lap.add(scr); room.add(lap);
  var lapCode = ctex(256, 160, function (x, w, h) { x.fillStyle = '#0b1b3a'; x.fillRect(0, 0, w, h); var cols = ['#d6ff3f', '#7fb8ff', '#ffffff']; for (var i = 0; i < 9; i++) { x.fillStyle = cols[i % 3]; x.fillRect(16 + (i % 3) * 14, 14 + i * 15, 40 + ((i * 37) % 120), 7); } });

  /* ---------- rantai catatan ---------- */
  var chain = new T.Group(); chain.position.set(0, 5.4, -2.8); room.add(chain);
  var HASH = ['9d28', '0c5d', 'cbb4', 'b360', 'e7a1'], chainItems = [];
  HASH.concat(['ok']).forEach(function (h, i) {
    var ok = h === 'ok';
    var tx = ctex(256, 140, function (x, w, hh) { rr(x, 6, 6, w - 12, hh - 12, 26); x.fillStyle = ok ? '#d6ff3f' : '#0d2a66'; x.fill(); x.lineWidth = 6; x.strokeStyle = ok ? '#ffffff' : '#d6ff3f'; x.stroke(); x.fillStyle = ok ? '#1a2400' : '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = ok ? '800 46px sans-serif' : '700 56px monospace'; x.fillText(ok ? '✓ Wali' : h, w / 2, hh / 2 + 2); });
    var m = new T.Mesh(new T.BoxGeometry(1.2, 0.66, 0.3), [lam(0x0d2a66), lam(0x0d2a66), lam(0x0d2a66), lam(0x0d2a66), new T.MeshBasicMaterial({ map: tx }), lam(0x0d2a66)]);
    m.position.set(-3.6 + i * 1.44, Math.sin(i * 0.9) * 0.25, 0); chain.add(m);
    var link = null; if (i > 0) { link = box(0.3, 0.09, 0.09, new T.MeshBasicMaterial({ color: 0xd6ff3f }), m.position.x - 0.72, m.position.y, 0); chain.add(link); }
    chainItems.push({ m: m, link: link, y: m.position.y });
  });

  /* ---------- ponsel CEKAS ---------- */
  var phone = new T.Group(); phone.position.set(0, 2.2, 2.2); scene.add(phone);
  var phoneBody = box(1.3, 2.6, 0.14, lam(0x0a1a44), 0, 0, 0); phone.add(phoneBody);
  var screenTex = ctex(512, 1024, function (x, w, h) {
    var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5ea3f4'); g.addColorStop(1, '#1e6fe8'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.28)'; x.beginPath(); x.arc(110, 860, 120, 0, 7); x.arc(250, 890, 150, 0, 7); x.arc(400, 850, 110, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(70, 80, 24, 0, 7); x.arc(104, 74, 30, 0, 7); x.arc(138, 82, 22, 0, 7); x.fill(); x.font = '800 54px sans-serif'; x.textBaseline = 'middle'; x.fillText('cekas', 168, 80);
    rr(x, 36, 150, w - 72, 230, 36); x.fillStyle = 'rgba(255,255,255,.96)'; x.fill(); x.fillStyle = '#5b6b8c'; x.font = '600 28px sans-serif'; x.fillText('Kas kelas XI-F2', 70, 200); x.fillStyle = '#0b1b3a'; x.font = '800 66px sans-serif'; x.fillText('Terbuka', 70, 275); x.fillStyle = '#1e6fe8'; x.font = '700 30px sans-serif'; x.fillText('✓ Disahkan Wali Kelas', 70, 340);
    for (var i = 0; i < 3; i++) { rr(x, 36, 410 + i * 108, w - 72, 90, 26); x.fillStyle = 'rgba(255,255,255,.9)'; x.fill(); x.fillStyle = i === 1 ? '#d6ff3f' : '#cfe0fb'; x.beginPath(); x.arc(84, 455 + i * 108, 22, 0, 7); x.fill(); x.fillStyle = '#0b1b3a'; rr(x, 124, 436 + i * 108, 190 - i * 24, 16, 8); x.fill(); x.fillStyle = '#9db2d6'; rr(x, 124, 464 + i * 108, 120, 12, 6); x.fill(); }
    rr(x, 36, 760, w - 72, 100, 50); x.fillStyle = '#d6ff3f'; x.fill(); x.fillStyle = '#1a2400'; x.font = '800 40px sans-serif'; x.textAlign = 'center'; x.fillText('+ Catat kas', w / 2, 812);
  });
  var phoneScreen = new T.Mesh(new T.PlaneGeometry(1.2, 2.4), new T.MeshBasicMaterial({ map: screenTex })); phoneScreen.position.z = 0.075; phone.add(phoneScreen); phone.visible = false;

  /* ---------- dunia langit ---------- */
  var skyW = new T.Group(); skyW.visible = false; scene.add(skyW);
  var cloudSet = [['a', 30, -26, 4, -6], ['b', 14, -14, 9, 8], ['d', 12, 12, 7, -8], ['b', 16, 18, 12, 4], ['a', 36, 0, 14, -34], ['d', 10, -9, 3, 5], ['b', 12, 7, 2, -2], ['d', 14, 20, 5, -12], ['b', 18, -22, 8, -20]], clouds = [];
  cloudSet.forEach(function (c) {
    var t = load('assets/sky/cloud-' + c[0] + '.webp'), m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.95 }));
    t.addEventListener && 0; m.scale.set(c[1], c[1] * 0.6, 1); m.position.set(c[2], c[3], -2 + (c[4] || -6)); skyW.add(m); clouds.push(m);
    var im = new Image(); im.onload = function () { m.scale.y = c[1] * im.height / im.width; }; im.src = 'assets/sky/cloud-' + c[0] + '.webp';
  });
  var slabMat = new T.MeshBasicMaterial({ color: 0xffffff }); [[16, 0.7, 5, 0, -0.35, 0], [12, 0.6, 4, 1, -0.7, -0.6], [9, 0.8, 3, -3, -0.55, 0.4], [7, 0.7, 3, 4, -0.5, 0.5]].forEach(function (s) { skyW.add(box(s[0], s[1], s[2], slabMat, s[3], s[4], s[5])); });
  var SKYSEAT = [['ardellio', PEOPLE.ardellio], ['rafa', PEOPLE.rafa], ['nabila', PEOPLE.nabila], ['jahfal', PEOPLE.jahfal], ['revalina', PEOPLE.revalina], ['tarina', PEOPLE.tarina], ['s1', SLOT]], skyChars = [];
  SKYSEAT.forEach(function (s, i) { var c = mkChar(s[1], false); c.position.set((i - 3) * 1.75, 0, 0.2 + (i % 2) * 0.35); skyW.add(c); skyChars.push(c); });

  /* ---------- kamera ---------- */
  var KF = [
    [0.00, 0, 17, 10.5, 0, 0, -1],
    [0.10, 0, 4.8, 11.2, 0, 1.5, -1.5],
    [0.17, -2.4, 2.3, 3.6, -2.4, 1.45, -1.6],
    [0.31, -2.4, 2.15, 3.3, -2.4, 1.5, -1.6],
    [0.37, 1.2, 2.1, 3.2, 1.2, 1.5, -1.6],
    [0.46, 1.2, 2.0, 3.0, 1.2, 1.5, -1.6],
    [0.51, 3.6, 2.1, 2.6, 3.6, 1.35, -1.6],
    [0.57, 3.6, 2.3, 3.0, 3.0, 1.6, -1.4],
    [0.62, 0, 5.4, 11.5, 0, 3.4, -2],
    [0.70, 0, 3.8, 9, 0, 2.4, -1],
    [0.78, 0, 2.3, 8.2, 0, 2.2, 2.2],
    [0.855, 0, 2.2, 3.9, 0, 2.2, 2.2],
    [0.88, 0, 2.2, 3.3, 0, 2.2, 2.2]
  ];
  var SKYKF = [[0.88, 0, 3.4, 12.5, 0, 2.1, 0], [1.0, 0, 2.9, 9.6, 0, 2.3, 0]];
  function sm(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function seg(p, a, b) { return Math.max(0, Math.min(1, (p - a) / (b - a))); }
  var aspectK = 1;
  function pathAt(list, p, outPos, outLook) {
    var i = 0; while (i < list.length - 2 && p > list[i + 1][0]) i++;
    var a = list[i], b = list[i + 1], u = sm((p - a[0]) / (b[0] - a[0]));
    for (var j = 0; j < 3; j++) { outPos[j] = a[1 + j] + (b[1 + j] - a[1 + j]) * u; outLook[j] = a[4 + j] + (b[4 + j] - a[4 + j]) * u; }
  }
  var P3 = [0, 0, 0], L3 = [0, 0, 0];

  /* ---------- keadaan per bingkai ---------- */
  var BOUND = [0, 0.12, 0.33, 0.46, 0.56, 0.7, 0.86], cur = 0, target = 0, last = -1, world = 'room', t0 = performance.now();
  var tmpA = new T.Color();
  function setCaps(p) {
    var idx = 0; for (var i = 0; i < BOUND.length; i++) if (p >= BOUND[i]) idx = i;
    var lo = BOUND[idx], hi = BOUND[idx + 1] || 1, q = seg(p, lo, hi);
    caps.forEach(function (c, i) { c.classList.toggle('on', i === idx); if (i === idx) Array.prototype.forEach.call(c.querySelectorAll('[data-at]'), function (el) { el.classList.toggle('on', q >= parseFloat(el.getAttribute('data-at'))); }); });
    dots.forEach(function (d, i) { d.classList.toggle('on', i === idx); });
  }
  function frame(now) {
    var t = (now - t0) / 1000; cur += (target - cur) * 0.09; var p = cur;
    var night = sm(seg(p, 0.42, 0.49)) * (1 - sm(seg(p, 0.66, 0.74)));
    var flash = Math.max(0, 1 - Math.abs(p - 0.865) / 0.022); if (flashEl) flashEl.style.opacity = flash.toFixed(3);
    var inSky = p >= 0.865; if (inSky !== (world === 'sky')) { world = inSky ? 'sky' : 'room'; room.visible = !inSky; skyW.visible = inSky; phone.visible = !inSky && p > 0.68; }
    if (!inSky) {
      scene.background.copy(DAY).lerp(NIGHT, night); hemi.intensity = 1.0 - night * 0.78; sun.intensity = 1.1 - night * 0.95; lamp.intensity = night * 2.2; winMat.color.setHex(0xe6f3ff).lerp(tmpA.setHex(0x16306e), night);
      lapGlow.map = night > 0.3 ? lapCode : null; lapGlow.color.setHex(night > 0.3 ? 0xffffff : 0x1b2a55); lapGlow.needsUpdate = true;
      wbMat.map = p > 0.58 ? wbB : wbA;
      chainItems.forEach(function (c, i) { var s = sm(seg(p, 0.5 + i * 0.012, 0.56 + i * 0.012)) * (1 - sm(seg(p, 0.7, 0.75))); c.m.scale.setScalar(Math.max(0.0001, s)); c.m.position.y = c.y + Math.sin(t * 1.4 + i) * 0.08; if (c.link) c.link.scale.x = Math.max(0.0001, s); });
      chain.visible = p > 0.49 && p < 0.76;
      var ps = sm(seg(p, 0.7, 0.78)) * (1 + 1.5 * sm(seg(p, 0.78, 0.86))); phone.visible = ps > 0.01; phone.scale.setScalar(Math.max(0.0001, ps)); phone.position.y = 2.2 + Math.sin(t * 1.6) * 0.06 * (1 - sm(seg(p, 0.8, 0.86))); phone.rotation.y = Math.sin(t * 0.8) * 0.12 * (1 - sm(seg(p, 0.78, 0.84)));
      // gerak tokoh
      var talk = p > 0.12 && p < 0.33, cheer = p > 0.7;
      SEAT.forEach(function (s, i) {
        var c = chars[s[0]], u = c.userData, bob = Math.sin(t * 1.6 + i) * 0.02;
        u.head.position.y = u.baseHeadY + bob; u.head.rotation.set(0, 0, 0);
        u.aL.rotation.x = u.aR.rotation.x = -1.25; u.aL.rotation.z = -0.1; u.aR.rotation.z = 0.1;
        if (s[0] === 'jahfal' && talk) u.head.rotation.y = 0.5 * Math.sin(t * 1.2);
        if (s[0] === 'nabila' && talk) u.head.rotation.y = -0.5 * Math.sin(t * 1.2 + 1);
        if (s[0] === 'rafa' && p > 0.3 && p < 0.47) { u.head.rotation.z = 0.18 * Math.sin(t * 2.2); u.aR.rotation.x = -2.6 + Math.sin(t * 5) * 0.4; }
        if (s[0] === 'ardellio' && p > 0.46 && p < 0.7) { u.aL.rotation.x = -1.35 + Math.sin(t * 14) * 0.12; u.aR.rotation.x = -1.35 + Math.sin(t * 14 + 2) * 0.12; u.head.rotation.x = 0.18; }
        if (cheer) { u.aL.rotation.x = -2.9 + Math.sin(t * 6 + i) * 0.3; u.aR.rotation.x = -2.9 + Math.sin(t * 6 + i + 1) * 0.3; u.head.position.y += Math.abs(Math.sin(t * 3 + i)) * 0.12; }
      });
    } else {
      scene.background.copy(SKY); hemi.intensity = 1.05; sun.intensity = 1.0; lamp.intensity = 0;
      skyChars.forEach(function (c, i) { var u = c.userData, up = seg(p, 0.89 + i * 0.012, 0.94 + i * 0.012); c.position.y = (1 - sm(up)) * -3 + Math.abs(Math.sin(t * 2.2 + i * 0.8)) * 0.1; u.aL.rotation.x = -2.8 + Math.sin(t * 5 + i) * 0.35; u.aR.rotation.x = -2.8 + Math.sin(t * 5 + i + 1.3) * 0.35; u.head.rotation.y = Math.sin(t * 1.1 + i) * 0.3; c.visible = up > 0.001; if (i > 5) { u.aL.rotation.x = -0.2; u.aR.rotation.x = -0.2; } });
      clouds.forEach(function (m, i) { m.position.x += Math.sin(t * 0.2 + i) * 0.002; });
    }
    if (inSky) pathAt(SKYKF, p, P3, L3); else pathAt(KF, p, P3, L3);
    var k = aspectK;
    cam.position.set(L3[0] + (P3[0] - L3[0]) * k, L3[1] + (P3[1] - L3[1]) * k, L3[2] + (P3[2] - L3[2]) * k); cam.lookAt(L3[0], L3[1], L3[2]);
    if (sk) sk.classList.toggle('off', p > 0.86); setCaps(p); last = p;
    renderer.render(scene, cam);
  }

  function resize() {
    var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = cam.aspect < 0.8 ? 60 : cam.aspect < 1.2 ? 50 : 45; aspectK = cam.aspect < 0.8 ? 1.5 : cam.aspect < 1.2 ? 1.2 : 1; cam.updateProjectionMatrix();
  }
  resize(); window.addEventListener('resize', resize);
  ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom bottom', onUpdate: function (s) { target = s.progress; } });
  var running = false, raf = 0;
  function loop(now) { frame(now); raf = running ? requestAnimationFrame(loop) : 0; }
  new IntersectionObserver(function (es) { var on = es[0].isIntersecting; if (on && !running) { running = true; resize(); raf = requestAnimationFrame(loop); } else if (!on) { running = false; } }, { rootMargin: '30% 0px' }).observe(sec);
  document.addEventListener('visibilitychange', function () { if (document.hidden) running = false; });

  /* ---------- navigasi: klik titik, putar ulang, lewati ---------- */
  var tween = null;
  function scrollToY(y) {
    if (tween) tween.kill();
    var html = document.documentElement, o = { v: window.pageYOffset };
    html.style.scrollBehavior = 'auto';
    tween = gsap.to(o, { v: y, duration: Math.min(2.2, 0.6 + Math.abs(y - o.v) / 4000), ease: 'power2.inOut', onUpdate: function () { window.scrollTo(0, o.v); }, onComplete: function () { html.style.scrollBehavior = ''; } });
  }
  function range() { return sec.offsetHeight - stage.clientHeight; }
  function toScene(i) { scrollToY(sec.offsetTop + range() * (BOUND[i] + 0.006)); }
  dots.forEach(function (d, i) { d.setAttribute('role', 'button'); d.setAttribute('tabindex', '0'); d.setAttribute('aria-label', 'Ke adegan ' + (i + 1)); d.addEventListener('click', function () { toScene(i); }); d.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toScene(i); } }); });
  var rp = document.getElementById('s3dReplay'), sk = document.getElementById('s3dSkip');
  if (rp) rp.addEventListener('click', function () { scrollToY(sec.offsetTop); });
  if (sk) sk.addEventListener('click', function () { scrollToY(sec.offsetTop + sec.offsetHeight); });
  window.addEventListener('wheel', function () { if (tween) { tween.kill(); tween = null; document.documentElement.style.scrollBehavior = ''; } }, { passive: true });
  window.addEventListener('touchstart', function () { if (tween) { tween.kill(); tween = null; document.documentElement.style.scrollBehavior = ''; } }, { passive: true });
  window.__s3d = { set: function (p) { target = cur = p; frame(performance.now()); } };
})();
