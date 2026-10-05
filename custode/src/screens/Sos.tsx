import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state';
import { L, fmt } from '../i18n';
import { EMBASSIES, NUMBERS, PHRASES, ROME_CENTER } from '../data/rome';
import { nearbyServices, nearestOf, type Poi } from '../lib/nearby';
import { distance, fmtDistance, mapsDirections, mapsLink } from '../lib/geo';
import { speak, canSpeak } from '../lib/speech';
import * as api from '../lib/api';

const SHARE_KEY = 'custode.shareUntil';
const SHARE_MS = 2 * 3600_000;

export function Sos() {
  const { t, lang, pos, profile, group, toast } = useApp();
  const [count, setCount] = useState<number | null>(null);
  const timer = useRef(0);
  const [shareUntil, setShareUntil] = useState<number>(() => Number(localStorage.getItem(SHARE_KEY) ?? 0));
  const sharing = shareUntil > Date.now();
  const [pois, setPois] = useState<Poi[] | null>(null);
  const here = pos ?? ROME_CENTER;

  useEffect(() => { nearbyServices(here, 2500).then(setPois).catch(() => setPois([])); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearInterval(timer.current), []);

  function press() {
    if (count !== null) return;
    navigator.vibrate?.(80);
    setCount(3);
    let n = 3;
    timer.current = window.setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(timer.current);
        setCount(0);
        // Avvisa il capogruppo con la posizione, poi chiama il 112
        if (group && profile.userId && profile.role === 'member') {
          api.sendAlert({ groupId: group.id, senderId: profile.userId, targetUserId: group.leaderId, kind: 'sos', message: null, lat: pos?.lat ?? null, lng: pos?.lng ?? null, distance: null }).catch(() => {});
        }
        window.location.href = 'tel:112';
        setTimeout(() => setCount(null), 4000);
      } else setCount(n);
    }, 1000);
  }
  const cancel = () => { clearInterval(timer.current); setCount(null); };

  async function toggleShare() {
    if (sharing) {
      localStorage.removeItem(SHARE_KEY);
      setShareUntil(0);
      toast(t.toastShareOff);
      if (profile.userId && pos) api.pushLocation(profile.userId, profile.groupId ?? null, pos.lat, pos.lng, pos.accuracy, false, null).catch(() => {});
      return;
    }
    const until = Date.now() + SHARE_MS;
    localStorage.setItem(SHARE_KEY, String(until));
    setShareUntil(until);
    if (profile.userId && pos) api.pushLocation(profile.userId, profile.groupId ?? null, pos.lat, pos.lng, pos.accuracy, false, new Date(until).toISOString()).catch(() => {});
    // Contatto di fiducia: invio del link con la posizione (WhatsApp, SMS, email…)
    const text = `${t.shareMsg} ${mapsLink(here)}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Custode', text });
      else { await navigator.clipboard.writeText(text); }
    } catch { /* condivisione annullata */ }
    toast(t.toastShareOn);
  }

  const police = pois ? nearestOf(pois, 'police') : undefined;
  const hospital = pois ? nearestOf(pois, 'hospital') : undefined;
  const emb = profile.nationality ? EMBASSIES[profile.nationality] : undefined;
  const near: { k: string; n: string; d: string; to: { lat: number; lng: number } | null }[] = [
    { k: t.nearPolice, n: pois === null ? t.searching : police?.name || '—', d: police ? fmtDistance(police.dist) : '', to: police ?? null },
    { k: t.nearHosp, n: pois === null ? t.searching : hospital?.name || '—', d: hospital ? fmtDistance(hospital.dist) : '', to: hospital ?? null },
    ...(emb ? [{ k: t.nearEmb, n: `${L(emb.name, lang)} · ${emb.address}`, d: fmtDistance(distance(here, emb)), to: emb }] : []),
  ];

  return (
    <div className="page" style={{ gap: 18 }}>
      <div className="col gap6"><h1 className="h1" style={{ fontSize: 38 }}>{t.sosTitle}</h1><div className="muted" style={{ fontSize: 14, lineHeight: 1.4 }}>{t.num112}</div></div>
      <div className="col gap18" style={{ alignItems: 'center', padding: '26px 0 8px' }}>
        <button className="sos-btn" onClick={press} aria-label={t.callPolice}>
          <span className="serif" style={{ fontSize: 76, lineHeight: 0.9 }}>{count === null || count === 0 ? '112' : count}</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{count === null ? t.sosHold : count === 0 ? t.sosCalling : t.sosIn}</span>
        </button>
        {count !== null && count > 0 && <button className="chip" style={{ marginTop: 14, border: '1.5px solid var(--ink)', background: 'transparent', fontSize: 15, fontWeight: 700, padding: '10px 22px' }} onClick={cancel}>{t.cancel}</button>}
      </div>

      <button className="card row gap12" style={{ textAlign: 'left' }} onClick={toggleShare} aria-pressed={sharing}>
        <div className="col gap4 grow"><span style={{ fontSize: 16, fontWeight: 700 }}>{t.sharePos}</span>
          <span className="small muted">{sharing ? fmt(t.sharedUntil, { t: new Date(shareUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }) : t.sharePosD}</span></div>
        <div className={'toggle' + (sharing ? ' on' : '')}><i /></div>
      </button>
      {sharing && <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => navigator.share?.({ title: 'Custode', text: `${t.shareMsg} ${mapsLink(here)}` }).catch(() => {})}>{t.shareNow} →</button>}

      <div className="col gap8">
        <span className="eyebrow">{t.nearYou}</span>
        <div className="card list">
          {near.map((r) => (
            <div key={r.k} className="list-row">
              <div className="col gap4 grow"><span className="eyebrow" style={{ letterSpacing: '.08em' }}>{r.k}</span><span style={{ fontSize: 15, fontWeight: 600 }}>{r.n}</span></div>
              {r.to && <a className="chip" style={{ background: 'var(--paper-2)', border: 'none', fontSize: 13, fontWeight: 700, textDecoration: 'none' }} href={mapsDirections(r.to)} target="_blank" rel="noreferrer">{r.d} →</a>}
            </div>
          ))}
        </div>
      </div>

      <div className="col gap8">
        <span className="eyebrow">{t.numbers}</span>
        <div className="card list">
          {NUMBERS.map((n) => (
            <div key={n.tel} className="list-row">
              <div className="col gap4 grow"><span style={{ fontSize: 15, fontWeight: 600 }}>{t[n.key]}</span><span className="small muted tnum">{n.tel === '063570' ? '06 3570' : n.tel}</span></div>
              <a className="chip" style={{ background: n.tel === '112' ? 'var(--red)' : 'var(--paper-2)', color: n.tel === '112' ? '#fff' : 'var(--ink)', border: 'none', fontSize: 13, fontWeight: 700, textDecoration: 'none' }} href={'tel:' + n.tel}>☎ {n.tel === '063570' ? '06 3570' : n.tel}</a>
            </div>
          ))}
        </div>
      </div>

      <div className="col gap8">
        <span className="eyebrow">{t.phrases}</span>
        {PHRASES.map((p) => (
          <button key={p.it} className="phrase" onClick={() => canSpeak() && speak(p.it, 'it')} aria-label={`${t.listenIt}: ${p.it}`}>
            <div className="col gap4 grow"><span className="serif" style={{ fontSize: 22, lineHeight: 1.1 }}>{p.it}</span>{lang !== 'it' && <span className="small muted">{L(p.tr, lang)}</span>}</div>
            {canSpeak() && <span aria-hidden style={{ color: 'var(--terra)', fontSize: 16 }}>▶</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
