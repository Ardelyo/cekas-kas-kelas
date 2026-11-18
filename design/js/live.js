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
