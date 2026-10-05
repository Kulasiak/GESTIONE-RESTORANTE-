// Cassaforte dei documenti: AES-GCM 256 con chiave derivata dal PIN (PBKDF2-SHA256).
// Tutto resta cifrato in IndexedDB sul telefono (funziona offline). La chiave vive
// solo in memoria finche la cassaforte e aperta.
import { createStore, del, get, set, values } from 'idb-keyval';

const store = createStore('custode-vault', 'docs');
const metaStore = createStore('custode-vault-meta', 'meta');
const ITER = 310_000;
const VERIFY = 'custode-ok';

export type DocKind = 'passport' | 'id' | 'boarding' | 'hotel' | 'insurance' | 'ticket' | 'other';

export type DocContent = {
  kind: DocKind;
  title: string;
  subtitle?: string;
  fields?: { k: string; v: string }[];
  mrz?: string[];
  code?: string; // codice del biglietto (genera il QR)
  file?: { name: string; type: string; dataUrl: string }; // foto o PDF
  url?: string;
  createdAt: string;
};

export type EncryptedDoc = { id: string; kind: DocKind; iv: string; ct: string; updatedAt: string; synced?: boolean };

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (b: ArrayBuffer | Uint8Array) => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

let key: CryptoKey | null = null;

async function deriveKey(pin: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: ITER, hash: 'SHA-256' }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function encryptWith(k: CryptoKey, data: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(data));
  return { iv: b64(iv), ct: b64(ct) };
}
async function decryptWith(k: CryptoKey, iv: string, ct: string) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) as BufferSource }, k, unb64(ct) as BufferSource);
  return dec.decode(pt);
}

export async function vaultExists() {
  return !!(await get('salt', metaStore));
}
export const isUnlocked = () => key !== null;
export const lock = () => { key = null; };
export const getSalt = () => get<string>('salt', metaStore);

/** Crea la cassaforte con un nuovo PIN (o con il sale gia salvato sul server, per ripristino). */
export async function createVault(pin: string, existingSalt?: string) {
  const salt = existingSalt ? unb64(existingSalt) : crypto.getRandomValues(new Uint8Array(16));
  const k = await deriveKey(pin, salt);
  const check = await encryptWith(k, VERIFY);
  await set('salt', b64(salt), metaStore);
  await set('check', check, metaStore);
  key = k;
  return b64(salt);
}

export async function unlock(pin: string): Promise<boolean> {
  const salt = await get<string>('salt', metaStore);
  const check = await get<{ iv: string; ct: string }>('check', metaStore);
  if (!salt || !check) return false;
  const k = await deriveKey(pin, unb64(salt));
  try {
    if ((await decryptWith(k, check.iv, check.ct)) !== VERIFY) return false;
  } catch {
    return false;
  }
  key = k;
  return true;
}

export async function saveDoc(content: DocContent, id: string = crypto.randomUUID()) {
  if (!key) throw new Error('vault locked');
  const { iv, ct } = await encryptWith(key, JSON.stringify(content));
  const rec: EncryptedDoc = { id, kind: content.kind, iv, ct, updatedAt: new Date().toISOString(), synced: false };
  await set(id, rec, store);
  return rec;
}

export async function putEncrypted(rec: EncryptedDoc) {
  await set(rec.id, rec, store);
}

export async function listEncrypted(): Promise<EncryptedDoc[]> {
  return (await values<EncryptedDoc>(store)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listDocs(): Promise<(DocContent & { id: string })[]> {
  if (!key) throw new Error('vault locked');
  const out: (DocContent & { id: string })[] = [];
  for (const r of await listEncrypted()) {
    try {
      out.push({ id: r.id, ...JSON.parse(await decryptWith(key, r.iv, r.ct)) });
    } catch {
      /* documento cifrato con un altro PIN: ignorato */
    }
  }
  return out;
}

export const deleteDoc = (id: string) => del(id, store);

export const KINDS: DocKind[] = ['passport', 'id', 'boarding', 'hotel', 'insurance', 'ticket', 'other'];

/** Blocca la cassaforte se l'app resta in background per piu di un minuto. */
export function installAutoLock(ms = 60_000) {
  let timer = 0;
  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer);
    if (document.visibilityState === 'hidden') timer = window.setTimeout(lock, ms);
  });
}

/**
 * Ripristino su un nuovo telefono: prova il PIN sui documenti scaricati (cifrati).
 * Se almeno uno si decifra, salva sale, verifica e documenti e apre la cassaforte.
 */
export async function restoreVault(pin: string, saltB64: string, docs: EncryptedDoc[]): Promise<boolean> {
  if (!docs.length) return false;
  const k = await deriveKey(pin, unb64(saltB64));
  try {
    await decryptWith(k, docs[0].iv, docs[0].ct);
  } catch {
    return false;
  }
  await set('salt', saltB64, metaStore);
  await set('check', await encryptWith(k, VERIFY), metaStore);
  for (const d of docs) await set(d.id, { ...d, synced: true }, store);
  key = k;
  return true;
}
