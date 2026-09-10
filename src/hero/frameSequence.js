import { LOADING, MAX_DPR } from './config.js';

/**
 * Paints `image` into `canvas` the way `object-fit: cover` would: fill the box,
 * preserve aspect ratio, crop the overflow, stay centred.
 */
export function drawImageCover(image, canvas, ctx, focusX = 0.5) {
  const cw = canvas.width;
  const ch = canvas.height;
  if (!cw || !ch || !image.naturalWidth) return;

  const scale = Math.max(cw / image.naturalWidth, ch / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  // focusX is `object-position` for a canvas: 0.5 centres the crop, lower values
  // keep the left of the frame — which is where the cable end and the panel are.
  ctx.drawImage(image, (cw - w) * focusX, (ch - h) / 2, w, h);
}

/**
 * A scroll-driven WebP frame sequence on a 2D canvas.
 *
 * Loading: frame 0 first, then a small eager batch, then the rest during idle
 * time. Seeking to a frame that has not landed yet paints the nearest loaded
 * neighbour and repaints when the real one arrives.
 */
export function createFrameSequence(canvas, sequence) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const { count, src } = sequence;

  const images = new Array(count); // Image objects, created at most once each
  const ready = new Array(count).fill(false);

  let wanted = 0; // frame index the scroll is asking for
  let painted = -1; // frame index actually on screen
  let rafId = 0;
  let destroyed = false;

  // ---------------------------------------------------------------- loading

  function load(i) {
    if (images[i]) return images[i]; // dedupe: one request per frame, ever
    const img = new Image();
    img.decoding = 'async';
    img.src = src(i);
    images[i] = img;
    img.addEventListener(
      'load',
      () => {
        ready[i] = true;
        if (i === wanted) requestDraw(); // the frame we were faking just arrived
      },
      { once: true },
    );
    img.addEventListener('error', () => console.warn(`[hero] frame ${i} failed: ${img.src}`), {
      once: true,
    });
    return img;
  }

  function decoded(img) {
    return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
  }

  /** Resolves once the first frame is painted — that's "hero is up". */
  async function start() {
    const first = load(0);
    if (!first.complete) await new Promise((r) => first.addEventListener('load', r, { once: true }));
    resize();

    // eager batch: enough to survive the first flick of the wheel
    await Promise.all(
      Array.from({ length: Math.min(LOADING.eager, count - 1) }, (_, k) => decoded(load(k + 1))),
    );
    idlePreload(LOADING.eager + 1);
  }

  const idle =
    window.requestIdleCallback ||
    ((cb) => setTimeout(() => cb({ timeRemaining: () => 8, didTimeout: false }), 32));

  function idlePreload(from) {
    if (destroyed || from >= count) return;
    idle(
      (deadline) => {
        let i = from;
        let budget = LOADING.chunk;
        while (i < count && budget > 0 && (deadline.didTimeout || deadline.timeRemaining() > 1)) {
          if (!images[i]) budget--;
          load(i);
          i++;
        }
        idlePreload(i);
      },
      { timeout: 500 },
    );
  }

  /** Nearest already-decoded frame to `i`, or -1 if literally nothing is up. */
  function nearestReady(i) {
    if (ready[i]) return i;
    for (let d = 1; d < count; d++) {
      if (i - d >= 0 && ready[i - d]) return i - d;
      if (i + d < count && ready[i + d]) return i + d;
    }
    return -1;
  }

  // --------------------------------------------------------------- painting

  function requestDraw() {
    if (rafId || destroyed) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      draw();
    });
  }

  function draw() {
    const i = nearestReady(wanted);
    if (i < 0 || i === painted) return; // nothing new to show — skip the paint
    drawImageCover(images[i], canvas, ctx, focusX());
    painted = i;
  }

  /**
   * A 16:9 frame cropped into a portrait viewport loses its edges. These frames
   * put the subject left of centre, so on a narrow screen hold that side.
   */
  function focusX() {
    return canvas.clientWidth / canvas.clientHeight < 1.1 ? 0.34 : 0.5;
  }

  /** progress 0 -> frame 1, progress 1 -> frame `count`. */
  function seek(progress) {
    const i = Math.min(count - 1, Math.max(0, Math.round(progress * (count - 1))));
    if (i === wanted && i === painted) return; // same frame, no work
    wanted = i;
    load(i); // jumped ahead of the preloader? fetch it now
    requestDraw();
  }

  // ----------------------------------------------------------------- sizing

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (!w || !h) return;
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    painted = -1; // the backing store was cleared by the resize (and the crop
    // focus may have changed with the new aspect ratio)
    requestDraw();
  }

  let resizeRaf = 0;
  function onResize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      resize();
    });
  }

  const ro = 'ResizeObserver' in window ? new ResizeObserver(onResize) : null;
  if (ro) ro.observe(canvas);
  else window.addEventListener('resize', onResize);

  function destroy() {
    destroyed = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    if (ro) ro.disconnect();
    else window.removeEventListener('resize', onResize);
    images.length = 0;
  }

  return { start, seek, destroy };
}
