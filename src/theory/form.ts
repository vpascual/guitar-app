// Song form: the sections of a song, common forms, the 12-bar blues, rhythm changes and cadences.
// Pure data and functions; the puzzles, the theory pages and the audit all read from here.
import { Note, parseDegree, transpose, intervalBetween, degreeName } from './note';
import { Chord, getChord, romanNumeral } from './chord';

// ---------- Sections ----------

export type SectionId = 'intro' | 'verse' | 'prechorus' | 'chorus' | 'bridge' | 'solo' | 'interlude' | 'outro' | 'tag';

/** A typical property of a section, phrased as a clue. "Typical" matters: songs break these rules all the time. */
export type Trait =
  | 'opens' | 'closes' | 'instrumental' | 'short' | 'lyrics-change' | 'story' | 'lyrics-repeat' | 'title' | 'peak'
  | 'builds' | 'leads-chorus' | 'once' | 'contrast' | 'late' | 'featured' | 'between' | 'repeats-last' | 'fade';

export const TRAIT_CA: Record<Trait, string> = {
  opens: 'Obre la cançó.',
  closes: 'Tanca la cançó.',
  instrumental: 'Normalment és instrumental, sense veu.',
  short: 'És curta: sovint dos o quatre compassos.',
  'lyrics-change': 'La melodia es repeteix, però la lletra canvia cada vegada.',
  story: 'Explica la història: hi passen coses noves.',
  'lyrics-repeat': 'Torna diverses vegades amb la mateixa lletra.',
  title: 'Sol contenir el títol de la cançó.',
  peak: 'És el moment de més energia.',
  builds: 'Fa pujar la tensió.',
  'leads-chorus': 'Va just abans de la tornada.',
  once: 'Normalment només apareix una vegada.',
  contrast: 'Porta acords o melodia que encara no han sonat.',
  late: 'Arriba tard, després de la segona tornada.',
  featured: 'Hi destaca un instrument, sovint sobre els acords d\'una altra secció.',
  between: 'Separa dues seccions cantades.',
  'repeats-last': 'Repeteix l\'última frase de la tornada.',
  fade: 'Sovint s\'esvaeix o acaba amb un cop final.',
};

export interface SectionDef {
  id: SectionId;
  nameCa: string;
  roleCa: string;
  traits: Trait[];
}

export const SECTIONS: SectionDef[] = [
  { id: 'intro', nameCa: 'introducció', roleCa: 'Presenta el to, el tempo i sovint el riff principal.', traits: ['opens', 'instrumental', 'short'] },
  { id: 'verse', nameCa: 'vers', roleCa: 'Avança la història. Mateixa música, lletra nova a cada vers.', traits: ['lyrics-change', 'story'] },
  { id: 'prechorus', nameCa: 'pre-tornada', roleCa: 'Prepara la tornada: la tensió puja i els acords sovint acaben en el V.', traits: ['builds', 'leads-chorus', 'short'] },
  { id: 'chorus', nameCa: 'tornada', roleCa: 'El cor de la cançó: es repeteix igual, porta el títol i el ganxo.', traits: ['lyrics-repeat', 'title', 'peak'] },
  { id: 'bridge', nameCa: 'pont', roleCa: 'Contrast abans del tram final: material nou que fa tornar la tornada amb més força.', traits: ['once', 'contrast', 'late'] },
  { id: 'solo', nameCa: 'solo', roleCa: 'Un instrument pren la melodia, sovint sobre els acords del vers o de la tornada.', traits: ['instrumental', 'featured', 'once'] },
  { id: 'interlude', nameCa: 'interludi', roleCa: 'Respir instrumental curt entre seccions; sovint torna el riff de la introducció.', traits: ['instrumental', 'between', 'short'] },
  { id: 'outro', nameCa: 'final (outro)', roleCa: 'Tanca la cançó: repeteix la tornada o el riff fins que s\'esvaeix o acaba amb un cop.', traits: ['closes', 'fade'] },
  { id: 'tag', nameCa: 'coda (tag)', roleCa: 'Repetició curta de l\'última frase per tancar.', traits: ['closes', 'repeats-last', 'short'] },
];

export const getSection = (id: SectionId): SectionDef => SECTIONS.find((s) => s.id === id)!;

/** Sections that have every trait. */
export const sectionsWith = (traits: Trait[]): SectionDef[] => SECTIONS.filter((s) => traits.every((t) => s.traits.includes(t)));

// ---------- Forms ----------

export interface FormBlock {
  /** Letter: the same letter means the same music. */
  label: string;
  bars: number;
  section?: SectionId;
}

export interface FormDef {
  id: string;
  nameCa: string;
  /** One line on where the form is used. */
  useCa: string;
  blocks: FormBlock[];
}

const B = (label: string, bars: number, section?: SectionId): FormBlock => ({ label, bars, section });

