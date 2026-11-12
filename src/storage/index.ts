import type { Repository } from './repository';
import { IndexedDbRepository } from './idb';
import { MemoryRepository } from './memory';

/** The app's single repository. Swap the implementation here to move to a remote database. */
export const repo: Repository = typeof indexedDB === 'undefined' ? new MemoryRepository() : new IndexedDbRepository();
