// Guitar-specific theory: fretboard, chord voicings and scale positions.
import { Note, pc, mod } from './note';
import { Chord, spellChord, chordId } from './chord';

/** MIDI numbers of the open strings, index 0 = low E (6th string) .. 5 = high e (1st string). */
export const TUNING = [40, 45, 50, 55, 59, 64];
/** String labels from the 1st string (top tab line) to the 6th, as required for tabs. */
export const TAB_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];

export const fretMidi = (string: number, fret: number): number => TUNING[string] + fret;
export const fretPc = (string: number, fret: number): number => mod(fretMidi(string, fret), 12);

/** Frets per string, low E first; null = muted. */
export type Voicing = (number | null)[];

type Shape = (number | null)[];
const x = null;

// Movable shapes as offsets from the root fret. E shapes have the root on the 6th string, A shapes on the 5th.
const E_SHAPES: Record<string, Shape> = {
  maj: [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, x, 1, 1, 0, x], sus4: [0, 2, 2, 2, 0, 0], '7sus4': [0, 2, 0, 2, 0, 0],
  m7b5: [0, x, 0, 0, -1, x], dim7: [0, x, -1, 0, -1, x], '13': [0, x, 0, 1, 2, x],
  '7#5': [0, x, 0, 1, 1, x], '7b5': [0, x, 0, 1, -1, x], '6': [0, x, -1, 1, 0, x], m6: [0, x, -1, 0, 0, x],
  mMaj7: [0, x, 1, 0, 0, x], 'maj7#5': [0, x, 1, 1, 1, x], '11': [0, x, 0, -1, -2, x],
};
const A_SHAPES: Record<string, Shape> = {
  maj: [x, 0, 2, 2, 2, 0], m: [x, 0, 2, 2, 1, 0], '7': [x, 0, 2, 0, 2, 0], m7: [x, 0, 2, 0, 1, 0],
  maj7: [x, 0, 2, 1, 2, 0], sus2: [x, 0, 2, 2, 0, 0], sus4: [x, 0, 2, 2, 3, 0], '7sus4': [x, 0, 2, 0, 3, 0],
  dim: [x, 0, 1, 2, 1, x], aug: [x, 0, 3, 2, 2, x], m7b5: [x, 0, 1, 0, 1, x], dim7: [x, 0, 1, -1, 1, x],
  add9: [x, 0, -1, x, 0, 0], '9': [x, 0, -1, 0, 0, x], maj9: [x, 0, -1, 1, 0, x], m9: [x, 0, -2, 0, 0, x],
  '7b9': [x, 0, -1, 0, -1, x], '7#9': [x, 0, -1, 0, 1, x], '6': [x, 0, 2, 2, 2, 2], m6: [x, 0, 2, 2, 1, 2],
  mMaj7: [x, 0, 2, 1, 1, 0],
};

// Open-position forms that no movable shape produces.
const OPEN: Record<string, Voicing> = {
  'C:maj': [x, 3, 2, 0, 1, 0], 'G:maj': [3, 2, 0, 0, 0, 3], 'D:maj': [x, x, 0, 2, 3, 2],
  'D:m': [x, x, 0, 2, 3, 1], 'D:7': [x, x, 0, 2, 1, 2], 'D:m7': [x, x, 0, 2, 1, 1],
  'D:maj7': [x, x, 0, 2, 2, 2], 'D:sus4': [x, x, 0, 2, 3, 3], 'D:sus2': [x, x, 0, 2, 3, 0],
  'C:maj7': [x, 3, 2, 0, 0, 0], 'C:7': [x, 3, 2, 3, 1, 0], 'C:add9': [x, 3, 2, 0, 3, 0],
  'G:7': [3, 2, 0, 0, 0, 1], 'F:maj7': [x, x, 3, 2, 1, 0], 'G:add9': [3, x, 0, 2, 0, 3],
};

function place(shape: Shape, rootString: number, root: Note): Voicing | null {
  let r = mod(pc(root) - TUNING[rootString], 12);
  const min = Math.min(...shape.filter((f): f is number => f !== null));
  if (r + min < 0) r += 12;
  const v = shape.map((f) => (f === null ? null : r + f));
  // An open-position form only works when the shape's zero offsets are open strings.
  return v;
}

const span = (v: Voicing): [number, number] => {
  const fretted = v.filter((f): f is number => f !== null && f > 0);
  return fretted.length ? [Math.min(...fretted), Math.max(...fretted)] : [0, 0];
};

/** A playable voicing for a chord, preferring open forms and low positions. Null if none is known. */
export function voicingFor(ch: Chord): Voicing | null {
  const open = OPEN[chordId(ch)];
  if (open) return open;
  const options: Voicing[] = [];
  const e = E_SHAPES[ch.def.id];
  const a = A_SHAPES[ch.def.id];
  if (e) options.push(place(e, 0, ch.root)!);
  if (a) options.push(place(a, 1, ch.root)!);
  if (!options.length) return null;
  options.sort((p, q) => span(p)[1] - span(q)[1]);
  return options[0];
}

/** Pitch classes sounded by a voicing. */
export const voicingPcs = (v: Voicing): number[] =>
  v.flatMap((f, s) => (f === null ? [] : [fretPc(s, f)]));

/** MIDI notes of a voicing, low to high. */
export const voicingMidi = (v: Voicing): number[] =>
  v.flatMap((f, s) => (f === null ? [] : [fretMidi(s, f)]));

/** Numeric notation low E first, e.g. "x 0 2 2 1 0". */
export const voicingText = (v: Voicing): string => v.map((f) => (f === null ? 'x' : String(f))).join(' ');

/** True if the voicing contains every pitch class in `required` and nothing outside the chord. */
export function voicingMatches(v: Voicing, ch: Chord, required: number[]): boolean {
  const chordPcs = new Set(spellChord(ch).map(pc));
  const got = new Set(voicingPcs(v));
  return [...got].every((p) => chordPcs.has(p)) && required.every((p) => got.has(p));
}

export interface FretPos {
  string: number;
  fret: number;
}

/**
 * One-position fingering of a scale: every scale note between the root on the 6th string
 * and the top of a five-fret window, ordered by pitch. Each pitch appears once.
 */
export function scalePosition(notes: Note[], windowSize = 5): FretPos[] {
  const pcs = new Set(notes.map(pc));
  let rootFret = mod(pc(notes[0]) - TUNING[0], 12);
  if (rootFret === 0) rootFret = 12;
  const lo = rootFret - 1;
  const hi = lo + windowSize - 1;
  const out: FretPos[] = [];
  let last = fretMidi(0, rootFret) - 1;
  for (let s = 0; s < 6; s++) {
    for (let f = lo; f <= hi; f++) {
      const m = fretMidi(s, f);
      if (pcs.has(mod(m, 12)) && m > last) {
        out.push({ string: s, fret: f });
        last = m;
      }
    }
  }
  return out;
}

/** Arpeggio positions for chord tones inside the same window as scalePosition. */
export function arpeggioPosition(chordNotes: Note[], windowSize = 5): FretPos[] {
  return scalePosition(chordNotes, windowSize);
}
