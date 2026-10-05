import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../state';
import { Back } from '../components/ui';
import { PinCreate, PinUnlock } from '../components/Pin';
import { Scan } from './Scan';
import { deleteDoc, isUnlocked, listDocs, lock, saveDoc, vaultExists, type DocContent, type DocKind } from '../lib/vault';
import { maskNumber } from '../lib/mrz';
import { syncDocs } from '../lib/docsync';
import { deleteRemoteDoc } from '../lib/api';
import { loadImage, toJpeg } from '../lib/ocr';
import type { Dict } from '../i18n';

type Doc = DocContent & { id: string };
const CODE: Record<DocKind, string> = { passport: 'PA', id: 'ID', boarding: 'CI', hotel: 'HV', insurance: 'AS', ticket: 'BT', other: '··' };
export const kindLabel = (k: DocKind, t: Dict) => ({ passport: t.kPassport, id: t.kId, boarding: t.kBoarding, hotel: t.kHotel, insurance: t.kInsurance, ticket: t.kTicket, other: t.kOther })[k];

/** Stato della cassaforte condiviso dalle schermate dei documenti. */
function useVault() {
  const [state, setState] = useState<'loading' | 'none' | 'locked' | 'open'>('loading');
  const [docs, setDocs] = useState<Doc[]>([]);
  const refresh = async () => {
    if (!(await vaultExists())) return setState('none');
    if (!isUnlocked()) return setState('locked');
    setDocs(await listDocs());
    setState('open');
  };
  useEffect(() => { refresh(); }, []);
  return { state, docs, refresh };
}

