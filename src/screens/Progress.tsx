import { useEffect, useState } from 'react';
import { repo, sync } from '../storage';
import { initialFeedState, FeedState } from '../engine/feed';
import { SKILLS } from '../engine/elo';
import {
  CONCEPT_GROUPS, Mastery, TempoSeries, countMastery, masteryMap, solvedByDay, tempoHistory, weekRhythm,
} from '../engine/progress';
import type { SkillArea } from '../puzzles/types';

const SKILL_CA: Record<SkillArea, string> = { modes: 'Modes i escales', chords: 'Acords', harmony: 'Harmonia', rhythm: 'Ritme' };
const STATE_CA: Record<Mastery, string> = { new: 'per descobrir', learning: 'en curs', solid: 'sòlid' };
const WEEKDAYS = ['dl', 'dt', 'dc', 'dj', 'dv', 'ds', 'dg'];

/** Tempo of each run as a small line chart; the dot colour is the rating of that run. */
function TempoChart({ series }: { series: TempoSeries }) {
  const W = 260;
  const H = 70;
  const bpms = series.points.map((p) => p.bpm);
  const lo = Math.min(...bpms) - 4;
  const hi = Math.max(...bpms) + 4;
  const x = (i: number) => (series.points.length === 1 ? W / 2 : 10 + (i * (W - 20)) / (series.points.length - 1));
  const y = (bpm: number) => H - 10 - ((bpm - lo) / (hi - lo)) * (H - 20);
  return (
    <svg className="tempo" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tempo de ${series.title}: ${bpms.join(', ')} bpm`}>
      <polyline points={series.points.map((p, i) => `${x(i)},${y(p.bpm)}`).join(' ')} className="tempo-line" />
      {series.points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.bpm)} r={4.5} className={`tempo-dot ${p.result}`} />)}
    </svg>
  );
}

export function Progress() {
  const [data, setData] = useState<{
    feed: FeedState; map: Record<string, Mastery>; week: ReturnType<typeof weekRhythm>; tempo: TempoSeries[];
  } | null>(null);

  useEffect(() => {
    // Fetch what the other device did first, but never wait long for the network.
    void sync.syncWithin(2500).then(() => Promise.all([repo.getFeedState(), repo.listAttempts()])).then(([f, attempts]) => {
      const feed = f ?? initialFeedState();
      setData({ feed, map: masteryMap(attempts, feed.reviews), week: weekRhythm(solvedByDay(attempts), new Date()), tempo: tempoHistory(attempts) });
    });
  }, []);

  if (!data) return <main className="progress" />;
  const all = CONCEPT_GROUPS.flatMap((g) => g.cells);
  const total = countMastery(data.map, all);
  const activeDays = data.week.filter((d) => d.active).length;

  return (
    <main className="progress">
      <h1>Progrés</h1>

      <section>
        <h2>Aquesta setmana</h2>
        <div className="week" data-testid="week">
          {data.week.map((d, i) => (
            <span key={d.date} className={`day${d.active ? ' active' : ''}${d.future ? ' future' : ''}`}>{WEEKDAYS[i]}</span>
          ))}
        </div>
        <p className="muted">{activeDays} de 7 dies amb almenys un trencaclosques resolt. Un dia sense obrir-la no trenca res.</p>
      </section>

      <section>
        <h2>Mapa de conceptes</h2>
        <p className="muted" data-testid="mastery-total">
          {total.solid} sòlids, {total.learning} en curs, {total.new} per descobrir, de {all.length}.
          Un concepte és sòlid quan l'encertes tres cops seguits i no té cap repàs pendent.
        </p>
        {CONCEPT_GROUPS.map((g) => {
          const n = countMastery(data.map, g.cells);
          return (
            <div key={g.id} className="group">
              <h3>{g.titleCa} <span className="muted">{n.solid}/{g.cells.length}</span></h3>
              <div className="cells">
                {g.cells.map((c) => (
                  <span key={c.key} className={`cell ${data.map[c.key]}`} title={STATE_CA[data.map[c.key]]}>
                    {c.label}<span className="sr"> ({STATE_CA[data.map[c.key]]})</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        <p className="legend">
          <span className="cell solid">sòlid</span><span className="cell learning">en curs</span><span className="cell new">per descobrir</span>
        </p>
      </section>

      <section>
        <h2>Nivell per àrea</h2>
        <div className="ratings">
          {SKILLS.map((s) => (
            <div key={s} className="rating"><span>{SKILL_CA[s]}</span><strong>{data.feed.ratings[s]}</strong></div>
          ))}
        </div>
        <p className="muted">Comença a 1000. Puja quan encertes trencaclosques difícils i baixa quan en falles de fàcils.</p>
      </section>

      <section>
        <h2>Tempo a la pràctica</h2>
        {data.tempo.length === 0 && <p className="muted">Encara no has valorat cap bloc. Quan ho facis, aquí veuràs el tempo de cada exercici sessió a sessió.</p>}
        <div className="tempos">
          {data.tempo.map((s) => (
            <div key={s.materialId} className="tempo-card">
              <h3>{s.title}</h3>
              <TempoChart series={s} />
              <p className="muted">
                Ara: {s.points[s.points.length - 1].bpm} bpm. {s.best ? `Millor tempo net: ${s.best} bpm.` : 'Encara cap passada neta.'}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
