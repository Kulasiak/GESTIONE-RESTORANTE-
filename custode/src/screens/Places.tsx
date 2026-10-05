import { useState } from 'react';
import { useApp } from '../state';
import { Back } from '../components/ui';
import { L, LOCALE, fmt, type Dict } from '../i18n';
import { MUSEUM_IDS, TOURS, stopPoint, type Place, type Stop } from '../data/rome';
import { usePlaces } from '../data/usePlaces';
import { addMin, isFirstSunday, nextFirstSunday, openState, romeNow, type OpenState } from '../lib/hours';
import { distance, mapsDirections, walkMinutes } from '../lib/geo';
import { speak, stopSpeaking, canSpeak } from '../lib/speech';
import * as api from '../lib/api';

export function statusText(s: OpenState, t: Dict): { text: string; color: string } {
  switch (s.kind) {
    case 'always': return { text: t.alwaysOpen, color: 'var(--green-txt)' };
    case 'open': return { text: `${t.openUntil} ${s.until}`, color: 'var(--green-txt)' };
    case 'later': return { text: fmt(t.opensAt, { t: s.opens }), color: 'var(--gold-ink)' };
    case 'closed': return { text: t.closedToday, color: 'var(--red)' };
    case 'ended': return { text: fmt(t.closedNow, { t: s.at }), color: 'var(--red)' };
    default: return { text: '', color: 'var(--muted)' };
  }
}

function freeLine(p: Place, t: Dict, lang: keyof typeof LOCALE): string | null {
  const n = romeNow();
  if (p.firstSunday === 'free') return isFirstSunday(n) ? t.freeToday : fmt(t.nextFree, { date: nextFirstSunday(n).toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'long' }) });
  if (p.firstSunday === 'residents') return t.freeResidents;
  return null;
}

