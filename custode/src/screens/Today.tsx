import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state';
import { LangSwitch, initials } from '../components/ui';
import { L, LOCALE, fmt } from '../i18n';
import { TIPS, TOURS, PRESET_PLANS } from '../data/rome';
import { buildSteps, stopName } from '../lib/planview';
import { distance, fmtDistance } from '../lib/geo';
import { romeNow } from '../lib/hours';
import { romeTemperature } from '../lib/nearby';
import * as api from '../lib/api';
import { AccessLine } from './Access';

export function Today() {
  const { t, lang, profile, go, plan, setPlan, group, members, zone, pos, posError, inRisk, lastLeaderMsg, toast, days, day, setDay } = useApp();
  const dayIdx = days.indexOf(day);
  const isToday = day === api.today();
  const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(d + 'T12:00:00Z').toLocaleDateString(LOCALE[lang], { ...opts, timeZone: 'UTC' });
  const [open, setOpen] = useState<number>(-2);
  const [tipIdx, setTipIdx] = useState(() => new Date().getDate() % TIPS.length);
  const [temp, setTemp] = useState<number | null>(null);
  useEffect(() => { romeTemperature().then(setTemp); }, []);

  const isSolo = profile.role === 'solo' || !profile.groupId;
  const isLeader = profile.role === 'leader';
  const isMember = profile.role === 'member';

  // Turista singolo senza programma: parte dal primo itinerario del design
  useEffect(() => {
    if (isSolo && !plan) setPlan(api.presetPlan(TOURS[Math.max(0, dayIdx) % TOURS.length].id, day));
  }, [isSolo, plan, setPlan, day, dayIdx]);

  const steps = useMemo(() => (plan ? buildSteps(plan, lang, t, profile) : []), [plan, lang, t, profile]);
  const nowIdx = steps.findIndex((s) => s.isNow);
  const openIdx = open === -2 ? (nowIdx >= 0 ? Math.min(nowIdx + 1, steps.length - 1) : 1) : open;

  const n = romeNow();
  const dateLine = new Date().toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'Europe/Rome' }).toUpperCase() + (temp != null ? ` · ${temp}°` : '');
  const greet = n.minutes < 12 * 60 ? t.greetMorning : n.minutes < 18 * 60 ? t.greetAfternoon : t.greetEvening;

  // Stato sicurezza
  const memberRows = members.filter((m) => m.role === 'member');
  const memberState = (m: api.Member) => (zone && m.lat != null && m.lng != null ? (distance({ lat: m.lat, lng: m.lng }, zone.center) <= zone.radius ? 'in' : 'out') : 'none');
  let safety: { bg: string; dot: string; title: string; desc: string };
  if (!pos && posError) safety = { bg: 'var(--gold-soft)', dot: 'var(--gold)', title: t.noGps, desc: t.noGpsD };
  else if (isLeader && group) {
    const inside = memberRows.filter((m) => memberState(m) === 'in').length;
    const out = memberRows.filter((m) => memberState(m) === 'out');
    const first = out[0];
    safety = out.length
      ? { bg: 'var(--gold-soft)', dot: 'var(--gold)', title: fmt(t.leaderStat, { n: inside, m: memberRows.length }), desc: fmt(t.leaderStatD, { name: first.name, d: fmtDistance(distance({ lat: first.lat!, lng: first.lng! }, zone!.center)) }) }
      : { bg: 'var(--green-soft)', dot: 'var(--green)', title: fmt(t.leaderStat, { n: inside, m: memberRows.length }), desc: t.leaderAllIn };
  } else if (isMember && zone && zone.distance != null) {
    safety = zone.out
      ? { bg: 'var(--red-soft)', dot: 'var(--red)', title: t.outZone, desc: fmt(t.outZoneD, { d: fmtDistance(zone.distance) }) }
      : { bg: 'var(--green-soft)', dot: 'var(--green)', title: t.withGroup, desc: fmt(t.withGroupD, { d: fmtDistance(zone.distance) }) };
  } else if (inRisk) safety = { bg: 'var(--gold-soft)', dot: 'var(--gold)', title: t.riskNear, desc: t.theftHere };
  else safety = { bg: 'var(--green-soft)', dot: 'var(--green)', title: t.calm, desc: t.calmD };

  const tourLabel = (id: string | null) => (id ? L(TOURS.find((x) => x.id === id)?.label, lang) : '') || t.customPlan;
  const planBy = isLeader ? fmt(t.yourPlan, { tour: tourLabel(plan?.tour ?? null) }) : fmt(t.planByLeader, { name: group?.leaderName ?? '', tour: tourLabel(plan?.tour ?? null) });

  async function chooseTour(id: string) {
    const p: api.Plan = { ...api.presetPlan(id, day), id: plan?.id ?? null, stops: PRESET_PLANS[id].map((s) => ({ ...s })) };
    setPlan(p);
    setOpen(-2);
    api.savePlan(profile, p).then(setPlan).catch(() => {});
  }

  return (
    <div className="page" style={{ gap: 18 }}>
      <div className="row between gap8">
        <span className="eyebrow" style={{ letterSpacing: '.12em' }}>{dateLine}</span>
        <div className="row gap6">
          <LangSwitch />
          <button className="back" style={{ width: 36, height: 36, fontSize: 16 }} aria-label={t.settings} onClick={() => go({ sub: 'settings' })}>⚙</button>
        </div>
      </div>
      <div className="col gap4">
        <h1 className="h1" style={{ fontSize: 38 }}>{greet}{profile.name ? ', ' + profile.name : ''}</h1>
        <div className="muted" style={{ fontSize: 15 }}>{t.rome}{dayIdx >= 0 ? ' · ' + fmt(t.dayOfN, { n: dayIdx + 1, m: days.length }) : ''}{group ? ' · ' + group.name : ''}</div>
        <AccessLine />
      </div>

      <button className="row gap14" style={{ textAlign: 'left', padding: 16, borderRadius: 20, border: 'none', background: safety.bg }} onClick={() => go({ tab: 'map' })}>
        <div style={{ flex: 'none', width: 14, height: 14, borderRadius: '50%', background: safety.dot, boxShadow: '0 0 0 6px rgba(255,255,255,.7)' }} />
        <div className="col gap4 grow" style={{ paddingLeft: 4 }}><span style={{ fontSize: 16, fontWeight: 700 }}>{safety.title}</span><span style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.35 }}>{safety.desc}</span></div>
        <span style={{ fontSize: 18 }} aria-hidden>→</span>
      </button>

      {isMember && lastLeaderMsg?.message && (
        <div className="note green col gap4"><span className="b">{t.leaderMsg}</span><span>{lastLeaderMsg.message}</span></div>
      )}

      {group && !isSolo && (
        <div className="card col gap14">
          <div className="row between" style={{ alignItems: 'baseline' }}><span style={{ fontSize: 16, fontWeight: 700 }}>{group.name}</span><span className="small muted">{members.length} {t.people}</span></div>
          <div className="row gap8 wrap">
            {members.slice(0, 7).map((m) => {
              const st = m.role === 'leader' ? 'in' : memberState(m);
              return <div key={m.userId} className="avatar" title={m.name} style={{ boxShadow: `0 0 0 2.5px ${st === 'in' ? 'var(--green)' : st === 'out' ? 'var(--red)' : 'var(--line-3)'}` }}>{initials(m.name)}</div>;
            })}
            {members.length > 7 && <div className="small muted b" style={{ paddingLeft: 4 }}>+{members.length - 7}</div>}
          </div>
          {isLeader && (
            <>
              <button className="row between" style={{ border: '1px dashed var(--dash)', borderRadius: 12, background: 'transparent', padding: '10px 12px' }}
                onClick={() => { navigator.clipboard?.writeText(group.code).then(() => toast(group.code)).catch(() => {}); }}>
                <span className="small muted b">{t.groupCode}</span><span className="mono b" style={{ letterSpacing: '.1em' }}>{group.code}</span>
              </button>
              <button className="btn outline sm" onClick={() => go({ sub: 'editor' })}>{t.editPlan}</button>
            </>
          )}
        </div>
      )}

      {days.length > 1 && (
        <div className="chips" role="tablist" aria-label={t.tripDates}>
          {days.map((d, i) => (
            <button key={d} role="tab" aria-selected={d === day} className={'chip' + (d === day ? ' on' : '')} onClick={() => setDay(d)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.15, padding: '6px 14px' }}>
              <span>{fmt(t.dayN, { n: i + 1 })}</span>
              <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.75 }}>{dayLabel(d, { weekday: 'short', day: 'numeric' })}</span>
            </button>
          ))}
        </div>
      )}

      {(dayIdx <= 0) && <button className="row gap14" style={{ textAlign: 'left', padding: 14, borderRadius: 20, border: '1px solid var(--line)', background: '#fff' }} onClick={() => go({ sub: 'transfer' })}>
        <div className="mono" style={{ flex: 'none', width: 52, height: 52, borderRadius: 14, background: 'var(--ink)', color: 'var(--paper)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700 }}>FCO</div>
        <div className="col gap4 grow"><span className="eyebrow" style={{ letterSpacing: '.1em' }}>{t.day1}</span><span style={{ fontSize: 16, fontWeight: 700 }}>{t.arrivalT}</span><span className="small muted">{t.arrivalD}</span></div>
        <span style={{ fontSize: 18 }} aria-hidden>→</span>
      </button>}

      <div className="col gap10" style={{ paddingTop: 6 }}>
        <div className="row between" style={{ alignItems: 'baseline' }}><h2 className="h3">{isToday ? t.planToday : fmt(t.planOf, { date: dayLabel(day, { weekday: 'long', day: 'numeric', month: 'long' }) })}</h2><button className="link" onClick={() => go({ tab: 'map' })}>{t.openMap}</button></div>
        {isSolo ? (
          <div className="chips">
            {TOURS.map((x) => <button key={x.id} className={'chip' + (plan?.tour === x.id ? ' on' : '')} onClick={() => chooseTour(x.id)}>{L(x.label, lang)}</button>)}
          </div>
        ) : plan ? <div className="muted" style={{ fontSize: 14 }}>{planBy}</div> : null}
        {plan?.stops[0] && <div className="small muted">{fmt(t.fromPlace, { place: stopName(plan.stops[0], lang, profile) })}</div>}
      </div>

      {!plan && isMember && <div className="note gold">{t.noPlanYet}</div>}
      {isLeader && !plan && <button className="btn" onClick={() => go({ sub: 'editor' })}>{t.editPlan}</button>}

      <div className="col">
        {steps.map((s) => (
          <div key={s.i} className="col">
            {s.hasLeg && (
              <div className="tl-leg">
                <div />
                <div className="line"><div /></div>
                <div className="row gap8 wrap" style={{ padding: '6px 0' }}><span className="pill" style={{ background: s.legSoft, color: s.legColor }}>{s.legLabel}</span><span className="small muted">{s.legText}</span></div>
              </div>
            )}
            <button className="tl-stop" aria-expanded={openIdx === s.i} onClick={() => setOpen(openIdx === s.i ? -1 : s.i)}>
              <div className="tnum" style={{ fontSize: 15, fontWeight: 700, paddingTop: 13, color: s.isNow ? 'var(--terra)' : s.done ? 'var(--muted)' : 'var(--ink)' }}>{s.time}</div>
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 15 }}>
                <div className="tl-dot" style={s.isNow ? { background: 'var(--terra)', borderColor: 'var(--terra)' } : s.done ? { background: 'var(--green)', borderColor: 'var(--green)' } : undefined} />
              </div>
              <div className="tl-card" style={{ background: s.done ? '#F4EEE4' : '#fff', borderColor: s.isNow ? 'var(--terra)' : undefined }}>
                <div className="row between gap8" style={{ alignItems: 'flex-start' }}><div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.25 }}>{s.name}</div>{s.isNow && <span className="tl-now">{t.now}</span>}</div>
                {s.meta && <div className="small muted">{s.meta}</div>}
                {s.tip && <div className="small" style={{ color: 'var(--terra-dark)', lineHeight: 1.4, paddingTop: 2 }}>{s.tip}</div>}
                {openIdx === s.i && s.detail.length > 0 && (
                  <div className="minute">
                    <span className="eyebrow">{t.minute}</span>
                    {s.detail.map((d, k) => <div key={k} className="r"><span className="tnum b">{d.tm}</span><span>{d.x}</span></div>)}
                  </div>
                )}
              </div>
            </button>
          </div>
        ))}
      </div>

      <div className="col gap8" style={{ background: 'var(--gold-soft)', borderRadius: 20, padding: 16 }}>
        <span className="eyebrow" style={{ color: 'var(--gold-ink)' }}>{t.tipTitle}</span>
        <div style={{ fontSize: 16, lineHeight: 1.45 }}>{L(TIPS[tipIdx % TIPS.length], lang)}</div>
        <button className="link" style={{ alignSelf: 'flex-start', color: 'var(--gold-ink)' }} onClick={() => setTipIdx(tipIdx + 1)}>{t.moreTip}</button>
      </div>
    </div>
  );
}
