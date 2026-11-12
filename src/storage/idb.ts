import type { Repository, Attempt, DayStats, Settings } from './repository';
import type { FeedState } from '../engine/feed';
import type { Session, MaterialState } from '../engine/session';

const DB_NAME = 'guitar-app';
const DB_VERSION = 1;
const STORES = ['kv', 'attempts', 'days', 'sessions'] as const;
type Store = (typeof STORES)[number];

const req = <T,>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

/** IndexedDB-backed repository. All data stays on the device. */
export class IndexedDbRepository implements Repository {
  private db: Promise<IDBDatabase>;

  constructor() {
    this.db = new Promise((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, DB_VERSION);
      open.onupgradeneeded = () => {
        const db = open.result;
        db.createObjectStore('kv');
        db.createObjectStore('attempts', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('days', { keyPath: 'date' });
        db.createObjectStore('sessions', { keyPath: 'id' });
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
  }

  private async store(name: Store, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await this.db).transaction(name, mode).objectStore(name);
  }
  private async get<T>(name: Store, key: string): Promise<T | undefined> {
    return req((await this.store(name, 'readonly')).get(key)) as Promise<T | undefined>;
  }
  private async all<T>(name: Store): Promise<T[]> {
    return req((await this.store(name, 'readonly')).getAll()) as Promise<T[]>;
  }
  private async put(name: Store, value: unknown, key?: string): Promise<void> {
    await req((await this.store(name, 'readwrite')).put(value, key));
  }

  getFeedState() { return this.get<FeedState>('kv', 'feed'); }
  saveFeedState(s: FeedState) { return this.put('kv', s, 'feed'); }
  getSettings() { return this.get<Settings>('kv', 'settings'); }
  saveSettings(s: Settings) { return this.put('kv', s, 'settings'); }
  addAttempt(a: Attempt) { return this.put('attempts', a); }
  listAttempts() { return this.all<Attempt>('attempts'); }
  getDay(date: string) { return this.get<DayStats>('days', date); }
  saveDay(d: DayStats) { return this.put('days', d); }
  listDays() { return this.all<DayStats>('days'); }
  saveSession(s: Session) { return this.put('sessions', s); }
  listSessions() { return this.all<Session>('sessions'); }
  async getMaterials() { return (await this.get<Record<string, MaterialState>>('kv', 'materials')) ?? {}; }
  saveMaterials(m: Record<string, MaterialState>) { return this.put('kv', m, 'materials'); }

  async exportAll() {
    const kvStore = await this.store('kv', 'readonly');
    const [keys, values] = await Promise.all([req(kvStore.getAllKeys()), req(kvStore.getAll())]);
    return {
      kv: Object.fromEntries(keys.map((k, i) => [String(k), values[i]])),
      attempts: await this.all('attempts'), days: await this.all('days'), sessions: await this.all('sessions'),
    };
  }

  async importAll(dump: Record<string, unknown>) {
    const db = await this.db;
    const tx = db.transaction([...STORES], 'readwrite');
    for (const s of STORES) tx.objectStore(s).clear();
    for (const [k, v] of Object.entries((dump.kv as Record<string, unknown>) ?? {})) tx.objectStore('kv').put(v, k);
    for (const s of ['attempts', 'days', 'sessions'] as const) {
      for (const row of (dump[s] as unknown[]) ?? []) tx.objectStore(s).put(row);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
