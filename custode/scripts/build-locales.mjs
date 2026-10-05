// Unisce i testi del design (src/i18n/locales/*.design.json) con quelli dell'app
// in un file per lingua: src/i18n/locales/<lingua>.json (quello usato dall'app).
// Per cambiare un testo: modifica scripts/app-strings.mjs (testi dell'app) o
// i file *.design.json (testi del design), poi `npm run locales`.
import fs from 'node:fs';
import app from './app-strings.mjs';
const LANGS = ['it', 'en', 'fr', 'es', 'pl', 'ro'];
const dir = new URL('../src/i18n/locales/', import.meta.url);
LANGS.forEach((l, i) => {
  const design = JSON.parse(fs.readFileSync(new URL(`${l}.design.json`, dir)));
  const target = new URL(`${l}.json`, dir);
  const out = { ...design, ...Object.fromEntries(Object.entries(app).map(([k, v]) => [k, v[i]])) };
  fs.writeFileSync(target, JSON.stringify(out, null, 1) + '\n');
  console.log(l, Object.keys(out).length, 'testi');
});
