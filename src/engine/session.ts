// Practice session builder and BPM progression. Pure functions; storage and UI live elsewhere.
import { Note, parseNote, noteCa, noteCaWords, pc, mod } from '../theory/note';
import { ScaleDef, MAJOR_MODES, getScale, scaleNotes, characteristicNote, parentTonic, isMinorScale } from '../theory/scale';
import { DiatonicChord, diatonicChords, chordSymbol, spellChord } from '../theory/chord';
import { FretPos, scalePosition, TAB_LABELS, fretMidi } from '../theory/guitar';
import { PROGRESSIONS, ProgressionDef } from '../content/progressions';
import { degreeCa, ORDINALS } from '../i18n/ca';
import type { ChordHelp, Listen } from '../puzzles/types';
import { chordHelp, chordMidi, scaleMidi } from '../puzzles/util';

export type BlockResult = 'clean' | 'sloppy' | 'failed';
export type Phase = 'warmup' | 'technique' | 'chords' | 'integration';

export interface MaterialState {
  bpm: number;
  target: number;
  cleanStreak: number;
  last?: BlockResult;
}

export interface TabData {
  title: string;
  lines: string[];
  tip: string;
}

export interface ChordToneRow {
  /** "IV = Sol" style pairing. */
  chord: string;
  best: string;
  colour: string;
  avoid: string;
}

export interface PracticeBlock {
  id: string;
  phase: Phase;
  title: string;
  goal: string;
  minutes: number;
  materialId: string;
  /** Accent level per metronome click (2 strong, 1 medium, 0 weak). */
  accents: number[];
  meterLabel: string;
  startBpm: number;
  targetBpm: number;
  detail: string[];
  tabs: TabData[];
  diagrams: ChordHelp[];
  chordTones: ChordToneRow[];
  listen?: { label: string; what: Listen }[];
  bookConcepts: string[];
  result?: BlockResult;
}

export interface Session {
  id: string;
  createdAt: number;
  minutes: 30 | 45 | 60;
  focus: { type: 'mode'; id: string; tonic: string; label: string };
  progressionId: string;
  blocks: PracticeBlock[];
  status: 'in-progress' | 'completed' | 'abandoned';
}

/** Block lengths per duration. Integration shrinks at 30 minutes but never disappears. */
export const BLOCK_MINUTES: Record<30 | 45 | 60, Record<Phase, number>> = {
  30: { warmup: 4, technique: 10, chords: 9, integration: 7 },
  45: { warmup: 6, technique: 14, chords: 13, integration: 12 },
  60: { warmup: 8, technique: 18, chords: 17, integration: 17 },
};

const DEFAULT_BPM: Record<Phase, [number, number]> = {
  warmup: [60, 80], technique: [60, 100], chords: [70, 100], integration: [70, 100],
};

// ---- BPM progression ----

/** Two clean runs in a row raise the tempo; a failed run lowers it. The target moves once it is reached. */
export function applyResult(m: MaterialState, result: BlockResult): MaterialState {
  if (result === 'clean') {
    const streak = m.cleanStreak + 1;
    if (streak < 2) return { ...m, cleanStreak: streak, last: result };
    const bpm = m.bpm + 4;
    return { bpm, target: bpm >= m.target ? m.target + 8 : m.target, cleanStreak: 0, last: result };
  }
  if (result === 'sloppy') return { ...m, cleanStreak: 0, last: result };
  return { ...m, bpm: Math.max(40, m.bpm - 8), cleanStreak: 0, last: result };
}

export const materialFor = (materials: Record<string, MaterialState>, id: string, phase: Phase): MaterialState =>
  materials[id] ?? { bpm: DEFAULT_BPM[phase][0], target: DEFAULT_BPM[phase][1], cleanStreak: 0 };

// ---- Tab rendering ----

/** Monospaced tab, six labeled strings, with alternate-picking marks above. One system per `perBar` notes. */
export function renderTab(notes: FretPos[], perBar = 8, picking = true): string[] {
  const lines: string[] = [];
  for (let i = 0; i < notes.length; i += perBar) {
    const bar = notes.slice(i, i + perBar);
    if (picking) lines.push('   ' + bar.map((_, j) => ((i + j) % 2 === 0 ? '↓' : '↑').padEnd(3, ' ')).join('').trimEnd());
    for (let row = 0; row < 6; row++) {
      const string = 5 - row;
      const cells = bar.map((n) => (n.string === string ? String(n.fret).padEnd(3, '-') : '---')).join('');
      lines.push(`${TAB_LABELS[row]}|-${cells}|`);
    }
    if (i + perBar < notes.length) lines.push('');
  }
  return lines;
}

const upAndDown = <T,>(xs: T[]): T[] => [...xs, ...xs.slice(0, -1).reverse()];

/** Diatonic thirds through a position: 1-3, 2-4, 3-5... */
export function inThirds(pos: FretPos[]): FretPos[] {
  const out: FretPos[] = [];
  for (let i = 0; i + 2 < pos.length; i++) out.push(pos[i], pos[i + 2]);
  return out;
}

