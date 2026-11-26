import type { BarCell } from '../puzzles/types';

/** A chord chart: bars in rows (four per row for the blues), each with its chords as numeral and symbol. */
export function BarGrid({ bars, perRow }: { bars: BarCell[]; perRow: number }) {
  return (
    <div className="bargrid" style={{ gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))` }} role="img"
      aria-label={`Graella d'acords: ${bars.map((b, i) => `compàs ${i + 1}: ${b.hidden ? 'amagat' : b.chords.map((c) => c.symbol).join(' ')}`).join('; ')}`}>
      {bars.map((b, i) => (
        <div key={i} className={`bar-cell${b.hidden ? ' hidden-cell' : ''}${b.highlight ? ' hl' : ''}`}>
          <span className="bar-no">{i + 1}</span>
          {b.hidden ? <span className="bar-q">?</span> : b.chords.map((c, j) => (
            <span key={j} className="bar-chord"><strong>{c.symbol}</strong><small>{c.roman}</small></span>
          ))}
        </div>
      ))}
    </div>
  );
}
