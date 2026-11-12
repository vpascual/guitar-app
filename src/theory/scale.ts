// Scales and modes. Modes are derived by rotating a parent formula, never hand-typed.
import { Note, Interval, parseDegree, degreeName, transpose, TONIC_CANDIDATES } from './note';

export type ScaleFamily = 'major' | 'melodic-minor' | 'harmonic-minor';

export interface ScaleDef {
  id: string;
  family: ScaleFamily;
  /** 0-based rotation of the parent scale. */
  modeIndex: number;
  nameCa: string;
  /** Degrees relative to the major scale, e.g. ["1","2","b3",...]. */
  formula: string[];
  /** The degree that sets this mode apart from plain major or natural minor. */
  characteristic: string;
  /** Short Catalan description of the colour, used in prompts and explanations. */
  colourCa: string;
}

const PARENTS: Record<ScaleFamily, string[]> = {
  major: ['1', '2', '3', '4', '5', '6', '7'],
  'melodic-minor': ['1', '2', 'b3', '4', '5', '6', '7'],
  'harmonic-minor': ['1', '2', 'b3', '4', '5', 'b6', '7'],
};

/** Rotate a parent formula so that its k-th degree becomes the new root. */
export function rotateFormula(parent: string[], k: number): string[] {
  const ivs = parent.map(parseDegree);
  const root = ivs[k];
  return ivs.map((_, i) => {
    const iv = ivs[(k + i) % 7];
    const wrapped = k + i >= 7 ? 1 : 0;
    const rel: Interval = {
      steps: iv.steps + 7 * wrapped - root.steps,
      semis: iv.semis + 12 * wrapped - root.semis,
    };
    return degreeName(rel);
  });
}

type Meta = [id: string, nameCa: string, characteristic: string, colourCa: string];

const META: Record<ScaleFamily, Meta[]> = {
  major: [
    ['ionian', 'jònic', '4', 'major amb la 4a justa i la 7a major (l\'escala major de sempre)'],
    ['dorian', 'dòric', '6', 'menor amb la 6a major'],
    ['phrygian', 'frigi', 'b2', 'menor amb la 2a bemoll'],
    ['lydian', 'lidi', '#4', 'major amb la 4a augmentada'],
    ['mixolydian', 'mixolidi', 'b7', 'major amb la 7a bemoll'],
    ['aeolian', 'eòlic', 'b6', 'menor amb la 6a bemoll (el menor natural)'],
    ['locrian', 'locri', 'b5', 'menor amb la 2a bemoll i la 5a bemoll'],
  ],
  'melodic-minor': [
    ['melodic-minor', 'menor melòdica', '7', 'menor amb la 6a major i la 7a major'],
    ['dorian-b2', 'dòric b2', 'b2', 'dòric amb la 2a bemoll'],
    ['lydian-augmented', 'lidi augmentat', '#5', 'lidi amb la 5a augmentada'],
    ['lydian-dominant', 'lidi dominant', '#4', 'mixolidi amb la 4a augmentada'],
    ['mixolydian-b6', 'mixolidi b6', 'b6', 'mixolidi amb la 6a bemoll'],
    ['locrian-nat2', 'locri ♮2', '2', 'locri amb la 2a major'],
    ['altered', 'alterada (superlocri)', 'b4', 'locri amb la 4a bemoll: totes les tensions alterades d\'un dominant'],
  ],
  'harmonic-minor': [
    ['harmonic-minor', 'menor harmònica', '7', 'menor natural amb la 7a major'],
    ['locrian-nat6', 'locri ♮6', '6', 'locri amb la 6a major'],
    ['ionian-augmented', 'jònic augmentat', '#5', 'major amb la 5a augmentada'],
    ['dorian-sharp4', 'dòric #4', '#4', 'dòric amb la 4a augmentada'],
    ['phrygian-dominant', 'frigi dominant', '3', 'frigi amb la 3a major'],
    ['lydian-sharp2', 'lidi #2', '#2', 'lidi amb la 2a augmentada'],
    ['ultralocrian', 'ultralocri', 'bb7', 'locri amb la 4a bemoll i la 7a disminuïda'],
  ],
};

export const SCALES: ScaleDef[] = (Object.keys(PARENTS) as ScaleFamily[]).flatMap((family) =>
  META[family].map(([id, nameCa, characteristic, colourCa], modeIndex) => ({
    id,
    family,
    modeIndex,
    nameCa,
    formula: rotateFormula(PARENTS[family], modeIndex),
    characteristic,
    colourCa,
  })),
);

export const MAJOR_MODES = SCALES.filter((s) => s.family === 'major');

export function getScale(id: string): ScaleDef {
  const s = SCALES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scale: ${id}`);
  return s;
}

export const scaleNotes = (tonic: Note, scale: ScaleDef): Note[] =>
  scale.formula.map((d) => transpose(tonic, parseDegree(d)));

/** The note of the characteristic degree in a given key. */
export const characteristicNote = (tonic: Note, scale: ScaleDef): Note =>
  transpose(tonic, parseDegree(scale.characteristic));

/** Tonic of the parent scale (e.g. D dorian -> C major). */
export function parentTonic(tonic: Note, scale: ScaleDef): Note {
  const up = parseDegree(scale.formula[(7 - scale.modeIndex) % 7]);
  return transpose(tonic, up);
}

/** Number of accidentals in the spelled scale; used for difficulty. */
export const accidentalCount = (tonic: Note, scale: ScaleDef): number =>
  scaleNotes(tonic, scale).reduce((n, x) => n + Math.abs(x.alt), 0);

/** Tonics for which the scale spells without double accidentals. */
export function validTonics(scale: ScaleDef, maxAccidentals = 6): Note[] {
  return TONIC_CANDIDATES.filter((t) => {
    const notes = scaleNotes(t, scale);
    return notes.every((n) => Math.abs(n.alt) <= 1) && accidentalCount(t, scale) <= maxAccidentals;
  });
}

/** True when the third of the scale is minor. */
export const isMinorScale = (scale: ScaleDef): boolean => scale.formula[2] === 'b3';
