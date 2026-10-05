import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null = modalita locale (nessun progetto Supabase configurato). */
export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 5 } },
}) : null;

export const hasBackend = !!supabase;

/** Garantisce una sessione (accesso anonimo: niente password per il turista). */
export async function ensureSession(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: d, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return d.user?.id ?? null;
}
