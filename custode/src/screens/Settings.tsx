import { useState } from 'react';
import { useApp } from '../state';
import { Back } from '../components/ui';
import { LANGS, LANG_NAMES } from '../i18n';
import { geocode } from '../lib/nearby';
import { hasBackend, supabase } from '../lib/supabase';
import * as api from '../lib/api';
import { clear, createStore } from 'idb-keyval';

export function Settings() {
  const { t, profile, setProfile, group, toast, go, setGroup, setPlan } = useApp();
  const [hotelName, setHotelName] = useState(profile.hotel?.name ?? '');
  const [hotelAddr, setHotelAddr] = useState(profile.hotel?.address ?? '');
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [busy, setBusy] = useState(false);
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
        {profile.role === 'leader' && (
          <label className="field"><span className="label">{t.leaderPhone}</span><input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => setProfile({ phone: phone.trim() })} placeholder="+39 …" /></label>
        )}
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

      {notif === 'default' && (
        <button className="btn dark sm" onClick={() => Notification.requestPermission().then(setNotif)}>{t.alertLabel} · ON</button>
      )}

      <button className="btn ghost" style={{ color: 'var(--red)' }} onClick={resetAll}>{t.resetApp}</button>
      <div className="small muted" style={{ textAlign: 'center' }}>Custode 0.1 · © OpenStreetMap</div>
    </div>
  );
}