function Locked({ create, onOpen }: { create: boolean; onOpen: () => void }) {
  const { t } = useApp();
  return (
    <div className="col gap16" style={{ minHeight: 560, alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 4px' }}>
      <div className="lock" aria-hidden>
        <div style={{ position: 'relative', width: 34, height: 40 }}>
          <div style={{ position: 'absolute', left: 6, top: 0, width: 22, height: 22, border: '4px solid var(--terra)', borderBottom: 'none', borderRadius: '12px 12px 0 0' }} />
          <div style={{ position: 'absolute', left: 0, bottom: 0, width: 34, height: 24, borderRadius: 6, background: 'var(--terra)' }} />
        </div>
      </div>
      <h1 className="h2">{t.docsTitle}</h1>
      <p className="body muted" style={{ margin: 0 }}>{t.lockedD}</p>
      <div style={{ width: '100%', textAlign: 'left', marginTop: 8 }}>{create ? <PinCreate onDone={onOpen} /> : <PinUnlock onDone={onOpen} />}</div>
    </div>
  );
}

export function Docs() {
  const { t, go, profile } = useApp();
  const { state, docs, refresh } = useVault();
  useEffect(() => { if (state === 'open') syncDocs(profile.userId).then(refresh).catch(() => {}); }, [state === 'open']); // eslint-disable-line react-hooks/exhaustive-deps
  if (state === 'loading') return null;
  if (state !== 'open') return <div className="page"><Locked create={state === 'none'} onOpen={refresh} /></div>;

  const passport = docs.find((d) => d.kind === 'passport' || d.kind === 'id');
  const rest = docs.filter((d) => d !== passport);
  const f = (k: string) => passport?.fields?.find((x) => x.k === k)?.v ?? '';
  return (
    <div className="page">
      <div className="col gap8"><h1 className="h2">{t.docsTitle}</h1>
        <div className="row between"><span className="badge" style={{ color: 'var(--green-ink)', background: 'var(--green-soft)' }}>{t.encOff}</span>
          <button className="link" style={{ color: 'var(--muted)' }} onClick={() => { lock(); refresh(); }}>{t.lockNow}</button></div>
      </div>
      {passport && (
        <button className="passcard" onClick={() => go({ sub: 'doc', param: passport.id })}>
          <div className="row between eyebrow" style={{ color: 'var(--paper)' }}><span>{passport.subtitle}</span><span className="mono">{f(t.fNat)}</span></div>
          <div className="serif" style={{ fontSize: 32 }}>{passport.title}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="col gap4"><span className="k">{t.fNum}</span><span style={{ fontSize: 15, fontWeight: 600 }}>{maskNumber(f(t.fNum))}</span></div>
            <div className="col gap4"><span className="k">{t.fExp}</span><span style={{ fontSize: 15, fontWeight: 600 }}>{f(t.fExp).split('-').reverse().slice(1).join('/')}</span></div>
          </div>
          {passport.mrz && <div className="mono" style={{ fontSize: 10, color: '#CDBFAE', letterSpacing: '.05em', whiteSpace: 'nowrap', overflow: 'hidden' }}>{passport.mrz[0]}</div>}
          <div style={{ fontSize: 13, color: '#E6D9C7', lineHeight: 1.4, borderTop: '1px solid rgba(255,255,255,.15)', paddingTop: 12 }}>{t.backupNote}</div>
        </button>
      )}
      {rest.length > 0 ? (
        <div className="card list">
          {rest.map((d) => (
            <button key={d.id} className="list-row" style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--line-2)', textAlign: 'left' }} onClick={() => go({ sub: 'doc', param: d.id })}>
              <div className="doc-ic">{CODE[d.kind]}</div>
              <div className="col gap4 grow"><span style={{ fontSize: 15, fontWeight: 700 }}>{d.title}</span><span className="small muted">{d.subtitle || kindLabel(d.kind, t)}</span></div>
              <span className="small b" style={{ color: 'var(--green)' }}>{t.offline}</span>
            </button>
          ))}
        </div>
      ) : !passport ? <div className="note gold">{t.docEmpty}</div> : null}
      <button className="btn dashed" onClick={() => go({ sub: 'addDoc', param: 'scan' })}>+ {t.scanNew}</button>
      <button className="btn dashed" onClick={() => go({ sub: 'addDoc' })}>+ {t.addMore}</button>
      <button className="row gap12" style={{ textAlign: 'left', padding: 16, borderRadius: 20, border: 'none', background: 'var(--red-soft)' }} onClick={() => go({ sub: 'lost' })}>
        <div className="col gap4 grow"><span style={{ fontSize: 16, fontWeight: 700, color: 'var(--red-ink)' }}>{t.lost}</span><span style={{ fontSize: 14, color: 'var(--ink-2)' }}>{t.lostD}</span></div>
        <span style={{ fontSize: 18, color: 'var(--red-ink)' }} aria-hidden>→</span>
      </button>
    </div>
  );
}

function openDataUrl(dataUrl: string) {
  fetch(dataUrl).then((r) => r.blob()).then((b) => window.open(URL.createObjectURL(b), '_blank'));
}

export function DocDetail({ id }: { id: string }) {
  const { t, go, profile, toast } = useApp();
  const { state, docs, refresh } = useVault();
  const [qr, setQr] = useState<string | null>(null);
  const doc = docs.find((d) => d.id === id);
  useEffect(() => {
    if (doc?.code) QRCode.toDataURL(doc.code, { margin: 1, width: 420, color: { dark: '#2A211B', light: '#ffffff' } }).then(setQr).catch(() => setQr(null));
  }, [doc?.code]);
  if (state === 'loading') return null;
  if (state !== 'open') return <div className="page"><Back /><Locked create={state === 'none'} onOpen={refresh} /></div>;
  if (!doc) return <div className="page"><Back /></div>;

  async function remove() {
    if (!confirm(t.confirmDelete)) return;
    await deleteDoc(id);
    deleteRemoteDoc(id).catch(() => {});
    go({ tab: 'docs' });
  }
  async function share() {
    // Condivide la copia (foto) del documento, ad esempio con la polizia o l'ambasciata
    if (!doc!.file) return;
    const blob = await (await fetch(doc!.file.dataUrl)).blob();
    const file = new File([blob], doc!.file.name, { type: doc!.file.type });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: doc!.title }).catch(() => {});
    else openDataUrl(doc!.file.dataUrl);
    toast(t.toastCopy);
  }

  const ticket = doc.kind === 'ticket';
  return (
    <div className="page">
      <Back />
      {ticket ? (
        <>
          <h1 className="h2">{t.ticketT}</h1>
          <div style={{ borderRadius: 22, overflow: 'hidden', background: '#fff', border: '1px solid var(--line)' }}>
            <div className="col gap4" style={{ background: 'var(--terra)', color: '#FBF3EA', padding: 18 }}><span className="serif" style={{ fontSize: 30 }}>{doc.title}</span><span style={{ fontSize: 14, fontWeight: 600 }}>{doc.subtitle}</span></div>
            <div className="col gap18" style={{ padding: 22, alignItems: 'center', borderBottom: '2px dashed var(--line)' }}>
              {qr ? <img className="qr" src={qr} alt={doc.code} /> : doc.file?.type.startsWith('image/') ? <img src={doc.file.dataUrl} alt="" style={{ maxWidth: '100%', borderRadius: 10 }} /> : null}
              {doc.code && <span className="mono small b" style={{ letterSpacing: '.08em', wordBreak: 'break-all', textAlign: 'center' }}>{doc.code}</span>}
              <span className="small muted" style={{ textAlign: 'center' }}>{t.ticketValid}</span>
            </div>
            <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="col gap4"><span className="small muted b">{t.passenger}</span><span className="b">{profile.name || '—'}</span></div>
              {doc.fields?.map((f) => <div key={f.k} className="col gap4"><span className="small muted b">{f.k}</span><span className="b">{f.v}</span></div>)}
            </div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--green-txt)' }}>✓ {t.ticketSaved}</div>
        </>
      ) : (
        <>
          <div className="col gap4"><span className="eyebrow">{kindLabel(doc.kind, t)}</span><h1 className="h2">{doc.title}</h1>{doc.subtitle && <span className="muted">{doc.subtitle}</span>}</div>
          {doc.fields && doc.fields.length > 0 && (
            <div className="card list">{doc.fields.map((f) => <div key={f.k} className="list-row between"><span className="muted">{f.k}</span><span className="b" style={{ textAlign: 'right', whiteSpace: 'pre-wrap' }}>{f.v}</span></div>)}</div>
          )}
          {doc.mrz && <div className="mono card" style={{ fontSize: 11, letterSpacing: '.04em', overflowX: 'auto', whiteSpace: 'pre' }}>{doc.mrz.join('\n')}</div>}
          {doc.file?.type.startsWith('image/') && <img src={doc.file.dataUrl} alt={doc.title} style={{ width: '100%', borderRadius: 16, border: '1px solid var(--line)' }} />}
          {(doc.kind === 'passport' || doc.kind === 'id') && <div className="note gold">{t.backupNote}</div>}
        </>
      )}
      {doc.file && doc.file.type === 'application/pdf' && <button className="btn outline sm" onClick={() => openDataUrl(doc.file!.dataUrl)}>{t.openFile} · PDF</button>}
      {doc.url && <a className="btn outline sm" href={doc.url} target="_blank" rel="noreferrer">{t.officialSite}</a>}
      {doc.file && <button className="btn dark sm" onClick={share}>{t.share}</button>}
      <button className="btn ghost" style={{ color: 'var(--red)' }} onClick={remove}>{t.deleteBtn}</button>
    </div>
  );
}

