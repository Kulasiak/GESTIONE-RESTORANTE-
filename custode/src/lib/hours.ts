// Orari di apertura calcolati sull'ora di Roma, con le regole della domenica.

export type Slot = [string, string];
export type Hours = { always?: true; lastSunday?: Slot[] } & Partial<Record<'0' | '1' | '2' | '3' | '4' | '5' | '6', Slot[]>>;

export type RomeNow = { y: number; m: number; d: number; dow: number; minutes: number };

/** Data e ora correnti a Roma, qualunque sia il fuso del telefono. */
export function romeNow(at: Date = new Date()): RomeNow {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { y: +get('year'), m: +get('month'), d: +get('day'), dow, minutes: +get('hour') * 60 + +get('minute') };
}

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};
export const fromMin = (x: number) => {
  const v = ((x % 1440) + 1440) % 1440;
  return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
};
export const addMin = (hhmm: string, m: number) => fromMin(toMin(hhmm) + m);

/** Prima domenica del mese (musei statali gratuiti). */
export const isFirstSunday = (n: RomeNow) => n.dow === 0 && n.d <= 7;
/** Ultima domenica del mese (Musei Vaticani gratuiti). */
export function isLastSunday(n: RomeNow) {
  const daysInMonth = new Date(n.y, n.m, 0).getDate();
  return n.dow === 0 && n.d + 7 > daysInMonth;
}

/** Prossima prima domenica del mese a partire da oggi (incluso), come Date locale. */
export function nextFirstSunday(n: RomeNow): Date {
  for (let k = 0; k < 2; k++) {
    const first = new Date(n.y, n.m - 1 + k, 1);
    const sunday = new Date(first);
    sunday.setDate(1 + ((7 - first.getDay()) % 7));
    const today = new Date(n.y, n.m - 1, n.d);
    if (sunday >= today) return sunday;
  }
  return new Date(n.y, n.m, 1);
}

export type OpenState =
  | { kind: 'always' }
  | { kind: 'open'; until: string }
  | { kind: 'later'; opens: string } // apre piu tardi oggi
  | { kind: 'closed' } // chiuso oggi
  | { kind: 'ended'; at: string } // ha gia chiuso oggi
  | { kind: 'unknown' };

export function slotsFor(h: Hours, n: RomeNow): Slot[] {
  if (n.dow === 0 && h.lastSunday && isLastSunday(n)) return h.lastSunday;
  return h[String(n.dow) as '0'] ?? [];
}

export function openState(h: Hours | null | undefined, n: RomeNow = romeNow()): OpenState {
  if (!h) return { kind: 'unknown' };
  if (h.always) return { kind: 'always' };
  const slots = slotsFor(h, n);
  if (!slots.length) return { kind: 'closed' };
  for (const [a, b] of slots) {
    if (n.minutes >= toMin(a) && n.minutes < toMin(b)) return { kind: 'open', until: b };
    if (n.minutes < toMin(a)) return { kind: 'later', opens: a };
  }
  return { kind: 'ended', at: slots[slots.length - 1][1] };
}
