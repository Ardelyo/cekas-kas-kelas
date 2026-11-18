/* CEKAS "Langit" — pengaturan gerak: jeda, mode hemat, kecepatan, suara halus, transisi antar halaman. */
(function () {
  'use strict';
  var root = document.documentElement, KEY = 'cekas-motion';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var load = function () { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  var st = Object.assign({ lite: null, sound: false, speed: 1 }, load());
  /* fitur "Jeda gerak" dihapus: buang sisa pilihan lama di perangkat agar animasi tidak terus berhenti */
  if ('paused' in st) { delete st.paused; save(); }
  document.documentElement.classList.remove('motion-paused');
  var lowBattery = false, listeners = [];

  var auto = (function () {
    try {
      var c = navigator.connection; if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return true;
      if (navigator.deviceMemory && navigator.deviceMemory <= 2) return true;
      if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return true;
    } catch (e) {}
    return false;
  })();
  var isLite = function () { return st.lite === null ? (auto || lowBattery) : !!st.lite; };
  var rateT = 0;
  function applyRate() {
    var v = st.speed;
    try { if (window.gsap) gsap.globalTimeline.timeScale(v); } catch (e) {}
    try { if (document.getAnimations) document.getAnimations().forEach(function (a) { if (a.playbackRate !== v) a.updatePlaybackRate(v); }); } catch (e) {}
  }
  function apply() {
    root.classList.remove('motion-paused'); root.classList.toggle('lite', isLite());
    clearInterval(rateT); applyRate(); if (st.speed !== 1) rateT = setInterval(applyRate, 700);
    listeners.forEach(function (f) { try { f(st); } catch (e) {} });
  }
  try { if (navigator.getBattery) navigator.getBattery().then(function (b) { var f = function () { lowBattery = !b.charging && b.level < 0.2; apply(); }; f(); b.addEventListener('levelchange', f); b.addEventListener('chargingchange', f); }); } catch (e) {}

  /* ---------- suara halus (disintesis, tanpa berkas) ---------- */
  var ac = null;
  function tone(freq, t0, dur, vol) {
    var o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = freq; o.connect(g); g.connect(ac.destination);
    var t = ac.currentTime + t0; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.start(t); o.stop(t + dur + 0.05);
  }
  function sound(kind) {
    if (!st.sound || reduce) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
      if (kind === 'check' || kind === 'ok') { tone(784, 0, 0.5, 0.06); tone(1175, 0.09, 0.6, 0.05); }
      else if (kind === 'reject') { tone(330, 0, 0.35, 0.06); tone(262, 0.1, 0.4, 0.05); }
      else if (kind === 'lock') { tone(220, 0, 0.6, 0.06); }
      else if (kind === 'tick') { tone(1400, 0, 0.12, 0.03); }
    } catch (e) {}
  }

  /* ---------- transisi antar halaman: halaman lama terangkat, awan lewat ---------- */
  var routeOn = !reduce;
  try { if (routeOn && sessionStorage.getItem('cekas-route') === '1') { sessionStorage.removeItem('cekas-route'); root.classList.add('route-in'); setTimeout(function () { root.classList.remove('route-in'); }, 700); } } catch (e) {}
  document.addEventListener('click', function (e) {
    if (!routeOn || isLite() || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
    var a = e.target.closest && e.target.closest('a[href]'); if (!a || a.target === '_blank' || a.hasAttribute('download') || a.hasAttribute('data-leave') || a.classList.contains('skip-link')) return;
    var href = a.getAttribute('href'); if (!href || href.charAt(0) === '#' || /^(https?:|mailto:|tel:|webcal:)/.test(href)) return;
    var url; try { url = new URL(a.href, location.href); } catch (x) { return; }
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
    e.preventDefault(); document.body.classList.add('route-out');
    var c = document.createElement('img'); c.className = 'route-cloud'; c.src = 'assets/sky/cloud-b.webp'; c.alt = ''; document.body.appendChild(c);
    try { sessionStorage.setItem('cekas-route', '1'); } catch (x) {}
    setTimeout(function () { location.href = a.href; }, 320);
  });
  window.addEventListener('pageshow', function (e) { if (e.persisted) document.body.classList.remove('route-out'); });

  apply();
  window.motion = {
    state: st, isLite: isLite, autoLite: function () { return auto || lowBattery; }, sound: sound,
    set: function (k, v) { st[k] = v; save(); apply(); },
    onchange: function (f) { listeners.push(f); }
  };
})();
