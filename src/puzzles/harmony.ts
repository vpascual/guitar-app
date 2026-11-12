// Generators for the "harmony" skill: Roman numeral analysis, modal interchange, secondary dominants.
import type { PuzzleGenerator } from './types';
import { noteCa, noteName, parseDegree, transpose, pc } from '../theory/note';
import { MAJOR_MODES, getScale, scaleNotes } from '../theory/scale';
import { Chord, DiatonicChord, diatonicChords, chordSymbol, chordFitsScale, chordId, getChord, spellChord } from '../theory/chord';
import { pickTonic, keyCost, choice, optionCount, notesCa, chordMidi, chordHelp } from './util';

const pairCa = (c: DiatonicChord) => `${c.roman} = ${chordSymbol(c)}`;

export const romanAnalysis: PuzzleGenerator = {
  id: 'roman-analysis',
  skill: 'harmony',
  requiresAudio: false,
  base: 1020,
  bookConcepts: ['roman-numeral-analysis', 'scale-degrees-progressions'],
  concepts: MAJOR_MODES.filter((s) => s.id !== 'locrian').map((s) => `roman:${s.id}`),
  make(rng, level, concept) {
    const pool = MAJOR_MODES.filter((s) => s.id !== 'locrian' && (level > 0 || ['ionian', 'aeolian', 'dorian', 'mixolydian'].includes(s.id)));
    const s = pool.find((x) => `roman:${x.id}` === concept) ?? rng.pick(pool);
    const tonic = pickTonic(rng, s, level);
    const sevenths = level >= 2;
    const chords = diatonicChords(tonic, s, sevenths);
    const idx = [0, ...rng.shuffle([1, 2, 3, 4, 5, 6]).slice(0, 2 + rng.int(2))];
    const prog = idx.map((i) => chords[i]);
    const correct = prog.map((c) => c.roman);
    // Wrong readings: the same degrees numbered as if the piece were in another mode.
    const wrong = MAJOR_MODES.filter((m) => m.id !== s.id)
      .map((m) => idx.map((i) => diatonicChords(tonic, m, sevenths)[i].roman));
    return {
      difficulty: this.base + 70 * level + keyCost(tonic, s),
      conceptKey: `roman:${s.id}`,
      bookConcept: 'roman-numeral-analysis',
      prompt: `Amb centre a ${noteCa(tonic)}, quines xifres romanes corresponen a aquesta progressió?`,
      visual: { type: 'progression', chords: prog.map(chordSymbol) },
      answer: choice<string[]>(rng, correct, wrong, (r) => r.join(' – '), optionCount(level)),
      hint: `Compta cada fonamental des de ${noteCa(tonic)} i compara-la amb l'escala de ${noteCa(tonic)} major: si és un semitò més baixa, porta b.`,
      explanation: `${prog.map(pairCa).join(', ')}.\nTot surt de ${noteCa(tonic)} ${s.nameCa}: ${notesCa(scaleNotes(tonic, s))}.`,
      terms: ['xifra romana', 'centre tonal'],
      listen: { type: 'progression', chords: [...prog, prog[0]].map(chordMidi) },
      chordHelp: chordHelp(prog),
      truth: { kind: 'roman-seq', tonic: noteName(tonic), chords: prog.map(chordId) },
    };
  },
};

const DONORS = ['aeolian', 'dorian', 'phrygian', 'mixolydian', 'lydian'].map(getScale);

