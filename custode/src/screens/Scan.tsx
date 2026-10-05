import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state';
import { Back } from '../components/ui';
import { PinCreate, PinUnlock } from '../components/Pin';
import { parseMrz, maskNumber, type MrzResult } from '../lib/mrz';
import { loadImage, readMrz, toJpeg } from '../lib/ocr';
import { isUnlocked, saveDoc, vaultExists } from '../lib/vault';
import { syncDocs } from '../lib/docsync';

type Step = 'capture' | 'confirm' | 'saved';
type Data = { surname: string; given: string; number: string; nationality: string; birth: string; expiry: string; docType: string; mrz: string[] };

const fromMrz = (r: MrzResult): Data => ({
  surname: r.surname, given: r.givenNames, number: r.number, nationality: r.nationality,
  birth: r.birthDate, expiry: r.expiryDate, docType: r.docType, mrz: r.lines,
});
const cap = (s: string) => s.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase());

export function Scan({ onboarding }: { onboarding?: boolean }) {
  const { t, profile, setProfile, go, toast } = useApp();
  const [step, setStep] = useState<Step>('capture');
  const [camOn, setCamOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(t.scanHint);
  const [pct, setPct] = useState(0);
  const [manual, setManual] = useState(false);
  const [mrzText, setMrzText] = useState('');
  const [data, setData] = useState<Data | null>(null);
  const [checksOk, setChecksOk] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);
  const [vault, setVault] = useState<'none' | 'locked' | 'open'>('locked');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => { vaultExists().then((e) => setVault(!e ? 'none' : isUnlocked() ? 'open' : 'locked')); }, [step]);
  useEffect(() => () => streamRef.current?.getTracks().forEach((tr) => tr.stop()), []);

  async function openCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = s;
      setCamOn(true);
      requestAnimationFrame(() => { if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}); } });
    } catch {
      toast(t.camDenied);
    }
  }
  const stopCamera = () => { streamRef.current?.getTracks().forEach((tr) => tr.stop()); streamRef.current = null; setCamOn(false); };

  async function runOcr(src: CanvasImageSource, w: number, h: number) {
    setBusy(true);
    setPct(0);
    setStatus(t.ocrLoading);
    try {
      setPhoto(toJpeg(src, w, h));
      const r = await readMrz(src, w, h, (p) => { setStatus(t.scanning); setPct(Math.round(p * 100)); });
      if (!r) { setStatus(t.scanFail); toast(t.scanFail); return; }
      setPct(100);
      accept(r);
    } catch {
      setStatus(t.scanFail);
    } finally {
      setBusy(false);
    }
  }

  function accept(r: MrzResult) {
    stopCamera();
    setData(fromMrz(r));
    setChecksOk(r.valid);
    setStep('confirm');
  }

  async function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    await runOcr(c, c.width, c.height);
  }

  async function pickFile(f: File | undefined) {
    if (!f) return;
    stopCamera();
    const img = await loadImage(f);
    await runOcr(img, img.naturalWidth, img.naturalHeight);
  }

  function readManual() {
    const r = parseMrz(mrzText);
    if (!r) { toast(t.scanFail); return; }
    accept(r);
  }

  async function save() {
    if (!data || !isUnlocked()) return;
    const full = cap(`${data.given} ${data.surname}`.trim());
    await saveDoc({
      kind: data.docType.startsWith('P') ? 'passport' : 'id',
      title: full,
      subtitle: `${data.docType.startsWith('P') ? t.kPassport : t.kId} · ${data.nationality}`,
      fields: [
        { k: t.fSurname, v: data.surname }, { k: t.fGiven, v: data.given }, { k: t.fNum, v: data.number },
        { k: t.fNat, v: data.nationality }, { k: t.fBirth, v: data.birth }, { k: t.fExp, v: data.expiry },
      ],
      mrz: data.mrz,
      file: photo ? { name: 'scan.jpg', type: 'image/jpeg', dataUrl: photo } : undefined,
      createdAt: new Date().toISOString(),
    });
    await setProfile({ nationality: data.nationality, name: profile.name || cap(data.given.split(' ')[0] ?? '') });
    syncDocs(profile.userId).catch(() => {});
    setStep('saved');
  }

  const finish = () => {
    if (onboarding) { setProfile({ onboarded: true }); go({ screen: 'app', tab: 'today' }); }
    else go({ screen: 'app', tab: 'docs' });
  };

  if (step === 'saved' && data) {
    return (
      <div className="scroller">
        <div className="page" style={{ minHeight: '100%', gap: 18, paddingTop: 18, paddingBottom: 'calc(30px + var(--safe-b))' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--green)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 700 }} aria-hidden>✓</div>
          <h1 className="h1" style={{ fontSize: 42 }}>{t.savedTitle}</h1>
          <div style={{ fontSize: 15, color: 'var(--green)', fontWeight: 600 }}>{t.savedBody}</div>
          <div className="card" style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[[t.fName, cap(`${data.given} ${data.surname}`)], [t.fNat, data.nationality], [t.fNum, maskNumber(data.number)], [t.fExp, data.expiry.split('-').reverse().slice(1).join('/')]].map(([k, v]) => (
              <div key={k} className="col gap4"><span className="small muted" style={{ fontWeight: 600 }}>{k}</span><span style={{ fontSize: 16, fontWeight: 600 }}>{v}</span></div>
            ))}
          </div>
          <button className="row between" style={{ textAlign: 'left', padding: 16, borderRadius: 18, border: '1.5px dashed var(--dash)', background: 'transparent' }}
            onClick={() => { if (onboarding) setProfile({ onboarded: true }); go({ screen: 'app', tab: 'docs', sub: 'addDoc' }); }}>
            <div className="col gap4"><span style={{ fontSize: 16, fontWeight: 700 }}>{t.addMore}</span><span className="small muted">{t.addMoreD}</span></div>
            <span style={{ fontSize: 22, color: 'var(--terra)' }}>+</span>
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={finish}>{t.continue}</button>
        </div>
      </div>
    );
  }

  if (step === 'confirm' && data) {
    const set = (k: keyof Data) => (e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, [k]: e.target.value.toUpperCase() });
    return (
      <div className="scroller">
        <div className="page" style={{ paddingBottom: 'calc(30px + var(--safe-b))' }}>
          <span className="eyebrow">{t.step2}</span>
          <h1 className="h1">{t.confirmData}</h1>
          {!checksOk && <div className="note red">{t.scanChecksBad}</div>}
          <div className="card col gap10">
            {([['surname', t.fSurname], ['given', t.fGiven], ['number', t.fNum], ['nationality', t.fNat], ['birth', t.fBirth], ['expiry', t.fExp]] as [keyof Data, string][]).map(([k, label]) => (
              <label key={k} className="field"><span className="label">{label}</span>
                <input className="input" value={data[k] as string} onChange={set(k)} type={k === 'birth' || k === 'expiry' ? 'date' : 'text'} /></label>
            ))}
          </div>
          {vault === 'none' && <div className="card"><PinCreate onDone={() => setVault('open')} /></div>}
          {vault === 'locked' && <div className="card"><PinUnlock onDone={() => setVault('open')} /></div>}
          {vault === 'open' && <button className="btn" onClick={save}>{t.save}</button>}
          <button className="btn ghost" onClick={() => { setStep('capture'); setData(null); }}>{t.cancelBtn}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="scroller">
      <div className="page" style={{ minHeight: '100%', paddingBottom: 'calc(30px + var(--safe-b))' }}>
        {onboarding ? <span className="eyebrow">{t.step2}</span> : <Back />}
        <h1 className="h1">{t.scanTitle}</h1>
        <p className="body muted" style={{ margin: 0 }}>{t.scanBody}</p>
        <div className="scanbox">
          {camOn ? <video ref={videoRef} playsInline muted /> : photo ? <img src={photo} alt="" /> : <PassportSketch />}
          <div className="corner" style={{ left: 16, top: 16, borderLeftWidth: 3, borderTopWidth: 3, borderRadius: '8px 0 0 0' }} />
          <div className="corner" style={{ right: 16, top: 16, borderRightWidth: 3, borderTopWidth: 3, borderRadius: '0 8px 0 0' }} />
          <div className="corner" style={{ left: 16, bottom: 16, borderLeftWidth: 3, borderBottomWidth: 3, borderRadius: '0 0 0 8px' }} />
          <div className="corner" style={{ right: 16, bottom: 16, borderRightWidth: 3, borderBottomWidth: 3, borderRadius: '0 0 8px 0' }} />
          {camOn && <div className="mrzguide" />}
          {busy && <div className="scanline" />}
        </div>
        <div className="col gap8">
          <div className="row between small muted" style={{ fontWeight: 600 }} aria-live="polite"><span>{status}</span><span>{pct}%</span></div>
          <div className="progress"><div style={{ width: pct + '%' }} /></div>
        </div>
        {manual ? (
          <div className="col gap8">
            <span className="small muted">{t.mrzHelp}</span>
            <textarea className="input mono" style={{ fontSize: 13, letterSpacing: '.04em' }} rows={3} value={mrzText} onChange={(e) => setMrzText(e.target.value.toUpperCase())} placeholder={'P<ITAROSSI<<MARIO<<<<<<<<<<<<<<<<<<<<<<<<<<<\nYA1234567<ITA8001014M3001012<<<<<<<<<<<<<<04'} spellCheck={false} autoCapitalize="characters" />
            <button className="btn sm dark" onClick={readManual}>{t.readMrz}</button>
          </div>
        ) : null}
        <div style={{ flex: 1 }} />
        {camOn ? (
          <button className="btn" disabled={busy} onClick={capture}>{busy ? t.scanning : t.capture}</button>
        ) : (
          <button className="btn" disabled={busy} onClick={openCamera}>{busy ? t.scanning : t.scanCamera}</button>
        )}
        <div className="row gap8">
          <label className="btn outline sm grow" style={{ cursor: 'pointer', height: 'auto', minHeight: 46, padding: '8px 10px', textAlign: 'center', fontSize: 14 }}>
            {t.scanPhoto}
            <input type="file" accept="image/*" className="sr" onChange={(e) => pickFile(e.target.files?.[0])} />
          </label>
          <button className="btn outline sm grow" style={{ height: 'auto', minHeight: 46, padding: '8px 10px', fontSize: 14 }} onClick={() => setManual(!manual)}>{t.scanManual}</button>
        </div>
        {onboarding && <button className="btn ghost" onClick={finish}>{t.skip}</button>}
      </div>
    </div>
  );
}

function PassportSketch() {
  return (
    <div style={{ width: 272, height: 178, borderRadius: 10, background: '#EFE3D0', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }} aria-hidden>
      <div className="row gap12" style={{ alignItems: 'flex-start' }}>
        <div style={{ width: 60, height: 76, borderRadius: 6, background: '#D5C6B0' }} />
        <div className="col gap8" style={{ paddingTop: 4 }}>{[120, 86, 108, 64].map((w) => <div key={w} style={{ width: w, height: 7, borderRadius: 4, background: '#CDBDA5' }} />)}</div>
      </div>
      <div className="mono" style={{ marginTop: 'auto', fontSize: 9.5, letterSpacing: '.05em', color: '#4A3E35', lineHeight: 1.55, whiteSpace: 'nowrap', overflow: 'hidden' }}>
        P&lt;GBRSMITH&lt;&lt;EMMA&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;<br />5334821&lt;&lt;3GBR8807146F3103228&lt;&lt;&lt;&lt;
      </div>
    </div>
  );
}
