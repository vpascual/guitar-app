/** One bar of eighth notes, beamed by group. No time signature is drawn: that is the question. */
export function RhythmLine({ groups }: { groups: number[] }) {
  const total = groups.reduce((a, b) => a + b, 0);
  const step = Math.min(34, 300 / total);
  const gap = 12;
  let x = 18;
  const notes: { x: number; first: boolean; last: boolean }[] = [];
  const beams: [number, number][] = [];
  for (const g of groups) {
    const start = x;
    for (let i = 0; i < g; i++) {
      notes.push({ x, first: i === 0, last: i === g - 1 });
      x += step;
    }
    beams.push([start, x - step]);
    x += gap;
  }
  const width = x + 4;
  return (
    <svg className="rhythm" viewBox={`0 0 ${width} 84`} role="img" aria-label={`Corxeres agrupades ${groups.join('+')}`}>
      <line x1={4} x2={width - 4} y1={62} y2={62} className="fretline" />
      <line x1={4} x2={4} y1={20} y2={70} className="stringline" />
      <line x1={width - 4} x2={width - 4} y1={20} y2={70} className="stringline" />
      {beams.map(([a, b], i) => (
        <rect key={i} x={a + 6} y={18} width={Math.max(b - a, 1) + 1.6} height={6} className="dot" />
      ))}
      {notes.map((n, i) => (
        <g key={i}>
          <ellipse cx={n.x} cy={62} rx={7} ry={5.2} transform={`rotate(-20 ${n.x} 62)`} className="dot" />
          <line x1={n.x + 6.6} x2={n.x + 6.6} y1={60} y2={19} className="stem" />
        </g>
      ))}
    </svg>
  );
}
