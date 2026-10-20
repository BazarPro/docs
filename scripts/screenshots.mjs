/**
 * Erzeugt die Screenshots der Doku aus einer laufenden BazarPro-Instanz mit
 * Demo-Daten (Seed), auf Deutsch und Englisch. Niemals gegen Produktion laufen lassen.
 *
 *   BAZARPRO_URL=http://127.0.0.1:5199 \
 *   BAZARPRO_CONVEX_URL=http://127.0.0.1:3210 \
 *   npm run screenshots
 *
 * Deutsche Bilder landen in src/assets/screenshots/, englische in src/assets/screenshots/en/.
 */
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE_URL = (process.env.BAZARPRO_URL ?? 'http://127.0.0.1:5199').replace(/\/+$/, '');
const CONVEX_URL = (process.env.BAZARPRO_CONVEX_URL ?? 'http://127.0.0.1:3210').replace(/\/+$/, '');
const SCREENSHOT_DIR = path.resolve('src/assets/screenshots');
const PASSWORD = '123456';

if (/bazarpro\.de/.test(BASE_URL) && !/review-|localhost|127\.0\.0\.1/.test(BASE_URL)) {
  console.error(`Abbruch: ${BASE_URL} sieht nach Produktion aus. Nur Demo-Instanzen verwenden.`);
  process.exit(1);
}

/** Texts of the app the script clicks on, per language. */
const LOCALES = {
  de: {
    browser: 'de-DE',
    dir: SCREENSHOT_DIR,
    stopTour: 'Beenden',
    next: 'Weiter',
    kidsBazaar: 'Kinderbasar (Nummernbasar)',
    eventTitle: 'Titel der Veranstaltung *',
    location: 'Ort *',
    contact: 'Kontaktdaten / Veranstalter-Info *',
    summary: 'Alles im Blick',
    join: /Als Verkäufer beitreten/,
    itemCode: 'Artikel-Code',
    demo: {
      title: 'Kinderkleiderbasar Frühjahr 2027',
      description: 'Kinderkleidung, Spielzeug und Babyausstattung aus zweiter Hand.',
      location: 'Gemeindesaal St. Michael, Ulm',
      contact: 'basar@kita-sonnenschein.de',
    },
  },
  en: {
    browser: 'en-US',
    dir: path.join(SCREENSHOT_DIR, 'en'),
    stopTour: 'End',
    next: 'Next',
    kidsBazaar: "Children's bazaar (number bazaar)",
    eventTitle: 'Event title *',
    location: 'Location *',
    contact: 'Contact details / organizer info *',
    summary: 'Everything at a glance',
    join: /Join as a seller/,
    itemCode: 'Item code',
    demo: {
      title: "Kids' clothing bazaar spring 2027",
      description: 'Second-hand kids’ clothes, toys and baby gear.',
      location: 'St. Michael parish hall, Ulm',
      contact: 'bazaar@sunshine-daycare.org',
    },
  },
};

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

async function newPage(browser, lang) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
    locale: LOCALES[lang].browser,
    permissions: ['camera'],
  });
  await context.addInitScript((language) => {
    localStorage.setItem('bazarpro-theme', 'light');
    localStorage.setItem('bazarpro.language', language);
  }, lang);
  return context.newPage();
}

async function login(page, email, lang) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByTestId('button-login-submit').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
  // The account's language wins over the browser's: save the wanted one at the account
  await page.evaluate(
    async ({ convexUrl, locale }) => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('__convexAuthJWT'));
      const res = await fetch(`${convexUrl}/api/mutation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem(key)}`,
        },
        body: JSON.stringify({ path: 'users:setMyLocale', args: { locale }, format: 'json' }),
      });
      const body = await res.json();
      if (body.status !== 'success') throw new Error(`setMyLocale: ${body.errorMessage}`);
    },
    { convexUrl: CONVEX_URL, locale: lang }
  );
}

async function open(page, route, texts) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
  // An active onboarding tour would cover the page
  const stop = page.getByRole('button', { name: texts.stopTour, exact: true });
  if (await stop.isVisible().catch(() => false)) await stop.click();
  // The sticky app header would cover the top of element screenshots
  await page.addStyleTag({ content: 'header.sticky { position: relative !important; }' });
  await page.mouse.move(0, 0);
  await page.waitForTimeout(600);
}

async function shot(target, name, dir) {
  const file = path.join(dir, `${name}.png`);
  await target.screenshot({ path: file, animations: 'disabled' });
  console.log(`✓ ${path.relative(process.cwd(), file)}`);
}

