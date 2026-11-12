// Generators for the "modes" skill: major modes plus the modes of harmonic and melodic minor.
import type { PuzzleGenerator, Rng } from './types';
import { Note, noteCa, noteCaWords, noteName, parseDegree, transpose, pc, sameNote } from '../theory/note';
import {
  ScaleDef, SCALES, MAJOR_MODES, getScale, scaleNotes, characteristicNote, parentTonic, isMinorScale,
} from '../theory/scale';
import { Chord, DiatonicChord, diatonicChords, chordSymbol, chordFitsScale, spellChord, getChord, chordId } from '../theory/chord';
import { fretPc, FretPos, TUNING } from '../theory/guitar';
import { mod } from '../theory/note';
import { degreeCa, ORDINALS } from '../i18n/ca';
import { pickTonic, keyCost, choice, optionCount, scaleName, notesCa, scaleMidi, chordMidi, chordHelp } from './util';

const modeKey = (s: ScaleDef) => `mode:${s.id}`;
const fromKey = (k: string | undefined, pool: ScaleDef[], rng: Rng): ScaleDef =>
  pool.find((s) => modeKey(s) === k) ?? rng.pick(pool);

const NOT_IONIAN = MAJOR_MODES.filter((s) => s.id !== 'ionian');
const EXOTIC = SCALES.filter((s) => s.family !== 'major');

const bookFor = (s: ScaleDef): string =>
  s.family === 'major' ? 'modal-harmony-theory' : s.family === 'melodic-minor' ? 'modes-melodic-minor' : 'modes-harmonic-minor';

/** Modes that share the major/minor quality come first as distractors: they are the near misses. */
const siblings = (s: ScaleDef, pool: ScaleDef[]): ScaleDef[] => {
  const same = pool.filter((x) => x.id !== s.id && isMinorScale(x) === isMinorScale(s));
  const other = pool.filter((x) => x.id !== s.id && isMinorScale(x) !== isMinorScale(s));
  return [...same, ...other];
};

const colourLine = (s: ScaleDef) => `El ${s.nameCa} és un ${s.colourCa}.`;

export const modeFromFormula: PuzzleGenerator = {
  id: 'mode-from-formula',
  skill: 'modes',
  requiresAudio: false,
  base: 900,
  bookConcepts: ['major-scale-modes-harmonized', 'chord-scales-major-melodic'],
  concepts: MAJOR_MODES.map(modeKey),
  make(rng, level, concept) {
    const s = fromKey(concept, MAJOR_MODES, rng);
    const byFormula = level > 0 || s.id === 'ionian' || s.id === 'aeolian';
    const d = s.characteristic;
    return {
      difficulty: this.base + 60 * level + (byFormula ? 40 : 0),
      conceptKey: modeKey(s),
      bookConcept: 'chord-scales-major-melodic',
      prompt: byFormula
        ? `Quin mode té aquesta fórmula?\n${s.formula.join('  ')}`
        : `Quin mode és un ${s.colourCa.replace(/ \(.*\)/, '')}?`,
      answer: choice(rng, s, siblings(s, MAJOR_MODES), (x) => x.nameCa, optionCount(level)),
      hint: `Mira la ${isMinorScale(s) ? '2a, la 5a i la 6a' : '4a i la 7a'}: és on els modes ${isMinorScale(s) ? 'menors' : 'majors'} es diferencien.`,
      explanation: `${colourLine(s)} La seva nota característica és la ${degreeCa(d)} (${d}).`,
      terms: ['mode', 'nota característica'],
      listen: { type: 'scale', midi: scaleMidi({ letter: 0, alt: 0 }, s) },
      truth: { kind: 'scale-by-formula', formula: s.formula },
    };
  },
};

