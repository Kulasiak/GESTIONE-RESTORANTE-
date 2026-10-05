// Prova dei ruoli di gruppo con dati precaricati (senza Supabase): membro fuori zona, capogruppo ed editor.
import { chromium } from 'playwright-core';
const OUT = process.argv[2] ?? 'smoke-shots';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
const shift = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const group = { id: 'g1', name: 'Parrocchia San Luca', code: 'ROMA-4821', leaderId: 'L', leaderName: 'Marco', leaderPhone: '+39 333 000 0000',
  meeting: { name: 'Piazza Pio XII', lat: 41.9022, lng: 12.4570, time: '12:15' }, radius: 150, trip: { start: shift(today, -1), end: shift(today, 2) } };
const now = new Date().toISOString();
const members = [
  { userId: 'L', name: 'Marco', role: 'leader', lat: 41.9022, lng: 12.4572, updatedAt: now, outOfZone: false },
  { userId: 'M', name: 'Giulia Rossi', phone: '+39 333 111 2222', role: 'member', lat: 41.9040, lng: 12.4610, updatedAt: now, outOfZone: true },
  { userId: 'P', name: 'Paolo T', role: 'member', lat: 41.9023, lng: 12.4568, updatedAt: now, outOfZone: false },
  { userId: 'A', name: 'Anna L', role: 'member', lat: 41.9020, lng: 12.4575, updatedAt: now, outOfZone: false },
];
const plan = { id: null, tour: 'pell', day: today, publishedAt: now, stops: [
  { time: '08:30', place: 'hotel', mode: null, minutes: null, leg: null, tip: null },
  { time: '09:15', place: 'vaticani', mode: 'metro', minutes: 35, leg: 'Cavour → Termini → Ottaviano', tip: null },
  { time: '12:30', place: 'pietro', mode: 'walk', minutes: 10, leg: null, tip: null },
  { time: '17:30', place: 'hotel', mode: 'bus', minutes: 25, leg: 'Bus 40', tip: null } ] };
let n = 0;
async function run(role, name, pos) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'it-IT',
    geolocation: pos, permissions: ['geolocation'], timezoneId: 'Europe/Rome' });
  await ctx.addInitScript(([p, g, m, pl]) => {
    localStorage.setItem('custode.profile', JSON.stringify(p));
    localStorage.setItem('custode.group', JSON.stringify(g));
    localStorage.setItem('custode.members', JSON.stringify(m));
    localStorage.setItem('custode.plans', JSON.stringify({ [pl.day]: pl }));
  }, [{ userId: role === 'leader' ? 'L' : 'X', lang: 'it', role, name, onboarded: true, groupId: 'g1' }, group, members, plan]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = async (s) => { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/g${++n}-${s}.png` }); };
  await page.goto(process.env.APP_URL ?? 'http://localhost:4173/');
  await page.waitForTimeout(1500);
  return { page, shot, errors, ctx };
}
// Membro a 600 m dal punto d'incontro → avviso "ti sei allontanato"
{
  const { page, shot, errors, ctx } = await run('member', 'Luca', { latitude: 41.9060, longitude: 12.4620 });
  await shot('membro-fuori-zona');
  await page.getByRole('button', { name: /Sto bene/ }).click();
  await shot('membro-oggi');
  await page.getByRole('button', { name: 'Mappa' }).last().click();
  await page.waitForTimeout(1500);
  await page.locator('#scroller').evaluate((e) => e.scrollTo(0, 400));
  await shot('membro-mappa');
  console.log('membro:', errors.join('; ') || 'ok');
  await ctx.close();
}
// Capogruppo nella zona → stato gruppo, editor
{
  const { page, shot, errors, ctx } = await run('leader', 'Marco', { latitude: 41.9022, longitude: 12.4572 });
  await shot('capo-avviso-borseggi');
  await page.getByRole('button', { name: 'Ho capito' }).click();
  await shot('capo-oggi');
  await page.getByRole('button', { name: 'Mappa' }).last().click();
  await page.waitForTimeout(1500);
  await page.locator('#scroller').evaluate((e) => e.scrollTo(0, 450));
  await shot('capo-mappa-membri');
  await page.getByRole('button', { name: 'Oggi' }).last().click();
  await page.getByRole('tab', { name: /Giorno 3/ }).click();
  await shot('capo-giorno-3');
  await page.getByRole('button', { name: 'Modifica programma' }).first().click();
  await page.waitForTimeout(1000);
  await shot('capo-editor');
  await page.locator('#scroller').evaluate((e) => e.scrollTo(0, 700));
  await shot('capo-editor-zona');
  await page.locator('input[type=range]').fill('300');
  await page.getByRole('button', { name: 'Invia al gruppo' }).click();
  await shot('capo-pubblicato');
  console.log('capo:', errors.join('; ') || 'ok');
  await ctx.close();
}
await browser.close();
