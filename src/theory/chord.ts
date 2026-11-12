// Chord spelling, diatonic harmony and Roman numerals.
import { Note, parseDegree, transpose, pc, mod, noteCa, noteName, intervalBetween } from './note';
import { ScaleDef, scaleNotes } from './scale';

export interface ChordDef {
  id: string;
  /** Suffix appended to the root, e.g. "m7". Empty for a major triad. */
  suffix: string;
  nameCa: string;
  formula: string[];
  /** Rough difficulty tier: 0 = solid already, 1 = beyond sevenths, 2 = altered. */
  tier: 0 | 1 | 2;
}

const C = (id: string, suffix: string, nameCa: string, formula: string, tier: 0 | 1 | 2): ChordDef => ({
  id, suffix, nameCa, formula: formula.split(' '), tier,
});

export const CHORDS: ChordDef[] = [
  C('maj', '', 'major', '1 3 5', 0),
  C('m', 'm', 'menor', '1 b3 5', 0),
  C('dim', '°', 'disminuït', '1 b3 b5', 0),
  C('aug', '+', 'augmentat', '1 3 #5', 1),
  C('sus2', 'sus2', 'suspès de segona', '1 2 5', 1),
  C('sus4', 'sus4', 'suspès de quarta', '1 4 5', 1),
  C('maj7', 'maj7', 'major amb 7a major', '1 3 5 7', 0),
  C('7', '7', 'dominant (7a)', '1 3 5 b7', 0),
  C('m7', 'm7', 'menor amb 7a', '1 b3 5 b7', 0),
  C('m7b5', 'm7♭5', 'semidisminuït', '1 b3 b5 b7', 1),
  C('dim7', '°7', 'disminuït amb 7a disminuïda', '1 b3 b5 bb7', 1),
  C('mMaj7', 'm(maj7)', 'menor amb 7a major', '1 b3 5 7', 1),
  C('6', '6', 'major amb 6a', '1 3 5 6', 1),
  C('m6', 'm6', 'menor amb 6a', '1 b3 5 6', 1),
  C('add9', 'add9', 'major amb 9a afegida', '1 3 5 9', 1),
  C('7sus4', '7sus4', 'dominant suspès', '1 4 5 b7', 1),
  C('maj9', 'maj9', 'major amb 7a major i 9a', '1 3 5 7 9', 1),
  C('9', '9', 'dominant amb 9a', '1 3 5 b7 9', 1),
  C('m9', 'm9', 'menor amb 7a i 9a', '1 b3 5 b7 9', 1),
  C('11', '11', 'dominant amb 11a', '1 5 b7 9 11', 2),
  C('13', '13', 'dominant amb 13a', '1 3 b7 9 13', 2),
  C('7b9', '7♭9', 'dominant amb 9a bemoll', '1 3 5 b7 b9', 2),
  C('7#9', '7♯9', 'dominant amb 9a augmentada', '1 3 5 b7 #9', 2),
  C('7b5', '7♭5', 'dominant amb 5a bemoll', '1 3 b5 b7', 2),
  C('7#5', '7♯5', 'dominant amb 5a augmentada', '1 3 #5 b7', 2),
  C('maj7#5', 'maj7♯5', 'major amb 7a major i 5a augmentada', '1 3 #5 7', 2),
];

export function getChord(id: string): ChordDef {
  const c = CHORDS.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown chord: ${id}`);
  return c;
}

export interface Chord {
  root: Note;
  def: ChordDef;
}

export const spellChord = (ch: Chord): Note[] => ch.def.formula.map((d) => transpose(ch.root, parseDegree(d)));

/** Chord symbol with Catalan note names, e.g. "Si♭m7". */
export const chordSymbol = (ch: Chord): string => noteCa(ch.root) + ch.def.suffix;

/** Stable ASCII id, e.g. "Bb:m7". */
export const chordId = (ch: Chord): string => `${noteName(ch.root)}:${ch.def.id}`;

const TRIADS: Record<string, string> = { '4,7': 'maj', '3,7': 'm', '3,6': 'dim', '4,8': 'aug' };
const SEVENTHS: Record<string, string> = {
  '4,7,11': 'maj7', '4,7,10': '7', '3,7,10': 'm7', '3,6,10': 'm7b5',
  '3,6,9': 'dim7', '3,7,11': 'mMaj7', '4,8,11': 'maj7#5', '4,8,10': '7#5',
};

export interface DiatonicChord extends Chord {
  /** 0-based scale degree of the root. */
  degree: number;
  roman: string;
}

/** Roman numeral for a chord built on a scale degree, e.g. ("b7", maj) -> "bVII". */
export function romanNumeral(degree: string, chordDefId: string): string {
  const m = /^([b#]*)(\d)$/.exec(degree);
  if (!m) throw new Error(`Bad degree: ${degree}`);
  const base = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][Number(m[2]) - 1];
  const minorish = ['m', 'dim', 'm7', 'm7b5', 'dim7', 'mMaj7'].includes(chordDefId);
  const suffix: Record<string, string> = {
    maj: '', m: '', dim: '°', aug: '+', maj7: 'maj7', '7': '7', m7: '7', m7b5: 'ø7',
    dim7: '°7', mMaj7: '(maj7)', 'maj7#5': '+maj7', '7#5': '+7',
  };
  return m[1] + (minorish ? base.toLowerCase() : base) + (suffix[chordDefId] ?? '');
}

/** Chords built in thirds on every degree of a scale. */
export function diatonicChords(tonic: Note, scale: ScaleDef, sevenths = false): DiatonicChord[] {
  const notes = scaleNotes(tonic, scale);
  return notes.map((root, i) => {
    const stack = [2, 4, ...(sevenths ? [6] : [])].map((k) => notes[(i + k) % 7]);
    const key = stack.map((n) => mod(pc(n) - pc(root), 12)).join(',');
    const id = (sevenths ? SEVENTHS : TRIADS)[key];
    if (!id) throw new Error(`Unnamed chord ${key} on degree ${i} of ${scale.id}`);
    return { root, def: getChord(id), degree: i, roman: romanNumeral(scale.formula[i], id) };
  });
}

/** Degree name of each chord tone relative to the chord root, e.g. ["1","b3","5"]. */
export const chordToneDegrees = (ch: Chord): string[] => ch.def.formula;

/** True if every chord tone belongs to the scale (by pitch class). */
export function chordFitsScale(ch: Chord, tonic: Note, scale: ScaleDef): boolean {
  const pcs = new Set(scaleNotes(tonic, scale).map(pc));
  return spellChord(ch).every((n) => pcs.has(pc(n)));
}

/** Semitone distance of a note above a chord root; helper for explanations. */
export const semisAbove = (root: Note, n: Note): number => intervalBetween(root, n).semis;
