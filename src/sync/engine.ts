// Background sync between devices. IndexedDB stays the source the UI reads; this only copies documents
// to and from Supabase when a sync key is set and the network is there. Every failure is silent and retried later.
import type { Repository, Attempt } from '../storage/repository';
import type { FeedState } from '../engine/feed';
import type { Session, MaterialState } from '../engine/session';

export type DocKind = 'attempt' | 'session' | 'kv';
export interface SyncDoc {
  kind: DocKind;
  id: string;
  data: unknown;
}
interface RemoteDoc extends SyncDoc {
  updated_at: string;
}

/** Minimal key-value storage (localStorage in the browser, a Map in tests). */
export interface KeyStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export interface SyncConfig {
  url: string;
  apiKey: string;
  table: string;
}

const KEY = 'sync:key';
const OUTBOX = 'sync:outbox';
const CURSOR = 'sync:cursor';
const LAST = 'sync:last';
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

/** Normalize a typed or pasted key: upper case, separators removed. */
export const normalizeKey = (raw: string): string => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Group a key for reading: "ABCD-EFGH-…". */
export const formatKey = (key: string): string => key.replace(/(.{4})(?=.)/g, '$1-');

/** A new random sync key: 28 characters, about 137 bits. */
export function generateKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(28));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

async function sha256Hex(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Structural equality; a document this device uploaded itself comes back on the next pull and must not count as a change. */
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export class SyncEngine {
  private pushing: Promise<void> | null = null;

  constructor(
    private inner: Repository,
    private store: KeyStore,
    private config: SyncConfig,
    private fetchFn: typeof fetch = (...a) => fetch(...a),
  ) {}

  get configured(): boolean {
    return !!this.config.url && !!this.config.apiKey;
  }
  get key(): string | null {
    return this.store.getItem(KEY);
  }
  get enabled(): boolean {
    return this.configured && !!this.key;
  }
  /** Time of the last successful sync (epoch ms), or null. */
  get lastSync(): number | null {
    const v = this.store.getItem(LAST);
    return v ? Number(v) : null;
  }
  get pending(): number {
    return Object.keys(this.outbox()).length;
  }

  /** Turn sync on with a new key, or with the key from another device. Returns the key in use. */
  async enable(existing?: string): Promise<string> {
    const key = existing ? normalizeKey(existing) : generateKey();
    if (key.length < 20) throw new Error('short-key');
    this.store.setItem(KEY, key);
    this.store.removeItem(CURSOR);
    // Queue everything this device already has, so the first sync uploads it.
    const [attempts, sessions, feed, materials] = await Promise.all([
      this.inner.listAttempts(), this.inner.listSessions(), this.inner.getFeedState(), this.inner.getMaterials(),
    ]);
    for (const a of attempts) if (a.uid) this.queue({ kind: 'attempt', id: a.uid, data: a });
    for (const s of sessions) this.queue({ kind: 'session', id: s.id, data: s });
    if (feed && !existing) this.queue({ kind: 'kv', id: 'feed', data: feed });
    if (Object.keys(materials).length && !existing) this.queue({ kind: 'kv', id: 'materials', data: materials });
    return key;
  }

  disable(): void {
    for (const k of [KEY, OUTBOX, CURSOR, LAST]) this.store.removeItem(k);
  }

  private outbox(): Record<string, SyncDoc> {
    try {
      return JSON.parse(this.store.getItem(OUTBOX) ?? '{}') as Record<string, SyncDoc>;
    } catch {
      return {};
    }
  }

  /** Remember a local change to upload. A newer change to the same document replaces the older one. */
  queue(doc: SyncDoc): void {
    if (!this.enabled) return;
    const box = this.outbox();
    box[`${doc.kind}:${doc.id}`] = doc;
    this.store.setItem(OUTBOX, JSON.stringify(box));
  }

  private headers(): Record<string, string> {
    return {
      apikey: this.config.apiKey,
      Authorization: `Bearer ${this.config.apiKey}`,
      'x-sync-key': this.key!,
      'Content-Type': 'application/json',
    };
  }

  private endpoint(query: string): string {
    return `${this.config.url}/rest/v1/${this.config.table}?${query}`;
  }

  /** Upload queued changes. Documents stay queued if the request fails. */
  async push(keepalive = false): Promise<void> {
    if (!this.enabled) return;
    if (this.pushing) return this.pushing;
    this.pushing = (async () => {
      const box = this.outbox();
      const keys = Object.keys(box);
      if (!keys.length) return;
      const owner = await sha256Hex(this.key!);
      const rows = keys.map((k) => ({ owner, kind: box[k].kind, id: box[k].id, data: box[k].data }));
      const res = await this.fetchFn(this.endpoint('on_conflict=owner,kind,id'), {
        method: 'POST',
        headers: { ...this.headers(), Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
        keepalive,
      });
      if (!res.ok) throw new Error(`push ${res.status}`);
      // Drop only what was sent and has not changed since.
      const now = this.outbox();
      for (const k of keys) if (JSON.stringify(now[k]) === JSON.stringify(box[k])) delete now[k];
      this.store.setItem(OUTBOX, JSON.stringify(now));
    })().finally(() => {
      this.pushing = null;
    });
    return this.pushing;
  }

  /** Download changes made on other devices and merge them. Returns true if local data changed. */
  async pull(): Promise<boolean> {
    if (!this.enabled) return false;
    let cursor = this.store.getItem(CURSOR) ?? '1970-01-01T00:00:00Z';
    let changed = false;
    const known = new Set((await this.inner.listAttempts()).map((a) => a.uid));
    for (;;) {
      const q = `select=kind,id,data,updated_at&updated_at=gt.${encodeURIComponent(cursor)}&order=updated_at.asc&limit=500`;
      const res = await this.fetchFn(this.endpoint(q), { headers: this.headers() });
      if (!res.ok) throw new Error(`pull ${res.status}`);
      const docs = (await res.json()) as RemoteDoc[];
      const box = this.outbox();
      for (const d of docs) {
        cursor = d.updated_at;
        // A local change that has not been uploaded yet wins over the remote copy.
        if (box[`${d.kind}:${d.id}`]) continue;
        if (d.kind === 'attempt') {
          if (known.has(d.id)) continue;
          known.add(d.id);
          const { id: _local, ...rest } = d.data as Attempt;
          void _local;
          await this.inner.addAttempt({ ...rest, uid: d.id });
        } else if (d.kind === 'session') {
          const mine = (await this.inner.listSessions()).find((x) => x.id === d.id);
          if (same(mine, d.data)) continue;
          await this.inner.saveSession(d.data as Session);
        } else if (d.id === 'feed') {
          if (same(await this.inner.getFeedState(), d.data)) continue;
          await this.inner.saveFeedState(d.data as FeedState);
        } else if (d.id === 'materials') {
          if (same(await this.inner.getMaterials(), d.data)) continue;
          await this.inner.saveMaterials(d.data as Record<string, MaterialState>);
        } else continue;
        changed = true;
      }
      this.store.setItem(CURSOR, cursor);
      if (docs.length < 500) break;
    }
    return changed;
  }

  /** Pull, then push. Never throws: sync problems must not break the app. Returns true if local data changed. */
  async sync(): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const changed = await this.pull();
      await this.push();
      this.store.setItem(LAST, String(Date.now()));
      return changed;
    } catch {
      return false;
    }
  }

  /** Like sync(), but gives up waiting after `ms` so a slow network never holds a screen back. */
  syncWithin(ms: number): Promise<boolean> {
    return Promise.race([this.sync(), new Promise<boolean>((r) => setTimeout(() => r(false), ms))]);
  }
}

