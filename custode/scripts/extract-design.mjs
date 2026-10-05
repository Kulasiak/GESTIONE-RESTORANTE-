// Estrae testi (6 lingue) e dati di Roma dal design "Custode" (design/Custode.dc.html)
// e genera src/i18n/locales/*.json e src/data/rome.generated.json.
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../design/Custode.dc.html', import.meta.url), 'utf8');
const script = html.slice(html.indexOf('const TR = {'), html.indexOf('class Component extends DCLogic'));
const ctx = {};
vm.createContext(ctx);
vm.runInContext(script + '\n;globalThis.__out = {TR, X, P, STORY, MODES, PLANS, TOURS, MUS, TRANSFER, TIPS, FREE, LANGS};', ctx);
const { TR, X, P, STORY, MODES, PLANS, TOURS, MUS, TRANSFER, TIPS, LANGS } = ctx.__out;

const loc = (o) => {
  if (o == null) return null;
  if (typeof o === 'string') return o;
  const out = {};
  for (const l of LANGS) out[l] = o[l] ?? (X[o.en] && X[o.en][l]) ?? o.en;
  return out;
};

for (const l of LANGS) {
  fs.writeFileSync(new URL(`../src/i18n/locales/${l}.design.json`, import.meta.url), JSON.stringify(TR[l], null, 1) + '\n');
}

const places = Object.fromEntries(Object.entries(P).map(([k, v]) => [k, { name: loc(v.n), story: loc(STORY[k]) }]));
const modes = Object.fromEntries(Object.entries(MODES).map(([k, v]) => [k, { color: v.c, soft: v.soft, label: loc({ it: v.it, en: v.en }) }]));
const plans = Object.fromEntries(Object.entries(PLANS).map(([k, steps]) => [k, steps.map((s) => ({
  time: s.t, place: s.p, mode: s.mode ?? null, minutes: s.min ?? null, leg: loc(s.leg), duration: loc(s.dur), price: loc(s.price), tip: loc(s.tip),
  detail: s.detail ? s.detail.map(([tm, x]) => ({ time: tm, text: loc(x) })) : null,
}))]));
const tours = TOURS.map(([id, label]) => ({ id, label: loc(label) }));
const museums = MUS.map((m) => ({ place: m.p, tags: m.tags, full: loc(m.full), reduced: loc(m.red), booking: loc(m.book), hoursLabel: loc(m.h), note: loc(m.note) }));
const transfer = Object.fromEntries(Object.entries(TRANSFER).map(([k, list]) => [k, list.map((o) => ({
  mode: o.mode, name: loc(o.n), to: loc(o.to), duration: o.dur, frequency: loc(o.freq), price: o.price, buy: o.buy, best: loc(o.best),
}))]));
const tips = TIPS.map(loc);
const extra = Object.fromEntries([
  ['Free', { it: 'Gratuito', en: 'Free' }], ['Farmacia', { it: 'Farmacia', en: 'Pharmacy' }], ['Bagni pubblici', { it: 'Bagni pubblici', en: 'Public toilets' }],
].map(([k, v]) => [k, loc(v)]));

fs.writeFileSync(new URL('../src/data/rome.generated.json', import.meta.url),
  JSON.stringify({ places, modes, plans, tours, museums, transfer, tips, extra }, null, 1) + '\n');
console.log('ok', Object.keys(places).length, 'luoghi,', Object.keys(TR.it).length, 'chiavi');
