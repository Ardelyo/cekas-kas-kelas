/* CEKAS "Langit" — SFX mikro untuk seluruh situs. Disintesis Web Audio (tanpa berkas, tanpa suara bicara).
   Mati secara bawaan; dinyalakan lewat panel gerak (ikon matahari > Suara) atau tombol suara di cerita Tentang.
   Diredam otomatis saat "kurangi gerakan" atau mode hemat. Satu pintu: sfx.play(nama, argumen). */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  var M = window.motion;
  function enabled() { return !!(M && M.state && M.state.sound) && !reduce; }
  function gain() { return M && M.isLite && M.isLite() ? 0.55 : 1; }

  var AC = null, master = null, NB = null, born = performance.now(), pending = [], stamp = {};
  function ctx() {
    if (AC) return AC;
    var A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
    AC = new A(); master = AC.createGain(); master.gain.value = 0.5;
    var comp = AC.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 6; master.connect(comp); comp.connect(AC.destination);
    NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); var d = NB.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return AC;
  }
  function tone(type, f0, f1, dur, vol, when, att) {
    var t0 = AC.currentTime + (when || 0), o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * gain()), t0 + (att || 0.006)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, vol, type, f0, f1, when, q) {
    var t0 = AC.currentTime + (when || 0), s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = NB; f.type = type || 'bandpass'; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t0); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * gain()), t0 + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  }
  var PENTA = [523, 587, 659, 784, 880, 1046];
  var S = {
    /* tombol */
    btn: function () { tone('sine', 330, 520, 0.075, 0.2); noise(0.025, 0.07, 'bandpass', 2400, 0, 0, 2); },
    btn2: function () { tone('sine', 980, 760, 0.05, 0.09); },
    btnx: function () { tone('sine', 210, 150, 0.09, 0.16); },
    fail: function () { tone('sine', 170, 0, 0.06, 0.16); tone('sine', 170, 0, 0.06, 0.16, 0.09); },
    busy: function () { [0, 0.11, 0.22].forEach(function (w) { tone('sine', 520, 0, 0.05, 0.06, w); }); },
    done: function () { tone('sine', 1318, 0, 0.35, 0.1); tone('sine', 1760, 0, 0.3, 0.06, 0.04); },
    /* kontrol kecil */
    on: function () { tone('sine', 600, 940, 0.06, 0.12); },
    off: function () { tone('sine', 940, 600, 0.06, 0.1); },
    check: function () { tone('sine', 784, 0, 0.4, 0.09); tone('sine', 1175, 0, 0.5, 0.07, 0.08); },
    seg: function () { noise(0.09, 0.09, 'bandpass', 1300, 3200, 0, 1.4); },
    open: function () { tone('sine', 300, 720, 0.13, 0.12); },
    close: function () { tone('sine', 720, 300, 0.13, 0.1); },
    step: function () { tone('square', 1700, 0, 0.018, 0.035); },
    faqOpen: function () { tone('sine', 420, 800, 0.09, 0.11); },
    faqClose: function () { tone('sine', 800, 420, 0.08, 0.09); },
    inOk: function () { tone('sine', 1500, 0, 0.04, 0.05); },
    inBad: function () { tone('sawtooth', 120, 100, 0.13, 0.07); },
    /* intro dan halaman */
    intro: function () { noise(1.8, 0.14, 'bandpass', 220, 2200, 0, 0.7); tone('sine', 196, 392, 1.6, 0.04, 0, 0.5); },
    logo: function () { tone('sine', 880, 0, 0.5, 0.1); tone('sine', 1318, 0, 0.7, 0.08, 0.12); },
    whoosh: function () { noise(0.22, 0.17, 'bandpass', 500, 2600, 0, 0.8); },
    whoosh2: function () { noise(0.26, 0.15, 'bandpass', 2600, 450, 0, 0.8); },
    loginOk: function () { [523, 659, 784].forEach(function (f, i) { tone('sine', f, 0, 0.5, 0.1, i * 0.1, 0.02); }); tone('sine', 2093, 0, 0.5, 0.04, 0.32); },
    loginBad: function () { tone('sine', 392, 0, 0.22, 0.12); tone('sine', 311, 0, 0.3, 0.12, 0.14); },
    logout: function () { tone('sine', 523, 392, 0.7, 0.1, 0, 0.03); },
    wind: function () { noise(1.4, 0.1, 'lowpass', 300, 900, 0, 0.6); },
    offline: function () { tone('sine', 520, 0, 0.18, 0.1); tone('sine', 390, 0, 0.28, 0.1, 0.14); },
    online: function () { tone('sine', 390, 0, 0.18, 0.1); tone('sine', 520, 0, 0.28, 0.1, 0.14); },
    /* uang dan dashboard */
    coin: function () { tone('sine', 1568, 0, 0.35, 0.13); tone('sine', 2093, 0, 0.45, 0.1, 0.06); tone('triangle', 3136, 0, 0.1, 0.04, 0.06); },
    coinout: function () { tone('sine', 1568, 1046, 0.3, 0.12); tone('sine', 1175, 784, 0.4, 0.09, 0.07); },
    stamp: function () { tone('sine', 150, 55, 0.3, 0.38); noise(0.16, 0.22, 'lowpass', 900, 0); tone('sine', 1760, 0, 0.5, 0.05, 0.1); },
    paid: function () { tone('sine', 1175, 0, 0.35, 0.11); tone('sine', 1568, 0, 0.3, 0.07, 0.05); },
    allpaid: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone('sine', f, 0, 0.4, 0.09, i * 0.08, 0.02); }); },
    chain: function (n) { n = n || 6; for (var i = 0; i < n; i++) tone('square', 600 + i * 90, 0, 0.03, 0.04, i * 0.12); },
    tamper: function () { noise(0.22, 0.16, 'highpass', 3000, 0); tone('sawtooth', 140, 110, 0.28, 0.1, 0.12); },
    count: function (n) { var k = n || 14; for (var i = 0; i < k; i++) tone('sine', 1500 + i * 25, 0, 0.018, 0.035, Math.pow(i / k, 1.6) * 0.9); },
    pull: function () { tone('sine', 400, 620, 0.09, 0.09); },
    plop: function () { tone('sine', 720, 300, 0.12, 0.13); },
    toast: function () { tone('sine', 660, 880, 0.09, 0.1); },
    toastErr: function () { tone('sine', 400, 0, 0.14, 0.1); tone('sine', 300, 0, 0.2, 0.1, 0.1); },
    shutter: function () { noise(0.04, 0.2, 'highpass', 1500, 0); noise(0.05, 0.16, 'highpass', 1200, 0, 0.07); },
    send: function () { noise(0.14, 0.1, 'bandpass', 900, 3600, 0, 1.2); tone('sine', 1100, 1500, 0.08, 0.06, 0.05); },
    /* mikro */
    hover: function () { noise(0.08, 0.04, 'bandpass', 1800, 2600, 0, 0.8); },
    gear: function () { tone('square', 1100, 0, 0.012, 0.03); tone('sine', 700, 0, 0.03, 0.04, 0.005); },
    marker: function () { noise(0.28, 0.07, 'highpass', 2200, 4500, 0, 0.6); },
    section: function (n) { tone('sine', PENTA[(n || 0) % PENTA.length] / 2, 0, 1.1, 0.028, 0, 0.2); },
    tab0: function () { tone('sine', PENTA[0], 0, 0.28, 0.09, 0, 0.01); tone('sine', PENTA[0] * 2, 0, 0.18, 0.025, 0, 0.01); },
    tab1: function () { tone('sine', PENTA[1], 0, 0.28, 0.09, 0, 0.01); tone('sine', PENTA[1] * 2, 0, 0.18, 0.025, 0, 0.01); },
    tab2: function () { tone('sine', PENTA[2], 0, 0.28, 0.09, 0, 0.01); tone('sine', PENTA[2] * 2, 0, 0.18, 0.025, 0, 0.01); },
    tab3: function () { tone('sine', PENTA[3], 0, 0.28, 0.09, 0, 0.01); tone('sine', PENTA[3] * 2, 0, 0.18, 0.025, 0, 0.01); },
    tab4: function () { tone('sine', PENTA[4], 0, 0.28, 0.09, 0, 0.01); tone('sine', PENTA[4] * 2, 0, 0.18, 0.025, 0, 0.01); },
    tick: function () { tone('sine', 1400, 0, 0.05, 0.03); },
    ok: function () { S.check(); },
    reject: function () { tone('sine', 330, 0, 0.3, 0.1); tone('sine', 262, 0, 0.36, 0.09, 0.1); },
    lock: function () { tone('sine', 220, 0, 0.5, 0.1); }
  };
  var GAP = { hover: 150, seg: 60, step: 25, gear: 40, tick: 30, count: 800, section: 900, whoosh: 150, whoosh2: 150 };

  function play(name, arg) {
    if (!enabled()) return false;
    var f = S[name]; if (!f) return false;
    var now = performance.now(), gap = GAP[name] || 35; if (stamp[name] && now - stamp[name] < gap) return false; stamp[name] = now;
    if (!ctx()) return false;
    if (AC.state === 'suspended') { pending.push([name, arg, now]); try { AC.resume().then(flush); } catch (e) {} if (AC.state === 'suspended') return false; }
    try { f(arg); } catch (e) {}
    return true;
  }
  function flush() {
    if (!AC || AC.state !== 'running') return; var now = performance.now(), q = pending.splice(0);
    q.forEach(function (p) { if (now - p[2] < 2600) { try { S[p[0]](p[1]); } catch (e) {} } });
  }
  function unlock() {
    if (!enabled()) return; if (!ctx()) return; try { AC.resume(); } catch (e) {}
    try { AC.resume().then(flush); } catch (e) {} flush();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, unlock, { passive: true, capture: true }); });

  /* ---------- hubungkan ke elemen ---------- */
  var secN = 0;
  document.addEventListener('click', function (e) {
    if (!enabled()) return;
    var el = e.target.closest && e.target.closest('a,button,[role="button"],[role="tab"],summary,label'); if (!el || el.hasAttribute('data-nosfx')) return;
    if (el.closest('.s3d__stage') && !el.matches('.btn,#s3dSound,#s3dSound2')) return;
    var dis = el.disabled || el.getAttribute('aria-disabled') === 'true';
    if (dis) { play('fail'); return; }
    var tab = el.closest('.mtabs,.bottomnav');
    if (tab && el.tagName === 'A') { var links = Array.prototype.slice.call(tab.querySelectorAll('a')); play('tab' + Math.min(4, links.indexOf(el))); }
    else if (el.matches('.fnav a,[role="tab"],.seg button,.swk,#demoRole button,.pillx')) play('seg');
    else if (el.matches('.acc__q')) setTimeout(function () { play(el.getAttribute('aria-expanded') === 'true' ? 'faqOpen' : 'faqClose'); }, 0);
    else if (el.matches('#tPrev,#tNext')) play('step');
    else if (el.matches('a[href*="t.me"],[data-send]')) play('send');
    else if (el.matches('#tamperBtn')) play('tamper');
    else if (el.matches('#restoreBtn')) play('on');
    else if (el.matches('[data-act="reject"],.btn--no,.btn--danger,[data-v="reject"]')) play('btnx');
    else if (el.matches('.btn--lime,.btn--dark,.btn--ok,.btn--ink')) play('btn');
    else if (el.matches('.btn,.btn--sm,button,.chip,.dues-more,.hist-more')) play('btn2');
    // pindah halaman
    if (el.tagName === 'A' && !el.hasAttribute('data-leave') && el.target !== '_blank') {
      var h = el.getAttribute('href') || ''; if (h && h.charAt(0) !== '#' && !/^(https?:|mailto:|tel:)/.test(h)) { try { var u = new URL(el.href, location.href); if (u.origin === location.origin && u.pathname !== location.pathname) setTimeout(function () { play('whoosh'); }, 60); } catch (x) {} }
    }
  }, true);
  document.addEventListener('change', function (e) {
    if (!enabled()) return; var t = e.target;
    if (t.type === 'checkbox') play(t.checked ? 'on' : 'off');
    else if (t.type === 'radio') play('seg');
    else if (t.type === 'file') play('shutter');
    else if (t.tagName === 'SELECT') play('seg');
  }, true);
  document.addEventListener('focusin', function (e) { if (enabled() && e.target.matches && e.target.matches('input[type="text"],input[type="password"],input[type="search"],input[type="number"],textarea')) play('inOk'); }, true);
  document.addEventListener('invalid', function () { play('inBad'); }, true);
  var lastHover = null;
  document.addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse' || !enabled()) return;
    var h = e.target.closest && e.target.closest('.vcard,.ccard:not(.ccard--slot),.prop,.pos,.quote'); if (h && h !== lastHover) play('hover'); lastHover = h;
  }, true);
  window.addEventListener('online', function () { play('online'); }); window.addEventListener('offline', function () { play('offline'); });

  // dialog / sheet buka dan tutup
  function watchDialogs() {
    Array.prototype.forEach.call(document.querySelectorAll('dialog'), function (d) {
      var was = d.open;
      new MutationObserver(function () { if (d.open !== was) { was = d.open; play(was ? 'open' : 'close'); } }).observe(d, { attributes: true, attributeFilter: ['open'] });
    });
  }
  // bagian muncul, sorot stabilo, angka berhitung
  function watchView() {
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return; var t = en.target; io.unobserve(t);
        if (t.matches('.qcard')) setTimeout(function () { play('marker'); }, 450);
        else if (t.matches('[data-count],#balNum')) play('count', 14);
        else if (t.matches('.psec,.fsec,main > section')) play('section', secN++);
      });
    }, { threshold: 0.55 });
    Array.prototype.forEach.call(document.querySelectorAll('.qcard,[data-count],#balNum,.psec,.fsec,main > section'), function (el) { io.observe(el); });
  }
  var ICON_ON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
  var ICON_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M17 9.5l5 5M22 9.5l-5 5"/></svg>';
  var sndBtns = [];
  function paintBtns() { var on = !!(M && M.state && M.state.sound); sndBtns.forEach(function (b) { b.innerHTML = on ? ICON_ON : ICON_OFF; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.title = on ? 'Suara nyala. Ketuk untuk mematikan.' : 'Suara mati. Ketuk untuk menyalakan.'; b.setAttribute('aria-label', b.title); b.classList.toggle('is-on', on); }); }
  function addButtons() {
    if (!M) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-skyctl]'), function (host) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'skybtn sndbtn'; b.setAttribute('data-nosfx', '');
      b.addEventListener('click', function (e) {
        e.stopPropagation(); var v = !M.state.sound; M.set('sound', v);
        if (v) { ctx(); try { AC.resume(); } catch (x) {} setTimeout(function () { play('logo'); }, 30); }
      });
      host.appendChild(b); sndBtns.push(b);
    });
    paintBtns(); if (M.onchange) M.onchange(paintBtns);
  }
  function boot() {
    addButtons(); watchDialogs(); watchView();
    if (root.classList.contains('intro-on')) { play('intro'); setTimeout(function () { play('logo'); }, 1500); }
    if (root.classList.contains('route-in')) play('whoosh2');
    if (/status\.html$/.test(location.pathname)) play('wind');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.sfx = { play: play, names: Object.keys(S), enabled: enabled };
  if (M) { M.sound = function (k, a) { play(k, a); }; }
})();