/** Repository that records every write for upload. Reads go straight to the local store. */
export class SyncedRepository implements Repository {
  constructor(private inner: Repository, private engine: SyncEngine) {}

  getFeedState() { return this.inner.getFeedState(); }
  getSettings() { return this.inner.getSettings(); }
  saveSettings(s: Parameters<Repository['saveSettings']>[0]) { return this.inner.saveSettings(s); }
  listAttempts() { return this.inner.listAttempts(); }
  getDay(d: string) { return this.inner.getDay(d); }
  saveDay(d: Parameters<Repository['saveDay']>[0]) { return this.inner.saveDay(d); }
  listDays() { return this.inner.listDays(); }
  listSessions() { return this.inner.listSessions(); }
  getMaterials() { return this.inner.getMaterials(); }
  exportAll() { return this.inner.exportAll(); }
  importAll(dump: Record<string, unknown>) { return this.inner.importAll(dump); }

  async saveFeedState(s: FeedState) {
    await this.inner.saveFeedState(s);
    this.engine.queue({ kind: 'kv', id: 'feed', data: s });
  }
  async addAttempt(a: Attempt) {
    const withUid = { ...a, uid: a.uid ?? crypto.randomUUID() };
    await this.inner.addAttempt(withUid);
    this.engine.queue({ kind: 'attempt', id: withUid.uid, data: withUid });
  }
  async saveSession(s: Session) {
    await this.inner.saveSession(s);
    this.engine.queue({ kind: 'session', id: s.id, data: s });
  }
  async saveMaterials(m: Record<string, MaterialState>) {
    await this.inner.saveMaterials(m);
    this.engine.queue({ kind: 'kv', id: 'materials', data: m });
  }
}
