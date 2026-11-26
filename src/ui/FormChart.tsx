import type { FormVisualBlock } from '../puzzles/types';

/** Colour slot per section letter, so repeats of the same music share a colour. */
const SLOT: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, P: 1, I: 4, S: 5 };

/**
 * A song form as blocks, each about as wide as its number of bars; long forms wrap onto a second row.
 * The letter is the music; the bar count and the start bar sit with it.
 */
export function FormChart({ blocks }: { blocks: FormVisualBlock[] }) {
  const total = blocks.reduce((n, b) => n + b.bars, 0);
  return (
    <div className="formchart" role="img"
      aria-label={`Forma: ${blocks.map((b) => `${b.name ?? b.label}, ${b.bars} compassos`).join('; ')}. Total ${total} compassos.`}>
      <div className="form-row">
        {blocks.map((b, i) => (
          <div key={i} className={`form-block s${SLOT[b.label] ?? i % 6}${b.highlight ? ' hl' : ''}`}
            style={{ flexGrow: b.bars, flexBasis: `${Math.max(56, b.bars * 7)}px` }}>
            {b.start !== undefined && <span className="form-start">c. {b.start}</span>}
            <span className="form-letter">{b.label}</span>
            {b.name && <span className="form-name">{b.name}</span>}
            <span className="form-bars">{b.bars}</span>
          </div>
        ))}
      </div>
      <p className="form-total">{total} compassos</p>
    </div>
  );
}
