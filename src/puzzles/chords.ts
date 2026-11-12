// Generators for the "chords" skill: chord types beyond sevenths and spread triads.
import type { PuzzleGenerator, Rng } from './types';
import { Note, noteCa, noteName, pc, TONIC_CANDIDATES, midiAtOrAbove, mod } from '../theory/note';
import { Chord, ChordDef, CHORDS, getChord, spellChord, chordSymbol, chordId } from '../theory/chord';
import { voicingFor, voicingPcs, voicingText, voicingMidi, TUNING, FretPos, fretMidi } from '../theory/guitar';
import { choice, optionCount, notesCa, chordMidi } from './util';

const chordKey = (d: ChordDef) => `chord:${d.id}`;

const BOOK: Record<string, string> = {
  sus2: 'suspended-triads', sus4: 'suspended-triads', '7sus4': 'drop2-dom7sus4',
  m7b5: 'drop2-min7b5', dim7: 'drop2-dim7', '7b5': 'drop2-dom7b5', '7#5': 'drop2-aug7',
};
const bookFor = (d: ChordDef): string => BOOK[d.id] ?? (d.tier === 2 ? 'chord-families-scales' : 'chord-formulas');

const TERMS: Record<string, string[]> = {
  m7b5: ['semidisminuït'], dim7: ['disminuït amb 7a disminuïda'], sus2: ['suspès'], sus4: ['suspès'], '7sus4': ['suspès'],
  '9': ['tensió'], maj9: ['tensió'], m9: ['tensió'], '11': ['tensió'], '13': ['tensió'], add9: ['tensió'],
  '7b9': ['dominant alterat'], '7#9': ['dominant alterat'], '7b5': ['dominant alterat'], '7#5': ['dominant alterat'],
};

function poolFor(level: number): ChordDef[] {
  return CHORDS.filter((c) => c.tier <= level || (level === 0 && c.tier === 1 && c.formula.length <= 4));
}

function pickChord(rng: Rng, level: number, concept: string | undefined, usable: (d: ChordDef) => boolean = () => true): Chord {
  const forced = CHORDS.find((d) => chordKey(d) === concept && usable(d));
  // Favour the weak chord types: the solid ones appear mostly as distractors.
  const pool = poolFor(level).filter(usable);
  const weak = pool.filter((d) => d.tier > 0);
  const def = forced ?? (weak.length && rng.next() < 0.85 ? rng.pick(weak) : rng.pick(pool));
  const roots = TONIC_CANDIDATES.filter((r) => spellChord({ root: r, def }).every((n) => Math.abs(n.alt) <= (level >= 2 ? 2 : 1)));
  return { root: rng.pick(roots.slice(0, level === 0 ? 7 : roots.length)), def };
}

const pcKey = (ns: Note[]) => [...new Set(ns.map(pc))].sort((a, b) => a - b).join(',');

const formulaLine = (ch: Chord) =>
  `${notesCa(spellChord(ch))} = ${ch.def.formula.join(' ')}: ${chordSymbol(ch)}, ${ch.def.nameCa}.`;

/** Same-root chords whose notes differ from the target's. */
const sameRootDistractors = (ch: Chord): Chord[] =>
  CHORDS.filter((d) => d.id !== ch.def.id)
    .map((def) => ({ root: ch.root, def }))
    .filter((c) => pcKey(spellChord(c)) !== pcKey(spellChord(ch)))
    .sort((a, b) => Math.abs(a.def.formula.length - ch.def.formula.length) - Math.abs(b.def.formula.length - ch.def.formula.length));

export const chordFromNotes: PuzzleGenerator = {
  id: 'chord-from-notes',
  skill: 'chords',
  requiresAudio: false,
  base: 980,
  bookConcepts: ['chord-formulas', 'chord-families-scales', 'suspended-triads'],
  concepts: CHORDS.map(chordKey),
  make(rng, level, concept) {
    const ch = pickChord(rng, level, concept);
    const notes = spellChord(ch);
    const shown = level === 0 ? notes : rng.shuffle(notes);
    const near = sameRootDistractors(ch).slice(0, 8);
    return {
      difficulty: this.base + 70 * level + 40 * ch.def.tier,
      conceptKey: chordKey(ch.def),
      bookConcept: bookFor(ch.def),
      prompt: level === 0 ? 'Quin acord formen aquestes notes?' : `Quin acord de ${noteCa(ch.root)} formen aquestes notes?`,
      visual: { type: 'notes', notes: shown.map(noteCa) },
      answer: choice<Chord>(rng, ch, near, chordSymbol, optionCount(level)),
      hint: `Ordena-les per terceres des de ${noteCa(ch.root)} i mira la 3a, la 5a i la 7a.`,
      explanation: formulaLine(ch),
      terms: TERMS[ch.def.id] ?? [],
      listen: { type: 'chord', midi: chordMidi(ch) },
      chordHelp: voicingFor(ch) ? [{ symbol: chordSymbol(ch), voicing: voicingFor(ch)! }] : [],
      truth: { kind: 'chord-by-notes', pcs: notes.map(pc) },
    };
  },
};

