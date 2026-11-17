/* CEKAS "Langit" — Tentang: cerita beradegan yang berjalan mengikuti gulir. */
(function () {
  'use strict';
  var st = document.querySelector('#cerita'); if (!st) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !window.gsap || !window.ScrollTrigger) { st.classList.add('is-static'); return; }
  gsap.registerPlugin(ScrollTrigger);
  var Q = function (s, r) { return Array.prototype.slice.call((r || st).querySelectorAll(s)); };
  var scenes = Q('.scene'), dots = Q('.story2__dots i'), bg = st.querySelector('.story2__bg > img'), tint = st.querySelector('.story2__tint');
  var N = scenes.length, D = 3; // tiap adegan = 3 satuan waktu

  gsap.set(scenes, { autoAlpha: 0 });
  gsap.set(Q('.say'), { scale: 0, transformOrigin: '20% 100%' });
  gsap.set(Q('.actor'), { y: 120, autoAlpha: 0 }); gsap.set(Q('.narr > *'), { y: 24, autoAlpha: 0 });
  gsap.set(Q('.links2 span'), { autoAlpha: 0, scale: .6 }); gsap.set(Q('.ping'), { autoAlpha: 0, y: -20, scale: .8 }); gsap.set(Q('.glow'), { autoAlpha: 0 });
  gsap.set(Q('.lu'), { y: 150, autoAlpha: 0 });

  var tl = gsap.timeline({ defaults: { ease: 'power2.out' }, scrollTrigger: { trigger: st, start: 'top top', end: 'bottom bottom', scrub: 0.7,
    onUpdate: function (s) { var i = Math.min(N - 1, Math.floor(s.progress * N)); dots.forEach(function (d, k) { d.classList.toggle('on', k === i); }); } } });

  tl.to('.sc--a', { xPercent: 60, duration: N * D, ease: 'none' }, 0).to('.sc--b', { xPercent: -50, duration: N * D, ease: 'none' }, 0).fromTo(bg, { scale: 1.16 }, { scale: 1, duration: N * D, ease: 'none' }, 0);
  var tints = [0, .45, .88, .1, 0, 0]; // suasana per adegan: pagi, redup, malam, terang, cerah
  scenes.forEach(function (sc, i) {
    var t0 = i * D, last = i === N - 1;
    var narr = Q('.narr > *', sc), actors = Q('.actor', sc), says = Q('.say', sc);
    tl.to(tint, { opacity: tints[i], duration: .8, ease: 'none' }, t0)
      .to(sc, { autoAlpha: 1, duration: .25, ease: 'none' }, t0)
      .to(narr, { y: 0, autoAlpha: 1, duration: .55, stagger: .1 }, t0 + .05);
    actors.forEach(function (a, k) {
      tl.to(a, { y: 0, autoAlpha: 1, duration: .6, ease: 'back.out(1.3)' }, t0 + .35 + k * .3)
        .to(a.querySelector('.say'), { scale: 1, duration: .4, ease: 'back.out(2.2)' }, t0 + .75 + k * .3);
    });
    if (i === 2) tl.to(Q('.glow', sc), { autoAlpha: 1, duration: .6 }, t0 + .3).to(Q('.links2 span', sc), { autoAlpha: 1, scale: 1, duration: .4, stagger: .2, ease: 'back.out(2)' }, t0 + 1.2);
    if (i === 3) tl.to(Q('.ping', sc), { autoAlpha: 1, y: 0, scale: 1, duration: .5, ease: 'back.out(2)' }, t0 + 1.4);
    if (last) tl.to(Q('.lu', sc), { y: 0, autoAlpha: 1, duration: .6, stagger: .14, ease: 'back.out(1.2)' }, t0 + .6);
    if (!last) tl.to(sc, { autoAlpha: 0, duration: .3, ease: 'none' }, t0 + D - .3);
  });
  tl.to({}, { duration: .8 });

  Q('.actor__in, .lu img').forEach(function (c, i) { gsap.to(c, { y: -8 - (i % 3) * 3, duration: 2.2 + (i % 4) * .3, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: i * .15 }); });
})();
