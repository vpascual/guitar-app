import type { Repository } from './repository';
import { IndexedDbRepository } from './idb';
import { MemoryRepository } from './memory';
import { SyncEngine, SyncedRepository, KeyStore } from '../sync/engine';
import { SUPABASE_URL, SUPABASE_KEY, SYNC_TABLE } from '../sync/config';

const local: Repository = typeof indexedDB === 'undefined' ? new MemoryRepository() : new IndexedDbRepository();

/** localStorage when available; private windows can refuse it, and then sync is simply off for the visit. */
function keyStore(): KeyStore {
  const mem = new Map<string, string>();
  const fallback: KeyStore = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
  try {
    localStorage.setItem('sync:probe', '1');
    localStorage.removeItem('sync:probe');
    return localStorage;
  } catch {
    return fallback;
  }
}

/** Background sync with Supabase. Does nothing until a sync key is set in the options. */
export const sync = new SyncEngine(local, keyStore(), { url: SUPABASE_URL, apiKey: SUPABASE_KEY, table: SYNC_TABLE });

/** The app's single repository: local first, with writes queued for sync. */
export const repo: Repository = new SyncedRepository(local, sync);
