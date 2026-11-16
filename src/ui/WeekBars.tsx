const WEEKDAYS = ['dl', 'dt', 'dc', 'dj', 'dv', 'ds', 'dg'];

export interface WeekDay {
  date: string;
  active: boolean;
  future: boolean;
  solved: number;
}

/** This week as a small bar chart: one bar per day, as tall as the number of puzzles solved that day. */
export function WeekBars({ week }: { week: WeekDay[] }) {
  const max = Math.max(4, ...week.map((d) => d.solved));
  const total = week.reduce((n, d) => n + d.solved, 0);
  return (
    <div className="weekbars" data-testid="week" role="img"
      aria-label={`Trencaclosques resolts aquesta setmana: ${week.map((d, i) => `${WEEKDAYS[i]} ${d.solved}`).join(', ')}`}>
      <div className="bars">
        {week.map((d) => (
          <div key={d.date} className="bar-col">
            <span className="bar-value">{d.solved > 0 ? d.solved : ''}</span>
            <span className={`bar${d.active ? ' active' : ''}${d.future ? ' future' : ''}`}
              style={{ height: d.active ? `${Math.max(12, (d.solved / max) * 100)}%` : undefined }} />
          </div>
        ))}
      </div>
      <div className="bar-labels">{week.map((d, i) => <span key={d.date} className={d.active ? 'on' : ''}>{WEEKDAYS[i]}</span>)}</div>
      <span className="sr">{total}</span>
    </div>
  );
}
