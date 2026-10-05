// Accesso ai dati: Supabase quando configurato, altrimenti tutto in locale.
// Ogni lettura riuscita viene salvata in cache per funzionare offline.
import { ensureSession, supabase } from './supabase';
import type { Lang } from '../i18n';
import { PRESET_PLANS, type Mode, type Stop } from '../data/rome';
import type { EncryptedDoc } from './vault';

export type Role = 'solo' | 'member' | 'leader';

export type Profile = {
  userId: string | null;
  lang: Lang;
  role: Role;
  name: string;
  phone?: string;
  onboarded: boolean;
  nationality?: string;
  hotel?: { name: string; address: string; lat: number; lng: number } | null;
  groupId?: string | null;
  trip?: Trip | null;
};

export type Group = {
  id: string; name: string; code: string; leaderId: string; leaderName: string; leaderPhone?: string | null;
  meeting: { name: string; lat: number; lng: number; time: string } | null; radius: number;
  trip: Trip | null;
};

export type Trip = { start: string; end: string };

/** Giorni del viaggio (YYYY-MM-DD), al massimo 21. */
export function tripDays(trip: Trip | null | undefined): string[] {
  if (!trip?.start || !trip.end || trip.end < trip.start) return [];
  const out: string[] = [];
  const d = new Date(trip.start + 'T12:00:00Z');
  while (out.length < 21) {
    const s = d.toISOString().slice(0, 10);
    if (s > trip.end) break;
    out.push(s);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Giorno da mostrare all'apertura: oggi se dentro il viaggio, altrimenti il primo giorno. */
export function defaultDay(trip: Trip | null | undefined): string {
  const days = tripDays(trip);
  const t = today();
  if (!days.length || days.includes(t)) return t;
  return t < days[0] ? days[0] : t;
}

export type Plan = { id: string | null; tour: string | null; stops: Stop[]; publishedAt: string | null; day: string };

export type Member = {
  userId: string; name: string; role: 'leader' | 'member'; phone?: string | null;
  lat: number | null; lng: number | null; updatedAt: string | null; outOfZone: boolean;
};

export type AlertRow = {
  id: string; groupId: string; senderId: string; targetUserId: string | null;
  kind: 'out_of_zone' | 'back_in_zone' | 'message' | 'plan_published' | 'sos' | 'im_ok';
  message: string | null; lat: number | null; lng: number | null; distance: number | null; createdAt: string;
};

// ───────── cache locale ─────────
const K = { profile: 'custode.profile', group: 'custode.group', plan: 'custode.plan', plans: 'custode.plans', members: 'custode.members' };
export const cache = {
  get<T>(k: string): T | null {
    try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
  },
  set(k: string, v: unknown) {
    try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* spazio pieno o privato */ }
  },
};

export const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }); // YYYY-MM-DD

export const loadProfile = () => cache.get<Profile>(K.profile);
export const saveProfileLocal = (p: Profile) => cache.set(K.profile, p);
export const loadGroupLocal = () => cache.get<Group>(K.group);
/** Programmi salvati sul telefono, uno per giorno. */
const plansLocal = (): Record<string, Plan> => {
  const all = cache.get<Record<string, Plan>>(K.plans) ?? {};
  const old = cache.get<Plan>(K.plan); // formato precedente: un solo programma
  if (old && !all[old.day]) { all[old.day] = old; cache.set(K.plans, all); cache.set(K.plan, null); }
  return all;
};
export const loadPlanLocal = (day: string = today()) => plansLocal()[day] ?? null;
export const savePlanLocal = (p: Plan | null, day?: string) => {
  const all = plansLocal();
  const d = p?.day ?? day;
  if (!d) return;
  if (p) all[d] = p; else delete all[d];
  cache.set(K.plans, all);
};
export const loadMembersLocal = () => cache.get<Member[]>(K.members) ?? [];

export function clearLocal() {
  Object.values(K).forEach((k) => cache.set(k, null));
}

// ───────── profilo ─────────
export async function syncProfile(p: Profile, vaultSalt?: string | null): Promise<Profile> {
  saveProfileLocal(p);
  if (!supabase) return p;
  const userId = p.userId ?? (await ensureSession());
  const next = { ...p, userId };
  saveProfileLocal(next);
  await supabase.from('profiles').upsert({
    id: userId, display_name: p.name, phone: p.phone || null, lang: p.lang, role: p.role, nationality: p.nationality ?? null,
    hotel_name: p.hotel?.name ?? null, hotel_address: p.hotel?.address ?? null, hotel_lat: p.hotel?.lat ?? null, hotel_lng: p.hotel?.lng ?? null,
    trip_start: p.trip?.start ?? null, trip_end: p.trip?.end ?? null,
    ...(vaultSalt ? { vault_salt: vaultSalt } : {}),
  });
  return next;
}

