/* CEKAS "Langit" — perilaku mobile: menu layar penuh, CTA tempel, minibar saldo, FAB ringkas, tarik-tutup sheet, geser jadwal. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = window.matchMedia('(max-width: 759px)'), coarse = window.matchMedia('(pointer: coarse)');
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var root = document.documentElement, body = document.body;
  var tick = function () { if (window.fx) fx.buzz([6]); };

  /* ---------- tab bawah untuk halaman situs (mobile) ---------- */
  var nav = $('#nav'), isKas = body.hasAttribute('data-sky-kasmode');
  if (nav && $('.nav__links', nav) && !isKas) {
    var page = (location.pathname.split('/').pop() || 'index.html');
    var IC = {
      home: '<path d="M3 11l9-7 9 7M5 10v10h14V10"/>', spark: '<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>',
      route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H14a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h5.5"/>',
      users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .6 3.2 2.3 3.5 5.2"/>',
      sword: '<path d="M14.5 3H21v6.5L10 20.5 3.5 14z"/><path d="M6 17l-3 3M8.5 12.5l3 3"/>',
      chat: '<path d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-6l-5 4v-4a3 3 0 0 1-2-3z"/>'
    };
    var tabs = [['index.html', 'Beranda', 'home'], ['fitur.html', 'Fitur', 'spark'], ['stan/duel.html', 'Arena', 'sword'], ['cara.html', 'Cara', 'route'], ['tentang.html', 'Tentang', 'users'], ['tanya.html', 'Tanya', 'chat']];
    var ai = Math.max(0, tabs.findIndex(function (t) { return t[0] === page; }));
    var bar = document.createElement('nav'); bar.className = 'mtabs'; bar.setAttribute('aria-label', 'Navigasi utama');
    bar.innerHTML = '<span class="mtabs__pill" aria-hidden="true" style="--i:' + ai + '"></span>' + tabs.map(function (t, i) { return '<a href="' + t[0] + '"' + (i === ai ? ' class="on" aria-current="page"' : '') + '><svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + IC[t[2]] + '</svg><span>' + t[1] + '</span></a>'; }).join('');
    body.appendChild(bar); body.classList.add('has-mtabs');
    bar.addEventListener('click', tick);
    // pil bergeser dari tab halaman sebelumnya ke tab halaman ini, dan langsung bergerak saat tab disentuh
    var pill = $('.mtabs__pill', bar), prevI = null;
    try { prevI = sessionStorage.getItem('cekas-tab'); sessionStorage.removeItem('cekas-tab'); } catch (e) {}
    if (prevI !== null && +prevI !== ai && !reduce) {
      pill.style.transition = 'none'; pill.style.setProperty('--i', prevI);
      requestAnimationFrame(function () { requestAnimationFrame(function () { pill.style.transition = ''; pill.style.setProperty('--i', ai); }); });
    }
    $$('a', bar).forEach(function (a, i) {
      a.addEventListener('click', function () {
        if (i === ai) return;
        try { sessionStorage.setItem('cekas-tab', String(ai)); } catch (e) {}
        pill.style.setProperty('--i', i); $$('a', bar).forEach(function (x, j) { x.classList.toggle('on', j === i); });
      });
    });
  }

  /* ---------- tautan ke bagian landing yang di mobile pindah halaman ---------- */
  if (small.matches) {
    var MOVED = { '#coba': 'fitur.html#keaslian', 'index.html#coba': 'fitur.html#keaslian', 'index.html#faq': 'tanya.html#faq', 'index.html#testimoni': 'tanya.html#testimoni' };
    $$('a[href]').forEach(function (a) {
      var h = a.getAttribute('href'), to = MOVED[h];
      if (!to) return;
      if (h.charAt(0) === '#') { var tgt = document.getElementById(h.slice(1)); if (tgt && tgt.offsetParent !== null) return; }
      a.setAttribute('href', to);
    });
  }

  /* ---------- dashboard ---------- */
  if (isKas) {
    var SCR = ['beranda', 'iuran', 'kas', 'lainnya'], TITLES = { iuran: ['Iuran', 'Jadwal dan siapa yang sudah bayar'], kas: ['Kas', 'Pos anggaran dan riwayat'], lainnya: ['Lainnya', 'Usulan, bagikan, dan pengaturan'] };
    var scrHead = document.createElement('div'); scrHead.className = 'scrhead'; scrHead.innerHTML = '<h2></h2><p></p>'; var pageEl = $('.page'); if (pageEl) pageEl.insertBefore(scrHead, pageEl.firstChild);
    var cur = null;
    function setScreen(s, animate) {
      if (!small.matches) { delete body.dataset.screen; return; }
      if (SCR.indexOf(s) < 0) s = 'beranda'; var dir = cur && SCR.indexOf(s) < SCR.indexOf(cur) ? 'l' : 'r', first = cur === null; cur = s; body.dataset.screen = s;
      $$('.bottomnav a').forEach(function (a) { a.classList.toggle('on', a.dataset.screen === s); }); var pill = $('#pillx'); if (pill) pill.style.transform = 'translateX(' + SCR.indexOf(s) * 100 + '%)';
      var t = TITLES[s]; if (t) { $('h2', scrHead).textContent = t[0]; $('p', scrHead).textContent = t[1]; }
      window.scrollTo(0, 0);
      if (animate && !first && !reduce) { body.classList.remove('scr-r', 'scr-l'); void body.offsetWidth; body.classList.add('scr-' + dir); setTimeout(function () { body.classList.remove('scr-r', 'scr-l'); }, 700); }
      try { history.replaceState(null, '', '#' + s); } catch (e) {}
    }
    $$('.bottomnav a').forEach(function (a) { a.addEventListener('click', function (e) { if (!small.matches) return; e.preventDefault(); if (a.dataset.screen !== cur) { tick(); setScreen(a.dataset.screen, true); } }); });
    var h0 = (location.hash || '').slice(1); setScreen(SCR.indexOf(h0) >= 0 ? h0 : 'beranda', false);
    small.addEventListener('change', function () { cur = null; setScreen((location.hash || '').slice(1), false); });
    window.__setScreen = setScreen;
    var mini = $('#minibar'), head = $('.skyhead'), fab = $('#fab'), lastY = window.scrollY, idle = 0, t2 = false;
    function onScroll() {
      t2 = false; var y = window.scrollY, dy = y - lastY; lastY = y;
      if (mini && head) mini.classList.toggle('is-on', small.matches && (body.dataset.screen !== 'beranda' || y > head.offsetHeight - 60));
      if (fab && small.matches) { if (dy > 6) fab.classList.add('is-mini'); else if (dy < -6) fab.classList.remove('is-mini'); clearTimeout(idle); idle = setTimeout(function () { fab.classList.remove('is-mini'); }, 900); }
    }
    window.addEventListener('scroll', function () { if (!t2) { t2 = true; requestAnimationFrame(onScroll); } }, { passive: true });
    if (mini) { var up = function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); tick(); }; mini.addEventListener('click', up); mini.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); up(); } }); }
    $$('.bottomnav a').forEach(function (a) { a.addEventListener('click', tick); });

    /* geser kiri/kanan untuk pindah minggu */
    var sc = $('#sched'), sx = 0, sy = 0, st = 0;
    if (sc) {
      sc.addEventListener('touchstart', function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive: true });
      sc.addEventListener('touchend', function (e) {
        var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; if (Math.abs(dx) < 56 || Math.abs(dy) > 44 || Date.now() - st > 700) return;
        var cols = $$('.swk', sc), i = cols.findIndex(function (c) { return c.classList.contains('on'); }), n = dx < 0 ? i + 1 : i - 1;
        if (cols[n]) { cols[n].click(); tick(); }
      }, { passive: true });
    }
  }

  /* ---------- sheet: tarik ke bawah untuk menutup ---------- */
  $$('dialog').forEach(function (d) {
    var sheet = $('.sheet', d); if (!sheet) return; var y0 = 0, dy = 0, drag = false, t0 = 0;
    sheet.addEventListener('pointerdown', function (e) {
      if (window.innerWidth >= 700 || !coarse.matches) return; var onGrab = e.target.closest('.grab');
      if (!onGrab && (e.target.closest('input, button, select, textarea, label, a') || sheet.scrollTop > 0)) return;
      drag = true; y0 = e.clientY; t0 = e.timeStamp; dy = 0; sheet.style.transition = 'none'; try { sheet.setPointerCapture(e.pointerId); } catch (x) {}
    });
    sheet.addEventListener('pointermove', function (e) { if (!drag) return; dy = Math.max(0, e.clientY - y0); sheet.style.transform = 'translate(-50%, ' + dy + 'px)'; d.style.setProperty('--dim', String(Math.max(0, 1 - dy / 320))); });
    function end(e) {
      if (!drag) return; drag = false; var v = dy / Math.max(1, e.timeStamp - t0); sheet.style.transition = '';
      if (dy > 110 || v > 0.7) { if (window.fx) fx.buzz([6]); sheet.style.transform = ''; fx.closeSheet(d); } else { sheet.style.transition = 'transform .5s cubic-bezier(.34,1.56,.64,1)'; sheet.style.transform = ''; setTimeout(function () { sheet.style.transition = ''; }, 520); }
    }
    sheet.addEventListener('pointerup', end); sheet.addEventListener('pointercancel', end);
    d.addEventListener('close', function () { sheet.style.transform = ''; sheet.style.transition = ''; });
  });

  /* ---------- keyboard layar: kolom aktif selalu terlihat ---------- */
  if (coarse.matches) document.addEventListener('focusin', function (e) { var t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) setTimeout(function () { t.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); }, 320); });
})();
