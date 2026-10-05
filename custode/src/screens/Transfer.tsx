import { useState } from 'react';
import { useApp } from '../state';
import { Back } from '../components/ui';
import { L } from '../i18n';
import { MODES, PLACES, TRANSFER } from '../data/rome';
import { distance, fmtDistance, mapsDirections, walkMinutes } from '../lib/geo';

export function Transfer() {
  const { t, lang, profile, go, toast } = useApp();
  const [airport, setAirport] = useState<'FCO' | 'CIA'>('FCO');
  const hotel = profile.hotel ?? { name: L(PLACES.hotel.name, lang), address: 'Via Cavour', lat: PLACES.hotel.lat, lng: PLACES.hotel.lng };
  const termini = PLACES.termini;
  const lastM = distance(termini, hotel);
  const airportName = airport === 'FCO' ? 'Fiumicino' : 'Ciampino';

  return (
    <div className="page">
      <Back />
      <div className="col gap4"><h1 className="h2">{t.trTitle}</h1><div className="muted" style={{ fontSize: 14 }}>→ {hotel.name}{hotel.address ? ' · ' + hotel.address : ''}</div></div>
      <div className="seg" role="tablist">
        {(['FCO', 'CIA'] as const).map((a) => (
          <button key={a} role="tab" aria-selected={airport === a} className={airport === a ? 'on' : ''} onClick={() => setAirport(a)}>{a === 'FCO' ? 'Fiumicino · FCO' : 'Ciampino · CIA'}</button>
        ))}
      </div>
      {TRANSFER[airport].map((o, i) => {
        const md = MODES[o.mode];
        const name = L(o.name, lang);
        const to = L(o.to, lang);
        return (
          <div key={i} className="card col gap10">
            <div className="row between">
              <div className="row gap6"><span className="pill" style={{ background: md.soft, color: md.color }}>{L(md.label, lang)}</span>{o.best && <span className="small b" style={{ color: 'var(--green-txt)' }}>{L(o.best, lang)}</span>}</div>
              <span className="serif" style={{ fontSize: 30 }}>{o.price}</span>
            </div>
            <div className="col gap4"><span style={{ fontSize: 17, fontWeight: 700 }}>{name}</span><span className="small muted">{to} · {o.duration} · {L(o.frequency, lang)}</span></div>
            {o.buy && o.url ? (
              <>
                <a className="btn sm" href={o.url} target="_blank" rel="noreferrer" onClick={() => toast(t.toastBook)}>{t.buyOfficial} · {o.price}</a>
                <button className="btn dashed" style={{ height: 44 }} onClick={() => go({ sub: 'addDoc', param: ['ticket', name, `${airportName} → ${to}`, o.price, o.url].join('|') })}>{t.saveTicket}</button>
              </>
            ) : !o.buy ? <div className="small muted" style={{ lineHeight: 1.4 }}>{t.taxiNote}</div> : null}
          </div>
        );
      })}
      <div className="note green col gap4" style={{ borderRadius: 18 }}>
        <span className="b" style={{ color: 'var(--ink)' }}>Termini → {hotel.name}: {t.walk.toLowerCase()} {walkMinutes(lastM)} min · {fmtDistance(lastM)}</span>
        <a className="link" style={{ color: 'var(--green-ink)' }} href={mapsDirections(hotel)} target="_blank" rel="noreferrer">{t.directions} →</a>
      </div>
      <div className="note gold">{t.ticketHow}</div>
      <div className="small muted">{t.tapGo}</div>
      <div className="col gap6" style={{ background: 'var(--red-soft)', borderRadius: 18, padding: 16 }}>
        <span className="eyebrow" style={{ color: 'var(--red-ink)' }}>{t.safetyTip}</span>
        <span style={{ fontSize: 15, lineHeight: 1.45 }}>{t.trTip}</span>
      </div>
      <div className="small muted">{t.priceNote}</div>
    </div>
  );
}
