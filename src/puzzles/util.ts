import type { Rng, Answer, ChordHelp } from './types';
import { Note, noteCa, midiAtOrAbove, pc } from '../theory/note';
import { ScaleDef, scaleNotes, validTonics, accidentalCount } from '../theory/scale';
import { Chord, chordSymbol, spellChord } from '../theory/chord';
import { voicingFor, voicingMidi } from '../theory/guitar';

/** Deterministic PRNG (mulberry32). */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const shuffle = <T,>(xs: readonly T[]): T[] => {
    const out = [...xs];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  return { next, int, pick: (xs) => xs[int(xs.length)], shuffle };
}

/** Tonic for a scale, limited by level: more accidentals at higher levels. */
export function pickTonic(rng: Rng, scale: ScaleDef, level: number): Note {
  const max = [2, 4, 6][Math.min(level, 2)];
  const pool = validTonics(scale, max);
  return rng.pick(pool.length ? pool : validTonics(scale));
}

export const keyCost = (tonic: Note, scale: ScaleDef): number => 12 * accidentalCount(tonic, scale);

/** Build a shuffled multiple-choice answer from one correct entry and distractors. */
export function choice<T>(
  rng: Rng, correct: T, distractors: T[], label: (v: T) => string, count: number,
): Answer {
  const seen = new Set([label(correct)]);
  const picked: T[] = [];
  for (const d of rng.shuffle(distractors)) {
    if (picked.length >= count - 1) break;
    if (seen.has(label(d))) continue;
    seen.add(label(d));
    picked.push(d);
  }
  const all = rng.shuffle([correct, ...picked]);
  return {
    type: 'choice',
    options: all.map(label),
    values: all,
    correctIndex: all.indexOf(correct),
  };
}

export const optionCount = (level: number): number => (level === 0 ? 3 : 4);

export const scaleName = (tonic: Note, scale: ScaleDef): string => `${noteCa(tonic)} ${scale.nameCa}`;

export const notesCa = (ns: Note[]): string => ns.map(noteCa).join(' ');

/** Ascending MIDI run of a scale over one octave, starting near the guitar's middle register. */
export function scaleMidi(tonic: Note, scale: ScaleDef): number[] {
  const out: number[] = [];
  let floor = 48;
  for (const n of [...scaleNotes(tonic, scale), tonic]) {
    const m = midiAtOrAbove(n, floor);
    out.push(m);
    floor = m + 1;
  }
  return out;
}

/** MIDI for a chord: the guitar voicing when one exists, otherwise stacked chord tones. */
export function chordMidi(ch: Chord): number[] {
  const v = voicingFor(ch);
  if (v) return voicingMidi(v);
  const out: number[] = [];
  let floor = 45;
  for (const n of spellChord(ch)) {
    const m = midiAtOrAbove(n, floor);
    out.push(m);
    floor = m + 1;
  }
  return out;
}

export function chordHelp(chords: Chord[]): ChordHelp[] {
  const seen = new Set<string>();
  const out: ChordHelp[] = [];
  for (const ch of chords) {
    const symbol = chordSymbol(ch);
    const voicing = voicingFor(ch);
    if (!voicing || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({ symbol, voicing });
  }
  return out;
}

export const pcsOf = (ns: Note[]): number[] => ns.map(pc);
