import { initHero } from './hero/hero.js';
import { initNavbar } from './navbar/navbar.js';
import { initReveals } from './sections/reveals.js';
import { initCircuit } from './sections/circuit.js';
import { initMaterials } from './sections/materials.js';
import { initMarquee } from './sections/marquee.js';
import { initDepth } from './sections/depth.js';
import { initInstallation } from './sections/installation.js';
import { initServices } from './sections/services.js';
import { initSolutions } from './sections/solutions.js';
import { initContactForm } from './form/contactForm.js';

function boot() {
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  initNavbar(document.querySelector('[data-navbar]'));
  initHero(document.querySelector('[data-hero]'));
  initReveals();
  initMaterials();
  const disposeCircuit = initCircuit();
  const disposeInstallation = initInstallation();
  const disposeServices = initServices();
  const disposeSolutions = initSolutions();
  const onPageHide = (event) => {
    if (event.persisted) return;
    disposeCircuit();
    disposeInstallation();
    disposeServices();
    disposeSolutions();
    window.removeEventListener('pagehide', onPageHide);
  };
  window.addEventListener('pagehide', onPageHide);
  initMarquee();
  initDepth();
  initContactForm();

  // Webfonts and the first hero frame land after first layout and change how
  // tall things are. Re-measure the triggers, then land the anchor again: on a
  // direct /#seccion load the browser scrolled before any of that settled, so
  // it is now pointing at the wrong offset.
  window.addEventListener(
    'load',
    () => {
      window.ScrollTrigger?.refresh();

      const target = location.hash && document.querySelector(location.hash);
      if (target) {
        requestAnimationFrame(() =>
          target.scrollIntoView({ block: 'start', behavior: 'instant' }),
        );
      }
    },
    { once: true },
  );
}

// module scripts run after `defer` scripts, but be explicit about needing GSAP
if (window.gsap) boot();
else window.addEventListener('load', boot, { once: true });
