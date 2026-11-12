// Elo-style rating per skill area. A puzzle's difficulty plays the role of the opponent's rating.
import type { SkillArea } from '../puzzles/types';

export const SKILLS: SkillArea[] = ['modes', 'chords', 'harmony', 'rhythm'];
export const START_RATING = 1000;

export const expectedScore = (rating: number, difficulty: number): number =>
  1 / (1 + 10 ** ((difficulty - rating) / 400));

/** K shrinks once a skill has enough attempts for the rating to be trusted. */
export const kFactor = (attempts: number): number => (attempts < 20 ? 32 : 16);

/** score: 1 correct, 0.5 correct with a hint, 0 wrong. */
export function updateRating(rating: number, difficulty: number, score: number, attempts: number): number {
  return Math.round(rating + kFactor(attempts) * (score - expectedScore(rating, difficulty)));
}

/** Generator level for a rating: 0 easy keys and three options, 2 any key and harder material. */
export const levelFor = (rating: number): number => (rating < 1020 ? 0 : rating < 1140 ? 1 : 2);