// ───────── gruppi ─────────
type GroupRow = { id: string; name: string; code: string; leader_id: string; meeting_name: string | null; meeting_lat: number | null; meeting_lng: number | null; meeting_time: string | null; radius_m: number; start_date: string | null; end_date: string | null };
const toGroup = (r: GroupRow, leaderName: string, leaderPhone: string | null = null): Group => ({
  id: r.id, name: r.name, code: r.code, leaderId: r.leader_id, leaderName, leaderPhone,
  meeting: r.meeting_lat != null && r.meeting_lng != null ? { name: r.meeting_name ?? '', lat: r.meeting_lat, lng: r.meeting_lng, time: r.meeting_time ?? '' } : null,
  radius: r.radius_m,
  trip: r.start_date && r.end_date ? { start: r.start_date, end: r.end_date } : null,
});

export async function previewGroup(code: string): Promise<{ name: string; leader: string } | null> {
  if (!supabase) throw new Error('offline');
  await ensureSession();
  const { data, error } = await supabase.rpc('preview_group', { group_code: code });
  if (error) throw error;
  const row = (data as { group_name: string; leader_name: string }[])[0];
  return row ? { name: row.group_name, leader: row.leader_name } : null;
}

export async function createGroup(name: string): Promise<Group> {
  if (!supabase) throw new Error('offline');
  await ensureSession();
  const { data, error } = await supabase.rpc('create_group', { group_name: name });
  if (error) throw error;
  const g = toGroup(data as GroupRow, '');
  cache.set(K.group, g);
  return g;
}

export async function joinGroup(code: string): Promise<string> {
  if (!supabase) throw new Error('offline');
  await ensureSession();
  const { data, error } = await supabase.rpc('join_group', { group_code: code });
  if (error) throw error;
  return (data as { group_id: string }[])[0].group_id;
}

export async function fetchGroup(groupId: string): Promise<Group | null> {
  if (!supabase) return loadGroupLocal();
  const { data, error } = await supabase.from('groups').select('*').eq('id', groupId).maybeSingle();
  if (error || !data) return loadGroupLocal();
  const { data: leader } = await supabase.from('profiles').select('display_name, phone').eq('id', data.leader_id).maybeSingle();
  const g = toGroup(data as GroupRow, leader?.display_name ?? '', leader?.phone ?? null);
  cache.set(K.group, g);
  return g;
}

export async function updateGroup(g: Group) {
  cache.set(K.group, g);
  if (!supabase) return;
  const { error } = await supabase.from('groups').update({
    meeting_name: g.meeting?.name ?? null, meeting_lat: g.meeting?.lat ?? null, meeting_lng: g.meeting?.lng ?? null,
    meeting_time: g.meeting?.time ?? null, radius_m: g.radius, start_date: g.trip?.start ?? null, end_date: g.trip?.end ?? null,
  }).eq('id', g.id);
  if (error) throw error;
}

export async function leaveGroup(groupId: string, userId: string | null) {
  cache.set(K.group, null);
  cache.set(K.members, null);
  if (!supabase || !userId) return;
  await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  await supabase.from('live_locations').delete().eq('user_id', userId);
}

export async function fetchMembers(groupId: string): Promise<Member[]> {
  if (!supabase) return loadMembersLocal();
  const [{ data: rows }, { data: locs }] = await Promise.all([
    supabase.from('group_members').select('user_id, role').eq('group_id', groupId),
    supabase.from('live_locations').select('user_id, lat, lng, updated_at, out_of_zone').eq('group_id', groupId),
  ]);
  if (!rows) return loadMembersLocal();
  const ids = rows.map((r) => r.user_id);
  const { data: profs } = await supabase.from('profiles').select('id, display_name, phone').in('id', ids);
  const members: Member[] = rows.map((r) => {
    const l = locs?.find((x) => x.user_id === r.user_id);
    return {
      userId: r.user_id, role: r.role, name: profs?.find((p) => p.id === r.user_id)?.display_name || '—', phone: profs?.find((p) => p.id === r.user_id)?.phone ?? null,
      lat: l?.lat ?? null, lng: l?.lng ?? null, updatedAt: l?.updated_at ?? null, outOfZone: l?.out_of_zone ?? false,
    };
  });
  cache.set(K.members, members);
  return members;
}

// ───────── posizione live ─────────
export async function pushLocation(userId: string, groupId: string | null, lat: number, lng: number, accuracy: number, outOfZone: boolean, sharingUntil?: string | null) {
  if (!supabase) return;
  await supabase.from('live_locations').upsert({
    user_id: userId, group_id: groupId, lat, lng, accuracy, out_of_zone: outOfZone, updated_at: new Date().toISOString(),
    ...(sharingUntil !== undefined ? { sharing_until: sharingUntil } : {}),
  });
}

