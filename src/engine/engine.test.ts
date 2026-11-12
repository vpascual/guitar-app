import { describe, it, expect } from 'vitest';
import { expectedScore, updateRating, levelFor } from './elo';
import { initialFeedState, nextPuzzle, recordAnswer, FeedState } from './feed';
import { buildSession, applyResult, renderTab, chooseProgression, progressionChords, chordFocusChords, FOCI, BLOCK_MINUTES, BuildContext } from './session';
import { CHORD_FOCI } from '../content/progressions';
import { PROGRESSIONS } from '../content/progressions';
import { hasRef } from '../content/refs';
import { makeRng } from '../puzzles/util';
import { MemoryRepository } from '../storage/memory';
import { getScale } from '../theory/scale';
import { parseNote } from '../theory/note';
import { chordFitsScale } from '../theory/chord';
import { voicingText } from '../theory/guitar';

const opts = { audio: false, skills: ['modes', 'chords', 'harmony', 'rhythm'] as const };
const feedOpts = { audio: false, skills: [...opts.skills] };

describe('elo', () => {
  it('moves up on success and down on failure, more for surprises', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
    expect(updateRating(1000, 1000, 1, 0)).toBe(1016);
    expect(updateRating(1000, 1000, 0, 0)).toBe(984);
    expect(updateRating(1000, 1300, 1, 0)).toBeGreaterThan(updateRating(1000, 900, 1, 0));
    expect(updateRating(1000, 1000, 1, 50)).toBe(1008);
    expect([levelFor(900), levelFor(1050), levelFor(1300)]).toEqual([0, 1, 2]);
  });
});

describe('feed', () => {
  it('never serves audio puzzles unless the filter is on', () => {
    const rng = makeRng(5);
    const s = initialFeedState();
    for (let i = 0; i < 300; i++) {
      const { puzzle } = nextPuzzle(s, feedOpts, 0, rng.next);
      expect(puzzle.visual?.type).not.toBe('listen');
    }
  });
  it('brings a failed concept back after three puzzles, in a different puzzle', () => {
    const rng = makeRng(9);
    let s: FeedState = initialFeedState();
    const first = nextPuzzle(s, feedOpts, 0, rng.next);
    s = recordAnswer(s, first, false, false, 0).state;
    expect(s.reviews).toHaveLength(1);
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      const served = nextPuzzle(s, feedOpts, 0, rng.next);
      expect(served.review).toBeUndefined();
      seen.push(served.puzzle.id);
      // Answer correctly without touching the queued concept.
      s = { ...recordAnswer(s, served, true, false, 0).state, reviews: s.reviews };
    }
    const back = nextPuzzle(s, feedOpts, 0, rng.next);
    expect(back.review).toBeDefined();
    expect(back.puzzle.conceptKey).toBe(first.puzzle.conceptKey);
    expect(back.puzzle.generatorId).toBe(first.puzzle.generatorId);
    expect(back.puzzle.seed).not.toBe(first.puzzle.seed);
    // Passing the review moves it to the next step instead of dropping it.
    const after = recordAnswer(s, back, true, false, 0).state;
    expect(after.reviews[0].stage).toBe(1);
    expect(after.reviews[0].dueServed).toBe(after.served + 10);
  });
  it('never serves two reviews in a row', () => {
    const rng = makeRng(4);
    let s: FeedState = initialFeedState();
    let prev = false;
    for (let i = 0; i < 200; i++) {
      const served = nextPuzzle(s, feedOpts, 0, rng.next);
      expect(prev && !!served.review).toBe(false);
      prev = !!served.review;
      s = recordAnswer(s, served, false, false, 0).state;
    }
    expect(s.reviews.length).toBeGreaterThan(5);
  });
  it('favours the weakest skill', () => {
    const rng = makeRng(2);
    const s = { ...initialFeedState(), ratings: { modes: 800, chords: 1200, harmony: 1200, rhythm: 1200 } };
    let modes = 0;
    for (let i = 0; i < 400; i++) if (nextPuzzle(s, feedOpts, 0, rng.next).puzzle.skill === 'modes') modes++;
    expect(modes).toBeGreaterThan(260);
  });
});

