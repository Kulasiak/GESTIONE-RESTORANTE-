// Backup dei documenti cifrati su Supabase e ripristino su un nuovo telefono.
import * as api from './api';
import { listEncrypted, putEncrypted } from './vault';

export async function syncDocs(userId: string | null) {
  if (!userId || !navigator.onLine) return;
  try {
    const pending = (await listEncrypted()).filter((d) => !d.synced);
    const done = await api.pushDocs(userId, pending);
    for (const d of pending) if (done.includes(d.id)) await putEncrypted({ ...d, synced: true });
    // Documenti salvati da un altro dispositivo con lo stesso account
    const local = new Set((await listEncrypted()).map((d) => d.id));
    for (const r of await api.pullDocs()) if (!local.has(r.id)) await putEncrypted(r);
  } catch { /* nuovo tentativo alla prossima apertura */ }
}
