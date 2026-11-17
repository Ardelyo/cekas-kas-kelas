/* CEKAS "Langit" — mode langsung: aktif hanya bila halaman disajikan server Python di /langit/.
   Di hosting statis (mis. Vercel) berkas ini tidak melakukan apa pun dan desain memakai data contoh. */
(function () {
  'use strict';
  var served = /^\/langit\//.test(location.pathname);
  window.CEKAS_LIVE_API = served;
  if (!served) return;
  try {
    var x = new XMLHttpRequest(); x.open('GET', '/api/langit/state', false); x.send();
    if (x.status === 200) window.CEKAS_LIVE = JSON.parse(x.responseText);
  } catch (e) { /* tetap pakai data contoh */ }
})();
