import type { FretPos } from '../theory/guitar';

export interface FretDot extends FretPos {
  label?: string;
  root?: boolean;
  tone?: 'good' | 'bad';
}

/**
 * Vertical SVG fretboard (low E on the left, lowest fret on top) with large tap targets.
 * Used for tap puzzles and for showing positions.
 */
export function Fretboard({ firstFret, frets, dots, onTap }: {
  firstFret: number; frets: number; dots: FretDot[]; onTap?: (p: FretPos) => void;
}) {
  const W = 52;
  const H = 52;
  const X = (s: number) => 44 + s * W;
  const Y = (row: number) => 16 + row * H;
  const rows = Array.from({ length: frets }, (_, i) => i);
  return (
    <svg className="fretboard" viewBox={`0 0 ${X(5) + 30} ${Y(frets) + 24}`} role="img" aria-label="Diapasó">
      {rows.map((r) => (
        <text key={r} x={14} y={Y(r) + H / 2 + 5} textAnchor="middle" className="fret-num">{firstFret + r}</text>
      ))}
      {[...rows, frets].map((r) => (
        <line key={r} x1={X(0)} x2={X(5)} y1={Y(r)} y2={Y(r)} className={r === 0 && firstFret === 1 ? 'nut' : 'fretline'} />
      ))}
      {[0, 1, 2, 3, 4, 5].map((s) => (
        <line key={s} x1={X(s)} x2={X(s)} y1={Y(0)} y2={Y(frets)} className="stringline" strokeWidth={3 - s * 0.35} />
      ))}
      {['E', 'A', 'D', 'G', 'B', 'e'].map((n, s) => (
        <text key={n} x={X(s)} y={Y(frets) + 18} textAnchor="middle" className="fret-num">{n}</text>
      ))}
      {dots.map((d, i) => (
        <g key={i}>
          <circle cx={X(d.string)} cy={Y(d.fret - firstFret) + H / 2} r={17}
            className={d.tone === 'good' ? 'dot good' : d.tone === 'bad' ? 'dot bad' : d.root ? 'dot root' : 'dot'} />
          {d.label && <text x={X(d.string)} y={Y(d.fret - firstFret) + H / 2 + 5} textAnchor="middle" className="dot-label">{d.label}</text>}
        </g>
      ))}
      {onTap && rows.map((r) => [0, 1, 2, 3, 4, 5].map((s) => (
        <rect key={`${r}-${s}`} x={X(s) - W / 2} y={Y(r)} width={W} height={H} className="tap"
          onClick={() => onTap({ string: s, fret: firstFret + r })} />
      )))}
    </svg>
  );
}
