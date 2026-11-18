/* CEKAS "Langit" — langit hidup: mengikuti waktu perangkat dan (opsional) cuaca sekitar.
   Privasi: cuaca hanya aktif jika kamu menyalakannya dan mengizinkan lokasi. Yang dikirim ke Open-Meteo
   hanya koordinat yang dibulatkan (±11 km), tanpa identitas. Hasilnya disimpan di perangkatmu saja. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var KEY = 'cekas-sky', WKEY = 'cekas-wx', TTL = 30 * 60 * 1000;
  var PH = ['fajar', 'pagi', 'siang', 'sore', 'senja', 'malam'], PH_L = { fajar: 'Fajar', pagi: 'Pagi', siang: 'Siang', sore: 'Sore', senja: 'Senja', malam: 'Malam' };
  var WX = ['cerah', 'berawan', 'mendung', 'hujan', 'kabut', 'badai'], WX_L = { cerah: 'Cerah', berawan: 'Berawan', mendung: 'Mendung', hujan: 'Hujan', kabut: 'Berkabut', badai: 'Badai petir' };
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var ls = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  var state = Object.assign({ time: true, wx: false, mode: 'kas' }, ls.get(KEY) || {});
  var preview = { phase: null, wx: null };
  var live = { code: null, temp: null, sr: null, ss: null, at: 0, status: 'idle' };
  var listeners = [];
  var hasKasMode = !!document.querySelector('[data-sky-kasmode]');

  /* ---------- waktu ---------- */
  function phaseNow() {
    var d = new Date(), m = d.getHours() * 60 + d.getMinutes(), sr = live.sr != null ? live.sr : 350, ss = live.ss != null ? live.ss : 1075;
    if (m < sr - 60 || m >= ss + 75) return 'malam';
    if (m < sr + 30) return 'fajar';
    if (m < 660) return 'pagi';
    if (m < ss - 150) return 'siang';
    if (m < ss - 30) return 'sore';
    return 'senja';
  }
  function mapWx(c) {
    if (c === 0 || c === 1) return 'cerah'; if (c === 2) return 'berawan'; if (c === 3) return 'mendung';
    if (c === 45 || c === 48) return 'kabut'; if (c >= 95) return 'badai';
    if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'hujan'; return 'mendung';
  }

  /* ---------- keadaan efektif ---------- */
  function effective() {
    var phase = preview.phase || (state.time ? phaseNow() : null);
    var realWx = state.wx && live.code != null ? mapWx(live.code) : null;
    var wx = preview.wx || realWx;
    if (hasKasMode && state.mode === 'kas' && !preview.wx) wx = null;
    return { phase: phase, wx: wx, realWx: realWx, kasMode: hasKasMode && state.mode === 'kas' && !preview.wx };
  }

  var ORB = {
    fajar: [16, 80, 54, '255,226,170', .85], pagi: [78, 24, 40, '255,247,214', .6], siang: [58, 7, 36, '255,255,255', .55],
    sore: [84, 42, 50, '255,226,150', .7], senja: [80, 74, 60, '255,150,70', .9], malam: [76, 20, 15, '226,238,255', .95]
  };
  var CB = { fajar: .62, pagi: .98, siang: 1, sore: .84, senja: .6, malam: .3 }, CS = { fajar: .8, pagi: 1, siang: 1, sore: .9, senja: .75, malam: .5 }, ST = { fajar: .55, pagi: 0, siang: 0, sore: 0, senja: .3, malam: 1 };
  var WB = { cerah: 1, berawan: .95, mendung: .72, hujan: .62, kabut: .85, badai: .5 }, WS = { cerah: 1, berawan: .9, mendung: .5, hujan: .45, kabut: .6, badai: .4 };
  var WSTAR = { cerah: 1, berawan: .6, mendung: .12, hujan: .06, kabut: .1, badai: 0 }, WORB = { cerah: 1, berawan: .6, mendung: .15, hujan: .08, kabut: .25, badai: 0 };

  function apply() {
    var e = effective(), p = e.phase, w = e.wx || 'cerah', s = root.style;
    root.dataset.skyPhase = p || 'off'; root.dataset.skyWx = e.wx || 'off';
    var orb = p ? ORB[p] : null;
    s.setProperty('--sx-cb', ((p ? CB[p] : 1) * WB[w]).toFixed(3)); s.setProperty('--sx-cs', ((p ? CS[p] : 1) * WS[w]).toFixed(3));
    s.setProperty('--sx-stars', ((p ? ST[p] : 0) * WSTAR[w]).toFixed(3));
    s.setProperty('--sx-aurora', ((p === 'malam' ? 1 : p === 'fajar' ? .25 : 0) * WSTAR[w]).toFixed(3));
    if (orb) { s.setProperty('--ox', orb[0]); s.setProperty('--oy', orb[1]); s.setProperty('--os', orb[2]); s.setProperty('--oc', orb[3]); s.setProperty('--oo', (orb[4] * WORB[w]).toFixed(3)); } else s.setProperty('--oo', 0);
    ensureImgs(e); updateUI(e);
    listeners.forEach(function (f) { try { f(e); } catch (x) {} });
  }

  /* ---------- suntik lapisan ---------- */
  function inject(host) {
    if (host.querySelector('.sx-base')) return;
    var base = document.createElement('div'); base.className = 'sx-base'; base.setAttribute('aria-hidden', 'true');
    base.innerHTML = ['malam', 'mendung', 'badai'].map(function (k) { return '<img class="sx-img sx-img--' + k + '" data-src="assets/weather/sky-' + k + '.webp" alt="" decoding="async">'; }).join('') +
      PH.map(function (x) { return '<div class="sx-ph sx-ph--' + x + '"></div>'; }).join('') + '<div class="sx-wx sx-wx--mendung"></div><div class="sx-wx sx-wx--storm"></div>';
    var photo = host.querySelector('picture') || host.querySelector('.hero__photo, .sky__photo');
    if (photo && photo.parentNode === host) host.insertBefore(base, photo.nextSibling); else host.insertBefore(base, host.firstChild);
    var a = document.createElement('div'); a.className = 'sx'; a.setAttribute('aria-hidden', 'true');
    a.innerHTML = '<div class="sx-aurora"><i></i><i></i><i></i></div><div class="sx-orb"></div><div class="sx-stars"></div>';
    var st = $('.sx-stars', a);
    var NSTAR = window.matchMedia('(pointer: coarse)').matches ? 34 : 70;
    for (var i = 0; i < NSTAR; i++) { var d = document.createElement('i'), z = 1 + Math.random() * 2; d.style.cssText = 'left:' + Math.random() * 100 + '%;top:' + Math.random() * 100 + '%;width:' + z + 'px;height:' + z + 'px;opacity:' + (.35 + Math.random() * .6) + ';animation-delay:' + (-Math.random() * 3) + 's;animation-duration:' + (2.4 + Math.random() * 2.4) + 's'; st.appendChild(d); }
    var firstCloud = host.querySelector('.cloud, .sky__cloud');
    if (firstCloud) host.insertBefore(a, firstCloud); else host.appendChild(a);
    var b = document.createElement('div'); b.className = 'sx-top'; b.setAttribute('aria-hidden', 'true');
    b.innerHTML = '<div class="sx-wx sx-wx--kabut"></div><div class="sx-rain"></div><div class="sx-rain sx-rain--b"></div><div class="sx-flash"></div>';
    host.appendChild(b);
  }
  /* foto cuaca dimuat hanya saat dibutuhkan (hemat kuota) */
  function ensureImgs(e) {
    var w = e.wx, n = e.phase === 'malam' && (!w || w === 'cerah' || w === 'berawan');
    var need = { malam: n, mendung: w === 'mendung' || w === 'hujan' || w === 'kabut' || w === 'badai', badai: w === 'badai' };
    $$('.sx-img').forEach(function (img) { var k = /sx-img--(\w+)/.exec(img.className)[1]; if (need[k] && !img.getAttribute('src')) img.src = img.dataset.src; });
  }
  $$('.hero__sky, .sky').forEach(inject);

  /* ---------- cuaca (opsional) ---------- */
  function minutes(iso) { var m = /T(\d\d):(\d\d)/.exec(iso || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  function fromCache() {
    var c = ls.get(WKEY); if (!c || Date.now() - c.at > 6 * 3600 * 1000) return false;
    live.code = c.code; live.temp = c.temp; live.sr = c.sr; live.ss = c.ss; live.at = c.at; live.status = Date.now() - c.at > TTL ? 'stale' : 'ready'; return true;
  }
  function geo() {
    return new Promise(function (res, rej) {
      if (!navigator.geolocation) return rej({ code: 'nogeo' });
      navigator.geolocation.getCurrentPosition(function (p) { res(p); }, function (e) { rej({ code: e.code === 1 ? 'denied' : 'fail' }); }, { timeout: 9000, maximumAge: 600000 });
    });
  }
  async function refresh(interactive) {
    live.status = 'asking'; updateUI(effective());
    try {
      var p = await geo(), lat = Math.round(p.coords.latitude * 10) / 10, lon = Math.round(p.coords.longitude * 10) / 10;
      live.status = 'loading'; updateUI(effective());
      var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 9000);
      var r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current=weather_code,temperature_2m&daily=sunrise,sunset&timezone=auto&forecast_days=1', { signal: ctl.signal });
      clearTimeout(t); if (!r.ok) throw { code: 'net' };
      var j = await r.json();
      live.code = j.current.weather_code; live.temp = Math.round(j.current.temperature_2m); live.sr = minutes(j.daily && j.daily.sunrise && j.daily.sunrise[0]); live.ss = minutes(j.daily && j.daily.sunset && j.daily.sunset[0]); live.at = Date.now(); live.status = 'ready';
      ls.set(WKEY, { code: live.code, temp: live.temp, sr: live.sr, ss: live.ss, at: live.at });
    } catch (e) {
      live.status = e && e.code === 'denied' ? 'denied' : e && e.code === 'nogeo' ? 'nogeo' : 'error';
      if (interactive && live.status === 'denied') { state.wx = false; ls.set(KEY, state); }
    }
    apply();
  }
  var wxTimer = 0;
  function startWx(interactive) {
    clearInterval(wxTimer);
    if (!state.wx) { live.status = 'idle'; return; }
    var cached = fromCache();
    if (cached && Date.now() - live.at < TTL && !interactive) { apply(); } else refresh(!!interactive);
    wxTimer = setInterval(function () { if (state.wx && !document.hidden) refresh(false); }, TTL);
  }

  /* ---------- UI ---------- */
  var ICON = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    low: '<path d="M7 16a5 5 0 0 1 10 0M12 6v2.5M5 9l1.6 1.6M19 9l-1.6 1.6M3 16h18M6 20h12"/>',
    cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4.8 4.8 0 0 1-.5 9.5z"/>',
    rain: '<path d="M7 14a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 4.5 4.8 4.8 0 0 1 17.5 14zM8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
    csun: '<path d="M8 19a4 4 0 0 1-.4-8A5.2 5.2 0 0 1 17.8 11a3.6 3.6 0 0 1-.3 8zM9 6.5a4 4 0 0 1 6.5-1M5 8L4 7M12 2v1.4"/>'
  };
  function iconFor(e) {
    if (!e.phase && !e.wx) return 'cloud';
    if (e.wx === 'hujan' || e.wx === 'badai') return 'rain'; if (e.wx === 'mendung' || e.wx === 'kabut') return 'cloud'; if (e.wx === 'berawan' && e.phase !== 'malam') return 'csun';
    if (e.phase === 'malam') return 'moon'; if (e.phase === 'sore' || e.phase === 'senja' || e.phase === 'fajar') return 'low'; return 'sun';
  }
  var btns = [], pop = null, openBtn = null;
  function label(e) { var a = e.phase ? PH_L[e.phase] : 'Langit biasa'; var w = e.wx ? WX_L[e.wx] : null; return a + (w ? ' · ' + w : ''); }
  function statusText() {
    if (!state.wx) return 'Memakai lokasi kasar dan layanan Open-Meteo. Hanya jika kamu izinkan.';
    return { asking: 'Meminta izin lokasi…', loading: 'Mengambil cuaca…', ready: 'Cuaca sekitarmu: ' + (live.code != null ? WX_L[mapWx(live.code)] + ', ' + live.temp + '°C' : '-'), stale: 'Data lama: ' + (live.code != null ? WX_L[mapWx(live.code)] + ', ' + live.temp + '°C' : '-') + '. Ketuk untuk memperbarui.', denied: 'Izin lokasi ditolak. Cuaca tidak dipakai.', nogeo: 'Perangkat ini tidak punya layanan lokasi.', error: 'Tidak bisa mengambil cuaca. Coba lagi nanti.', idle: 'Menunggu…' }[live.status] || '';
  }
  function updateUI(e) {
    btns.forEach(function (b) {
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[iconFor(e)] + '</svg>';
      b.setAttribute('aria-label', 'Langit: ' + label(e) + '. Buka pengaturan langit'); b.classList.toggle('is-off', !state.time && !state.wx && !preview.phase && !preview.wx);
    });
    if (!pop) return;
    $('.skypop__now', pop).textContent = label(e);
    $('#sxTime', pop).checked = state.time; $('#sxWx', pop).checked = state.wx; $('#sxWxS', pop).textContent = statusText();
    var mode = $('.skypop__mode', pop); if (mode) { mode.hidden = !hasKasMode; $$('button', mode).forEach(function (b) { b.classList.toggle('on', b.dataset.v === state.mode); }); }
    if (window.motion && $('#mvPause', pop)) {
      var ms = motion.state; $('#mvPause', pop).checked = !!ms.paused; $('#mvLite', pop).checked = motion.isLite(); $('#mvSound', pop).checked = !!ms.sound; $('#mvSpeed', pop).value = ms.speed; $('#mvSpeedV', pop).textContent = String(ms.speed).replace('.', ',') + '\u00d7';
      $('#mvLiteS', pop).textContent = motion.autoLite() ? 'Aktif otomatis di perangkat ini (hemat data, memori kecil, atau baterai rendah).' : 'Matikan awan berat, bintang, dan hujan. Otomatis di perangkat lemah.';
    }
    $$('[data-ph]', pop).forEach(function (b) { b.classList.toggle('on', preview.phase === b.dataset.ph); }); $$('[data-wx]', pop).forEach(function (b) { b.classList.toggle('on', preview.wx === b.dataset.wx); });
  }
  function build() {
    pop = document.createElement('div'); pop.className = 'skypop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Pengaturan langit');
    pop.innerHTML = '<div class="skypop__h"><b>Langit hidup</b><span class="skypop__now"></span></div>' +
      '<label class="skysw"><span><b>Ikuti waktu</b><small>Pagi, siang, sore, dan malam sesuai jam di perangkatmu.</small></span><input type="checkbox" role="switch" id="sxTime"><i></i></label>' +
      '<label class="skysw"><span><b>Ikuti cuaca sekitar</b><small id="sxWxS"></small></span><input type="checkbox" role="switch" id="sxWx"><i></i></label>' +
      '<div class="skypop__mode" hidden><b>Di dashboard, cuaca langit mengikuti</b><div class="skyseg"><button type="button" data-v="kas">Kondisi kas</button><button type="button" data-v="real">Cuaca sekitar</button></div></div>' +
      '<details id="mvBox"><summary>Gerak dan hemat</summary>' +
      '<label class="skysw"><span><b>Jeda gerak</b><small>Hentikan awan, karusel, dan animasi berulang.</small></span><input type="checkbox" role="switch" id="mvPause"><i></i></label>' +
      '<label class="skysw"><span><b>Mode hemat</b><small id="mvLiteS"></small></span><input type="checkbox" role="switch" id="mvLite"><i></i></label>' +
      '<label class="skysw"><span><b>Suara halus</b><small>Denting lembut saat disahkan. Mati secara bawaan.</small></span><input type="checkbox" role="switch" id="mvSound"><i></i></label>' +
      '<div class="skypop__mode"><b>Kecepatan gerak <span id="mvSpeedV">1\u00d7</span></b><input type="range" class="skyrange" id="mvSpeed" min="0.25" max="2" step="0.25" value="1" aria-label="Kecepatan gerak"><div class="skyrange__l"><span>Pelan</span><span>Normal</span><span>Cepat</span></div></div></details>' +
      '<details><summary>Pratinjau langit</summary><span class="skychips__l">Waktu</span><div class="skychips">' + PH.map(function (p) { return '<button type="button" data-ph="' + p + '">' + PH_L[p] + '</button>'; }).join('') + '</div><span class="skychips__l">Cuaca</span><div class="skychips">' + WX.map(function (w) { return '<button type="button" data-wx="' + w + '">' + WX_L[w] + '</button>'; }).join('') + '</div><div class="skychips"><button type="button" id="sxReset">Atur ulang pratinjau</button></div></details>' +
      '<p class="skypop__note">Cuaca memakai Open-Meteo. Hanya koordinat yang dibulatkan (±11 km) yang dikirim, tanpa identitas. Hasilnya disimpan di perangkatmu saja.</p>';
    document.body.appendChild(pop);
    var demo = window.matchMedia('(max-width: 759px)').matches ? document.querySelector('.demo') : null;
    if (demo) { var db = demo.querySelector('.demo__body'), dd = document.createElement('details'); dd.className = 'skydemo'; dd.innerHTML = '<summary>Alat desain (uji)</summary>'; dd.appendChild(db); pop.insertBefore(dd, $('.skypop__note', pop)); demo.remove(); }
    $('#sxTime', pop).addEventListener('change', function () { state.time = this.checked; ls.set(KEY, state); apply(); });
    $('#sxWx', pop).addEventListener('change', function () { state.wx = this.checked; ls.set(KEY, state); if (state.wx) startWx(true); else { clearInterval(wxTimer); live.status = 'idle'; apply(); } });
    $('#sxWxS', pop).addEventListener('click', function (e) { if (state.wx && (live.status === 'stale' || live.status === 'error')) { e.preventDefault(); refresh(true); } });
    $$('[data-ph]', pop).forEach(function (b) { b.addEventListener('click', function () { preview.phase = preview.phase === b.dataset.ph ? null : b.dataset.ph; apply(); }); });
    $$('[data-wx]', pop).forEach(function (b) { b.addEventListener('click', function () { preview.wx = preview.wx === b.dataset.wx ? null : b.dataset.wx; apply(); }); });
    if (window.motion) {
      $('#mvPause', pop).addEventListener('change', function () { motion.set('paused', this.checked); });
      $('#mvLite', pop).addEventListener('change', function () { motion.set('lite', this.checked); });
      $('#mvSound', pop).addEventListener('change', function () { motion.set('sound', this.checked); if (this.checked) motion.sound('ok'); });
      $('#mvSpeed', pop).addEventListener('input', function () { motion.set('speed', +this.value); $('#mvSpeedV', pop).textContent = (+this.value).toString().replace('.', ',') + '\u00d7'; });
      motion.onchange(function () { if (pop && !pop.hidden) updateUI(effective()); });
    }
    $('#sxReset', pop).addEventListener('click', function () { preview.phase = preview.wx = null; apply(); });
    $$('.skypop__mode button', pop).forEach(function (b) { b.addEventListener('click', function () { state.mode = b.dataset.v; ls.set(KEY, state); apply(); }); });
  }
  function place() {
    if (!openBtn) return; var r = openBtn.getBoundingClientRect(), w = pop.offsetWidth, left = Math.min(Math.max(12, r.right - w), window.innerWidth - w - 12);
    pop.style.left = left + 'px'; pop.style.top = Math.min(r.bottom + 10, window.innerHeight - pop.offsetHeight - 12) + 'px';
    pop.style.transformOrigin = (r.right - left - 19) + 'px 0';
  }
  function toggle(b) {
    if (!pop) build();
    var open = !pop.hidden && openBtn === b;
    if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
    if (open) { pop.hidden = true; openBtn = null; return; }
    openBtn = b; b.setAttribute('aria-expanded', 'true'); pop.hidden = false; updateUI(effective()); place();
    var f = $('#sxTime', pop); if (f) f.focus({ preventScroll: true });
  }
  if (window.matchMedia('(max-width: 759px)').matches && document.querySelector('.demo')) build();
  $$('[data-skyctl]').forEach(function (host) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'skybtn'; b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', function (e) { e.stopPropagation(); toggle(b); }); host.appendChild(b); btns.push(b);
  });
  document.addEventListener('click', function (e) { if (pop && !pop.hidden && !pop.contains(e.target) && !e.target.closest('.skybtn')) { pop.hidden = true; if (openBtn) openBtn.setAttribute('aria-expanded', 'false'); openBtn = null; } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop && !pop.hidden) { pop.hidden = true; if (openBtn) { openBtn.setAttribute('aria-expanded', 'false'); openBtn.focus(); } openBtn = null; } });
  window.addEventListener('resize', function () { if (pop && !pop.hidden) place(); }); window.addEventListener('scroll', function () { if (pop && !pop.hidden) place(); }, { passive: true });

  /* ---------- mulai ---------- */
  if (state.wx) { fromCache(); }
  apply();
  setInterval(function () { if (!document.hidden) apply(); }, 60 * 1000);
  if (state.wx) {
    if (navigator.permissions && navigator.permissions.query) navigator.permissions.query({ name: 'geolocation' }).then(function (p) { if (p.state === 'granted') startWx(false); else { live.status = live.code != null ? 'stale' : 'idle'; apply(); } }).catch(function () {});
    else startWx(false);
  }

  window.skyfx = { state: state, effective: effective, label: label, onchange: function (f) { listeners.push(f); }, WX_L: WX_L };
})();
