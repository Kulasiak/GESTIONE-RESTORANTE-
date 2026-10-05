import { useEffect, useState } from 'react';
import { useApp } from '../state';
import { LangSwitch } from '../components/ui';
import { fmt } from '../i18n';
import * as api from '../lib/api';
import type { Role } from '../lib/api';
import { hasBackend } from '../lib/supabase';

export function Welcome() {
  const { t, go } = useApp();
  return (
    <div className="welcome">
      <div className="logo"><div className="ring"><i /></div><b>CUSTODE</b></div>
      <div className="col gap18">
        <div className="mono" style={{ fontSize: 12, letterSpacing: '.08em' }}>41°53′N · 12°29′E · ROMA</div>
        <h1 className="serif" style={{ fontSize: 'clamp(48px, 15vw, 62px)', lineHeight: 0.98, letterSpacing: '-.01em', margin: 0, textWrap: 'balance' }}>{t.tagline}</h1>
        <p style={{ fontSize: 17, lineHeight: 1.45, margin: 0 }}>{t.welcomeBody}</p>
      </div>
      <div className="col gap16">
        <div className="row between gap8 wrap">
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' }}>{t.chooseLang}</span>
          <LangSwitch dark />
        </div>
        <button className="btn" style={{ background: '#FBF3EA', color: 'var(--terra-dark)' }} onClick={() => go({ screen: 'role' })}>{t.start}</button>
        {hasBackend && <button className="btn ghost" style={{ color: '#FBF3EA', height: 36 }} onClick={() => go({ screen: 'login' })}>{t.haveAccount}</button>}
      </div>
    </div>
  );
}

type CodeState = { status: 'idle' | 'checking' | 'found' | 'notfound' | 'offline'; name?: string; leader?: string };

export function RoleSetup() {
  const { t, profile, setProfile, go, toast, setGroup } = useApp();
  const [role, setRole] = useState<Role>(profile.role);
  const [name, setName] = useState(profile.name);
  const [code, setCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [codeState, setCodeState] = useState<CodeState>({ status: 'idle' });
  const [busy, setBusy] = useState(false);

  // Anteprima del gruppo mentre si digita il codice
  useEffect(() => {
    if (role !== 'member' || code.replace(/\W/g, '').length < 8) { setCodeState({ status: 'idle' }); return; }
    if (!hasBackend || !navigator.onLine) { setCodeState({ status: 'offline' }); return; }
    setCodeState({ status: 'checking' });
    const id = setTimeout(() => {
      api.previewGroup(code)
        .then((g) => setCodeState(g ? { status: 'found', name: g.name, leader: g.leader } : { status: 'notfound' }))
        .catch(() => setCodeState({ status: 'offline' }));
    }, 400);
    return () => clearTimeout(id);
  }, [code, role]);

  const roles: [Role, string, string][] = [['solo', t.roleSolo, t.roleSoloD], ['member', t.roleMember, t.roleMemberD], ['leader', t.roleLeader, t.roleLeaderD]];
  const canGo = name.trim().length > 0 && !busy && (role !== 'member' || !hasBackend || codeState.status === 'found');

  async function next() {
    setBusy(true);
    try {
      await setProfile({ role, name: name.trim(), groupId: null });
      if (hasBackend && role === 'leader') {
        const g = await api.createGroup(groupName.trim() || name.trim());
        setGroup({ ...g, leaderName: name.trim() });
        await setProfile({ groupId: g.id });
      } else if (hasBackend && role === 'member') {
        const gid = await api.joinGroup(code);
        await setProfile({ groupId: gid });
      }
      go({ screen: 'scan' });
    } catch {
      toast(navigator.onLine ? t.errGeneric : t.needsOnline);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scroller">
      <div className="page" style={{ minHeight: '100%', gap: 18, paddingBottom: 'calc(30px + var(--safe-b))' }}>
        <div className="row between">
          <span className="eyebrow">{t.step1}</span>
          <LangSwitch />
        </div>
        <h1 className="h1" style={{ fontSize: 42 }}>{t.roleTitle}</h1>
        <div className="col gap10" role="radiogroup">
          {roles.map(([k, title, desc]) => (
            <button key={k} role="radio" aria-checked={role === k} className={'role-card' + (role === k ? ' on' : '')} onClick={() => setRole(k)}>
              <div className="radio"><i /></div>
              <div className="col gap4"><div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div><div className="muted" style={{ fontSize: 14, lineHeight: 1.4 }}>{desc}</div></div>
            </button>
          ))}
        </div>

        <label className="field">
          <span className="label">{t.yourName}</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={40} />
        </label>

        {role === 'member' && (
          <label className="field">
            <span className="label">{t.groupCode}</span>
            <input className="input code" value={code} placeholder="ROMA-0000" onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" maxLength={12} />
            {codeState.status === 'checking' && <span className="small muted">{t.codeChecking}</span>}
            {codeState.status === 'found' && <span className="ok">{fmt(t.codeFound, { group: codeState.name ?? '', leader: codeState.leader ?? '' })}</span>}
            {codeState.status === 'notfound' && <span className="error">{t.codeNotFound}</span>}
            {codeState.status === 'offline' && <span className="error">{t.needsOnline}</span>}
          </label>
        )}

        {role === 'leader' && (
          <label className="field">
            <span className="label">{t.groupNameLabel}</span>
            <input className="input" value={groupName} placeholder={t.groupNamePh} onChange={(e) => setGroupName(e.target.value)} maxLength={60} />
            <span className="small muted">{t.groupCreateHint}</span>
          </label>
        )}

        {!hasBackend && role !== 'solo' && <div className="note gold">{t.localMode}</div>}

        <div style={{ flex: 1 }} />
        <button className="btn" disabled={!canGo} onClick={next}>{busy ? '…' : t.continue}</button>
      </div>
    </div>
  );
}
