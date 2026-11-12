// Meters and their beat groupings.

export interface Meter {
  id: string;
  beats: number;
  unit: 4 | 8;
  /** Grouping in units, e.g. [2, 2, 3] for 7/8. The first note of each group is accented. */
  groups: number[];
}

const M = (beats: number, unit: 4 | 8, groups: number[]): Meter => ({
  id: `${beats}/${unit}:${groups.join('+')}`, beats, unit, groups,
});

export const METERS: Meter[] = [
  M(4, 4, [1, 1, 1, 1]),
  M(3, 4, [1, 1, 1]),
  M(6, 8, [3, 3]),
  M(5, 4, [3, 2]),
  M(5, 4, [2, 3]),
  M(7, 8, [2, 2, 3]),
  M(7, 8, [3, 2, 2]),
  M(7, 8, [2, 3, 2]),
  M(5, 8, [3, 2]),
  M(5, 8, [2, 3]),
  M(9, 8, [3, 3, 3]),
  M(12, 8, [3, 3, 3, 3]),
];

export const meterLabel = (m: Meter): string => `${m.beats}/${m.unit}`;

/** Accent level per unit: 2 = downbeat, 1 = start of a group, 0 = weak. */
export function accentPattern(m: Meter): number[] {
  const out: number[] = [];
  m.groups.forEach((g, gi) => {
    for (let i = 0; i < g; i++) out.push(i === 0 ? (gi === 0 ? 2 : 1) : 0);
  });
  return out;
}

/** Counting syllables, restarting at each group: 7/8 as 2+2+3 -> "1 2 1 2 1 2 3". */
export const counting = (m: Meter): string =>
  m.groups.map((g) => Array.from({ length: g }, (_, i) => i + 1).join(' ')).join(' · ');
