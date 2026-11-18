/* CEKAS "Langit" — mode langsung: memakai data server Python bila /api/langit/state bisa dijangkau.
   Berlaku di server Python (/langit/) maupun di Vercel (permintaan /api diteruskan ke Cloud Run lewat rewrite).
   Bila server tidak terjangkau (mis. dibuka dari berkas lokal), desain memakai data contoh. */
(function () {
  'use strict';
  window.CEKAS_LIVE_API = false;
  if (location.protocol === 'file:') return;
  try {
    var x = new XMLHttpRequest(); x.open('GET', '/api/langit/state', false); x.send();
    if (x.status === 200) {
      var j = JSON.parse(x.responseText);
      if (j && typeof j.saldo === 'number') { window.CEKAS_LIVE = j; window.CEKAS_LIVE_API = true; }
    }
  } catch (e) { /* tetap pakai data contoh */ }
})();

/* Versi aplikasi dari server (cek versi): tampil di footer dan dashboard. Gagal diam-diam bila server tak terjangkau. */
(function () {
  'use strict';
  if (location.protocol === 'file:') return;
  function fill(text) { var n = document.querySelectorAll('[data-ver]'); for (var i = 0; i < n.length; i++) n[i].textContent = text; }
  function go() {
    fetch('/api/version', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(function (j) {
      if (j && j.version) fill('Versi aplikasi: v' + j.version + ' (' + (j.commit || 'dev') + ')' + (j.revision && j.revision !== 'lokal' ? ' · ' + j.revision : ''));
    }).catch(function () { fill('Versi aplikasi: tidak terjangkau (mode contoh)'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