export function Places() {
  const { t, lang, go } = useApp();
  const places = usePlaces();
  const [filter, setFilter] = useState('all');
  const n = romeNow();
  const list = MUSEUM_IDS.map((id) => places[id]).filter((p) => p && (filter === 'all' || p.tags.includes(filter)));
  const tagName = (k: string) => L(TOURS.find((x) => x.id === k)?.label, lang);
  return (
    <div className="page" style={{ gap: 14 }}>
      <div className="col gap4"><h1 className="h2">{t.placesTitle}</h1><div className="muted" style={{ fontSize: 14 }}>{t.placesD}</div></div>
      <div className="chips">
        {[['all', t.all] as const, ...TOURS.map((x) => [x.id, L(x.label, lang)] as const)].map(([k, label]) => (
          <button key={k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>
      <div className="note gold">{isFirstSunday(n) ? t.freeToday : t.firstSunday}</div>
      {list.map((p) => {
        const st = statusText(openState(p.hours, n), t);
        const free = p.firstSunday === 'free' && isFirstSunday(n);
        return (
          <button key={p.id} className="museum-card" onClick={() => go({ sub: 'museum', param: p.id })}>
            <div className="row between gap12" style={{ alignItems: 'baseline', width: '100%' }}>
              <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25 }}>{L(p.name, lang)}</span>
              <span className="serif" style={{ flex: 'none', fontSize: 24 }}>{free ? '€0' : L(p.full, lang)}</span>
            </div>
            <span className="small muted">{p.tags.map(tagName).join(' · ')}</span>
            <div className="row between small" style={{ width: '100%' }}><span className="b" style={{ color: st.color }}>● {st.text}</span><span className="muted">{L(p.hoursLabel, lang)}</span></div>
          </button>
        );
      })}
      <div className="small muted" style={{ lineHeight: 1.45 }}>{t.priceNote}</div>
    </div>
  );
}

export function Museum({ id }: { id: string }) {
  const { t, lang, profile, plan, setPlan, toast, pos, group } = useApp();
  const places = usePlaces();
  const [playing, setPlaying] = useState(false);
  const p = places[id];
  if (!p) return <div className="page"><Back /></div>;
  const st = statusText(openState(p.hours), t);
  const rows = ([[t.full, p.full], [t.reduced, p.reduced], [t.booking, p.booking]] as const).filter(([, v]) => v);
  const free = freeLine(p, t, lang);
  const isMember = profile.role === 'member';
  const story = L(p.story, lang);
  const inPlan = !!plan?.stops.some((s) => s.place === id);

  async function addToPlan() {
    if (!plan) return;
    if (inPlan) { toast(t.alreadyInPlan); return; }
    const stops = [...plan.stops];
    const lastIsHotel = stops.length > 1 && stops[stops.length - 1].place === 'hotel';
    const at = lastIsHotel ? stops.length - 1 : stops.length;
    const prev = stops[at - 1];
    const a = prev ? stopPoint(prev) : null;
    const mins = a ? walkMinutes(distance(a, p)) : 15;
    const stop: Stop = { time: prev ? addMin(prev.time, 75) : '10:00', place: id, mode: mins > 30 ? 'bus' : 'walk', minutes: Math.min(mins, 40), leg: null, tip: null, duration: { it: '1 h', en: '1 h' }, price: p.full };
    stops.splice(at, 0, stop);
    if (lastIsHotel) stops[stops.length - 1] = { ...stops[stops.length - 1], time: addMin(stop.time, 90) };
    const next = { ...plan, stops, tour: null };
    setPlan(next);
    toast(t.toastAdded);
    api.savePlan(profile, next).then(setPlan).catch(() => {});
  }

  return (
    <div className="page">
      <Back />
      <div className="photo-ph"><span className="mono small muted" style={{ background: 'var(--paper)', padding: '5px 9px', borderRadius: 6 }}>{L(p.name, lang)}</span></div>
      <div className="col gap6"><h1 className="h2">{L(p.name, lang)}</h1><span style={{ fontSize: 14, fontWeight: 700, color: st.color }}>● {st.text}{p.hoursLabel ? ' · ' + L(p.hoursLabel, lang) : ''}</span></div>
      {rows.length > 0 && <div className="card list">{rows.map(([k, v]) => <div key={k} className="list-row between" style={{ fontSize: 15 }}><span className="muted">{k}</span><span className="b">{L(v, lang)}</span></div>)}</div>}
      {free && <div className="note green">{free}</div>}
      {p.note && <div className="note gold">{L(p.note, lang)}</div>}
      {story && !isMember && (
        <div className="col gap6">
          <span className="eyebrow" style={{ color: 'var(--terra-dark)' }}>{profile.role === 'leader' ? t.storyLeader : t.storySolo}</span>
          <div style={{ fontSize: 16, lineHeight: 1.5 }}>{story}</div>
          {canSpeak() && <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => { if (playing) { stopSpeaking(); setPlaying(false); } else { setPlaying(true); speak(story, lang, undefined, () => setPlaying(false)); } }}>{playing ? '❚❚' : '▶'} {t.storySolo}</button>}
        </div>
      )}
      {isMember && <div className="note green">{t.guideTellsD.replace('Marco', group?.leaderName || t.guide)}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: isMember ? '1fr' : '1fr 1fr', gap: 10 }}>
        {p.url ? <a className="btn sm" href={p.url} target="_blank" rel="noreferrer" onClick={() => toast(t.toastBook)}>{t.book}</a> : <a className="btn sm" href={mapsDirections(p)} target="_blank" rel="noreferrer">{t.directions}</a>}
        {!isMember && <button className="btn outline sm" onClick={addToPlan}>{inPlan ? '✓ ' + t.alreadyInPlan : t.addToPlan}</button>}
      </div>
      {p.url && <a className="btn ghost" href={mapsDirections(p, pos && distance(pos, p) > 2500 ? 'transit' : 'walking')} target="_blank" rel="noreferrer">{t.directions} →</a>}
      <div className="small muted">{t.priceNote}</div>
    </div>
  );
}
