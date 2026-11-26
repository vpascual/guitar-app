// Storage boundary. The UI talks to this interface only, so IndexedDB can be swapped for a remote database later.
import type { SkillArea } from '../puzzles/types';
import { SKILLS } from '../engine/elo';
import type { FeedState } from '../engine/feed';
import type { Session, MaterialState } from '../engine/session';

export interface Attempt {
  id?: number;
  /** Globally unique id, so the same attempt is never stored twice after syncing between devices. */
  uid?: string;
  at: number;
  kind: 'puzzle' | 'block';
  puzzle?: {
    generatorId: string; seed: number; level: number; conceptKey: string; skill: SkillArea;
    correct: boolean; ms: number; usedHint: boolean; ratingBefore: number; ratingAfter: number;
    /** True when the answer was "I don't know" rather than a wrong guess. */
    skipped?: boolean;
  };
  block?: {
    sessionId: string; blockId: string; materialId: string;
    result: 'clean' | 'sloppy' | 'failed'; bpm: number;
    /** Readable name of the exercise, for the tempo history. Absent on older records. */
    title?: string;
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
  /** Skills that existed when the settings were last saved; a skill added later is switched on once. */
  knownSkills?: SkillArea[];
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

export const DEFAULT_SETTINGS: Settings = { audio: false, skills: [...SKILLS], seenTerms: [], knownSkills: [...SKILLS] };

/** Switch on skills that were added to the app after these settings were saved. */
export function migrateSettings(s: Settings): Settings {
  const known = s.knownSkills ?? ['modes', 'chords', 'harmony', 'rhythm'];
  const added = SKILLS.filter((k) => !known.includes(k));
  return { ...s, skills: [...s.skills, ...added.filter((k) => !s.skills.includes(k))], knownSkills: [...SKILLS] };
}

/** Local calendar date as YYYY-MM-DD. */
export function localDate(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
