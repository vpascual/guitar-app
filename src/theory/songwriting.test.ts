import { describe, it, expect } from 'vitest';
import { parseNote, pc, mod } from './note';
import { songSketch, fitsRule, schemeOf, relativeOf, keyLift, dominantOf, SECTION_PROGS, progChords, degreeIn } from './songwriting';
import { getChord } from './chord';
import { makeRng } from '../puzzles/util';
import { totalBars } from './form';

describe('songwriting core', () => {
  const C = parseNote('C');
  it('knows relative keys, dominants and key lifts', () => {
    expect(relativeOf(parseNote('A'), true)).toEqual(C);
    expect(relativeOf(C, false)).toEqual(parseNote('A'));
    expect(relativeOf(parseNote('Eb'), false)).toEqual(parseNote('C'));
    expect(dominantOf({ root: parseNote('F'), def: getChord('maj') })).toEqual({ root: C, def: getChord('7') });
    expect(keyLift(C, 1).tonic).toEqual(parseNote('Db'));
    expect(keyLift(C, 2)).toEqual({ tonic: parseNote('D'), pivot: { root: parseNote('A'), def: getChord('7') } });
  });
  it('tells rhyme schemes apart', () => {
    expect(schemeOf(['cor', 'amor', 'mar', 'cantar'])).toBe('AABB');
    expect(schemeOf(['cor', 'mar', 'amor', 'cantar'])).toBe('ABAB');
    expect(schemeOf(['cor', 'mar', 'cantar', 'amor'])).toBe('ABBA');
    expect(schemeOf(['nit', 'cor', 'gent', 'amor'])).toBe('XAXA');
  });
  it('every library progression obeys its section rule', () => {
    for (const p of SECTION_PROGS) {
      const cs = progChords(C, p);
      if (p.id === 'v-circle') expect(fitsRule('verse', C, cs)).toBe(true);
      if (p.role === 'prechorus') expect(['5', 'b7']).toContain(degreeIn(C, cs[cs.length - 1]));
      if (p.role === 'bridge') expect(degreeIn(C, cs[cs.length - 1])).toBe('5');
    }
  });
  it('builds song sketches whose sections contrast and connect', () => {
    for (const key of ['C', 'G', 'Bb', 'E', 'F#']) for (let seed = 1; seed <= 40; seed++) {
      const tonic = parseNote(key);
      const sk = songSketch(tonic, makeRng(seed).next);
      const sec = (id: string) => sk.sections.find((s) => s.role === id)!;
      const verse = sec('verse').bars.flat();
      const chorus = sec('chorus').bars.flat();
      const pre = sec('prechorus').bars.flat();
      const bridge = sec('bridge').bars.flat();
      const final = sec('final');
      expect(verse[0].roman, `${key} ${seed}`).not.toBe(chorus[0].roman);
      expect(['5', 'b7']).toContain(degreeIn(tonic, pre[pre.length - 1]));
      if (degreeIn(tonic, pre[pre.length - 1]) === 'b7') expect(degreeIn(tonic, chorus[0])).toBe('1');
      const used = new Set([...verse, ...chorus, ...pre].map((c) => `${pc(c.root)}:${c.def.id}`));
      expect(bridge.some((c) => !used.has(`${pc(c.root)}:${c.def.id}`)), `${key} ${seed} bridge brings something new`).toBe(true);
      const lifted = mod(pc(final.tonic) - pc(tonic), 12);
      expect([0, 1, 2]).toContain(lifted);
      if (lifted) {
        const last = bridge[bridge.length - 1];
        expect(last.def.id).toBe('7');
        expect(pc(last.root)).toBe(mod(pc(final.tonic) + 7, 12));
        // The last chorus is the same progression in the new key.
        expect(final.bars.flat().map((c) => degreeIn(final.tonic, c))).toEqual(chorus.map((c) => degreeIn(tonic, c)));
      }
      expect(totalBars(sk.form)).toBeGreaterThanOrEqual(60);
      for (const s of sk.sections) expect(s.notes.join(' ')).not.toMatch(/undefined|NaN/);
    }
  });
});
