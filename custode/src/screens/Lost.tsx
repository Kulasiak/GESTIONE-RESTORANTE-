import { useEffect, useState } from 'react';
import { useApp } from '../state';
import { Back } from '../components/ui';
import { L } from '../i18n';
import { EMBASSIES, ROME_CENTER } from '../data/rome';
import { nearbyServices, nearestOf, type Poi } from '../lib/nearby';
import { distance, fmtDistance, mapsDirections } from '../lib/geo';

export function Lost() {
  const { t, lang, pos, profile, go } = useApp();
  const [police, setPolice] = useState<Poi | null | undefined>(undefined);
  const here = pos ?? ROME_CENTER;
  useEffect(() => {
    nearbyServices(here, 2000).then((l) => setPolice(nearestOf(l, 'police') ?? null)).catch(() => setPolice(null));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const emb = profile.nationality ? EMBASSIES[profile.nationality] : undefined;

  const steps = [
    { title: t.lost1, desc: t.lost1Dx, extra: police === undefined ? t.searching : police ? `${t.nearest}: ${police.name} · ${fmtDistance(police.dist)}` : null, link: police ? mapsDirections(police) : null },
    { title: t.lost2, desc: t.lost2Dx, extra: emb ? `${L(emb.name, lang)} · ${emb.address} · ${fmtDistance(distance(here, emb))}` : null, link: emb ? emb.url : null },
    { title: t.lost3, desc: t.lost3D, extra: null, link: null },
  ];
  return (
    <div className="page">
      <Back />
      <h1 className="h2">{t.lostTitle}</h1>
      {steps.map((s, i) => (
        <div key={i} className="card row gap14" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 'none', width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--paper)', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700 }}>{i + 1}</div>
          <div className="col gap4 grow">
            <span style={{ fontSize: 16, fontWeight: 700 }}>{s.title}</span>
            <span className="muted" style={{ fontSize: 14, lineHeight: 1.4 }}>{s.desc}</span>
            {s.extra && <span className="small b" style={{ paddingTop: 4 }}>{s.extra}</span>}
            {s.link && <a className="link" href={s.link} target="_blank" rel="noreferrer">{i === 0 ? t.directions : t.officialSite} →</a>}
          </div>
        </div>
      ))}
      {emb && <div className="small muted">{t.verifyNote}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <a className="btn red sm" href="tel:112">{t.callPolice}</a>
        <button className="btn outline sm" onClick={() => go({ tab: 'docs' })}>{t.share}</button>
      </div>
    </div>
  );
}
