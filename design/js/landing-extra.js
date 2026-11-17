/* CEKAS "Langit" — landing: judul per kata, tab peran, FAQ, testimoni, spotlight, outro, keluar ke aplikasi. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var io = 'IntersectionObserver' in window ? function (cb, opts) { return new IntersectionObserver(cb, opts); } : null;
  function once(els, cb, margin) {
    if (!io || reduce) { els.forEach(function (e) { cb(e); }); return; }
    var o = io(function (es) { es.forEach(function (en) { if (en.isIntersecting) { cb(en.target); o.unobserve(en.target); } }); }, { rootMargin: margin || '0px 0px -12% 0px' });
    els.forEach(function (e) { o.observe(e); });
  }

  /* ---------- judul dibuka kata per kata ---------- */
  function splitEl(el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'); w.className = 'w'; var inner = document.createElement('span'); inner.textContent = part; inner.style.setProperty('--i', i++); inner.parentNode; w.appendChild(inner); w.style.setProperty('--i', i); inner.style.transitionDelay = (i * 45) + 'ms'; frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    })(el);
  }
  var splits = $$('.split'); splits.forEach(splitEl);
  once(splits, function (el) { el.classList.add('is-in'); }, '0px 0px -15% 0px');

  /* ---------- progres gulir di atas layar ---------- */
  var bar = $('#progressTop i'), ticking = false;
  function prog() {
    ticking = false; var max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0).toFixed(4) + ')';
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(prog); } }, { passive: true }); prog();

  /* ---------- tab peran ---------- */
  var tabs = $('#tabs');
  if (tabs) {
    var tabBtns = $$('.tab', tabs), panels = $$('.panel2');
    function pick(i, focus) {
      tabs.dataset.i = i;
      tabBtns.forEach(function (b, k) { var on = k === i; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
      panels.forEach(function (p, k) { var on = k === i; p.hidden = !on; p.classList.toggle('on', on); });
    }
    tabBtns.forEach(function (b, k) {
      b.addEventListener('click', function () { pick(k, false); });
      b.addEventListener('keydown', function (e) {
        var n = tabBtns.length, i = tabBtns.indexOf(b);
        if (e.key === 'ArrowRight') { e.preventDefault(); pick((i + 1) % n, true); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); pick((i + n - 1) % n, true); }
        else if (e.key === 'Home') { e.preventDefault(); pick(0, true); } else if (e.key === 'End') { e.preventDefault(); pick(n - 1, true); }
      });
    });
    tabs.dataset.i = 0;
  }

  /* ---------- FAQ ---------- */
  $$('.acc__q').forEach(function (q) {
    q.addEventListener('click', function () {
      var item = q.closest('.acc__i'), open = q.getAttribute('aria-expanded') === 'true';
      $$('.acc__i.open').forEach(function (o) { if (o !== item) { o.classList.remove('open'); $('.acc__q', o).setAttribute('aria-expanded', 'false'); } });
      q.setAttribute('aria-expanded', !open); item.classList.toggle('open', !open);
    });
  });

  /* ---------- testimoni: geser, titik, tombol ---------- */
  var track = $('#testiTrack');
  if (track) {
    var cards = $$('.quote', track), dots = $$('#testiDots i'), prev = $('#tPrev'), next = $('#tNext'), cur = 0;
    var step = function () { return cards[0].getBoundingClientRect().width + 14; };
    function sync() {
      cur = Math.round(track.scrollLeft / step()); cur = Math.max(0, Math.min(cards.length - 1, cur));
      dots.forEach(function (d, i) { d.classList.toggle('on', i === cur); });
      prev.disabled = track.scrollLeft < 8; next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
    }
    track.addEventListener('scroll', function () { requestAnimationFrame(sync); }, { passive: true });
    prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }); });
    track.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { e.preventDefault(); next.click(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); prev.click(); } });
    var down = false, sx = 0, sl = 0, moved = 0;
    track.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; moved = 0; sx = e.clientX; sl = track.scrollLeft; track.classList.add('is-drag'); });
    window.addEventListener('pointermove', function (e) { if (!down) return; var dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx)); track.scrollLeft = sl - dx; });
    window.addEventListener('pointerup', function () { if (!down) return; down = false; track.classList.remove('is-drag'); var t = Math.round(track.scrollLeft / step()); track.scrollTo({ left: t * step(), behavior: 'smooth' }); });
    window.addEventListener('resize', sync); sync();
  }

  /* ---------- spotlight yang mengikuti kursor ---------- */
  if (fine) {
    $$('.feat, .tile').forEach(function (el) {
      el.addEventListener('pointermove', function (e) { var r = el.getBoundingClientRect(); el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
    });
  }

  /* ---------- paralaks foto tentang ---------- */
  var par = $$('[data-parallax]');
  if (par.length && !reduce) {
    var pt = false;
    var run = function () {
      pt = false;
      par.forEach(function (img) {
        var r = img.parentNode.getBoundingClientRect(), vh = window.innerHeight; if (r.bottom < 0 || r.top > vh) return;
        var p = (r.top + r.height / 2 - vh / 2) / vh; img.style.transform = 'translateY(' + (-p * 60 * parseFloat(img.dataset.parallax || .1) * 10).toFixed(1) + 'px)';
      });
    };
    window.addEventListener('scroll', function () { if (!pt) { pt = true; requestAnimationFrame(run); } }, { passive: true }); run();
  }

  /* ---------- outro: bintang muncul, wordmark naik ---------- */
  var stars = $('#duskStars');
  if (stars) {
    for (var i = 0; i < 60; i++) {
      var s = document.createElement('i'), z = 1 + Math.random() * 2;
      s.style.cssText = 'left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;width:' + z + 'px;height:' + z + 'px;opacity:' + (0.35 + Math.random() * 0.6) + ';animation-delay:' + (-Math.random() * 3) + 's;animation-duration:' + (2.4 + Math.random() * 2.4) + 's';
      stars.appendChild(s);
    }
    var dusk = $('#dusk'), t2 = false;
    var sky = function () {
      t2 = false; var r = dusk.getBoundingClientRect(), vh = window.innerHeight;
      var p = Math.min(1, Math.max(0, (vh - r.top) / (r.height + vh * 0.2)));
      stars.style.opacity = Math.max(0, (p - 0.35) / 0.55).toFixed(3);
    };
    window.addEventListener('scroll', function () { if (!t2) { t2 = true; requestAnimationFrame(sky); } }, { passive: true }); sky();
  }
  var word = $('#outroWord');
  if (word) { $$('span', word).forEach(function (s, k) { s.style.setProperty('--i', k); }); once([word], function (el) { el.classList.add('is-in'); }, '0px 0px -5% 0px'); }
  var top = $('#toTop');
  if (top) top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });

  /* ---------- kartu hero: karusel melingkar ---------- */
  var arc = $('#arc');
  if (arc) {
    var cardsA = $$('.card', arc), N = cardsA.length, t = 2, speed = 0.2, targetSpeed = 0.2, dragging = false, lastX = 0, vel = 0, last = 0, raf = 0, heroVisible = true;
    var stepPx = function () { return cardsA[0].offsetWidth + Math.max(10, Math.min(22, window.innerWidth * 0.016)); };
    function layout() {
      var sp = stepPx(), vis = Math.max(1.3, window.innerWidth / sp / 2 + 0.55);
      cardsA.forEach(function (c, i) {
        var p = (((i - t) % N) + N) % N; if (p >= N / 2) p -= N;
        var d = Math.abs(p), o = Math.max(0, Math.min(1, (vis - d) / 0.85));
        c.style.setProperty('--px', p.toFixed(4)); c.style.setProperty('--o', o.toFixed(3)); c.style.zIndex = Math.round(100 - d * 12);
        c.classList.toggle('is-front', d < 0.5);
        if (reduce) c.style.setProperty('transform', 'translate3d(' + (p * sp).toFixed(1) + 'px,' + (p * p * 9).toFixed(1) + 'px,0) rotateY(' + (-p * 12).toFixed(1) + 'deg)', 'important');
      });
    }
    layout();
    if (!reduce) {
      var frame = function (now) {
        raf = requestAnimationFrame(frame);
        var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
        var mo = window.motion, base = (mo && mo.state.paused) ? 0 : targetSpeed * (mo ? mo.state.speed : 1) * (mo && mo.isLite() ? 0.5 : 1);
        if (!dragging) { speed += (base - speed) * Math.min(1, dt * 4); t += speed * dt + vel; vel *= 0.92; }
        layout();
      };
      var startLoop = function () { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
      var stopLoop = function () { cancelAnimationFrame(raf); raf = 0; };
      startLoop();
      if (io) io(function (es) { heroVisible = es[0].isIntersecting; if (heroVisible && !document.hidden) startLoop(); else stopLoop(); }, { threshold: 0 }).observe($('.hero'));
      document.addEventListener('visibilitychange', function () { if (document.hidden) stopLoop(); else if (heroVisible) startLoop(); });
      arc.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') targetSpeed = 0.04; });
      arc.addEventListener('pointerleave', function () { targetSpeed = 0.2; });
      arc.addEventListener('pointerdown', function (e) { dragging = true; lastX = e.clientX; vel = 0; arc.classList.add('is-drag'); try { arc.setPointerCapture(e.pointerId); } catch (x) {} });
      arc.addEventListener('pointermove', function (e) { if (!dragging) return; var dx = e.clientX - lastX; lastX = e.clientX; var d2 = dx / stepPx(); t -= d2; vel = -d2 * 0.5; });
      var up = function () { if (!dragging) return; dragging = false; arc.classList.remove('is-drag'); };
      arc.addEventListener('pointerup', up); arc.addEventListener('pointercancel', up);
    }
    window.addEventListener('resize', layout);
  }

  /* ---------- tiga langkah: garis mengisi saat digulir ---------- */
  var flow = $('#flowList'), flowFill = $('#flowFill');
  if (flow && flowFill) {
    var steps = $$('.fstep', flow), ft = false;
    var upd = function () {
      ft = false; var r = flow.getBoundingClientRect(), mid = window.innerHeight * 0.55, p = Math.min(1, Math.max(0, (mid - r.top) / r.height));
      flow.style.setProperty('--p', p.toFixed(3)); flowFill.parentNode.style.setProperty('--p', p.toFixed(3));
    };
    window.addEventListener('scroll', function () { if (!ft) { ft = true; requestAnimationFrame(upd); } }, { passive: true }); upd();
    once(steps, function (s) { s.classList.add('is-in'); }, '0px 0px -30% 0px');
  }

  /* ---------- keluar ke aplikasi: langit naik lalu putih terang ---------- */
  $$('a[href="kas.html"], a[href="login.html"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0 || reduce || !window.fx) return;
      e.preventDefault(); var href = a.getAttribute('href');
      document.body.classList.add('is-leaving');
      var v = fx.veil('day'); v.style.opacity = 0;
      v.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 800, delay: 450, easing: 'ease-in', fill: 'forwards' });
      setTimeout(function () { try { if (href === 'kas.html') sessionStorage.setItem('cekas-scene', 'masuk'); } catch (x) {} location.href = href; }, 1300);
    });
  });
})();

/* ---------- kartu karakter: miring mengikuti kursor ---------- */
(function () {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.ccard:not(.ccard--slot)').forEach(function (c) {
    c.addEventListener('pointermove', function (e) { var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; c.style.setProperty('--ry', (x * 14).toFixed(2) + 'deg'); c.style.setProperty('--rx', (-y * 10).toFixed(2) + 'deg'); c.style.setProperty('--sx', (x * 160 + 20).toFixed(0) + '%'); });
    c.addEventListener('pointerleave', function () { c.style.setProperty('--ry', '0deg'); c.style.setProperty('--rx', '0deg'); c.style.setProperty('--sx', '-120%'); });
  });
})();
