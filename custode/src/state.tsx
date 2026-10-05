import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DICTS, detectLang, fmt, type Dict, type Lang } from './i18n';
import * as api from './lib/api';
import type { AlertRow, Group, Member, Plan, Profile } from './lib/api';
import { distance, distanceToPolyline, type LatLng } from './lib/geo';
import { RISK_LINES, RISK_ZONES } from './data/rome';
import { hasBackend } from './lib/supabase';

export type Tab = 'today' | 'map' | 'docs' | 'places' | 'sos';
export type Sub = 'transfer' | 'museum' | 'editor' | 'lost' | 'settings' | 'addDoc' | 'doc' | null;
export type Screen = 'welcome' | 'role' | 'scan' | 'app';
export type Nav = { screen: Screen; tab: Tab; sub: Sub; param?: string };

export type Sheet =
  | { kind: 'zone'; distance: number }
  | { kind: 'theft'; zone: string }
  | { kind: 'memberOut'; name: string; distance: number | null; userId: string }
  | { kind: 'memberSos'; name: string; lat: number | null; lng: number | null }
  | { kind: 'message'; text: string }
  | { kind: 'planPublished' };

export type Position = LatLng & { accuracy: number; at: number };

type Ctx = {
  t: Dict; lang: Lang; profile: Profile; setProfile: (p: Partial<Profile>, sync?: boolean) => Promise<Profile>;
  nav: Nav; go: (n: Partial<Nav>) => void; back: () => void;
  toast: (msg: string) => void; toastMsg: string | null;
  sheet: Sheet | null; setSheet: (s: Sheet | null) => void;
  pos: Position | null; posError: boolean;
  group: Group | null; setGroup: (g: Group | null) => void; members: Member[];
  plan: Plan | null; setPlan: (p: Plan | null) => void; reloadPlan: () => Promise<void>; reloadGroup: () => Promise<void>;
  zone: { center: LatLng; radius: number; distance: number | null; out: boolean; guide: Member | null } | null;
  inRisk: string | null; online: boolean; lastLeaderMsg: AlertRow | null;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppCtx)!;

