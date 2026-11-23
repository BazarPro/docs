/**
 * Erzeugt die Screenshots der Doku aus einer laufenden BazarPro-Instanz mit
 * Demo-Daten (Seed), auf Deutsch und Englisch. Niemals gegen Produktion laufen lassen.
 *
 *   BAZARPRO_URL=http://127.0.0.1:5199 npm run screenshots
 *
 * Deutsche Bilder landen in src/assets/screenshots/, englische in src/assets/screenshots/en/.
 */
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE_URL = (process.env.BAZARPRO_URL ?? 'http://127.0.0.1:5199').replace(/\/+$/, '');
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
    kidsBazaar: 'Kinderbasar',
    eventTitle: 'Titel des Basars *',
    location: 'Veranstaltungsort *',
    contact: 'Kontaktdaten / Veranstalter-Info *',
    summary: 'So sieht dein Basar aus',
    join: /Als Verkäufer anmelden/,
    itemCode: 'Artikel-Code',
    add: 'Hinzufügen',
    print: 'Drucken',
    invite: 'Per E-Mail einladen',
    settlement: 'Abrechnung',
    inviteEmail: 'anna.beispiel@example.org',
    moreFor: (name) => `Weitere Aktionen für ${name}`,
    appointHelper: 'Helfer ernennen',
    addItems: 'Artikel hinzufügen',
    importCsv: 'Aus CSV-Datei importieren',
    csv: 'Artikel;Preis;Zustand\nKinderrad Puky 16 Zoll;35;Gebraucht\nKinderrad Cube 20 Zoll;89;Wie neu\nJugendrad Ghost 24 Zoll;149;Gebraucht\nJugendrad Scott 26 Zoll;179;Neu\n',
    bikes: 'Fahrräder',
    kidsBikes: 'Kinder- & Jugendräder',
    demo: {
      title: 'Kinderkleiderbasar Frühjahr 2027',
      description: 'Kinderkleidung, Spielzeug und Babyausstattung aus zweiter Hand.',
      location: 'Gemeindesaal St. Michael',
      street: 'Münsterplatz 1',
      contact: 'basar@kita-sonnenschein.de',
    },
  },
  en: {
    browser: 'en-US',
    dir: path.join(SCREENSHOT_DIR, 'en'),
    stopTour: 'End',
    next: 'Next',
    kidsBazaar: "Children's bazaar",
    eventTitle: 'Bazaar title *',
    location: 'Venue *',
    contact: 'Contact details / organizer info *',
    summary: 'This is your bazaar',
    join: /Register as a seller/,
    itemCode: 'Item code',
    add: 'Add',
    print: 'Print',
    invite: 'Invite by email',
    settlement: 'Settlement',
    inviteEmail: 'anna.example@example.org',
    moreFor: (name) => `More actions for ${name}`,
    appointHelper: 'Make helper',
    addItems: 'Add items',
    importCsv: 'Import from a CSV file',
    csv: 'Item;Price;Condition\nKids bike Puky 16 inch;35;Used\nKids bike Cube 20 inch;89;Like new\nYouth bike Ghost 24 inch;149;Used\nYouth bike Scott 26 inch;179;New\n',
    bikes: 'Bikes',
    kidsBikes: "Children's & youth bikes",
    demo: {
      title: "Kids' clothing bazaar spring 2027",
      description: 'Second-hand kids’ clothes, toys and baby gear.',
      location: 'St. Michael parish hall',
      street: 'Münsterplatz 1',
      contact: 'bazaar@sunshine-daycare.org',
    },
  },
};

/** A query of the backend without sign-in, e.g. `events.getPublicEvents`. */
async function apiQuery(fn, args) {
  const res = await fetch(`${BASE_URL}/api/query/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args ?? {}),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${fn}: ${body.message ?? res.status}`);
  return body.value;
}

