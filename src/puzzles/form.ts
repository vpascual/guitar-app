// Generators for the "form" skill: song sections, common forms, counting bars, the 12-bar blues,
// the rhythm-changes bridge and cadences. Everything is drawn on paper: no puzzle needs sound.
import type { PuzzleGenerator, Rng, FormVisualBlock, BarCell } from './types';
import { Note, noteCa, noteName } from '../theory/note';
import { getScale, scaleNotes } from '../theory/scale';
import { Chord, chordSymbol, chordId, getChord, spellChord } from '../theory/chord';
import {
  SECTIONS, SectionDef, SectionId, Trait, TRAIT_CA, sectionsWith, getSection, FORMS, FormDef, FormBlock, getForm,
  formPattern, totalBars, startBars, BLUES, BluesDef, bluesChords, ChartChord, rhythmBridge, CADENCES, cadenceChords,
  RHYTHM_BRIDGE,
} from '../theory/form';
import { ORDINALS } from '../i18n/ca';
import { choice, optionCount, pickTonic, chordMidi, notesCa } from './util';

const pair = (c: ChartChord): string => `${c.roman} = ${chordSymbol(c)}`;
const cap = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);
const and = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} i ${xs[xs.length - 1]}`);

const ARTICLE: Record<SectionId, string> = {
  intro: 'la introducció', verse: 'el vers', prechorus: 'la pre-tornada', chorus: 'la tornada', bridge: 'el pont',
  solo: 'el solo', interlude: 'l\'interludi', outro: 'el final (outro)', tag: 'la coda (tag)',
};
const FEMININE_SECTION: SectionId[] = ['intro', 'prechorus', 'chorus', 'tag'];
const ORD_F = ['primera', 'segona', 'tercera', 'quarta'];
const ORD_M = ['primer', 'segon', 'tercer', 'quart'];

/** Book section for a form, or null when the book does not cover it. */
const FORM_BOOK: Record<string, string | null> = {
  blues12: 'blues-forms', aaba32: 'rhythm-changes', abac32: 'standard-forms-solos',
};

// ---------- Which form is this? ----------

export const formFromChart: PuzzleGenerator = {
  id: 'form-chart',
  skill: 'form',
  requiresAudio: false,
  base: 940,
  bookConcepts: ['blues-forms', 'rhythm-changes', 'standard-forms-solos'],
  concepts: FORMS.map((f) => `form:${f.id}`),
  make(rng, level, concept) {
    const f = FORMS.find((x) => `form:${x.id}` === concept) ?? rng.pick(FORMS);
    const starts = startBars(f.blocks);
    const blocks: FormVisualBlock[] = f.blocks.map((b, i) => ({
      label: b.label, bars: b.bars, start: starts[i], name: level === 0 && b.section ? getSection(b.section).nameCa : undefined,
    }));
    // Near misses first: forms with the same number of sections.
    const others = FORMS.filter((x) => x.id !== f.id)
      .sort((a, b) => Math.abs(a.blocks.length - f.blocks.length) - Math.abs(b.blocks.length - f.blocks.length));
    const letters = [...new Set(f.blocks.map((b) => b.label))];
    const counts = letters.map((l) => {
      const n = f.blocks.filter((b) => b.label === l).length;
      return `${l} hi és ${n} ${n === 1 ? 'vegada' : 'vegades'}`;
    });
    return {
      difficulty: this.base + 60 * level + 10 * f.blocks.length,
      conceptKey: `form:${f.id}`,
      bookConcept: FORM_BOOK[f.id] ?? null,
      prompt: 'Cada bloc és una secció; la mateixa lletra vol dir la mateixa música. Quina forma és?',
      visual: { type: 'form', blocks },
      answer: choice<FormDef>(rng, f, others, (x) => x.nameCa, optionCount(level)),
      hint: 'Compta quantes seccions hi ha i quantes vegades torna cada lletra.',
      explanation: `${f.nameCa}: ${formPattern(f.blocks).split('').join(' ')}, ${totalBars(f.blocks)} compassos. ${f.useCa}`,
      steps: [
        `Llegeix les lletres d'esquerra a dreta: ${formPattern(f.blocks).split('').join(' ')}. Són ${f.blocks.length} seccions amb ${letters.length} músiques diferents.`,
        `Compta quantes vegades torna cada una: ${and(counts)}.`,
        `Suma els compassos: ${f.blocks.map((b) => b.bars).join(' + ')} = ${totalBars(f.blocks)}.`,
        `Aquest patró és ${/^[A-Z][a-zàèéíòóú]/.test(f.nameCa) ? f.nameCa.charAt(0).toLowerCase() + f.nameCa.slice(1) : `una ${f.nameCa}`}. ${f.useCa}`,
      ],
      terms: ['forma'],
      truth: { kind: 'form-by-chart', blocks: f.blocks.map(({ label, bars }) => ({ label, bars })) },
    };
  },
};

