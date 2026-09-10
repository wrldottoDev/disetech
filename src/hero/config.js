/**
 * Single place to tune the hero.
 *
 * Scroll DISTANCE is NOT here on purpose: it lives in CSS as `--hero-scroll`
 * (src/styles.css) so the layout and ScrollTrigger can never disagree.
 */

const pad = (n) => String(n).padStart(4, '0');

/** A frame sequence descriptor. Add `mobile` here when the 9:16 frames exist. */
export const SEQUENCES = {
  desktop: {
    count: 121,
    // 1918x1080 source frames
    src: (i) => `assets/frames/desktop/frame_${pad(i + 1)}.webp`,
  },
  // mobile: { count: 121, src: (i) => `assets/frames/mobile/frame_${pad(i + 1)}.webp` },
  mobile: null,
};

/** Which sequence to use for the current viewport. */
const MOBILE_QUERY = '(max-width: 767px)';

export function pickSequence() {
  if (SEQUENCES.mobile && window.matchMedia(MOBILE_QUERY).matches) {
    return SEQUENCES.mobile;
  }
  return SEQUENCES.desktop;
}

export const LOADING = {
  /** Frames fetched up-front, before the hero is declared ready. */
  eager: 10,
  /** Frames pulled per idle slice while the rest streams in. */
  chunk: 4,
};

/** Retina cap. 2 is plenty for a full-bleed photo; 3 just burns fill rate. */
export const MAX_DPR = 2;

/**
 * Fraction of the hero scroll spent lifting frame 1 out of the dark before the
 * sequence starts moving. THE knob for how long the intro lasts.
 * Raise it for a slower emergence, lower it to get to the cable sooner.
 */
export const REVEAL_END = 0.15;

/**
 * Hero progress -> frame-sequence progress.
 * Everything below REVEAL_END holds on frame 1 (which is busy fading in), and
 * the remaining scroll is stretched over the full 121 frames, so the sequence
 * picks up exactly where the reveal finishes with no jump.
 */
export function frameProgress(progress) {
  if (progress <= REVEAL_END) return 0;
  return (progress - REVEAL_END) / (1 - REVEAL_END);
}

/**
 * Copy beats, as frame-sequence progress ranges (0 = frame 1, 1 = frame 121).
 * `id` matches a `data-beat` attribute in index.html.
 * The last beat never fades out — it is the resting hero.
 */
export const BEATS = [
  { id: 'frase', start: 0.0, end: 0.78 },
  { id: 'brand', start: 0.8, end: 1.0, hold: true },
];

/**
 * The sentence assembles one line at a time and then holds whole, so it reads
 * as a single statement rather than three slogans. Values are progress points
 * inside the `frase` beat's own range.
 */
export const PHRASE_LINES = [
  { id: 'energia', at: 0.06 },
  { id: 'para-cada', at: 0.3 },
  { id: 'proyecto', at: 0.54 },
];