// ───────── programmi ─────────
type StopRow = { id: string; position: number; time: string; place_id: string | null; name: string | null; lat: number | null; lng: number | null; mode: Mode | null; minutes: number | null; leg_note: string | null; tip: string | null };

/** Tappe salvate su DB → tappe dell'app. I testi tradotti delle tappe predefinite vengono ripresi dai preset. */
function fromRows(rows: StopRow[], tour: string | null): Stop[] {
  const preset = tour ? PRESET_PLANS[tour] ?? [] : [];
  return rows.sort((a, b) => a.position - b.position).map((r) => {
    const p = preset.find((s) => s.place === r.place_id && s.mode === r.mode);
    return {
      id: r.id, time: r.time, place: r.place_id, name: r.name, lat: r.lat, lng: r.lng, mode: r.mode, minutes: r.minutes,
      leg: p?.leg ?? r.leg_note, duration: p?.duration ?? null, price: p?.price ?? null, tip: r.tip ?? p?.tip ?? null, detail: p?.detail ?? null,
    };
  });
}

const legText = (s: Stop) => (s.leg == null ? null : typeof s.leg === 'string' ? s.leg : s.leg.it ?? s.leg.en ?? null);
const tipText = (s: Stop) => (s.tip == null ? null : typeof s.tip === 'string' ? s.tip : null); // i consigli tradotti restano nei preset

export function presetPlan(tour: string, day: string = today()): Plan {
  return { id: null, tour, stops: PRESET_PLANS[tour].map((s) => ({ ...s })), publishedAt: null, day };
}

/**
 * Programma di un giorno del viaggio.
 * - solo: il proprio programma personale
 * - leader: la bozza o il programma pubblicato del gruppo
 * - member: il programma pubblicato dal capogruppo
 */
export async function fetchPlan(profile: Profile, day: string = today()): Promise<Plan | null> {
  const local = loadPlanLocal(day);
  if (!supabase || !profile.userId) return local;
  let q = supabase.from('plans').select('id, tour, day, published_at').eq('day', day).order('updated_at', { ascending: false }).limit(1);
  if (profile.role === 'solo' || !profile.groupId) q = q.is('group_id', null).eq('owner_id', profile.userId);
  else q = q.eq('group_id', profile.groupId);
  if (profile.role === 'member') q = q.not('published_at', 'is', null);
  const { data, error } = await q.maybeSingle();
  if (error) return local;
  if (!data) return profile.role === 'member' ? null : local;
  const { data: stops } = await supabase.from('plan_stops').select('*').eq('plan_id', data.id);
  const plan: Plan = { id: data.id, tour: data.tour, day: data.day, publishedAt: data.published_at, stops: fromRows((stops ?? []) as StopRow[], data.tour) };
  savePlanLocal(plan);
  return plan;
}

/** Salva il programma (e per il capogruppo, se publish, lo pubblica al gruppo). */
export async function savePlan(profile: Profile, plan: Plan, publish = false): Promise<Plan> {
  let next: Plan = { ...plan, publishedAt: publish ? new Date().toISOString() : plan.publishedAt };
  savePlanLocal(next);
  if (!supabase || !profile.userId) return next;
  const groupId = profile.role === 'leader' ? profile.groupId ?? null : null;
  const row = { owner_id: profile.userId, group_id: groupId, tour: plan.tour, day: next.day, title: '', published_at: next.publishedAt };
  let id = plan.id;
  if (id) {
    const { error } = await supabase.from('plans').update(row).eq('id', id);
    if (error) throw error;
    await supabase.from('plan_stops').delete().eq('plan_id', id);
  } else {
    const { data, error } = await supabase.from('plans').insert(row).select('id').single();
    if (error) throw error;
    id = data.id as string;
  }
  const { error: e2 } = await supabase.from('plan_stops').insert(plan.stops.map((s, i) => ({
    plan_id: id, position: i, time: s.time, place_id: s.place, name: s.name ?? null, lat: s.lat ?? null, lng: s.lng ?? null,
    mode: s.mode, minutes: s.minutes, leg_note: legText(s), tip: tipText(s),
  })));
  if (e2) throw e2;
  next = { ...next, id };
  savePlanLocal(next);
  return next;
}

// ───────── avvisi ─────────
type AlertDb = { id: string; group_id: string; sender_id: string; target_user_id: string | null; kind: AlertRow['kind']; message: string | null; lat: number | null; lng: number | null; distance_m: number | null; created_at: string };
export const toAlert = (r: AlertDb): AlertRow => ({
  id: r.id, groupId: r.group_id, senderId: r.sender_id, targetUserId: r.target_user_id, kind: r.kind, message: r.message,
  lat: r.lat, lng: r.lng, distance: r.distance_m, createdAt: r.created_at,
});

