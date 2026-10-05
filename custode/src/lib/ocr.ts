// OCR della MRZ sul telefono con tesseract.js (nessun dato inviato a server).
// Il motore e il modello vengono scaricati la prima volta e poi restano in cache.
import { parseMrz, type MrzResult } from './mrz';

type Worker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;
let workerP: Promise<Worker> | null = null;
let progressCb: (p: number) => void = () => {};

async function getWorker() {
  if (!workerP) {
    workerP = (async () => {
      const T = await import('tesseract.js');
      const w = await T.createWorker('eng', T.OEM.LSTM_ONLY, {
        logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') progressCb(m.progress); },
      });
      await w.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<', tessedit_pageseg_mode: T.PSM.SINGLE_BLOCK, preserve_interword_spaces: '0' });
      return w;
    })();
    workerP.catch(() => { workerP = null; });
  }
  return workerP;
}

/** Ritaglia una fascia dell'immagine, la ingrandisce e la porta in bianco e nero ad alto contrasto. */
function band(src: CanvasImageSource, w: number, h: number, from: number, to: number): HTMLCanvasElement {
  const sy = Math.round(h * from), sh = Math.round(h * (to - from));
  const scale = Math.min(2, 2000 / w);
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(sh * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, sy, w, sh, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) { const g = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; d[i] = d[i + 1] = d[i + 2] = g; sum += g; }
  const mean = sum / (d.length / 4);
  for (let i = 0; i < d.length; i += 4) { const v = d[i] < mean * 0.78 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; }
  ctx.putImageData(img, 0, 0);
  return c;
}

export async function readMrz(src: CanvasImageSource, w: number, h: number, onProgress: (p: number) => void): Promise<MrzResult | null> {
  progressCb = onProgress;
  const worker = await getWorker();
  // Prima la parte bassa (dove sta la MRZ), poi fasce piu ampie
  const bands: [number, number][] = [[0.62, 1], [0.5, 1], [0.3, 1], [0, 1]];
  let best: MrzResult | null = null;
  for (const [a, b] of bands) {
    const { data } = await worker.recognize(band(src, w, h, a, b));
    const r = parseMrz(data.text);
    if (r && (!best || Object.values(r.checks).filter(Boolean).length > Object.values(best.checks).filter(Boolean).length)) best = r;
    if (best?.valid) break;
  }
  return best;
}

/** Riduce una foto per conservarla come copia di sicurezza (JPEG ~1400 px). */
export function toJpeg(src: CanvasImageSource, w: number, h: number, max = 1400): string {
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}
