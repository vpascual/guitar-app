import type { Repository, Attempt, DayStats, Settings } from './repository';
import type { FeedState } from '../engine/feed';
import type { Session, MaterialState } from '../engine/session';

/** In-memory repository for tests and as a fallback when IndexedDB is unavailable. */
export class MemoryRepository implements Repository {
  private kv = new Map<string, unknown>();
  private attempts: Attempt[] = [];
  private days = new Map<string, DayStats>();
  private sessions = new Map<string, Session>();

  async getFeedState() { return this.kv.get('feed') as FeedState | undefined; }
  async saveFeedState(s: FeedState) { this.kv.set('feed', s); }
  async getSettings() { return this.kv.get('settings') as Settings | undefined; }
  async saveSettings(s: Settings) { this.kv.set('settings', s); }
  async addAttempt(a: Attempt) { this.attempts.push({ ...a, id: this.attempts.length + 1 }); }
  async listAttempts() { return [...this.attempts]; }
  async getDay(date: string) { return this.days.get(date); }
  async saveDay(d: DayStats) { this.days.set(d.date, d); }
  async listDays() { return [...this.days.values()]; }
  async saveSession(s: Session) { this.sessions.set(s.id, s); }
  async listSessions() { return [...this.sessions.values()]; }
  async getMaterials() { return (this.kv.get('materials') as Record<string, MaterialState>) ?? {}; }
  async saveMaterials(m: Record<string, MaterialState>) { this.kv.set('materials', m); }
  async exportAll() {
    return {
      kv: Object.fromEntries(this.kv), attempts: this.attempts,
      days: [...this.days.values()], sessions: [...this.sessions.values()],
    };
  }
  async importAll(dump: Record<string, unknown>) {
    this.kv = new Map(Object.entries((dump.kv as Record<string, unknown>) ?? {}));
    this.attempts = (dump.attempts as Attempt[]) ?? [];
    this.days = new Map(((dump.days as DayStats[]) ?? []).map((d) => [d.date, d]));
    this.sessions = new Map(((dump.sessions as Session[]) ?? []).map((s) => [s.id, s]));
  }
}
