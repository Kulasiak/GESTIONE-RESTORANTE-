// Dati di Roma: testi e percorsi dal design + coordinate, orari e siti ufficiali.
import gen from './rome.generated.json';
import meta from './places.meta.json';
import type { Hours, Slot } from '../lib/hours';
import type { Loc } from '../i18n';

export type Mode = 'walk' | 'metro' | 'bus' | 'tram' | 'train' | 'taxi';
export const MODE_LIST: Mode[] = ['walk', 'metro', 'bus', 'tram', 'train', 'taxi'];

export type Place = {
  id: string; kind: string; name: Loc; story: Loc; lat: number; lng: number;
  tags: string[]; full: Loc; reduced: Loc; booking: Loc; hoursLabel: Loc; hours: Hours | null;
  firstSunday: 'free' | 'residents' | null; note: Loc; url: string | null; lastEntry?: string;
};

type Meta = { lat: number; lng: number; kind: string; url?: string; always?: boolean; daily?: Slot[]; hours?: Record<string, Slot[]>; lastSundayOfMonth?: Slot[]; firstSunday?: 'free' | 'residents'; lastEntry?: string };

function hoursOf(m: Meta): Hours | null {
  if (m.always) return { always: true };
  if (m.daily) return Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), m.daily])) as Hours;
  if (m.hours) return { ...(m.hours as Hours), ...(m.lastSundayOfMonth ? { lastSunday: m.lastSundayOfMonth } : {}) };
  return null;
}

export const PLACES: Record<string, Place> = Object.fromEntries(
  Object.entries(meta.places as unknown as Record<string, Meta>).map(([id, m]) => {
    const p = (gen.places as Record<string, { name: Loc; story: Loc }>)[id];
    const mus = gen.museums.find((x) => x.place === id);
    return [id, {
      id, kind: m.kind, name: p.name, story: p.story, lat: m.lat, lng: m.lng,
      tags: mus?.tags ?? [], full: mus?.full ?? null, reduced: mus?.reduced ?? null, booking: mus?.booking ?? null,
      hoursLabel: mus?.hoursLabel ?? null, hours: hoursOf(m), firstSunday: m.firstSunday ?? null, note: mus?.note ?? null,
      url: m.url ?? null, lastEntry: m.lastEntry,
    } satisfies Place];
  }),
);

/** Luoghi mostrati in "Musei e monumenti" (ordine del design). */
export const MUSEUM_IDS = gen.museums.map((m) => m.place);

export const MODES = gen.modes as Record<Mode, { color: string; soft: string; label: Loc }>;

export type Stop = {
  id?: string; time: string; place: string | null; name?: string | null; lat?: number | null; lng?: number | null;
  mode: Mode | null; minutes: number | null; leg: Loc; duration?: Loc; price?: Loc; tip: Loc;
  detail?: { time: string; text: Loc }[] | null;
};

export const TOURS = gen.tours as { id: string; label: Loc }[];
export const PRESET_PLANS = gen.plans as Record<string, Stop[]>;
export const TIPS = gen.tips as Loc[];
export const EXTRA = gen.extra as Record<string, Loc>;

export type Transfer = { mode: Mode; name: Loc; to: Loc; duration: string; frequency: Loc; price: string; buy: boolean; best: Loc; url: string | null };
const urls = meta.transferUrls as Record<string, string>;
export const TRANSFER: Record<'FCO' | 'CIA', Transfer[]> = Object.fromEntries(
  Object.entries(gen.transfer).map(([k, list]) => [k, list.map((o) => {
    const en = typeof o.name === 'string' ? o.name : o.name.en;
    return { ...(o as Omit<Transfer, 'url'>), url: o.buy ? urls[en] ?? (en === 'Shuttle bus' ? urls.shuttle : null) : null };
  })]),
) as Record<'FCO' | 'CIA', Transfer[]>;

export const RISK_ZONES = meta.riskZones as { id: string; lat: number; lng: number; r: number }[];
export const RISK_LINES = meta.riskLines as { id: string; width: number; points: [number, number][] }[];

export const ROME_CENTER = { lat: 41.8986, lng: 12.4769 };

/** Coordinate e nome di una tappa (luogo noto o tappa libera). */
export function stopPoint(s: Stop): { lat: number; lng: number } | null {
  if (s.place && PLACES[s.place]) return PLACES[s.place];
  if (s.lat != null && s.lng != null) return { lat: s.lat, lng: s.lng };
  return null;
}

// Numeri utili in Italia
export const NUMBERS = [
  { key: 'n112', tel: '112' },
  { key: 'n113', tel: '113' },
  { key: 'n118', tel: '118' },
  { key: 'n115', tel: '115' },
  { key: 'nTaxi', tel: '063570' },
] as const;

