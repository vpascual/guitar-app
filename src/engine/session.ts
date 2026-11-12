// Practice session builder and BPM progression. Pure functions; storage and UI live elsewhere.
import { Note, parseNote, noteCa, noteCaWords, pc, mod, intervalBetween, degreeName } from '../theory/note';
import { ScaleDef, MAJOR_MODES, getScale, scaleNotes, characteristicNote, parentTonic, isMinorScale } from '../theory/scale';
import { Chord, DiatonicChord, diatonicChords, chordSymbol, spellChord, getChord, romanNumeral } from '../theory/chord';
import { FretPos, scalePosition, TAB_LABELS, fretMidi } from '../theory/guitar';
import { Meter, METERS, meterLabel, accentPattern, counting } from '../theory/meter';
import { PROGRESSIONS, ProgressionDef, CHORD_FOCI, ChordFocusDef, METER_SONGS, SongExample } from '../content/progressions';
import { spreadTriad } from '../puzzles/chords';
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
  /** Eighth-note grouping to draw, for meter-focused blocks. */
  rhythm?: number[];
  /** Empty when the book does not cover the topic (odd meters). */
  bookConcepts: string[];
  result?: BlockResult;
}

export interface Session {
  id: string;
  createdAt: number;
  minutes: 30 | 45 | 60;
  focus: { type: 'mode' | 'chord-type' | 'meter'; id: string; tonic: string; label: string };
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
export function renderTab(notes: FretPos[], perBar = 8, picking = true, accents?: number[]): string[] {
  const lines: string[] = [];
  for (let i = 0; i < notes.length; i += perBar) {
    const bar = notes.slice(i, i + perBar);
    // In odd meters the marks show the accents (>) instead of the pick direction.
    const mark = (j: number) => (accents ? (accents[j % accents.length] > 0 ? '>' : ' ') : (i + j) % 2 === 0 ? '↓' : '↑');
    if (picking) lines.push('   ' + bar.map((_, j) => mark(j).padEnd(3, ' ')).join('').trimEnd());
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
  /** Wrong and total puzzle attempts per concept key (e.g. "mode:dorian", "chord:m7b5", "meter:7/8"). */
  conceptStats: Record<string, { wrong: number; total: number }>;
  /** Earlier sessions, oldest first. */
  history: { focusId: string; progressionId: string }[];
  materials: Record<string, MaterialState>;
  now: number;
  rand: () => number;
}

export interface Focus {
  type: 'mode' | 'chord-type' | 'meter';
  id: string;
  /** Concept keys of the puzzles that train this focus. */
  conceptKeys: string[];
  /** Weak-area priority from the brief: lower comes first when everything else is equal. */
  priority: number;
}

const FOCUS_METERS = ['3/4', '6/8', '5/4:3+2', '7/8:2+2+3'].map((id) => METERS.find((m) => m.id.startsWith(id))!);

export const FOCI: Focus[] = [
  ...MAJOR_MODES.filter((s) => s.id !== 'ionian')
    .map((s): Focus => ({ type: 'mode', id: s.id, conceptKeys: [`mode:${s.id}`, `roman:${s.id}`], priority: 0 })),
  ...CHORD_FOCI.map((c): Focus => ({ type: 'chord-type', id: c.id, conceptKeys: c.conceptKeys, priority: c.id === 'spread' ? 1 : 2 })),
  ...FOCUS_METERS.map((m): Focus => ({ type: 'meter', id: `meter-${meterLabel(m)}`, conceptKeys: [`meter:${meterLabel(m)}`], priority: 4 })),
];

/** Pick what to work on: weak in puzzles, failed in practice, high in the weak-area order, and not just practised. */
export function chooseFocus(ctx: BuildContext): Focus {
  const recent = ctx.history.slice(-3).map((h) => h.focusId).reverse();
  let best = FOCI[0];
  let bestScore = -Infinity;
  for (const f of FOCI) {
    const st = f.conceptKeys.map((k) => ctx.conceptStats[k]).filter(Boolean)
      .reduce((a, b) => ({ wrong: a.wrong + b.wrong, total: a.total + b.total }), { wrong: 0, total: 0 });
    const failRate = (st.wrong + 1) / (st.total + 2);
    const failedMaterial = Object.entries(ctx.materials).some(([id, m]) => id.includes(`:${f.id}:`) && m.last === 'failed');
    const recency = [0.7, 0.4, 0.2][recent.indexOf(f.id)] ?? 0;
    const never = ctx.history.some((h) => h.focusId === f.id) ? 0 : 0.1;
    const score = failRate + (failedMaterial ? 0.3 : 0) + never - recency - f.priority * 0.03 + ctx.rand() * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}

/** A progression that no earlier session used; once all are used, the one used longest ago. */
export function chooseProgression(scaleIds: string[], history: { progressionId: string }[]): ProgressionDef {
  const options = PROGRESSIONS.filter((p) => scaleIds.includes(p.scaleId));
  const used = history.map((h) => h.progressionId);
  const fresh = options.filter((p) => !used.includes(p.id));
  if (fresh.length) return fresh[0];
  return [...options].sort((a, b) => used.lastIndexOf(a.id) - used.lastIndexOf(b.id))[0];
}

/** A chord with its Roman numeral relative to a tonic. */
export interface RomanChord extends Chord {
  roman: string;
}

export function progressionChords(p: ProgressionDef): DiatonicChord[] {
  const all = diatonicChords(parseNote(p.tonic), getScale(p.scaleId), p.sevenths ?? false);
  return p.degrees.map((d) => all[d]);
}

export function chordFocusChords(c: ChordFocusDef, list = c.chords): RomanChord[] {
  const tonic = parseNote(c.tonic);
  return list.map(([r, id]) => {
    const root = parseNote(r);
    return { root, def: getChord(id), roman: romanNumeral(degreeName(intervalBetween(tonic, root)), id) };
  });
}

const pair = (c: RomanChord) => `${c.roman} = ${chordSymbol(c)}`;

/** Per chord: tones to land on, where the scale's colour note sits, and the note not to rest on. */
export function chordToneRows(chords: RomanChord[], tonic: Note, scale: ScaleDef): ChordToneRow[] {
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

const songLines = (songs: SongExample[]): string =>
  songs.length
    ? songs.map((s) => `«${s.title}» (${s.artist})${s.note ? `: ${s.note}` : ''}${s.confidence === 'discutida' ? ' — anàlisi discutida' : ''}`).join('; ')
    : 'cap exemple prou segur per citar-lo';

// ---- Session builder ----

type Extra = Pick<PracticeBlock, 'detail' | 'tabs' | 'diagrams' | 'chordTones' | 'listen' | 'bookConcepts' | 'rhythm'>;

export function buildSession(minutes: 30 | 45 | 60, ctx: BuildContext, forced?: Focus): Session {
  const focus = forced ?? chooseFocus(ctx);
  const mins = BLOCK_MINUTES[minutes];

  // Every focus resolves to the same ingredients: a scale, a key, a progression and a meter.
  const chordFocus = CHORD_FOCI.find((c) => c.id === focus.id);
  const meter: Meter = focus.type === 'meter' ? FOCUS_METERS.find((m) => `meter-${meterLabel(m)}` === focus.id)! : METERS[0];
  const prog = chordFocus ? undefined
    : chooseProgression(focus.type === 'mode' ? [focus.id] : ['aeolian', 'dorian', 'phrygian'], ctx.history);
  const scale = getScale(chordFocus?.scaleId ?? prog!.scaleId);
  const tonic = parseNote(chordFocus?.tonic ?? prog!.tonic);
  const chords: RomanChord[] = chordFocus ? chordFocusChords(chordFocus) : progressionChords(prog!);
  const progressionId = chordFocus ? `chord-focus:${chordFocus.id}` : prog!.id;
  const why = chordFocus?.whyCa ?? prog!.whyCa;
  const songs = chordFocus?.songs ?? prog!.songs;
  const progBook = chordFocus?.bookConcepts ?? [prog!.bookConcept, isMinorScale(scale) ? 'natural-minor-harmonized' : 'major-scale-modes-harmonized'];

  const notes = scaleNotes(tonic, scale);
  const char = characteristicNote(tonic, scale);
  const scaleLabel = `${noteCa(tonic)} ${scale.nameCa}`;
  const parentName = scale.family === 'major' ? 'major' : scale.family === 'harmonic-minor' ? 'menor harmònica' : 'menor melòdica';
  const parent = `${noteCa(parentTonic(tonic, scale))} ${parentName}`;
  const origin = scale.modeIndex === 0 ? `de ${scaleLabel}` : `de ${scaleLabel}, el ${ORDINALS[scale.modeIndex]} mode de ${parent}`;
  const position = scalePosition(notes);
  const tonicSeventh = diatonicChords(tonic, scale, true)[0];
  const progLine = chords.map(pair).join('  →  ');
  const isOdd = focus.type === 'meter';
  const accents = accentPattern(meter);
  const mLabel = meterLabel(meter);
  const unitName = meter.unit === 8 ? 'corxera' : 'negra';
  const label = focus.type === 'mode' ? scaleLabel
    : focus.type === 'meter' ? `Compàs de ${mLabel}${meter.unit === 8 && meter.groups.length > 1 ? ` (${meter.groups.join('+')})` : ''}`
      : chordFocus!.labelCa;

  const block = (phase: Phase, title: string, goal: string, material: string, rest: Extra): PracticeBlock => {
    const materialId = `${phase}:${focus.id}:${material}`;
    const m = materialFor(ctx.materials, materialId, phase);
    return {
      id: `${phase}-${material}`, phase, title, goal, minutes: mins[phase], materialId,
      accents, meterLabel: isOdd ? `${mLabel}, un clic per ${unitName}` : '4/4',
      // Odd meters click every eighth or quarter, so the same exercise needs a higher number.
      startBpm: isOdd && meter.unit === 8 && !ctx.materials[materialId] ? m.bpm + 60 : m.bpm,
      targetBpm: isOdd && meter.unit === 8 && !ctx.materials[materialId] ? m.target + 60 : m.target,
      ...rest,
    };
  };

  const scaleListen = { label: `Escolta ${scaleLabel}`, what: { type: 'scale', midi: scaleMidi(tonic, scale) } as Listen };
  const progListen = { label: 'Escolta la progressió', what: { type: 'progression', chords: [...chords, chords[0]].map(chordMidi) } as Listen };
  const meterListen = { label: `Escolta el ${mLabel}`, what: { type: 'clicks', accents, bpm: meter.unit === 8 ? 200 : 110 } as Listen };
  const perBar = isOdd ? meter.beats : 8;
  const tabAccents = isOdd ? accents : undefined;
  const meterLines = isOdd ? [
    `Compta en veu alta «${counting(meter)}» i accentua la primera de cada grup.`,
    `Cançons en aquest compàs: ${songLines(METER_SONGS[mLabel] ?? [])}.`,
  ] : [];
  const rhythm = isOdd ? (meter.unit === 8 ? meter.groups : meter.groups.map(() => 2)) : undefined;

  // Technique material depends on the focus.
  let technique: { title: string; goal: string; material: string; extra: Extra };
  if (chordFocus) {
    const study = chordFocusChords(chordFocus, chordFocus.study);
    const tabs: TabData[] = study.map((c) => {
      const spread = chordFocus.spread ? [0, 1, 2].map((inv) => spreadTriad(c, inv, 1) ?? spreadTriad(c, inv, 0)).filter((x): x is FretPos[] => !!x) : [];
      return chordFocus.spread
        ? {
          title: `${chordSymbol(c)} obert: fonamental, 1a i 2a inversió`,
          lines: renderTab(spread.flatMap((v) => [...v, v[1]]), 4, false),
          tip: 'Pua a la nota greu i dits (mig i anular) a les altres dues, o salta la corda amb la pua. Deixa sonar les tres notes.',
        }
        : {
          title: `Arpegi de ${chordSymbol(c)} (${spellChord(c).map(noteCa).join(' ')})`,
          lines: renderTab(upAndDown(scalePosition(spellChord(c)))),
          tip: `Digues el grau de cada nota mentre toques: ${c.def.formula.join(', ')}.`,
        };
    });
    technique = {
      title: chordFocus.spread ? 'Tècnica: tríades obertes' : 'Tècnica: arpegis dels acords',
      goal: chordFocus.spread
        ? `Tocar ${study.map(chordSymbol).join(', ')} com a tríades obertes en les tres inversions, a negres.`
        : `Tocar els arpegis de ${study.map(chordSymbol).join(', ')} a corxeres, sabent quin grau és cada nota.`,
      material: 'arpeggios',
      extra: {
        detail: [
          ...study.map((c) => `${chordSymbol(c)}: ${c.def.nameCa}. Fórmula ${c.def.formula.join(' ')} = ${spellChord(c).map(noteCa).join(' ')}.`),
          'Puja el tempo només quan dues passades seguides surtin netes.',
        ],
        tabs, diagrams: chordFocus.spread ? [] : chordHelp(study), chordTones: [], listen: study.map((c) => ({
          label: `Escolta ${chordSymbol(c)}`, what: { type: 'chord', midi: chordMidi(c) } as Listen,
        })),
        bookConcepts: chordFocus.bookConcepts,
      },
    };
  } else if (isOdd) {
    technique = {
      title: `Tècnica: l'escala en ${mLabel}`,
      goal: `Tocar ${scaleLabel} en grups de ${meter.groups.join('+')}, una nota per clic, accentuant la primera de cada grup.`,
      material: 'scale',
      extra: {
        detail: [
          ...meterLines,
          'Els accents (>) no coincideixen amb els canvis de corda: aquest és l\'exercici.',
        ],
        tabs: [{
          title: `${scaleLabel} en ${mLabel}`,
          lines: renderTab(upAndDown(position), perBar, true, tabAccents),
          tip: 'Pica més fort només a les notes amb >. La resta, a mig volum: l\'accent ha de sentir-se sense el metrònom.',
        }],
        diagrams: [], chordTones: [], listen: [meterListen, scaleListen], rhythm,
        bookConcepts: [],
      },
    };
  } else {
    technique = {
      title: 'Tècnica: terceres i arpegi',
      goal: `Tocar ${scaleLabel} per terceres i l'arpegi de ${chordSymbol(tonicSeventh)}, a corxeres (dues notes per clic).`,
      material: 'thirds',
      extra: {
        detail: [
          `La nota característica és ${noteCaWords(char)} (${degreeCa(scale.characteristic)}): fes-la sonar una mica més fort cada cop que hi passis.`,
          `Arpegi de l'acord de tònica: ${chordSymbol(tonicSeventh)} = ${spellChord(tonicSeventh).map(noteCa).join(' ')}.`,
          'Dues notes per clic. Puja el tempo només quan dues passades seguides surtin netes.',
        ],
        tabs: [
          {
            title: `${scaleLabel} per terceres`,
            lines: renderTab(inThirds(position)),
            tip: 'Mantén la pua alternada estricta encara que canviïs de corda: avall, amunt, sense excepcions.',
          },
          {
            title: `Arpegi de ${chordSymbol(tonicSeventh)}`,
            lines: renderTab(upAndDown(scalePosition(spellChord(tonicSeventh)))),
            tip: 'Deixa anar cada nota abans de la següent perquè soni com una línia i no com un acord.',
          },
        ],
        diagrams: [], chordTones: [], listen: [scaleListen],
        bookConcepts: ['diatonic-arpeggios', 'mode-practice'],
      },
    };
  }

  const strumLine = isOdd
    ? `Rasgueig: un cop per ${unitName}, avall, i més fort a l'inici de cada grup (${meter.groups.join('+')}).`
    : 'Rasgueig: avall als quatre temps; quan surti net, afegeix amunt als contratemps.';

  const blocks: PracticeBlock[] = [
    block('warmup', 'Escalfament',
      isOdd ? `Sentir el ${mLabel}: comptar en veu alta i tocar ${scaleLabel} una nota per clic.`
        : `Tocar ${scaleLabel} en una posició, a negres, amb pua alternada i so net.`, 'position', {
        detail: [
          ...meterLines,
          `${scaleLabel}: ${notes.map(noteCa).join(' ')}. Fórmula: ${scale.formula.join(' ')}.`,
          ...(scale.modeIndex > 0 ? [`És el ${ORDINALS[scale.modeIndex]} mode de ${parent}: les mateixes notes, però el centre és ${noteCa(tonic)}.`] : []),
          'Una nota per clic. Si una nota no sona neta, baixa el tempo abans de continuar.',
        ],
        tabs: [{
          title: `${scaleLabel}, posició del trast ${Math.min(...position.map((p) => p.fret))}`,
          lines: renderTab(upAndDown(position), perBar, true, tabAccents),
          tip: `Comença i acaba sempre a ${noteCa(tonic)} perquè l'orella senti aquest centre i no un altre.`,
        }],
        diagrams: [], chordTones: [], listen: isOdd ? [meterListen, scaleListen] : [scaleListen], rhythm,
        bookConcepts: scale.family === 'major' ? ['modes-major-scale', 'close-position-major'] : ['modes-harmonic-minor', 'close-position-harmonic-minor'],
      }),
    block('technique', technique.title, technique.goal, technique.material, technique.extra),
    block('chords', 'Acords i teoria',
      `Tocar la progressió ${chords.map(chordSymbol).join(' – ')} amb canvis nets, un compàs${isOdd ? ` de ${mLabel}` : ''} per acord.`, progressionId, {
        detail: [
          progLine,
          `D'on surt: ${origin}.`,
          `Per què sona així: ${why}`,
          `Cançons que la fan servir: ${songLines(songs)}.`,
          strumLine,
        ],
        tabs: [],
        diagrams: chordHelp(chords), chordTones: [], listen: isOdd ? [progListen, meterListen] : [progListen], rhythm,
        bookConcepts: progBook,
      }),
    block('integration', 'Integració: improvisa',
      `Improvisar amb ${scaleLabel} sobre la progressió${isOdd ? ` en ${mLabel}` : ''}, caient en notes de l'acord a cada canvi.`, `${progressionId}:solo`, {
        detail: [
          progLine,
          'Fes sonar la progressió amb el botó d\'escoltar o grava-la, i improvisa amb el material del bloc de tècnica.',
          isOdd
            ? 'Regla del bloc: comença cada frase a l\'inici d\'un grup i fes que la nota llarga caigui en un accent.'
            : `Regla del bloc: a cada canvi d'acord, cau en una nota de l'acord. Entre canvis, passa per ${noteCa(char)}.`,
        ],
        tabs: [],
        diagrams: chordHelp(chords),
        chordTones: chordToneRows(chords, tonic, scale),
        listen: [progListen, scaleListen], rhythm,
        bookConcepts: scale.family === 'major' ? ['modes-linear-approach', 'pedal-point-soloing'] : ['practicing-scales-arpeggios', 'modes-harmonic-minor'],
      }),
  ];

  return {
    id: `s${ctx.now}`,
    createdAt: ctx.now,
    minutes,
    focus: { type: focus.type, id: focus.id, tonic: noteCa(tonic), label },
    progressionId,
    blocks,
    status: 'in-progress',
  };
}

/** MIDI of a tab position; lets tests check that generated tabs rise in pitch. */
export const positionMidi = (pos: FretPos[]): number[] => pos.map((p) => fretMidi(p.string, p.fret));