export const FORMS: FormDef[] = [
  { id: 'strophic', nameCa: 'Estròfica (AAA)', useCa: 'La mateixa música per a cada estrofa, sense tornada separada. Cançó popular, folk i balades.',
    blocks: [B('A', 8, 'verse'), B('A', 8, 'verse'), B('A', 8, 'verse')] },
  { id: 'blues12', nameCa: 'Blues de 12 compassos (AAB)', useCa: 'Tres frases de quatre compassos: la primera, la mateixa repetida i una resposta.',
    blocks: [B('A', 4), B('A', 4), B('B', 4)] },
  { id: 'ternary', nameCa: 'Ternària (ABA)', useCa: 'Exposició, contrast i retorn. Molta música clàssica i alguns temes instrumentals.',
    blocks: [B('A', 8), B('B', 8), B('A', 8)] },
  { id: 'aaba32', nameCa: 'AABA de 32 compassos', useCa: 'La forma de cançó americana: tres seccions iguals i un pont. Estàndards de jazz i pop dels anys 30 a 60.',
    blocks: [B('A', 8, 'verse'), B('A', 8, 'verse'), B('B', 8, 'bridge'), B('A', 8, 'verse')] },
  { id: 'abac32', nameCa: 'ABAC de 32 compassos', useCa: 'Dues meitats que comencen igual i acaben diferent. Molts estàndards de jazz.',
    blocks: [B('A', 8), B('B', 8), B('A', 8), B('C', 8)] },
  { id: 'verse-chorus', nameCa: 'Vers-tornada', useCa: 'Vers i tornada que s\'alternen. La base del pop i el rock.',
    blocks: [B('A', 8, 'verse'), B('B', 8, 'chorus'), B('A', 8, 'verse'), B('B', 8, 'chorus')] },
  { id: 'verse-chorus-bridge', nameCa: 'Vers-tornada amb pont', useCa: 'Dos cicles de vers i tornada, un pont i l\'última tornada. La forma pop més habitual.',
    blocks: [B('A', 8, 'verse'), B('B', 8, 'chorus'), B('A', 8, 'verse'), B('B', 8, 'chorus'), B('C', 8, 'bridge'), B('B', 8, 'chorus')] },
  { id: 'verse-pre-chorus', nameCa: 'Vers, pre-tornada i tornada', useCa: 'Una pre-tornada curta entre vers i tornada, i un pont abans de l\'última tornada.',
    blocks: [B('A', 8, 'verse'), B('B', 4, 'prechorus'), B('C', 8, 'chorus'), B('A', 8, 'verse'), B('B', 4, 'prechorus'), B('C', 8, 'chorus'), B('D', 8, 'bridge'), B('C', 8, 'chorus')] },
];

export const getForm = (id: string): FormDef => FORMS.find((f) => f.id === id)!;

export const formPattern = (blocks: FormBlock[]): string => blocks.map((b) => b.label).join('');
export const totalBars = (blocks: FormBlock[]): number => blocks.reduce((n, b) => n + b.bars, 0);

/** The catalogue form with the same letter pattern, if any. Letter patterns are unique across the catalogue. */
export const identifyForm = (blocks: FormBlock[]): FormDef | undefined =>
  FORMS.find((f) => formPattern(f.blocks) === formPattern(blocks));

/** Bar number (1-based) where each block starts. */
export const startBars = (blocks: FormBlock[]): number[] => {
  const out: number[] = [];
  let at = 1;
  for (const b of blocks) {
    out.push(at);
    at += b.bars;
  }
  return out;
};

/** Length in seconds of a number of 4/4 bars at a tempo. */
export const barsToSeconds = (bars: number, bpm: number, beats = 4): number => (bars * beats * 60) / bpm;

// ---------- Chord charts ----------

export interface ChartChord extends Chord {
  roman: string;
}

const chartChord = (tonic: Note, degree: string, chordId: string): ChartChord =>
  ({ root: transpose(tonic, parseDegree(degree)), def: getChord(chordId), roman: romanNumeral(degree, chordId) });

export type BluesId = 'standard' | 'quick' | 'minor';

export interface BluesDef {
  id: BluesId;
  nameCa: string;
  minor: boolean;
  bars: [string, string][];
}

const I7: [string, string] = ['1', '7'];
const IV7: [string, string] = ['4', '7'];
const V7: [string, string] = ['5', '7'];
const i7: [string, string] = ['1', 'm7'];
const iv7: [string, string] = ['4', 'm7'];

export const BLUES: BluesDef[] = [
  { id: 'standard', nameCa: 'blues estàndard', minor: false,
    bars: [I7, I7, I7, I7, IV7, IV7, I7, I7, V7, IV7, I7, V7] },
  { id: 'quick', nameCa: 'blues amb canvi ràpid (quick change)', minor: false,
    bars: [I7, IV7, I7, I7, IV7, IV7, I7, I7, V7, IV7, I7, V7] },
  { id: 'minor', nameCa: 'blues menor', minor: true,
    bars: [i7, i7, i7, i7, iv7, iv7, i7, i7, ['b6', '7'], V7, i7, V7] },
];

export const getBlues = (id: BluesId): BluesDef => BLUES.find((b) => b.id === id)!;
export const bluesChords = (b: BluesDef, tonic: Note): ChartChord[] => b.bars.map(([d, c]) => chartChord(tonic, d, c));

