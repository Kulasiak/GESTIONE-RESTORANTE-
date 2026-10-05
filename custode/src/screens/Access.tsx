import { useState } from 'react';
import { useApp } from '../state';
import { LOCALE, fmt } from '../i18n';
import * as api from '../lib/api';

const day = (iso: string, lang: keyof typeof LOCALE) => new Date(iso).toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'long' });

/** Riga sotto il saluto: fino a quando vale il pacchetto (e posti del gruppo per il capogruppo). */
export function AccessLine() {
  const { t, lang, access, profile } = useApp();
  if (!access?.expiresAt) return null;
  const ms = Date.parse(access.expiresAt) - Date.now();
  if (ms <= 0) return null;
  const days = Math.ceil(ms / 86_400_000);
  const left = days <= 1 ? t.lastDay : fmt(t.daysLeft, { n: days });
  const seats = profile.role === 'leader' && access.kind === 'group' ? ' · ' + fmt(t.peopleOf, { n: access.people, m: access.maxPeople }) : '';
  return (
    <div className="small" style={{ color: days <= 1 ? 'var(--red)' : 'var(--muted)', fontWeight: 600 }}>
      {fmt(t.accessUntil, { date: day(access.expiresAt, lang) })} · {left}{seats}
    </div>
  );
}

/** Inserimento di un nuovo codice: privato (rinnova la persona) o di gruppo (rinnova il gruppo). */
export function RenewForm() {
  const { t, profile, reloadAccess, toast, setProfile } = useApp();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function renew() {
    setBusy(true);
    setErr('');
    try {
      if (profile.role === 'leader') await api.renewGroup(code);
      else {
        const kind = await api.activateLicense(code);
        if (kind !== 'private') { setErr(t.licWrongKind); return; }
        if (profile.role !== 'solo') await setProfile({ role: 'solo' });
      }
      setCode('');
      await reloadAccess();
      toast(t.renewed);
    } catch (e) {
      setErr(t[api.licenseError(e)]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="col gap10">
      <label className="field"><span className="label">{profile.role === 'leader' ? t.groupLicCode : t.licCode}</span>
        <input className="input code" value={code} placeholder="CUST-XXXX-XXXX" onChange={(e) => { setCode(e.target.value.toUpperCase()); setErr(''); }} autoCapitalize="characters" autoComplete="off" maxLength={16} /></label>
      {err && <span className="error" role="alert">{err}</span>}
      <button className="btn" disabled={busy || code.replace(/\W/g, '').length < 12} onClick={renew}>{busy ? '…' : t.renew}</button>
    </div>
  );
}

/** Al posto di Oggi, Mappa e Musei quando il pacchetto e scaduto. Documenti e SOS restano aperti. */
export function Expired() {
  const { t, profile, go } = useApp();
  return (
    <div className="page" style={{ minHeight: '70vh', justifyContent: 'center', gap: 18 }}>
      <div className="lock" aria-hidden style={{ background: 'var(--red-soft)' }}>
        <div style={{ position: 'relative', width: 34, height: 40 }}>
          <div style={{ position: 'absolute', left: 6, top: 0, width: 22, height: 22, border: '4px solid var(--red)', borderBottom: 'none', borderRadius: '12px 12px 0 0' }} />
          <div style={{ position: 'absolute', left: 0, bottom: 0, width: 34, height: 24, borderRadius: 6, background: 'var(--red)' }} />
        </div>
      </div>
      <h1 className="h2">{t.expiredTitle}</h1>
      <p className="body muted" style={{ margin: 0 }}>{t.expiredD}</p>
      {profile.role === 'member' ? <div className="note gold">{t.expiredMember}</div> : <div className="card"><RenewForm /></div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button className="btn outline sm" onClick={() => go({ tab: 'docs' })}>{t.tDocs}</button>
        <button className="btn red sm" onClick={() => go({ tab: 'sos' })}>{t.tSos}</button>
      </div>
    </div>
  );
}
