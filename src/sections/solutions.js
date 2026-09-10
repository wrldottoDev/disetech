/**
 * Residencial / Comercial split. Almost everything is CSS (split widths, hover,
 * list-to-node links); this only decides WHEN each half's blueprint detail draws:
 * on first hover where there is a fine pointer, as the half reaches mid-screen
 * everywhere else. Drawn once, then it stays — later hovers only emphasise.
 *
 * IntersectionObserver rather than ScrollTrigger, like reveals.js: a one-shot
 * class flip needs no per-frame work.
 */
const REDUCED = '(prefers-reduced-motion: reduce)';
const POINTER = '(hover: hover) and (pointer: fine) and (min-width: 900px)';

export function initSolutions(root = document.querySelector('[data-solutions]')) {
  // Without this class the CSS renders the blueprints complete and static.
  if (!root || window.matchMedia(REDUCED).matches) return () => {};
  root.classList.add('is-live');

  const halves = [...root.querySelectorAll('[data-space]')];
  const draw = (half) => half.classList.add('is-drawn');

  // ponytail: mode is picked once at load; crossing the breakpoint later keeps it
  if (window.matchMedia(POINTER).matches) {
    const abort = new AbortController();
    halves.forEach((half) =>
      half.addEventListener('pointerenter', () => draw(half), { once: true, signal: abort.signal }),
    );
    return () => abort.abort();
  }

  if (!('IntersectionObserver' in window)) {
    halves.forEach(draw);
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        draw(entry.target);
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '-35% 0px -35% 0px' },
  );
  halves.forEach((half) => observer.observe(half));
  return () => observer.disconnect();
}