export const characteristicNoteChoice: PuzzleGenerator = {
  id: 'characteristic-note',
  skill: 'modes',
  requiresAudio: false,
  base: 960,
  bookConcepts: ['modal-harmony-theory'],
  concepts: NOT_IONIAN.map(modeKey),
  make(rng, level, concept) {
    const s = fromKey(concept, NOT_IONIAN, rng);
    const tonic = pickTonic(rng, s, level);
    const notes = scaleNotes(tonic, s);
    const target = characteristicNote(tonic, s);
    return {
      difficulty: this.base + 60 * level + keyCost(tonic, s),
      conceptKey: modeKey(s),
      bookConcept: 'modal-harmony-theory',
      prompt: `Quina és la nota característica de ${scaleName(tonic, s)}?`,
      answer: choice(rng, target, notes.filter((n) => !sameNote(n, target) && !sameNote(n, tonic)), noteCa, optionCount(level)),
      hint: colourLine(s),
      explanation: `${colourLine(s)} A ${noteCa(tonic)}, la ${degreeCa(s.characteristic)} és ${noteCaWords(target)}.\n${scaleName(tonic, s)}: ${notesCa(notes)}.`,
      terms: ['mode', 'nota característica'],
      listen: { type: 'scale', midi: scaleMidi(tonic, s) },
      truth: { kind: 'char-note', tonic: noteName(tonic), scaleId: s.id },
    };
  },
};

function modeFromNotesMake(pool: ScaleDef[], gen: PuzzleGenerator, rng: Rng, level: number, concept?: string) {
  const s = fromKey(concept, pool, rng);
  const tonic = pickTonic(rng, s, level);
  const notes = scaleNotes(tonic, s);
  const distractPool = s.family === 'major' ? MAJOR_MODES : [...pool, ...MAJOR_MODES];
  return {
    difficulty: gen.base + 60 * level + keyCost(tonic, s),
    conceptKey: modeKey(s),
    bookConcept: bookFor(s),
    prompt: `Amb centre a ${noteCa(tonic)}, quina escala formen aquestes notes?`,
    visual: { type: 'notes' as const, notes: notes.map(noteCa) },
    answer: choice(rng, s, siblings(s, distractPool), (x) => `${noteCa(tonic)} ${x.nameCa}`, optionCount(level)),
    hint: `Compara-la amb ${noteCa(tonic)} ${isMinorScale(s) ? 'menor natural' : 'major'} i busca la nota que canvia.`,
    explanation: `${colourLine(s)} Fórmula: ${s.formula.join(' ')}. Aquí la ${degreeCa(s.characteristic)} és ${noteCaWords(characteristicNote(tonic, s))}.`,
    terms: s.family === 'major' ? ['mode', 'centre tonal'] : ['mode', 'centre tonal', s.family === 'harmonic-minor' ? 'menor harmònica' : 'menor melòdica'],
    listen: { type: 'scale' as const, midi: scaleMidi(tonic, s) },
    truth: { kind: 'scale-by-notes', tonic: noteName(tonic), pcs: notes.map(pc) },
  };
}

export const modeFromNotes: PuzzleGenerator = {
  id: 'mode-from-notes',
  skill: 'modes',
  requiresAudio: false,
  base: 1000,
  bookConcepts: ['modal-harmony-theory', 'modes-major-scale'],
  concepts: MAJOR_MODES.map(modeKey),
  make(rng, level, concept) {
    return modeFromNotesMake(MAJOR_MODES, this, rng, level, concept);
  },
};

export const exoticScaleFromNotes: PuzzleGenerator = {
  id: 'exotic-scale-from-notes',
  skill: 'modes',
  requiresAudio: false,
  base: 1120,
  bookConcepts: ['modes-melodic-minor', 'modes-harmonic-minor'],
  concepts: EXOTIC.map(modeKey),
  make(rng, level, concept) {
    return modeFromNotesMake(EXOTIC, this, rng, level, concept);
  },
};

