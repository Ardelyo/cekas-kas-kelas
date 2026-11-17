/* CEKAS "Langit" — halaman masuk (prototipe: validasi palsu di sisi klien, hanya untuk menguji desain). */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.fx.reduce;

  var ROLES = {
    bendahara: { name: 'Bendahara', title: 'Masuk sebagai Bendahara', sub: 'Catat uang masuk dan keluar, tandai iuran, dan ajukan belanja.', label: 'Kata sandi', ph: 'Ketik kata sandi', pass: 'langit123', h1: 'Masuk untuk <em>mencatat</em> kas kelas.', intro: 'Hanya Bendahara dan Wali Kelas yang perlu masuk. Siswa cukup membuka kas tanpa kata sandi.', err: 'Kata sandi salah.' },
    guru: { name: 'Wali Kelas', title: 'Masuk sebagai Wali Kelas', sub: 'Setujui atau tolak catatan, dan sahkan iuran per minggu sekaligus.', label: 'PIN Wali Kelas', ph: 'Ketik PIN', pass: 'wali-langit', h1: 'Masuk untuk <em>mengesahkan</em> kas kelas.', intro: 'Setiap catatan baru berlaku setelah Wali Kelas menyetujui. Namamu ikut terkunci di sidik jari transaksi.', err: 'PIN salah.' }
  };
  var MAX = 5, LOCK_MS = 15 * 60 * 1000, CIRC = 276.46;
  var role = /peran=guru/.test(location.search) ? 'guru' : 'bendahara';
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  };
  var att = function (r) { return parseInt(store.get('cekas-att-' + r) || '0', 10); };
  var lockAt = function (r) { return parseInt(store.get('cekas-lock-' + r) || '0', 10); };

  var pw = $('#pw'), box = $('#pwBox'), form = $('#loginForm'), submit = $('#submit'), errText = $('#errText'), sky = $('#sky'), panel = $('#panel'), timer = 0;

  function show(id) { $$('.view', panel).forEach(function (v) { v.classList.toggle('on', v.id === id); }); }
  function pips() { var n = att(role); $$('#attempts i').forEach(function (i, k) { i.classList.toggle('used', k < n); }); }
  function setErr(msg, bad) { errText.textContent = msg || ''; box.classList.toggle('has-err', !!bad); }
  function meter() {
    var n = pw.value.length; $$('#meter i').forEach(function (i, k) { i.classList.toggle('on', k < n); }); $('#meter').classList.toggle('ready', n >= 6);
    $('#pwCount').textContent = Math.min(n, 6) + '/6';
  }

  function setRole(r, swap) {
    role = r; var d = ROLES[r];
    document.body.classList.toggle('for-guru', r === 'guru'); $('input[value="' + r + '"]').checked = true;
    var targets = [$('#pTitle'), $('#pSub'), $('#introTitle'), $('#introSub')];
    var apply = function () {
      $('#pTitle').textContent = d.title; $('#pSub').textContent = d.sub; $('#introTitle').innerHTML = d.h1; $('#introSub').textContent = d.intro;
      $('#pwLabel').textContent = d.label; pw.placeholder = d.ph; pw.value = ''; meter(); setErr('', false); pips();
      history.replaceState(null, '', r === 'guru' ? '?peran=guru' : location.pathname);
      targets.forEach(function (t) { t.classList.remove('is-out'); });
    };
    if (swap && !reduce) { targets.forEach(function (t) { t.classList.add('swap'); t.classList.add('is-out'); }); setTimeout(apply, 170); } else apply();
    refreshLock();
  }

  /* ---- kunci ---- */
  function refreshLock() {
    clearInterval(timer); var until = lockAt(role);
    if (until > Date.now()) { show('vLock'); tick(); timer = setInterval(tick, 1000); } else { if (until) { store.del('cekas-lock-' + role); store.del('cekas-att-' + role); } if (!$('#vDone').classList.contains('on')) show('vForm'); pips(); }
  }
  function tick() {
    var left = lockAt(role) - Date.now();
    if (left <= 0) { clearInterval(timer); store.del('cekas-lock-' + role); store.del('cekas-att-' + role); show('vForm'); pips(); setErr('Kunci selesai. Silakan coba lagi.', false); return; }
    var s = Math.ceil(left / 1000), m = Math.floor(s / 60);
    $('#lockTime').textContent = String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    $('#lockFg').style.strokeDashoffset = (CIRC * (1 - left / LOCK_MS)).toFixed(2);
    $('#lockText').textContent = 'Terlalu banyak percobaan masuk sebagai ' + ROLES[role].name + '. Demi keamanan, masuk dikunci sementara. Peran lain tidak terpengaruh.';
  }

  /* ---- interaksi form ---- */
  $$('input[name="role"]').forEach(function (r) { r.addEventListener('change', function () { if (role !== r.value) setRole(r.value, true); }); });
  pw.addEventListener('input', function () { meter(); if (box.classList.contains('has-err')) setErr('', false); });
  ['keydown', 'keyup'].forEach(function (ev) { pw.addEventListener(ev, function (e) { if (e.getModifierState) $('#caps').classList.toggle('on', e.getModifierState('CapsLock')); }); });
  pw.addEventListener('blur', function () { $('#caps').classList.remove('on'); });
  $('#eye2').addEventListener('click', function () {
    var show = pw.type === 'password'; pw.type = show ? 'text' : 'password'; this.setAttribute('aria-pressed', show);
    this.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'); this.querySelector('use').setAttribute('href', show ? '#i-eye-off' : '#i-eye'); pw.focus();
  });

  function warnSky() { sky.classList.add('is-warn'); setTimeout(function () { sky.classList.remove('is-warn'); }, 900); }
  function lockNow(ms) { store.set('cekas-lock-' + role, String(Date.now() + ms)); refreshLock(); }

  form.addEventListener('submit', async function (e) {
    e.preventDefault(); var v = pw.value;
    if (v.length < 6) { setErr('Minimal 6 karakter.', true); fx.shake(panel); fx.buzz(30); pw.focus(); return; }
    var ok = await fx.commit(submit, function () { return new Promise(function (r) { setTimeout(function () { r(v === ROLES[role].pass); }, 380); }); }, { keep: true, loading: 650, ok: 520 });
    if (!ok) {
      var n = att(role) + 1; store.set('cekas-att-' + role, String(n)); pips(); warnSky(); fx.buzz([40, 60, 40]);
      if (n >= MAX) { await fx.wait(reduce ? 0 : 400); lockNow(LOCK_MS); return; }
      setErr(ROLES[role].err + ' Sisa ' + (MAX - n) + ' percobaan.', true); fx.shake(box); pw.select(); return;
    }
    store.del('cekas-att-' + role); store.set('cekas-role', role);
    $('#doneTitle').textContent = 'Selamat datang, ' + ROLES[role].name;
    $('#doneSub').textContent = role === 'guru' ? 'Membuka antrean verifikasi…' : 'Membuka kas kelas…';
    sky.classList.add('is-open'); show('vDone'); fx.buzz(18);
    setTimeout(function () { location.href = 'kas.html'; }, reduce ? 300 : 1700);
  });

  /* ---- alat desain ---- */
  $('#dFill').addEventListener('click', function () { show('vForm'); pw.value = ROLES[role].pass; meter(); pw.focus(); });
  $('#dLock').addEventListener('click', function () { store.set('cekas-att-' + role, String(MAX)); lockNow(LOCK_MS - 28000); });
  $('#dReset').addEventListener('click', function () { ['bendahara', 'guru'].forEach(function (r) { store.del('cekas-att-' + r); store.del('cekas-lock-' + r); store.del('cekas-role'); }); sky.classList.remove('is-open'); setRole(role, false); show('vForm'); });

  /* ---- parallax awan ---- */
  if (!reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var clouds = $$('.sky__cloud', sky);
    window.addEventListener('pointermove', function (e) {
      var x = e.clientX / window.innerWidth - .5, y = e.clientY / window.innerHeight - .5;
      clouds.forEach(function (c) { var d = parseFloat(c.dataset.depth || .3); c.style.translate = (-x * 70 * d).toFixed(1) + 'px ' + (-y * 30 * d).toFixed(1) + 'px'; });
    }, { passive: true });
  }

  /* ---- mulai ---- */
  if (/state=terkunci/.test(location.search)) { store.set('cekas-lock-' + role, String(Date.now() + LOCK_MS - 28000)); }
  setRole(role, false);
  if (!lockAt(role) || lockAt(role) <= Date.now()) setTimeout(function () { pw.focus({ preventScroll: true }); }, 400);
})();
