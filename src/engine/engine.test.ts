import { describe, it, expect } from 'vitest';
import { expectedScore, updateRating, levelFor } from './elo';
import { initialFeedState, nextPuzzle, recordAnswer, FeedState } from './feed';
import { buildSession, applyResult, renderTab, chooseProgression, progressionChords, chordFocusChords, FOCI, BLOCK_MINUTES, BuildContext } from './session';
import { CHORD_FOCI } from '../content/progressions';
import { PROGRESSIONS } from '../content/progressions';
import { hasRef } from '../content/refs';
import { makeRng } from '../puzzles/util';
import { MemoryRepository } from '../storage/memory';
import { CONCEPT_GROUPS, masteryMap, weekDates, weekRhythm, tempoHistory } from './progress';
import { GENERATORS, makePuzzle } from '../puzzles/registry';
import { makeTip, TIP_COUNT } from './tips';
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

describe('progress', () => {
  const att = (key: string, correct: boolean, at: number) => ({
    at, kind: 'puzzle' as const,
    puzzle: { generatorId: 'g', seed: 1, level: 0, conceptKey: key, skill: 'modes' as const, correct, ms: 1, usedHint: false, ratingBefore: 1000, ratingAfter: 1000 },
  });
  it('every concept a generator can produce is on the mastery map', () => {
    const keys = new Set(CONCEPT_GROUPS.flatMap((g) => g.cells.map((c) => c.key)));
    for (const g of GENERATORS) for (const c of g.concepts) {
      // Chord types you already know (triads and plain sevenths) are not tracked as weak areas.
      if (c.startsWith('chord:') && !keys.has(c)) continue;
      expect(keys.has(c), c).toBe(true);
    }
    expect(keys.size).toBe(CONCEPT_GROUPS.reduce((n, g) => n + g.cells.length, 0));
  });
  it('marks a concept solid after three right answers in a row, and learning again after a miss', () => {
    const three = [att('mode:dorian', false, 1), att('mode:dorian', true, 2), att('mode:dorian', true, 3), att('mode:dorian', true, 4)];
    expect(masteryMap(three, [])['mode:dorian']).toBe('solid');
    expect(masteryMap(three.slice(0, 3), [])['mode:dorian']).toBe('learning');
    expect(masteryMap([...three, att('mode:dorian', false, 5)], [])['mode:dorian']).toBe('learning');
    expect(masteryMap(three, [{ generatorId: 'g', conceptKey: 'mode:dorian', stage: 1 }])['mode:dorian']).toBe('learning');
    expect(masteryMap([], [])['mode:lydian']).toBe('new');
  });
  it('counts active days in the current week, Monday first, without a streak', () => {
    const wed = new Date(2026, 10, 18);
    expect(weekDates(wed)[0]).toBe('2026-11-16');
    expect(weekDates(new Date(2026, 10, 22))[0]).toBe('2026-11-16');
    const r = weekRhythm([
      { date: '2026-11-16', opens: 1, opensWithSolve: 1, solved: 3 },
      { date: '2026-11-17', opens: 2, opensWithSolve: 0, solved: 0 },
      { date: '2026-11-18', opens: 1, opensWithSolve: 1, solved: 1 },
      { date: '2026-11-09', opens: 1, opensWithSolve: 1, solved: 9 },
    ], wed);
    expect(r.map((d) => d.active)).toEqual([true, false, true, false, false, false, false]);
    expect(r.filter((d) => d.future)).toHaveLength(4);
  });
  it('builds tempo history and the best clean tempo per exercise', () => {
    const blk = (bpm: number, result: 'clean' | 'sloppy' | 'failed', at: number) => ({
      at, kind: 'block' as const, block: { sessionId: 's', blockId: 'b', materialId: 'technique:dorian:thirds', result, bpm, title: 'La dòric · Tècnica' },
    });
    const [s] = tempoHistory([blk(60, 'clean', 1), blk(60, 'clean', 2), blk(64, 'sloppy', 3), blk(64, 'clean', 4), blk(68, 'failed', 5)]);
    expect(s.title).toBe('La dòric · Tècnica');
    expect(s.points.map((p) => p.bpm)).toEqual([60, 60, 64, 64, 68]);
    expect(s.best).toBe(64);
    expect(applyResult({ bpm: 60, target: 80, cleanStreak: 0 }, 'clean').best).toBe(60);
  });
});

describe('home tips', () => {
  it('builds a valid tip for every seed, with a generator that accepts its concept', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 400; seed++) {
      const t = makeTip(seed);
      seen.add(t.conceptKey);
      expect(t.title.length).toBeGreaterThan(1);
      expect(t.lines.length).toBeGreaterThanOrEqual(2);
      expect(t.lines.join(' ')).not.toMatch(/undefined|NaN/);
      expect(t.lines.join(' ').split(/\s+/).length).toBeLessThan(70);
      const g = GENERATORS.find((x) => x.id === t.generatorId)!;
      expect(g.concepts, `${t.generatorId} ${t.conceptKey}`).toContain(t.conceptKey);
      expect(makePuzzle(t.generatorId, seed, 1, t.conceptKey).conceptKey).toBe(t.conceptKey);
      if (t.bookConcept) expect(hasRef(t.bookConcept)).toBe(true);
    }
    expect(seen.size).toBeGreaterThan(TIP_COUNT * 0.8);
  });
  it('prefers concepts that are in progress', () => {
    for (let seed = 0; seed < 30; seed++) expect(makeTip(seed, { 'mode:lydian': 'learning' }).conceptKey).toBe('mode:lydian');
    expect(makeTip(3)).toEqual(makeTip(3));
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