export const chordFromDiagram: PuzzleGenerator = {
  id: 'chord-from-diagram',
  skill: 'chords',
  requiresAudio: false,
  base: 1040,
  bookConcepts: ['drop-voicings-intro', 'chord-formulas'],
  concepts: CHORDS.map(chordKey),
  make(rng, level, concept) {
    const ch = pickChord(rng, level, concept);
    const voicing = voicingFor(ch)!;
    const sounded = new Set(voicingPcs(voicing));
    // A distractor is only fair if the diagram contains a note that it does not.
    const near = sameRootDistractors(ch).filter((c) => {
      const pcs = new Set(spellChord(c).map(pc));
      return [...sounded].some((p) => !pcs.has(p));
    });
    const names = voicing.map((f, s) => (f === null ? null : s)).filter((s): s is number => s !== null)
      .map((s) => spellChord(ch).find((n) => pc(n) === mod(fretMidi(s, voicing[s]!), 12))!);
    return {
      difficulty: this.base + 70 * level + 40 * ch.def.tier,
      conceptKey: chordKey(ch.def),
      bookConcept: BOOK[ch.def.id] ?? 'drop-voicings-intro',
      prompt: `La tònica és ${noteCa(ch.root)}. Quin acord és?`,
      visual: { type: 'diagram', voicing },
      answer: choice<Chord>(rng, ch, near.slice(0, 8), chordSymbol, optionCount(level)),
      hint: 'Anomena cada nota de greu a agut i busca la 3a i la 7a.',
      explanation: `${voicingText(voicing)} sona ${notesCa(names)}.\n${formulaLine(ch)}${ch.def.formula.length > new Set(names.map(pc)).size ? ' Aquesta posició omet alguna nota (sovint la 5a).' : ''}`,
      terms: TERMS[ch.def.id] ?? [],
      listen: { type: 'chord', midi: voicingMidi(voicing) },
      truth: { kind: 'chord-by-voicing', voicing, root: noteName(ch.root) },
    };
  },
};

export const missingNote: PuzzleGenerator = {
  id: 'spell-chord',
  skill: 'chords',
  requiresAudio: false,
  base: 1000,
  bookConcepts: ['chord-formulas', 'seventh-chords-more'],
  concepts: CHORDS.map(chordKey),
  make(rng, level, concept) {
    const ch = pickChord(rng, level, concept);
    const notes = spellChord(ch);
    const hole = 1 + rng.int(notes.length - 1);
    const target = notes[hole];
    const chordPcs = new Set(notes.map(pc));
    // Wrong notes: a semitone or a tone away from the right one, spelled on nearby letters.
    const wrong: Note[] = [];
    for (const dl of [0, -1, 1]) for (const da of [-1, 1, 0, -2, 2]) {
      const n = { letter: mod(target.letter + dl, 7), alt: target.alt + (dl === 0 ? da : 0) };
      if (Math.abs(n.alt) <= 1 && !chordPcs.has(pc(n))) wrong.push(n);
    }
    for (const n of TONIC_CANDIDATES) if (!chordPcs.has(pc(n))) wrong.push(n);
    return {
      difficulty: this.base + 70 * level + 40 * ch.def.tier,
      conceptKey: chordKey(ch.def),
      bookConcept: bookFor(ch.def),
      prompt: `Quina nota falta a ${chordSymbol(ch)}?`,
      visual: { type: 'notes', notes: notes.map((n, i) => (i === hole ? '?' : noteCa(n))) },
      answer: choice<Note>(rng, target, wrong.slice(0, 6), noteCa, optionCount(level)),
      hint: `Fórmula de l'acord ${ch.def.nameCa}: ${ch.def.formula.join(' ')}.`,
      explanation: formulaLine(ch),
      terms: TERMS[ch.def.id] ?? [],
      listen: { type: 'chord', midi: chordMidi(ch) },
      chordHelp: voicingFor(ch) ? [{ symbol: chordSymbol(ch), voicing: voicingFor(ch)! }] : [],
      truth: { kind: 'missing-note', chord: chordId(ch), shown: notes.filter((_, i) => i !== hole).map(pc) },
    };
  },
};