async function newPage(browser, lang, viewport = { width: 1280, height: 800 }) {
  const context = await browser.newContext({
    viewport,
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
  // The session cookie of the sign-in goes along: the backend answers under the app's origin
  const res = await page.request.post(`${BASE_URL}/api/mutation/users.setMyLocale`, {
    data: { locale: lang },
  });
  if (!res.ok()) throw new Error(`setMyLocale: ${res.status()} ${await res.text()}`);
}

async function open(page, route, texts) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
  // An active onboarding tour would cover the page
  const stop = page.getByRole('button', { name: texts.stopTour, exact: true });
  if (await stop.isVisible().catch(() => false)) await stop.click();
  // Sticky header and action bar would lie across element screenshots
  await page.addStyleTag({ content: '.sticky { position: relative !important; top: auto !important; bottom: auto !important; }' });
  await page.mouse.move(0, 0);
  await page.waitForTimeout(600);
}

async function shot(target, name, dir) {
  const file = path.join(dir, `${name}.png`);
  await target.screenshot({ path: file, animations: 'disabled' });
  console.log(`✓ ${path.relative(process.cwd(), file)}`);
}

/** Day in a date input, some days from now. */
function inDays(days) {
  const date = new Date(Date.now() + days * 86_400_000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
  await page.getByRole('button', { name: new RegExp(`^${texts.kidsBazaar}`) }).click();
  const next = () => page.getByRole('button', { name: texts.next, exact: true }).click();
  const step = async (name) => {
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    await shot(page.locator('main'), name, texts.dir);
  };
  // The kind of bazaar leads straight to "When and where?": the other times follow the date
  await page.locator('#title').fill(texts.demo.title);
  await page.locator('#startDay').fill(inDays(30));
  await page.locator('#startTime').fill('09:00');
  await page.locator('#endTime').fill('14:00');
  await page.locator('#location').fill(texts.demo.location);
  await page.locator('#street').fill(texts.demo.street);
  await page.locator('#postalCode').fill('89073');
  await page.locator('#city').fill('Ulm');
  await page.locator('#city').blur();
  await step('wizard-termin');
  await next();
  await step('wizard-verkauf');
  await next();
  await step('wizard-artikel');
  await next();
  await step('wizard-gebuehren');
  await next();
  await step('wizard-mitmachen');
  await next();
  await step('wizard-abgabe');
  await next();
  await page.locator('#description').fill(texts.demo.description);
  await page.getByLabel(texts.contact).fill(texts.demo.contact);
  await page.getByLabel(texts.contact).blur();
  await step('wizard-beschreibung');
  await next();
  await page.getByRole('heading', { name: texts.summary }).waitFor();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  await shot(page.locator('main'), 'basar-zusammenfassung', texts.dir);

  // Cash desk of the running showcase bazaar with three bikes in the cart
  const events = await apiQuery('events.get', {});
  const bikeEvent = events.find((e) => e.title.startsWith('Fahrradbörse Bürgerhalle'));
  if (!bikeEvent) throw new Error('Demo-Event "Fahrradbörse Bürgerhalle" fehlt – Seed ausgeführt?');
  const products = await apiQuery('eventProducts.getProductsForEvent', { eventId: bikeEvent._id });
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

  // Overview with the next steps of the bazaar
  await open(page, `/events/view/${bikeEvent._id}`, texts);
  await shot(page, 'basar-uebersicht', texts.dir);

  // Sellers: both menus, and the invitation
  await open(page, `/events/view/${bikeEvent._id}/sellers`, texts);
  const menu = (name) => page.getByRole('button', { name, exact: true }).click();
  await menu(texts.print);
  await page.getByRole('menu').waitFor();
  await shot(page, 'verkaeufer-drucken', texts.dir);
  await page.keyboard.press('Escape');
  await menu(texts.add);
  await page.getByRole('menu').waitFor();
  await shot(page, 'verkaeufer-hinzufuegen', texts.dir);
  await page.getByRole('menuitem', { name: texts.invite }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await dialog.locator('input[type="email"]').fill(texts.inviteEmail);
  await page.evaluate(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null
  );
  await page.waitForTimeout(300);
  await shot(dialog, 'einladen-dialog', texts.dir);
  await page.keyboard.press('Escape');

  // Settlement of a seller who sold something, with the print menu open
  const res = await page.request.post(`${BASE_URL}/api/query/eventRoles.getVendorsForEvent`, {
    data: { eventId: bikeEvent._id },
  });
  const vendors = (await res.json()).value;
  const vendor = vendors.find((v) => v.totalRevenue > 0);
  if (!vendor) throw new Error('Demo-Verkäufer mit Verkäufen fehlt – Seed ausgeführt?');
  await open(page, `/events/view/${bikeEvent._id}/products?vendor=${vendor._id}`, texts);
  await page.getByRole('tab', { name: texts.settlement, exact: true }).click();
  await menu(texts.print);
  await page.getByRole('menu').waitFor();
  await page.waitForTimeout(400);
  await shot(page, 'verkaeufer-abrechnung', texts.dir);
  await page.keyboard.press('Escape');

  // What a helper may do at the bazaar: the dialog of the appointment, closed unsaved
  const helper = vendors.find((v) => !v.isHelper && !v.managedByEventId && v.totalRevenue > 0);
  if (!helper) throw new Error('Demo-Verkäufer mit Konto fehlt – Seed ausgeführt?');
  await open(page, `/events/view/${bikeEvent._id}/products?vendor=${helper._id}`, texts);
  await page.getByRole('button', { name: texts.moreFor(helper.name) }).click();
  await page.getByRole('menuitem', { name: texts.appointHelper }).click();
  const helperDialog = page.getByRole('alertdialog');
  await helperDialog.waitFor();
  await page.waitForTimeout(400);
  await shot(helperDialog, 'helfer-rechte', texts.dir);
  await page.keyboard.press('Escape');

  // Items of a seller without account from a shop's list
  const walkIn = vendors.find((v) => v.managedByEventId === bikeEvent._id && !v.paid);
  if (!walkIn) throw new Error('Demo-Verkäufer ohne Konto fehlt – Seed ausgeführt?');
  // Tall enough for the whole dialog with its preview
  await page.setViewportSize({ width: 1280, height: 1500 });
  await open(page, `/events/view/${bikeEvent._id}/products?vendor=${walkIn._id}`, texts);
  await menu(texts.addItems).catch(() =>
    page.getByRole('button', { name: new RegExp(texts.addItems) }).click()
  );
  await page.getByRole('menuitem', { name: texts.importCsv }).click();
  const importDialog = page.getByRole('dialog');
  await importDialog.waitFor();
  await importDialog.locator('input[type="file"]').setInputFiles({
    name: 'artikel.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(texts.csv),
  });
  // Rows without a category of their own get the one picked for all
  await importDialog.locator('#walk-in-import-category').click();
  // With one main category its group is open already, a click would close it
  const kidsBikes = page.getByRole('menuitem', { name: texts.kidsBikes, exact: true });
  await page.getByRole('menu').waitFor();
  if (!(await kidsBikes.isVisible())) {
    await page.getByRole('menuitem', { name: new RegExp(`^${texts.bikes}`) }).first().click();
  }
  await kidsBikes.click();
  await page.waitForTimeout(800);
  await shot(importDialog, 'csv-import', texts.dir);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1280, height: 800 });

  // Posters, flyers and pictures for social media
  await open(page, `/events/view/${bikeEvent._id}/promo`, texts);
  await page.waitForTimeout(1500);
  await shot(page, 'werbung', texts.dir);
  await page.context().close();

  // On phones: tab bar with the scanner in the middle
  const phone = await newPage(browser, lang, { width: 390, height: 780 });
  await login(phone, 'user1@bazarpro.de', lang);
  await open(phone, `/events/view/${bikeEvent._id}`, texts);
  await shot(phone, 'handy-navigation', texts.dir);
  await phone.context().close();
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
  const events = await apiQuery('events.get', {});
  const sellerEvent = events.find((e) => e.title === 'Großer Winterflohmarkt 2026');
  if (!sellerEvent) throw new Error('Demo-Event "Großer Winterflohmarkt 2026" fehlt – Seed ausgeführt?');

  // Date and time inputs follow the language of the browser, not of the page
  const launch = (lang) =>
    chromium.launch({ args: [...fakeCameraArgs(), `--lang=${LOCALES[lang].browser}`] });
  let browser = await launch('de');

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
    if (lang !== 'de') {
      await browser.close();
      browser = await launch(lang);
    }
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
