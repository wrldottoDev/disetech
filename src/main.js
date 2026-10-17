import { initNavbar } from './navbar/navbar.js';
import { initReveals } from './sections/reveals.js';
import { initServices } from './sections/services.js';
import { initContactForm } from './form/contactForm.js';

const year = document.querySelector('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());

initNavbar(document.querySelector('[data-nav]'));
initReveals();
initServices(document.querySelector('[data-services]'));
initContactForm();
