import { describe, it, expect } from 'vitest';
import { GENERATORS, makePuzzle } from './registry';
import { auditPuzzle } from './audit';
import { makeRng } from './util';
import { hasRef } from '../content/refs';

describe('every generator', () => {
  for (const g of GENERATORS) {
    it(`${g.id}: 120 puzzles across levels pass the independent solver`, () => {
      for (let seed = 1; seed <= 40; seed++) for (const level of [0, 1, 2]) {
        const p = makePuzzle(g.id, seed, level);
        expect(auditPuzzle(p), `${p.id}: ${p.prompt}`).toEqual([]);
        expect(g.concepts, p.conceptKey).toContain(p.conceptKey);
        if (!g.requiresAudio) expect(p.visual?.type).not.toBe('listen');
      }
    });
    it(`${g.id}: honours a forced concept and is deterministic`, () => {
      for (const c of g.concepts) {
        const p = makePuzzle(g.id, 7, 1, c);
        expect(p.conceptKey).toBe(c);
        expect(auditPuzzle(p)).toEqual([]);
      }
      expect(makePuzzle(g.id, 3, 1)).toEqual(makePuzzle(g.id, 3, 1));
    });
    it(`${g.id}: book references resolve`, () => {
      for (const c of g.bookConcepts) expect(hasRef(c), c).toBe(true);
      for (let seed = 1; seed <= 20; seed++) {
        const p = makePuzzle(g.id, seed, 1);
        if (g.skill === 'rhythm') expect(p.bookConcept).toBeNull();
        else expect(hasRef(p.bookConcept!), String(p.bookConcept)).toBe(true);
      }
    });
  }
});

describe('audit: 50 random puzzles', () => {
  it('all answers agree with the theory core', () => {
    const rng = makeRng(Date.now());
    const failures: string[] = [];
    for (let i = 0; i < 50; i++) {
      const g = rng.pick(GENERATORS);
      const p = makePuzzle(g.id, rng.int(1e9), rng.int(3));
      const errs = auditPuzzle(p);
      if (errs.length) failures.push(`${p.id}: ${errs.join('; ')}`);
    }
    expect(failures).toEqual([]);
  });
});

describe('display conventions', () => {
  it('Roman numerals in explanations are paired with the real chord', () => {
    for (const g of GENERATORS) for (let seed = 1; seed <= 15; seed++) {
      const p = makePuzzle(g.id, seed, 1);
      // A numeral must be followed by " = <chord>" unless it sits inside a "V7/x" target or is the asked item.
      const bare = p.explanation.match(/(?<![\w/°ø])[b#]?(?:VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(?:°|ø7|maj7|7|\+)?(?= [^=]|[,.]|$)/gm) ?? [];
      const allowed = bare.filter((x) => !['i', 'I', 'V', 'v'].includes(x) || /[b#°7]/.test(x));
      expect(allowed.filter((x) => x.length > 1 && /^[b#]?[IViv]+/.test(x)), `${p.id}: ${p.explanation}`).toEqual([]);
    }
  });
  it('uses Catalan terms, never "bemol" or "flat"', () => {
    for (const g of GENERATORS) for (let seed = 1; seed <= 15; seed++) {
      const p = makePuzzle(g.id, seed, 2);
      const text = [p.prompt, p.hint, p.explanation].join(' ');
      expect(text).not.toMatch(/\bbemol\b|\bflat\b|\bsharp\b|sostenido/);
    }
  });
});
