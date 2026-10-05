// Trasforma un programma in righe pronte da mostrare (Home, Mappa, Editor).
import { L, type Dict, type Lang } from '../i18n';
import { MODES, PLACES, type Stop } from '../data/rome';
import { addMin, romeNow, toMin } from './hours';
import { today, type Plan, type Profile } from './api';

export type StepView = {
  i: number; time: string; name: string; meta: string; tip: string;
  legLabel: string; legText: string; legColor: string; legSoft: string; hasLeg: boolean;
  detail: { tm: string; x: string }[]; isNow: boolean; done: boolean;
};

export function stopName(s: Stop, lang: Lang, profile?: Profile): string {
  if (s.place === 'hotel' && profile?.hotel?.name) return profile.hotel.name;
  if (s.place && PLACES[s.place]) return L(PLACES[s.place].name, lang);
  return s.name || '—';
}

export const modeLabel = (m: Stop['mode'], lang: Lang) => (m ? L(MODES[m].label, lang) : '');

/** Indice della tappa in corso (ultima con orario gia passato), -1 se il programma non e di oggi. */
export function nowIndex(plan: Plan | null): number {
  if (!plan || plan.day !== today()) return -1;
  const m = romeNow().minutes;
  let idx = -1;
  plan.stops.forEach((s, i) => { if (toMin(s.time) <= m) idx = i; });
  return idx;
}

export function buildSteps(plan: Plan, lang: Lang, t: Dict, profile?: Profile): StepView[] {
  const now = nowIndex(plan);
  return plan.stops.map((s, i) => {
    const prev = plan.stops[i - 1];
    const md = s.mode ? MODES[s.mode] : null;
    const name = stopName(s, lang, profile);
    let detail = s.detail ? s.detail.map((d) => ({ tm: d.time, x: L(d.text, lang) })) : [];
    if (!detail.length && prev && md) {
      detail = [
        { tm: addMin(s.time, -(s.minutes ?? 0)), x: t.leave + ' ' + stopName(prev, lang, profile) },
        { tm: '', x: [modeLabel(s.mode, lang), L(s.leg, lang), s.minutes ? s.minutes + ' min' : ''].filter(Boolean).join(' · ') },
        { tm: s.time, x: t.arrive + ' ' + name },
      ];
    }
    return {
      i, time: s.time, name, tip: L(s.tip, lang),
      meta: [L(s.duration, lang), L(s.price, lang)].filter(Boolean).join(' · '),
      hasLeg: !!md, legLabel: md ? modeLabel(s.mode, lang) + (s.minutes ? ' · ' + s.minutes + ' min' : '') : '',
      legText: L(s.leg, lang), legColor: md?.color ?? '', legSoft: md?.soft ?? '',
      detail, isNow: i === now, done: now >= 0 && i < now,
    };
  });
}
