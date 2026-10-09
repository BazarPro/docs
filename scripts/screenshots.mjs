/**
 * Erzeugt die Screenshots der Doku aus einer laufenden BazarPro-Instanz mit
 * Demo-Daten (Seed). Niemals gegen Produktion laufen lassen.
 *
 *   BAZARPRO_URL=http://127.0.0.1:5199 \
 *   BAZARPRO_CONVEX_URL=http://127.0.0.1:3210 \
 *   npm run screenshots
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE_URL = (process.env.BAZARPRO_URL ?? 'http://127.0.0.1:5199').replace(/\/+$/, '');
const CONVEX_URL = (process.env.BAZARPRO_CONVEX_URL ?? 'http://127.0.0.1:3210').replace(/\/+$/, '');
const OUT_DIR = path.resolve('src/assets/screenshots');
const PASSWORD = '123456';

if (/bazarpro\.de/.test(BASE_URL) && !/review-|localhost|127\.0\.0\.1/.test(BASE_URL)) {
  console.error(`Abbruch: ${BASE_URL} sieht nach Produktion aus. Nur Demo-Instanzen verwenden.`);
  process.exit(1);
}

async function convexQuery(fn, args) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: fn, args, format: 'json' }),
  });
  const body = await res.json();
  if (body.status !== 'success') throw new Error(`${fn}: ${body.errorMessage}`);
  return body.value;
}

async function newPage(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
    locale: 'de-DE',
  });
  await context.addInitScript(() => localStorage.setItem('bazarpro-theme', 'light'));
  return context.newPage();
}

async function login(page, email) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.getByRole('textbox', { name: 'E-Mail-Adresse' }).fill(email);
  await page.getByRole('textbox', { name: 'Passwort' }).fill(PASSWORD);
  await page.getByTestId('button-login-submit').click();
  await page.waitForURL('**/browse-events', { timeout: 20_000 });
}

async function open(page, route) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
  // An active onboarding tour would cover the page
  const stop = page.getByRole('button', { name: 'Beenden' });
  if (await stop.isVisible().catch(() => false)) await stop.click();
  // The sticky app header would cover the top of element screenshots
  await page.addStyleTag({ content: 'header.sticky { position: relative !important; }' });
  await page.waitForTimeout(600);
}

async function shot(target, name, dir = OUT_DIR) {
  const file = path.join(dir, `${name}.png`);
  await target.screenshot({ path: file, animations: 'disabled' });
  console.log(`✓ ${name}`);
}

/** Form card (bordered box) that contains the given heading. */
function section(page, heading) {
  return page
    .locator('div.bg-card', { has: page.getByRole('heading', { name: heading, exact: true }) })
    .last();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const events = await convexQuery('events:get', {});
  const sellerEvent = events.find((e) => e.title === 'Großer Winterflohmarkt 2026');
  if (!sellerEvent) throw new Error('Demo-Event "Großer Winterflohmarkt 2026" fehlt – Seed ausgeführt?');

  const browser = await chromium.launch();

  // Öffentlich
  {
    const page = await newPage(browser);
    await open(page, '/');
    // Bike + phone scene from the landing page hero (without demo banner)
    // Lands in public/: Starlight's hero `image.file` would crop it to a 400x400 square
    await shot(
      page.locator('section:has(h1) div[aria-hidden="true"]').first(),
      'startseite-hero',
      path.resolve('public')
    );
    await page.context().close();
  }

  // Veranstalter
  {
    const page = await newPage(browser);
    await login(page, 'user1@bazarpro.de');
    await open(page, '/my-events');
    await shot(page, 'meine-veranstaltungen');
    await open(page, '/events/new');
    for (const [heading, name] of [
      ['Grundinformationen', 'basar-grundinformationen'],
      ['Kategorien & Services', 'basar-kategorien'],
      ['Zugang & Einschränkungen', 'basar-zugang'],
      ['Kontakt & Finanzen', 'basar-kontakt-provision'],
      ['Lageplan und Standortkategorien', 'basar-lageplan'],
    ]) {
      await shot(section(page, heading), name);
    }
    await page.context().close();
  }

  // Verkäufer
  {
    const page = await newPage(browser);
    await login(page, 'seller@bazarpro.de');
    await open(page, `/public-events/${sellerEvent._id}`);
    await shot(page, 'basar-seite-verkaeufer');
    const join = page.getByRole('button', { name: /Als Verkäufer beitreten/ });
    if (await join.isVisible().catch(() => false)) {
      await join.click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      // Without focus there is no selected text in the first input
      await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null));
      await shot(dialog, 'basar-beitreten-dialog');
      await page.keyboard.press('Escape');
    } else {
      console.warn('! Demo-Verkäufer ist dem Event bereits beigetreten, Dialog übersprungen');
    }
    await open(page, '/products/new');
    await shot(page.locator('form').first(), 'artikel-formular');
    await open(page, '/my-products');
    await shot(page, 'meine-produkte');
    await page.context().close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
