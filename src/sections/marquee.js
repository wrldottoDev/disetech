/**
 * Brands marquee.
 *
 * The motion is a CSS animation, not JS: one composited transform, nothing per
 * frame, and pausing is a single property. This module only does the two things
 * CSS cannot:
 *
 *   1. duplicate the list, so the loop closes on itself with no visible seam
 *   2. pause the animation while the strip is off screen
 *
 * The brand list lives in index.html, so it is real crawlable content and still
 * reads as a plain list with JavaScript off.
 */

const REDUCED = '(prefers-reduced-motion: reduce)';

export function initMarquee() {
  const section = document.querySelector('[data-marquee-section]');
  const track = section?.querySelector('[data-marquee-track]');
  const group = track?.querySelector('[data-marquee-group]');
  if (!section || !track || !group) return () => {};

  const reduced = window.matchMedia(REDUCED);

  // Reduced motion keeps the single authored group and never travels. The class
  // is what switches the CSS: media query and clone decision must not be able to
  // disagree, or the track would travel with only one group behind it.
  if (reduced.matches) {
    section.classList.add('is-static');
    return () => section.classList.remove('is-static');
  }

  // The keyframe moves the track by -50%, which is exactly one group wide only
  // because there are precisely two of them.
  const clone = group.cloneNode(true);
  clone.setAttribute('aria-hidden', 'true');
  clone.removeAttribute('data-marquee-group');
  // the copy is decorative: keep its links out of the tab order
  clone.querySelectorAll('a, button').forEach((el) => el.setAttribute('tabindex', '-1'));
  track.append(clone);

  let observer = null;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      ([entry]) => section.classList.toggle('is-offscreen', !entry.isIntersecting),
      { rootMargin: '120px 0px' },
    );
    observer.observe(section);
  }

  return () => {
    observer?.disconnect();
    clone.remove();
    section.classList.remove('is-offscreen');
  };
}
