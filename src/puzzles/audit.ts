// Independent re-solver: decides, from the theory core alone, whether an option answers a puzzle.
// It never looks at correctIndex, so a generator bug cannot hide behind its own answer key.
import type { Puzzle } from './types';
import { Note, parseNote, pc, mod, intervalBetween, degreeName, sameNote, transpose, parseDegree } from '../theory/note';
import { ScaleDef, SCALES, getScale, scaleNotes } from '../theory/scale';
import { Chord, getChord, spellChord, romanNumeral } from '../theory/chord';
import { fretPc, FretPos, Voicing } from '../theory/guitar';

const setEq = (a: number[], b: number[]) => {
  const x = [...new Set(a)].sort();
  const y = [...new Set(b)].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};
const parseChord = (id: string): Chord => {
  const [r, d] = id.split(':');
  return { root: parseNote(r), def: getChord(d) };
};
const fits = (ch: Chord, tonic: Note, s: ScaleDef) => {
  const pcs = scaleNotes(tonic, s).map(pc);
  return spellChord(ch).every((n) => pcs.includes(pc(n)));
};

/** The note that separates a mode from its plain major or natural minor neighbour. */
function characteristicBySemitones(tonic: Note, s: ScaleDef): Note {
  const table: Record<string, number> = { dorian: 9, phrygian: 1, lydian: 6, mixolydian: 10, aeolian: 8, locrian: 6 };
  return scaleNotes(tonic, s).find((n) => mod(pc(n) - pc(tonic), 12) === table[s.id])!;
}

function meterOf(groups: number[]): string {
  const total = groups.reduce((a, b) => a + b, 0);
  return groups.every((g) => g === 2) ? `${groups.length}/4` : `${total}/8`;
}

/** True if `value` is a correct answer to the puzzle's truth statement. */
export function isCorrect(p: Puzzle, value: unknown): boolean {
  const t = p.truth as unknown as Record<string, never>;
  switch (p.truth.kind) {
    case 'scale-by-formula':
      return (value as ScaleDef).formula.join() === (t.formula as string[]).join();
    case 'char-note':
      return sameNote(value as Note, characteristicBySemitones(parseNote(t.tonic), getScale(t.scaleId)));
    case 'scale-by-notes':
      return setEq(scaleNotes(parseNote(t.tonic), value as ScaleDef).map(pc), t.pcs);
    case 'parent': {
      const s = getScale(t.scaleId);
      const parent = SCALES.find((x) => x.family === s.family && x.modeIndex === 0)!;
      return setEq(scaleNotes(value as Note, parent).map(pc), scaleNotes(parseNote(t.tonic), s).map(pc));
    }
    case 'roman-to-chord': {
      const ch = value as Chord;
      const tonic = parseNote(t.tonic);
      if (!fits(ch, tonic, getScale(t.scaleId))) return false;
      return romanNumeral(degreeName(intervalBetween(tonic, ch.root)), ch.def.id) === t.roman;
    }
    case 'mode-by-progression': {
      return (t.chords as string[]).every((c) => fits(parseChord(c), parseNote(t.tonic), value as ScaleDef));
    }
    case 'chord-by-notes':
      return setEq(spellChord(value as Chord).map(pc), t.pcs);
    case 'chord-by-voicing': {
      const pcs = spellChord(value as Chord).map(pc);
      return (t.voicing as Voicing).every((f, s) => f === null || pcs.includes(fretPc(s, f)));
    }
    case 'chord-by-positions':
      return setEq(spellChord(value as Chord).map(pc), (t.positions as FretPos[]).map((q) => fretPc(q.string, q.fret)));
    case 'missing-note': {
      const pcs = spellChord(parseChord(t.chord)).map(pc);
      const n = value as Note;
      return pcs.includes(pc(n)) && !(t.shown as number[]).includes(pc(n));
    }
    case 'roman-seq': {
      const tonic = parseNote(t.tonic);
      const want = (t.chords as string[]).map(parseChord)
        .map((c) => romanNumeral(degreeName(intervalBetween(tonic, c.root)), c.def.id));
      return want.join() === (value as string[]).join();
    }
    case 'secondary-dominant': {
      const target = parseChord(t.target);
      const ch = value as Chord;
      return ch.def.id === '7' && sameNote(ch.root, transpose(target.root, parseDegree('5')));
    }
    case 'meter-by-groups':
      return value === meterOf(t.groups);
    case 'accents': {
      const starts: number[] = [];
      (t.groups as number[]).reduce((at, g) => (starts.push(at), at + g), 1);
      return starts.join() === (value as number[]).join();
    }
    default:
      throw new Error(`No solver for ${p.truth.kind}`);
  }
}

/** Problems found in one puzzle; empty means it passed. */
export function auditPuzzle(p: Puzzle): string[] {
  const errors: string[] = [];
  if (p.answer.type === 'choice') {
    const { options, values, correctIndex } = p.answer;
    if (new Set(options).size !== options.length) errors.push('duplicate options');
    if (options.length < 3) errors.push('fewer than 3 options');
    const right = values.map((v) => isCorrect(p, v));
    if (!right[correctIndex]) errors.push(`keyed answer "${options[correctIndex]}" is wrong`);
    right.forEach((r, i) => {
      if (r && i !== correctIndex) errors.push(`option "${options[i]}" is also correct`);
    });
  } else {
    const t = p.truth as unknown as { pc: number; firstFret: number; frets: number };
    const key = (q: FretPos) => `${q.string}:${q.fret}`;
    const accepted = new Set(p.answer.accept.map(key));
    if (!accepted.size) errors.push('no accepted position');
    for (let s = 0; s < 6; s++) for (let f = t.firstFret; f < t.firstFret + t.frets; f++) {
      const should = fretPc(s, f) === t.pc;
      if (should !== accepted.has(key({ string: s, fret: f }))) errors.push(`tap ${s}:${f} mismatch`);
    }
  }
  if (!p.explanation || p.explanation.length > 420) errors.push('explanation missing or too long for 30 seconds');
  if (!p.prompt) errors.push('empty prompt');
  return errors;
}
