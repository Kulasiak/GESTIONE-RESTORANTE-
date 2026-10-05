import { useApp } from '../state';
import { fmt } from '../i18n';
import { fmtDistance, mapsDirections, walkMinutes } from '../lib/geo';
import * as api from '../lib/api';
import { L, type Lang } from '../i18n';
import { PLACES } from '../data/rome';

/** Nome leggibile di una zona a rischio (id del luogo, oppure linea bus). */
const riskName = (id: string, lang: Lang) => (id === 'bus64' ? 'Bus 64' : PLACES[id] ? L(PLACES[id].name, lang) : id);

type View = { tone: string; title: string; desc?: string; big?: string; tips?: string[];
  primary: { label: string; on: () => void; href?: string }; secondary?: { label: string; on: () => void; href?: string }; tertiary?: { label: string; on: () => void } };

export function AlertSheet() {
  const { t, lang, sheet, setSheet, go, zone, group, profile, toast, nav, members } = useApp();
  if (!sheet || nav.screen !== 'app') return null;
  const phoneOf = (id: string) => members.find((m) => m.userId === id)?.phone ?? null;
  const close = () => setSheet(null);
  let v: View;
  switch (sheet.kind) {
    case 'zone':
      v = {
        tone: 'var(--red)', title: t.zoneT, desc: t.zoneDx, big: fmtDistance(zone?.distance ?? sheet.distance),
        primary: { label: t.zoneGo, href: zone ? mapsDirections(zone.center) : undefined, on: () => { close(); go({ tab: 'map' }); } },
        secondary: group?.leaderPhone ? { label: t.callLeader, href: 'tel:' + group.leaderPhone, on: close } : undefined,
        tertiary: { label: t.zoneOk, on: () => {
          close();
          toast(t.toastLeader);
          if (group && profile.userId) api.sendAlert({ groupId: group.id, senderId: profile.userId, targetUserId: group.leaderId, kind: 'im_ok', message: null, lat: null, lng: null, distance: null }).catch(() => {});
        } },
      };
      break;
    case 'theft':
      v = { tone: 'var(--red)', title: t.theftT, desc: riskName(sheet.zone, lang) + ' · ' + t.theftHere, tips: [t.theft1, t.theft2, t.theft3], primary: { label: t.theftOk, on: close } };
      break;
    case 'memberOut':
      v = {
        tone: 'var(--red)', title: fmt(t.memberOut, { name: sheet.name }), desc: sheet.distance != null ? fmt(t.memberOutD, { d: fmtDistance(sheet.distance) }) : undefined,
        big: sheet.distance != null ? fmtDistance(sheet.distance) : undefined,
        primary: { label: t.zoneLSee, on: () => { close(); go({ tab: 'map' }); } }, tertiary: { label: t.dismiss, on: close },
        secondary: phoneOf(sheet.userId) ? { label: fmt(t.callName, { name: sheet.name.split(' ')[0] }), href: 'tel:' + phoneOf(sheet.userId), on: close } : undefined,
      };
      break;
    case 'memberSos':
      v = {
        tone: 'var(--red)', title: fmt(t.memberSos, { name: sheet.name }),
        primary: sheet.lat != null && sheet.lng != null ? { label: t.directions, href: mapsDirections({ lat: sheet.lat, lng: sheet.lng }), on: close } : { label: t.zoneLSee, on: () => { close(); go({ tab: 'map' }); } },
        secondary: sheet.userId && phoneOf(sheet.userId) ? { label: fmt(t.callName, { name: sheet.name.split(' ')[0] }), href: 'tel:' + phoneOf(sheet.userId), on: close } : { label: t.callPolice, href: 'tel:112', on: close },
        tertiary: { label: t.dismiss, on: close },
      };
      break;
    case 'off':
      v = {
        tone: '#8A5E0E', title: t.offT, desc: t.offD + ' ' + (PLACES[sheet.name] ? L(PLACES[sheet.name].name, lang) : sheet.name), big: walkMinutes(sheet.distance) + ' min',
        primary: { label: t.offGo, href: mapsDirections(sheet.to), on: () => { close(); toast(t.toastRoute); } }, tertiary: { label: t.dismiss, on: close },
      };
      break;
    case 'message':
      v = { tone: 'var(--green)', title: t.leaderMsg, desc: sheet.text, primary: { label: t.gotIt, on: close } };
      break;
    case 'planPublished':
      v = { tone: 'var(--terra)', title: t.planPublished, primary: { label: t.planToday, on: () => { close(); go({ tab: 'today' }); } }, tertiary: { label: t.dismiss, on: close } };
      break;
  }
  const btn = (b: View['primary'], cls: string) => b.href
    ? <a className={cls} href={b.href} target={b.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" onClick={b.on}>{b.label}</a>
    : <button className={cls} onClick={b.on}>{b.label}</button>;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="alert-title" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet">
        <div className="row gap8"><div style={{ width: 10, height: 10, borderRadius: '50%', background: v.tone }} /><span className="eyebrow" style={{ color: v.tone, fontSize: 12 }}>{t.alertLabel}</span></div>
        <h2 id="alert-title" className="h2" style={{ lineHeight: 1.02, textWrap: 'balance' }}>{v.title}</h2>
        {v.desc && <div style={{ fontSize: 16, lineHeight: 1.45, color: 'var(--ink-2)' }}>{v.desc}</div>}
        {v.big && <div className="serif" style={{ fontSize: 66, color: v.tone }}>{v.big}</div>}
        {v.tips && <div className="col gap8">{v.tips.map((x, i) => <div key={i} className="row gap10" style={{ padding: 12, borderRadius: 14, background: 'var(--red-soft)', fontSize: 14, lineHeight: 1.4, alignItems: 'flex-start' }}><span className="b" style={{ color: 'var(--red-ink)' }}>{i + 1}</span><span>{x}</span></div>)}</div>}
        <div className="col gap8" style={{ marginTop: 4 }}>
          {btn(v.primary, 'btn' + (v.tone === 'var(--red)' ? ' red' : v.tone === 'var(--green)' ? ' dark' : ''))}
          {v.secondary && btn(v.secondary, 'btn outline sm')}
          {v.tertiary && <button className="btn ghost" onClick={v.tertiary.on}>{v.tertiary.label}</button>}
        </div>
      </div>
    </div>
  );
}
