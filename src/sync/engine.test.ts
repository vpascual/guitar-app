import { describe, it, expect } from 'vitest';
import { SyncEngine, SyncedRepository, KeyStore, generateKey, normalizeKey, formatKey } from './engine';
import { MemoryRepository } from '../storage/memory';
import { initialFeedState } from '../engine/feed';
import type { Attempt } from '../storage/repository';

const store = (): KeyStore => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

/** In-memory stand-in for the Supabase table, enforcing the same rule as the row-level security policy. */
function fakeServer() {
  const rows = new Map<string, { owner: string; kind: string; id: string; data: unknown; updated_at: string }>();
  let clock = Date.parse('2026-01-01T00:00:00Z');
  let online = true;
  let calls = 0;
  const hash = async (key: string) =>
    [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const fetchFn = (async (url: string, init?: RequestInit) => {
    calls++;
    if (!online) throw new TypeError('offline');
    const key = (init?.headers as Record<string, string>)['x-sync-key'];
    const owner = key.length >= 20 ? await hash(key) : null;
    if (init?.method === 'POST') {
      for (const r of JSON.parse(init.body as string) as { owner: string; kind: string; id: string; data: unknown }[]) {
        if (r.owner !== owner) return new Response('rls', { status: 403 });
        clock += 1000;
        rows.set(`${r.owner}:${r.kind}:${r.id}`, { ...r, updated_at: new Date(clock).toISOString() });
      }
      return new Response(null, { status: 201 });
    }
    const after = decodeURIComponent(/updated_at=gt\.([^&]+)/.exec(url)![1]);
    const out = [...rows.values()].filter((r) => r.owner === owner && r.updated_at > after).sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    return new Response(JSON.stringify(out.map(({ kind, id, data, updated_at }) => ({ kind, id, data, updated_at }))), { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchFn, rows, setOnline: (v: boolean) => (online = v), calls: () => calls };
}

const cfg = { url: 'https://example.supabase.co', apiKey: 'pk', table: 'sync_docs' };
function device(server: ReturnType<typeof fakeServer>) {
  const inner = new MemoryRepository();
  const engine = new SyncEngine(inner, store(), cfg, server.fetchFn);
  return { inner, engine, repo: new SyncedRepository(inner, engine) };
}
const attempt = (key: string, correct: boolean, at: number): Attempt => ({
  at, kind: 'puzzle',
  puzzle: { generatorId: 'g', seed: at, level: 0, conceptKey: key, skill: 'modes', correct, ms: 1, usedHint: false, ratingBefore: 1000, ratingAfter: 1010 },
});

describe('sync keys', () => {
  it('generates long random keys and reads them back however they are typed', () => {
    const k = generateKey();
    expect(k).toMatch(/^[A-Z2-9]{28}$/);
    expect(generateKey()).not.toBe(k);
    expect(normalizeKey(formatKey(k).toLowerCase() + ' ')).toBe(k);
  });
});

describe('sync engine', () => {
  it('does nothing and makes no request until a key is set', async () => {
    const server = fakeServer();
    const d = device(server);
    await d.repo.addAttempt(attempt('mode:dorian', true, 1));
    expect(await d.engine.sync()).toBe(false);
    expect(server.calls()).toBe(0);
    expect(d.engine.pending).toBe(0);
  });

  it('carries puzzle results from the phone to the desktop and practice results back', async () => {
    const server = fakeServer();
    const phone = device(server);
    const desktop = device(server);
    // The phone already has history before sync is turned on.
    await phone.repo.addAttempt(attempt('mode:lydian', false, 1));
    const key = await phone.engine.enable();
    await phone.repo.addAttempt(attempt('mode:lydian', false, 2));
    await phone.repo.saveFeedState({ ...initialFeedState(), served: 2 });
    await phone.engine.sync();
    expect(phone.engine.pending).toBe(0);

    await desktop.engine.enable(formatKey(key));
    expect(await desktop.engine.sync()).toBe(true);
    expect((await desktop.inner.listAttempts()).map((a) => a.at).sort()).toEqual([1, 2]);
    expect((await desktop.inner.getFeedState())?.served).toBe(2);

    await desktop.repo.saveMaterials({ 'technique:lydian:thirds': { bpm: 64, target: 100, cleanStreak: 0, best: 60 } });
    await desktop.engine.sync();
    expect(await phone.engine.sync()).toBe(true);
    expect((await phone.inner.getMaterials())['technique:lydian:thirds'].bpm).toBe(64);

    // Syncing again changes nothing and duplicates nothing.
    expect(await phone.engine.sync()).toBe(false);
    expect(await desktop.engine.sync()).toBe(false);
    expect(await phone.inner.listAttempts()).toHaveLength(2);
    expect(await desktop.inner.listAttempts()).toHaveLength(2);
  });

  it('keeps changes queued while offline and sends them later', async () => {
    const server = fakeServer();
    const phone = device(server);
    await phone.engine.enable();
    server.setOnline(false);
    await phone.repo.addAttempt(attempt('mode:dorian', true, 5));
    expect(await phone.engine.sync()).toBe(false);
    expect(phone.engine.pending).toBe(1);
    server.setOnline(true);
    await phone.engine.sync();
    expect(phone.engine.pending).toBe(0);
    expect(server.rows.size).toBe(1);
  });

  it('a local change that has not been uploaded wins over an older remote copy', async () => {
    const server = fakeServer();
    const a = device(server);
    const b = device(server);
    const key = await a.engine.enable();
    await b.engine.enable(key);
    await a.repo.saveFeedState({ ...initialFeedState(), served: 10 });
    await a.engine.sync();
    await b.repo.saveFeedState({ ...initialFeedState(), served: 3 });
    await b.engine.sync();
    expect((await b.inner.getFeedState())?.served).toBe(3);
    await a.engine.sync();
    expect((await a.inner.getFeedState())?.served).toBe(3);
  });

  it('another key sees none of the data', async () => {
    const server = fakeServer();
    const mine = device(server);
    await mine.engine.enable();
    await mine.repo.addAttempt(attempt('mode:dorian', true, 1));
    await mine.engine.sync();
    const stranger = device(server);
    await stranger.engine.enable();
    expect(await stranger.engine.sync()).toBe(false);
    expect(await stranger.inner.listAttempts()).toHaveLength(0);
  });
});
