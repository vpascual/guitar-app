import { useEffect, useState } from 'react';
import { repo, sync } from '../storage';
import { initialFeedState } from '../engine/feed';
import { CONCEPT_GROUPS, Mastery, countMastery, masteryMap, solvedByDay, tempoHistory, weekRhythm } from '../engine/progress';
import { Tip, daySeed, makeTip } from '../engine/tips';
import { localDate } from '../storage/repository';
import { formatRef } from '../content/refs';
import { ChordDiagram } from '../ui/ChordDiagram';
import { ListenButton } from '../ui/ListenButton';
import { RhythmLine } from '../ui/RhythmLine';

const WEEKDAYS = ['dl', 'dt', 'dc', 'dj', 'dv', 'ds', 'dg'];
const ALL = CONCEPT_GROUPS.flatMap((g) => g.cells);

interface Summary {
  map: Record<string, Mastery>;
  solid: number;
  learning: number;
  today: number;
  week: ReturnType<typeof weekRhythm>;
  /** Share of right answers in the last 20 puzzles, or null with fewer than 5. */
  accuracy: number | null;
  reviews: number;
  sessionsDone: number;
  openSession: string | null;
  bestTempo: { title: string; bpm: number } | null;
}

async function load(): Promise<Summary> {
  const [f, attempts, sessions] = await Promise.all([repo.getFeedState(), repo.listAttempts(), repo.listSessions()]);
  const feed = f ?? initialFeedState();
  const map = masteryMap(attempts, feed.reviews);
  const n = countMastery(map, ALL);
  const days = solvedByDay(attempts);
  const recent = attempts.filter((a) => a.puzzle).sort((a, b) => b.at - a.at).slice(0, 20);
  const best = tempoHistory(attempts).filter((s) => s.best).sort((a, b) => b.points[b.points.length - 1].at - a.points[a.points.length - 1].at)[0];
  const open = sessions.filter((s) => s.status === 'in-progress').sort((a, b) => b.createdAt - a.createdAt)[0];
  return {
    map, solid: n.solid, learning: n.learning,
    today: days.find((d) => d.date === localDate())?.solved ?? 0,
    week: weekRhythm(days, new Date()),
    accuracy: recent.length >= 5 ? recent.filter((a) => a.puzzle!.correct).length / recent.length : null,
    reviews: feed.reviews.length,
    sessionsDone: sessions.filter((s) => s.status === 'completed').length,
    openSession: open?.focus.label ?? null,
    bestTempo: best ? { title: best.title, bpm: best.best! } : null,
  };
}

function TipCard({ tip, onAnother }: { tip: Tip; onAnother: () => void }) {
  return (
    <section className="tip-card" data-testid="tip">
      <p className="eyebrow">Per aprendre en un minut · {tip.eyebrow}</p>
      <h2>{tip.title}</h2>
      {tip.rhythm && <RhythmLine groups={tip.rhythm} />}
      {tip.lines.map((l, i) => <p key={i}>{l}</p>)}
      {tip.chords && tip.chords.length > 0 && (
        <div className="diagrams">{tip.chords.map((c) => <ChordDiagram key={c.symbol} voicing={c.voicing} name={c.symbol} />)}</div>
      )}
      <div className="row">
        {tip.listen && <ListenButton what={tip.listen} />}
        <a className="btn" href={`#/teoria?g=${tip.generatorId}&c=${encodeURIComponent(tip.conceptKey)}`}>Posa-t'hi a prova</a>
        <button className="btn ghost" onClick={onAnother}>Un altre</button>
      </div>
      <p className="muted">{formatRef(tip.bookConcept)}</p>
    </section>
  );
}

export function Home() {
  const [s, setS] = useState<Summary | null>(null);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    // Show local data at once; refresh if the other device had something new.
    void load().then(setS);
    void sync.sync().then((changed) => {
      if (changed) void load().then(setS);
    });
  }, []);

  const tip = makeTip(daySeed(new Date()) + bump * 7919, s?.map);
  const active = s?.week.filter((d) => d.active).length ?? 0;
  const pct = s ? Math.round((s.solid / ALL.length) * 100) : 0;

  return (
    <main className="home" data-testid="home">
      <header className="home-head">
        <p className="today">{new Date().toLocaleDateString('ca', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1>Guitarra</h1>
      </header>

      <section className="stats" aria-label="El teu progrés">
        <div className="stat wide">
          <div className="week">
            {(s?.week ?? []).map((d, i) => (
              <span key={d.date} className={`day${d.active ? ' active' : ''}${d.future ? ' future' : ''}`}>{WEEKDAYS[i]}</span>
            ))}
          </div>
          <p className="muted">
            {active === 0 ? 'Aquesta setmana encara no has començat. Un trencaclosques i ja compta.'
              : `${active} ${active === 1 ? 'dia actiu' : 'dies actius'} aquesta setmana${s && s.today > 0 ? ` · ${s.today} resolts avui` : ''}.`}
          </p>
        </div>
        <div className="stat">
          <strong>{s?.solid ?? 0}<span>/{ALL.length}</span></strong>
          <p>conceptes sòlids</p>
          <div className="meter" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
          <p className="muted">{s && s.learning > 0 ? `${s.learning} en curs` : 'Comença per qualsevol'}</p>
        </div>
        <div className="stat">
          <strong>{s?.accuracy == null ? '–' : `${Math.round(s.accuracy * 100)}%`}</strong>
          <p>encerts recents</p>
          <p className="muted">{s?.accuracy == null ? 'Calen 5 respostes' : 'últimes 20 respostes'}</p>
        </div>
        <div className="stat">
          <strong>{s?.bestTempo ? s.bestTempo.bpm : s?.sessionsDone ?? 0}{s?.bestTempo && <span> bpm</span>}</strong>
          <p>{s?.bestTempo ? 'millor tempo net' : 'sessions acabades'}</p>
          <p className="muted">{s?.bestTempo ? s.bestTempo.title : 'Fes la primera sessió'}</p>
        </div>
      </section>

      <h2 className="section-title">Per on vols començar?</h2>
      <nav className="menu" aria-label="Per on començar">
        <a className="card teoria" href="#/teoria" data-testid="start-puzzles">
          <span className="card-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28"><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></svg></span>
          <span className="card-text">
            <strong>Trencaclosques</strong>
            <span>Dos minuts, una mà, sense so.{s && s.reviews > 0 ? ` ${s.reviews} ${s.reviews === 1 ? 'repàs pendent' : 'repassos pendents'}.` : ''}</span>
          </span>
        </a>
        <a className="card practica" href="#/practica">
          <span className="card-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M9 3.5h6l3.5 17h-13z" /><path d="M12 15.5 16.5 6" /><path d="M7.3 15.5h9.4" /></svg></span>
          <span className="card-text">
            <strong>{s?.openSession ? 'Continua la sessió' : 'Sessió de pràctica'}</strong>
            <span>{s?.openSession ? `${s.openSession}, a mig fer.` : '30, 45 o 60 minuts amb la guitarra, al voltant d\'un sol focus.'}</span>
          </span>
        </a>
        <a className="card progres" href="#/progres">
          <span className="card-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M5 20v-6" /><path d="M12 20V5" /><path d="M19 20v-10" /></svg></span>
          <span className="card-text">
            <strong>Progrés</strong>
            <span>El mapa de conceptes, el nivell per àrea i el tempo de cada exercici.</span>
          </span>
        </a>
      </nav>

      <TipCard tip={tip} onAnother={() => setBump((b) => b + 1)} />
    </main>
  );
}
