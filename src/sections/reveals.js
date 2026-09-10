/**
 * Scroll reveals for the whole page, driven by two attributes:
 *
 *   [data-reveal]        a group
 *   [data-reveal-item]   the pieces inside it that stagger in
 *
 * A group with no items reveals itself.
 *
 * The hidden state lives in CSS behind `.js-reveals`, a class this module puts
 * on <html> itself. Content is therefore only ever hidden while JavaScript is
 * demonstrably alive to un-hide it: no JS, a dead CDN, an exception above this
 * line — the page just renders, fully readable.
 *
 * IntersectionObserver rather than ScrollTrigger on purpose. These are one-shot
 * state flips, not scrubbed animations, so they need no per-frame work and no
 * rAF: a paused tab cannot strand them half-played.
 */

const REDUCED = '(prefers-reduced-motion: reduce)';
/* Tight. The whole group should land in well under a second — a reveal that
   takes two seconds to finish reads as a page still loading, not as polish. */
const STAGGER_MS = 55;

/** Nothing may stay hidden longer than this, whatever the observer does. */
const FAILSAFE_MS = 4000;

export function initReveals() {
  const groups = [...document.querySelectorAll('[data-reveal]')];
  if (!groups.length) return () => {};

  const reveal = (group) => group.classList.add('is-revealed');
  const revealAll = () => groups.forEach(reveal);

  if (window.matchMedia(REDUCED).matches) {
    revealAll();
    return () => {};
  }

  // from here on the page is allowed to hide things
  document.documentElement.classList.add('js-reveals');

  for (const group of groups) {
    const items = group.querySelectorAll('[data-reveal-item]');
    items.forEach((item, i) => item.style.setProperty('--reveal-delay', `${i * STAGGER_MS}ms`));
  }

  if (!('IntersectionObserver' in window)) {
    revealAll();
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        reveal(entry.target);
        observer.unobserve(entry.target); // first impression only
      }
    },
    { rootMargin: '0px 0px -18% 0px' },
  );

  groups.forEach((group) => observer.observe(group));

  const failsafe = setTimeout(() => {
    revealAll();
    observer.disconnect();
  }, FAILSAFE_MS);

  const wire = initCtaWire();

  return () => {
    clearTimeout(failsafe);
    observer.disconnect();
    wire();
  };
}

/**
 * The CTA conductor: the one scrubbed element outside the hero, so it is the one
 * place in the page body that still wants ScrollTrigger.
 */
function initCtaWire() {
  const { gsap, ScrollTrigger } = window;
  const wire = document.querySelector('[data-cta-wire]');
  if (!wire || !gsap || !ScrollTrigger) return () => {};
  if (window.matchMedia(REDUCED).matches) return () => {};

  gsap.registerPlugin(ScrollTrigger);

  const tween = gsap.fromTo(
    wire,
    { scaleX: 0 },
    {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: { trigger: wire, start: 'top 92%', end: 'top 45%', scrub: true },
    },
  );

  return () => {
    tween.scrollTrigger?.kill();
    tween.kill();
  };
}