// ---------- Which section is this? ----------

/** Smallest set of the section's traits that no other section shares, in random order. */
function uniqueClues(rng: Rng, s: SectionDef): Trait[] {
  const traits = rng.shuffle(s.traits);
  const subsets: Trait[][] = [];
  const n = traits.length;
  for (let mask = 1; mask < 1 << n; mask++) subsets.push(traits.filter((_, i) => mask & (1 << i)));
  subsets.sort((a, b) => a.length - b.length);
  return subsets.find((sub) => sectionsWith(sub).length === 1)!;
}

export const sectionRole: PuzzleGenerator = {
  id: 'section-role',
  skill: 'form',
  requiresAudio: false,
  base: 900,
  bookConcepts: [],
  concepts: SECTIONS.map((s) => `section:${s.id}`),
  make(rng, level, concept) {
    const s = SECTIONS.find((x) => `section:${x.id}` === concept) ?? rng.pick(SECTIONS);
    let clues = uniqueClues(rng, s);
    // An extra clue at the easiest level, when there is one to spare.
    if (level === 0) clues = [...clues, ...s.traits.filter((t) => !clues.includes(t)).slice(0, 1)];
    const sharing = SECTIONS.filter((x) => x.id !== s.id && x.traits.some((t) => clues.includes(t)));
    const rest = SECTIONS.filter((x) => x.id !== s.id && !sharing.includes(x));
    return {
      difficulty: this.base + 60 * level + 30 * (clues.length === 1 ? 0 : 1),
      conceptKey: `section:${s.id}`,
      bookConcept: null,
      prompt: `Quina secció de la cançó és?\n${clues.map((t) => `• ${TRAIT_CA[t]}`).join('\n')}`,
      answer: choice<SectionDef>(rng, s, [...rng.shuffle(sharing), ...rng.shuffle(rest)], (x) => cap(x.nameCa), optionCount(level)),
      hint: 'Pensa en una cançó que coneguis bé i en què passa a cada part.',
      explanation: `És ${ARTICLE[s.id]}. ${s.roleCa}`,
      steps: [
        ...clues.map((t) => `«${TRAIT_CA[t].replace(/\.$/, '')}» encaixa amb ${and(sectionsWith([t]).map((x) => ARTICLE[x.id]))}.`),
        `L'única secció que compleix totes les pistes és ${ARTICLE[s.id]}.`,
        'Són tendències, no lleis: moltes cançons es salten alguna secció o les barregen.',
      ],
      terms: ['forma', ...(s.id === 'chorus' ? ['tornada'] : s.id === 'bridge' ? ['pont'] : [])],
      truth: { kind: 'section-by-traits', traits: clues },
    };
  },
};

// ---------- Where does it start? ----------

interface Placed extends FormBlock {
  section: SectionId;
}

const POP_FORMS = ['verse-chorus', 'verse-chorus-bridge', 'verse-pre-chorus'].map(getForm);

/** A full arrangement of a pop form: an intro, lengths chosen per section, and sometimes a solo. */
function arrange(rng: Rng, f: FormDef, level: number): Placed[] {
  const len: Partial<Record<SectionId, number>> = {
    intro: rng.pick([4, 8]), verse: rng.pick([8, 16]), chorus: rng.pick([8, 8, 16]), prechorus: rng.pick([4, 8]), bridge: 8, solo: rng.pick([8, 16]),
  };
  const out: Placed[] = [{ label: 'I', bars: len.intro!, section: 'intro' }];
  for (const b of f.blocks) out.push({ label: b.label, bars: len[b.section!] ?? b.bars, section: b.section! });
  if (level >= 1 && rng.next() < 0.5) {
    // A solo over the verse before the last chorus.
    const lastChorus = out.map((b) => b.section).lastIndexOf('chorus');
    out.splice(lastChorus, 0, { label: 'S', bars: len.solo!, section: 'solo' });
  }
  return out;
}

