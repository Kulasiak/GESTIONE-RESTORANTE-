// Genera supabase/seed.sql (tabella places) dai dati del design + coordinate/orari curati.
import fs from 'node:fs';
const gen = JSON.parse(fs.readFileSync(new URL('../src/data/rome.generated.json', import.meta.url)));
const meta = JSON.parse(fs.readFileSync(new URL('../src/data/places.meta.json', import.meta.url)));

const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const j = (v) => (v == null ? 'null' : `${q(JSON.stringify(typeof v === 'string' ? { it: v, en: v, fr: v, es: v, pl: v, ro: v } : v))}::jsonb`);
const hoursOf = (m) => {
  if (m.always) return { always: true };
  if (m.daily) return Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, m.daily]));
  if (m.hours) return { ...m.hours, ...(m.lastSundayOfMonth ? { lastSunday: m.lastSundayOfMonth } : {}) };
  return null;
};

const rows = Object.entries(meta.places).map(([id, m]) => {
  const p = gen.places[id];
  const mus = gen.museums.find((x) => x.place === id);
  return `(${[q(id), q(m.kind), j(p.name), j(p.story), m.lat, m.lng,
    `array[${(mus?.tags ?? []).map(q).join(',')}]::text[]`,
    j(mus?.full), j(mus?.reduced), j(mus?.booking), j(mus?.hoursLabel), j(hoursOf(m)), q(m.firstSunday), j(mus?.note), q(m.url)].join(', ')})`;
});

const sql = `-- Generato da scripts/gen-seed.mjs: non modificare a mano.
-- Prezzi e orari indicativi 2026: verificare con le fonti ufficiali.
insert into public.places (id, kind, name, story, lat, lng, tags, price_full, price_reduced, booking, hours_label, hours, first_sunday, note, url) values
${rows.join(',\n')}
on conflict (id) do update set kind = excluded.kind, name = excluded.name, story = excluded.story, lat = excluded.lat, lng = excluded.lng,
  tags = excluded.tags, price_full = excluded.price_full, price_reduced = excluded.price_reduced, booking = excluded.booking,
  hours_label = excluded.hours_label, hours = excluded.hours, first_sunday = excluded.first_sunday, note = excluded.note, url = excluded.url, updated_at = now();
`;
fs.writeFileSync(new URL('../supabase/seed.sql', import.meta.url), sql);
console.log('seed:', rows.length, 'luoghi');
