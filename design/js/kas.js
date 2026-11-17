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
  var buzz = function (ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
  var hasGsap = typeof window.gsap !== 'undefined';

  /* ---------- data fiktif ---------- */
  var POS = [
    { k: 'op', name: 'Operasional' }, { k: 'so', name: 'Sosial' }, { k: 'ev', name: 'Event' }, { k: 'ca', name: 'Cadangan' }
  ];
  var POSNOTE = { op: 'Spidol, fotokopi, kebersihan', so: 'Jenguk dan sumbangan', ev: 'Lomba dan acara kelas', ca: 'Dana darurat' };
  var posName = function (k) { return POS.filter(function (p) { return p.k === k; })[0].name; };
  var AVG_SPEND = 105000, NOMINAL = 10000, TODAY = 'Selasa, 17 Nov', APPROVAL_MIN = 50000;
  var NAMES = ['Aditya', 'Bella', 'Citra', 'Dimas', 'Eka', 'Farhan', 'Gita', 'Hana', 'Indra', 'Jihan', 'Kevin', 'Laila', 'Mario', 'Nadia', 'Okta', 'Putri', 'Qori', 'Rafi', 'Salsa', 'Tegar', 'Umar', 'Vina', 'Wulan', 'Yusuf', 'Zahra', 'Alya', 'Bima', 'Cakra', 'Dwi', 'Elsa', 'Fikri', 'Galih', 'Hafiz', 'Ilham'];
  var TOTAL = NAMES.length;

  var state = {
    role: 'siswa', wx: 'auto', week: 12, activeWeek: 12, hidden: false,
    nextId: 1, nextPid: 41,
    tx: [], pending: [], proposals: [{ id: 7, desc: 'Fotokopi modul 12 minggu', cat: 'op', amt: -85000, by: 'Bendahara', yes: 2, needed: 3 }],
    dues: {}
  };
  (function seed() {
    var rows = [
      ['Jumat, 31 Okt', '07:10', 'Saldo awal kas', 'ca', 400000, 8], ['Jumat, 31 Okt', '07:12', 'Iuran sosial semester', 'so', 390000, 8],
      ['Jumat, 31 Okt', '15:40', 'Iuran minggu 9 (34 siswa)', 'op', 340000, 9],
      ['Senin, 3 Nov', '09:05', 'Beli spidol dan penghapus', 'op', -45000, 10],
      ['Jumat, 7 Nov', '15:30', 'Iuran minggu 10 (34 siswa)', 'op', 340000, 10], ['Jumat, 7 Nov', '16:02', 'Pemasukan lomba kebersihan', 'ev', 300000, 10],
      ['Senin, 10 Nov', '10:20', 'Konsumsi lomba kebersihan', 'ev', -120000, 11],
      ['Rabu, 12 Nov', '13:15', 'Sumbangan jenguk teman sakit', 'so', -150000, 11],
      ['Jumat, 14 Nov', '15:35', 'Iuran minggu 11 (33 siswa)', 'op', 330000, 11]
    ];
    rows.forEach(function (r) { state.tx.push({ id: state.nextId++, day: r[0], time: r[1], desc: r[2], cat: r[3], amt: r[4], w: r[5], by: 'Bendahara', ok: 'Wali Kelas (contoh)' }); });
    state.pending.push({ id: 40, desc: 'Beli kapur dan penghapus', cat: 'op', amt: -28000, by: 'Bendahara' });
    for (var w = 1; w <= 12; w++) {
      var a = [], i;
      for (i = 0; i < TOTAL; i++) a.push('paid');
      if (w === 11) a[7] = 'todo';
      if (w === 12) { for (i = 24; i < 30; i++) a[i] = 'wait'; for (i = 30; i < TOTAL; i++) a[i] = 'todo'; }
      state.dues[w] = a;
    }
    rehash();
  })();

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
    toastEl.classList.add('is-on'); clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('is-on'); undoFn = null; }, undo ? 6000 : 3200);
  }
  toastUndo.addEventListener('click', function () { if (undoFn) { var f = undoFn; undoFn = null; f(); } toastEl.classList.remove('is-on'); });

  /* ---------- cuaca kas ---------- */
  var wxNow = 'cerah';
  function applyWeather() {
    var n = weeksLeft();
    var auto = n >= 12 ? 'cerah' : n >= 6 ? 'berawan' : 'mendung';
    wxNow = state.wx === 'auto' ? auto : state.wx;
    var b = document.body;
    b.classList.remove('wx-cerah', 'wx-berawan', 'wx-mendung'); b.classList.add('wx-' + wxNow);
    var h = new Date().getHours(); b.classList.toggle('wx-malam', h >= 18 || h < 5);
    $('#wxText').textContent = { cerah: 'Cerah', berawan: 'Berawan', mendung: 'Mendung' }[wxNow];
    $('#forecastChip').textContent = 'Cukup ± ' + n + ' minggu';
  }

  /* ---------- hero ---------- */
  var shown = 0;
  function setAmount(to, animate) {
    var el = $('#amountNum');
    if (!animate || reduce || !hasGsap) { shown = to; el.textContent = fmt(to); return; }
    var o = { v: shown };
    gsap.to(o, { v: to, duration: 1.4, ease: 'power3.out', onUpdate: function () { el.textContent = fmt(o.v); shown = o.v; }, onComplete: function () { shown = to; el.textContent = fmt(to); } });
  }
  function renderHero(animate) {
    setAmount(saldo(), animate);
    var maxW = Math.max.apply(null, state.tx.map(function (t) { return t.w; }));
    var d = state.tx.reduce(function (s, t) { return t.w === maxW ? s + t.amt : s; }, 0);
    var el = $('#delta'); el.className = 'delta' + (d < 0 ? ' neg' : '');
    el.innerHTML = ic(d < 0 ? 'out' : 'in', 'ic-sm') + '<span>' + (d < 0 ? '−' : '+') + 'Rp ' + fmt(Math.abs(d)) + ' minggu ' + maxW + '</span>';
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
      return '<div class="prop"><div class="top"><span class="t">' + esc(p.desc) + '</span><span class="a num out">' + rp(Math.abs(p.amt)) + '</span></div><div class="m">#' + p.id + ' · ' + posName(p.cat) + ' · diajukan ' + esc(p.by) + '</div><div class="pips" aria-label="' + p.yes + ' dari ' + p.needed + ' teman setuju">' + pips + '<span>' + p.yes + ' dari ' + p.needed + ' teman setuju</span></div><div class="m">Beri suara lewat bot Telegram.</div>' + (isAdmin() ? '<div class="acts"><button class="btn btn--tonal btn--sm" data-act="cancel-prop" data-id="' + p.id + '" type="button">Batalkan usulan</button></div>' : '') + '</div>';
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
    if (!n) { el.innerHTML = '<div class="empty"><b>Semua sudah disahkan</b>Tidak ada catatan yang menunggu Wali Kelas.</div>'; return; }
    var html = state.pending.map(function (p) {
      return '<div class="prop wait" data-pid="' + p.id + '" data-kind="tx"><div class="prop__hint">' + ic('check') + '&nbsp;Setujui</div><div class="top"><span class="t">' + esc(p.desc) + '</span><span class="a num ' + (p.amt < 0 ? 'out' : 'in') + '">' + (p.amt < 0 ? '−' : '+') + rp(Math.abs(p.amt)).replace('−', '') + '</span></div><div class="m">#' + p.id + ' · ' + posName(p.cat) + ' · diajukan ' + esc(p.by) + '</div><span class="waitpill">' + ic('clock', 'ic-sm') + 'Menunggu Wali Kelas</span>' +
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
    function end() { if (!on) return; on = false; card.style.transition = ''; if (dx > 110) { buzz(14); act('approve', +card.dataset.pid); } else { card.style.transform = ''; hint.style.opacity = 0; } }
    card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  }

  /* ---------- aksi ---------- */
  function addTx(t) {
    var id = state.nextId++; var now = new Date();
    var tx = { id: id, day: TODAY, time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), desc: t.desc, cat: t.cat, amt: t.amt, w: state.activeWeek, by: t.by || 'Bendahara', ok: 'Wali Kelas (contoh)', isNew: true };
    state.tx.push(tx); rehash(); return tx;
  }
  function removeCard(sel, cb) {
    var el = $(sel);
    if (!el || reduce) return cb();
    el.classList.add('is-gone'); setTimeout(cb, 380);
  }
  function act(kind, id, w) {
    if (kind === 'approve') {
      var p = state.pending.filter(function (x) { return x.id === id; })[0]; if (!p) return;
      if (posSaldo(p.cat) + p.amt < 0) { toast('Gagal: saldo pos ' + posName(p.cat) + ' tidak cukup. Tidak ada yang dicatat.'); return; }
      removeCard('.prop[data-pid="' + id + '"]', function () {
        state.pending = state.pending.filter(function (x) { return x.id !== id; }); var tx = addTx(p); renderAll(true);
        toast('Disetujui. Saldo diperbarui menjadi ' + rp(saldo()) + '.'); tx.isNew = false;
      });
    } else if (kind === 'reject') {
      buzz(20); removeCard('.prop[data-pid="' + id + '"]', function () { state.pending = state.pending.filter(function (x) { return x.id !== id; }); renderAll(); toast('Pengajuan #' + id + ' ditolak.'); });
    } else if (kind === 'cancel-pend') {
      var gone = state.pending.filter(function (x) { return x.id === id; })[0];
      state.pending = state.pending.filter(function (x) { return x.id !== id; }); renderAll();
      toast('Pengajuan dibatalkan.', function () { state.pending.push(gone); renderAll(); });
    } else if (kind === 'cancel-prop') {
      var gp = state.proposals.filter(function (x) { return x.id === id; })[0];
      state.proposals = state.proposals.filter(function (x) { return x.id !== id; }); renderAll();
      toast('Usulan dibatalkan.', function () { state.proposals.push(gp); renderAll(); });
    } else if (kind === 'approve-week') {
      var arr = state.dues[w], n = arr.filter(function (s) { return s === 'wait'; }).length; if (!n) return; buzz(16);
      if (+w === state.week) wave(w);
      var finish = function () {
        state.dues[w] = arr.map(function (s) { return s === 'wait' ? 'paid' : s; });
        addTx({ desc: 'Iuran minggu ' + w + ' (' + n + ' siswa)', cat: 'op', amt: n * NOMINAL, by: 'Bendahara' });
        renderAll(true); toast(n + ' iuran minggu ' + w + ' disahkan. Saldo bertambah ' + rp(n * NOMINAL) + '.');
      };
      reduce ? finish() : setTimeout(finish, Math.min(900, 160 + n * 60));
    }
  }
  function wave(w) {
    $$('#duesCard .stu.wait').forEach(function (el, i) { setTimeout(function () { el.classList.add('wave'); }, i * 70); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var k = b.dataset.act; act(k, +b.dataset.id, +b.dataset.w);
  });

  /* ---------- iuran ---------- */
  var ini = function (n) { return n.slice(0, 2).toUpperCase(); };
  function counts(w) { var a = state.dues[w]; return { paid: a.filter(function (s) { return s === 'paid'; }).length, wait: a.filter(function (s) { return s === 'wait'; }).length, todo: a.filter(function (s) { return s === 'todo'; }).length }; }
  function renderWeeks() {
    var html = ''; for (var w = 1; w <= 12; w++) html += '<button class="wk ' + (w === state.week ? 'on' : '') + '" type="button" data-w="' + w + '" ' + (w === state.week ? 'aria-current="true"' : '') + '><b>' + w + '</b><small>' + counts(w).paid + '/' + TOTAL + '</small></button>';
    $('#weeks').innerHTML = html;
    var on = $('#weeks .on'); if (on && on.scrollIntoView) { var box = $('#weeks'); box.scrollLeft = on.offsetLeft - box.clientWidth / 2 + on.clientWidth / 2; }
  }
  function chip(i, s, as) {
    var inner = '<span class="av" data-t="' + (i % 4) + '">' + ini(NAMES[i]) + '</span><span>' + NAMES[i] + '</span>' + (s === 'paid' ? ic('check', 'st') : s === 'wait' ? ic('clock', 'st') : '');
    return as === 'button' ? '<button class="stu todo" type="button" data-i="' + i + '" aria-label="Tandai ' + NAMES[i] + ' lunas minggu ' + state.week + '">' + inner + ic('plus', 'st') + '</button>' : '<span class="stu ' + s + '">' + inner + '</span>';
  }
  var lastPct = 0;
  function renderDues(animate) {
    var a = state.dues[state.week], c = counts(state.week), pct = Math.round(c.paid / TOTAL * 100), card = $('#duesCard'), html = '';
    html += '<div class="dues-top"><div class="ring" id="ring" style="--p:' + (animate ? lastPct : pct) + '" role="img" aria-label="' + pct + ' persen lunas"><b>' + pct + '%</b></div><div><div class="t">Minggu ke-' + state.week + (state.week === state.activeWeek ? ' · minggu ini' : '') + '</div><p>' + c.paid + ' dari ' + TOTAL + ' teman sudah bayar.' + (c.todo ? ' Tinggal ' + c.todo + ' lagi.' : '') + '</p></div></div>';
    if (!c.todo && !c.wait) html += '<div class="done">Semua sudah lunas<small>Terima kasih ya, XI-F2.</small></div>';
    if (c.todo) { html += '<div class="sub-h"><span>Belum bayar</span>' + (isAdmin() ? '<span class="note">ketuk nama untuk menandai</span>' : '') + '</div><div class="who">'; a.forEach(function (s, i) { if (s === 'todo') html += isAdmin() ? chip(i, s, 'button') : '<span class="stu todo">' + '<span class="av" data-t="' + (i % 4) + '">' + ini(NAMES[i]) + '</span><span>' + NAMES[i] + '</span></span>'; }); html += '</div>'; }
    if (c.wait) { html += '<div class="sub-h"><span>Menunggu Wali Kelas</span></div><div class="who">'; a.forEach(function (s, i) { if (s === 'wait') html += chip(i, s); }); html += '</div>'; }
    if (c.paid) { html += '<div class="sub-h"><span>Sudah lunas</span></div><div class="who">'; a.forEach(function (s, i) { if (s === 'paid') html += chip(i, s); }); html += '</div>'; }
    card.innerHTML = html; lastPct = pct;
    if (animate) requestAnimationFrame(function () { var r = $('#ring'); if (r) r.style.setProperty('--p', pct); });
  }
  $('#weeks').addEventListener('click', function (e) { var b = e.target.closest('.wk'); if (!b) return; state.week = +b.dataset.w; renderWeeks(); renderDues(true); renderTips(); });
  $('#duesCard').addEventListener('click', function (e) {
    var b = e.target.closest('button.stu'); if (!b) return;
    var i = +b.dataset.i, w = state.week; state.dues[w][i] = 'wait'; buzz(10); renderAll(); var el = $('#duesCard .stu.wait:last-child'); if (el) el.classList.add('just');
    toast(NAMES[i] + ' ditandai lunas. Menunggu Wali Kelas.', function () { state.dues[w][i] = 'todo'; renderAll(); });
  });

  /* ---------- riwayat ---------- */
  function renderHistory() {
    var list = state.tx.slice().reverse().slice(0, 12), day = '', html = '';
    $('#txCount').textContent = list.length + ' terakhir';
    list.forEach(function (t) {
      if (t.day !== day) { if (day) html += '</div>'; html += '<div class="day">' + t.day + '</div><div class="txlist">'; day = t.day; }
      var inn = t.amt > 0;
      html += '<button class="tx ' + (t.isNew ? 'is-new' : '') + '" type="button" data-id="' + t.id + '"><span class="ico ' + (inn ? '' : 'out') + '">' + ic(inn ? 'in' : 'out') + '</span><span><span class="ds">' + esc(t.desc) + '</span><span class="mt" style="display:block">' + posName(t.cat) + ' · ' + esc(t.by) + ' · ' + t.time + '<span class="vf">' + ic('check', 'ic-sm') + '</span></span></span><span class="am num ' + (inn ? 'in' : 'out') + '">' + (inn ? '+' : '−') + 'Rp ' + fmt(Math.abs(t.amt)) + '<small>#' + t.id + '</small></span></button>';
    });
    if (day) html += '</div>';
    $('#history').innerHTML = html;
  }
  var detailDlg = $('#detailDialog'), curHash = '';
  $('#history').addEventListener('click', function (e) {
    var b = e.target.closest('.tx'); if (!b) return;
    var t = state.tx.filter(function (x) { return x.id === +b.dataset.id; })[0]; if (!t) return; curHash = t.hash;
    $('#dBody').innerHTML = '<div><dt>Keterangan</dt><dd>' + esc(t.desc) + '</dd></div><div><dt>Jumlah</dt><dd class="num">' + (t.amt < 0 ? '−' : '+') + 'Rp ' + fmt(Math.abs(t.amt)) + '</dd></div><div><dt>Pos</dt><dd>' + posName(t.cat) + '</dd></div><div><dt>Dicatat oleh</dt><dd>' + esc(t.by) + ' · ' + t.day + ', ' + t.time + '</dd></div><div><dt>Disahkan oleh</dt><dd>' + esc(t.ok) + '</dd></div><div><dt>Sidik jari (hash)</dt><dd class="mono">' + t.hash + '</dd></div><div class="linkchain">terkunci ke catatan sebelumnya</div><div><dt>Hash sebelumnya</dt><dd class="mono">' + t.prev + '</dd></div>';
    detailDlg.showModal();
  });
  $('#dCopy').addEventListener('click', function () { copy(curHash); toast('Hash disalin.'); });

  /* ---------- bagikan ---------- */
  function waText() { return 'Kas XI-F2 · minggu ' + state.activeWeek + '\nSaldo ' + rp(saldo()) + ' ✔\nIuran minggu ini: ' + counts(state.activeWeek).paid + '/' + TOTAL + ' lunas\nCek: kas.xi-f2.example (contoh)'; }
  function remText() { var c = counts(state.activeWeek); return 'Halo teman-teman, ada ' + c.todo + ' orang yang belum bayar iuran minggu ' + state.activeWeek + ' (Rp 10.000). Terima kasih ya. Kalau sudah, kabari Bendahara.'; }
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
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = amtVal(), out = curType() === 'out', cat = form.elements.cat.value, d = desc.value.trim();
    if (!v) { err.textContent = 'Isi nominalnya dulu.'; nom.focus(); return; }
    if (!d) { err.textContent = 'Tulis buat apa uang ini.'; desc.focus(); return; }
    if (out && posSaldo(cat) - v < 0) { err.textContent = 'Saldo pos ' + posName(cat) + ' tidak cukup (tersisa ' + rp(posSaldo(cat)) + ').'; return; }
    var amt = out ? -v : v;
    if (out && v >= APPROVAL_MIN) {
      var pr = { id: state.nextPid++, desc: d, cat: cat, amt: amt, by: 'Bendahara', yes: 0, needed: 3 }; state.proposals.push(pr); dlg.close(); renderAll();
      toast('Jadi usulan. Menunggu 3 teman setuju.', function () { state.proposals = state.proposals.filter(function (x) { return x !== pr; }); renderAll(); });
    } else {
      var pd = { id: state.nextPid++, desc: d, cat: cat, amt: amt, by: 'Bendahara' }; state.pending.push(pd); dlg.close(); renderAll();
      toast('Diajukan ke Wali Kelas. Saldo belum berubah.', function () { state.pending = state.pending.filter(function (x) { return x !== pd; }); renderAll(); });
    }
  });
  $('#fab').addEventListener('click', function () { form.reset(); nom.value = ''; err.textContent = ''; syncForm(); dlg.showModal(); setTimeout(function () { nom.focus(); }, 60); });
  [dlg, detailDlg].forEach(function (d) { d.addEventListener('click', function (e) { if (e.target === d) d.close(); }); $$('[data-close]', d).forEach(function (b) { b.addEventListener('click', function () { d.close(); }); }); });

  /* ---------- peran dan demo ---------- */
  function applyRole() {
    var r = state.role; document.body.dataset.role = r;
    $('#roleLabel span').textContent = { siswa: 'Siswa', bendahara: 'Bendahara', guru: 'Wali Kelas' }[r];
    $('#fab').hidden = r !== 'bendahara';
    $$('#demoRole button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === r); });
    renderAll();
  }
  $('#demoRole').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { state.role = b.dataset.v; applyRole(); } });
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
    navLinks.forEach(function (a, i) { a.classList.toggle('on', i === idx); }); pill.style.transform = 'translateX(' + idx * 100 + '%)';
    topLinks.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + secs[idx].id || (idx === 0 && a.getAttribute('href') === '#ringkasan')); });
    if (!reduce && y < head.offsetHeight + 100) clouds.forEach(function (c) { c.style.transform = 'translate3d(0,' + (y * parseFloat(c.dataset.depth || .3) * 0.45).toFixed(1) + 'px,0)'; });
  }
  window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(onScroll); } }, { passive: true });
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach(function (el) { io.observe(el); });
  } else { $$('.reveal').forEach(function (el) { el.classList.add('is-in'); }); }

  /* ---------- mulai ---------- */
  renderPosChips(); syncForm(); applyRole(); onScroll();
  setAmount(0, false); setAmount(saldo(), true);
  verify();
  if (hasGsap && !reduce) {
    gsap.from('.hero > *', { y: 18, opacity: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out', clearProps: 'all' });
    var line = $('#sparkLine'); if (line.getTotalLength) { var L = line.getTotalLength(); gsap.fromTo(line, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', delay: 0.3, onComplete: function () { line.style.strokeDasharray = 'none'; } }); }
  }
})();
