/* CEKAS "Langit" — mikro-interaksi aksi (riak, tombol bermesin status, stempel, percikan, angka terbang). */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var CHECK = '<svg class="fx-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var XICON = '<svg class="fx-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" aria-hidden="true" style="stroke-dasharray:30"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var rand = function (a, b) { return a + Math.random() * (b - a); };

  /* riak sentuh di elemen yang bisa ditekan */
  document.addEventListener('pointerdown', function (e) {
    if (reduce) return;
    var el = e.target.closest('.btn, .fab, .wk, .tx, .pos, .quick button, .eye, .seg label'); if (!el || el.disabled || el.dataset.state) return;
    var r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, s = document.createElement('span');
    s.className = 'fx-rip'; s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
    el.classList.add('fx-host'); el.appendChild(s); setTimeout(function () { s.remove(); }, 700);
  }, { passive: true });

  /* tombol: idle → loading → ok/fail. work() opsional mengembalikan false untuk gagal. */
  async function commit(btn, work, o) {
    o = o || {}; if (!btn || btn.dataset.state) return false;
    var w = btn.getBoundingClientRect().width, html = btn.innerHTML;
    btn.style.minWidth = w + 'px';
    btn.innerHTML = '<span class="fx-lbl">' + html + '</span><span class="fx-spin" aria-hidden="true"></span>' + CHECK + XICON;
    btn.dataset.state = 'loading'; btn.setAttribute('aria-busy', 'true');
    var t0 = Date.now(), res = true;
    try { if (work) res = await work(); } catch (e) { res = false; }
    var left = (o.loading || 520) - (Date.now() - t0); if (left > 0 && !reduce) await wait(left);
    btn.dataset.state = res === false ? 'fail' : 'ok'; btn.removeAttribute('aria-busy');
    await wait(reduce ? 0 : (res === false ? 720 : (o.ok || 640)));
    if (!o.keep || res === false) { btn.innerHTML = html; btn.removeAttribute('data-state'); btn.style.minWidth = ''; }
    return res !== false;
  }

  /* percikan titik + cincin */
  function burst(x, y, n, colors) {
    if (reduce) return; n = n || 12; colors = colors || ['#ffffff', '#8ccbf5', '#4d9bf0', '#d6ff3f'];
    var ring = document.createElement('i'); ring.className = 'fx-ring'; ring.style.left = x + 'px'; ring.style.top = y + 'px'; document.body.appendChild(ring); setTimeout(function () { ring.remove(); }, 750);
    for (var i = 0; i < n; i++) {
      var el = document.createElement('i'), a = (i / n) * Math.PI * 2 + rand(-.25, .25), dist = rand(38, 84), sz = rand(5, 9);
      el.className = 'fx-dot'; el.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + sz + 'px;height:' + sz + 'px;background:' + colors[i % colors.length] + ';box-shadow:0 0 0 1px rgba(10,42,120,.12)';
      document.body.appendChild(el);
      (function (el, a, dist) {
        el.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: 'translate(calc(-50% + ' + Math.cos(a) * dist + 'px), calc(-50% + ' + (Math.sin(a) * dist + 14) + 'px)) scale(0)', opacity: 0 }], { duration: rand(560, 820), easing: 'cubic-bezier(.2,.7,.1,1)' }).onfinish = function () { el.remove(); };
      })(el, a, dist);
    }
  }

  /* stempel di atas kartu */
  function stamp(card, text, bad) {
    if (!card) return Promise.resolve();
    if (reduce) return Promise.resolve();
    var s = document.createElement('div'); s.className = 'fx-stamp' + (bad ? ' fx-stamp--no' : '');
    s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (bad ? 'M6 6l12 12M18 6L6 18' : 'M5 12.5l4.5 4.5L19 7.5') + '"/></svg><span>' + text + '</span>';
    card.classList.add('is-stamped'); card.appendChild(s);
    return wait(760);
  }

  /* angka terbang dari kartu ke saldo */
  function fly(fromEl, text, toEl, neg) {
    if (reduce || !fromEl || !toEl) return Promise.resolve();
    var a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect(), el = document.createElement('div');
    var sx = a.left + a.width / 2, sy = a.top + a.height / 2, tx = b.left + b.width / 2, ty = Math.max(b.top + b.height / 2, 72);
    if (b.bottom < 0) tx = window.innerWidth / 2;
    el.className = 'fx-fly' + (neg ? ' neg' : ''); el.textContent = text; el.style.left = sx + 'px'; el.style.top = sy + 'px'; document.body.appendChild(el);
    var dx = tx - sx, dy = ty - sy;
    return el.animate([
      { transform: 'translate(-50%,-50%) scale(.7)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.05)', opacity: 1, offset: .14 },
      { transform: 'translate(calc(-50% + ' + dx * .45 + 'px), calc(-50% + ' + (dy * .45 - 70) + 'px)) scale(1.1)', opacity: 1, offset: .52 },
      { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(.55)', opacity: 0 }
    ], { duration: 950, easing: 'cubic-bezier(.4,0,.2,1)' }).finished.then(function () { el.remove(); });
  }

  function sheen(el) { if (reduce || !el) return; el.classList.remove('fx-sheen'); void el.offsetWidth; el.classList.add('fx-sheen'); setTimeout(function () { el.classList.remove('fx-sheen'); }, 1300); }
  function glow(el) { if (reduce || !el) return; el.classList.remove('fx-glow'); void el.offsetWidth; el.classList.add('fx-glow'); setTimeout(function () { el.classList.remove('fx-glow'); }, 1300); }
  function bump(el) { if (reduce || !el) return; el.classList.remove('fx-bump'); void el.offsetWidth; el.classList.add('fx-bump'); }
  function shake(el) { if (!el) return; el.classList.remove('fx-shake'); void el.offsetWidth; el.classList.add('fx-shake'); }
  function closeSheet(d) { if (!d.open) return; if (reduce) { d.close(); return; } d.classList.add('is-closing'); setTimeout(function () { d.close(); d.classList.remove('is-closing'); }, 260); }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  window.fx = { commit: commit, burst: burst, stamp: stamp, fly: fly, sheen: sheen, glow: glow, bump: bump, shake: shake, closeSheet: closeSheet, buzz: buzz, wait: wait, reduce: reduce };
})();