// ---- Focus and progression selection ----

export interface BuildContext {
  /** Wrong and total puzzle attempts per mode id. */
  modeStats: Record<string, { wrong: number; total: number }>;
  /** Earlier sessions, oldest first. */
  history: { focusId: string; progressionId: string }[];
  materials: Record<string, MaterialState>;
  now: number;
  rand: () => number;
}

const FOCUS_MODES = MAJOR_MODES.filter((s) => s.id !== 'ionian');

/** Pick the mode to work on: weak in puzzles, failed in practice, and not the one just practised. */
export function chooseFocus(ctx: BuildContext): ScaleDef {
  const recent = ctx.history.slice(-2).map((h) => h.focusId).reverse();
  let best = FOCUS_MODES[0];
  let bestScore = -Infinity;
  for (const s of FOCUS_MODES) {
    const st = ctx.modeStats[s.id] ?? { wrong: 0, total: 0 };
    const failRate = (st.wrong + 1) / (st.total + 2);
    const failedMaterial = Object.entries(ctx.materials).some(([id, m]) => id.includes(`:${s.id}:`) && m.last === 'failed');
    const recency = recent[0] === s.id ? 0.6 : recent[1] === s.id ? 0.3 : 0;
    const score = failRate + (failedMaterial ? 0.3 : 0) - recency + ctx.rand() * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

/** A progression for the focus that no earlier session used; once all are used, the one used longest ago. */
export function chooseProgression(scaleId: string, history: { progressionId: string }[]): ProgressionDef {
  const options = PROGRESSIONS.filter((p) => p.scaleId === scaleId);
  const used = history.map((h) => h.progressionId);
  const fresh = options.filter((p) => !used.includes(p.id));
  if (fresh.length) return fresh[0];
  return [...options].sort((a, b) => used.lastIndexOf(a.id) - used.lastIndexOf(b.id))[0];
}

export function progressionChords(p: ProgressionDef): DiatonicChord[] {
  const all = diatonicChords(parseNote(p.tonic), getScale(p.scaleId), p.sevenths ?? false);
  return p.degrees.map((d) => all[d]);
}

const pair = (c: DiatonicChord) => `${c.roman} = ${chordSymbol(c)}`;

/** Per chord: tones to land on, where the mode's colour note sits, and the note not to rest on. */
export function chordToneRows(chords: DiatonicChord[], tonic: Note, scale: ScaleDef): ChordToneRow[] {
  const notes = scaleNotes(tonic, scale);
  const char = characteristicNote(tonic, scale);
  const seen = new Set<string>();
  return chords.filter((c) => !seen.has(pair(c)) && seen.add(pair(c))).map((c) => {
    const tones = spellChord(c);
    const tonePcs = tones.map(pc);
    const idx = tonePcs.indexOf(pc(char));
    const colour = idx >= 0
      ? `${noteCa(char)} és la ${degreeCa(c.def.formula[idx])} de l'acord: aquí la nota característica sona estable.`
      : `${noteCa(char)} no és a l'acord: fes-la servir de pas o com a tensió curta.`;
    // A scale note a semitone above a chord tone clashes when held.
    const avoid = notes.filter((n) => !tonePcs.includes(pc(n)) && tonePcs.includes(mod(pc(n) - 1, 12)));
    return {
      chord: pair(c),
      best: tones.map(noteCa).join(' '),
      colour,
      avoid: avoid.length ? `No t'hi aturis: ${avoid.map(noteCa).join(', ')} (un semitò per sobre d'una nota de l'acord).` : 'Cap nota de l\'escala xoca: totes es poden sostenir.',
    };
  });
}

// ---- Session builder ----

export function buildSession(minutes: 30 | 45 | 60, ctx: BuildContext): Session {
  const scale = chooseFocus(ctx);
  const prog = chooseProgression(scale.id, ctx.history);
  const tonic = parseNote(prog.tonic);
  const chords = progressionChords(prog);
  const notes = scaleNotes(tonic, scale);
  const char = characteristicNote(tonic, scale);
  const label = `${noteCa(tonic)} ${scale.nameCa}`;
  const parent = `${noteCa(parentTonic(tonic, scale))} major`;
  const position = scalePosition(notes);
  const tonicSeventh = diatonicChords(tonic, scale, true)[0];
  const arpeggio = scalePosition(spellChord(tonicSeventh));
  const mins = BLOCK_MINUTES[minutes];
  const four = [2, 0, 0, 0];
  const progLine = chords.map(pair).join('  →  ');
  const songs = prog.songs.length
    ? prog.songs.map((s) => `«${s.title}» (${s.artist})${s.note ? `: ${s.note}` : ''}${s.confidence === 'discutida' ? ' — anàlisi discutida' : ''}`)
    : ['Cap exemple prou segur per citar-lo.'];

  const block = (
    phase: Phase, title: string, goal: string, material: string,
    rest: Pick<PracticeBlock, 'detail' | 'tabs' | 'diagrams' | 'chordTones' | 'listen' | 'bookConcepts'>,
  ): PracticeBlock => {
    const materialId = `${phase}:${scale.id}:${material}`;
    const m = materialFor(ctx.materials, materialId, phase);
    return {
      id: `${phase}-${material}`, phase, title, goal, minutes: mins[phase], materialId,
      accents: four, meterLabel: '4/4', startBpm: m.bpm, targetBpm: m.target, ...rest,
    };
  };

  const scaleListen = { label: `Escolta ${label}`, what: { type: 'scale', midi: scaleMidi(tonic, scale) } as Listen };
  const progListen = { label: 'Escolta la progressió', what: { type: 'progression', chords: [...chords, chords[0]].map(chordMidi) } as Listen };

  const blocks: PracticeBlock[] = [
    block('warmup', 'Escalfament', `Tocar ${label} en una posició, a negres, amb pua alternada i so net.`, 'position', {
      detail: [
        `${label}: ${notes.map(noteCa).join(' ')}. Fórmula: ${scale.formula.join(' ')}.`,
        `És el ${ORDINALS[scale.modeIndex]} mode de ${parent}: les mateixes notes, però el centre és ${noteCa(tonic)}.`,
        'Una nota per clic. Si una nota no sona neta, baixa el tempo abans de continuar.',
      ],
      tabs: [{
        title: `${label}, posició del trast ${Math.min(...position.map((p) => p.fret))}`,
        lines: renderTab(upAndDown(position)),
        tip: `Comença i acaba sempre a ${noteCa(tonic)} perquè l'orella senti el centre, no el de ${parent}.`,
      }],
      diagrams: [], chordTones: [], listen: [scaleListen],
      bookConcepts: ['modes-major-scale', 'close-position-major'],
    }),
    block('technique', 'Tècnica: terceres i arpegi', `Tocar ${label} per terceres i l'arpegi de ${chordSymbol(tonicSeventh)}, a corxeres (dues notes per clic).`, 'thirds', {
      detail: [
        `La nota característica és ${noteCaWords(char)} (${degreeCa(scale.characteristic)}): fes-la sonar una mica més fort cada cop que hi passis.`,
        `Arpegi de l'acord de tònica: ${chordSymbol(tonicSeventh)} = ${spellChord(tonicSeventh).map(noteCa).join(' ')}.`,
        'Dues notes per clic. Puja el tempo només quan dues passades seguides surtin netes.',
      ],
      tabs: [
        {
          title: `${label} per terceres`,
          lines: renderTab(inThirds(position)),
          tip: 'Mantén la pua alternada estricta encara que canviïs de corda: avall, amunt, sense excepcions.',
        },
        {
          title: `Arpegi de ${chordSymbol(tonicSeventh)}`,
          lines: renderTab(upAndDown(arpeggio)),
          tip: 'Deixa anar cada nota abans de la següent perquè soni com una línia i no com un acord.',
        },
      ],
      diagrams: [], chordTones: [], listen: [scaleListen],
      bookConcepts: ['diatonic-arpeggios', 'mode-practice'],
    }),
    block('chords', 'Acords i teoria', `Tocar la progressió ${chords.map(chordSymbol).join(' – ')} amb canvis nets, un compàs per acord.`, prog.id, {
      detail: [
        progLine,
        `D'on surt: de ${label}, el ${ORDINALS[scale.modeIndex]} mode de ${parent}.`,
        `Per què sona així: ${prog.whyCa}`,
        `Cançons que la fan servir: ${songs.join('; ')}.`,
        'Rasgueig: avall als quatre temps; quan surti net, afegeix amunt als contratemps.',
      ],
      tabs: [],
      diagrams: chordHelp(chords), chordTones: [], listen: [progListen],
      bookConcepts: [prog.bookConcept, isMinorScale(scale) ? 'natural-minor-harmonized' : 'major-scale-modes-harmonized'],
    }),
    block('integration', 'Integració: improvisa', `Improvisar amb ${label} sobre la progressió, caient en notes de l'acord a cada canvi.`, `${prog.id}:solo`, {
      detail: [
        progLine,
        'Grava\'t la progressió o fes-la sonar amb el botó d\'escoltar, i improvisa amb les notes del bloc de tècnica.',
        `Regla del bloc: a cada canvi d'acord, cau en una nota de l'acord. Entre canvis, passa per ${noteCa(char)}.`,
      ],
      tabs: [],
      diagrams: chordHelp(chords),
      chordTones: chordToneRows(chords, tonic, scale),
      listen: [progListen, scaleListen],
      bookConcepts: ['modes-linear-approach', 'pedal-point-soloing'],
    }),
  ];

  return {
    id: `s${ctx.now}`,
    createdAt: ctx.now,
    minutes,
    focus: { type: 'mode', id: scale.id, tonic: prog.tonic, label },
    progressionId: prog.id,
    blocks,
    status: 'in-progress',
  };
}

// Kept for the audit: MIDI of a tab position, used to check that tabs rise in pitch.
export const positionMidi = (pos: FretPos[]): number[] => pos.map((p) => fretMidi(p.string, p.fret));
