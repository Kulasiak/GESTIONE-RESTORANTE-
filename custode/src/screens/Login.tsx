import { useState } from 'react';
import { useApp } from '../state';
import { Back } from '../components/ui';
import * as api from '../lib/api';

/** Accesso su un nuovo telefono con l'email collegata (codice a 6 cifre). */
export function Login() {
  const { t, setProfile, go, toast } = useApp();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function send() {
    setBusy(true);
    setErr('');
    try { await api.sendLoginCode(email.trim()); setSent(true); }
    catch { toast(navigator.onLine ? t.errGeneric : t.needsOnline); }
    finally { setBusy(false); }
  }
  async function verify() {
    setBusy(true);
    setErr('');
    try {
      const p = await api.verifyLoginCode(email.trim(), code.trim());
      await setProfile(p, false);
      go({ screen: 'app', tab: 'docs' });
    } catch { setErr(t.codeWrong); }
    finally { setBusy(false); }
  }

  return (
    <div className="scroller">
      <div className="page" style={{ minHeight: '100%', paddingBottom: 'calc(30px + var(--safe-b))' }}>
        <Back />
        <h1 className="h1">{t.loginTitle}</h1>
        <p className="body muted" style={{ margin: 0 }}>{t.loginD}</p>
        <label className="field"><span className="label">{t.email}</span>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={sent} /></label>
        {sent && (
          <label className="field"><span className="label">{t.code}</span>
            <input className="input mono" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></label>
        )}
        {err && <span className="error">{err}</span>}
        <div style={{ flex: 1 }} />
        {sent
          ? <button className="btn" disabled={busy || code.length < 6} onClick={verify}>{busy ? '…' : t.continue}</button>
          : <button className="btn" disabled={busy || !/.+@.+\..+/.test(email)} onClick={send}>{busy ? '…' : t.sendCode}</button>}
      </div>
    </div>
  );
}
