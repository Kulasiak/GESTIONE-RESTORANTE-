import { describe, expect, it } from 'vitest';
import { checkDigit, parseMrz } from '../mrz';

// Esempi ufficiali ICAO 9303
const TD3 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10';
const TD1 = 'I<UTOD231458907<<<<<<<<<<<<<<<\n7408122F1204159UTO<<<<<<<<<<<6\nERIKSSON<<ANNA<MARIA<<<<<<<<<<';

describe('mrz', () => {
  it('cifra di controllo', () => {
    expect(checkDigit('L898902C3')).toBe(6);
    expect(checkDigit('740812')).toBe(2);
    expect(checkDigit('120415')).toBe(9);
  });
  it('passaporto TD3', () => {
    const r = parseMrz(TD3)!;
    expect(r.valid).toBe(true);
    expect(r.surname).toBe('ERIKSSON');
    expect(r.givenNames).toBe('ANNA MARIA');
    expect(r.number).toBe('L898902C3');
    expect(r.nationality).toBe('UTO');
    expect(r.birthDate).toBe('1974-08-12');
    expect(r.expiryDate).toBe('2012-04-15');
    expect(r.sex).toBe('F');
  });
  it("carta d'identita TD1", () => {
    const r = parseMrz(TD1)!;
    expect(r.valid).toBe(true);
    expect(r.number).toBe('D23145890');
    expect(r.surname).toBe('ERIKSSON');
  });
  it('tollera rumore OCR: spazi, righe extra, O al posto di 0', () => {
    const noisy = 'REPUBLIC OF UTOPIA\nP<UTOERIKSSON<<ANNA<MARIA<<<< <<<<<<<<<<<<<<<\nL898902C36UTO74O8122F12O4159ZE184226B<<<<<1O\n';
    const r = parseMrz(noisy)!;
    expect(r.checks.birth).toBe(true);
    expect(r.checks.expiry).toBe(true);
    expect(r.birthDate).toBe('1974-08-12');
  });
  it('rifiuta testo senza MRZ', () => {
    expect(parseMrz('ciao mondo')).toBeNull();
  });
});
