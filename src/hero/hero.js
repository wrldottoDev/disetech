const REDUCED = '(prefers-reduced-motion: reduce)';

/** The still the hero rests on when the video does not play. */
const LAST_FRAME = 'assets/frames/desktop/frame_0121.webp';

/**
 * The hero film plays once, cable to panel, and stays on its last frame.
 *
 * The video sits at opacity 0 (CSS) until `.is-ready`, added in the frame
 * playback actually starts — so it rises out of the dark instead of flashing
 * a poster first. Reduced motion, or a browser that refuses autoplay (iOS low
 * power mode), gets the last frame as a still instead.
 */
export function initHero(root) {
  const video = root?.querySelector('[data-hero-video]');
  if (!video) return;

  const ready = () => root.classList.add('is-ready');
  const still = () => {
    video.poster = LAST_FRAME;
    video.preload = 'none';
    ready();
  };

  if (window.matchMedia(REDUCED).matches) {
    still();
    return;
  }

  video.addEventListener('playing', ready, { once: true });
  video.addEventListener('ended', () => root.classList.add('is-ended'), { once: true });
  video.play().catch(still);
}