// Ambasciate a Roma per nazionalita (codice ISO3 del passaporto). Da verificare sui siti ufficiali.
export const EMBASSIES: Record<string, { name: Loc; address: string; lat: number; lng: number; url: string }> = {
  GBR: { name: { it: 'Ambasciata britannica', en: 'British Embassy', fr: 'Ambassade britannique', es: 'Embajada británica', pl: 'Ambasada brytyjska', ro: 'Ambasada britanică' }, address: 'Via XX Settembre 80/a', lat: 41.9064, lng: 12.4967, url: 'https://www.gov.uk/world/italy' },
  USA: { name: { it: 'Ambasciata degli Stati Uniti', en: 'US Embassy', fr: 'Ambassade des États-Unis', es: 'Embajada de EE. UU.', pl: 'Ambasada USA', ro: 'Ambasada SUA' }, address: 'Via Vittorio Veneto 121', lat: 41.9071, lng: 12.4904, url: 'https://it.usembassy.gov' },
  FRA: { name: { it: 'Ambasciata di Francia', en: 'French Embassy', fr: 'Ambassade de France', es: 'Embajada de Francia', pl: 'Ambasada Francji', ro: 'Ambasada Franței' }, address: 'Piazza Farnese 67', lat: 41.8949, lng: 12.4705, url: 'https://it.ambafrance.org' },
  ESP: { name: { it: 'Ambasciata di Spagna', en: 'Spanish Embassy', fr: "Ambassade d'Espagne", es: 'Embajada de España', pl: 'Ambasada Hiszpanii', ro: 'Ambasada Spaniei' }, address: 'Largo Fontanella di Borghese 19', lat: 41.9025, lng: 12.4768, url: 'https://www.exteriores.gob.es/Embajadas/roma' },
  POL: { name: { it: 'Ambasciata di Polonia', en: 'Polish Embassy', fr: 'Ambassade de Pologne', es: 'Embajada de Polonia', pl: 'Ambasada RP', ro: 'Ambasada Poloniei' }, address: 'Via Pietro Paolo Rubens 20', lat: 41.9248, lng: 12.4743, url: 'https://www.gov.pl/web/italia' },
  ROU: { name: { it: 'Ambasciata di Romania', en: 'Romanian Embassy', fr: 'Ambassade de Roumanie', es: 'Embajada de Rumanía', pl: 'Ambasada Rumunii', ro: 'Ambasada României' }, address: 'Via Nicolò Tartaglia 36', lat: 41.9262, lng: 12.4759, url: 'https://roma.mae.ro' },
};

// Frasi utili: in italiano (da mostrare o far ascoltare) con il significato nella lingua dell'utente.
export const PHRASES: { it: string; tr: Loc }[] = [
  { it: 'Aiuto!', tr: { en: 'Help!', fr: 'Au secours !', es: '¡Ayuda!', pl: 'Pomocy!', ro: 'Ajutor!' } },
  { it: 'Chiamate la polizia, per favore.', tr: { en: 'Please call the police.', fr: "Appelez la police, s'il vous plaît.", es: 'Llamen a la policía, por favor.', pl: 'Proszę wezwać policję.', ro: 'Chemați poliția, vă rog.' } },
  { it: "Chiamate un'ambulanza.", tr: { en: 'Call an ambulance.', fr: 'Appelez une ambulance.', es: 'Llamen a una ambulancia.', pl: 'Proszę wezwać karetkę.', ro: 'Chemați o ambulanță.' } },
  { it: 'Ho perso il passaporto.', tr: { en: 'I lost my passport.', fr: "J'ai perdu mon passeport.", es: 'He perdido el pasaporte.', pl: 'Zgubiłem/am paszport.', ro: 'Mi-am pierdut pașaportul.' } },
  { it: 'Mi hanno derubato.', tr: { en: 'I have been robbed.', fr: "On m'a volé.", es: 'Me han robado.', pl: 'Zostałem/am okradziony/a.', ro: 'Am fost jefuit.' } },
  { it: 'Ho bisogno di un medico.', tr: { en: 'I need a doctor.', fr: "J'ai besoin d'un médecin.", es: 'Necesito un médico.', pl: 'Potrzebuję lekarza.', ro: 'Am nevoie de un medic.' } },
  { it: 'Mi sono perso. Mi può aiutare?', tr: { en: "I'm lost. Can you help me?", fr: "Je suis perdu. Pouvez-vous m'aider ?", es: 'Me he perdido. ¿Me puede ayudar?', pl: 'Zgubiłem/am się. Może mi pan/pani pomóc?', ro: 'M-am rătăcit. Mă puteți ajuta?' } },
  { it: "Dov'è l'ospedale più vicino?", tr: { en: 'Where is the nearest hospital?', fr: "Où est l'hôpital le plus proche ?", es: '¿Dónde está el hospital más cercano?', pl: 'Gdzie jest najbliższy szpital?', ro: 'Unde este cel mai apropiat spital?' } },
  { it: "Dov'è la stazione di polizia?", tr: { en: 'Where is the police station?', fr: 'Où est le commissariat ?', es: '¿Dónde está la comisaría?', pl: 'Gdzie jest komisariat?', ro: 'Unde este secția de poliție?' } },
  { it: 'Sono allergico a…', tr: { en: "I'm allergic to…", fr: 'Je suis allergique à…', es: 'Soy alérgico a…', pl: 'Mam alergię na…', ro: 'Sunt alergic la…' } },
  { it: 'Non parlo italiano. Parla inglese?', tr: { en: "I don't speak Italian. Do you speak English?", fr: 'Je ne parle pas italien. Parlez-vous anglais ?', es: 'No hablo italiano. ¿Habla inglés?', pl: 'Nie mówię po włosku. Czy mówi pan/pani po angielsku?', ro: 'Nu vorbesc italiană. Vorbiți engleză?' } },
  { it: 'Lasciatemi in pace!', tr: { en: 'Leave me alone!', fr: 'Laissez-moi tranquille !', es: '¡Déjenme en paz!', pl: 'Proszę zostawić mnie w spokoju!', ro: 'Lăsați-mă în pace!' } },
];
