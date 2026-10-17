/**
 * pnpm exec playwright test
 *
 * Every interaction on the landing, in Chromium and WebKit, desktop and phone.
 * The form test posts to the real /api/contact; playwright.config.js starts the
 * server without SMTP so the request is parked in data/, never emailed.
 */
import { test, expect } from '@playwright/test';

const SECTIONS = {
  materiales: 'Materiales',
  servicios: 'Servicios',
  soluciones: 'Soluciones',
  nosotros: 'Nosotros',
  contacto: 'Contacto',
};

/** Walk the page top to bottom so lazy images load and every reveal fires. */
async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  });
}

async function fillValid(page) {
  await page.locator('#nombre').fill('Prueba Automática');
  await page.locator('#email').fill('prueba@example.com');
  await page.locator('#telefono').fill('+506 8888 8888');
  await page.locator('#tipo').selectOption('otro');
  await page.locator('#mensaje').fill('Mensaje de prueba automática del formulario.');
  await page.locator('#consent').check();
}

test('recorre la página: sin errores, sin recursos rotos, todo visible', async ({ page }) => {
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (msg) => msg.type() === 'error' && problems.push(msg.text()));
  page.on('response', (res) => res.status() >= 400 && problems.push(`${res.status()} ${res.url()}`));

  await page.goto('/');
  await scrollThrough(page);

  // every image that is actually rendered has loaded
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.images]
          .filter((img) => img.getClientRects().length && (!img.complete || !img.naturalWidth))
          .map((img) => img.currentSrc || img.src),
      ),
    )
    .toEqual([]);
  await expect(page.locator('[data-reveal]:not(.is-revealed)')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  // the self-hosted Archivo is what renders, not the fallback
  expect(
    await page.evaluate(() => [...document.fonts].some((f) => f.family.includes('Archivo') && f.status === 'loaded')),
  ).toBe(true);
  expect(problems).toEqual([]);
});

test('servidor: publica el sitio y nada más', async ({ request }) => {
  for (const path of ['/', '/index.html', '/src/main.js', '/src/styles.css', '/assets/fonts/archivo-latin.woff2']) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
  for (const path of ['/server.js', '/package.json', '/server/contact.js', '/tests/site.spec.js', '/.env', '/src/../server.js', '/frames/desktop/frame_0002.webp']) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});

test('hero: el video se reproduce una vez y queda en el tablero', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('[data-hero]');
  await expect(hero).toHaveClass(/is-ready/);
  await expect(hero).toHaveClass(/is-ended/, { timeout: 15_000 });
  expect(await page.locator('[data-hero-video]').evaluate((video) => video.loop)).toBe(false);
});

test('navegación: cada enlace lleva a su sección', async ({ page, isMobile }) => {
  await page.goto('/');
  const menu = page.locator('#menu');

  for (const [id, label] of Object.entries(SECTIONS)) {
    if (isMobile) {
      await page.getByRole('button', { name: 'Abrir menú' }).click();
      await expect(menu).toBeVisible();
      await menu.getByRole('link', { name: label, exact: true }).click();
      await expect(menu).toBeHidden();
    } else {
      await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: label }).click();
    }
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(page.locator(`#${id}-title`)).toBeInViewport();
  }
  await expect(page.locator('[data-nav]')).toHaveClass(/is-scrolled/);
});

