/* CEKAS "Langit" — Tentang: cerita yang bergerak mengikuti gulir, tim berfoto sebagai karakter. */
(function () {
  'use strict';
  var st = document.querySelector('#cerita'); if (!st) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !window.gsap || !window.ScrollTrigger) { st.classList.add('is-static'); return; }
  gsap.registerPlugin(ScrollTrigger);
  var $ = function (s) { return st.querySelector(s); }, $$ = function (s) { return Array.prototype.slice.call(st.querySelectorAll(s)); };
  var mobile = window.matchMedia('(max-width: 759px)').matches;
  var chars = $$('.char'), dots = $$('.story2__dots i'), bg = $('.story2__bg > img'), tint = $('.story2__tint');

  gsap.set('.chap', { autoAlpha: 0, y: 40 }); gsap.set('.chap--1', { autoAlpha: 1, y: 0 });
  gsap.set(chars, { autoAlpha: 0, y: 140, scale: .9 }); gsap.set('.bubble2', { scale: 0, transformOrigin: '50% 100%' });
  gsap.set('.book i', { scaleX: 0, transformOrigin: 'left' }); gsap.set('.links span', { autoAlpha: 0, y: 24, scale: .6 });

  var tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, scrollTrigger: { trigger: st, start: 'top top', end: 'bottom bottom', scrub: 0.7, onUpdate: function (s) { var i = Math.min(4, Math.floor(s.progress * 5 + 0.02)); dots.forEach(function (d, k) { d.classList.toggle('on', k === i); }); } } });
  // awan melayang sepanjang cerita
  tl.to('.sc--a', { xPercent: 60, duration: 10, ease: 'none' }, 0).to('.sc--b', { xPercent: -50, duration: 10, ease: 'none' }, 0).to('.sc--c', { yPercent: -10, duration: 10, ease: 'none' }, 0).fromTo(bg, { scale: 1.18 }, { scale: 1, duration: 10, ease: 'none' }, 0);
  // bab 1 -> 2 (suasana redup, satu buku tertutup)
  tl.to('.chap--1', { autoAlpha: 0, y: -50, duration: 1 }, 1.6).to(tint, { opacity: .82, duration: 1.4 }, 1.2)
    .to('.chap--2', { autoAlpha: 1, y: 0, duration: 1 }, 2).to('.book i', { scaleX: 1, duration: .8, stagger: .2 }, 2.4);
  // bab 2 -> 3 (dibuka, terang, rantai terhubung)
  tl.to('.chap--2', { autoAlpha: 0, y: -50, duration: 1 }, 3.8).to(tint, { opacity: .1, duration: 1.6 }, 3.8)
    .to('.chap--3', { autoAlpha: 1, y: 0, duration: 1 }, 4.4).to('.links span', { autoAlpha: 1, y: 0, scale: 1, duration: .7, stagger: .25, ease: 'back.out(1.8)' }, 4.8);
  // bab 3 -> 4 (karakter masuk satu per satu)
  tl.to('.chap--3', { autoAlpha: 0, y: -50, duration: 1 }, 6.4)
    .to('.chap--4', { autoAlpha: 1, y: 0, duration: 1 }, 6.8)
    .to(chars, { autoAlpha: 1, y: 0, scale: 1, duration: 1, stagger: .45, ease: 'back.out(1.3)' }, 7)
    .to('.bubble2', { scale: 1, duration: .5, stagger: .45, ease: 'back.out(2.4)' }, 7.6);
  // bab 5
  tl.to('.chap--4', { autoAlpha: 0, y: -40, duration: .8 }, 9.4).to('.chap--5', { autoAlpha: 1, y: 0, duration: 1 }, 9.6).to(chars, { y: mobile ? -10 : -24, duration: 1 }, 9.6);
  tl.to({}, { duration: 1.2 }); // jeda akhir

  // gerak hidup karakter (tidak terikat gulir)
  chars.forEach(function (c, i) { gsap.to(c.querySelector('.char__in'), { y: -10 - (i % 2) * 4, rotation: i % 2 ? 1.4 : -1.4, duration: 2.2 + i * .35, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: i * .2 }); });
})();