const ctx = (over: Partial<BuildContext> = {}): BuildContext => ({
  conceptStats: {}, history: [], materials: {}, now: 1, rand: makeRng(1).next, ...over,
});

describe('practice sessions', () => {
  it('block minutes add up and integration never disappears', () => {
    for (const m of [30, 45, 60] as const) {
      const s = buildSession(m, ctx());
      expect(s.blocks.map((b) => b.phase)).toEqual(['warmup', 'technique', 'chords', 'integration']);
      expect(s.blocks.reduce((a, b) => a + b.minutes, 0)).toBe(m);
      expect(BLOCK_MINUTES[m].integration).toBeGreaterThanOrEqual(5);
      for (const b of s.blocks) {
        expect(b.goal.length).toBeGreaterThan(10);
        for (const c of b.bookConcepts) expect(hasRef(c), c).toBe(true);
        for (const t of b.tabs) expect(t.tip.length).toBeGreaterThan(10);
      }
      expect(s.blocks[3].chordTones.length).toBeGreaterThan(0);
      expect(s.blocks[2].diagrams.length).toBeGreaterThan(0);
    }
  });
  it('focuses on the mode with the worst puzzle record and avoids the last focus', () => {
    const weak = buildSession(30, ctx({ conceptStats: { 'mode:lydian': { wrong: 9, total: 10 }, 'mode:dorian': { wrong: 0, total: 10 } } }));
    expect(weak.focus.id).toBe('lydian');
    const meter = buildSession(30, ctx({ conceptStats: { 'meter:7/8': { wrong: 19, total: 20 } } }));
    expect(meter.focus.id).toBe('meter-7/8');
    const next = buildSession(30, ctx({
      conceptStats: { 'mode:lydian': { wrong: 9, total: 10 } },
      history: [{ focusId: 'lydian', progressionId: 'lyd-I-II' }],
    }));
    expect(next.focus.id).not.toBe('lydian');
  });
  it('does not repeat a progression until the library for that mode is used up', () => {
    const a = chooseProgression(['dorian'], []);
    const b = chooseProgression(['dorian'], [{ progressionId: a.id }]);
    const c = chooseProgression(['dorian'], [{ progressionId: a.id }, { progressionId: b.id }]);
    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
    const d = chooseProgression(['dorian'], [a, b, c].map((p) => ({ progressionId: p.id })));
    expect(d.id).toBe(a.id);
  });
  it('every library progression is diatonic to its mode, has book refs, and is not I-IV-V or ii-V-I', () => {
    const modes = new Set(PROGRESSIONS.map((p) => p.scaleId));
    for (const m of ['dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian']) {
      expect(modes.has(m)).toBe(true);
      expect(PROGRESSIONS.filter((p) => p.scaleId === m).length).toBeGreaterThanOrEqual(2);
    }
    for (const p of PROGRESSIONS) {
      expect(hasRef(p.bookConcept)).toBe(true);
      expect(p.scaleId).not.toBe('ionian');
      for (const c of progressionChords(p)) expect(chordFitsScale(c, parseNote(p.tonic), getScale(p.scaleId))).toBe(true);
      expect(p.whyCa.length).toBeGreaterThan(30);
    }
  });
  it('builds a complete session for every focus: modes, chord types and meters', () => {
    expect(FOCI.map((f) => f.type)).toEqual(expect.arrayContaining(['mode', 'chord-type', 'meter']));
    for (const f of FOCI) for (const m of [30, 60] as const) {
      const s = buildSession(m, ctx(), f);
      expect(s.focus.id).toBe(f.id);
      expect(s.blocks).toHaveLength(4);
      expect(s.blocks.reduce((a, b) => a + b.minutes, 0)).toBe(m);
      expect(s.blocks[1].tabs.length, f.id).toBeGreaterThan(0);
      expect(s.blocks[2].diagrams.length, f.id).toBeGreaterThan(0);
      expect(s.blocks[3].chordTones.length, f.id).toBeGreaterThan(0);
      for (const b of s.blocks) {
        for (const c of b.bookConcepts) expect(hasRef(c), c).toBe(true);
        // Only odd-meter technique may lack a book reference: the book does not cover it.
        if (!(f.type === 'meter' && b.phase === 'technique')) expect(b.bookConcepts.length, `${f.id} ${b.phase}`).toBeGreaterThan(0);
        for (const t of b.tabs) {
          expect(t.lines.some((l) => l.startsWith('e|')) && t.lines.some((l) => l.startsWith('E|'))).toBe(true);
          expect(t.tip.length).toBeGreaterThan(10);
        }
        // Roman numerals in the progression line are paired with the chord.
        expect(b.detail.join(' ')).not.toMatch(/undefined|NaN/);
      }
      expect(s.blocks[2].detail[0]).toMatch(/ = /);
      if (f.type === 'meter') {
        expect(s.blocks[0].accents.length).toBeGreaterThanOrEqual(3);
        expect(s.blocks[0].accents[0]).toBe(2);
        expect(s.blocks[1].rhythm).toBeDefined();
      }
    }
  });
  it('chord-focus progressions avoid I-IV-V and ii-V-I and name their chords', () => {
    for (const c of CHORD_FOCI) {
      const romans = chordFocusChords(c).map((x) => x.roman).join(' ');
      expect(romans).not.toMatch(/^I IV V$|ii7? V7? I/);
      expect(c.whyCa.length).toBeGreaterThan(40);
      for (const b of c.bookConcepts) expect(hasRef(b), b).toBe(true);
    }
    expect(chordFocusChords(CHORD_FOCI.find((c) => c.id === 'altered')!).map((x) => x.roman)).toEqual(['I7♯9', 'bIII', 'IV', 'I7♯9']);
  });
  it('raises BPM after two clean runs and lowers it after a failure', () => {
    let m = { bpm: 60, target: 64, cleanStreak: 0 };
    m = applyResult(m, 'clean');
    expect(m.bpm).toBe(60);
    m = applyResult(m, 'clean');
    expect(m).toMatchObject({ bpm: 64, target: 72, cleanStreak: 0 });
    m = applyResult(m, 'sloppy');
    expect(m.bpm).toBe(64);
    m = applyResult(m, 'failed');
    expect(m).toMatchObject({ bpm: 56, last: 'failed' });
  });
  it('renders tabs with six labeled strings and picking marks', () => {
    const lines = renderTab([{ string: 0, fret: 5 }, { string: 0, fret: 7 }, { string: 1, fret: 10 }]);
    expect(lines[0]).toContain('↓  ↑  ↓');
    expect(lines.slice(1).map((l) => l[0]).join('')).toBe('eBGDAE');
    expect(lines[6]).toBe('E|-5--7-----|');
    expect(lines[5]).toBe('A|-------10-|');
    expect(new Set(lines.slice(1).map((l) => l.length)).size).toBe(1);
  });
  it('chord diagrams in a session use numeric notation', () => {
    const s = buildSession(30, ctx());
    for (const d of s.blocks[2].diagrams) expect(voicingText(d.voicing)).toMatch(/^([x\d]+ ){5}[x\d]+$/);
  });
});

describe('repository', () => {
  it('round-trips through export and import', async () => {
    const a = new MemoryRepository();
    await a.saveFeedState(initialFeedState());
    await a.addAttempt({ at: 1, kind: 'puzzle' });
    await a.saveDay({ date: '2026-01-01', opens: 2, opensWithSolve: 1, solved: 4 });
    const b = new MemoryRepository();
    await b.importAll(await a.exportAll());
    expect(await b.getFeedState()).toEqual(initialFeedState());
    expect(await b.listAttempts()).toHaveLength(1);
    expect((await b.getDay('2026-01-01'))?.solved).toBe(4);
  });
});
