// Sblocco con impronta / Face ID tramite passkey (WebAuthn, estensione PRF).
// La passkey produce un segreto che esiste solo nel telefono: con quello cifriamo il PIN.
// Senza il dito/volto del proprietario il PIN cifrato non si apre. Il PIN resta valido.
import { createStore, del, get, set } from 'idb-keyval';
import { unlock } from './vault';

const store = createStore('custode-bio', 'bio');
const PRF_SALT = new TextEncoder().encode('custode-vault-unlock-v1');
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

type Saved = { credId: string; iv: string; ct: string };

export async function biometricSupported(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

export const biometricEnabled = async () => !!(await get<Saved>('cred', store));
export const disableBiometric = () => del('cred', store);

async function prfKey(credId: Uint8Array): Promise<CryptoKey | null> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: credId as BufferSource }],
      userVerification: 'required',
      timeout: 60_000,
      extensions: { prf: { eval: { first: PRF_SALT } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  const out = (cred?.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } })?.prf?.results?.first;
  if (!out) return null;
  return crypto.subtle.importKey('raw', out, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Attiva lo sblocco biometrico: serve il PIN attuale (viene verificato). */
export async function enableBiometric(pin: string, userName: string): Promise<'ok' | 'pin' | 'unsupported'> {
  if (!(await unlock(pin))) return 'pin';
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Custode' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: userName || 'Custode', displayName: userName || 'Custode' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60_000,
      extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) return 'unsupported';
  const prfOn = (cred.getClientExtensionResults() as { prf?: { enabled?: boolean } }).prf?.enabled;
  if (prfOn === false) return 'unsupported';
  const credId = new Uint8Array(cred.rawId);
  const k = await prfKey(credId);
  if (!k) return 'unsupported';
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(pin)));
  await set('cred', { credId: b64(credId), iv: b64(iv), ct: b64(ct) } satisfies Saved, store);
  return 'ok';
}

/** Apre la cassaforte con impronta / Face ID. */
export async function unlockWithBiometric(): Promise<boolean> {
  const saved = await get<Saved>('cred', store);
  if (!saved) return false;
  try {
    const k = await prfKey(unb64(saved.credId));
    if (!k) return false;
    const pin = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(saved.iv) as BufferSource }, k, unb64(saved.ct) as BufferSource));
    return unlock(pin);
  } catch {
    return false;
  }
}
