// Quick tips for the home screen: one small, complete fact that can be learned in under a minute.
// Tips are generated from the theory core, like the puzzles, so they never run out and are never hand-typed.
import type { ChordHelp, Listen } from '../puzzles/types';
import type { Mastery } from './progress';
import { noteCa, noteCaWords, pc, parseNote, TONIC_CANDIDATES } from '../theory/note';
import { SCALES, ScaleDef, scaleNotes, characteristicNote, validTonics } from '../theory/scale';
import { CHORDS, ChordDef, chordSymbol, spellChord, diatonicChords } from '../theory/chord';
import { METERS, Meter, meterLabel, counting, accentPattern } from '../theory/meter';
import { makeRng, scaleMidi, chordMidi, chordHelp } from '../puzzles/util';
import { degreeCa } from '../i18n/ca';

export interface Tip {
  /** Mastery-map key of the concept the tip teaches. */
  conceptKey: string;
  /** Generator that trains the same concept, for the "practise it" button. */
  generatorId: string;
  eyebrow: string;
  title: string;
  lines: string[];
  listen?: Listen;
  chords?: ChordHelp[];
  /** Eighth-note grouping to draw, for meter tips. */
  rhythm?: number[];
  bookConcept: string | null;
}

const FEMININE = ['melodic-minor', 'harmonic-minor', 'altered'];

function modeTip(s: ScaleDef, seed: number): Tip {
  const rng = makeRng(seed);
  const tonic = rng.pick(validTonics(s, 3).length ? validTonics(s, 3) : validTonics(s));
  const notes = scaleNotes(tonic, s);
  const char = characteristicNote(tonic, s);
  const name = FEMININE.includes(s.id) ? `L'escala ${s.nameCa}` : `El ${s.nameCa}`;
  const lines = [
    `${name} és un ${s.colourCa}.`,
    `A ${noteCa(tonic)}: ${notes.map(noteCa).join(' ')}. La nota que el defineix és ${noteCaWords(char)}, la ${degreeCa(s.characteristic)}.`,
  ];
  let chords: ChordHelp[] | undefined;
  if (s.family === 'major') {
    const all = diatonicChords(tonic, s);
    const carrier = all.find((c) => c.degree !== 0 && c.def.id !== 'dim' && spellChord(c).some((n) => pc(n) === pc(char)));
    if (carrier) {
      lines.push(`Prova-ho: ${all[0].roman} = ${chordSymbol(all[0])} i després ${carrier.roman} = ${chordSymbol(carrier)}, l'acord que porta ${noteCa(char)}.`);
      chords = chordHelp([all[0], carrier]);
    }
  }
  return {
    conceptKey: `mode:${s.id}`,
    generatorId: s.family === 'major' ? 'mode-from-notes' : 'exotic-scale-from-notes',
    eyebrow: s.family === 'major' ? 'Mode' : 'Escala',
    title: `${noteCa(tonic)} ${s.nameCa}`,
    lines,
    listen: { type: 'scale', midi: scaleMidi(tonic, s) },
    chords,
    bookConcept: s.family === 'major' ? 'modal-harmony-theory' : s.family === 'melodic-minor' ? 'modes-melodic-minor' : 'modes-harmonic-minor',
  };
}

function chordTip(def: ChordDef, seed: number): Tip {
  const rng = makeRng(seed);
  const roots = TONIC_CANDIDATES.slice(0, 9).filter((r) => spellChord({ root: r, def }).every((n) => Math.abs(n.alt) <= 1));
  const ch = { root: rng.pick(roots.length ? roots : [parseNote('C')]), def };
  const help = chordHelp([ch]);
  return {
    conceptKey: `chord:${def.id}`,
    generatorId: 'chord-from-notes',
    eyebrow: 'Acord',
    title: chordSymbol(ch),
    lines: [
      `Acord ${def.nameCa}. Fórmula: ${def.formula.join(' ')}.`,
      `${chordSymbol(ch)} = ${spellChord(ch).map(noteCa).join(' ')}.`,
      ...(help.length ? ['Toca\'l i digues el grau de cada nota de greu a agut.'] : []),
    ],
    listen: { type: 'chord', midi: chordMidi(ch) },
    chords: help,
    bookConcept: 'chord-formulas',
  };
}

function meterTip(m: Meter): Tip {
  const groups = m.unit === 8 ? m.groups : m.groups.map(() => 2);
  return {
    conceptKey: `meter:${meterLabel(m)}`,
    generatorId: m.unit === 8 ? 'accent-positions' : 'meter-from-notation',
    eyebrow: 'Compàs',
    title: `${meterLabel(m)}${m.unit === 8 && m.groups.length > 1 ? ` (${m.groups.join('+')})` : ''}`,
    lines: [
      m.unit === 8
        ? `${m.beats} corxeres en grups de ${m.groups.join('+')}. Compta «${counting(m)}».`
        : `${m.beats} temps de negra. Compta «${Array.from({ length: m.beats }, (_, i) => i + 1).join(' ')}».`,
      'Pica de mans a cada número 1 i digues la resta en veu baixa. Quan surti sol, ja el tens.',
    ],
    listen: { type: 'clicks', accents: accentPattern(m), bpm: m.unit === 8 ? 200 : 110 },
    rhythm: groups,
    bookConcept: null,
  };
}

const WEAK_CHORDS = CHORDS.filter((c) => c.tier > 0);
const TIP_METERS = METERS.filter((m) => meterLabel(m) !== '4/4');

/** Every tip the app can give, as (concept key, builder). */
const CATALOG: { key: string; build: (seed: number) => Tip }[] = [
  ...SCALES.filter((s) => s.id !== 'ionian').map((s) => ({ key: `mode:${s.id}`, build: (seed: number) => modeTip(s, seed) })),
  ...WEAK_CHORDS.map((d) => ({ key: `chord:${d.id}`, build: (seed: number) => chordTip(d, seed) })),
  ...TIP_METERS.map((m) => ({ key: `meter:${meterLabel(m)}`, build: () => meterTip(m) })),
];

/**
 * The tip for a seed. Concepts in progress come first, then new ones, then solid ones,
 * so the tip usually lands on something that is about to click.
 */
export function makeTip(seed: number, mastery: Record<string, Mastery> = {}): Tip {
  const rank = (k: string) => ({ learning: 0, new: 1, solid: 2 })[mastery[k] ?? 'new'];
  const best = Math.min(...CATALOG.map((c) => rank(c.key)));
  const pool = CATALOG.filter((c) => rank(c.key) === best);
  const rng = makeRng(seed);
  return rng.pick(pool).build(seed);
}

export const TIP_COUNT = CATALOG.length;

/** Day number in local time; the default tip changes once a day. */
export const daySeed = (now: Date): number =>
  Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000);
