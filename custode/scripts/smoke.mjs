// Prova end-to-end nel browser (modalita locale): onboarding, MRZ, PIN, tutte le schermate.
// Uso: npm run build && npx vite preview --port 4173 & node scripts/smoke.mjs [cartella-screenshot]
import { chromium } from 'playwright-core';
const OUT = process.argv[2] ?? 'smoke-shots';
const exe = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'it-IT',
  geolocation: { latitude: 41.9005, longitude: 12.4995 }, permissions: ['geolocation'], timezoneId: 'Europe/Rome',
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push('console: ' + m.text()); });
let n = 0;
const shot = async (name) => { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${String(++n).padStart(2, '0')}-${name}.png` }); };
const click = (text) => page.getByRole('button', { name: text, exact: false }).first().click();
const dismiss = async (name) => {
  const d = page.getByRole('dialog');
  if (await d.isVisible().catch(() => false)) { await shot(name); await d.locator('.btn').first().click(); }
};

await page.goto('http://localhost:4173/');
await shot('welcome');
await click('Inizia');
await shot('ruolo');
await page.getByRole('radio', { name: /Da solo/ }).click();
await page.getByLabel('Il tuo nome').fill('Emma');
await click('Continua');
await shot('scansione');
await click('Inserisci la MRZ a mano');
await page.locator('textarea').fill('P<GBRSMITH<<EMMA<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n5334821<<3GBR8807146F3103228<<<<<<<<<<<<<<04');
await click('Leggi');
await shot('conferma-dati');
await page.getByPlaceholder('PIN', { exact: true }).fill('123456');
await page.getByPlaceholder('Ripeti il PIN').fill('123456');
await page.getByRole('button', { name: 'Salva' }).click();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Salva' }).click();
await page.waitForTimeout(1200);
await shot('documento-salvato');
await click('Continua');
await page.waitForTimeout(1000);
await dismiss('avviso-borseggi');
await shot('oggi');
await page.locator('#scroller').evaluate((e) => e.scrollTo(0, 900));
await shot('oggi-programma');
await page.getByRole('button', { name: 'Mappa' }).last().click();
await page.waitForTimeout(2500);
await shot('mappa');
await page.locator('#scroller').evaluate((e) => e.scrollTo(0, 500));
await shot('mappa-sotto');
await page.getByRole('button', { name: 'Documenti' }).last().click();
await shot('documenti');
await page.getByRole('button', { name: 'Ho perso un documento' }).click();
await page.waitForTimeout(1500);
await shot('documento-perso');
await page.getByRole('button', { name: 'Musei' }).last().click();
await shot('musei');
await page.getByRole('button', { name: /Colosseo/ }).first().click();
await shot('scheda-museo');
await click('Al programma');
await shot('aggiunto');
await page.getByRole('button', { name: 'SOS' }).last().click();
await page.waitForTimeout(1500);
await shot('sos');
await page.locator('#scroller').evaluate((e) => e.scrollTo(0, 1200));
await shot('sos-frasi');
await page.getByRole('button', { name: 'Oggi' }).last().click();
await page.getByRole('button', { name: /Aeroporto/ }).click();
await shot('trasporti');
await click('Ho comprato: salva il biglietto');
await page.getByLabel(/Codice del biglietto/).fill('LX-2026-88213');
await page.getByRole('button', { name: 'Salva' }).click();
await page.waitForTimeout(800);
await shot('biglietto');
await page.getByRole('button', { name: 'Oggi' }).last().click();
await page.getByRole('button', { name: 'EN' }).first().click();
await shot('today-en');
await page.getByRole('button', { name: 'RO' }).first().click();
await shot('today-ro');
// Ricarica: deve restare tutto (offline-first) e la cassaforte deve essere bloccata
await page.reload();
await page.getByRole('button', { name: /Documente/ }).last().click();
await shot('documenti-bloccati');
console.log(errors.length ? errors.join('\n') : 'nessun errore');
await browser.close();
