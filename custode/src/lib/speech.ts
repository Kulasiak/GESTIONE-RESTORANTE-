// Racconti audio con la sintesi vocale del telefono (funziona offline su Android e iOS).
import { LOCALE, type Lang } from '../i18n';

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text: string, lang: Lang | 'it', onProgress?: (p: number) => void, onEnd?: () => void) {
  if (!canSpeak()) { onEnd?.(); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LOCALE[lang as Lang] ?? 'it-IT';
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(u.lang.slice(0, 2)));
  if (voice) u.voice = voice;
  u.rate = 0.95;
  u.onboundary = (e) => onProgress?.(Math.min(1, e.charIndex / text.length));
  u.onend = () => { onProgress?.(1); onEnd?.(); };
  u.onerror = () => onEnd?.();
  speechSynthesis.speak(u);
}

export const stopSpeaking = () => { if (canSpeak()) speechSynthesis.cancel(); };
