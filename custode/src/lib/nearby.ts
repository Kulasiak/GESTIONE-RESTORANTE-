// Servizi vicini (polizia, ospedale, farmacia, bagni) da OpenStreetMap via Overpass,
// e meteo da Open-Meteo. Entrambi gratuiti e senza chiave. Risultati in cache.
import { cache } from './api';
import { distance, type LatLng } from './geo';

export type PoiKind = 'police' | 'hospital' | 'pharmacy' | 'toilets';
export type Poi = { kind: PoiKind; name: string; lat: number; lng: number; dist: number; phone?: string };

const OVERPASS = 'https://overpass-api.de/api/interpreter';

export async function nearbyServices(p: LatLng, radius = 1500): Promise<Poi[]> {
  const key = `custode.poi.${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
  const hit = cache.get<{ at: number; list: Poi[] }>(key);
  if (hit && Date.now() - hit.at < 24 * 3600_000) return hit.list;
  const around = `(around:${radius},${p.lat},${p.lng})`;
  const q = `[out:json][timeout:15];(
    nwr["amenity"="police"]${around};
    nwr["amenity"="hospital"]["emergency"!="no"]${around};
    nwr["amenity"="pharmacy"]${around};
    nwr["amenity"="toilets"]${around};
  );out center 60;`;
  const res = await fetch(OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!res.ok) throw new Error('overpass ' + res.status);
  const json = (await res.json()) as { elements: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };
  const list: Poi[] = json.elements.flatMap((e) => {
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    const kind = e.tags?.amenity as PoiKind | undefined;
    if (lat == null || lng == null || !kind) return [];
    return [{ kind, lat, lng, name: e.tags?.name ?? '', phone: e.tags?.phone ?? e.tags?.['contact:phone'], dist: distance(p, { lat, lng }) }];
  }).sort((a, b) => a.dist - b.dist);
  cache.set(key, { at: Date.now(), list });
  return list;
}

export const nearestOf = (list: Poi[], kind: PoiKind) => list.find((x) => x.kind === kind && (kind !== 'police' && kind !== 'hospital' || x.name));

export async function romeTemperature(): Promise<number | null> {
  const hit = cache.get<{ at: number; t: number }>('custode.weather');
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.t;
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=41.9&longitude=12.5&current=temperature_2m');
    const j = (await r.json()) as { current?: { temperature_2m?: number } };
    const t = j.current?.temperature_2m;
    if (t == null) return hit?.t ?? null;
    cache.set('custode.weather', { at: Date.now(), t: Math.round(t) });
    return Math.round(t);
  } catch {
    return hit?.t ?? null;
  }
}

/** Indirizzo → coordinate (Nominatim, OpenStreetMap). */
export async function geocode(address: string): Promise<LatLng | null> {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&viewbox=12.35,42.0,12.65,41.8&q=${encodeURIComponent(address + ', Roma')}`);
  const j = (await r.json()) as { lat: string; lon: string }[];
  return j[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon) } : null;
}