/** "la segona tornada", "el pont": the occurrence number only when the section comes back. */
function describe(blocks: Placed[], i: number): string {
  const id = blocks[i].section;
  const same = blocks.filter((b) => b.section === id).length;
  if (same === 1) return ARTICLE[id];
  const n = blocks.slice(0, i + 1).filter((b) => b.section === id).length;
  const fem = FEMININE_SECTION.includes(id);
  const name = getSection(id).nameCa;
  return `${fem ? 'la' : 'el'} ${(fem ? ORD_F : ORD_M)[n - 1]} ${name}`;
}

export const sectionStart: PuzzleGenerator = {
  id: 'section-start',
  skill: 'form',
  requiresAudio: false,
  base: 980,
  bookConcepts: ['comping-rhythms'],
  concepts: POP_FORMS.map((f) => `form:${f.id}`),
  make(rng, level, concept) {
    const f = POP_FORMS.find((x) => `form:${x.id}` === concept) ?? rng.pick(POP_FORMS);
    const blocks = arrange(rng, f, level);
    const starts = startBars(blocks);
    const target = 2 + rng.int(blocks.length - 2);
    const at = starts[target];
    const what = describe(blocks, target);
    const wrong = [at - blocks[0].bars, at + 4, at - 4, at + 8, at - 8, at + blocks[target].bars, at - 1].filter((n) => n > 1 && n !== at);
    const visual: FormVisualBlock[] = blocks.map((b, i) => ({ label: b.label, bars: b.bars, name: getSection(b.section).nameCa, highlight: i === target }));
    return {
      difficulty: this.base + 60 * level + 8 * blocks.length,
      conceptKey: `form:${f.id}`,
      bookConcept: 'comping-rhythms',
      prompt: `Comptant des del compàs 1, a quin compàs comença ${what}?`,
      visual: { type: 'form', blocks: visual },
      answer: choice<number>(rng, at, wrong, (n) => `compàs ${n}`, optionCount(level)),
      hint: 'Suma els compassos de totes les seccions d\'abans, incloent-hi la introducció.',
      explanation: `${cap(what)} comença al compàs ${at}: abans hi ha ${at - 1} compassos (${blocks.slice(0, target).map((b) => b.bars).join(' + ')}).`,
      steps: [
        `Apunta on comença cada secció: ${blocks.slice(0, target + 1).map((b, i) => `${getSection(b.section).nameCa} al ${starts[i]}`).join(', ')}.`,
        `Abans ${what.startsWith('el ') ? `del ${what.slice(3)}` : `de ${what}`} hi ha ${blocks.slice(0, target).map((b) => `${b.bars}`).join(' + ')} = ${at - 1} compassos.`,
        `La secció comença al compàs següent: ${at}.`,
        'Tocant, compta per grups de quatre compassos («1-2-3-4, 2-2-3-4, 3-2-3-4, 4-2-3-4»): les seccions gairebé sempre comencen en un múltiple de quatre més u.',
      ],
      terms: ['forma'],
      truth: { kind: 'section-start', bars: blocks.map((b) => b.bars), target },
    };
  },
};

// ---------- 12-bar blues ----------

const barCells = (chords: ChartChord[][], hidden?: number, highlight?: number[]): BarCell[] =>
  chords.map((bar, i) => ({ chords: bar.map((c) => ({ roman: c.roman, symbol: chordSymbol(c) })), hidden: i === hidden, highlight: highlight?.includes(i) }));

