// Progress views derived from stored attempts: mastery per concept, weekly rhythm, tempo history.
// Nothing here is stored; it is recomputed from the attempt log, so the rules can change without a migration.
import type { Attempt, DayStats } from '../storage/repository';
import type { ReviewItem } from './feed';
import { MAJOR_MODES, SCALES } from '../theory/scale';
import { CHORDS } from '../theory/chord';
import { localDate } from '../storage/repository';

export type Mastery = 'new' | 'learning' | 'solid';

export interface ConceptCell {
  key: string;
  label: string;
}

export interface ConceptGroup {
  id: string;
  titleCa: string;
  cells: ConceptCell[];
}

const INVERSIONS = ['fonamental', '1a inversió', '2a inversió'];
const DEGREES = ['', 'ii', 'iii', 'IV', 'V', 'vi'];
const HARMONY_MODES = MAJOR_MODES.filter((s) => s.id !== 'locrian');
const DONORS = ['aeolian', 'dorian', 'phrygian', 'mixolydian', 'lydian'];
const nameOf = (id: string) => SCALES.find((s) => s.id === id)!.nameCa;

/** Every concept the feed can train, grouped by the six weak areas in priority order. */
export const CONCEPT_GROUPS: ConceptGroup[] = [
  { id: 'modes', titleCa: 'Modes', cells: MAJOR_MODES.map((s) => ({ key: `mode:${s.id}`, label: s.nameCa })) },
  { id: 'spread', titleCa: 'Tríades obertes', cells: INVERSIONS.map((l, i) => ({ key: `spread:${i}`, label: l })) },
  {
    id: 'chords', titleCa: 'Acords més enllà de la 7a',
    cells: CHORDS.filter((c) => c.tier > 0).map((c) => ({ key: `chord:${c.id}`, label: c.suffix })),
  },
  {
    id: 'scales', titleCa: 'Menor harmònica, menor melòdica i els seus modes',
    cells: SCALES.filter((s) => s.family !== 'major').map((s) => ({ key: `mode:${s.id}`, label: s.nameCa })),
  },
  {
    id: 'meters', titleCa: 'Compassos',
    cells: ['3/4', '4/4', '5/4', '6/8', '5/8', '7/8', '9/8', '12/8'].map((m) => ({ key: `meter:${m}`, label: m })),
  },
  {
    id: 'harmony', titleCa: 'Harmonia funcional i modal',
    cells: [
      ...HARMONY_MODES.map((s) => ({ key: `roman:${s.id}`, label: `xifres: ${s.nameCa}` })),
      ...DONORS.map((id) => ({ key: `borrow:${id}`, label: `préstec: ${nameOf(id)}` })),
      ...[1, 2, 3, 4, 5].map((d) => ({ key: `secdom:${d}`, label: `V7/${DEGREES[d]}` })),
    ],
  },
];

/**
 * Mastery of each concept. Solid = the last three answers were right and no repeat is pending.
 * A single miss drops a concept back to learning, so the map shows what needs work now, not lifetime totals.
 */
export function masteryMap(attempts: Attempt[], reviews: ReviewItem[]): Record<string, Mastery> {
  const history: Record<string, boolean[]> = {};
  for (const a of [...attempts].sort((x, y) => x.at - y.at)) {
    if (a.puzzle) (history[a.puzzle.conceptKey] ??= []).push(a.puzzle.correct);
  }
  const pending = new Set(reviews.map((r) => r.conceptKey));
  const out: Record<string, Mastery> = {};
  for (const g of CONCEPT_GROUPS) for (const c of g.cells) {
    const h = history[c.key] ?? [];
    out[c.key] = !h.length ? 'new' : h.length >= 3 && h.slice(-3).every(Boolean) && !pending.has(c.key) ? 'solid' : 'learning';
  }
  return out;
}

export const countMastery = (map: Record<string, Mastery>, cells: ConceptCell[]): Record<Mastery, number> => {
  const n = { new: 0, learning: 0, solid: 0 };
  for (const c of cells) n[map[c.key]]++;
  return n;
};

/** The seven local dates of the week containing `now`, Monday first. */
export function weekDates(now: Date): string[] {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => localDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
}

/** Solved puzzles per local day, from the attempt log. Attempts sync between devices, so these counts do too. */
export function solvedByDay(attempts: Attempt[]): DayStats[] {
  const n = new Map<string, number>();
  for (const a of attempts) {
    if (!a.puzzle?.correct) continue;
    const d = localDate(new Date(a.at));
    n.set(d, (n.get(d) ?? 0) + 1);
  }
  return [...n].map(([date, solved]) => ({ date, solved, opens: 0, opensWithSolve: 0 }));
}

/** Which days of this week had at least one puzzle solved. A missed day costs nothing: there is no streak to lose. */
export function weekRhythm(days: DayStats[], now: Date): { date: string; active: boolean; future: boolean; solved: number }[] {
  const solved = new Map(days.filter((d) => d.solved > 0).map((d) => [d.date, d.solved]));
  const today = localDate(now);
  return weekDates(now).map((date) => ({ date, active: solved.has(date), future: date > today, solved: solved.get(date) ?? 0 }));
}

export interface TempoSeries {
  materialId: string;
  title: string;
  /** Tempo of each rated run, oldest first. */
  points: { at: number; bpm: number; result: 'clean' | 'sloppy' | 'failed' }[];
  /** Highest tempo played clean, or null if none yet. */
  best: number | null;
}

/** Tempo history per exercise, most recently practised first. */
export function tempoHistory(attempts: Attempt[]): TempoSeries[] {
  const byId = new Map<string, TempoSeries>();
  for (const a of [...attempts].sort((x, y) => x.at - y.at)) {
    if (!a.block) continue;
    const s = byId.get(a.block.materialId) ?? { materialId: a.block.materialId, title: a.block.materialId, points: [], best: null };
    if (a.block.title) s.title = a.block.title;
    s.points.push({ at: a.at, bpm: a.block.bpm, result: a.block.result });
    if (a.block.result === 'clean') s.best = Math.max(s.best ?? 0, a.block.bpm);
    byId.set(a.block.materialId, s);
  }
  return [...byId.values()].sort((x, y) => y.points[y.points.length - 1].at - x.points[x.points.length - 1].at);
}
