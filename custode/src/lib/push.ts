// Iscrizione alle notifiche push (servono VITE_VAPID_PUBLIC_KEY e la funzione Supabase "push").
import { supabase } from './supabase';
import type { Lang } from '../i18n';

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
export const pushAvailable = () => !!VAPID && !!supabase && 'serviceWorker' in navigator && 'PushManager' in window;

const keyBytes = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

export async function pushEnabled(): Promise<boolean> {
  if (!pushAvailable()) return false;
  const reg = await navigator.serviceWorker.ready;
  return !!(await reg.pushManager.getSubscription());
}

export async function enablePush(userId: string, lang: Lang): Promise<boolean> {
  if (!pushAvailable() || !userId) return false;
  if ((await Notification.requestPermission()) !== 'granted') return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID!) as BufferSource }));
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase!.from('push_subscriptions').upsert({ endpoint: j.endpoint, user_id: userId, p256dh: j.keys.p256dh, auth: j.keys.auth, lang });
  if (!error) localStorage.setItem('custode.push', '1');
  return !error;
}

export async function disablePush() {
  if (!pushAvailable()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await supabase!.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
  localStorage.removeItem('custode.push');
}
