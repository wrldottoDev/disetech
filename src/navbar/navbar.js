const REDUCED = '(prefers-reduced-motion: reduce)';
const DESKTOP = '(min-width: 900px)';

/**
 * Fixed navbar: transparent over the dark hero, growing a translucent surface
 * as the page scrolls, plus a `<dialog>`-based mobile menu.
 *
 * The mobile menu is a real `<dialog>` opened with `showModal()` — that buys
 * the focus trap, Escape-to-close and inert background from the platform
 * instead of from a library.
 */
export function initNavbar(nav) {
  const { gsap, ScrollTrigger } = window;
  const surface = nav.querySelector('[data-nav-surface]');
  const dialog = nav.querySelector('[data-nav-menu]');
  const panel = dialog.querySelector('[data-nav-panel]');
  const toggle = nav.querySelector('[data-nav-toggle]');
  const reduced = window.matchMedia(REDUCED);
  const desktop = window.matchMedia(DESKTOP);

  // ------------------------------------------------------- scrolled surface

  const surfaceTrigger = ScrollTrigger.create({
    animation: gsap.fromTo(surface, { opacity: 0 }, { opacity: 1, ease: 'none' }),
    start: 0,
    end: 160, // px of scroll to go from bare to fully backed
    scrub: true,
  });

  // ------------------------------------------------------------ mobile menu

  let restoreOverflow = '';

  function open() {
    if (dialog.open) return;
    restoreOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    toggle.setAttribute('aria-expanded', 'true');
    if (!reduced.matches) {
      // opacity, never autoAlpha: autoAlpha would set visibility:hidden for the
      // first frame and showModal() would find nothing to focus
      gsap.fromTo(
        panel,
        { yPercent: -8, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.32, ease: 'power2.out' },
      );
    }
  }

  function close() {
    if (!dialog.open) return;
    toggle.setAttribute('aria-expanded', 'false');

    const finish = () => {
      if (dialog.open) dialog.close();
      release();
      toggle.focus({ preventScroll: true });
    };
    if (reduced.matches) {
      finish();
      return;
    }

    gsap.to(panel, {
      yPercent: -6,
      opacity: 0,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: finish,
    });
    // GSAP runs on rAF, which a backgrounded tab pauses. Without this the menu
    // could be left open with the body still scroll-locked.
    setTimeout(finish, 400);
  }

  const onToggle = () => (dialog.open ? close() : open());

  // Escape fires `cancel` first — take it over so the panel animates out
  const onCancel = (event) => {
    event.preventDefault();
    close();
  };

  // clicking the dark area outside the panel closes it
  const onDialogClick = (event) => {
    if (event.target === dialog) close();
  };

  // a link or the X — either way the menu has done its job
  const onPanelClick = (event) => {
    if (event.target.closest('a, [data-nav-close]')) close();
  };

  /**
   * Undo everything `open()` did. Idempotent, and called straight from close()
   * rather than only from the dialog's `close` event: that event is queued as a
   * task, so waiting for it can leave the body scroll-locked in the meantime.
   */
  function release() {
    document.body.style.overflow = restoreOverflow;
    gsap.set(panel, { clearProps: 'all' });
    toggle.setAttribute('aria-expanded', 'false');
  }

  // safety net for a close that did not come through close() at all
  const onClosed = () => release();

  // grown past the hamburger while the menu is open? put it away
  const onBreakpoint = (event) => {
    if (event.matches) close();
  };

  toggle.addEventListener('click', onToggle);
  dialog.addEventListener('cancel', onCancel);
  dialog.addEventListener('click', onDialogClick);
  dialog.addEventListener('close', onClosed);
  panel.addEventListener('click', onPanelClick);
  desktop.addEventListener('change', onBreakpoint);

  return () => {
    surfaceTrigger.kill();
    toggle.removeEventListener('click', onToggle);
    dialog.removeEventListener('cancel', onCancel);
    dialog.removeEventListener('click', onDialogClick);
    dialog.removeEventListener('close', onClosed);
    panel.removeEventListener('click', onPanelClick);
    desktop.removeEventListener('change', onBreakpoint);
    if (dialog.open) dialog.close();
  };
}
