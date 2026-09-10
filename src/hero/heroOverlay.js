import { BEATS, PHRASE_LINES, REVEAL_END } from './config.js';

/**
 * Builds the scrubbed copy timeline. Duration is normalised to 1 so positions
 * read as raw hero progress.
 *
 * BEATS are authored against the frame sequence (0 = frame 1, 1 = frame 121),
 * so they get pushed past the reveal here. Change REVEAL_END and the copy
 * follows on its own.
 */
export function buildOverlayTimeline(root, gsap) {
  const tl = gsap.timeline();
  tl.to({}, { duration: 1 }, 0); // pin the timeline length to 1

  const afterReveal = (p) => REVEAL_END + p * (1 - REVEAL_END);

  // the scroll cue has done its job as soon as the scene starts emerging
  const hint = root.querySelector('[data-hero-hint]');
  if (hint) {
    tl.to(hint, { autoAlpha: 0, duration: REVEAL_END * 0.5, ease: 'none' }, REVEAL_END * 0.15);
  }

  for (const beat of BEATS) {
    const el = root.querySelector(`[data-beat="${beat.id}"]`);
    if (!el) continue;

    const start = afterReveal(beat.start);
    const end = afterReveal(beat.end);
    const fade = (end - start) * 0.34;

    tl.fromTo(
      el,
      { autoAlpha: 0, y: 26, filter: 'blur(7px)' },
      { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: fade, ease: 'power2.out' },
      start,
    );

    if (!beat.hold) {
      tl.to(
        el,
        { autoAlpha: 0, y: -22, filter: 'blur(7px)', duration: fade, ease: 'power2.in' },
        end - fade,
      );
    }
  }

  addPhrase(tl, root, gsap, afterReveal);

  return tl;
}

/**
 * "Energía / para cada / proyecto." — the lines wipe up from behind their masks
 * one at a time and then STAY, so by the last one the whole sentence is on
 * screen at once. That is what keeps it a sentence instead of three slogans.
 */
function addPhrase(tl, root, gsap, afterReveal) {
  const beat = BEATS.find((b) => b.id === 'frase');
  if (!beat) return;

  const span = beat.end - beat.start;

  for (const line of PHRASE_LINES) {
    const el = root.querySelector(`[data-phrase-line="${line.id}"]`);
    if (!el) continue;

    tl.fromTo(
      el,
      { yPercent: 108, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: span * 0.16, ease: 'power3.out' },
      afterReveal(beat.start + span * line.at),
    );
  }
}

/** Reduced motion / no-JS-animation path: show the resting hero, hide the beats. */
export function showRestingState(root) {
  for (const beat of BEATS) {
    const el = root.querySelector(`[data-beat="${beat.id}"]`);
    if (el) el.classList.toggle('is-visible', Boolean(beat.hold));
  }
}