export const parentScale: PuzzleGenerator = {
  id: 'parent-scale',
  skill: 'modes',
  requiresAudio: false,
  base: 1020,
  bookConcepts: ['chord-scales-major-melodic', 'chord-scales-harmonic-misc'],
  concepts: SCALES.filter((s) => s.modeIndex > 0).map(modeKey),
  make(rng, level, concept) {
    const pool = SCALES.filter((s) => s.modeIndex > 0 && (level > 0 || s.family === 'major'));
    const s = fromKey(concept, pool.length ? pool : SCALES.filter((x) => x.modeIndex > 0), rng);
    const parent = SCALES.find((x) => x.family === s.family && x.modeIndex === 0)!;
    const parentLabel = s.family === 'major' ? 'major' : parent.nameCa;
    const tonic = pickTonic(rng, s, level);
    const pt = parentTonic(tonic, s);
    const notes = scaleNotes(tonic, s);
    return {
      difficulty: this.base + 60 * level + keyCost(tonic, s) + (s.family === 'major' ? 0 : 80),
      conceptKey: modeKey(s),
      bookConcept: s.family === 'major' ? 'chord-scales-major-melodic' : s.family === 'melodic-minor' ? 'chord-scales-major-melodic' : 'chord-scales-harmonic-misc',
      prompt: `${scaleName(tonic, s)} té les mateixes notes que quina escala ${parentLabel}?`,
      answer: choice(rng, pt, notes.filter((n) => !sameNote(n, pt)), (n) => `${noteCa(n)} ${parentLabel}`, optionCount(level)),
      hint: `El ${s.nameCa} és el ${ORDINALS[s.modeIndex]} mode de l'escala ${parentLabel}.`,
      explanation: `El ${s.nameCa} és el ${ORDINALS[s.modeIndex]} mode de l'escala ${parentLabel}: ${noteCa(tonic)} és el ${ORDINALS[s.modeIndex]} grau de ${noteCa(pt)} ${parentLabel}.\nNotes: ${notesCa(notes)}.`,
      terms: ['mode', 'escala mare'],
      listen: { type: 'scale', midi: scaleMidi(tonic, s) },
      truth: { kind: 'parent', tonic: noteName(tonic), scaleId: s.id },
    };
  },
};

export const tapCharacteristic: PuzzleGenerator = {
  id: 'tap-characteristic',
  skill: 'modes',
  requiresAudio: false,
  base: 1060,
  bookConcepts: ['modal-shapes', 'close-position-major'],
  concepts: NOT_IONIAN.map(modeKey),
  make(rng, level, concept) {
    const s = fromKey(concept, NOT_IONIAN, rng);
    const tonic = pickTonic(rng, s, level);
    const target = characteristicNote(tonic, s);
    // Five-fret window that starts one fret below the root on the 6th string.
    let rootFret = mod(pc(tonic) - TUNING[0], 12);
    if (rootFret === 0) rootFret = 12;
    const firstFret = rootFret - 1 + (rootFret === 1 ? 1 : 0);
    const frets = 5;
    const roots: FretPos[] = [];
    const accept: FretPos[] = [];
    for (let st = 0; st < 6; st++) for (let f = firstFret; f < firstFret + frets; f++) {
      if (fretPc(st, f) === pc(tonic)) roots.push({ string: st, fret: f });
      if (fretPc(st, f) === pc(target)) accept.push({ string: st, fret: f });
    }
    return {
      difficulty: this.base + 60 * level + keyCost(tonic, s),
      conceptKey: modeKey(s),
      bookConcept: 'modal-shapes',
      prompt: `Toca la nota característica de ${scaleName(tonic, s)}.\nLes tòniques (${noteCa(tonic)}) estan marcades.`,
      visual: { type: 'fretboard', firstFret, frets, dots: roots.map((r) => ({ ...r, root: true, label: noteCa(tonic) })) },
      answer: { type: 'tap', accept },
      hint: `${colourLine(s)} Busca la ${degreeCa(s.characteristic)} comptant des de la tònica.`,
      explanation: `${colourLine(s)} A ${noteCa(tonic)}, la ${degreeCa(s.characteristic)} és ${noteCaWords(target)}.`,
      terms: ['mode', 'nota característica'],
      listen: { type: 'scale', midi: scaleMidi(tonic, s) },
      truth: { kind: 'tap-pc', pc: pc(target), firstFret, frets },
    };
  },
};

