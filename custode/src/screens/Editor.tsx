import { useEffect, useRef, useState } from 'react';
import L_ from 'leaflet';
import { useApp } from '../state';
import { Back } from '../components/ui';
import { L, fmt } from '../i18n';
import { MODES, MODE_LIST, PLACES, PRESET_PLANS, ROME_CENTER, TOURS, stopPoint, type Stop } from '../data/rome';
import { stopName } from '../lib/planview';
import { addMin } from '../lib/hours';
import { distance, walkMinutes, type LatLng } from '../lib/geo';
import * as api from '../lib/api';

const pinIcon = L_.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11], html: '<div style="width:22px;height:22px;border-radius:50%;background:#4E6B4A;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>' });

/** Mappa piccola: tocca per spostare il punto d'incontro, cerchio = raggio della zona. */
function MeetingMap({ point, radius, onPick }: { point: LatLng; radius: number; onPick: (p: LatLng) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const m = useRef<{ map: L_.Map; mk: L_.Marker; c: L_.Circle } | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  useEffect(() => {
    if (!el.current) return;
    const map = L_.map(el.current, { zoomControl: false, attributionControl: false }).setView([point.lat, point.lng], 15);
    L_.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'map-tiles' }).addTo(map);
    const c = L_.circle([point.lat, point.lng], { radius, color: '#4E6B4A', weight: 1.5, dashArray: '5 4', fillOpacity: 0.14 }).addTo(map);
    const mk = L_.marker([point.lat, point.lng], { icon: pinIcon }).addTo(map);
    map.on('click', (e: L_.LeafletMouseEvent) => pickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    m.current = { map, mk, c };
    return () => { map.remove(); m.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!m.current) return;
    m.current.mk.setLatLng([point.lat, point.lng]);
    m.current.c.setLatLng([point.lat, point.lng]).setRadius(radius);
    m.current.map.panTo([point.lat, point.lng]);
  }, [point.lat, point.lng, radius]);
  return <div ref={el} style={{ height: 220, borderRadius: 16, overflow: 'hidden', background: '#EDE4D3' }} />;
}