export const bluesBar: PuzzleGenerator = {
  id: 'blues-bar',
  skill: 'form',
  requiresAudio: false,
  base: 960,
  bookConcepts: ['blues-forms', 'turnarounds'],
  concepts: BLUES.map((b) => `blues:${b.id}`),
  make(rng, level, concept) {
    const pool = level === 0 ? BLUES.filter((b) => b.id !== 'minor') : BLUES;
    const b: BluesDef = BLUES.find((x) => `blues:${x.id}` === concept) ?? rng.pick(pool);
    const tonic = pickTonic(rng, getScale(b.minor ? 'aeolian' : 'ionian'), level);
    const chords = bluesChords(b, tonic);
    const bars = b.id === 'quick' && rng.next() < 0.4 ? [1] : level === 0 ? [4, 8, 9, 10] : [1, 4, 6, 8, 9, 10, 11];
    const hide = rng.pick(bars);
    const target = chords[hide];
    const pool2 = [...new Map(chords.map((c) => [chordSymbol(c), c])).values()];
    const extra: Chord[] = b.minor
      ? [{ root: chords[8].root, def: getChord('maj7') }, { root: chords[9].root, def: getChord('m7') }]
      : [{ root: chords[8].root, def: getChord('m7') }, { root: chords[4].root, def: getChord('maj7') }];
    const phrase = Math.floor(hide / 4);
    const rows = [0, 1, 2].map((k) => chords.slice(4 * k, 4 * k + 4));
    return {
      difficulty: this.base + 60 * level + (b.minor ? 60 : 0) + (b.id === 'quick' ? 20 : 0),
      conceptKey: `blues:${b.id}`,
      bookConcept: 'blues-forms',
      prompt: `${cap(b.nameCa)} en ${noteCa(tonic)}${b.minor ? ' menor' : ''}. Quin acord va al compàs ${hide + 1}?`,
      visual: { type: 'bars', bars: barCells(chords.map((c) => [c]), hide), perRow: 4 },
      answer: choice<Chord>(rng, target, [...pool2.filter((c) => chordSymbol(c) !== chordSymbol(target)), ...extra], chordSymbol, optionCount(level)),
      hint: 'El blues són tres frases de quatre compassos. Mira en quina frase cau i què hi passa.',
      explanation: `Compàs ${hide + 1}: ${pair(target)}. Les tres frases: ${rows.map((r) => r.map((c) => chordSymbol(c)).join(' ')).join(' | ')}.`,
      steps: [
        'Un blues de 12 compassos són tres frases de quatre: compassos 1–4, 5–8 i 9–12.',
        `En aquesta tonalitat els acords són ${and([...new Map(chords.map((c) => [c.roman, c])).values()].map(pair))}.`,
        `El compàs ${hide + 1} és el ${ORDINALS[hide % 4]} de la ${['primera', 'segona', 'tercera'][phrase]} frase: ${rows[phrase].map(pair).join(', ')}.`,
        hide === 1 && b.id === 'quick'
          ? `És el canvi ràpid: al compàs 2 ja es toca ${pair(chords[1])} i al 3 es torna a ${pair(chords[2])}.`
          : hide === 11
            ? `El compàs 12 és el turnaround: ${pair(target)} fa tornar a començar.`
            : phrase === 2
              ? `L'última frase és la més moguda: ${rows[2].map(pair).join(' → ')}.`
              : `Per tant hi va ${pair(target)}.`,
      ],
      terms: ['forma', ...(hide === 11 ? ['turnaround'] : [])],
      listen: { type: 'progression', chords: chords.map(chordMidi) },
      truth: { kind: 'blues-bar', variant: b.id, tonic: noteName(tonic), bar: hide },
    };
  },
};

// ---------- Rhythm changes bridge ----------

export const rcBridge: PuzzleGenerator = {
  id: 'rc-bridge',
  // Jazz harmony rather than songwriting: rated with the other harmony puzzles.
  skill: 'harmony',
  requiresAudio: false,
  base: 1080,
  bookConcepts: ['rhythm-changes'],
  concepts: ['rc:bridge'],
  make(rng, level) {
    const major = getScale('ionian');
    const tonic: Note = level === 0 ? { letter: 6, alt: -1 } : pickTonic(rng, major, level);
    const right = rhythmBridge(tonic);
    const build = (spec: [string, string][]): ChartChord[] => cadenceChords(tonic, spec);
    const wrong: ChartChord[][] = [
      build([['3', 'm7'], ['6', 'm7'], ['2', 'm7'], ['5', '7']]),
      build([['5', '7'], ['2', '7'], ['6', '7'], ['3', '7']]),
      build([['6', '7'], ['2', '7'], ['5', '7'], ['1', '7']]),
      build([['1', 'maj'], ['6', 'm7'], ['2', 'm7'], ['5', '7']]),
      build([['3', '7'], ['4', '7'], ['5', '7'], ['1', '7']]),
    ];
    const label = (cs: ChartChord[]) => cs.map((c) => chordSymbol(c)).join(' – ');
    return {
      difficulty: this.base + 60 * level,
      conceptKey: 'rc:bridge',
      bookConcept: 'rhythm-changes',
      prompt: `Rhythm changes en ${noteCa(tonic)}. Quins acords fa el pont (la B), dos compassos cada un?`,
      visual: { type: 'form', blocks: [{ label: 'A', bars: 8, start: 1 }, { label: 'A', bars: 8, start: 9 }, { label: 'B', bars: 8, start: 17, name: 'pont', highlight: true }, { label: 'A', bars: 8, start: 25 }] },
      answer: choice<ChartChord[]>(rng, right, wrong, label, optionCount(level)),
      hint: 'Són acords de 7a de dominant que avancen per quintes, com una cadena de dominants secundaris.',
      explanation: `${right.map(pair).join(', ')}: dominants que baixen per quintes fins al de la tonalitat, que torna a l'última A.`,
      steps: [
        'Les rhythm changes són una AABA de 32 compassos: el pont són els compassos 17 a 24.',
        `El pont comença a la 3a major de la tonalitat (${noteCa(right[0].root)}) i hi fa un acord de 7a de dominant.`,
        `Cada acord és el dominant del següent, una quinta per sota: ${right.map(pair).join(' → ')}.`,
        `L'últim, ${pair(right[3])}, és el dominant de ${noteCa(tonic)} i fa tornar a l'última A.`,
      ],
      terms: ['forma', 'rhythm changes'],
      listen: { type: 'progression', chords: right.map(chordMidi) },
      truth: { kind: 'rc-bridge', tonic: noteName(tonic) },
    };
  },
};

