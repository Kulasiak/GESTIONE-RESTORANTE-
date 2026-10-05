// Lettura della zona MRZ dei passaporti (ICAO 9303, formato TD3: 2 righe da 44 caratteri)
// e delle carte d'identita (TD1: 3 righe da 30). Verifica le cifre di controllo.

export type MrzResult = {
  format: 'TD3' | 'TD1';
  docType: string;
  issuer: string;
  surname: string;
  givenNames: string;
  number: string;
  nationality: string;
  birthDate: string; // YYYY-MM-DD
  sex: 'M' | 'F' | 'X';
  expiryDate: string; // YYYY-MM-DD
  valid: boolean; // tutte le cifre di controllo corrette
  checks: { number: boolean; birth: boolean; expiry: boolean; composite: boolean };
  lines: string[];
};

const WEIGHTS = [7, 3, 1];

function charValue(c: string): number {
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
  if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55;
  return 0; // '<'
}

export function checkDigit(s: string): number {
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += charValue(s[i]) * WEIGHTS[i % 3];
  return sum % 10;
}

const ok = (field: string, digit: string) => digit === '<' ? /^<*$/.test(field) : checkDigit(field) === Number(digit);

// Errori tipici dell'OCR nei campi numerici
const toDigits = (s: string) => s.replace(/O|Q|D/g, '0').replace(/I|L/g, '1').replace(/Z/g, '2').replace(/S/g, '5').replace(/B/g, '8').replace(/G/g, '6');
// e nei campi alfabetici
const toLetters = (s: string) => s.replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S').replace(/8/g, 'B').replace(/2/g, 'Z');

function date(yymmdd: string, future: boolean): string {
  const yy = Number(yymmdd.slice(0, 2));
  const now = new Date().getFullYear() % 100;
  // Nascita: nel passato. Scadenza: fino a 20 anni avanti.
  const century = future ? (yy <= now + 20 ? 2000 : 1900) : (yy > now ? 1900 : 2000);
  return `${century + yy}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
}

function names(field: string): { surname: string; givenNames: string } {
  const [sur, ...rest] = field.split('<<');
  const clean = (x: string) => x.replace(/<+/g, ' ').trim();
  return { surname: clean(sur), givenNames: clean(rest.join(' ')) };
}

/** Normalizza il testo OCR in righe candidate fatte solo di A-Z 0-9 < */
export function mrzLines(text: string): string[] {
  return text
    .toUpperCase()
    .replace(/[«‹]/g, '<')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, '').replace(/[^A-Z0-9<]/g, ''))
    .filter((l) => l.length >= 28 && (l.match(/</g)?.length ?? 0) >= 2);
}

function fit(line: string, len: number) {
  return line.length >= len ? line.slice(0, len) : line.padEnd(len, '<');
}

function parseTD3(l1: string, l2: string): MrzResult {
  l1 = fit(l1, 44);
  l2 = fit(l2, 44);
  const number = l2.slice(0, 9);
  const nationality = toLetters(l2.slice(10, 13));
  const birth = toDigits(l2.slice(13, 19));
  const sex = l2[20];
  const expiry = toDigits(l2.slice(21, 27));
  const optional = l2.slice(28, 42);
  const digits = { n: toDigits(l2[9]), b: toDigits(l2[19]), e: toDigits(l2[27]), o: l2[42], c: toDigits(l2[43]) };
  const composite = number + digits.n + birth + digits.b + expiry + digits.e + optional + digits.o;
  const checks = {
    number: ok(number, digits.n) || ok(toDigits(number), digits.n),
    birth: ok(birth, digits.b),
    expiry: ok(expiry, digits.e),
    composite: ok(composite, digits.c),
  };
  return {
    format: 'TD3',
    docType: l1.slice(0, 2).replace(/<+$/, ''),
    issuer: toLetters(l1.slice(2, 5)),
    ...names(toLetters(l1.slice(5))),
    number: number.replace(/<+$/, ''),
    nationality,
    birthDate: date(birth, false),
    sex: sex === 'M' || sex === 'F' ? sex : 'X',
    expiryDate: date(expiry, true),
    valid: Object.values(checks).every(Boolean),
    checks,
    lines: [l1, l2],
  };
}

function parseTD1(l1: string, l2: string, l3: string): MrzResult {
  l1 = fit(l1, 30);
  l2 = fit(l2, 30);
  l3 = fit(l3, 30);
  const number = l1.slice(5, 14);
  const birth = toDigits(l2.slice(0, 6));
  const expiry = toDigits(l2.slice(8, 14));
  const composite = l1.slice(5, 30) + l2.slice(0, 7) + l2.slice(8, 15) + l2.slice(18, 29);
  const checks = {
    number: ok(number, toDigits(l1[14])),
    birth: ok(birth, toDigits(l2[6])),
    expiry: ok(expiry, toDigits(l2[14])),
    composite: ok(composite, toDigits(l2[29])),
  };
  return {
    format: 'TD1',
    docType: l1.slice(0, 2).replace(/<+$/, ''),
    issuer: toLetters(l1.slice(2, 5)),
    ...names(toLetters(l3)),
    number: number.replace(/<+$/, ''),
    nationality: toLetters(l2.slice(15, 18)),
    birthDate: date(birth, false),
    sex: l2[7] === 'M' || l2[7] === 'F' ? (l2[7] as 'M' | 'F') : 'X',
    expiryDate: date(expiry, true),
    valid: Object.values(checks).every(Boolean),
    checks,
    lines: [l1, l2, l3],
  };
}

/** Cerca una MRZ nel testo (OCR o incollato a mano). Restituisce il risultato migliore o null. */
export function parseMrz(text: string): MrzResult | null {
  const lines = mrzLines(text);
  const results: MrzResult[] = [];
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i];
    const b = lines[i + 1];
    const c = lines[i + 2];
    if (b && a.length >= 40 && b.length >= 40 && /^[PV]/.test(a)) results.push(parseTD3(a, b));
    if (b && c && a.length >= 28 && a.length <= 34 && /^[ACI]/.test(a)) results.push(parseTD1(a, b, c));
  }
  if (!results.length) return null;
  const score = (r: MrzResult) => Object.values(r.checks).filter(Boolean).length;
  return results.sort((x, y) => score(y) - score(x))[0];
}

export function maskNumber(n: string) {
  return n.length > 4 ? '•••• ' + n.slice(-4) : n;
}
