/**
 * Services: the sticky frame shows whichever step is crossing the middle of
 * the screen. A line across the viewport's centre (the -50% margins) decides,
 * so exactly one step is active at a time with no scroll listeners.
 *
 * Without this module every step reads at full strength (`.is-live` is what
 * dims the inactive ones) and the frame shows the first service.
 */
export function initServices(root) {
  if (!root || !('IntersectionObserver' in window)) return;

  const steps = [...root.querySelectorAll('[data-service]')];
  const images = [...root.querySelectorAll('[data-service-img]')];
  if (!steps.length) return;

  const activate = (index) => {
    steps.forEach((step, i) => step.classList.toggle('is-active', i === index));
    images.forEach((image, i) => image.classList.toggle('is-active', i === index));
    root.style.setProperty('--step', String(index));
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) activate(steps.indexOf(entry.target));
      }
    },
    { rootMargin: '-50% 0px -50% 0px' },
  );

  steps.forEach((step) => observer.observe(step));
  root.classList.add('is-live');
}