const pairCa = (c: DiatonicChord) => `${c.roman} = ${chordSymbol(c)}`;

export const romanToChord: PuzzleGenerator = {
  id: 'roman-to-chord',
  skill: 'modes',
  requiresAudio: false,
  base: 1040,
  bookConcepts: ['major-scale-modes-harmonized', 'natural-minor-harmonized'],
  concepts: MAJOR_MODES.map(modeKey),
  make(rng, level, concept) {
    const s = fromKey(concept, MAJOR_MODES, rng);
    const tonic = pickTonic(rng, s, level);
    const sevenths = level >= 2 && rng.next() < 0.5;
    const chords = diatonicChords(tonic, s, sevenths);
    const target = chords[1 + rng.int(6)];
    // Near misses: same root with the wrong quality, the neighbours, and the same degree in the parallel major/minor.
    const flip: Record<string, string> = { maj: 'm', m: 'maj', dim: 'm', maj7: '7', '7': 'maj7', m7: '7', m7b5: 'm7' };
    const wrongQuality: Chord = { root: target.root, def: getChord(flip[target.def.id] ?? 'maj') };
    const parallel = diatonicChords(tonic, getScale(isMinorScale(s) ? 'ionian' : 'aeolian'), sevenths)[target.degree];
    const distractors: Chord[] = [wrongQuality, parallel, ...chords.filter((c) => c.degree !== target.degree && c.degree !== 0)];
    return {
      difficulty: this.base + 60 * level + keyCost(tonic, s),
      conceptKey: modeKey(s),
      bookConcept: isMinorScale(s) ? 'natural-minor-harmonized' : 'major-scale-modes-harmonized',
      prompt: `A ${scaleName(tonic, s)}, quin acord és ${target.roman}?`,
      answer: choice<Chord>(rng, target, distractors, chordSymbol, optionCount(level)),
      hint: `${scaleName(tonic, s)}: ${notesCa(scaleNotes(tonic, s))}. Apila terceres sobre el ${ORDINALS[target.degree]} grau.`,
      explanation: `${pairCa(target)}. Sobre el ${ORDINALS[target.degree]} grau de ${scaleName(tonic, s)} (${noteCa(target.root)}) surten les notes ${notesCa(spellChord(target))}: un acord ${target.def.nameCa}.\nTots els acords: ${chords.map(pairCa).join(', ')}.`,
      terms: ['mode', 'xifra romana'],
      listen: { type: 'progression', chords: [chordMidi(chords[0]), chordMidi(target), chordMidi(chords[0])] },
      chordHelp: chordHelp([target, chords[0]]),
      truth: { kind: 'roman-to-chord', tonic: noteName(tonic), scaleId: s.id, roman: target.roman, sevenths },
    };
  },
};

/** Build a progression that fits exactly one major mode on the given tonic. */
export function uniqueModalProgression(rng: Rng, tonic: Note, s: ScaleDef): DiatonicChord[] | null {
  const chords = diatonicChords(tonic, s);
  for (let tries = 0; tries < 40; tries++) {
    const len = 2 + rng.int(3);
    const others = rng.shuffle(chords.slice(1).filter((c) => c.def.id !== 'dim')).slice(0, len - 1);
    const prog = [chords[0], ...others];
    const fits = MAJOR_MODES.filter((m) => prog.every((c) => chordFitsScale(c, tonic, m)));
    if (fits.length === 1 && fits[0].id === s.id) return prog;
  }
  return null;
}