// ---- Spread triads ----

const INVERSIONS = ['estat fonamental', '1a inversió (3a al baix)', '2a inversió (5a al baix)'];

/** Fretboard positions of a spread triad: bottom voice, then the two upper voices on higher strings. */
export function spreadTriad(ch: Chord, inversion: number, bottomString: number): FretPos[] | null {
  const t = spellChord(ch);
  // Close order from the bass note is a, b, c; the spread form raises the middle voice: a, c, b + octave.
  const [a, b, c] = [t[inversion], t[(inversion + 1) % 3], t[(inversion + 2) % 3]];
  const m0 = midiAtOrAbove(a, TUNING[bottomString] + 1);
  const m1 = midiAtOrAbove(c, m0 + 1);
  const m2 = midiAtOrAbove(b, m1 + 1);
  const f0 = m0 - TUNING[bottomString];
  let best: FretPos[] | null = null;
  let bestSpan = 99;
  for (let s1 = bottomString + 1; s1 < 6; s1++) for (let s2 = s1 + 1; s2 < 6; s2++) {
    const f1 = m1 - TUNING[s1];
    const f2 = m2 - TUNING[s2];
    if (f1 < 0 || f2 < 0) continue;
    const frets = [f0, f1, f2];
    const sp = Math.max(...frets) - Math.min(...frets);
    if (sp < bestSpan) {
      bestSpan = sp;
      best = [{ string: bottomString, fret: f0 }, { string: s1, fret: f1 }, { string: s2, fret: f2 }];
    }
  }
  return bestSpan <= 4 ? best : null;
}

const TRIADS = ['maj', 'm', 'dim', 'sus4'].map(getChord);

export const spreadTriadName: PuzzleGenerator = {
  id: 'spread-triad',
  skill: 'chords',
  requiresAudio: false,
  base: 1080,
  bookConcepts: ['advanced-triads', 'spread-triads-over-bass', 'spread-triad-arpeggios'],
  concepts: [0, 1, 2].map((i) => `spread:${i}`),
  make(rng, level, concept) {
    const forced = concept?.startsWith('spread:') ? Number(concept.slice(7)) : undefined;
    for (;;) {
      const inversion = forced ?? (level === 0 ? 0 : rng.int(3));
      const def = rng.pick(TRIADS.slice(0, level >= 2 ? 4 : 2));
      const root = rng.pick(TONIC_CANDIDATES.slice(0, level === 0 ? 7 : 12));
      const ch: Chord = { root, def };
      const pos = spreadTriad(ch, inversion, rng.int(3));
      if (!pos || pos.some((p) => p.fret > 12)) continue;
      const notes = pos.map((p) => spellChord(ch).find((n) => pc(n) === mod(fretMidi(p.string, p.fret), 12))!);
      const firstFret = Math.max(1, Math.min(...pos.map((p) => p.fret)));
      const pcs = pcKey(spellChord(ch));
      const others: Chord[] = [
        ...TRIADS.filter((d) => d.id !== def.id).map((d) => ({ root, def: d })),
        ...[1, 2].flatMap((i) => TRIADS.slice(0, 2).map((d) => ({ root: spellChord(ch)[i], def: d }))),
      ].filter((c) => pcKey(spellChord(c)) !== pcs);
      return {
        difficulty: this.base + 70 * level,
        conceptKey: `spread:${inversion}`,
        bookConcept: 'spread-triads-over-bass',
        prompt: 'Quina tríada oberta és aquesta?',
        visual: { type: 'fretboard', firstFret, frets: 5, dots: pos },
        answer: choice<Chord>(rng, ch, others, chordSymbol, optionCount(level)),
        hint: 'Anomena les tres notes de greu a agut. La més greu no sempre és la tònica.',
        explanation: `De greu a agut: ${notesCa(notes)}. Són les notes de ${chordSymbol(ch)} (${notesCa(spellChord(ch))}) en ${INVERSIONS[inversion]}, amb la veu del mig pujada una octava.`,
        terms: ['tríada oberta'],
        listen: { type: 'chord', midi: pos.map((p) => fretMidi(p.string, p.fret)) },
        truth: { kind: 'chord-by-positions', positions: pos },
      };
    }
  },
};

export const CHORD_GENERATORS = [chordFromNotes, chordFromDiagram, missingNote, spreadTriadName];
