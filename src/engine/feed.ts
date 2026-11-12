// Feed scheduler: picks the next puzzle from ratings and the spaced-repetition queue.
import type { Puzzle, SkillArea } from '../puzzles/types';
import { GENERATORS, getGenerator, makePuzzle } from '../puzzles/registry';
import { SKILLS, START_RATING, levelFor, updateRating } from './elo';

export interface ReviewItem {
  generatorId: string;
  conceptKey: string;
  /** Index into REVIEW_STEPS. */
  stage: number;
  /** Due once this many puzzles have been answered in total. */
  dueServed?: number;
  /** Due at this time (epoch ms). */
  dueAt?: number;
}

export interface FeedState {
  ratings: Record<SkillArea, number>;
  attempts: Record<SkillArea, number>;
  reviews: ReviewItem[];
  /** Total puzzles answered, ever. */
  served: number;
  /** Value of `served` when the last review was answered; keeps reviews from flooding the feed. */
  lastReviewAt?: number;
}

export interface FeedOptions {
  audio: boolean;
  skills: SkillArea[];
}

const DAY = 86_400_000;
/** A failed concept returns after 3 puzzles, then 10, then a day, then three days. */
export const REVIEW_STEPS: { puzzles?: number; days?: number }[] = [
  { puzzles: 3 }, { puzzles: 10 }, { days: 1 }, { days: 3 },
];

export const initialFeedState = (): FeedState => ({
  ratings: Object.fromEntries(SKILLS.map((s) => [s, START_RATING])) as Record<SkillArea, number>,
  attempts: Object.fromEntries(SKILLS.map((s) => [s, 0])) as Record<SkillArea, number>,
  reviews: [],
  served: 0,
});

const isDue = (r: ReviewItem, state: FeedState, now: number): boolean =>
  r.dueServed !== undefined ? state.served >= r.dueServed : now >= (r.dueAt ?? 0);

function schedule(item: ReviewItem, state: FeedState, now: number): ReviewItem {
  const step = REVIEW_STEPS[item.stage];
  return {
    generatorId: item.generatorId,
    conceptKey: item.conceptKey,
    stage: item.stage,
    ...(step.puzzles ? { dueServed: state.served + step.puzzles } : { dueAt: now + step.days! * DAY }),
  };
}

export interface Served {
  puzzle: Puzzle;
  /** Set when this puzzle is a scheduled repeat of a failed concept. */
  review?: ReviewItem;
}

/** rand() must return a float in [0, 1). */
export function nextPuzzle(state: FeedState, opts: FeedOptions, now: number, rand: () => number): Served {
  const usable = GENERATORS.filter((g) => (opts.audio || !g.requiresAudio) && opts.skills.includes(g.skill));
  const pool = usable.length ? usable : GENERATORS.filter((g) => !g.requiresAudio);
  const seed = Math.floor(rand() * 2 ** 31);

  // At most every other puzzle is a review, so new material keeps coming even after a bad run.
  const reviewAllowed = state.lastReviewAt === undefined || state.served - state.lastReviewAt >= 2;
  const due = !reviewAllowed ? undefined : state.reviews.find((r) => isDue(r, state, now) && pool.some((g) => g.id === r.generatorId));
  if (due) {
    const g = getGenerator(due.generatorId);
    // Same concept, new seed: the repeat lands in a different key so the answer cannot be memorized.
    return { puzzle: makePuzzle(g.id, seed, levelFor(state.ratings[g.skill]), due.conceptKey), review: due };
  }

  const skills = [...new Set(pool.map((g) => g.skill))];
  const weakest = skills.reduce((a, b) => (state.ratings[b] < state.ratings[a] ? b : a));
  const skill = rand() < 0.7 ? weakest : skills[Math.floor(rand() * skills.length)];
  const gens = pool.filter((g) => g.skill === skill);
  const g = gens[Math.floor(rand() * gens.length)];
  return { puzzle: makePuzzle(g.id, seed, levelFor(state.ratings[skill])) };
}

export interface AnswerResult {
  state: FeedState;
  ratingBefore: number;
  ratingAfter: number;
}

export function recordAnswer(
  state: FeedState, served: Served, correct: boolean, usedHint: boolean, now: number,
): AnswerResult {
  const { puzzle, review } = served;
  const skill = puzzle.skill;
  const ratingBefore = state.ratings[skill];
  const score = correct ? (usedHint ? 0.5 : 1) : 0;
  const ratingAfter = updateRating(ratingBefore, puzzle.difficulty, score, state.attempts[skill]);
  const next: FeedState = {
    ratings: { ...state.ratings, [skill]: ratingAfter },
    attempts: { ...state.attempts, [skill]: state.attempts[skill] + 1 },
    served: state.served + 1,
    lastReviewAt: review ? state.served + 1 : state.lastReviewAt,
    reviews: state.reviews.filter(
      (r) => !(r.generatorId === puzzle.generatorId && r.conceptKey === puzzle.conceptKey),
    ),
  };
  const base = { generatorId: puzzle.generatorId, conceptKey: puzzle.conceptKey };
  if (!correct) {
    // Any failure restarts the ladder.
    next.reviews.push(schedule({ ...base, stage: 0 }, next, now));
  } else if (review && review.stage + 1 < REVIEW_STEPS.length) {
    next.reviews.push(schedule({ ...base, stage: review.stage + 1 }, next, now));
  }
  return { state: next, ratingBefore, ratingAfter };
}
