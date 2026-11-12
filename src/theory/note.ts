// Notes, intervals and transposition. Pure functions, no UI or storage imports.

/** A spelled note: letter 0..6 = C D E F G A B, alt = number of sharps (+) or flats (-). */
export interface Note {
  letter: number;
  alt: number;
}

/** An interval as letter steps (0 = unison, 2 = a third) and semitones. */
export interface Interval {
  steps: number;
  semis: number;
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTERS_CA = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

export const mod = (n: number, m: number): number => ((n % m) + m) % m;

/** Pitch class 0..11 (C = 0). */
export const pc = (n: Note): number => mod(LETTER_PC[n.letter] + n.alt, 12);

export function parseNote(s: string): Note {
  const letter = LETTERS.indexOf(s[0].toUpperCase());
  if (letter < 0) throw new Error(`Bad note: ${s}`);
  let alt = 0;
  for (const c of s.slice(1)) {
    if (c === '#' || c === '♯') alt++;
    else if (c === 'b' || c === '♭') alt--;
    else throw new Error(`Bad note: ${s}`);
  }
  return { letter, alt };
}

const accidental = (alt: number, sharp: string, flat: string): string =>
  alt >= 0 ? sharp.repeat(alt) : flat.repeat(-alt);

/** English letter name, e.g. "Bb". Used for ids and tests. */
export const noteName = (n: Note): string => LETTERS[n.letter] + accidental(n.alt, '#', 'b');

/** Catalan solfège name with symbols, e.g. "Si♭". Used for chord symbols and answer options. */
export const noteCa = (n: Note): string => LETTERS_CA[n.letter] + accidental(n.alt, '♯', '♭');

/** Catalan name in words, e.g. "Si bemoll". Used in running prose. */
export function noteCaWords(n: Note): string {
  const words = n.alt === 0 ? '' : n.alt > 0 ? ' sostingut' : ' bemoll';
  return LETTERS_CA[n.letter] + (Math.abs(n.alt) === 2 ? ' doble' : '') + words;
}

export const sameNote = (a: Note, b: Note): boolean => a.letter === b.letter && a.alt === b.alt;

/**
 * Parse a scale degree such as "1", "b3", "#4", "bb7", "9", "#11".
 * The unaltered degree is measured against the major scale.
 */
export function parseDegree(d: string): Interval {
  const m = /^([b#]*)(\d+)$/.exec(d);
  if (!m) throw new Error(`Bad degree: ${d}`);
  const n = Number(m[2]) - 1;
  let semis = LETTER_PC[n % 7] + 12 * Math.floor(n / 7);
  for (const c of m[1]) semis += c === '#' ? 1 : -1;
  return { steps: n, semis };
}

/** Name an interval as a degree relative to the major scale, e.g. {2, 3} -> "b3". */
export function degreeName(iv: Interval): string {
  const base = LETTER_PC[mod(iv.steps, 7)] + 12 * Math.floor(iv.steps / 7);
  const diff = iv.semis - base;
  return accidental(diff, '#', 'b') + String(iv.steps + 1);
}

export function transpose(n: Note, iv: Interval): Note {
  const letter = mod(n.letter + iv.steps, 7);
  const target = mod(pc(n) + iv.semis, 12);
  let alt = mod(target - LETTER_PC[letter], 12);
  if (alt > 6) alt -= 12;
  return { letter, alt };
}

/** Interval from a up to b, within one octave. */
export function intervalBetween(a: Note, b: Note): Interval {
  return { steps: mod(b.letter - a.letter, 7), semis: mod(pc(b) - pc(a), 12) };
}

/** MIDI number of a note at or above a floor MIDI value. */
export function midiAtOrAbove(n: Note, floor: number): number {
  return floor + mod(pc(n) - floor, 12);
}

/** Tonic candidates used by generators: naturals, common flats and sharps. */
export const TONIC_CANDIDATES: Note[] = [
  'C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'F#', 'C#', 'G#',
].map(parseNote);