const KIND_CHOICES: DocKind[] = ['boarding', 'hotel', 'insurance', 'ticket', 'id', 'other'];

/** param: 'scan' → scansione MRZ; 'ticket|nome|tratta|prezzo|url' → biglietto precompilato */
export function AddDoc({ kind: param }: { kind?: string }) {
  const { t, go, profile, toast } = useApp();
  const { state, refresh } = useVault();
  const pre = param?.startsWith('ticket|') ? param.split('|') : null;
  const [kind, setKind] = useState<DocKind>(pre ? 'ticket' : 'boarding');
  const [title, setTitle] = useState(pre?.[1] ?? '');
  const [details, setDetails] = useState(pre?.[2] ?? '');
  const [code, setCode] = useState('');
  const [file, setFile] = useState<DocContent['file']>();
  const [busy, setBusy] = useState(false);
  if (param === 'scan') return <Scan />;
  if (state === 'loading') return null;
  if (state !== 'open') return <div className="page"><Back /><Locked create={state === 'none'} onOpen={refresh} /></div>;

  async function pick(f?: File) {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast('Max 8 MB'); return; }
    if (f.type.startsWith('image/')) {
      const img = await loadImage(f);
      setFile({ name: f.name, type: 'image/jpeg', dataUrl: toJpeg(img, img.naturalWidth, img.naturalHeight, 1800) });
    } else {
      const dataUrl = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f); });
      setFile({ name: f.name, type: f.type || 'application/octet-stream', dataUrl });
    }
  }

  async function save() {
    setBusy(true);
    try {
      const rec = await saveDoc({
        kind, title: title.trim() || kindLabel(kind, t), subtitle: details.split('\n')[0]?.trim() || undefined,
        fields: [
          ...(details.includes('\n') ? [{ k: t.docNote, v: details.trim() }] : []),
          ...(pre?.[3] ? [{ k: t.fare, v: pre[3] }] : []),
        ],
        code: code.trim() || undefined, file, url: pre?.[4] || undefined, createdAt: new Date().toISOString(),
      });
      syncDocs(profile.userId).catch(() => {});
      go({ tab: 'docs', sub: 'doc', param: rec.id });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <Back />
      <h1 className="h2">{t.addDocTitle}</h1>
      <div className="col gap8"><span className="label">{t.docType}</span>
        <div className="row gap8 wrap">{KIND_CHOICES.map((k) => <button key={k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{kindLabel(k, t)}</button>)}</div>
      </div>
      <label className="field"><span className="label">{t.docTitle}</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kindLabel(kind, t)} /></label>
      <label className="field"><span className="label">{t.docNote}</span><textarea className="input" value={details} onChange={(e) => setDetails(e.target.value)} placeholder={kind === 'boarding' ? 'AZ 609 · JFK → FCO' : kind === 'hotel' ? 'Hotel · 24–28/09' : ''} /></label>
      {(kind === 'ticket' || kind === 'boarding') && (
        <label className="field"><span className="label">{t.docCode}</span><input className="input mono" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" /></label>
      )}
      <label className="btn dashed" style={{ cursor: 'pointer' }}>
        {file ? '✓ ' + file.name : '+ ' + t.docFile}
        <input type="file" accept="image/*,application/pdf" className="sr" onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      {file?.type.startsWith('image/') && <img src={file.dataUrl} alt="" style={{ width: '100%', borderRadius: 14 }} />}
      <button className="btn" disabled={busy} onClick={save}>{t.save}</button>
    </div>
  );
}