export async function sendAlert(a: Omit<AlertRow, 'id' | 'createdAt'>) {
  if (!supabase) return;
  const { error } = await supabase.from('alerts').insert({
    group_id: a.groupId, sender_id: a.senderId, target_user_id: a.targetUserId, kind: a.kind, message: a.message,
    lat: a.lat, lng: a.lng, distance_m: a.distance,
  });
  if (error) throw error;
}

export async function fetchRecentAlerts(groupId: string): Promise<AlertRow[]> {
  if (!supabase) return [];
  const since = new Date(Date.now() - 12 * 3600_000).toISOString();
  const { data } = await supabase.from('alerts').select('*').eq('group_id', groupId).gte('created_at', since).order('created_at', { ascending: false }).limit(30);
  return ((data ?? []) as AlertDb[]).map(toAlert);
}

/** Realtime: avvisi, posizioni, programma e gruppo. Restituisce la funzione per chiudere. */
export function subscribeGroup(groupId: string, h: {
  onAlert: (a: AlertRow) => void; onLocation: () => void; onPlan: () => void; onGroup: () => void;
}) {
  if (!supabase) return () => {};
  const sb = supabase;
  const ch = sb.channel('group-' + groupId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts', filter: `group_id=eq.${groupId}` }, (p) => h.onAlert(toAlert(p.new as AlertDb)))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_locations', filter: `group_id=eq.${groupId}` }, () => h.onLocation())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'plans', filter: `group_id=eq.${groupId}` }, () => h.onPlan())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` }, () => h.onGroup())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` }, () => h.onLocation())
    .subscribe();
  return () => { sb.removeChannel(ch); };
}

// ───────── documenti cifrati (backup) ─────────
export async function pushDocs(userId: string | null, docs: EncryptedDoc[]) {
  if (!supabase || !userId || !docs.length) return [] as string[];
  const { error } = await supabase.from('documents').upsert(docs.map((d) => ({
    id: d.id, owner_id: userId, kind: d.kind, ciphertext: d.ct, iv: d.iv, updated_at: d.updatedAt,
  })));
  if (error) throw error;
  return docs.map((d) => d.id);
}

export async function deleteRemoteDoc(id: string) {
  if (!supabase) return;
  await supabase.from('documents').delete().eq('id', id);
}

export async function pullDocs(): Promise<EncryptedDoc[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('documents').select('id, kind, ciphertext, iv, updated_at');
  return (data ?? []).map((d) => ({ id: d.id, kind: d.kind, ct: d.ciphertext, iv: d.iv, updatedAt: d.updated_at, synced: true }));
}

export async function fetchVaultSalt(userId: string | null): Promise<string | null> {
  if (!supabase || !userId) return null;
  const { data } = await supabase.from('profiles').select('vault_salt').eq('id', userId).maybeSingle();
  return data?.vault_salt ?? null;
}

// ───────── account (email) per ritrovare i dati su un altro telefono ─────────
export async function currentEmail(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? data.user?.new_email ?? null;
}

/** Collega un'email all'utente anonimo (arriva una mail di conferma). */
export async function linkEmail(email: string) {
  if (!supabase) throw new Error('offline');
  await ensureSession();
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw error;
}

export async function sendLoginCode(email: string) {
  if (!supabase) throw new Error('offline');
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) throw error;
}

/** Verifica il codice ricevuto via email e ricostruisce il profilo dal server. */
export async function verifyLoginCode(email: string, token: string): Promise<Profile> {
  if (!supabase) throw new Error('offline');
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error || !data.user) throw error ?? new Error('login');
  const uid = data.user.id;
  const [{ data: p }, { data: gm }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
    supabase.from('group_members').select('group_id').eq('user_id', uid).order('joined_at', { ascending: false }).limit(1),
  ]);
  const profile: Profile = {
    userId: uid, lang: p?.lang ?? 'it', role: p?.role ?? 'solo', name: p?.display_name ?? '', phone: p?.phone ?? undefined,
    nationality: p?.nationality ?? undefined, onboarded: true, groupId: gm?.[0]?.group_id ?? null,
    trip: p?.trip_start && p?.trip_end ? { start: p.trip_start, end: p.trip_end } : null,
    hotel: p?.hotel_lat != null ? { name: p.hotel_name ?? 'Hotel', address: p.hotel_address ?? '', lat: p.hotel_lat, lng: p.hotel_lng } : null,
  };
  saveProfileLocal(profile);
  return profile;
}