/** Date in a datetime-local input, some days from now. */
function inDays(days, hour) {
  const date = new Date(Date.now() + days * 86_400_000);
  date.setHours(hour, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:00`;
}

async function organizer(browser, lang) {
  const texts = LOCALES[lang];
  const page = await newPage(browser, lang);
  await login(page, 'user1@bazarpro.de', lang);
  await open(page, '/my-events', texts);
  await shot(page, 'meine-veranstaltungen', texts.dir);

  // Creation wizard: kind of bazaar, then through to the summary
  await open(page, '/events/new', texts);
  await shot(page.locator('main'), 'basar-art', texts.dir);
  await page.getByRole('button', { name: new RegExp(texts.kidsBazaar.replace(/[()]/g, '\\$&')) }).click();
  await page.getByLabel(texts.eventTitle).fill(texts.demo.title);
  await page.locator('#description').fill(texts.demo.description);
  await page.getByLabel(texts.location).fill(texts.demo.location);
  await page.locator('#startDate').fill(inDays(30, 9));
  await page.locator('#endDate').fill(inDays(30, 14));
  const next = () => page.getByRole('button', { name: texts.next, exact: true }).click();
  await next(); // sale
  await next(); // fees
  await page.getByLabel(texts.contact).fill(texts.demo.contact);
  await next(); // items
  await next(); // registration
  await next(); // hand-in and pickup
  await next(); // summary
  await page.getByRole('heading', { name: texts.summary }).waitFor();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  await shot(page.locator('main'), 'basar-zusammenfassung', texts.dir);

  // Cash desk of the running showcase bazaar with three bikes in the cart
  const events = await convexQuery('events:get', {});
  const bikeEvent = events.find((e) => e.title.startsWith('Fahrradbörse Bürgerhalle'));
  if (!bikeEvent) throw new Error('Demo-Event "Fahrradbörse Bürgerhalle" fehlt – Seed ausgeführt?');
  const products = await convexQuery('eventProducts:getProductsForEvent', { eventId: bikeEvent._id });
  const available = products.filter((p) => p.status === 'available').slice(0, 3);
  await open(page, `/events/view/${bikeEvent._id}/checkout`, texts);
  const code = page.getByLabel(texts.itemCode);
  for (const product of available) {
    await code.fill(product._id);
    await code.press('Enter');
    await page.waitForTimeout(500);
  }
  await page.mouse.move(0, 0);
  await page.waitForTimeout(800);
  await shot(page.locator('main'), 'kasse', texts.dir);
  await page.context().close();
}

async function seller(browser, lang, sellerEvent) {
  const texts = LOCALES[lang];
  // Seller who has not joined the bazaar yet (the demo seller has)
  {
    const page = await newPage(browser, lang);
    await login(page, 'kaeufer1@bazarpro.de', lang);
    await open(page, `/public-events/${sellerEvent._id}`, texts);
    await shot(page, 'basar-seite-verkaeufer', texts.dir);
    const join = page.getByRole('button', { name: texts.join });
    if (await join.isVisible().catch(() => false)) {
      await join.click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      // Without focus there is no selected text in the first input
      await page.evaluate(() =>
        document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null
      );
      await shot(dialog, 'basar-beitreten-dialog', texts.dir);
      await page.keyboard.press('Escape');
    } else {
      console.warn('! Demo-Nutzer ist dem Event bereits beigetreten, Dialog übersprungen');
    }
    await page.context().close();
  }

  // Seller with items
  {
    const page = await newPage(browser, lang);
    await login(page, 'seller@bazarpro.de', lang);
    await open(page, '/products/new', texts);
    await shot(page.locator('form').first(), 'artikel-formular', texts.dir);
    await open(page, '/my-products', texts);
    await shot(page, 'meine-produkte', texts.dir);
    await page.context().close();
  }
}

/**
 * The cash desk shows the camera. Without one it shows an error, so Chromium gets a fake
 * camera: a still of the bike sale photo (needs ffmpeg), otherwise Chromium's test pattern.
 */
function fakeCameraArgs() {
  const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];
  const video = path.join(os.tmpdir(), 'bazarpro-docs-camera.y4m');
  try {
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-i', path.resolve('public/boerse.webp'),
      '-vf', 'scale=640:480:force_original_aspect_ratio=increase,crop=640:480',
      '-frames:v', '1', '-pix_fmt', 'yuv420p', video,
    ]);
    args.push(`--use-file-for-fake-video-capture=${video}`);
  } catch {
    console.warn('! ffmpeg fehlt, die Kasse zeigt das Testbild von Chromium');
  }
  return args;
}

async function main() {
  const events = await convexQuery('events:get', {});
  const sellerEvent = events.find((e) => e.title === 'Großer Winterflohmarkt 2026');
  if (!sellerEvent) throw new Error('Demo-Event "Großer Winterflohmarkt 2026" fehlt – Seed ausgeführt?');

  const browser = await chromium.launch({ args: fakeCameraArgs() });

  // Bike + phone scene from the landing page hero (without demo banner)
  // Lands in public/: Starlight's hero `image.file` would crop it to a 400x400 square
  {
    const page = await newPage(browser, 'de');
    await open(page, '/', LOCALES.de);
    await shot(
      page.locator('section:has(h1) div[aria-hidden="true"]').first(),
      'startseite-hero',
      path.resolve('public')
    );
    await page.context().close();
  }

  for (const lang of Object.keys(LOCALES)) {
    await mkdir(LOCALES[lang].dir, { recursive: true });
    await organizer(browser, lang);
    await seller(browser, lang, sellerEvent);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