test('menú móvil: abre, bloquea el fondo y cierra con Escape y con la X', async ({ page, isMobile }) => {
  const toggle = page.getByRole('button', { name: 'Abrir menú' });
  await page.goto('/');

  if (!isMobile) {
    await expect(toggle).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();
    return;
  }

  const menu = page.locator('#menu');
  await toggle.click();
  await expect(menu).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await toggle.click();
  await page.getByRole('button', { name: 'Cerrar menú' }).click();
  await expect(menu).toBeHidden();

  await toggle.click();
  await menu.getByRole('link', { name: 'Solicitar cotización' }).click();
  await expect(menu).toBeHidden();
  await expect(page).toHaveURL(/#contacto$/);
});

test('cotizar: cada enlace precarga el tipo y el tema sin pisar lo escrito', async ({ page }) => {
  await page.goto('/');
  const tipo = page.locator('#tipo');
  const mensaje = page.locator('#mensaje');

  await page.locator('.breaker', { hasText: 'Iluminación' }).click();
  await expect(page).toHaveURL(/#contacto$/);
  await expect(tipo).toHaveValue('materiales');
  await expect(mensaje).toHaveValue('Consulta sobre: Iluminación. ');

  await mensaje.fill('');
  await page.getByRole('link', { name: 'Cotizar instalación' }).click();
  await expect(tipo).toHaveValue('instalacion');
  await expect(mensaje).toHaveValue('Consulta sobre: Instalaciones eléctricas. ');

  await mensaje.fill('Necesito 20 breakers de 20 A.');
  await page.getByRole('link', { name: 'Cotizar proyecto comercial' }).click();
  await expect(tipo).toHaveValue('comercial');
  await expect(mensaje).toHaveValue('Necesito 20 breakers de 20 A.');
});

test('formulario: marca los errores y los limpia al corregir', async ({ page }) => {
  await page.goto('/#contacto');
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();

  await expect(page.locator('[data-status]')).toHaveText('Revisá los campos marcados.');
  for (const name of ['nombre', 'email', 'telefono', 'tipo', 'mensaje']) {
    await expect(page.locator(`#${name}`)).toHaveAttribute('aria-invalid', 'true');
  }
  await expect(page.locator('#nombre')).toBeFocused();
  await expect(page.locator('#err-email')).toHaveText('Ingresá un correo válido.');

  await page.locator('#email').fill('ana@');
  await expect(page.locator('#err-email')).toHaveText('Ingresá un correo válido.');
  await page.locator('#email').fill('ana@example.com');
  await expect(page.locator('#err-email')).toHaveText('');
  await expect(page.locator('#email')).toHaveAttribute('aria-invalid', 'false');
});

test('formulario: envía la solicitud al servidor', async ({ page }) => {
  await page.goto('/#contacto');
  await fillValid(page);

  const response = page.waitForResponse('**/api/contact');
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  expect((await response).status()).toBe(200);

  await expect(page.locator('[data-status]')).toHaveText(/^Solicitud enviada/);
  await expect(page.locator('#nombre')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Enviar solicitud' })).toBeEnabled();
});

test('formulario: si el servidor falla, avisa y conserva lo escrito', async ({ page }) => {
  await page.route('**/api/contact', (route) => route.fulfill({ status: 502, body: '{}' }));
  await page.goto('/#contacto');
  await fillValid(page);
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();

  await expect(page.locator('[data-status]')).toHaveText('No pudimos enviar tu solicitud. Intentá nuevamente.');
  await expect(page.locator('#nombre')).toHaveValue('Prueba Automática');
  await expect(page.getByRole('button', { name: 'Enviar solicitud' })).toBeEnabled();
});

test('enlaces: anclas existen, externos abren aparte, correo correcto', async ({ page, isMobile, browserName }) => {
  await page.goto('/');

  const anchors = await page.locator('a[href^="#"]').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
  for (const href of new Set(anchors)) {
    await expect(page.locator(href), href).toHaveCount(1);
  }

  for (const link of await page.locator('a[href^="http"]').all()) {
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  }

  const mails = await page.locator('a[href^="mailto:"]').evaluateAll((links) => links.map((a) => a.href));
  expect(new Set(mails)).toEqual(new Set(['mailto:info@disetechcr.com']));

  // keyboard users land on the skip link first (no Tab on a touch screen;
  // Safari only tabs to links with Option held)
  if (!isMobile) {
    await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  }
});

test('servicios: la imagen fija sigue al paso visible', async ({ page, isMobile }) => {
  test.skip(isMobile, 'en móvil cada servicio lleva su propia imagen');
  await page.goto('/');
  const steps = page.locator('[data-service]');
  const images = page.locator('[data-service-img]');

  for (const i of [1, 2, 0]) {
    await steps.nth(i).evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect(steps.nth(i)).toHaveClass(/is-active/);
    await expect(images.nth(i)).toHaveClass(/is-active/);
  }
});

test('movimiento reducido: todo visible y el hero quieto', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  await expect(page.locator('[data-hero]')).toHaveClass(/is-ready/);
  expect(await page.locator('[data-hero-video]').evaluate((video) => video.paused)).toBe(true);
  await expect(page.locator('[data-reveal]:not(.is-revealed)')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/js-reveals/);
});
