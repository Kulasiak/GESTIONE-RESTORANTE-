import { useEffect, useState } from 'react';
import { useApp } from '../state';
import { LangSwitch } from '../components/ui';
import { LOCALE, fmt } from '../i18n';
import * as api from '../lib/api';

/** Schermata dell'agenzia: pacchetto, codici per i capigruppo e chi li sta usando. */
export function Agency() {
  const { t, lang, profile, access, reloadAccess, go, toast } = useApp();
  const [list, setList] = useState<api.AgencyCode[] | null>(null);
  const [note, setNote] = useState('');
  const [fresh, setFresh] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const date = (iso: string) => new Date(iso).toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric' });

  const load = () => api.agencyOverview().then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);

  async function issue() {
    setBusy(true);
    setErr('');
    try {
      const c = await api.agencyIssueCode(note.trim());
      setFresh(c);
      setNote('');
      await Promise.all([load(), reloadAccess()]);
    } catch (e) {
      setErr(t[api.licenseError(e)]);
    } finally {
      setBusy(false);
    }
  }

  async function copy(c: string) {
    try { await navigator.clipboard.writeText(c); toast(t.copied); } catch { toast(c); }
  }
  function share(c: string) {
    const text = fmt(t.shareCodeMsg, { code: c });
    if (navigator.share) navigator.share({ title: 'Custode', text }).catch(() => {});
    else copy(text);
  }

  const status = (c: api.AgencyCode) => !c.activatedAt ? { text: t.statusUnused, color: 'var(--muted)' }
    : c.expiresAt && Date.parse(c.expiresAt) > Date.now() ? { text: fmt(t.statusActive, { date: date(c.expiresAt) }), color: 'var(--green-txt)' }
    : { text: t.statusExpired, color: 'var(--red)' };
  const pkgExpired = api.isExpired(access);
  const slotsLeft = access ? access.groupSlots - access.usedSlots : 0;

  return (
    <main id="scroller" className="scroller">
      <div className="page" style={{ gap: 18, paddingBottom: 'calc(30px + var(--safe-b))' }}>
        <div className="row between gap8">
          <span className="eyebrow">{t.roleAgency}</span>
          <div className="row gap6">
            <LangSwitch />
            <button className="back" style={{ width: 36, height: 36, fontSize: 16 }} aria-label={t.settings} onClick={() => go({ sub: 'settings' })}>⚙</button>
          </div>
        </div>
        <div className="col gap4">
          <h1 className="h1" style={{ fontSize: 38 }}>{profile.name || t.agencyTitle}</h1>
          {access?.expiresAt && <div className="muted" style={{ fontSize: 15 }}>{fmt(t.agencyPkg, { n: access.usedSlots, m: access.groupSlots, date: date(access.expiresAt) })}</div>}
          {access && <div className="small muted">{fmt(t.agencyPeople, { n: access.maxPeople, d: access.groupDays })}</div>}
        </div>

        {pkgExpired ? <div className="note red">{t.expiredTitle} · {t.expiredD.split('.')[0]}.</div> : (
          <div className="card col gap10">
            <span className="eyebrow">{t.issueCode}</span>
            <input className="input" value={note} placeholder={t.issueNote} onChange={(e) => setNote(e.target.value)} maxLength={80} aria-label={t.issueNote} />
            {err && <span className="error" role="alert">{err}</span>}
            <button className="btn" disabled={busy || slotsLeft <= 0} onClick={issue}>{busy ? '…' : slotsLeft <= 0 ? t.noSlots : t.issueCode}</button>
            {fresh && (
              <div className="col gap8" style={{ background: 'var(--green-soft)', borderRadius: 16, padding: 14 }}>
                <span className="small b" style={{ color: 'var(--green-ink)' }}>{t.codeReady}</span>
                <span className="mono b" style={{ fontSize: 22, letterSpacing: '.08em', userSelect: 'all' }}>{fresh}</span>
                <div className="row gap8"><button className="btn dark xs" onClick={() => copy(fresh)}>{t.copy}</button><button className="btn outline xs" onClick={() => share(fresh)}>{t.send}</button></div>
              </div>
            )}
          </div>
        )}

        <div className="col gap8">
          {list === null ? <span className="small muted">…</span> : list.length === 0 ? <div className="note gold">{t.agencyEmpty}</div> : (
            <div className="card list">
              {list.map((c) => {
                const st = status(c);
                return (
                  <div key={c.code} className="list-row" style={{ alignItems: 'flex-start' }}>
                    <div className="col grow" style={{ gap: 3 }}>
                      <span className="mono b" style={{ letterSpacing: '.06em' }}>{c.code}</span>
                      {c.note && <span className="small">{c.note}</span>}
                      {c.groupName && <span className="small muted">{c.groupName}{c.leaderName ? ' · ' + c.leaderName : ''} · {fmt(t.peopleOf, { n: c.people, m: c.maxPeople })}</span>}
                      <span className="small b" style={{ color: st.color }}>{st.text}</span>
                    </div>
                    {!c.activatedAt && <button className="chip" style={{ background: 'var(--paper-2)', border: 'none', fontSize: 13, fontWeight: 700 }} onClick={() => share(c.code)}>{t.copy}</button>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
