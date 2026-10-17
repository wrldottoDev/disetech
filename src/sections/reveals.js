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
 * IntersectionObserver on purpose: these are one-shot state flips, so they need
 * no per-frame work and no rAF, and a paused tab cannot strand them half-played.
 */

const REDUCED = '(prefers-reduced-motion: reduce)';
/* Tight. The whole group should land in well under a second — a reveal that
   takes two seconds to finish reads as a page still loading, not as polish. */
const STAGGER_MS = 60;

/**
 * An observer reports on every target as soon as it starts observing. If that
 * first report has not arrived by now, it never will (some headless renderers,
 * a frozen tab) — show everything rather than leave the page blank.
 */
const FAILSAFE_MS = 3000;

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

  let alive = false;
  const observer = new IntersectionObserver(
    (entries) => {
      alive = true;
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
    if (alive) return;
    revealAll();
    observer.disconnect();
  }, FAILSAFE_MS);

  return () => {
    clearTimeout(failsafe);
    observer.disconnect();
  };
}
