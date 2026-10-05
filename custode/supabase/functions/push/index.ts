// Supabase Edge Function "push": riceve il Database Webhook su INSERT in public.alerts
// e invia una notifica Web Push ai destinatari (anche con l'app chiusa).
// Variabili: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, WEBHOOK_SECRET
// (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono gia disponibili nelle funzioni).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:info@example.com', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);

type Alert = { id: string; group_id: string; sender_id: string; target_user_id: string | null; kind: string; message: string | null; lat: number | null; lng: number | null; distance_m: number | null };
type Lang = 'it' | 'en' | 'fr' | 'es' | 'pl' | 'ro';

const T: Record<string, Record<Lang, string>> = {
  out_of_zone: { it: '{name} è fuori zona', en: '{name} is out of the zone', fr: '{name} est hors zone', es: '{name} está fuera de la zona', pl: '{name} jest poza strefą', ro: '{name} e în afara zonei' },
  back_in_zone: { it: '{name} è tornato nel gruppo', en: '{name} is back with the group', fr: '{name} est de retour dans le groupe', es: '{name} ha vuelto al grupo', pl: '{name} wrócił/a do grupy', ro: '{name} s-a întors în grup' },
  im_ok: { it: '{name} dice di stare bene', en: '{name} says they are fine', fr: '{name} dit aller bien', es: '{name} dice que está bien', pl: '{name} mówi, że wszystko w porządku', ro: '{name} spune că e bine' },
  sos: { it: '{name} ha chiesto aiuto (SOS)', en: '{name} asked for help (SOS)', fr: "{name} a demandé de l'aide (SOS)", es: '{name} ha pedido ayuda (SOS)', pl: '{name} prosi o pomoc (SOS)', ro: '{name} a cerut ajutor (SOS)' },
  message: { it: 'Messaggio del capogruppo', en: 'Message from your leader', fr: "Message de l'accompagnateur", es: 'Mensaje del responsable', pl: 'Wiadomość od lidera', ro: 'Mesaj de la lider' },
  plan_published: { it: 'Nuovo programma dal capogruppo', en: 'New plan from your leader', fr: "Nouveau programme de l'accompagnateur", es: 'Nuevo plan del responsable', pl: 'Nowy plan od lidera', ro: 'Program nou de la lider' },
};

Deno.serve(async (req) => {
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (secret && req.headers.get('x-webhook-secret') !== secret) return new Response('forbidden', { status: 403 });
  const body = await req.json();
  const a = (body.record ?? body) as Alert;
  if (!a?.group_id || !T[a.kind]) return new Response('ignored');

  // Destinatari: la persona indicata, altrimenti tutto il gruppo tranne chi invia
  let recipients: string[];
  if (a.target_user_id) recipients = [a.target_user_id];
  else {
    const { data } = await sb.from('group_members').select('user_id').eq('group_id', a.group_id);
    recipients = (data ?? []).map((r) => r.user_id).filter((id) => id !== a.sender_id);
  }
  if (!recipients.length) return new Response('no recipients');

  const { data: sender } = await sb.from('profiles').select('display_name').eq('id', a.sender_id).maybeSingle();
  const name = sender?.display_name || '—';
  const { data: subs } = await sb.from('push_subscriptions').select('*').in('user_id', recipients);

  let sent = 0;
  for (const s of subs ?? []) {
    const lang = (s.lang as Lang) in T.sos ? (s.lang as Lang) : 'en';
    const title = T[a.kind][lang].replace('{name}', name);
    const payload = JSON.stringify({
      title, body: a.message ?? (a.distance_m ? `${a.distance_m} m` : ''), tag: a.kind + ':' + a.sender_id,
      urgent: a.kind === 'sos' || a.kind === 'out_of_zone', url: '/',
    });
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: a.kind === 'sos' ? 'high' : 'normal' });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } });
});
