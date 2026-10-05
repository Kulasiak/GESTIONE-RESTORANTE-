import { describe, expect, it } from 'vitest';
import { addMin, isFirstSunday, isLastSunday, openState, romeNow, type Hours } from '../hours';

const vatican: Hours = { '1': [['08:00', '19:00']], '6': [['08:00', '19:00']], lastSunday: [['09:00', '14:00']] };
const callisto: Hours = { '1': [['09:00', '12:00'], ['14:00', '17:00']] };

describe('orari', () => {
  it('ora di Roma indipendente dal fuso', () => {
    const n = romeNow(new Date('2026-10-04T08:30:00Z')); // domenica, 10:30 a Roma (ora legale)
    expect(n.dow).toBe(0);
    expect(n.minutes).toBe(10 * 60 + 30);
    expect(isFirstSunday(n)).toBe(true);
  });
  it('ultima domenica del mese', () => {
    expect(isLastSunday(romeNow(new Date('2026-10-25T10:00:00Z')))).toBe(true);
    expect(isLastSunday(romeNow(new Date('2026-10-18T10:00:00Z')))).toBe(false);
  });
  it('Vaticani: chiusi la domenica, aperti l\'ultima domenica', () => {
    expect(openState(vatican, romeNow(new Date('2026-10-18T09:00:00Z'))).kind).toBe('closed');
    expect(openState(vatican, romeNow(new Date('2026-10-25T09:00:00Z')))).toEqual({ kind: 'open', until: '14:00' });
  });
  it('fasce con pausa pranzo', () => {
    const mon = (h: string) => romeNow(new Date(`2026-10-05T${h}:00Z`)); // UTC+2
    expect(openState(callisto, mon('08:00'))).toEqual({ kind: 'open', until: '12:00' });
    expect(openState(callisto, mon('10:30'))).toEqual({ kind: 'later', opens: '14:00' });
    expect(openState(callisto, mon('16:00'))).toEqual({ kind: 'ended', at: '17:00' });
  });
  it('somma minuti', () => {
    expect(addMin('23:50', 15)).toBe('00:05');
    expect(addMin('09:15', -35)).toBe('08:40');
  });
});
