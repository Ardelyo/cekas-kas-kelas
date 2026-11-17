/* CEKAS "Langit" — gerak & interaksi. Vanilla JS + GSAP (lokal). */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var hasGsap = typeof window.gsap !== 'undefined';

  /* ---------- SHA-256 (murni JS, jalan di http/file tanpa secure context) ---------- */
  function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var maxWord = Math.pow(2, 32), result = '', words = [], bitLen = ascii.length * 8, i, j;
    var hash = sha256.h = sha256.h || [], k = sha256.k = sha256.k || [], pc = k.length, comp = {};
    for (var cand = 2; pc < 64; cand++) {
      if (!comp[cand]) {
        for (i = 0; i < 313; i += cand) comp[i] = cand;
        hash[pc] = (Math.pow(cand, .5) * maxWord) | 0;
        k[pc++] = (Math.pow(cand, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) { j = ascii.charCodeAt(i); words[i >> 2] |= j << ((3 - i) % 4) * 8; }
    words[words.length] = ((bitLen / maxWord) | 0);
    words[words.length] = bitLen;
    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16), old = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { var b = (hash[i] >> (j * 8)) & 255; result += ((b < 16) ? 0 : '') + b.toString(16); }
    return result;
  }
  window.__sha256 = sha256;

  /* ---------- rupiah ---------- */
  function rp(n) { return (n < 0 ? '−' : '+') + 'Rp ' + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  /* ---------- buku kas contoh (rantai hash) ---------- */
  var ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var ICON_BAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICON_DOT = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3.2"/></svg>';
  var SEED = [
    { d: 'Saldo awal kas', n: 'Dicatat Bendahara', a: 500000 },
    { d: 'Iuran minggu 1', n: '31 siswa lunas', a: 310000 },
    { d: 'Beli spidol dan kertas', n: 'Disetujui Wali Kelas', a: -35000 },
    { d: 'Iuran minggu 2', n: '36 siswa lunas', a: 340000 },
    { d: 'Fotokopi tugas kelompok', n: 'Disetujui Wali Kelas', a: -22000 },
    { d: 'Iuran minggu 3', n: '36 siswa lunas', a: 330000 }
  ];
  var TAMPER_AT = 2, TAMPER_TO = -3500;
  var data = SEED.map(function (r) { return { d: r.d, n: r.n, a: r.a }; });
  var stored = [];
  (function seal() {
    var prev = 'GENESIS';
    SEED.forEach(function (r, i) { prev = sha256(prev + '|' + r.d + '|' + r.a); stored[i] = prev; });
  })();

  var rowsEl = $('#ledgerRows'), badge = $('#ledgerBadge'), note = $('#ledgerNote');
  var tamperBtn = $('#tamperBtn'), restoreBtn = $('#restoreBtn');
  var rowEls = [], runId = 0, tampered = false, ledgerSeen = false;

  function buildRows() {
    rowsEl.innerHTML = '';
    rowEls = data.map(function (r) {
      var li = document.createElement('li');
      li.className = 'row';
      li.innerHTML = '<span class="row__ic">' + ICON_DOT + '</span><span class="row__d">' + r.d + '<small>' + r.n + '</small></span><span class="row__a"></span><span class="row__h"></span>';
      rowsEl.appendChild(li);
      return li;
    });
    paintValues();
  }
  function calcChain() {
    var prev = 'GENESIS', out = [];
    data.forEach(function (r, i) { prev = sha256(prev + '|' + r.d + '|' + r.a); out[i] = prev; });
    return out;
  }
  function paintValues() {
    var calc = calcChain();
    rowEls.forEach(function (li, i) {
      var a = $('.row__a', li);
      a.textContent = rp(data[i].a);
      a.className = 'row__a ' + (data[i].a < 0 ? 'out' : 'in');
      li.classList.toggle('is-edited', data[i].a !== SEED[i].a);
      $('.row__h', li).textContent = calc[i].slice(0, 28) + '…';
    });
    return calc;
  }
  function setBadge(ok, text, anim) {
    badge.className = 'badge ' + (ok === null ? 'badge--ok' : ok ? 'badge--ok' : 'badge--bad');
    badge.innerHTML = (ok === false ? ICON_BAD : ICON_OK).replace('<svg', '<svg width="14" height="14"') + '<span>' + text + '</span>';
    if (anim) { void badge.offsetWidth; badge.classList.add(ok ? 'is-pulse' : 'is-shake'); }
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function verify() {
    var my = ++runId;
    var calc = paintValues();
    rowEls.forEach(function (li) { li.classList.remove('is-ok', 'is-bad'); $('.row__ic', li).innerHTML = ICON_DOT; });
    setBadge(null, 'Memeriksa…', false);
    if (window.motion) motion.sound('chain', rowEls.length);
    tamperBtn.disabled = restoreBtn.disabled = true;
    var firstBad = -1;
    for (var i = 0; i < rowEls.length; i++) {
      if (!reduce) await sleep(120);
      if (my !== runId) return;
      var ok = calc[i] === stored[i];
      if (!ok && firstBad < 0) firstBad = i;
      var li = rowEls[i];
      li.classList.add(ok ? 'is-ok' : 'is-bad');
      $('.row__ic', li).innerHTML = ok ? ICON_OK : ICON_BAD;
    }
    tamperBtn.disabled = restoreBtn.disabled = false;
    if (firstBad < 0) {
      if (window.motion) setTimeout(function () { motion.sound('done'); }, 0);
      setBadge(true, 'Terverifikasi · ' + rowEls.length + ' baris utuh', true);
      note.textContent = 'Rantai utuh. Data fiktif untuk contoh.';
    } else {
      setBadge(false, 'Perlu diperiksa · mulai baris ' + (firstBad + 1), true);
      note.textContent = 'Satu angka berubah, dan baris itu serta semua baris sesudahnya tidak cocok lagi dengan sidik jari aslinya.';
    }
  }
  if (rowsEl) {
    buildRows();
    tamperBtn.addEventListener('click', function () {
      tampered = true; data[TAMPER_AT].a = TAMPER_TO;
      tamperBtn.hidden = true; restoreBtn.hidden = false; verify();
    });
    restoreBtn.addEventListener('click', function () {
      tampered = false; data[TAMPER_AT].a = SEED[TAMPER_AT].a;
      restoreBtn.hidden = true; tamperBtn.hidden = false; verify();
    });
    setBadge(null, 'Menunggu…', false);
  }

  /* ---------- jeda saat tab tersembunyi ---------- */
  document.addEventListener('visibilitychange', function () {
    root.classList.toggle('is-paused', document.hidden);
    if (hasGsap) gsap.globalTimeline.paused(document.hidden);
  });

  /* ---------- tanpa GSAP / reduced motion: tampilkan semuanya ---------- */
  function showAllStatic() {
    root.classList.remove('intro-on');
    var intro = $('#intro'); if (intro) intro.remove();
    $$('.reveal').forEach(function (el) { el.classList.add('is-in'); });
    $$('.statement__text .w').forEach(function (w) { w.classList.add('on'); });
    $$('.bar i').forEach(function (b) { b.style.transform = 'scaleX(1)'; });
    var sp = $('#sparkPath'); if (sp) sp.style.strokeDasharray = 'none';
    if (rowsEl) verify();
  }

  /* ---------- pecah kalimat jadi kata ---------- */
  var stm = $('#statementText');
  if (stm) {
    stm.innerHTML = stm.textContent.trim().split(/\s+/).map(function (w) { return '<span class="w">' + w + '</span>'; }).join(' ');
  }

  if (!hasGsap) { showAllStatic(); return; }
  if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---------- navigasi ---------- */
  var nav = $('#nav'), hero = $('.hero'), lastY = window.scrollY, ticking = false;
  function onScroll() {
    var y = window.scrollY, heroH = hero ? hero.offsetHeight : 600;
    nav.classList.toggle('is-solid', y > heroH - 120);
    if (y > 260 && y > lastY + 4) nav.classList.add('is-hidden');
    else if (y < lastY - 4 || y < 260) nav.classList.remove('is-hidden');
    lastY = y; ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  var cue = $('#scrollCue');
  if (cue) cue.addEventListener('click', function () { var s = $('#statement'); if (s) s.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); });

  if (reduce) { showAllStatic(); return; }

  /* ---------- INTRO ---------- */
  var intro = $('#intro'), introTl = null;
  function buildStars() {
    var host = $('#introStars'); if (!host) return;
    for (var i = 0; i < 46; i++) {
      var s = document.createElement('i');
      s.style.left = Math.random() * 100 + '%'; s.style.top = Math.random() * 100 + '%';
      s.style.opacity = (0.3 + Math.random() * 0.7).toFixed(2);
      var z = 1 + Math.random() * 1.6; s.style.width = s.style.height = z + 'px';
      host.appendChild(s);
    }
  }
  function endIntro() {
    root.classList.remove('intro-on');
    try { sessionStorage.setItem('cekas-intro', '1'); } catch (e) {}
    if (intro) intro.style.display = 'none';
    ScrollTrigger.refresh();
  }
  function runIntro() {
    buildStars();
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    introTl = tl;
    tl.fromTo('#introSun', { y: '34vmin' }, { y: '-30vmin', duration: 2.3, ease: 'power2.out' }, 0)
      .fromTo('#introStars i', { opacity: 0 }, { opacity: function () { return 0.35 + Math.random() * 0.65; }, duration: 0.8, stagger: { each: 0.012, from: 'random' } }, 0)
      .to('#introStars', { opacity: 0, duration: 1.6, ease: 'power1.in' }, 0.9)
      .fromTo('#introMark span', { yPercent: 110, opacity: 0, rotate: 6 }, { yPercent: 0, opacity: 1, rotate: 0, duration: 1, stagger: 0.07, ease: 'back.out(1.5)' }, 0.35)
      .fromTo('#introTag', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.8 }, 1.15)
      .addLabel('lift', 2.5)
      .to(intro, { yPercent: -100, borderBottomLeftRadius: '44px', borderBottomRightRadius: '44px', duration: 1.1, ease: 'power3.inOut', onStart: heroIn }, 'lift')
      .to('#introMark', { yPercent: -30, duration: 1.1, ease: 'power3.inOut' }, 'lift')
      .call(endIntro);
    var skip = $('#introSkip');
    if (skip) skip.addEventListener('click', function () {
      if (tl.time() < 2.5) tl.seek(2.5); tl.timeScale(1.8);
    });
  }

  /* ---------- HERO MASUK ---------- */
  var heroStarted = false;
  function heroIn() {
    if (heroStarted) return; heroStarted = true;
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo('.hero [data-hero="in"]:not(.line__in)', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.12 }, 0)
      .fromTo('.hero .line__in', { yPercent: 115, opacity: 1 }, { yPercent: 0, opacity: 1, duration: 1.15, stagger: 0.12, ease: 'power4.out' }, 0.05)
      .fromTo('.hero__sky', { scale: 1.16, transformOrigin: '50% 75%' }, { scale: 1, duration: 2.6, ease: 'power3.out', clearProps: 'transform' }, 0)
      .fromTo('.cloud--a', { yPercent: 14, opacity: 0 }, { yPercent: 0, opacity: 0.95, duration: 1.8, ease: 'power2.out' }, 0)
      .fromTo('.cloud--b, .cloud--d', { opacity: 0 }, { opacity: function (i, el) { return el.classList.contains('cloud--b') ? 0.85 : 0.8; }, duration: 2 }, 0.3)
      .fromTo('.arc .card', { '--in': 0, '--ey': '90px' }, { '--in': 1, '--ey': '0px', duration: 1.1, stagger: { each: 0.08, from: 'center' }, ease: 'back.out(1.2)' }, 0.5)
      .fromTo('.bar i', { scaleX: 0 }, { scaleX: 1, duration: 1.3, ease: 'power3.inOut' }, 1.3)
      .add(sparkAndCount, 1.2)
      .add(startFloat, 1.6);
  }
  function sparkAndCount() {
    var p = $('#sparkPath');
    if (p && p.getTotalLength) {
      var len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
      gsap.to(p, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut' });
    }
    var num = $('#balNum');
    if (num) {
      var to = +num.dataset.to, o = { v: 0 };
      gsap.to(o, { v: to, duration: 1.8, ease: 'power3.out', onUpdate: function () { num.textContent = Math.round(o.v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); } });
    }
  }
  function startFloat() {
    $$('.arc .card').forEach(function (c, i) {
      gsap.fromTo(c, { '--fy': '0px' }, { '--fy': '-7px', duration: 2.6 + i * 0.35, delay: i * 0.25, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    });
  }

  if (root.classList.contains('intro-on') && intro) runIntro(); else { if (intro) intro.remove(); heroIn(); }

  /* ---------- PARALLAX AWAN (scroll + pointer) ---------- */
  $$('.cloud').forEach(function (c) {
    var depth = parseFloat(c.dataset.depth || '0.4');
    gsap.to(c, { y: depth * 170, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 } });
  });
  gsap.to('.hero__inner', { yPercent: -10, opacity: 0.15, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: '70% top', scrub: true } });
  gsap.to('.arc', { y: 60, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  if (fine && hero) {
    var cards = $$('.arc .card'), clouds = $$('.cloud'), raf = 0, mx = 0, my = 0;
    cards.forEach(function (c) { gsap.set(c, { '--rx': '0deg', '--ry': '0deg' }); });
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(function () {
        raf = 0;
        cards.forEach(function (c) { gsap.to(c, { '--ry': (mx * 9).toFixed(2) + 'deg', '--rx': (-my * 6).toFixed(2) + 'deg', duration: 0.9, ease: 'power3.out', overwrite: 'auto' }); });
        clouds.forEach(function (c) { var d = parseFloat(c.dataset.depth || '0.4'); gsap.to(c, { x: -mx * 60 * d, duration: 1.4, ease: 'power3.out', overwrite: 'auto' }); });
      });
    });
    hero.addEventListener('pointerleave', function () {
      cards.forEach(function (c) { gsap.to(c, { '--ry': '0deg', '--rx': '0deg', duration: 1.2, ease: 'elastic.out(1,.6)', overwrite: 'auto' }); });
      clouds.forEach(function (c) { gsap.to(c, { x: 0, duration: 1.6, ease: 'power3.out', overwrite: 'auto' }); });
    });
  }

  /* ---------- tombol magnet ---------- */
  if (fine) {
    $$('.magnetic').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.22, y: (e.clientY - r.top - r.height / 2) * 0.3, duration: 0.4, ease: 'power3.out' });
      });
      b.addEventListener('pointerleave', function () { gsap.to(b, { x: 0, y: 0, scale: 1, duration: 0.9, ease: 'elastic.out(1,.5)' }); });
      b.addEventListener('pointerdown', function () { gsap.to(b, { scale: 0.96, duration: 0.1 }); });
      b.addEventListener('pointerup', function () { gsap.to(b, { scale: 1, duration: 0.5, ease: 'back.out(3)' }); });
    });
  }

  /* ---------- kalimat pernyataan: terang per kata ---------- */
  var words = $$('.statement__text .w');
  if (words.length) {
    ScrollTrigger.create({
      trigger: '#statement', start: 'top 72%', end: 'bottom 55%',
      onUpdate: function (self) {
        var n = Math.round(self.progress * words.length);
        words.forEach(function (w, i) { w.classList.toggle('on', i < n); });
      }
    });
  }

  /* ---------- reveal ---------- */
  ScrollTrigger.batch('.reveal', {
    start: 'top 90%', once: true,
    onEnter: function (els) { els.forEach(function (el, i) { setTimeout(function () { el.classList.add('is-in'); }, i * 110); }); }
  });

  /* ---------- angka prakiraan ---------- */
  $$('[data-count]').forEach(function (el) {
    var to = +el.dataset.count, o = { v: 0 };
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: function () {
      gsap.to(o, { v: to, duration: 1.6, ease: 'power3.out', onUpdate: function () { el.textContent = Math.round(o.v); } });
    } });
  });

  /* ---------- buku kas: mulai saat terlihat ---------- */
  var led = $('#ledger');
  if (led) ScrollTrigger.create({ trigger: led, start: 'top 75%', once: true, onEnter: function () { ledgerSeen = true; verify(); } });

  /* ---------- senja ---------- */
  gsap.fromTo('.dusk__bg', { opacity: 0, yPercent: 30 }, { opacity: 1, yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.dusk', start: 'top 85%', end: 'bottom bottom', scrub: true } });
})();
