// Generators for the "rhythm" skill: meters from notation, accent placement, and meters by ear.
// The Beato Book has no odd-meter material, so these carry no book reference.
import type { PuzzleGenerator, Rng } from './types';
import { METERS, Meter, meterLabel, counting } from '../theory/meter';
import { choice, optionCount } from './util';

const LABELS = ['3/4', '4/4', '5/4', '6/8', '5/8', '7/8', '9/8', '12/8'];
const meterKey = (m: Meter) => `meter:${meterLabel(m)}`;

/** Eighth-note groups as drawn: quarter-based meters become pairs of eighths. */
export const displayGroups = (m: Meter): number[] =>
  m.unit === 8 ? m.groups : Array.from({ length: m.beats }, () => 2);

/** Starting eighth of each group, 1-based. */
export const groupStarts = (groups: number[]): number[] => {
  const out: number[] = [];
  let at = 1;
  for (const g of groups) {
    out.push(at);
    at += g;
  }
  return out;
};

const pickMeter = (rng: Rng, level: number, concept: string | undefined, pool: Meter[]): Meter => {
  const forced = pool.filter((m) => meterKey(m) === concept);
  if (forced.length) return rng.pick(forced);
  const easy = pool.filter((m) => m.groups.length <= 3 || m.unit === 4);
  return rng.pick(level === 0 && easy.length ? easy : pool);
};

function explain(m: Meter): string {
  const g = displayGroups(m);
  const total = g.reduce((a, b) => a + b, 0);
  if (m.unit === 4) {
    return `${total} corxeres en ${g.length} grups de dues: ${g.length} temps de negra, és a dir ${meterLabel(m)}.${m.beats === 3 ? ' Si fossin dos grups de tres seria 6/8.' : ''}`;
  }
  return `${total} corxeres agrupades ${g.join('+')}: és un ${meterLabel(m)}. Es compta «${counting(m)}» i s'accentua la primera de cada grup.${m.beats === 6 ? ' Tres grups de dues serien 3/4.' : ''}`;
}

export const meterFromNotation: PuzzleGenerator = {
  id: 'meter-from-notation',
  skill: 'rhythm',
  requiresAudio: false,
  base: 960,
  bookConcepts: [],
  concepts: [...new Set(METERS.map(meterKey))],
  make(rng, level, concept) {
    const m = pickMeter(rng, level, concept, METERS);
    const groups = displayGroups(m);
    return {
      difficulty: this.base + 70 * level + (m.groups.includes(3) && m.groups.includes(2) ? 60 : 0),
      conceptKey: meterKey(m),
      bookConcept: null,
      prompt: 'Les barres uneixen les corxeres de cada temps. Quin compàs és?',
      visual: { type: 'rhythm', groups },
      answer: choice(rng, meterLabel(m), LABELS.filter((l) => l !== meterLabel(m)), (l) => l, optionCount(level)),
      hint: 'Compta les corxeres i mira si els grups són de dues, de tres o barrejats.',
      explanation: explain(m),
      terms: m.unit === 8 && m.beats !== 6 && m.beats !== 12 && m.beats !== 9 ? ['corxera', 'compàs irregular'] : ['corxera'],
      listen: { type: 'clicks', accents: groups.flatMap((g) => [1, ...Array<number>(g - 1).fill(0)]), bpm: 220 },
      truth: { kind: 'meter-by-groups', groups },
    };
  },
};

const GROUPED = METERS.filter((m) => m.unit === 8);

export const accentPositions: PuzzleGenerator = {
  id: 'accent-positions',
  skill: 'rhythm',
  requiresAudio: false,
  base: 1020,
  bookConcepts: [],
  concepts: [...new Set(GROUPED.map(meterKey))],
  make(rng, level, concept) {
    const m = pickMeter(rng, level, concept, GROUPED);
    const correct = groupStarts(m.groups);
    const total = m.beats;
    // Wrong answers: other ways of splitting the same number of eighths, and shifted accents.
    const wrong: number[][] = [
      ...GROUPED.filter((x) => x.beats === total && x.id !== m.id).map((x) => groupStarts(x.groups)),
      correct.map((p, i) => (i === 0 ? p : p + 1)).filter((p) => p <= total),
      correct.map((p, i) => (i === 0 ? p : p - 1)),
      Array.from({ length: Math.ceil(total / 2) }, (_, i) => 1 + 2 * i),
      Array.from({ length: Math.ceil(total / 3) }, (_, i) => 1 + 3 * i),
    ].filter((w) => new Set(w).size === w.length);
    return {
      difficulty: this.base + 70 * level,
      conceptKey: meterKey(m),
      bookConcept: null,
      prompt: `En un ${meterLabel(m)} agrupat ${m.groups.join('+')}, a quines corxeres cauen els accents?`,
      answer: choice<number[]>(rng, correct, wrong, (p) => p.join(', '), optionCount(level)),
      hint: 'Cada grup comença amb un accent. Suma la mida dels grups anteriors i afegeix-hi 1.',
      explanation: `Els grups ${m.groups.join('+')} comencen a les corxeres ${correct.join(', ')}. Es compta «${counting(m)}».`,
      terms: ['corxera', 'compàs irregular'],
      listen: { type: 'clicks', accents: m.groups.flatMap((g) => [1, ...Array<number>(g - 1).fill(0)]), bpm: 220 },
      truth: { kind: 'accents', groups: m.groups },
    };
  },
};

export const meterByEar: PuzzleGenerator = {
  id: 'meter-by-ear',
  skill: 'rhythm',
  requiresAudio: true,
  base: 1080,
  bookConcepts: [],
  concepts: [...new Set(METERS.map(meterKey))],
  make(rng, level, concept) {
    const m = pickMeter(rng, level, concept, METERS);
    const groups = displayGroups(m);
    return {
      difficulty: this.base + 70 * level,
      conceptKey: meterKey(m),
      bookConcept: null,
      prompt: 'Escolta les corxeres i els accents. Quin compàs és?',
      visual: { type: 'listen' },
      answer: choice(rng, meterLabel(m), LABELS.filter((l) => l !== meterLabel(m)), (l) => l, optionCount(level)),
      hint: 'Compta quantes corxeres hi ha entre un accent fort i el següent.',
      explanation: explain(m),
      terms: ['corxera'],
      listen: { type: 'clicks', accents: groups.flatMap((g, gi) => [gi === 0 ? 2 : 1, ...Array<number>(g - 1).fill(0)]), bpm: 220 },
      truth: { kind: 'meter-by-groups', groups },
    };
  },
};

export const RHYTHM_GENERATORS = [meterFromNotation, accentPositions, meterByEar];
