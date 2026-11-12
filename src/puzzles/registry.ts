import type { Puzzle, PuzzleGenerator } from './types';
import { makeRng } from './util';
import { MODE_GENERATORS } from './modes';
import { CHORD_GENERATORS } from './chords';
import { HARMONY_GENERATORS } from './harmony';
import { RHYTHM_GENERATORS } from './rhythm';

export const GENERATORS: PuzzleGenerator[] = [
  ...MODE_GENERATORS, ...CHORD_GENERATORS, ...HARMONY_GENERATORS, ...RHYTHM_GENERATORS,
];

export function getGenerator(id: string): PuzzleGenerator {
  const g = GENERATORS.find((x) => x.id === id);
  if (!g) throw new Error(`Unknown generator: ${id}`);
  return g;
}

/** Build a puzzle. The same (generator, seed, level, concept) always yields the same puzzle. */
export function makePuzzle(generatorId: string, seed: number, level: number, concept?: string): Puzzle {
  const g = getGenerator(generatorId);
  const body = g.make(makeRng(seed), level, concept);
  return { id: `${generatorId}:${seed}:${level}`, generatorId, seed, level, skill: g.skill, ...body };
}
