import { describe, expect, it } from 'vitest';
import { defaultDay, today, tripDays } from '../api';

describe('giorni del viaggio', () => {
  it('elenca i giorni inclusi', () => {
    expect(tripDays({ start: '2026-10-29', end: '2026-11-01' })).toEqual(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  });
  it('date assenti o invertite: nessun giorno', () => {
    expect(tripDays(null)).toEqual([]);
    expect(tripDays({ start: '2026-10-05', end: '2026-10-01' })).toEqual([]);
  });
  it('apre su oggi se dentro il viaggio, altrimenti sul primo giorno', () => {
    const t = today();
    expect(defaultDay({ start: t, end: t })).toBe(t);
    expect(defaultDay({ start: '2999-01-01', end: '2999-01-03' })).toBe('2999-01-01');
    expect(defaultDay(null)).toBe(t);
  });
});