const defaultProfile = (): Profile => ({ userId: null, lang: detectLang(), role: 'solo', name: '', onboarded: false, groupId: null });
const LEADER_FRESH_MS = 10 * 60_000;
const THEFT_SNOOZE_MS = 2 * 3600_000;

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Profile>(() => api.loadProfile() ?? defaultProfile());
  const [nav, setNav] = useState<Nav>(() => ({ screen: profile.onboarded ? 'app' : 'welcome', tab: 'today', sub: null }));
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [pos, setPos] = useState<Position | null>(null);
  const [posError, setPosError] = useState(false);
  const [group, setGroupState] = useState<Group | null>(() => (profile.groupId ? api.loadGroupLocal() : null));
  const [members, setMembers] = useState<Member[]>(() => (profile.groupId ? api.loadMembersLocal() : []));
  const [plan, setPlanState] = useState<Plan | null>(() => api.loadPlanLocal());
  const [online, setOnline] = useState(navigator.onLine);
  const [lastLeaderMsg, setLastLeaderMsg] = useState<AlertRow | null>(null);
  const t = DICTS[profile.lang];
  const toastTimer = useRef<number>(0);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const profileRef = useRef(profile);
  profileRef.current = profile;
  const setProfile = useCallback(async (p: Partial<Profile>, sync = true) => {
    const next = { ...profileRef.current, ...p };
    profileRef.current = next;
    setProfileState(next);
    api.saveProfileLocal(next);
    if (sync && hasBackend && navigator.onLine) {
      try {
        const synced = await api.syncProfile(next);
        if (synced.userId !== next.userId) { profileRef.current = synced; setProfileState(synced); }
        return synced;
      } catch { /* riprova al prossimo salvataggio */ }
    }
    return next;
  }, []);

  useEffect(() => { document.documentElement.lang = profile.lang; }, [profile.lang]);

  // ── navigazione con il tasto indietro del telefono ──
  useEffect(() => {
    history.replaceState(nav, '');
    const onPop = (e: PopStateEvent) => { if (e.state?.screen) setNav(e.state as Nav); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const go = useCallback((n: Partial<Nav>) => {
    setNav((cur) => {
      const next: Nav = { ...cur, sub: null, param: undefined, ...n };
      history.pushState(next, '');
      return next;
    });
    document.getElementById('scroller')?.scrollTo(0, 0);
  }, []);
  const back = useCallback(() => history.back(), []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // ── posizione GPS (solo dentro l'app) ──
  const inApp = nav.screen === 'app';
  useEffect(() => {
    if (!inApp || !('geolocation' in navigator)) { if (inApp) setPosError(true); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => { setPosError(false); setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() }); },
      () => setPosError(true),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [inApp]);

  // ── gruppo, membri, programma ──
  const setGroup = useCallback((g: Group | null) => setGroupState(g), []);
  const setPlan = useCallback((p: Plan | null) => { setPlanState(p); api.savePlanLocal(p); }, []);
  const reloadGroup = useCallback(async () => {
    const p = profileRef.current;
    if (!p.groupId) { setGroupState(null); setMembers([]); return; }
    const [g, m] = await Promise.all([api.fetchGroup(p.groupId), api.fetchMembers(p.groupId)]);
    if (g) setGroupState(g);
    setMembers(m);
  }, []);
  const reloadPlan = useCallback(async () => {
    const p = await api.fetchPlan(profileRef.current);
    setPlanState(p);
  }, []);

  useEffect(() => {
    if (!profile.onboarded) return;
    reloadGroup().catch(() => {});
    reloadPlan().catch(() => {});
  }, [profile.onboarded, profile.groupId, profile.role, reloadGroup, reloadPlan, online]);

  // ── realtime del gruppo ──
  useEffect(() => {
    const gid = profile.groupId;
    if (!profile.onboarded || !gid) return;
    let locTimer = 0;
    const off = api.subscribeGroup(gid, {
      onLocation: () => { clearTimeout(locTimer); locTimer = window.setTimeout(() => api.fetchMembers(gid).then(setMembers).catch(() => {}), 800); },
      onPlan: () => { reloadPlan().catch(() => {}); },
      onGroup: () => { api.fetchGroup(gid).then((g) => g && setGroupState(g)).catch(() => {}); },
      onAlert: (a) => {
        const me = profileRef.current;
        if (a.senderId === me.userId) return;
        if (a.targetUserId && a.targetUserId !== me.userId) return;
        const who = membersRef.current.find((m) => m.userId === a.senderId)?.name ?? '—';
        if (a.kind === 'message') { setLastLeaderMsg(a); setSheet({ kind: 'message', text: a.message ?? '' }); notify(DICTS[me.lang].leaderMsg, a.message ?? ''); }
        else if (a.kind === 'plan_published') { setSheet({ kind: 'planPublished' }); }
        else if (me.role === 'leader' && a.kind === 'out_of_zone') { setSheet({ kind: 'memberOut', name: who, distance: a.distance, userId: a.senderId }); notify(fmt(DICTS[me.lang].memberOut, { name: who }), ''); }
        else if (me.role === 'leader' && a.kind === 'sos') { setSheet({ kind: 'memberSos', name: who, lat: a.lat, lng: a.lng }); notify(fmt(DICTS[me.lang].memberSos, { name: who }), ''); }
        else if (me.role === 'leader' && (a.kind === 'im_ok' || a.kind === 'back_in_zone')) toast(a.kind === 'im_ok' ? fmt(DICTS[me.lang].memberOk, { name: who }) : who + ' · ' + DICTS[me.lang].inZone);
      },
    });
    api.fetchRecentAlerts(gid).then((list) => setLastLeaderMsg(list.find((a) => a.kind === 'message') ?? null)).catch(() => {});
    return () => { off(); clearTimeout(locTimer); };
  }, [profile.onboarded, profile.groupId, reloadPlan, toast]);
  const membersRef = useRef(members);
  membersRef.current = members;

  // ── zona del gruppo ──
  const zone = useMemo(() => {
    if (!group || profile.role === 'solo') return null;
    const guide = members.find((m) => m.role === 'leader') ?? null;
    const guideFresh = guide && guide.lat != null && guide.lng != null && guide.updatedAt && Date.now() - Date.parse(guide.updatedAt) < LEADER_FRESH_MS;
    const center: LatLng | null = guideFresh ? { lat: guide!.lat!, lng: guide!.lng! } : group.meeting;
    if (!center) return null;
    const d = pos ? distance(pos, center) : null;
    const out = profile.role === 'member' && d != null && d > group.radius;
    return { center, radius: group.radius, distance: d, out, guide };
  }, [group, members, pos, profile.role]);

  // Avviso quando il membro esce o rientra nella zona
  const wasOut = useRef(false);
  useEffect(() => {
    if (!zone || profile.role !== 'member') return;
    if (zone.out && !wasOut.current) {
      setSheet({ kind: 'zone', distance: zone.distance ?? 0 });
      notify(t.zoneT, '');
      if (group && profile.userId) api.sendAlert({ groupId: group.id, senderId: profile.userId, targetUserId: group.leaderId, kind: 'out_of_zone', message: null, lat: pos?.lat ?? null, lng: pos?.lng ?? null, distance: Math.round(zone.distance ?? 0) }).catch(() => {});
    } else if (!zone.out && wasOut.current) {
      toast(t.toastBack);
      if (group && profile.userId) api.sendAlert({ groupId: group.id, senderId: profile.userId, targetUserId: group.leaderId, kind: 'back_in_zone', message: null, lat: null, lng: null, distance: null }).catch(() => {});
    }
    wasOut.current = zone.out;
  }, [zone?.out]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── zone a rischio borseggi ──
  const inRisk = useMemo(() => {
    if (!pos) return null;
    const z = RISK_ZONES.find((r) => distance(pos, r) < r.r);
    if (z) return z.id;
    const l = RISK_LINES.find((r) => distanceToPolyline(pos, r.points) < r.width);
    return l ? l.id : null;
  }, [pos]);
  useEffect(() => {
    if (!inRisk) return;
    const key = 'custode.theft.' + inRisk;
    const last = Number(localStorage.getItem(key) ?? 0);
    if (Date.now() - last < THEFT_SNOOZE_MS) return;
    localStorage.setItem(key, String(Date.now()));
    setSheet((s) => s ?? { kind: 'theft', zone: inRisk });
    notify(t.theftT, t.theftD);
  }, [inRisk]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── invio posizione al gruppo (al massimo ogni 20 s o ogni 25 m) ──
  const lastPush = useRef<{ at: number; p: LatLng } | null>(null);
  useEffect(() => {
    if (!pos || !profile.userId || !profile.groupId || !online) return;
    const l = lastPush.current;
    if (l && Date.now() - l.at < 20_000 && distance(l.p, pos) < 25 && !(zone?.out)) return;
    lastPush.current = { at: Date.now(), p: pos };
    api.pushLocation(profile.userId, profile.groupId, pos.lat, pos.lng, pos.accuracy, !!zone?.out).catch(() => {});
  }, [pos, profile.userId, profile.groupId, online, zone?.out]);

  const value: Ctx = {
    t, lang: profile.lang, profile, setProfile, nav, go, back, toast, toastMsg, sheet, setSheet, pos, posError,
    group, setGroup, members, plan, setPlan, reloadPlan, reloadGroup, zone, inRisk, online, lastLeaderMsg,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

/** Notifica di sistema se l'app e in background e il permesso e stato dato. */
function notify(title: string, body: string) {
  try {
    if (document.visibilityState === 'visible' || !('Notification' in window) || Notification.permission !== 'granted') return;
    navigator.serviceWorker?.ready.then((r) => r.showNotification(title, { body, icon: '/icon-192.png', tag: title })).catch(() => {});
    navigator.vibrate?.([200, 100, 200]);
  } catch { /* non supportato */ }
}
