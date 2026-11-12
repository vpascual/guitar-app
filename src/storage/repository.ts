// Storage boundary. The UI talks to this interface only, so IndexedDB can be swapped for a remote database later.
import type { SkillArea } from '../puzzles/types';
import type { FeedState } from '../engine/feed';
import type { Session, MaterialState } from '../engine/session';

export interface Attempt {
  id?: number;
  at: number;
  kind: 'puzzle' | 'block';
  puzzle?: {
    generatorId: string; seed: number; level: number; conceptKey: string; skill: SkillArea;
    correct: boolean; ms: number; usedHint: boolean; ratingBefore: number; ratingAfter: number;
  };
  block?: {
    sessionId: string; blockId: string; materialId: string;
    result: 'clean' | 'sloppy' | 'failed'; bpm: number;
  };
}

/** Per-day usage counters; this is the success metric for the puzzle feed. */
export interface DayStats {
  date: string;
  opens: number;
  /** Opens during which at least one puzzle was solved. */
  opensWithSolve: number;
  solved: number;
}

export interface Settings {
  audio: boolean;
  skills: SkillArea[];
  /** Glossary terms already explained once. */
  seenTerms: string[];
}

export interface Repository {
  getFeedState(): Promise<FeedState | undefined>;
  saveFeedState(s: FeedState): Promise<void>;
  getSettings(): Promise<Settings | undefined>;
  saveSettings(s: Settings): Promise<void>;
  addAttempt(a: Attempt): Promise<void>;
  listAttempts(): Promise<Attempt[]>;
  getDay(date: string): Promise<DayStats | undefined>;
  saveDay(d: DayStats): Promise<void>;
  listDays(): Promise<DayStats[]>;
  saveSession(s: Session): Promise<void>;
  listSessions(): Promise<Session[]>;
  getMaterials(): Promise<Record<string, MaterialState>>;
  saveMaterials(m: Record<string, MaterialState>): Promise<void>;
  exportAll(): Promise<Record<string, unknown>>;
  importAll(dump: Record<string, unknown>): Promise<void>;
}

export const DEFAULT_SETTINGS: Settings = { audio: false, skills: ['modes', 'chords', 'harmony', 'rhythm'], seenTerms: [] };

/** Local calendar date as YYYY-MM-DD. */
export function localDate(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
