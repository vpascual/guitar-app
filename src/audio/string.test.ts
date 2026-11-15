import { describe, it, expect } from 'vitest';
import { midiFreq, pluckSamples } from './string';

const SR = 44100;

/** Fundamental by autocorrelation, searched around the expected period. */
function detect(samples: Float32Array, expected: number): number {
  const start = Math.floor(SR * 0.1);
  const len = Math.floor(SR * 0.2);
  let bestLag = 0;
  let best = -Infinity;
  const mid = SR / expected;
  for (let lag = Math.floor(mid * 0.9); lag <= Math.ceil(mid * 1.1); lag++) {
    let sum = 0;
    for (let i = start; i < start + len; i++) sum += samples[i] * samples[i + lag];
    if (sum > best) {
      best = sum;
      bestLag = lag;
    }
  }
  return SR / bestLag;
}

const rms = (s: Float32Array, from: number, to: number) => {
  let sum = 0;
  for (let i = Math.floor(from * SR); i < Math.floor(to * SR); i++) sum += s[i] * s[i];
  return Math.sqrt(sum / ((to - from) * SR));
};

describe('plucked string', () => {
  it('knows concert pitch', () => {
    expect(midiFreq(69)).toBeCloseTo(440);
    expect(midiFreq(40)).toBeCloseTo(82.41, 1);
  });
  it('sounds at the requested pitch across the guitar range', () => {
    for (const midi of [40, 45, 52, 57, 64, 69, 76]) {
      const f = midiFreq(midi);
      const got = detect(pluckSamples(f, SR, 1.5), f);
      // Within the resolution of one sample of lag.
      expect(Math.abs(got - f) / f, `midi ${midi}`).toBeLessThan(0.02);
    }
  });
  it('never clips, starts and ends silent, and decays like a string', () => {
    for (const midi of [40, 57, 76]) {
      const s = pluckSamples(midiFreq(midi), SR, 2.5);
      expect(Math.max(...s.map(Math.abs))).toBeLessThanOrEqual(1.0001);
      expect(Math.abs(s[0])).toBeLessThan(0.01);
      expect(Math.abs(s[s.length - 1])).toBeLessThan(0.01);
      const early = rms(s, 0.02, 0.2);
      const late = rms(s, 1.8, 2.2);
      expect(early).toBeGreaterThan(0.05);
      expect(late).toBeLessThan(early * 0.5);
      expect(late).toBeGreaterThan(0);
    }
  });
  it('is deterministic', () => {
    expect(pluckSamples(220, SR, 0.5)).toEqual(pluckSamples(220, SR, 0.5));
  });
});
