const DESKTOP = '(min-width: 900px)';

/**
 * Fixed bar that grows a surface once the page moves, plus the mobile menu.
 *
 * The menu is a real `<dialog>` opened with `showModal()`: focus trap, Escape
 * and an inert page behind it come from the platform. Its open/close motion is
 * CSS (`@starting-style`), and `html:has(.menu[open])` holds the page still.
 */
export function initNavbar(nav) {
  if (!nav) return;
  const toggle = nav.querySelector('[data-nav-toggle]');
  const menu = nav.querySelector('[data-nav-menu]');

  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 16);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  toggle.addEventListener('click', () => {
    menu.showModal();
    toggle.setAttribute('aria-expanded', 'true');
  });

  menu.addEventListener('close', () => toggle.setAttribute('aria-expanded', 'false'));

  // a link, the X, or a tap outside the panel — the menu has done its job
  menu.addEventListener('click', (event) => {
    if (event.target === menu || event.target.closest('a, [data-nav-close]')) menu.close();
  });

  // grown past the hamburger while the menu is open? put it away
  window.matchMedia(DESKTOP).addEventListener('change', (event) => {
    if (event.matches && menu.open) menu.close();
  });
}
