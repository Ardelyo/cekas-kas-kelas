/* CEKAS "Langit" — dashboard publik (prototipe, data fiktif). */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var fmt = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  var rp = function (n) { return (n < 0 ? '−' : '') + 'Rp ' + fmt(Math.abs(n)); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ic = function (id, cls) { return '<svg class="ic ' + (cls || '') + '"><use href="#i-' + id + '"/></svg>'; };
  var buzz = function (ms) { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) {} };
  var hasGsap = typeof window.gsap !== 'undefined';

  /* ---------- data fiktif ---------- */
  var POS = [
    { k: 'op', name: 'Operasional' }, { k: 'so', name: 'Sosial' }, { k: 'ev', name: 'Event' }, { k: 'ca', name: 'Cadangan' }
  ];
  var POSNOTE = { op: 'Spidol, fotokopi, kebersihan', so: 'Jenguk dan sumbangan', ev: 'Lomba dan acara kelas', ca: 'Dana darurat' };
  var posName = function (k) { return POS.filter(function (p) { return p.k === k; })[0].name; };
  var AVG_SPEND = 105000, NOMINAL = 10000, APPROVAL_MIN = 50000;
  var NAMES = ['Aditya', 'Bella', 'Citra', 'Dimas', 'Eka', 'Farhan', 'Gita', 'Hana', 'Indra', 'Jihan', 'Kevin', 'Laila', 'Mario', 'Nadia', 'Okta', 'Putri', 'Qori', 'Rafi', 'Salsa', 'Tegar', 'Umar', 'Vina', 'Wulan', 'Yusuf', 'Zahra', 'Alya', 'Bima', 'Cakra', 'Dwi', 'Elsa', 'Fikri', 'Galih', 'Hafiz', 'Ilham'];
  var TOTAL = NAMES.length;

  var state = {
    role: (function () { var q = (location.search.match(/peran=([a-z]+)/) || [])[1], r = q || (function () { try { return sessionStorage.getItem('cekas-role'); } catch (e) { return null; } })(); return ['bendahara', 'guru'].indexOf(r) >= 0 ? r : 'siswa'; })(), wx: 'auto', flash: null, week: 1, activeWeek: 1, hidden: false, now: new Date(), dateMode: 0, weeks: [],
    nextId: 1, nextPid: 41,
    tx: [], pending: [], proposals: [{ id: 7, desc: 'Fotokopi modul bulan ini', cat: 'op', amt: -85000, by: 'Bendahara', yes: 2, needed: 3 }],
    dues: {}
  };
  /* ---------- kalender iuran: 4 minggu per bulan ---------- */
  var DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'], DS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var MONF = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var DAY_MS = 864e5, HOUR_MS = 36e5, MIN_MS = 6e4;
  var pad2 = function (n) { return String(n).padStart(2, '0'); };
  var dayLabel = function (d) { return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()]; };
  var todayLabel = function () { return dayLabel(state.now); };
  var clock = function (d) { return pad2(d.getHours()) + '.' + pad2(d.getMinutes()); };
  function mkWeeks(now) {
    var y = now.getFullYear(), m = now.getMonth(), first = new Date(y, m, 1), off = (1 - first.getDay() + 7) % 7, ws = [];
    for (var k = 0; k < 4; k++) {
      var s = new Date(y, m, 1 + off + 7 * k), e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6, 23, 59), due = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 4, 15, 0);
      ws.push({ n: k + 1, start: s, end: e, due: due });
    }
    return ws;
  }
  function weekStatus(w) { return state.now > w.end ? 'selesai' : state.now >= w.start ? 'berjalan' : 'akan'; }
  function rangeLabel(w) { var s = w.start, e = new Date(w.end.getFullYear(), w.end.getMonth(), w.end.getDate()); return s.getMonth() === e.getMonth() ? s.getDate() + '\u2013' + e.getDate() + ' ' + MON[e.getMonth()] : s.getDate() + ' ' + MON[s.getMonth()] + ' \u2013 ' + e.getDate() + ' ' + MON[e.getMonth()]; }
  function dur(ms) {
    var d = Math.floor(ms / DAY_MS), h = Math.floor((ms % DAY_MS) / HOUR_MS), m = Math.floor((ms % HOUR_MS) / MIN_MS);
    if (d > 0) return d + ' hari ' + h + ' jam'; if (h > 0) return h + ' jam ' + m + ' menit'; return Math.max(1, m) + ' menit';
  }

  function seed() {
    state.tx = []; state.nextId = 1; state.pending = []; state.dues = {};
    state.proposals = [{ id: 7, desc: 'Fotokopi modul bulan ini', cat: 'op', amt: -85000, by: 'Bendahara', yes: 2, needed: 3 }];
    state.weeks = mkWeeks(state.now);
    var cw = 1; state.weeks.forEach(function (w) { if (state.now >= w.start) cw = w.n; });
    state.activeWeek = cw; state.week = cw;
    var rows = [
      [1, 0, '07:10', 'Saldo awal operasional', 'op', 100000], [1, 0, '07:11', 'Dana cadangan awal', 'ca', 300000], [1, 0, '07:12', 'Iuran sosial semester', 'so', 390000],
      [1, 1, '09:05', 'Beli spidol dan penghapus', 'op', -45000],
      [1, 4, '15:30', 'Iuran minggu 1 (34 siswa)', 'op', 340000, 1], [1, 4, '16:02', 'Pemasukan lomba kebersihan', 'ev', 300000],
      [2, 0, '10:20', 'Konsumsi lomba kebersihan', 'ev', -120000], [2, 2, '13:15', 'Sumbangan jenguk teman sakit', 'so', -150000],
      [2, 4, '15:35', 'Iuran minggu 2 (33 siswa)', 'op', 330000, 1], [3, 4, '15:40', 'Iuran minggu 3 (34 siswa)', 'op', 340000, 1]
    ];
    rows.forEach(function (r) {
      if (r[6] && r[0] >= cw) return;
      var wk = state.weeks[r[0] - 1], d = new Date(wk.start.getFullYear(), wk.start.getMonth(), wk.start.getDate() + r[1]), hm = r[2].split(':'); d.setHours(+hm[0], +hm[1]);
      if (d > state.now) return;
      state.tx.push({ id: state.nextId++, date: d, day: dayLabel(d), time: r[2], desc: r[3], cat: r[4], amt: r[5], w: r[0], by: 'Bendahara', ok: 'Wali Kelas (contoh)' });
    });
    state.pending.push({ id: 40, desc: 'Beli kapur dan penghapus', cat: 'op', amt: -28000, by: 'Bendahara' });
    state.weeks.forEach(function (w) {
      var a = [], i, st = weekStatus(w); for (i = 0; i < TOTAL; i++) a.push(st === 'akan' ? 'todo' : 'paid');
      if (st === 'selesai' && w.n === cw - 1) a[7] = 'todo';
      if (st === 'berjalan') { for (i = 24; i < 30; i++) a[i] = 'wait'; for (i = 30; i < TOTAL; i++) a[i] = 'todo'; }
      state.dues[w.n] = a;
    });
    rehash();
  }
  (function () { var m = location.search.match(/tanggal=(\d{4})-(\d\d)-(\d\d)/); if (m) state.now = new Date(+m[1], +m[2] - 1, +m[3], 10, 30); })();
  seed();

  function rehash() {
    var prev = 'GENESIS';
    state.tx.forEach(function (t) { t.prev = prev; t.hash = window.sha256(prev + '|' + t.desc + '|' + t.amt + '|' + t.cat); prev = t.hash; });
  }
  function chainOk() {
    var prev = 'GENESIS', bad = -1;
    state.tx.forEach(function (t, i) { var h = window.sha256(prev + '|' + t.desc + '|' + t.amt + '|' + t.cat); if (h !== t.hash && bad < 0) bad = i; prev = t.hash; });
    return bad;
  }
  var saldo = function () { return state.tx.reduce(function (s, t) { return s + t.amt; }, 0); };
  var posSaldo = function (k) { return state.tx.reduce(function (s, t) { return t.cat === k ? s + t.amt : s; }, 0); };
  var weeksLeft = function () { return Math.max(0, Math.floor(saldo() / AVG_SPEND)); };
  var isGuru = function () { return state.role === 'guru'; };
  var isAdmin = function () { return state.role === 'bendahara'; };

  /* ---------- toast ---------- */
  var toastEl = $('#toast'), toastMsg = $('#toastMsg'), toastUndo = $('#toastUndo'), toastT = 0, undoFn = null;
  function toast(msg, undo) {
    toastMsg.textContent = msg; undoFn = undo || null; toastUndo.hidden = !undo;
    var dur = undo ? 6000 : 3200; toastEl.style.setProperty('--dur', dur + 'ms');
    toastEl.classList.remove('is-on'); void toastEl.offsetWidth; toastEl.classList.add('is-on'); clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('is-on'); undoFn = null; }, dur);
  }
  toastUndo.addEventListener('click', function () { if (undoFn) { var f = undoFn; undoFn = null; f(); } toastEl.classList.remove('is-on'); });

  /* ---------- cuaca kas ---------- */
  var wxNow = 'cerah';
  function applyWeather() {
    var n = weeksLeft();
    var auto = n >= 12 ? 'cerah' : n >= 6 ? 'berawan' : 'mendung';
    wxNow = state.wx === 'auto' ? auto : state.wx;
    var b = document.body, sx = window.skyfx ? skyfx.effective() : null, real = sx && !sx.kasMode && sx.wx;
    if (real) wxNow = 'cerah';
    b.classList.remove('wx-cerah', 'wx-berawan', 'wx-mendung'); b.classList.add('wx-' + wxNow);
    $('#wxText').textContent = real ? 'Langit ' + skyfx.WX_L[sx.wx].toLowerCase() : { cerah: 'Cerah', berawan: 'Berawan', mendung: 'Mendung' }[wxNow];
    $('#forecastChip').textContent = 'Cukup ± ' + n + ' minggu';
  }

  if (window.skyfx) skyfx.onchange(function () { applyWeather(); });

  /* ---------- hero ---------- */
  var shown = 0;
  /* saldo bergulir digit seperti hitung mundur */
  function buildOdo(el, s, prev, roll) {
    var chars = s.split(''), pc = prev ? prev.split('') : [], n = chars.length, html = '<span class="sr">' + s + '</span><span class="odo" aria-hidden="true">';
    for (var i = 0; i < n; i++) {
      var c = chars[i];
      if (/\d/.test(c)) {
        var pi = i - (n - pc.length), pd = pi >= 0 && /\d/.test(pc[pi] || '') ? +pc[pi] : 0, from = roll ? pd : +c, strip = '';
        for (var d = 0; d < 10; d++) strip += '<i>' + d + '</i>';
        html += '<span class="od"><span class="od__s" style="--d:' + from + ';--i:' + (n - 1 - i) + '" data-to="' + c + '">' + strip + '</span></span>';
      } else html += '<span class="od__p">' + c + '</span>';
    }
    el.innerHTML = html + '</span>';
    if (roll) requestAnimationFrame(function () { requestAnimationFrame(function () { $$('.od__s', el).forEach(function (x) { x.style.setProperty('--d', x.dataset.to); }); }); });
  }
  function setAmount(to, animate) { var el = $('#amountNum'); buildOdo(el, fmt(to), fmt(shown), !!animate && !reduce); shown = to; }
  function renderHero(animate) {
    setAmount(saldo(), animate);
    var maxW = Math.max.apply(null, state.tx.map(function (t) { return t.w; }));
    var d = state.tx.reduce(function (s, t) { return t.w === maxW ? s + t.amt : s; }, 0);
    var el = $('#delta'); el.className = 'delta' + (d < 0 ? ' neg' : '');
    el.innerHTML = ic(d < 0 ? 'out' : 'in', 'ic-sm') + '<span>' + (d < 0 ? '−' : '+') + 'Rp ' + fmt(Math.abs(d)) + ' minggu ' + maxW + '</span>';
    var ma = $('#miniAmt'); if (ma) ma.textContent = rp(saldo());
    applyWeather(); renderSpark();
  }
  $('#eyeBtn').addEventListener('click', function () {
    state.hidden = !state.hidden; var b = this;
    $('#amount').classList.toggle('is-hidden', state.hidden); b.setAttribute('aria-pressed', state.hidden);
    b.setAttribute('aria-label', state.hidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'); b.innerHTML = ic(state.hidden ? 'eye-off' : 'eye');
    try { localStorage.setItem('cekas-hide', state.hidden ? '1' : '0'); } catch (e) {}
  });
  try { if (localStorage.getItem('cekas-hide') === '1') $('#eyeBtn').click(); } catch (e) {}

  /* sparkline */
  var sparkPts = [];
  function renderSpark() {
    var byW = {}; state.tx.forEach(function (t) { byW[t.w] = (byW[t.w] || 0) + t.amt; });
    var ws = Object.keys(byW).map(Number).sort(function (a, b) { return a - b; }), run = 0;
    sparkPts = [{ w: ws[0] - 1, v: 0 }].concat(ws.map(function (w) { run += byW[w]; return { w: w, v: run }; }));
    if (sparkPts.length < 2) sparkPts.push({ w: sparkPts[0].w + 1, v: 0 });
    var max = Math.max.apply(null, sparkPts.map(function (p) { return p.v; })), min = 0, W = 400, H = 84, padY = 10;
    var xy = sparkPts.map(function (p, i) { return [i / (sparkPts.length - 1) * W, H - padY - (p.v - min) / ((max - min) || 1) * (H - padY * 2)]; });
    var d = 'M' + xy[0][0] + ' ' + xy[0][1];
    for (var i = 1; i < xy.length; i++) { var mx = (xy[i - 1][0] + xy[i][0]) / 2; d += ' C' + mx + ' ' + xy[i - 1][1] + ' ' + mx + ' ' + xy[i][1] + ' ' + xy[i][0] + ' ' + xy[i][1]; }
    $('#sparkLine').setAttribute('d', d); $('#sparkFill').setAttribute('d', d + ' L' + W + ' ' + H + ' L0 ' + H + ' Z');
    sparkPts.forEach(function (p, i) { p.x = xy[i][0] / W; p.y = xy[i][1] / H; });
  }
  (function sparkScrub() {
    var box = $('#spark'), tip = $('#sparkTip'), dot = document.createElement('i');
    dot.style.cssText = 'position:absolute;width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:0 0 0 4px rgba(255,255,255,.3);transform:translate(-50%,-50%);opacity:0;transition:opacity .2s;pointer-events:none';
    box.appendChild(dot);
    function move(e) {
      var r = box.getBoundingClientRect(), x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), best = sparkPts[0];
      sparkPts.forEach(function (p) { if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p; });
      tip.textContent = 'Minggu ' + best.w + ' · ' + rp(best.v); tip.style.left = Math.min(Math.max(best.x * 100, 14), 86) + '%';
      dot.style.left = best.x * 100 + '%'; dot.style.top = best.y * 100 + '%'; dot.style.opacity = 1; box.classList.add('is-on');
    }
    box.addEventListener('pointermove', move); box.addEventListener('pointerdown', move);
    ['pointerleave', 'pointerup', 'pointercancel'].forEach(function (ev) { box.addEventListener(ev, function () { box.classList.remove('is-on'); dot.style.opacity = 0; }); });
  })();

  /* ---------- verifikasi rantai ---------- */
  var badge = $('#badge'), vRun = 0;
  function setBadge(kind, text, anim) {
    var mb = $('#miniBadge'); if (mb) { mb.className = 'minibar__b' + (kind === 'bad' ? ' bad' : ''); var mt = $('#miniBadgeT'); if (mt) mt.textContent = kind === 'ok' ? 'Terverifikasi' : kind === 'bad' ? 'Perlu diperiksa' : 'Memeriksa\u2026'; }
    badge.className = 'badge badge--' + kind;
    badge.innerHTML = ic(kind === 'ok' ? 'check' : kind === 'bad' ? 'alert' : 'clock', 'ic-sm') + '<span>' + text + '</span>';
    if (anim) { void badge.offsetWidth; badge.classList.add(kind === 'ok' ? 'is-pulse' : 'is-shake'); }
  }
  async function verify() {
    var my = ++vRun; setBadge('busy', 'Memeriksa…', false);
    var rows = $$('#history .tx'); rows.forEach(function (r) { r.classList.remove('is-ok'); });
    for (var i = rows.length - 1; i >= 0; i--) {
      if (!reduce) await new Promise(function (r) { setTimeout(r, 70); });
      if (my !== vRun) return; rows[i].classList.add('is-ok');
    }
    var bad = chainOk();
    if (bad < 0) setBadge('ok', 'Terverifikasi · ' + state.tx.length + ' catatan', true);
    else setBadge('bad', 'Perlu diperiksa · mulai catatan #' + state.tx[bad].id, true);
  }
  badge.addEventListener('click', function () { toast('Rantai hash utuh. Sidik terakhir: ' + state.tx[state.tx.length - 1].hash.slice(0, 10) + '…'); });

  /* ---------- pos ---------- */
  function renderPos() {
    var tot = Math.max(1, POS.reduce(function (s, p) { return s + Math.max(0, posSaldo(p.k)); }, 0));
    $('#posGrid').innerHTML = POS.map(function (p) {
      var v = posSaldo(p.k);
      return '<button class="pos" type="button" data-k="' + p.k + '" data-p="' + Math.round(Math.max(0, v) / tot * 100) + '" aria-label="' + p.name + ' ' + rp(v) + '"><span class="pos__ring"></span><span class="pos__n">' + p.name + '</span><span class="pos__v num">' + rp(v) + '</span><span class="pos__d">' + POSNOTE[p.k] + '</span></button>';
    }).join('');
    var g = $('#posGrid');
    $$('.pos', g).forEach(function (el) {
      requestAnimationFrame(function () { el.style.setProperty('--p', el.dataset.p); });
      var on = function () { g.classList.add('has-focus'); $$('.pos', g).forEach(function (o) { o.classList.toggle('is-focus', o === el); }); };
      var off = function () { g.classList.remove('has-focus'); $$('.pos', g).forEach(function (o) { o.classList.remove('is-focus'); }); };
      el.addEventListener('pointerenter', on); el.addEventListener('pointerleave', off); el.addEventListener('focus', on); el.addEventListener('blur', off);
      el.addEventListener('click', function () { el.classList.contains('is-focus') && g.classList.contains('has-focus') ? off() : on(); });
    });
  }

  /* ---------- tips ---------- */
  function renderTips() {
    var n = weeksLeft(), t = [];
    var todo = state.dues[state.week].filter(function (s) { return s === 'todo'; }).length;
    if (n < 6) t.push(['crit', 'alert', 'Saldo tinggal cukup ± ' + n + ' minggu. Pertimbangkan menunda belanja besar.']);
    else t.push(['info', 'info', 'Kalau belanjanya sama seperti biasa, saldo cukup ± ' + n + ' minggu lagi.']);
    if (todo) t.push(['warn', 'clock', 'Masih ' + todo + ' teman belum bayar iuran minggu ' + state.week + '.']);
    var top = POS.slice().sort(function (a, b) { return posSaldo(b.k) - posSaldo(a.k); })[0];
    t.push(['info', 'info', 'Pos terbesar sekarang: ' + top.name + ' (' + rp(posSaldo(top.k)) + ').']);
    $('#tips').innerHTML = t.map(function (x) { return '<div class="tip ' + x[0] + '"><span class="ti">' + ic(x[1], 'ic-sm') + '</span><span>' + esc(x[2]) + '</span></div>'; }).join('');
  }

  /* ---------- usulan ---------- */
  function renderProposals() {
    var el = $('#proposals');
    if (!state.proposals.length) { el.innerHTML = '<div class="empty"><b>Belum ada usulan</b>Belanja besar akan muncul di sini supaya disetujui bareng-bareng.</div>'; return; }
    el.innerHTML = state.proposals.map(function (p) {
      var pips = ''; for (var i = 0; i < p.needed; i++) pips += '<i class="' + (i < p.yes ? 'on' : '') + '">' + (i < p.yes ? ic('check', 'ic-sm') : '') + '</i>';
      return '<div class="prop' + (state.flash === p.id ? ' prop--new' : '') + '"><div class="top"><span class="t">' + esc(p.desc) + '</span><span class="a num out">' + rp(Math.abs(p.amt)) + '</span></div><div class="m">#' + p.id + ' · ' + posName(p.cat) + ' · diajukan ' + esc(p.by) + '</div><div class="pips" aria-label="' + p.yes + ' dari ' + p.needed + ' teman setuju">' + pips + '<span>' + p.yes + ' dari ' + p.needed + ' teman setuju</span></div><div class="m">Beri suara lewat bot Telegram.</div>' + (isAdmin() ? '<div class="acts"><button class="btn btn--tonal btn--sm" data-act="cancel-prop" data-id="' + p.id + '" type="button">Batalkan usulan</button></div>' : '') + '</div>';
    }).join('');
  }

  /* ---------- antrean Wali Kelas ---------- */
  function dueGroups() {
    var out = [];
    Object.keys(state.dues).forEach(function (w) { var n = state.dues[w].filter(function (s) { return s === 'wait'; }).length; if (n) out.push({ w: +w, n: n }); });
    return out;
  }
  function holdable(btn, ms, done) {
    var raf = 0, t0 = 0;
    function stop() { cancelAnimationFrame(raf); raf = 0; btn.classList.remove('is-holding'); btn.style.setProperty('--hold', 0); }
    btn.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return; btn.classList.add('is-holding'); t0 = performance.now();
      (function tick() { var p = Math.min(1, (performance.now() - t0) / ms); btn.style.setProperty('--hold', p); if (p >= 1) { stop(); done(); } else raf = requestAnimationFrame(tick); })();
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { btn.addEventListener(ev, function () { if (raf) stop(); }); });
    btn.addEventListener('click', function (e) { if (e.detail === 0) done(); });
  }
  function renderQueue() {
    var el = $('#queue'), g = dueGroups(), n = state.pending.length + g.length;
    $('#queueCount').textContent = n ? n + ' menunggu' : '';
    if (!n) { el.innerHTML = '<div class="empty empty--ok"><span class="seal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><b>Semua sudah disahkan</b>Tidak ada catatan yang menunggu Wali Kelas.</div>'; return; }
    var html = state.pending.map(function (p) {
      return '<div class="prop wait' + (state.flash === p.id ? ' prop--new' : '') + '" data-pid="' + p.id + '" data-kind="tx"><div class="prop__hint">' + ic('check') + '&nbsp;Setujui</div><div class="top"><span class="t">' + esc(p.desc) + '</span><span class="a num ' + (p.amt < 0 ? 'out' : 'in') + '">' + (p.amt < 0 ? '−' : '+') + rp(Math.abs(p.amt)).replace('−', '') + '</span></div><div class="m">#' + p.id + ' · ' + posName(p.cat) + ' · diajukan ' + esc(p.by) + '</div><span class="waitpill">' + ic('clock', 'ic-sm') + 'Menunggu Wali Kelas</span>' +
        (isGuru() ? '<div class="acts"><button class="btn btn--ok btn--sm" data-act="approve" data-id="' + p.id + '" type="button">' + ic('check', 'ic-sm') + 'Setujui</button><button class="btn btn--tonal btn--sm hold" data-hold="reject" data-id="' + p.id + '" type="button">Tahan untuk tolak</button></div><div class="m">Geser kartu ke kanan untuk menyetujui.</div>' : '') +
        (isAdmin() ? '<div class="acts"><button class="btn btn--tonal btn--sm" data-act="cancel-pend" data-id="' + p.id + '" type="button">Batalkan pengajuan</button></div>' : '') + '</div>';
    }).join('');
    html += g.map(function (x) {
      return '<div class="prop wait" data-kind="week" data-w="' + x.w + '"><div class="top"><span class="t">Iuran minggu ' + x.w + '</span><span class="a num in">+Rp ' + fmt(x.n * NOMINAL) + '</span></div><div class="m">' + x.n + ' siswa menunggu diverifikasi sekaligus</div><span class="waitpill">' + ic('clock', 'ic-sm') + 'Menunggu Wali Kelas</span>' +
        (isGuru() ? '<div class="acts"><button class="btn btn--ok btn--sm" data-act="approve-week" data-w="' + x.w + '" type="button">' + ic('check', 'ic-sm') + 'Setujui semua minggu ' + x.w + '</button></div>' : '') + '</div>';
    }).join('');
    el.innerHTML = html;
    $$('[data-hold="reject"]', el).forEach(function (b) { holdable(b, 800, function () { act('reject', +b.dataset.id); }); });
    if (isGuru()) $$('.prop[data-kind="tx"]', el).forEach(bindSwipe);
  }
  function bindSwipe(card) {
    var x0 = 0, dx = 0, on = false, hint = $('.prop__hint', card);
    card.addEventListener('pointerdown', function (e) { if (e.target.closest('button') || e.button > 0) return; on = true; x0 = e.clientX; dx = 0; card.setPointerCapture(e.pointerId); card.style.transition = 'none'; });
    card.addEventListener('pointermove', function (e) { if (!on) return; dx = Math.max(0, e.clientX - x0); card.style.transform = 'translateX(' + dx + 'px)'; hint.style.opacity = Math.min(1, dx / 110); });
    function end() { if (!on) return; on = false; card.style.transition = ''; if (dx > 110) { fx.haptic('check'); act('approve', +card.dataset.pid); } else { card.style.transform = ''; hint.style.opacity = 0; } }
    card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  }

  /* ---------- aksi ---------- */
  function addTx(t) {
    var id = state.nextId++; var now = new Date();
    var tx = { id: id, date: new Date(state.now), day: todayLabel(), time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), desc: t.desc, cat: t.cat, amt: t.amt, w: state.activeWeek, by: t.by || 'Bendahara', ok: 'Wali Kelas (contoh)', isNew: true };
    state.tx.push(tx); rehash(); return tx;
  }
  function removeCard(sel, cb, cls) {
    var el = $(sel);
    if (!el || window.fx.reduce) return cb();
    el.classList.add(cls || 'is-gone'); setTimeout(cb, cls ? 520 : 380);
  }
  var busy = {};
  async function act(kind, id, w, btn) {
    var key = kind + ':' + (id || w); if (busy[key]) return; busy[key] = true;
    try {
      if (kind === 'approve') await approvePending(id, btn);
      else if (kind === 'reject') {
        var rc = $('.prop[data-pid="' + id + '"]'); fx.haptic('reject');
        if (rc) await fx.stamp(rc, 'Ditolak', true);
        removeCard('.prop[data-pid="' + id + '"]', function () { state.pending = state.pending.filter(function (x) { return x.id !== id; }); renderAll(); toast('Pengajuan #' + id + ' ditolak.'); }, 'is-rejected');
      } else if (kind === 'cancel-pend') {
        var gone = state.pending.filter(function (x) { return x.id === id; })[0];
        state.pending = state.pending.filter(function (x) { return x.id !== id; }); renderAll();
        toast('Pengajuan dibatalkan.', function () { state.pending.push(gone); renderAll(); });
      } else if (kind === 'cancel-prop') {
        var gp = state.proposals.filter(function (x) { return x.id === id; })[0];
        state.proposals = state.proposals.filter(function (x) { return x.id !== id; }); renderAll();
        toast('Usulan dibatalkan.', function () { state.proposals.push(gp); renderAll(); });
      } else if (kind === 'approve-week') await approveWeek(w, btn);
    } finally { delete busy[key]; }
  }
  async function approvePending(id, btn) {
    var p = state.pending.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var short = posSaldo(p.cat) + p.amt < 0;
    var msg = 'Gagal: saldo pos ' + posName(p.cat) + ' tidak cukup. Tidak ada yang dicatat.';
    if (btn) { var ok = await fx.commit(btn, function () { return !short; }, { keep: true }); if (!ok) { toast(msg); return; } }
    else if (short) { toast(msg); return; }
    fx.haptic('check');
    var card = $('.prop[data-pid="' + id + '"]');
    if (card) { var r = card.getBoundingClientRect(); fx.burst(r.left + r.width / 2, r.top + r.height / 2); await fx.stamp(card, 'Disahkan'); }
    var label = (p.amt < 0 ? '\u2212' : '+') + 'Rp ' + fmt(Math.abs(p.amt));
    fx.fly(card, label, $('#amountNum'), p.amt < 0).then(function () { fx.sheen($('#amount')); fx.glow($('.skyhead')); });
    removeCard('.prop[data-pid="' + id + '"]', function () {
      state.pending = state.pending.filter(function (x) { return x.id !== id; }); addTx(p); renderAll(true);
      toast('Disetujui. Saldo sekarang ' + rp(saldo()) + '.'); state.tx[state.tx.length - 1].isNew = false;
    });
  }
  async function approveWeek(w, btn) {
    var arr = state.dues[w], n = arr.filter(function (s) { return s === 'wait'; }).length; if (!n) return;
    if (btn) await fx.commit(btn, null, { keep: true });
    fx.haptic('check');
    if (+w === state.week) wave(w);
    var card = $('.prop[data-kind="week"][data-w="' + w + '"]');
    if (card) { var r = card.getBoundingClientRect(); fx.burst(r.left + r.width / 2, r.top + r.height / 2, 16); }
    await fx.wait(fx.reduce ? 0 : Math.min(900, 160 + n * 60));
    if (card) await fx.stamp(card, 'Disahkan');
    fx.fly(card, '+Rp ' + fmt(n * NOMINAL), $('#amountNum')).then(function () { fx.sheen($('#amount')); fx.glow($('.skyhead')); });
    removeCard('.prop[data-kind="week"][data-w="' + w + '"]', function () {
      state.dues[w] = arr.map(function (s) { return s === 'wait' ? 'paid' : s; });
      addTx({ desc: 'Iuran minggu ' + w + ' (' + n + ' siswa)', cat: 'op', amt: n * NOMINAL, by: 'Bendahara' });
      renderAll(true); toast(n + ' iuran minggu ' + w + ' disahkan. Saldo bertambah ' + rp(n * NOMINAL) + '.'); state.tx[state.tx.length - 1].isNew = false;
      if (counts(w).todo === 0) setTimeout(function () { fx.glow($('.skyhead')); fx.sheen($('#amount')); fx.haptic('check'); toast('Semua lunas untuk minggu ' + w + '. Keren, XI-F2.'); }, 1100);
    });
  }
  function wave(w) {
    $$('#duesCard .stu.wait').forEach(function (el, i) { setTimeout(function () { el.classList.add('wave'); }, i * 70); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    act(b.dataset.act, +b.dataset.id, +b.dataset.w, b);
  });

  /* ---------- iuran ---------- */
  var ini = function (n) { return n.slice(0, 2).toUpperCase(); };
  function counts(w) { var a = state.dues[w]; return { paid: a.filter(function (s) { return s === 'paid'; }).length, wait: a.filter(function (s) { return s === 'wait'; }).length, todo: a.filter(function (s) { return s === 'todo'; }).length }; }
  var CHK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var LOCK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  var FLAG_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4M6 5h11l-2 4 2 4H6"/></svg>';
  var CAL_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>';
  var COPY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
  var dirSel = 'r';

  function progressF() {
    var s0 = state.weeks[0].start.getTime(), s3 = state.weeks[3].start.getTime();
    return Math.max(0, Math.min(1, (state.now.getTime() - s0) / (s3 - s0)));
  }
  function monthPhase() { return state.now > state.weeks[3].end ? 'selesai' : state.now < state.weeks[0].start ? 'belum' : 'jalan'; }
  function cdParts(w) {
    var st = weekStatus(w), c = counts(w.n), n = state.now, ms, mode;
    if (st === 'akan') { ms = w.start - n; mode = 'open'; }
    else if (st === 'selesai') { ms = n - w.due; mode = c.todo ? 'late' : 'done'; }
    else if (n <= w.due) { ms = w.due - n; mode = 'due'; }
    else { ms = n - w.due; mode = c.todo ? 'late' : 'done'; }
    ms = Math.max(0, ms);
    return { mode: mode, d: Math.floor(ms / DAY_MS), h: Math.floor((ms % DAY_MS) / HOUR_MS), m: Math.floor((ms % HOUR_MS) / MIN_MS), todo: c.todo };
  }
  var CD_LABEL = { open: 'Dibuka dalam', due: 'Batas bayar tinggal', late: 'Sudah lewat batas', done: 'Semua teman sudah lunas' };
  function weekProgress(w) { var n = state.now.getTime(), s = w.start.getTime(), e = w.end.getTime(); return Math.max(0, Math.min(1, (n - s) / (e - s))); }
  function tilesHtml(p) {
    if (p.mode === 'done') return '<div class="cdt cdt--done"><span class="cdt__seal">' + CHK_ICON + '</span><b>Lunas semua</b></div>';
    return '<div class="cdt cdt--' + p.mode + '"><div class="cdt__u"><b data-u="d" data-v="' + pad2(p.d) + '">' + pad2(p.d) + '</b><small>hari</small></div><i>:</i><div class="cdt__u"><b data-u="h" data-v="' + pad2(p.h) + '">' + pad2(p.h) + '</b><small>jam</small></div><i>:</i><div class="cdt__u"><b data-u="m" data-v="' + pad2(p.m) + '">' + pad2(p.m) + '</b><small>menit</small></div></div>';
  }
  function setTile(el, val) {
    var s = pad2(val), old = el.dataset.v; if (old === s) return; el.dataset.v = s;
    if (fx.reduce) { el.textContent = s; return; }
    el.innerHTML = '<span class="o">' + old + '</span><span class="n">' + s + '</span>'; el.classList.remove('roll'); void el.offsetWidth; el.classList.add('roll');
    setTimeout(function () { if (el.dataset.v === s) { el.textContent = s; el.classList.remove('roll'); } }, 560);
  }
  function renderWeeks(animate) {
    var ws = state.weeks, sel = ws[state.week - 1], f = progressF(), n = state.now, mp = monthPhase();
    var cols = ws.map(function (w) {
      var st = weekStatus(w), c = counts(w.n), pct = st === 'akan' ? 0 : Math.round(c.paid / TOTAL * 100);
      var chip = { selesai: '<span class="swk__chip ok">Selesai</span>', berjalan: '<span class="swk__chip now"><i></i>Minggu ini</span>', akan: '<span class="swk__chip">Segera</span>' }[st];
      return '<button class="swk ' + st + (w.n === state.week ? ' on' : '') + '" type="button" role="tab" aria-selected="' + (w.n === state.week) + '" data-w="' + w.n + '" style="--k:' + w.n + '"><span class="swk__n">' + (st === 'selesai' && !c.todo ? CHK_ICON : st === 'akan' ? LOCK_ICON : w.n) + '</span><b>Minggu ' + w.n + '</b><span class="swk__r">' + rangeLabel(w) + '</span>' + chip + '<span class="swk__bar"><i style="--p:' + (animate ? 0 : pct) + '" data-p="' + pct + '"></i></span><small>' + (st === 'akan' ? 'Belum dibuka' : c.paid + '/' + TOTAL + ' lunas') + '</small></button>';
    }).join('');
    var days = '';
    for (var k = 0; k < 7; k++) {
      var d = new Date(sel.start.getFullYear(), sel.start.getMonth(), sel.start.getDate() + k), isToday = d.toDateString() === n.toDateString(), isDue = k === 4, past = d < new Date(n.getFullYear(), n.getMonth(), n.getDate());
      days += '<span class="dp' + (isToday ? ' today' : '') + (isDue ? ' due' : '') + (past ? ' past' : '') + '" style="--k:' + k + '"><small>' + DS[d.getDay()] + '</small><b>' + d.getDate() + '</b><i aria-hidden="true">' + (isDue ? FLAG_ICON : '') + '</i></span>';
    }
    var p = cdParts(sel), wp = weekProgress(sel);
    var rows = ws.map(function (w) {
      var st = weekStatus(w), c = counts(w.n);
      return '<button class="sall__r' + (w.n === state.week ? ' on' : '') + '" type="button" data-w="' + w.n + '"><span class="sall__n">' + w.n + '</span><span class="sall__t"><b>Minggu ' + w.n + ' \u00b7 ' + rangeLabel(w) + '</b><small>Batas ' + dayLabel(w.due) + ' \u00b7 ' + clock(w.due) + '</small></span><span class="sall__s ' + st + '">' + { selesai: 'Selesai', berjalan: 'Minggu ini', akan: 'Segera' }[st] + '</span><span class="sall__p">' + (st === 'akan' ? '\u2013' : c.paid + '/' + TOTAL) + '</span></button>';
    }).join('');
    var alertHtml = '';
    if (sel.n === state.activeWeek && weekStatus(sel) === 'berjalan' && n.toDateString() === sel.due.toDateString() && counts(sel.n).todo > 0) {
      var passed = n > sel.due, cc = counts(sel.n);
      alertHtml = '<div class="sched__alert' + (passed ? ' late' : '') + '" role="status"><svg viewBox="0 0 26 18" aria-hidden="true"><use href="#i-cloud"/></svg><div><b>' + (passed ? 'Batas bayar hari ini sudah lewat' : 'Hari ini batas bayar') + '</b><span>pukul ' + clock(sel.due) + ' \u00b7 ' + cc.todo + ' teman belum bayar</span></div></div>';
    }
    var ended = mp === 'selesai' ? '<span class="sched__ended">Bulan ini selesai</span>' : mp === 'belum' ? '<span class="sched__ended">Bulan ini belum mulai</span>' : '';
    $('#sched').innerHTML =
      '<div class="sched__head"><div><p class="sched__k">Jadwal iuran</p><h3 class="sched__m">' + MONF[sel.start.getMonth()] + ' ' + sel.start.getFullYear() + '</h3></div><div class="sched__side"><div class="sched__now"><i></i><span id="schedClock">' + dayLabel(n) + ' \u00b7 ' + clock(n) + '</span></div>' + ended + '</div></div>' +
      '<div class="sched__tools"><button class="btn btn--tonal btn--sm" type="button" id="schedIcs">' + CAL_ICON + 'Tambah ke kalender</button><button class="btn btn--tonal btn--sm" type="button" id="schedCopy">' + COPY_ICON + '<span>Salin jadwal</span></button></div>' +
      '<div class="sched__lane" aria-hidden="true"><span class="sched__pin' + (mp === 'jalan' ? '' : ' is-off') + '" id="schedPin" style="--f:' + (animate ? 0 : f) + '" data-f="' + f + '"><b>Hari ini</b><i></i></span></div>' +
      '<div class="sched__cols" id="weeks" role="tablist" aria-label="Pilih minggu"><div class="sched__line" aria-hidden="true"><i class="sched__fill" id="schedFill" style="--f:' + (animate ? 0 : f) + '" data-f="' + f + '"></i></div>' + cols + '</div>' + alertHtml +
      '<div class="sched__detail dir-' + dirSel + (animate ? ' is-swap' : '') + '"><div class="sd__l"><p class="sd__k">Batas bayar \u00b7 Minggu ' + sel.n + '</p><p class="sd__due"><span class="sd__ic">' + CAL_ICON + '</span>' + dayLabel(sel.due) + ' \u00b7 ' + clock(sel.due) + '</p><p class="sd__lbl" id="sdLbl">' + CD_LABEL[p.mode] + (p.mode === 'late' ? ' \u00b7 ' + p.todo + ' belum bayar' : '') + '</p>' + tilesHtml(p) + '<div class="sd__bar" title="Waktu berjalan di minggu ini"><i style="--p:' + (animate ? 0 : wp) + '" data-p="' + wp + '"></i></div><small class="sd__barl">' + Math.round(wp * 100) + '% waktu minggu ini sudah berjalan</small></div><div class="sd__days" aria-label="Hari dalam minggu ' + sel.n + '">' + days + '</div></div>' +
      '<details class="sched__all"><summary>Semua jadwal bulan ini</summary><div class="sall">' + rows + '</div></details>';
    if (animate) requestAnimationFrame(function () { requestAnimationFrame(function () {
      $$('#sched [data-p]').forEach(function (el) { el.style.setProperty('--p', el.dataset.p); });
      $$('#sched [data-f]').forEach(function (el) { el.style.setProperty('--f', el.dataset.f); });
    }); });
  }
  function tickSched() {
    var c = $('#schedClock'); if (!c) return; if (!state.dateMode) state.now = new Date();
    c.textContent = dayLabel(state.now) + ' \u00b7 ' + clock(state.now);
    var sel = state.weeks[state.week - 1], p = cdParts(sel);
    var lbl = $('#sdLbl'); if (lbl) lbl.textContent = CD_LABEL[p.mode] + (p.mode === 'late' ? ' \u00b7 ' + p.todo + ' belum bayar' : '');
    ['d', 'h', 'm'].forEach(function (u) { var el = $('#sched [data-u="' + u + '"]'); if (el) setTile(el, p[u]); });
    var f = progressF(); $('#schedFill').style.setProperty('--f', f); $('#schedPin').style.setProperty('--f', f);
  }
  function icsEscape(s) { return String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'); }
  function icsStamp(d) { return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + pad2(d.getMinutes()) + '00'; }
  function buildIcs() {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CEKAS//Jadwal Iuran//ID', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Iuran Kas XI-F2'];
    state.weeks.forEach(function (w) {
      var end = new Date(w.due.getTime() + 30 * MIN_MS);
      L.push('BEGIN:VEVENT', 'UID:cekas-' + icsStamp(w.due) + '-m' + w.n + '@cekas.example', 'DTSTAMP:' + icsStamp(new Date()), 'DTSTART:' + icsStamp(w.due), 'DTEND:' + icsStamp(end),
        'SUMMARY:' + icsEscape('Batas iuran kas XI-F2 \u00b7 Minggu ' + w.n), 'DESCRIPTION:' + icsEscape('Iuran Rp ' + fmt(NOMINAL) + ' per siswa untuk minggu ' + w.n + ' (' + rangeLabel(w) + '). Bayar ke Bendahara sebelum batas.'),
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Besok batas iuran kas', 'TRIGGER:-P1D', 'END:VALARM', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Dua jam lagi batas iuran kas', 'TRIGGER:-PT2H', 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR'); return L.join('\r\n');
  }
  function scheduleText() {
    return 'Jadwal iuran kas XI-F2 \u00b7 ' + MONF[state.weeks[0].start.getMonth()] + ' ' + state.weeks[0].start.getFullYear() + '\n' + state.weeks.map(function (w) { return 'Minggu ' + w.n + ' (' + rangeLabel(w) + '): batas ' + dayLabel(w.due) + ' pukul ' + clock(w.due); }).join('\n') + '\nIuran Rp ' + fmt(NOMINAL) + ' per siswa.';
  }
  document.addEventListener('click', function (e) {
    var ics = e.target.closest('#schedIcs'), cp = e.target.closest('#schedCopy'), row = e.target.closest('.sall__r');
    if (ics) {
      var blob = new Blob([buildIcs()], { type: 'text/calendar;charset=utf-8' }), url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'jadwal-iuran-' + state.weeks[0].start.getFullYear() + '-' + pad2(state.weeks[0].start.getMonth() + 1) + '.ics'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      fx.burst(ics.getBoundingClientRect().left + 30, ics.getBoundingClientRect().top + 18, 8); toast('4 pengingat batas bayar diunduh. Buka file .ics untuk menambahkannya ke kalender.');
    } else if (cp) {
      copy(scheduleText()); var sp = $('span', cp), old = sp.textContent; sp.textContent = 'Tersalin'; setTimeout(function () { if (sp) sp.textContent = old; }, 1600); toast('Jadwal iuran disalin.');
    } else if (row) {
      var w = +row.dataset.w; if (w !== state.week) { dirSel = w > state.week ? 'r' : 'l'; state.week = w; renderWeeks(true); renderDues(true); renderTips(); }
      var d = $('.sched__detail'); if (d) d.scrollIntoView({ behavior: fx.reduce ? 'auto' : 'smooth', block: 'center' });
    }
  });
  function chip(i, s, as) {
    var inner = '<span class="av" data-t="' + (i % 4) + '">' + ini(NAMES[i]) + '</span><span>' + NAMES[i] + '</span>' + (s === 'paid' ? ic('check', 'st') : s === 'wait' ? ic('clock', 'st') : '');
    return as === 'button' ? '<button class="stu todo" type="button" data-i="' + i + '" style="--k:' + i + '" aria-label="Tandai ' + NAMES[i] + ' lunas minggu ' + state.week + '">' + inner + ic('plus', 'st') + '</button>' : '<span class="stu ' + s + '" data-i="' + i + '" style="--k:' + i + '">' + inner + '</span>';
  }
  var lastPct = 0;
  function renderDues(animate) {
    var w = state.weeks[state.week - 1], st = weekStatus(w), a = state.dues[state.week], c = counts(state.week), pct = Math.round(c.paid / TOTAL * 100), card = $('#duesCard'), html = '';
    if (st === 'akan') {
      card.className = 'card is-locked';
      card.innerHTML = '<div class="locked"><span class="locked__ic">' + LOCK_ICON + '</span><div><b>Minggu ' + w.n + ' dibuka ' + dayLabel(w.start) + '</b><p>Iuran Rp ' + fmt(NOMINAL) + ' per siswa bisa dibayar mulai ' + clock(w.start) + ' hari itu, dengan batas ' + dayLabel(w.due) + ' pukul ' + clock(w.due) + '.</p></div></div>';
      lastPct = 0; return;
    }
    card.className = 'card' + (animate ? ' is-swap dir-' + dirSel : '');
    var tag = st === 'berjalan' ? ' \u00b7 minggu ini' : ' \u00b7 selesai';
    html += '<div class="dues-top"><div class="ring" id="ring" style="--p:' + (animate ? lastPct : pct) + '" role="img" aria-label="' + pct + ' persen lunas"><b>' + pct + '%</b></div><div><div class="t">Minggu ke-' + w.n + ' \u00b7 ' + rangeLabel(w) + tag + '</div><p>' + c.paid + ' dari ' + TOTAL + ' teman sudah bayar.' + (c.todo ? ' Tinggal ' + c.todo + ' lagi.' : '') + '</p></div></div>';
    if (!c.todo && !c.wait) html += '<div class="done">Semua sudah lunas<small>Terima kasih ya, XI-F2.</small></div>';
    if (c.todo) { html += '<div class="sub-h"><span>Belum bayar</span>' + (isAdmin() ? '<span class="note">ketuk nama untuk menandai</span>' : '') + '</div><div class="who">'; a.forEach(function (s, i) { if (s === 'todo') html += isAdmin() ? chip(i, s, 'button') : '<span class="stu todo" style="--k:' + i + '"><span class="av" data-t="' + (i % 4) + '">' + ini(NAMES[i]) + '</span><span>' + NAMES[i] + '</span></span>'; }); html += '</div>'; }
    if (c.wait) { html += '<div class="sub-h"><span>Menunggu Wali Kelas</span></div><div class="who">'; a.forEach(function (s, i) { if (s === 'wait') html += chip(i, s); }); html += '</div>'; }
    if (c.paid) { html += '<div class="sub-h"><span>Sudah lunas</span><button class="dues-more" type="button" aria-expanded="' + (card.classList.contains('show-paid') ? 'true' : 'false') + '">' + (card.classList.contains('show-paid') ? 'Sembunyikan' : 'Tampilkan ' + c.paid) + '</button></div><div class="who who--paid">'; a.forEach(function (s, i) { if (s === 'paid') html += chip(i, s); }); html += '</div>'; }
    var keep = card.classList.contains('show-paid'); card.innerHTML = html; if (keep) card.classList.add('show-paid'); lastPct = pct;
    if (animate) requestAnimationFrame(function () { var r = $('#ring'); if (r) r.style.setProperty('--p', pct); });
  }
  $('#sched').addEventListener('click', function (e) { var b = e.target.closest('.swk'); if (!b) return; var w = +b.dataset.w; if (w === state.week) return; dirSel = w > state.week ? 'r' : 'l'; state.week = w; renderWeeks(true); renderDues(true); renderTips(); fx.buzz(8); });
  $('#duesCard').addEventListener('click', function (e) {
    var more = e.target.closest('.dues-more'); if (more) { var on = !$('#duesCard').classList.contains('show-paid'); $('#duesCard').classList.toggle('show-paid', on); more.setAttribute('aria-expanded', on); more.textContent = on ? 'Sembunyikan' : 'Tampilkan ' + counts(state.week).paid; return; }
    var b = e.target.closest('button.stu'); if (!b) return;
    var i = +b.dataset.i, w = state.week; var from = b.getBoundingClientRect(); state.dues[w][i] = 'wait'; fx.buzz(10); renderAll(); var el = $('#duesCard .stu.wait[data-i="' + i + '"]'); if (el) el.classList.add('just'); fx.burst(from.left + from.width / 2, from.top + from.height / 2, 8);
    toast(NAMES[i] + ' ditandai lunas. Menunggu Wali Kelas.', function () { state.dues[w][i] = 'todo'; renderAll(); });
  });

  /* ---------- riwayat ---------- */
  function renderHistory() {
    var list = state.tx.slice().reverse().slice(0, 12), day = '', html = '';
    $('#txCount').textContent = list.length + ' terakhir';
    list.forEach(function (t, ti) {
      if (t.day !== day) { if (day) html += '</div>'; html += '<div class="day' + (ti >= 6 ? ' day--extra' : '') + '">' + t.day + '</div><div class="txlist">'; day = t.day; }
      var inn = t.amt > 0;
      html += '<button class="tx ' + (t.isNew ? 'is-new' : '') + (ti >= 6 ? ' tx--extra' : '') + '" type="button" data-id="' + t.id + '"><span class="ico ' + (inn ? '' : 'out') + '">' + ic(inn ? 'in' : 'out') + '</span><span><span class="ds">' + esc(t.desc) + '</span><span class="mt" style="display:block">' + posName(t.cat) + ' · ' + esc(t.by) + ' · ' + t.time + '<span class="vf">' + ic('check', 'ic-sm') + '</span></span></span><span class="am num ' + (inn ? 'in' : 'out') + '">' + (inn ? '+' : '−') + 'Rp ' + fmt(Math.abs(t.amt)) + '<small>#' + t.id + '</small></span></button>';
    });
    if (day) html += '</div>';
    $('#history').innerHTML = html + (list.length > 6 ? '<button class="btn btn--tonal btn--sm hist-more" type="button" id="histMore">Lihat semua ' + list.length + ' catatan</button>' : '');
  }
  function skeleton(ms) {
    if (reduce) return Promise.resolve();
    var els = ['#posGrid', '#history', '#sched', '#duesCard', '#queue'].map(function (s) { return $(s); }).filter(Boolean);
    els.forEach(function (e) { e.classList.add('is-skel'); });
    return fx.wait(ms || 700).then(function () { els.forEach(function (e) { e.classList.remove('is-skel'); }); });
  }
  var detailDlg = $('#detailDialog'), curHash = '';
  $('#history').addEventListener('click', function (e) {
    var hm = e.target.closest('#histMore'); if (hm) { $('#history').classList.toggle('show-all'); hm.textContent = $('#history').classList.contains('show-all') ? 'Tampilkan lebih sedikit' : 'Lihat semua ' + $$('#history .tx').length + ' catatan'; return; }
    var b = e.target.closest('.tx'); if (!b) return;
    var t = state.tx.filter(function (x) { return x.id === +b.dataset.id; })[0]; if (!t) return; curHash = t.hash;
    $('#dBody').innerHTML = '<div><dt>Keterangan</dt><dd>' + esc(t.desc) + '</dd></div><div><dt>Jumlah</dt><dd class="num">' + (t.amt < 0 ? '−' : '+') + 'Rp ' + fmt(Math.abs(t.amt)) + '</dd></div><div><dt>Pos</dt><dd>' + posName(t.cat) + '</dd></div><div><dt>Dicatat oleh</dt><dd>' + esc(t.by) + ' · ' + t.day + ', ' + t.time + '</dd></div><div><dt>Disahkan oleh</dt><dd>' + esc(t.ok) + '</dd></div><div><dt>Sidik jari (hash)</dt><dd class="mono">' + t.hash + '</dd></div><div class="linkchain">terkunci ke catatan sebelumnya</div><div><dt>Hash sebelumnya</dt><dd class="mono">' + t.prev + '</dd></div>';
    detailDlg.showModal();
  });
  $('#dCopy').addEventListener('click', function () { copy(curHash); toast('Hash disalin.'); });

  /* ---------- bagikan ---------- */
  function waText() { var w = state.weeks[state.activeWeek - 1]; return 'Kas XI-F2 \u00b7 minggu ' + w.n + ' (' + rangeLabel(w) + ')\nSaldo ' + rp(saldo()) + ' \u2714\nIuran: ' + counts(w.n).paid + '/' + TOTAL + ' lunas, batas ' + dayLabel(w.due) + ' ' + clock(w.due) + '\nCek: kas.xi-f2.example (contoh)'; }
  function remText() { var w = state.weeks[state.activeWeek - 1], c = counts(w.n); return 'Halo teman-teman, ada ' + c.todo + ' orang yang belum bayar iuran minggu ' + w.n + ' (Rp 10.000), batas ' + dayLabel(w.due) + ' pukul ' + clock(w.due) + '. Terima kasih ya. Kalau sudah, kabari Bendahara.'; }
  function copy(text) { try { if (navigator.clipboard) return navigator.clipboard.writeText(text); } catch (e) {} var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); }
  function flash(btn, label) { var s = $('span', btn), old = s.textContent; s.textContent = label; btn.querySelector('use').setAttribute('href', '#i-check'); setTimeout(function () { s.textContent = old; btn.querySelector('use').setAttribute('href', btn.id === 'copyWa' ? '#i-copy' : '#i-bell'); }, 1600); }
  $('#copyWa').addEventListener('click', function () { var tx = waText(); copy(tx); flash(this, 'Tersalin'); var p = $('#waPreview'); p.hidden = false; p.innerHTML = tx.split('\n').map(function (l) { return '<span>' + esc(l) + '</span>'; }).join(''); });
  $('#copyRem').addEventListener('click', function () { copy(remText()); flash(this, 'Tersalin'); });
  $$('[data-soon]').forEach(function (b) { b.addEventListener('click', function () { toast(b.dataset.soon + ' dibuat di versi server. Ini prototipe desain.'); }); });

  /* ---------- catat ---------- */
  var dlg = $('#txDialog'), form = $('#txForm'), nom = $('#f-nominal'), desc = $('#f-desc'), err = $('#txErr');
  function renderPosChips() {
    $('#posChips').innerHTML = POS.map(function (p, i) { return '<label><input type="radio" name="cat" value="' + p.k + '" ' + (i === 0 ? 'checked' : '') + '>' + p.name + '</label>'; }).join('');
  }
  function curType() { return form.elements.type.value; }
  function amtVal() { return parseInt((nom.value || '').replace(/\D/g, ''), 10) || 0; }
  function syncForm() {
    var out = curType() === 'out', v = amtVal();
    $('#txTitle').textContent = out ? 'Catat uang keluar' : 'Catat uang masuk'; $('.lbl', form).textContent = out ? 'Dari pos mana?' : 'Masuk ke pos mana?';
    $('#txHint').textContent = out && v >= APPROVAL_MIN ? 'Belanja ≥ Rp 50.000 jadi usulan: butuh 3 teman setuju dulu, baru ke Wali Kelas.' : 'Catatan menunggu persetujuan Wali Kelas dulu.';
    $('#txSubmit').textContent = out && v >= APPROVAL_MIN ? 'Ajukan usulan' : 'Ajukan';
  }
  nom.addEventListener('input', function () { var v = amtVal(); nom.value = v ? fmt(v) : ''; err.textContent = ''; syncForm(); });
  form.addEventListener('change', function () { err.textContent = ''; syncForm(); });
  $('#quick').addEventListener('click', function (e) { var b = e.target.closest('[data-add]'); if (!b) return; nom.value = fmt(amtVal() + +b.dataset.add); syncForm(); });
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var v = amtVal(), out = curType() === 'out', cat = form.elements.cat.value, d = desc.value.trim();
    var fail = function (msg, el) { err.textContent = msg; fx.shake($('.sheet', dlg)); if (el) el.focus(); };
    if (!v) return fail('Isi nominalnya dulu.', nom);
    if (!d) return fail('Tulis buat apa uang ini.', desc);
    if (out && posSaldo(cat) - v < 0) return fail('Saldo pos ' + posName(cat) + ' tidak cukup (tersisa ' + rp(posSaldo(cat)) + ').');
    var amt = out ? -v : v, asProposal = out && v >= APPROVAL_MIN, item;
    await fx.commit($('#txSubmit'), null, { loading: 480 });
    fx.closeSheet(dlg); await fx.wait(fx.reduce ? 0 : 280);
    if (asProposal) { item = { id: state.nextPid++, desc: d, cat: cat, amt: amt, by: 'Bendahara', yes: 0, needed: 3 }; state.proposals.push(item); }
    else { item = { id: state.nextPid++, desc: d, cat: cat, amt: amt, by: 'Bendahara' }; state.pending.push(item); }
    state.flash = item.id; renderAll(); state.flash = null;
    var card = $('.prop--new');
    if (card) { card.scrollIntoView({ behavior: fx.reduce ? 'auto' : 'smooth', block: 'center' }); setTimeout(function () { var r2 = card.getBoundingClientRect(); fx.burst(r2.left + 40, r2.top + 30, 9); }, 420); }
    toast(asProposal ? 'Jadi usulan. Menunggu 3 teman setuju.' : 'Diajukan ke Wali Kelas. Saldo belum berubah.', function () {
      state.proposals = state.proposals.filter(function (x) { return x !== item; }); state.pending = state.pending.filter(function (x) { return x !== item; }); renderAll();
    });
  });
  $('#fab').addEventListener('click', function () { form.reset(); nom.value = ''; err.textContent = ''; syncForm(); dlg.showModal(); setTimeout(function () { nom.focus(); }, 60); });
  [dlg, detailDlg].forEach(function (d) { d.addEventListener('click', function (e) { if (e.target === d) fx.closeSheet(d); }); d.addEventListener('cancel', function (e) { e.preventDefault(); fx.closeSheet(d); }); $$('[data-close]', d).forEach(function (b) { b.addEventListener('click', function () { fx.closeSheet(d); }); }); });

  /* ---------- peran dan demo ---------- */
  function applyRole() {
    var r = state.role; document.body.dataset.role = r;
    var rl = $('#roleLabel'); $('span', rl).textContent = { siswa: 'Masuk', bendahara: 'Bendahara', guru: 'Wali Kelas' }[r];
    rl.setAttribute('href', r === 'siswa' ? 'login.html' : '#'); rl.title = r === 'siswa' ? 'Masuk sebagai Bendahara atau Wali Kelas' : 'Ketuk untuk keluar';
    $('#fab').hidden = r !== 'bendahara';
    $$('#demoRole button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === r); });
    renderAll();
  }
  $('#roleLabel').addEventListener('click', function (e) {
    if (state.role === 'siswa') return; e.preventDefault(); leaveScene(state.role);
  });
  var leaving = false;
  async function leaveScene(was) {
    if (leaving) return; leaving = true;
    var name = { bendahara: 'Bendahara', guru: 'Wali Kelas' }[was] || '';
    var go = function () { try { sessionStorage.removeItem('cekas-role'); sessionStorage.setItem('cekas-scene', 'keluar'); } catch (x) {} location.href = 'login.html'; };
    if (fx.reduce) return go();
    var ease = 'cubic-bezier(.2,.7,.1,1)';
    document.body.classList.add('leaving'); toastEl.classList.remove('is-on');
    var v = fx.veil('night', { msg: { title: 'Sampai jumpa', sub: 'Keluar dari sesi ' + name } }), msg = $('.veil__msg', v);
    v.classList.add('veil--curtain'); msg.style.opacity = 0;
    var cur = v.animate([{ maskPosition: '0 100%', webkitMaskPosition: '0 100%' }, { maskPosition: '0 0%', webkitMaskPosition: '0 0%' }], { duration: 1300, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
    cur.finished.then(function () { v.classList.remove('veil--curtain'); });
    await fx.wait(1150);
    msg.animate([{ opacity: 0, transform: 'translateY(-44%)' }, { opacity: 1, transform: 'translateY(-50%)' }], { duration: 850, fill: 'forwards', easing: ease });
    await fx.wait(1750);
    msg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' }); await fx.wait(500); go();
  }
  $('#demoRole').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { state.role = b.dataset.v; applyRole(); } });
  $('#demoDate').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; var k = +b.dataset.d; state.dateMode = k;
    var ref = new Date(); if (k === 9) { var w9 = mkWeeks(ref), c9 = 1; w9.forEach(function (w) { if (ref >= w.start) c9 = w.n; }); var s9 = w9[c9 - 1].start; state.now = new Date(s9.getFullYear(), s9.getMonth(), s9.getDate() + 4, 10, 30); }
    else if (k) { var ws = mkWeeks(ref); state.now = new Date(ws[k - 1].start.getFullYear(), ws[k - 1].start.getMonth(), ws[k - 1].start.getDate() + 2, 10, 30); } else state.now = new Date();
    $$('#demoDate button').forEach(function (x) { x.classList.toggle('on', x === b); });
    skeleton(600).then(function () { seed(); renderAll(true); renderWeeks(true); renderDues(true); toast(k ? 'Tanggal contoh: ' + dayLabel(state.now) : 'Memakai tanggal hari ini.'); });
  });
  $('#demoWx').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; state.wx = b.dataset.v; $$('#demoWx button').forEach(function (x) { x.classList.toggle('on', x === b); }); applyWeather(); });

  /* ---------- render semua ---------- */
  function renderAll(animateHero) {
    renderHero(!!animateHero); renderPos(); renderTips(); renderProposals(); renderQueue(); renderWeeks(); renderDues(false); renderHistory();
    if (animateHero) verify();
  }

  /* ---------- scroll: spy, parallax, reveal ---------- */
  var secs = ['ringkasan', 'iuran', 'riwayat', 'bagikan'].map(function (id) { return document.getElementById(id); });
  var navLinks = $$('.bottomnav a'), pill = $('#pillx'), topLinks = $$('.nav__links a'), head = $('.skyhead'), clouds = $$('.sky__cloud'), tick = false;
  function onScroll() {
    tick = false; var y = window.scrollY, idx = 0;
    secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top < window.innerHeight * 0.45) idx = i; });
    if (!document.body.dataset.screen) { navLinks.forEach(function (a, i) { a.classList.toggle('on', i === idx); }); pill.style.transform = 'translateX(' + idx * 100 + '%)'; }
    topLinks.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + secs[idx].id || (idx === 0 && a.getAttribute('href') === '#ringkasan')); });
    if (!reduce && y < head.offsetHeight + 100) clouds.forEach(function (c) { c.style.transform = 'translate3d(0,' + (y * parseFloat(c.dataset.depth || .3) * 0.45).toFixed(1) + 'px,0)'; });
  }
  window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(onScroll); } }, { passive: true });
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach(function (el) { io.observe(el); });
  } else { $$('.reveal').forEach(function (el) { el.classList.add('is-in'); }); }

  /* ---------- scene tiba (setelah masuk) ---------- */
  var arriving = document.documentElement.classList.contains('scene-masuk');
  if (arriving) {
    var dv = fx.veil('day'); document.documentElement.classList.remove('scene-masuk'); document.body.classList.add('arriving');
    dv.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1500, delay: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).finished.then(function () { dv.remove(); setTimeout(function () { document.body.classList.remove('arriving'); }, 1800); });
  }

  /* ---------- tarik untuk memuat: awan terbelah ---------- */
  (function ptr() {
    if (!('ontouchstart' in window) || reduce) return;
    var el = document.createElement('div'); el.className = 'ptr'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<svg class="ptr__c ptr__c--l" viewBox="0 0 26 18"><use href="#i-cloud"/></svg><span class="ptr__sun"></span><svg class="ptr__c ptr__c--r" viewBox="0 0 26 18"><use href="#i-cloud"/></svg>';
    document.body.appendChild(el); document.documentElement.classList.add('kas-page');
    var y0 = 0, pull = 0, on = false, busy = false;
    document.addEventListener('touchstart', function (e) { if (window.scrollY <= 0 && !busy && e.touches.length === 1) { y0 = e.touches[0].clientY; on = true; pull = 0; } }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!on) return; var dy = e.touches[0].clientY - y0;
      if (dy <= 0 || window.scrollY > 0) { el.classList.remove('on'); pull = 0; return; }
      pull = Math.min(1, dy / 130); el.style.setProperty('--pull', pull.toFixed(3)); el.classList.add('on');
    }, { passive: true });
    document.addEventListener('touchend', async function () {
      if (!on) return; on = false;
      if (pull >= 0.55 && !busy) {
        busy = true; el.classList.add('is-busy'); fx.haptic('tick'); await skeleton(900); renderAll(true); renderWeeks(true); renderDues(true);
        el.classList.remove('is-busy'); el.classList.remove('on'); busy = false; toast('Diperbarui \u00b7 ' + clock(new Date()));
      } else el.classList.remove('on');
      el.style.setProperty('--pull', 0);
    });
  })();

  /* ---------- mulai ---------- */
  renderPosChips(); syncForm(); applyRole(); onScroll(); setInterval(tickSched, 30000);
  if ('IntersectionObserver' in window) { var so = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { so.disconnect(); renderWeeks(true); renderDues(true); } }, { threshold: 0.25 }); so.observe($('#sched')); }
  setAmount(0, false); setAmount(saldo(), true);
  verify();
  if (hasGsap && !reduce) {
    gsap.from('.hero > *', { y: 18, opacity: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out', clearProps: 'all', delay: arriving ? 1.0 : 0 });
    var line = $('#sparkLine'); if (line.getTotalLength) { var L = line.getTotalLength(); gsap.fromTo(line, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', delay: 0.3, onComplete: function () { line.style.strokeDasharray = 'none'; } }); }
  }
})();
