import { useEffect, useState } from 'react';
import { useApp } from '../state';
import { Back } from '../components/ui';
import { LANGS, LANG_NAMES, fmt } from '../i18n';
import { geocode } from '../lib/nearby';
import { hasBackend, supabase } from '../lib/supabase';
import * as api from '../lib/api';
import { disablePush, enablePush, pushAvailable, pushEnabled } from '../lib/push';
import { biometricEnabled, biometricSupported, disableBiometric, enableBiometric } from '../lib/biometric';
import { clear, createStore } from 'idb-keyval';

export function Settings() {
  const { t, profile, setProfile, group, toast, go, setGroup, setPlan, trip, setDay } = useApp();
  const [tripStart, setTripStart] = useState(trip?.start ?? '');
  const [tripEnd, setTripEnd] = useState(trip?.end ?? '');
  const canEditTrip = profile.role !== 'member' || !group;
  const [pushOn, setPushOn] = useState(false);
  useEffect(() => { pushEnabled().then(setPushOn).catch(() => {}); }, []);
  const [bioOk, setBioOk] = useState(false);
  const [bioOn, setBioOn] = useState(false);
  const [bioPin, setBioPin] = useState('');
  useEffect(() => { biometricSupported().then(setBioOk); biometricEnabled().then(setBioOn); }, []);
  async function toggleBio() {
    if (bioOn) { await disableBiometric(); setBioOn(false); return; }
    try {
      const r = await enableBiometric(bioPin, profile.name);
      if (r === 'ok') { setBioOn(true); setBioPin(''); toast('✓ ' + t.bioOn); }
      else toast(r === 'pin' ? t.pinWrong : t.bioUnsupported);
    } catch { toast(t.bioUnsupported); }
  }
  const [hotelName, setHotelName] = useState(profile.hotel?.name ?? '');
  const [hotelAddr, setHotelAddr] = useState(profile.hotel?.address ?? '');
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  useEffect(() => { api.currentEmail().then(setEmail).catch(() => {}); }, []);
  const [notif, setNotif] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');

  async function saveHotel() {
    if (!hotelAddr.trim()) { await setProfile({ hotel: null }); return; }
    setBusy(true);
    try {
      const p = await geocode(hotelAddr);
      if (!p) { toast(t.hotelNotFound); return; }
      await setProfile({ hotel: { name: hotelName.trim() || 'Hotel', address: hotelAddr.trim(), ...p } });
      toast('✓ ' + t.hotel);
    } catch {
      toast(t.needsOnline);
    } finally {
      setBusy(false);
    }
  }

  async function saveTrip() {
    const next = tripStart && tripEnd && tripEnd >= tripStart ? { start: tripStart, end: tripEnd } : null;
    try {
      if (profile.role === 'leader' && group) { const g = { ...group, trip: next }; await api.updateGroup(g); setGroup(g); }
      else await setProfile({ trip: next });
      setDay(api.defaultDay(next));
      toast('✓ ' + t.tripDates);
    } catch {
      toast(navigator.onLine ? t.errGeneric : t.needsOnline);
    }
  }

  async function leave() {
    if (group) await api.leaveGroup(group.id, profile.userId).catch(() => {});
    setGroup(null);
    setPlan(null);
    await setProfile({ groupId: null, role: 'solo' });
    go({ screen: 'role' });
  }

  async function resetAll() {
    if (!confirm(t.resetConfirm)) return;
    await clear(createStore('custode-vault', 'docs'));
    await clear(createStore('custode-vault-meta', 'meta'));
    Object.keys(localStorage).filter((k) => k.startsWith('custode.')).forEach((k) => localStorage.removeItem(k));
    await supabase?.auth.signOut().catch(() => {});
    location.reload();
  }

  return (
    <div className="page">
      <Back />
      <h1 className="h2">{t.settings}</h1>

      <div className="card col gap10">
        <span className="eyebrow">{t.language}</span>
        <div className="row gap8 wrap">{LANGS.map((l) => <button key={l} className={'chip' + (profile.lang === l ? ' on' : '')} onClick={() => setProfile({ lang: l })}>{LANG_NAMES[l]}</button>)}</div>
      </div>

      <div className="card col gap10">
        <label className="field"><span className="label">{t.yourName}</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && setProfile({ name: name.trim() })} /></label>
        {profile.role !== 'solo' && (
          <label className="field"><span className="label">{profile.role === 'leader' ? t.leaderPhone : t.memberPhone}</span><input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => setProfile({ phone: phone.trim() })} placeholder="+39 …" /></label>
        )}
      </div>

      {hasBackend && (
        <div className="card col gap10">
          <span className="eyebrow">{t.account}</span>
          {email ? <span className="b">{fmt(t.linkedAs, { email })}</span> : (
            <>
              <span className="small muted" style={{ lineHeight: 1.4 }}>{t.accountD}</span>
              <input className="input" type="email" autoComplete="email" placeholder={t.email} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} aria-label={t.email} />
              <button className="btn dark sm" disabled={!/.+@.+\..+/.test(newEmail)} onClick={() => api.linkEmail(newEmail.trim()).then(() => { toast(t.checkMail); setEmail(newEmail.trim()); }).catch(() => toast(navigator.onLine ? t.errGeneric : t.needsOnline))}>{t.linkEmail}</button>
            </>
          )}
        </div>
      )}

      {bioOk && (
        <div className="card col gap10">
          <span className="eyebrow">{t.docsTitle}</span>
          <div className="row gap12"><span className="grow b">{t.bioTitle}</span>
            <button className={'toggle' + (bioOn ? ' on' : '')} style={{ border: 'none' }} aria-pressed={bioOn} aria-label={t.bioTitle} disabled={!bioOn && bioPin.length < 6} onClick={toggleBio}><i /></button></div>
          {!bioOn && <input className="input mono" type="password" inputMode="numeric" placeholder={t.pin} value={bioPin} onChange={(e) => setBioPin(e.target.value.replace(/\D/g, ''))} aria-label={t.pin} />}
          <span className="small muted" style={{ lineHeight: 1.4 }}>{t.bioD}</span>
        </div>
      )}

      <div className="card col gap10">
        <span className="eyebrow">{t.tripDates}</span>
        <div className="row gap8">
          <label className="field grow"><span className="label">{t.tripFrom}</span><input className="input" type="date" value={tripStart} disabled={!canEditTrip} onChange={(e) => setTripStart(e.target.value)} /></label>
          <label className="field grow"><span className="label">{t.tripTo}</span><input className="input" type="date" value={tripEnd} min={tripStart || undefined} disabled={!canEditTrip} onChange={(e) => setTripEnd(e.target.value)} /></label>
        </div>
        {canEditTrip && <button className="btn dark sm" onClick={saveTrip}>{t.save}</button>}
      </div>

      <div className="card col gap10">
        <span className="eyebrow">{t.hotel}</span>
        <input className="input" value={hotelName} onChange={(e) => setHotelName(e.target.value)} placeholder={t.hotelName} aria-label={t.hotelName} />
        <input className="input" value={hotelAddr} onChange={(e) => setHotelAddr(e.target.value)} placeholder={t.hotelAddress} aria-label={t.hotelAddress} />
        <button className="btn dark sm" disabled={busy} onClick={saveHotel}>{busy ? '…' : t.hotelFind}</button>
        {profile.hotel && <span className="small muted">✓ {profile.hotel.name} · {profile.hotel.address}</span>}
      </div>

      <div className="card col gap10">
        <span className="eyebrow">{t.role}</span>
        <span className="b">{profile.role === 'solo' ? t.rolesSolo : profile.role === 'leader' ? t.roleLeader : t.roleMember}{group ? ' · ' + group.name : ''}</span>
        {group && <span className="small muted mono">{t.groupCode}: {group.code}</span>}
        <span className="small muted">{hasBackend ? t.syncOn : t.localMode}</span>
        {group ? <button className="btn outline sm" onClick={leave}>{t.leaveGroup}</button> : <button className="btn outline sm" onClick={() => go({ screen: 'role' })}>{t.changeRole}</button>}
      </div>

      {pushAvailable() && profile.userId ? (
        <button className="card row gap12" style={{ textAlign: 'left' }} aria-pressed={pushOn} onClick={async () => {
          if (pushOn) { await disablePush(); setPushOn(false); return; }
          const ok = await enablePush(profile.userId!, profile.lang).catch(() => false);
          setPushOn(ok);
          if (!ok) toast(t.pushDenied);
        }}>
          <div className="col gap4 grow"><span className="b" style={{ fontSize: 16 }}>{t.pushTitle}</span><span className="small muted">{t.pushD}</span></div>
          <div className={'toggle' + (pushOn ? ' on' : '')}><i /></div>
        </button>
      ) : notif === 'default' ? (
        <button className="btn dark sm" onClick={() => Notification.requestPermission().then(setNotif)}>{t.pushTitle}</button>
      ) : null}

      <button className="btn ghost" style={{ color: 'var(--red)' }} onClick={resetAll}>{t.resetApp}</button>
      <div className="small muted" style={{ textAlign: 'center' }}>Custode 0.1 · © OpenStreetMap</div>
    </div>
  );
}
