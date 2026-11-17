/* CEKAS "Langit" — halaman Tentang dan Fitur: nav, reveal, angka, garis waktu, rantai hash. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var hasIO = 'IntersectionObserver' in window;

  /* nav */
  var nav = $('#nav'), hero = $('.hero'), lastY = window.scrollY, ticking = false;
  function onScroll() {
    ticking = false; var y = window.scrollY, h = hero ? hero.offsetHeight : 500;
    nav.classList.toggle('is-solid', y > h - 120);
    if (y > 260 && y > lastY + 4) nav.classList.add('is-hidden'); else if (y < lastY - 4 || y < 260) nav.classList.remove('is-hidden');
    document.body.classList.toggle('nav-hidden', nav.classList.contains('is-hidden'));
    lastY = y;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true }); onScroll();

  /* reveal + angka */
  function countUp(el) {
    var to = +el.dataset.count; if (reduce) { el.textContent = to; return; }
    var t0 = performance.now(), d = 1500;
    (function f(t) { var p = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(to * e); if (p < 1) requestAnimationFrame(f); })(t0);
  }
  var seen = hasIO && !reduce ? new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); if (en.target.dataset.count) countUp(en.target); $$('[data-count]', en.target).forEach(countUp); seen.unobserve(en.target); } }); }, { rootMargin: '0px 0px -10% 0px' }) : null;
  $$('.reveal').forEach(function (el) { if (seen) seen.observe(el); else { el.classList.add('is-in'); $$('[data-count]', el).forEach(function (c) { c.textContent = c.dataset.count; }); } });

  /* tombol magnet */
  if (fine) $$('.magnetic').forEach(function (b) {
    b.style.transition = 'background .25s, box-shadow .25s';
    b.addEventListener('pointermove', function (e) { var r = b.getBoundingClientRect(); b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * .22).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * .3).toFixed(1) + 'px)'; });
    b.addEventListener('pointerleave', function () { b.style.transition = 'transform .8s cubic-bezier(.34,1.56,.64,1), background .25s'; b.style.transform = ''; });
  });

  /* garis waktu */
  var tl = $('#tl'), fill = $('#tlFill');
  if (tl && fill) {
    var t2 = false, run = function () { t2 = false; var r = tl.getBoundingClientRect(), mid = window.innerHeight * 0.6; var p = Math.min(1, Math.max(0, (mid - r.top) / r.height)); fill.style.setProperty('--p', p.toFixed(3)); };
    window.addEventListener('scroll', function () { if (!t2) { t2 = true; requestAnimationFrame(run); } }, { passive: true }); run();
  }

  /* nav fitur: sorot bagian aktif */
  var fnav = $('#fnav');
  if (fnav) {
    var links = $$('a', fnav).filter(function (a) { return a.offsetParent !== null; }), secs = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    var t3 = false, spy = function () {
      t3 = false; var idx = 0; secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top < window.innerHeight * 0.4) idx = i; });
      links.forEach(function (a, i) { a.classList.toggle('on', i === idx); });
      var on = links[idx]; if (on && fnav.scrollWidth > fnav.clientWidth) fnav.scrollLeft = on.offsetLeft - fnav.clientWidth / 2 + on.clientWidth / 2;
    };
    window.addEventListener('scroll', function () { if (!t3) { t3 = true; requestAnimationFrame(spy); } }, { passive: true }); spy();
  }

  /* fitur di mobile: satu bagian per layar */
  if (fnav && window.matchMedia('(max-width: 759px)').matches) {
    var fl = $$('a', fnav), fs = fl.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    function fshow(i, scroll) {
      fs.forEach(function (s, k) { if (s) s.classList.toggle('is-fshown', k === i); }); fl.forEach(function (a, k) { a.classList.toggle('on', k === i); });
      document.body.classList.add('fitur-tabs'); if (scroll) window.scrollTo({ top: Math.max(0, (hero ? hero.offsetHeight : 300) - 20), behavior: reduce ? 'auto' : 'smooth' });
      $$('.reveal', fs[i]).forEach(function (r) { r.classList.add('is-in'); }); $$('.split', fs[i]).forEach(function (r) { r.classList.add('is-in'); });
      var ch = $('#hchain'); if (ch && i === 0 && window.__hcCheck) window.__hcCheck();
    }
    fl.forEach(function (a, i) { a.addEventListener('click', function (e) { e.preventDefault(); fshow(i, true); }, true); });
    var start = Math.max(0, fl.findIndex(function (a) { return a.getAttribute('href') === location.hash; })); fshow(start, false);
  }

  /* rantai hash sungguhan */
  var chain = $('#hchain');
  if (chain && window.sha256) {
    var rows = $$('.hb', chain), btn = $('#hcBtn'), badge = $('#hcBadge');
    var parse = function (t) { return parseInt(t.replace(/[^\d]/g, ''), 10) * (/−|-/.test(t) ? -1 : 1); };
    var data = rows.map(function (r) { return { d: $('b', r).textContent, a: parse($('.hb__a', r).textContent) }; });
    var orig = data.map(function (x) { return x.a; }), EDIT = 2, stored = [], prev = 'GENESIS';
    data.forEach(function (x, i) { prev = sha256(prev + '|' + x.d + '|' + orig[i]); stored[i] = prev; });
    var fmt = function (n) { return (n < 0 ? '−' : '+') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
    var OK = rows[0].querySelector('.hb__i').innerHTML, BAD = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    var tampered = false, run2 = 0;
    async function check() {
      var my = ++run2, p = 'GENESIS', calc = [];
      data.forEach(function (x, i) { p = sha256(p + '|' + x.d + '|' + x.a); calc[i] = p; });
      var firstBad = -1; btn.disabled = true;
      for (var i = 0; i < rows.length; i++) {
        if (!reduce) await new Promise(function (r) { setTimeout(r, 140); });
        if (my !== run2) return;
        var ok = calc[i] === stored[i]; if (!ok && firstBad < 0) firstBad = i;
        rows[i].classList.toggle('bad', !ok); $('.hb__i', rows[i]).innerHTML = ok ? OK : BAD; $('small', rows[i]).textContent = calc[i].slice(0, 12).replace(/(.{4})(.{4})(.{4})/, '$1·$2·$3');
      }
      btn.disabled = false;
      badge.className = 'badge ' + (firstBad < 0 ? 'badge--ok' : 'badge--bad'); badge.querySelector('svg').innerHTML = firstBad < 0 ? '<path d="M5 12.5l4.5 4.5L19 7.5"/>' : '<path d="M6 6l12 12M18 6L6 18"/>'; badge.querySelector('span').textContent = firstBad < 0 ? 'Terverifikasi · ' + rows.length + ' catatan' : 'Perlu diperiksa · mulai catatan ' + (firstBad + 1);
      badge.classList.remove('is-pulse', 'is-shake'); void badge.offsetWidth; badge.classList.add(firstBad < 0 ? 'is-pulse' : 'is-shake');
    }
    btn.addEventListener('click', function () {
      tampered = !tampered; data[EDIT].a = tampered ? -3500 : orig[EDIT];
      $('.hb__a', rows[EDIT]).textContent = fmt(data[EDIT].a); rows[EDIT].classList.toggle('edit', tampered); btn.textContent = tampered ? 'Kembalikan' : 'Ubah satu baris'; btn.classList.toggle('mbtn--lime', tampered); check();
    });
    check();
  }

  /* keluar ke aplikasi: tangani oleh landing-extra */
})();