/** Rhythm changes, a common version: each bar holds one or two chords. */
export const RHYTHM_A: [string, string][][] = [
  [['1', 'maj'], ['6', 'm7']], [['2', 'm7'], ['5', '7']], [['1', 'maj'], ['6', 'm7']], [['2', 'm7'], ['5', '7']],
  [['1', 'maj'], ['1', '7']], [['4', 'maj'], ['4', 'm']], [['1', 'maj'], ['5', '7']], [['1', 'maj']],
];
/** The bridge: dominant sevenths around the cycle of fifths, two bars each. */
export const RHYTHM_BRIDGE: [string, string][] = [['3', '7'], ['6', '7'], ['2', '7'], ['5', '7']];

export const rhythmBars = (tonic: Note, bars: [string, string][][]): ChartChord[][] =>
  bars.map((bar) => bar.map(([d, c]) => chartChord(tonic, d, c)));
export const rhythmBridge = (tonic: Note): ChartChord[] => RHYTHM_BRIDGE.map(([d, c]) => chartChord(tonic, d, c));

// ---------- Cadences ----------

export type CadenceId = 'authentic' | 'plagal' | 'half' | 'deceptive' | 'modal';

export interface CadenceDef {
  id: CadenceId;
  nameCa: string;
  shortCa: string;
  effectCa: string;
  whereCa: string;
  /** Example endings as [degree, chord id] pairs, in a major key. */
  examples: [string, string][][];
}

export const CADENCES: CadenceDef[] = [
  { id: 'authentic', nameCa: 'cadència autèntica', shortCa: 'V → I', effectCa: 'Tanca: la frase arriba a casa i descansa.',
    whereCa: 'Final de tornada i final de cançó.', examples: [[['5', '7'], ['1', 'maj']], [['5', 'maj'], ['1', 'maj']]] },
  { id: 'plagal', nameCa: 'cadència plagal', shortCa: 'IV → I', effectCa: 'Tanca, però més suau que l\'autèntica: és l\'"amén" dels himnes.',
    whereCa: 'Finals tranquils, gòspel i rock. Amb l\'acord de la 4a en menor sona nostàlgic.', examples: [[['4', 'maj'], ['1', 'maj']], [['4', 'm'], ['1', 'maj']]] },
  { id: 'half', nameCa: 'semicadència', shortCa: '… → V', effectCa: 'Deixa la frase oberta, com una pregunta: l\'acord de dominant demana continuar.',
    whereCa: 'Final de vers o de pre-tornada, just abans de la tornada.',
    examples: [[['1', 'maj'], ['5', 'maj']], [['2', 'm'], ['5', 'maj']], [['4', 'maj'], ['5', 'maj']], [['1', 'maj'], ['5', '7']]] },
  { id: 'deceptive', nameCa: 'cadència trencada', shortCa: 'V → vi', effectCa: 'Sorprèn: l\'orella espera la tònica i arriba l\'acord menor de la 6a. La frase s\'allarga.',
    whereCa: 'Per estirar una tornada abans del final de debò, o per enllaçar dues seccions.', examples: [[['5', '7'], ['6', 'm']], [['5', 'maj'], ['6', 'm']]] },
  { id: 'modal', nameCa: 'cadència modal', shortCa: 'bVII → I', effectCa: 'Tanca sense sensible: arriba a casa des d\'un to per sota, amb so de rock.',
    whereCa: 'Rock i pop amb color mixolidi. Sovint hi arriba des de l\'acord de la 6a bemoll.', examples: [[['b7', 'maj'], ['1', 'maj']]] },
];

export const getCadence = (id: CadenceId): CadenceDef => CADENCES.find((c) => c.id === id)!;

export const cadenceChords = (tonic: Note, example: [string, string][]): ChartChord[] =>
  example.map(([d, c]) => chartChord(tonic, d, c));

/** Chords from [degree, chord id] pairs in a key, each with its Roman numeral. */
export const chartChords = cadenceChords;

/** Roman numeral of any chord measured from a tonic, e.g. A7 in C -> "VI7". */
export const romanIn = (tonic: Note, c: Chord): string => romanNumeral(degreeName(intervalBetween(tonic, c.root)), c.def.id);

/** Which cadence two chords form at the end of a section in a key, from their degrees alone. */
export function classifyCadence(tonic: Note, a: Chord, b: Chord): CadenceId | null {
  const deg = (c: Chord) => degreeName(intervalBetween(tonic, c.root));
  const da = deg(a);
  const db = deg(b);
  const majorB = b.def.formula[1] === '3';
  const majorA = a.def.formula[1] === '3';
  if (db === '5' && majorB) return 'half';
  if (db === '1' && majorB) {
    if (da === '5' && majorA) return 'authentic';
    if (da === '4') return 'plagal';
    if (da === 'b7' && majorA) return 'modal';
  }
  if (da === '5' && majorA && db === '6' && !majorB) return 'deceptive';
  return null;
}
