import it from './locales/it.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import pl from './locales/pl.json';
import ro from './locales/ro.json';

export const LANGS = ['it', 'en', 'fr', 'es', 'pl', 'ro'] as const;
export type Lang = (typeof LANGS)[number];
export type Dict = typeof it;
export type TKey = keyof Dict;

export const DICTS: Record<Lang, Dict> = { it, en, fr, es, pl, ro };
export const LANG_NAMES: Record<Lang, string> = { it: 'Italiano', en: 'English', fr: 'Français', es: 'Español', pl: 'Polski', ro: 'Română' };
export const LOCALE: Record<Lang, string> = { it: 'it-IT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', pl: 'pl-PL', ro: 'ro-RO' };

/** Testo multilingua (dati di luoghi, percorsi...) */
export type Loc = string | Partial<Record<Lang, string>> | null | undefined;
export const L = (o: Loc, lang: Lang): string => (o == null ? '' : typeof o === 'string' ? o : o[lang] ?? o.en ?? o.it ?? '');

/** Sostituisce {segnaposto} */
export const fmt = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

export function detectLang(): Lang {
  const nav = (navigator.languages ?? [navigator.language]).map((l) => l.slice(0, 2).toLowerCase());
  return (nav.find((l) => (LANGS as readonly string[]).includes(l)) as Lang) ?? 'en';
}