export const borrowedChord: PuzzleGenerator = {
  id: 'borrowed-chord',
  skill: 'harmony',
  requiresAudio: false,
  base: 1120,
  bookConcepts: ['modal-mixture-songwriters', 'modal-mixture-linear'],
  concepts: DONORS.map((s) => `borrow:${s.id}`),
  make(rng, level, concept) {
    const ionian = getScale('ionian');
    for (;;) {
      const donor = DONORS.find((s) => `borrow:${s.id}` === concept) ?? rng.pick(DONORS);
      const tonic = pickTonic(rng, ionian, level);
      const home = diatonicChords(tonic, ionian);
      const candidates = diatonicChords(tonic, donor).filter((c) => c.degree !== 0 && c.def.id !== 'dim' && !chordFitsScale(c, tonic, ionian));
      if (!candidates.length) continue;
      const borrowed = rng.pick(candidates);
      // Only offer modes that cannot also supply this chord.
      const others = DONORS.filter((m) => m.id !== donor.id && !chordFitsScale(borrowed, tonic, m));
      if (others.length < 2) continue;
      const foreign = spellChord(borrowed).filter((n) => !scaleNotes(tonic, ionian).some((x) => pc(x) === pc(n)));
      return {
        difficulty: this.base + 70 * level + keyCost(tonic, ionian),
        conceptKey: `borrow:${donor.id}`,
        bookConcept: 'modal-mixture-songwriters',
        prompt: `Una cançó en ${noteCa(tonic)} major fa servir ${borrowed.roman} = ${chordSymbol(borrowed)}. De quin mode paral·lel ve l'acord?`,
        visual: { type: 'progression', chords: [chordSymbol(home[0]), chordSymbol(borrowed), chordSymbol(home[0])] },
        answer: choice(rng, donor, others, (m) => `${noteCa(tonic)} ${m.nameCa}`, optionCount(level)),
        hint: `Notes de ${chordSymbol(borrowed)}: ${notesCa(spellChord(borrowed))}. Quines no són a ${noteCa(tonic)} major?`,
        explanation: `${chordSymbol(borrowed)} conté ${notesCa(foreign)}, que no ${foreign.length > 1 ? 'són' : 'és'} a ${noteCa(tonic)} major. A ${noteCa(tonic)} ${donor.nameCa} (${notesCa(scaleNotes(tonic, donor))}) l'acord surt sol: ${borrowed.roman} = ${chordSymbol(borrowed)}.`,
        terms: ['intercanvi modal', 'xifra romana', 'mode'],
        listen: { type: 'progression', chords: [home[0], borrowed, home[0]].map(chordMidi) },
        chordHelp: chordHelp([borrowed, home[0]]),
        truth: { kind: 'mode-by-progression', tonic: noteName(tonic), chords: [chordId(borrowed)], pool: DONORS.map((d) => d.id) },
      };
    }
  },
};

export const secondaryDominant: PuzzleGenerator = {
  id: 'secondary-dominant',
  skill: 'harmony',
  requiresAudio: false,
  base: 1060,
  bookConcepts: ['secondary-dominants'],
  concepts: [1, 2, 3, 4, 5].map((d) => `secdom:${d}`),
  make(rng, level, concept) {
    const ionian = getScale('ionian');
    const tonic = pickTonic(rng, ionian, level);
    const chords = diatonicChords(tonic, ionian);
    const degree = concept?.startsWith('secdom:') ? Number(concept.slice(7)) : rng.pick([1, 2, 3, 4, 5]);
    const target = chords[degree];
    const dom: Chord = { root: transpose(target.root, parseDegree('5')), def: getChord('7') };
    const wrong: Chord[] = [
      { root: dom.root, def: getChord('m7') },
      { root: dom.root, def: getChord('maj7') },
      { root: transpose(target.root, parseDegree('4')), def: getChord('7') },
      { root: target.root, def: getChord('7') },
      { root: transpose(target.root, parseDegree('2')), def: getChord('7') },
    ];
    return {
      difficulty: this.base + 70 * level + keyCost(tonic, ionian),
      conceptKey: `secdom:${degree}`,
      bookConcept: 'secondary-dominants',
      prompt: `A ${noteCa(tonic)} major, quin acord és V7/${target.roman} (el dominant de ${target.roman} = ${chordSymbol(target)})?`,
      answer: choice<Chord>(rng, dom, wrong, chordSymbol, optionCount(level)),
      hint: `Puja una 5a justa des de ${noteCa(target.root)} i fes-hi un acord de 7a de dominant.`,
      explanation: `V7/${target.roman} = ${chordSymbol(dom)} (${notesCa(spellChord(dom))}). Una 5a justa per damunt de ${noteCa(target.root)} hi ha ${noteCa(dom.root)}; amb 3a major i 7a menor empeny cap a ${chordSymbol(target)}.`,
      terms: ['xifra romana'],
      listen: { type: 'progression', chords: [chords[0], dom, target].map(chordMidi) },
      chordHelp: chordHelp([dom, target]),
      truth: { kind: 'secondary-dominant', target: chordId(target) },
    };
  },
};

export const HARMONY_GENERATORS = [romanAnalysis, borrowedChord, secondaryDominant];
