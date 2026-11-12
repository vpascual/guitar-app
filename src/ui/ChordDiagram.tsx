import type { Voicing } from '../theory/guitar';
import { voicingText } from '../theory/guitar';

/**
 * SVG chord diagram: nut at the top, six strings, four frets, × and ○ above,
 * numeric notation below, barre drawn as a rounded rectangle.
 */
export function ChordDiagram({ voicing, name, size = 1 }: { voicing: Voicing; name?: string; size?: number }) {
  const fretted = voicing.filter((f): f is number => f !== null && f > 0);
  const max = fretted.length ? Math.max(...fretted) : 0;
  const min = fretted.length ? Math.min(...fretted) : 0;
  const base = max <= 4 ? 1 : min;
  const X = (s: number) => 28 + s * 20;
  const Y = (row: number) => 34 + row * 26;

  // Barre: the lowest fret held on two or more strings, with no open string and nothing lower in between.
  const hasOpen = voicing.some((f) => f === 0);
  const atMin = voicing.map((f, s) => (f === min ? s : -1)).filter((s) => s >= 0);
  const from = atMin[0];
  const to = atMin[atMin.length - 1];
  const barre = !hasOpen && atMin.length >= 2 && voicing.slice(from, to + 1).every((f) => f !== null);

  return (
    <figure className="chord">
      {name && <figcaption>{name}</figcaption>}
      <svg viewBox="0 0 164 172" width={164 * size} height={172 * size} role="img" aria-label={`${name ?? 'Acord'}: ${voicingText(voicing)}`}>
        {voicing.map((f, s) => (
          <text key={s} x={X(s)} y={24} textAnchor="middle" className="chord-mark">
            {f === null ? '×' : f === 0 ? '○' : ''}
          </text>
        ))}
        {[0, 1, 2, 3, 4].map((r) => (
          <line key={r} x1={X(0)} x2={X(5)} y1={Y(r)} y2={Y(r)} className={r === 0 && base === 1 ? 'nut' : 'fretline'} />
        ))}
        {[0, 1, 2, 3, 4, 5].map((s) => (
          <line key={s} x1={X(s)} x2={X(s)} y1={Y(0)} y2={Y(4)} className="stringline" />
        ))}
        {base > 1 && <text x={X(5) + 9} y={Y(0) + 18} className="chord-fret">{base}fr</text>}
        {barre && (
          <rect x={X(from) - 8} y={Y(min - base) + 5} width={X(to) - X(from) + 16} height={16} rx={8} className="dot" />
        )}
        {voicing.map((f, s) =>
          f !== null && f > 0 && !(barre && f === min) ? (
            <circle key={s} cx={X(s)} cy={Y(f - base) + 13} r={8} className="dot" />
          ) : null,
        )}
        <text x={78} y={164} textAnchor="middle" className="chord-num">{voicingText(voicing)}</text>
      </svg>
    </figure>
  );
}
