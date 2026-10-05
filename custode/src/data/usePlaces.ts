// Luoghi: dati inclusi nell'app (offline) aggiornati da Supabase (tabella places) quando c'e rete.
import { useEffect, useState } from 'react';
import { PLACES, type Place } from './rome';
import { cache } from '../lib/api';
import { supabase } from '../lib/supabase';

const KEY = 'custode.places';
type Row = { id: string; kind: string; name: Place['name']; story: Place['story']; lat: number; lng: number; tags: string[]; price_full: Place['full']; price_reduced: Place['reduced']; booking: Place['booking']; hours_label: Place['hoursLabel']; hours: Place['hours']; first_sunday: Place['firstSunday']; note: Place['note']; url: string | null };

const merge = (rows: Row[] | null): Record<string, Place> => {
  if (!rows?.length) return PLACES;
  const out = { ...PLACES };
  for (const r of rows) {
    out[r.id] = { ...(PLACES[r.id] ?? {}), id: r.id, kind: r.kind, name: r.name, story: r.story, lat: r.lat, lng: r.lng, tags: r.tags, full: r.price_full, reduced: r.price_reduced, booking: r.booking, hoursLabel: r.hours_label, hours: r.hours, firstSunday: r.first_sunday, note: r.note, url: r.url };
  }
  return out;
};

let fetched = false;
export function usePlaces(): Record<string, Place> {
  const [places, setPlaces] = useState(() => merge(cache.get<Row[]>(KEY)));
  useEffect(() => {
    if (!supabase || fetched || !navigator.onLine) return;
    fetched = true;
    supabase.from('places').select('*').then(({ data }) => {
      if (data?.length) { cache.set(KEY, data); setPlaces(merge(data as Row[])); }
    });
  }, []);
  return places;
}