// ---------- Cadences ----------

export const cadenceKind: PuzzleGenerator = {
  id: 'cadence',
  skill: 'form',
  requiresAudio: false,
  base: 1000,
  bookConcepts: ['scale-degrees-progressions'],
  concepts: CADENCES.map((c) => `cadence:${c.id}`),
  make(rng, level, concept) {
    const cad = CADENCES.find((c) => `cadence:${c.id}` === concept) ?? rng.pick(CADENCES);
    const major = getScale('ionian');
    const tonic = pickTonic(rng, major, level);
    const end = cadenceChords(tonic, rng.pick(cad.examples));
    // Two diatonic chords lead in; they never repeat the chord that follows them.
    const lead = cadenceChords(tonic, rng.shuffle<[string, string]>([['1', 'maj'], ['6', 'm'], ['4', 'maj'], ['2', 'm'], ['3', 'm']])
      .filter(([d]) => d !== '1' || end[0].roman !== 'I').slice(0, 2));
    if (chordSymbol(lead[1]) === chordSymbol(end[0])) lead.reverse();
    const all = [...lead, ...end];
    const label = (c: typeof cad) => (level === 0 ? `${cap(c.nameCa)} (${c.shortCa})` : cap(c.nameCa));
    return {
      difficulty: this.base + 70 * level + (cad.id === 'deceptive' || cad.id === 'modal' ? 40 : 0),
      conceptKey: `cadence:${cad.id}`,
      bookConcept: 'scale-degrees-progressions',
      prompt: `Una secció en ${noteCa(tonic)} major acaba amb aquests acords. Quina cadència fa?`,
      visual: { type: 'progression', chords: all.map(chordSymbol) },
      answer: choice(rng, cad, CADENCES.filter((c) => c.id !== cad.id), label, optionCount(level)),
      hint: 'Només compten els dos últims acords. Troba quin grau de l\'escala és cadascun.',
      explanation: `${pair(end[0])} → ${pair(end[1])}: ${cad.nameCa}. ${cad.effectCa}`,
      steps: [
        `Escriu ${noteCa(tonic)} major per situar els acords: ${notesCa(scaleNotes(tonic, major))}.`,
        `Els dos últims acords són ${chordSymbol(end[0])} (${notesCa(spellChord(end[0]))}) i ${chordSymbol(end[1])} (${notesCa(spellChord(end[1]))}).`,
        `En aquesta tonalitat són ${pair(end[0])} i ${pair(end[1])}: és una ${cad.nameCa}.`,
        `${cad.effectCa} ${cad.whereCa}`,
      ],
      terms: ['cadència'],
      listen: { type: 'progression', chords: all.map(chordMidi) },
      truth: { kind: 'cadence', tonic: noteName(tonic), chords: end.map(chordId) },
    };
  },
};

export const FORM_GENERATORS = [formFromChart, sectionRole, sectionStart, bluesBar, rcBridge, cadenceKind];

// Kept for the audit solver.
export { RHYTHM_BRIDGE };
