/* CEKAS — interaksi minimal: dialog catat, konfirmasi, salin teks, service worker. */
(function () {
  "use strict";

  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._h); toast._h = setTimeout(function () { t.hidden = true; }, 3200);
  }

  // --- dialog catat transaksi
  var txDialog = document.getElementById("txDialog");
  document.querySelectorAll("[data-open-tx]").forEach(function (b) {
    b.addEventListener("click", function () {
      var r = txDialog.querySelector('input[name="type"][value="' + b.dataset.openTx + '"]');
      if (r) r.checked = true;
      txDialog.showModal();
      document.getElementById("f-nominal").focus();
    });
  });
  document.querySelectorAll("[data-close]").forEach(function (b) {
    b.addEventListener("click", function () { b.closest("dialog").close(); });
  });

  // --- konfirmasi (pengganti confirm() bawaan)
  var cd = document.getElementById("confirmDialog");
  document.querySelectorAll("form[data-confirm]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      if (f.dataset.ok === "1") return;
      e.preventDefault();
      document.getElementById("cText").textContent = f.dataset.confirm;
      cd.returnValue = "";
      cd.showModal();
      cd.addEventListener("close", function once() {
        cd.removeEventListener("close", once);
        if (cd.returnValue === "yes") { f.dataset.ok = "1"; f.requestSubmit(); }
      });
    });
  });

  // --- salin teks dari server (rekap WhatsApp, pengingat)
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta); return ok;
  }
  document.querySelectorAll("[data-copy-url]").forEach(function (b) {
    b.addEventListener("click", function () {
      fetch(b.dataset.copyUrl, { credentials: "same-origin" })
        .then(function (r) { return r.text(); })
        .then(function (text) {
          var done = function (ok) { toast(ok ? "Tersalin. Tempel di grup WhatsApp." : "Gagal menyalin. Pilih teks secara manual."); };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallbackCopy(text)); });
          } else { done(fallbackCopy(text)); }
        })
        .catch(function () { toast("Tidak bisa mengambil rekap. Periksa koneksi."); });
    });
  });

  // --- sorot menu bawah sesuai bagian yang sedang dilihat
  var links = Array.prototype.slice.call(document.querySelectorAll(".navbar a"));
  if ("IntersectionObserver" in window && links.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          links.forEach(function (a) { a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id); });
        }
      });
    }, { rootMargin: "-35% 0px -55% 0px" });
    links.forEach(function (a) { var s = document.querySelector(a.getAttribute("href")); if (s) io.observe(s); });
  }

  // --- service worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  }
})();