export default function Editor() {
  const { t, lang, profile, plan, setPlan, group, setGroup, members, pos, toast, go, days, day, setDay } = useApp();
  const [tour, setTour] = useState<string | null>(plan?.tour ?? TOURS[0].id);
  const [stops, setStops] = useState<Stop[]>(() => (plan?.stops.length ? plan.stops : PRESET_PLANS[TOURS[0].id]).map((s) => ({ ...s })));
  const [meeting, setMeeting] = useState(() => group?.meeting ?? { name: '', lat: ROME_CENTER.lat, lng: ROME_CENTER.lng, time: '' });
  const [radius, setRadius] = useState(group?.radius ?? 150);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Cambio giorno: carica il programma di quel giorno (o il primo itinerario pronto)
  const loadedDay = useRef(day);
  useEffect(() => {
    if (loadedDay.current === day) return; // stesso giorno: non toccare le modifiche in corso
    if (plan && plan.day !== day) return; // aspetta il programma del nuovo giorno
    loadedDay.current = day;
    setTour(plan?.tour ?? (plan ? null : TOURS[0].id));
    setStops((plan?.stops.length ? plan.stops : PRESET_PLANS[TOURS[0].id]).map((s) => ({ ...s })));
  }, [day, plan?.id, plan?.day]); // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (i: number, patch: Partial<Stop>) => { setStops((s) => s.map((x, k) => (k === i ? { ...x, ...patch } : x))); setTour(null); };
  const remove = (i: number) => { setStops((s) => s.filter((_, k) => k !== i)); setTour(null); };
  const move = (i: number, d: -1 | 1) => setStops((s) => {
    const j = i + d;
    if (j < 1 || j >= s.length - 1) return s;
    const c = [...s];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  });

  function addStop(placeId: string) {
    setAdding(false);
    setStops((s) => {
      const lastIsHotel = s.length > 1 && s[s.length - 1].place === 'hotel';
      const at = lastIsHotel ? s.length - 1 : s.length;
      const prev = s[at - 1];
      const a = prev ? stopPoint(prev) : null;
      const mins = a ? walkMinutes(distance(a, PLACES[placeId])) : 10;
      const st: Stop = { time: prev ? addMin(prev.time, 75) : '09:00', place: placeId, mode: mins > 30 ? 'bus' : 'walk', minutes: Math.min(40, mins), leg: null, tip: null, price: PLACES[placeId].full, duration: { it: '1 h', en: '1 h' } };
      const c = [...s];
      c.splice(at, 0, st);
      return c;
    });
    setTour(null);
  }

  async function publish() {
    setBusy(true);
    try {
      const saved = await api.savePlan(profile, { id: plan?.id ?? null, tour, stops, publishedAt: plan?.publishedAt ?? null, day }, true);
      setPlan(saved);
      if (group) {
        const g = { ...group, meeting: meeting.name || group.meeting ? meeting : null, radius };
        await api.updateGroup(g);
        setGroup(g);
        if (profile.userId) await api.sendAlert({ groupId: g.id, senderId: profile.userId, targetUserId: null, kind: 'plan_published', message: null, lat: null, lng: null, distance: null });
      }
      toast(fmt(t.planSent, { n: Math.max(0, members.length - 1) }));
      go({ tab: 'today' });
    } catch {
      toast(navigator.onLine ? t.errGeneric : t.needsOnline);
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!msg.trim() || !group || !profile.userId) return;
    try {
      await api.sendAlert({ groupId: group.id, senderId: profile.userId, targetUserId: null, kind: 'message', message: msg.trim(), lat: null, lng: null, distance: null });
      setMsg('');
      toast(t.msgSent);
    } catch {
      toast(navigator.onLine ? t.errGeneric : t.needsOnline);
    }
  }

  const placeOptions = Object.values(PLACES).filter((p) => p.kind !== 'hotel').sort((a, b) => L(a.name, lang).localeCompare(L(b.name, lang)));

  return (
    <div className="page">
      <Back />
      <div className="col gap4"><h1 className="h2">{t.edTitle}</h1><div className="muted" style={{ fontSize: 14 }}>{group ? `${group.name} · ${members.length} ${t.people} · ${group.code}` : ''}</div></div>
      {days.length > 1 && (
        <div className="chips">
          {days.map((d, i) => <button key={d} className={'chip' + (d === day ? ' on' : '')} onClick={() => setDay(d)}>{fmt(t.dayN, { n: i + 1 })}</button>)}
        </div>
      )}
      <div className="chips">
        {TOURS.map((x) => <button key={x.id} className={'chip' + (tour === x.id ? ' on' : '')} onClick={() => { setTour(x.id); setStops(PRESET_PLANS[x.id].map((s) => ({ ...s }))); }}>{L(x.label, lang)}</button>)}
      </div>

      <div className="card" style={{ padding: '4px 12px' }}>
        {stops.map((s, i) => {
          const md = s.mode ? MODES[s.mode] : null;
          const last = i === stops.length - 1;
          return (
            <div key={i} className="list-row" style={{ gap: 10, padding: '10px 0' }}>
              <input type="time" aria-label={t.meetTime} value={s.time} onChange={(e) => e.target.value && edit(i, { time: e.target.value })}
                style={{ flex: 'none', width: 116, height: 38, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--paper)', fontSize: 14, fontWeight: 700, textAlign: 'center', padding: 0 }} />
              <div className="col gap4 grow">
                <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>{stopName(s, lang, profile)}</span>
                {md && (
                  <button className="pill" style={{ alignSelf: 'flex-start', border: 'none', background: md.soft, color: md.color, fontSize: 11, padding: '4px 8px' }}
                    onClick={() => edit(i, { mode: MODE_LIST[(MODE_LIST.indexOf(s.mode!) + 1) % MODE_LIST.length], leg: null, detail: null })}>
                    {L(md.label, lang)}{s.minutes ? ' · ' + s.minutes + ' min' : ''} ⇄
                  </button>
                )}
              </div>
              {i > 1 && !last && <button className="back" style={{ width: 32, height: 32, fontSize: 13 }} aria-label={t.moveUp} onClick={() => move(i, -1)}>↑</button>}
              {i > 0 && !last && <button className="back" style={{ width: 32, height: 32, fontSize: 16, color: 'var(--muted)' }} aria-label={t.deleteBtn} onClick={() => remove(i)}>×</button>}
            </div>
          );
        })}
        {adding ? (
          <select className="input" style={{ margin: '8px 0' }} defaultValue="" onChange={(e) => e.target.value && addStop(e.target.value)} aria-label={t.choosePlace}>
            <option value="" disabled>{t.choosePlace}</option>
            {placeOptions.map((p) => <option key={p.id} value={p.id}>{L(p.name, lang)}</option>)}
          </select>
        ) : (
          <button className="btn ghost" style={{ width: '100%', color: 'var(--terra)', fontWeight: 700 }} onClick={() => setAdding(true)}>+ {t.addStop}</button>
        )}
      </div>
      <div className="small muted" style={{ marginTop: -8 }}>{t.edHint}</div>

      <div className="card col gap10">
        <span className="eyebrow">{t.meet}</span>
        <div className="row gap8">
          <input className="input grow" value={meeting.name} placeholder={t.meetName} onChange={(e) => setMeeting({ ...meeting, name: e.target.value })} aria-label={t.meetName} />
          <input className="input" type="time" style={{ width: 124, flex: 'none', padding: '0 10px' }} value={meeting.time} onChange={(e) => setMeeting({ ...meeting, time: e.target.value })} aria-label={t.meetTime} />
        </div>
        <MeetingMap point={meeting} radius={radius} onPick={(p) => setMeeting({ ...meeting, ...p })} />
        <span className="small muted">{t.meetPick}</span>
        <div className="row gap8 wrap">
          {pos && <button className="chip" onClick={() => setMeeting({ ...meeting, lat: pos.lat, lng: pos.lng })}>{t.useMyPos}</button>}
          <select className="chip" style={{ maxWidth: 220 }} defaultValue="" aria-label={t.choosePlace}
            onChange={(e) => { const p = PLACES[e.target.value]; if (p) setMeeting({ ...meeting, lat: p.lat, lng: p.lng, name: meeting.name || L(p.name, lang) }); }}>
            <option value="" disabled>{t.choosePlace}</option>
            {placeOptions.map((p) => <option key={p.id} value={p.id}>{L(p.name, lang)}</option>)}
          </select>
        </div>
      </div>

      <div className="card col gap10">
        <div className="row between" style={{ alignItems: 'baseline' }}><span className="eyebrow">{t.radius}</span><span className="serif" style={{ fontSize: 28 }}>{radius} m</span></div>
        <input type="range" min={50} max={500} step={25} value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label={t.radius} />
        <span className="small muted">{t.radiusD}</span>
      </div>

      <button className="btn" disabled={busy} onClick={publish}>{busy ? '…' : t.publish}</button>

      {group && (
        <div className="card col gap10">
          <span className="eyebrow">{t.sendMsg}</span>
          <textarea className="input" value={msg} placeholder={t.msgPh} onChange={(e) => setMsg(e.target.value)} maxLength={280} />
          <button className="btn dark sm" disabled={!msg.trim()} onClick={sendMessage}>{t.send}</button>
        </div>
      )}
    </div>
  );
}
