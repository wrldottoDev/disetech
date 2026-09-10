/**
 * The two industrial backdrops.
 *
 * Each one gets a single scrubbed ScrollTrigger that does two things at once as
 * the section crosses the viewport:
 *
 *   opacity   0.06 -> peak -> 0.06     the room comes out of the dark and goes back
 *   translateY  +y  ->  -y             it drifts slower than the page scrolls
 *
 * Both are composited properties, so this is two triggers for the whole effect
 * and no layout work per frame.
 */

const REDUCED = '(prefers-reduced-motion: reduce)';

/**
 * Peak opacity. High enough that arriving at a backdrop is unmistakable — the
 * page clearly opens onto a room — while the mask still dissolves both edges so
 * you never catch where the picture starts.
 */
const PEAK = 0.55;
const RESTING = 0.05;

/** A slow push in. Depth comes from the room resolving, not from movement. */
const ZOOM = 1.035;

/**
 * Parallax travel as a share of the section height. Deliberately below the
 * threshold where it reads as motion: the goal is "there is space behind this",
 * not "that picture is moving".
 */
const DRIFT = 0.035;

/** Phones: effectively none. Short sections turn any drift into visible sliding. */
const DRIFT_SMALL = 0.008;
const SMALL = '(max-width: 899px)';

export function initDepth() {
  const sections = [...document.querySelectorAll('[data-depth]')];
  if (!sections.length) return () => {};

  const { gsap, ScrollTrigger } = window;
  const reduced = window.matchMedia(REDUCED).matches;

  // Reduced motion still gets the depth, just held still at a readable level.
  if (reduced || !gsap || !ScrollTrigger) {
    for (const section of sections) {
      const layer = section.querySelector('[data-depth-media] img');
      if (layer) layer.style.opacity = String(PEAK * 0.8);
    }
    return () => {};
  }

  gsap.registerPlugin(ScrollTrigger);
  const timelines = [];
  let cancelled = false;

  for (const section of sections) {
    const media = section.querySelector('[data-depth-media]');
    if (!media) continue;

    // Wait for the picture before animating it. Otherwise the scrub runs over
    // an empty box and the room snaps into place mid-pass when it finally
    // decodes. Until then the media sits at its CSS resting opacity, which is
    // indistinguishable from the page background.
    const img = media.querySelector('img');
    if (img && !img.complete) {
      const onSettled = () => {
        if (!cancelled) build(section, media);
      };
      // `error` too: a picture that fails to load must not leave the section
      // without its trigger forever.
      img.addEventListener('load', onSettled, { once: true });
      img.addEventListener('error', onSettled, { once: true });
      continue;
    }

    build(section, media);
  }

  function build(section, media) {
    // the mask lives on `media` and must stay put; everything animated is the
    // picture inside it
    const layer = media.querySelector('img') ?? media;
    const drift = section.offsetHeight * (window.matchMedia(SMALL).matches ? DRIFT_SMALL : DRIFT);

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    });

    // brightness rises to the middle of the pass and falls away again. power2
    // holds the peak longer than it holds the dark, so the room is properly
    // present while you are in it instead of only grazing full strength.
    tl.fromTo(
      layer,
      { opacity: RESTING },
      { opacity: PEAK, duration: 0.45, ease: 'power2.out' },
      0,
    ).to(layer, { opacity: RESTING, duration: 0.45, ease: 'power2.in' }, 0.55);

    // and it settles back from a slight push — scale, not motion, is what sells
    // the distance
    tl.fromTo(
      layer,
      { scale: ZOOM },
      { scale: 1, duration: 1, ease: 'none' },
      0,
    );

    // and the whole room drifts, slower than the scroll, across the same pass
    tl.fromTo(
      layer,
      { y: drift },
      { y: -drift, duration: 1, ease: 'none' },
      0,
    );

    timelines.push(tl);
  }

  return () => {
    cancelled = true;
    for (const tl of timelines) {
      tl.scrollTrigger?.kill();
      tl.kill();
    }
  };
}
