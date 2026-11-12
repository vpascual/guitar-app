// Puzzle data model. A puzzle is fully determined by generator id, seed and level.
import type { Voicing, FretPos } from '../theory/guitar';

export type SkillArea = 'modes' | 'chords' | 'harmony' | 'rhythm';

export type Visual =
  | { type: 'notes'; notes: string[] }
  | { type: 'progression'; chords: string[] }
  | { type: 'diagram'; voicing: Voicing }
  | { type: 'fretboard'; firstFret: number; frets: number; dots: (FretPos & { label?: string; root?: boolean })[] }
  | { type: 'rhythm'; groups: number[] }
  | { type: 'listen' };

/** What the optional "listen" button plays. MIDI numbers. */
export type Listen =
  | { type: 'scale'; midi: number[] }
  | { type: 'chord'; midi: number[] }
  | { type: 'progression'; chords: number[][] }
  | { type: 'clicks'; accents: number[]; bpm: number };

export type Answer =
  | { type: 'choice'; options: string[]; values: unknown[]; correctIndex: number }
  | { type: 'tap'; accept: FretPos[] };

/** Structured statement of what is being asked; the audit re-solves it against the theory core. */
export type Truth = { kind: string } & Record<string, unknown>;

export interface ChordHelp {
  symbol: string;
  voicing: Voicing;
}

export interface Puzzle {
  id: string;
  generatorId: string;
  seed: number;
  level: number;
  difficulty: number;
  skill: SkillArea;
  /** Review key: a failed puzzle returns as another puzzle with the same key. */
  conceptKey: string;
  /** Concept id in the book index, or null when the book does not cover the topic. */
  bookConcept: string | null;
  prompt: string;
  visual?: Visual;
  answer: Answer;
  hint?: string;
  explanation: string;
  /** Glossary terms used; each is explained the first time it shows up. */
  terms: string[];
  listen?: Listen;
  /** Diagrams offered under "how to play it". */
  chordHelp?: ChordHelp[];
  truth: Truth;
}

export interface Rng {
  next(): number;
  int(n: number): number;
  pick<T>(xs: readonly T[]): T;
  shuffle<T>(xs: readonly T[]): T[];
}

export interface PuzzleGenerator {
  id: string;
  skill: SkillArea;
  requiresAudio: boolean;
  /** Base difficulty on the Elo scale. */
  base: number;
  /** Concept ids in the book index that this generator draws on. Empty = not covered by the book. */
  bookConcepts: string[];
  /** Review keys this generator can produce. */
  concepts: string[];
  make(rng: Rng, level: number, concept?: string): Omit<Puzzle, 'id' | 'generatorId' | 'seed' | 'level' | 'skill'>;
}
