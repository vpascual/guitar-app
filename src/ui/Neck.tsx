import type { NeckData } from '../theory/guitar';

/**
 * Horizontal fretboard, drawn the way a tab reads: high e string on top, low E at the bottom, frets left to right.
 * Shows a scale position with the tonic and the characteristic note picked out.
 */
export function Neck({ neck, caption }: { neck: NeckData; caption?: string }) {
  const FW = 62;
  const SH = 22;
  const X = (fret: number) => 24 + (fret - neck.firstFret + 0.5) * FW;
  const Y = (string: number) => 16 + (5 - string) * SH;
  const width = 24 + neck.frets * FW + 12;
  const frets = Array.from({ length: neck.frets }, (_, i) => neck.firstFret + i);
  return (
    <figure className="neck">
      <svg viewBox={`0 0 ${width} ${Y(0) + 34}`} role="img" aria-label={caption ?? 'Posició de l\'escala al diapasó'}>
        {[0, 1, 2, 3, 4, 5].map((s) => <line key={s} x1={24} x2={width - 12} y1={Y(s)} y2={Y(s)} className="stringline" strokeWidth={0.8 + (5 - s) * 0.28} />)}
        {[...frets, neck.firstFret + neck.frets].map((f) => (
          <line key={f} x1={24 + (f - neck.firstFret) * FW} x2={24 + (f - neck.firstFret) * FW} y1={Y(5)} y2={Y(0)}
            className={f === 1 ? 'nut' : 'fretline'} />
        ))}
        {['e', 'B', 'G', 'D', 'A', 'E'].map((n, i) => <text key={n} x={10} y={Y(5 - i) + 4} textAnchor="middle" className="fret-num">{n}</text>)}
        {frets.map((f) => <text key={f} x={X(f)} y={Y(0) + 26} textAnchor="middle" className="fret-num">{f}</text>)}
        {neck.dots.map((d, i) => (
          <g key={i}>
            <circle cx={X(d.fret)} cy={Y(d.string)} r={9.5} className={`neck-dot ${d.kind}`} />
            <text x={X(d.fret)} y={Y(d.string) + 3.5} textAnchor="middle" className={`neck-label ${d.kind}`}>{d.label}</text>
          </g>
        ))}
      </svg>
      <figcaption className="neck-legend">
        <span><i className="neck-dot root" />tònica</span>
        {neck.dots.some((d) => d.kind === 'char') && <span><i className="neck-dot char" />nota característica</span>}
        {caption && <span className="muted">{caption}</span>}
      </figcaption>
    </figure>
  );
}
