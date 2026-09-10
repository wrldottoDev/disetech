import { frameProgress, pickSequence, REVEAL_END } from './config.js';
import { createFrameSequence } from './frameSequence.js';
import { buildOverlayTimeline, showRestingState } from './heroOverlay.js';

const REDUCED = '(prefers-reduced-motion: reduce)';

export function initHero(root) {
  const canvas = root.querySelector('[data-hero-canvas]');
  const overlay = root.querySelector('[data-hero-overlay]');
  const sequence = pickSequence();

  const reduced = window.matchMedia(REDUCED);
  let teardown = null;

  function mount() {
    teardown = reduced.matches
      ? mountStatic(root, canvas, overlay, sequence)
      : mountScrubbed(root, canvas, overlay, sequence);
  }

  const remount = () => {
    teardown?.();
    mount();
  };
  reduced.addEventListener('change', remount);
  mount();

  return () => {
    reduced.removeEventListener('change', remount);
    teardown?.();
  };
}

/** Full scroll-scrubbed sequence. */
function mountScrubbed(root, canvas, overlay, sequence) {
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  root.classList.remove('hero--static');
  const seq = createFrameSequence(canvas, sequence);
  const tl = buildOverlayTimeline(overlay, gsap);
  addReveal(tl, canvas, gsap);

  const st = ScrollTrigger.create({
    animation: tl,
    trigger: root,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true, // strictly bound to the scrollbar: stops when the user stops
    onUpdate: (self) => seq.seek(frameProgress(self.progress)),
  });

  // fonts and the first decode can shift measurements — re-measure once
  seq.start().then(() => ScrollTrigger.refresh());

  return () => {
    st.kill();
    tl.kill();
    seq.destroy();
    gsap.set(canvas, { clearProps: 'all' }); // hand the canvas back to CSS
  };
}

/**
 * The opening: the viewport is black, and the first frame is lifted out of the
 * dark as the user scrolls — dimmed, softened and very slightly oversized at
 * first, resolving into a pixel-exact frame 1 exactly when the sequence starts.
 *
 * Nothing here runs on a clock: it is a scrubbed tween like everything else, so
 * it holds when the user holds and plays backwards on the way up.
 */
function addReveal(tl, canvas, gsap) {
  tl.fromTo(
    canvas,
    {
      autoAlpha: 0,
      scale: 1.045,
      filter: 'blur(7px) brightness(0.18) contrast(1.18)',
    },
    {
      autoAlpha: 1,
      scale: 1,
      filter: 'blur(0px) brightness(1) contrast(1)',
      duration: REVEAL_END,
      ease: 'power2.inOut',
    },
    0,
  );

  // drop the filter entirely past the reveal: a live blur(0px) on a full-bleed
  // canvas still costs a compositor pass on every scrolled frame
  tl.set(canvas, { filter: 'none' }, REVEAL_END);
}

/**
 * prefers-reduced-motion: collapse the hero to one screen and paint a single
 * representative frame (the last one, fully lit). Branding is shown outright,
 * so nobody has to scroll 280vh to reach it.
 */
function mountStatic(root, canvas, overlay, sequence) {
  root.classList.add('hero--static');

  // A one-frame sequence reuses all the cover/DPR/resize logic for free.
  const still = createFrameSequence(canvas, {
    count: 1,
    src: () => sequence.src(sequence.count - 1),
  });
  still.start();

  showRestingState(overlay);
  return () => still.destroy();
}
