import { useEffect, useState } from 'react';
import { biometricEnabled, unlockWithBiometric } from '../lib/biometric';
import { useApp } from '../state';
import { createVault, unlock } from '../lib/vault';
import { syncProfile } from '../lib/api';
import { hasBackend } from '../lib/supabase';

/** Creazione del PIN della cassaforte (due campi). */
export function PinCreate({ onDone, submitLabel }: { onDone: () => void; submitLabel?: string }) {
  const { t, profile } = useApp();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [err, setErr] = useState('');
  async function go() {
    if (!/^\d{6,12}$/.test(a)) return setErr(t.pinShort);
    if (a !== b) return setErr(t.pinMismatch);
    const salt = await createVault(a);
    if (hasBackend && navigator.onLine) syncProfile(profile, salt).catch(() => {});
    onDone();
  }
  return (
    <div className="col gap10">
      <div className="col gap4"><span style={{ fontSize: 16, fontWeight: 700 }}>{t.pinCreate}</span><span className="small muted" style={{ lineHeight: 1.4 }}>{t.pinCreateD}</span></div>
      <input className="input mono" type="password" inputMode="numeric" autoComplete="new-password" placeholder={t.pin} value={a} onChange={(e) => { setA(e.target.value.replace(/\D/g, '')); setErr(''); }} maxLength={12} aria-label={t.pin} />
      <input className="input mono" type="password" inputMode="numeric" autoComplete="new-password" placeholder={t.pinRepeat} value={b} onChange={(e) => { setB(e.target.value.replace(/\D/g, '')); setErr(''); }} maxLength={12} aria-label={t.pinRepeat} />
      {err && <span className="error">{err}</span>}
      <button className="btn" onClick={go}>{submitLabel ?? t.save}</button>
    </div>
  );
}

/** Tastierino per aprire la cassaforte. */
export function PinUnlock({ onDone }: { onDone: () => void }) {
  const { t } = useApp();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [bio, setBio] = useState(false);
  useEffect(() => { biometricEnabled().then(setBio); }, []);
  async function bioUnlock() {
    setBusy(true);
    const ok = await unlockWithBiometric();
    setBusy(false);
    if (ok) onDone();
  }
  async function tryUnlock(p: string) {
    setBusy(true);
    const ok = await unlock(p);
    setBusy(false);
    if (ok) onDone();
    else { setErr(true); setPin(''); navigator.vibrate?.(150); }
  }
  const press = (d: string) => {
    if (busy) return;
    setErr(false);
    const p = (pin + d).slice(0, 12);
    setPin(p);
  };
  return (
    <div className="col gap14" style={{ alignItems: 'center', width: '100%' }}>
      {bio && <button className="btn dark" style={{ width: '100%' }} disabled={busy} onClick={bioUnlock}>{busy ? t.unlocking : t.unlock}</button>}
      <div className="pindots" aria-live="polite">{Array.from({ length: Math.max(6, pin.length) }, (_, i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}</div>
      {err && <span className="error">{t.pinWrong}</span>}
      <div className="pinpad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} onClick={() => press(d)}>{d}</button>)}
        <button onClick={() => setPin(pin.slice(0, -1))} aria-label="⌫">⌫</button>
        <button onClick={() => press('0')}>0</button>
        <button onClick={() => tryUnlock(pin)} disabled={pin.length < 6 || busy} style={{ background: 'var(--ink)', color: 'var(--paper)' }} aria-label={t.unlockPin}>{busy ? '…' : '→'}</button>
      </div>
      <button className="btn dark" style={{ width: '100%' }} disabled={pin.length < 6 || busy} onClick={() => tryUnlock(pin)}>{busy ? t.unlocking : t.unlockPin}</button>
    </div>
  );
}