export const modeFromProgression: PuzzleGenerator = {
  id: 'mode-from-progression',
  skill: 'modes',
  requiresAudio: false,
  base: 1100,
  bookConcepts: ['modal-harmony-theory', 'modal-resolution-tendencies'],
  concepts: MAJOR_MODES.filter((s) => s.id !== 'locrian').map(modeKey),
  make(rng, level, concept) {
    const pool = MAJOR_MODES.filter((s) => s.id !== 'locrian');
    let s = fromKey(concept, pool, rng);
    let tonic = pickTonic(rng, s, level);
    let prog = uniqueModalProgression(rng, tonic, s);
    while (!prog) {
      if (!concept) s = rng.pick(pool);
      tonic = pickTonic(rng, s, level);
      prog = uniqueModalProgression(rng, tonic, s);
    }
    const target = characteristicNote(tonic, s);
    const carrier = prog.find((c) => c.degree !== 0 && spellChord(c).some((n) => pc(n) === pc(target))) ?? prog[1];
    return {
      difficulty: this.base + 60 * level + keyCost(tonic, s),
      conceptKey: modeKey(s),
      bookConcept: 'modal-harmony-theory',
      prompt: `El centre tonal és ${noteCa(tonic)}. Quin mode suggereix aquesta progressió?`,
      visual: { type: 'progression', chords: prog.map(chordSymbol) },
      answer: choice(rng, s, siblings(s, MAJOR_MODES), (x) => `${noteCa(tonic)} ${x.nameCa}`, optionCount(level)),
      hint: `L'acord de tònica és ${isMinorScale(s) ? 'menor' : 'major'}. Mira quines notes porten els altres acords.`,
      explanation: `${prog.map(pairCa).join(', ')}.\n${colourLine(s)} L'acord ${chordSymbol(carrier)} (${notesCa(spellChord(carrier))}) ${spellChord(carrier).some((n) => pc(n) === pc(target)) ? `conté ${noteCaWords(target)}, la ${degreeCa(s.characteristic)}` : 'només encaixa en aquest mode'}.`,
      terms: ['mode', 'centre tonal', 'xifra romana'],
      listen: { type: 'progression', chords: [...prog, prog[0]].map(chordMidi) },
      chordHelp: chordHelp(prog),
      truth: { kind: 'mode-by-progression', tonic: noteName(tonic), chords: prog.map(chordId) },
    };
  },
};

export const modeByEar: PuzzleGenerator = {
  id: 'mode-by-ear',
  skill: 'modes',
  requiresAudio: true,
  base: 1150,
  bookConcepts: ['mode-practice'],
  concepts: MAJOR_MODES.map(modeKey),
  make(rng, level, concept) {
    const s = fromKey(concept, MAJOR_MODES, rng);
    const tonic = pickTonic(rng, s, 0);
    return {
      difficulty: this.base + 60 * level,
      conceptKey: modeKey(s),
      bookConcept: 'mode-practice',
      prompt: 'Escolta l\'escala. Quin mode és?',
      visual: { type: 'listen' },
      answer: choice(rng, s, siblings(s, MAJOR_MODES), (x) => x.nameCa, optionCount(level)),
      hint: `Primer decideix si és ${isMinorScale(s) ? 'menor' : 'major'} (la 3a), després busca la nota estranya.`,
      explanation: `Era ${scaleName(tonic, s)}: ${notesCa(scaleNotes(tonic, s))}. ${colourLine(s)}`,
      terms: ['mode'],
      listen: { type: 'scale', midi: scaleMidi(tonic, s) },
      truth: { kind: 'scale-by-notes', tonic: noteName(tonic), pcs: scaleNotes(tonic, s).map(pc), nameOnly: true },
    };
  },
};

export const MODE_GENERATORS = [
  modeFromFormula, characteristicNoteChoice, modeFromNotes, parentScale, tapCharacteristic,
  romanToChord, modeFromProgression, exoticScaleFromNotes, modeByEar,
];

// Re-exported for the audit, which re-solves puzzles without going through the generators.
export { transpose, parseDegree };
