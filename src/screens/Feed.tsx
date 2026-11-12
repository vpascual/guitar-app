import { useCallback, useEffect, useRef, useState } from 'react';
import type { FretPos } from '../theory/guitar';
import type { Puzzle, SkillArea } from '../puzzles/types';
import { FeedState, Served, initialFeedState, nextPuzzle, recordAnswer } from '../engine/feed';
import { makePuzzle } from '../puzzles/registry';
import { SKILLS } from '../engine/elo';
import { repo } from '../storage';
import { DEFAULT_SETTINGS, DayStats, Settings, localDate } from '../storage/repository';
import { formatRef } from '../content/refs';
import { GLOSSARY } from '../i18n/ca';
import { ChordDiagram } from '../ui/ChordDiagram';
import { Fretboard, FretDot } from '../ui/Fretboard';
import { RhythmLine } from '../ui/RhythmLine';
import { ListenButton } from '../ui/ListenButton';

const SKILL_CA: Record<SkillArea, string> = { modes: 'Modes i escales', chords: 'Acords', harmony: 'Harmonia', rhythm: 'Ritme' };

type Pick = { index: number } | { pos: FretPos };

function Visual({ puzzle, pick, onTap }: { puzzle: Puzzle; pick: Pick | null; onTap: (p: FretPos) => void }) {
  const v = puzzle.visual;
  if (!v) return null;
  switch (v.type) {
    case 'notes':
      return <div className="chips">{v.notes.map((n, i) => <span key={i} className="chip">{n}</span>)}</div>;
    case 'progression':
      return <div className="chips">{v.chords.map((c, i) => <span key={i} className="chip chord-chip">{c}</span>)}</div>;
    case 'diagram':
      return <ChordDiagram voicing={v.voicing} size={1.25} />;
    case 'rhythm':
      return <RhythmLine groups={v.groups} />;
    case 'listen':
      return puzzle.listen ? <ListenButton what={puzzle.listen} big /> : null;
    case 'fretboard': {
      const dots: FretDot[] = [...v.dots];
      if (pick && puzzle.answer.type === 'tap') {
        for (const a of puzzle.answer.accept) dots.push({ ...a, tone: 'good' });
        if ('pos' in pick && !puzzle.answer.accept.some((a) => a.string === pick.pos.string && a.fret === pick.pos.fret)) {
          dots.push({ ...pick.pos, tone: 'bad' });
        }
      }
      return <Fretboard firstFret={v.firstFret} frets={v.frets} dots={dots} onTap={puzzle.answer.type === 'tap' && !pick ? onTap : undefined} />;
    }
  }
}

export function Feed() {
  // The first puzzle is built synchronously from defaults so nothing waits on storage.
  const feed = useRef<FeedState>(initialFeedState());
  const settings = useRef<Settings>(DEFAULT_SETTINGS);
  const day = useRef<DayStats>({ date: localDate(), opens: 1, opensWithSolve: 0, solved: 0 });
  const solvedThisOpen = useRef(false);
  const loaded = useRef<Promise<void> | null>(null);
  const shownAt = useRef(performance.now());

  const [served, setServed] = useState<Served>(() => {
    // Debug aid: ?g=<generator>&seed=<n>&level=<n> pins the first puzzle, for audits and screenshots.
    const q = new URLSearchParams(location.search);
    const g = q.get('g');
    if (g) {
      try {
        return { puzzle: makePuzzle(g, Number(q.get('seed') ?? 1), Number(q.get('level') ?? 1)) };
      } catch { /* unknown generator: fall through to the normal feed */ }
    }
    return nextPuzzle(feed.current, DEFAULT_SETTINGS, Date.now(), Math.random);
  });
  const [pick, setPick] = useState<Pick | null>(null);
  const [hint, setHint] = useState(false);
  const [today, setToday] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [newTerms, setNewTerms] = useState<string[]>([]);
  const [, rerender] = useState(0);

  useEffect(() => {
    loaded.current = (async () => {
      const [f, s, d] = await Promise.all([repo.getFeedState(), repo.getSettings(), repo.getDay(localDate())]);
      if (f) feed.current = f;
      if (s) settings.current = { ...DEFAULT_SETTINGS, ...s };
      day.current = d ? { ...d, opens: d.opens + 1 } : day.current;
      setToday(day.current.solved);
      await repo.saveDay(day.current);
    })().catch(() => undefined);
  }, []);

  const puzzle = served.puzzle;

  const answer = useCallback(async (p: Pick) => {
    if (pick) return;
    setPick(p);
    const correct = puzzle.answer.type === 'choice'
      ? 'index' in p && p.index === puzzle.answer.correctIndex
      : 'pos' in p && puzzle.answer.accept.some((a) => a.string === p.pos.string && a.fret === p.pos.fret);
    const ms = Math.round(performance.now() - shownAt.current);
    await loaded.current;
    const now = Date.now();
    const res = recordAnswer(feed.current, served, correct, hint, now);
    feed.current = res.state;
    // One new term per puzzle keeps the explanation readable in under 30 seconds.
    const unseen = puzzle.terms.filter((t) => GLOSSARY[t] && !settings.current.seenTerms.includes(t)).slice(0, 1);
    setNewTerms(unseen);
    if (unseen.length) settings.current = { ...settings.current, seenTerms: [...settings.current.seenTerms, ...unseen] };
    if (correct) {
      day.current = {
        ...day.current,
        solved: day.current.solved + 1,
        opensWithSolve: day.current.opensWithSolve + (solvedThisOpen.current ? 0 : 1),
      };
      solvedThisOpen.current = true;
      setToday(day.current.solved);
    }
    void repo.saveFeedState(feed.current);
    void repo.saveSettings(settings.current);
    void repo.saveDay(day.current);
    void repo.addAttempt({
      at: now, kind: 'puzzle',
      puzzle: {
        generatorId: puzzle.generatorId, seed: puzzle.seed, level: puzzle.level, conceptKey: puzzle.conceptKey,
        skill: puzzle.skill, correct, ms, usedHint: hint, ratingBefore: res.ratingBefore, ratingAfter: res.ratingAfter,
      },
    });
  }, [pick, puzzle, served, hint]);

  const next = () => {
    setServed(nextPuzzle(feed.current, settings.current, Date.now(), Math.random));
    setPick(null);
    setHint(false);
    setNewTerms([]);
    shownAt.current = performance.now();
    window.scrollTo(0, 0);
  };

  const updateSettings = (s: Settings) => {
    settings.current = s;
    void repo.saveSettings(s);
    rerender((n) => n + 1);
  };

  const exportBackup = async () => {
    const blob = new Blob([JSON.stringify(await repo.exportAll())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `guitarra-${localDate()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      await repo.importAll(JSON.parse(await file.text()) as Record<string, unknown>);
      location.reload();
    } catch {
      window.alert('El fitxer no és una còpia vàlida.');
    }
  };

  const correct = pick && (puzzle.answer.type === 'choice'
    ? 'index' in pick && pick.index === puzzle.answer.correctIndex
    : 'pos' in pick && puzzle.answer.accept.some((a) => a.string === pick.pos.string && a.fret === pick.pos.fret));

  return (
    <main className="feed">
      <header className="topbar">
        <span className="today" title="Trencaclosques resolts avui">avui: {today}</span>
        <nav>
          <a className="btn ghost" href="#/practica">Pràctica</a>
          <button className="btn ghost" onClick={() => setSheet(true)} aria-label="Opcions">⚙</button>
        </nav>
      </header>

      <section className="puzzle" data-testid="puzzle" key={puzzle.id}>
        <p className="skill">{SKILL_CA[puzzle.skill]}{served.review ? ' · repàs' : ''}</p>
        <h1 className="prompt">{puzzle.prompt}</h1>
        <div className="visual"><Visual puzzle={puzzle} pick={pick} onTap={(pos) => void answer({ pos })} /></div>
        {hint && !pick && <p className="hint">{puzzle.hint}</p>}

        {pick && (
          <div className={correct ? 'result ok' : 'result ko'} data-testid="explanation">
            <strong>
              {correct ? 'Correcte.' : puzzle.answer.type === 'choice'
                ? `No. Era: ${puzzle.answer.options[puzzle.answer.correctIndex]}.`
                : 'No. Les posicions bones estan marcades en verd.'}
            </strong>
            <p>{puzzle.explanation}</p>
            {newTerms.map((t) => <p key={t} className="term">{GLOSSARY[t]}</p>)}
            <div className="row">
              {puzzle.listen && <ListenButton what={puzzle.listen} />}
            </div>
            {puzzle.chordHelp && puzzle.chordHelp.length > 0 && (
              <details>
                <summary>Com es toca?</summary>
                <div className="diagrams">
                  {puzzle.chordHelp.map((c) => <ChordDiagram key={c.symbol} voicing={c.voicing} name={c.symbol} />)}
                </div>
              </details>
            )}
            <details>
              <summary>Més</summary>
              <p className="muted">{formatRef(puzzle.bookConcept)}</p>
            </details>
          </div>
        )}
      </section>

      <footer className={puzzle.answer.type === 'choice' && puzzle.answer.options.every((o) => o.length <= 14) ? 'answers two' : 'answers'}>
        {!pick && puzzle.answer.type === 'choice' && puzzle.answer.options.map((o, i) => (
          <button key={i} className="btn option" onClick={() => void answer({ index: i })}>{o}</button>
        ))}
        {!pick && puzzle.answer.type === 'tap' && <p className="muted center">Toca el diapasó.</p>}
        {!pick && puzzle.hint && !hint && (
          <button className="btn ghost" onClick={() => setHint(true)}>Pista</button>
        )}
        {pick && <button className="btn primary next" onClick={next} data-testid="next">Següent</button>}
      </footer>

      {sheet && (
        <div className="sheet" role="dialog" aria-label="Opcions">
          <div className="sheet-body">
            <h2>Opcions</h2>
            <label className="check">
              <input type="checkbox" checked={settings.current.audio}
                onChange={(e) => updateSettings({ ...settings.current, audio: e.target.checked })} />
              Trencaclosques d'oïda (amb auriculars)
            </label>
            <h3>Àrees</h3>
            {SKILLS.map((s) => (
              <label key={s} className="check">
                <input type="checkbox" checked={settings.current.skills.includes(s)}
                  onChange={(e) => {
                    const skills = e.target.checked
                      ? [...settings.current.skills, s]
                      : settings.current.skills.filter((x) => x !== s);
                    if (skills.length) updateSettings({ ...settings.current, skills });
                  }} />
                {SKILL_CA[s]} <span className="muted">· nivell {feed.current.ratings[s]}</span>
              </label>
            ))}
            <p className="muted">
              Avui: {day.current.opens} {day.current.opens === 1 ? 'obertura' : 'obertures'}, {day.current.opensWithSolve} amb
              almenys un trencaclosques resolt. Repassos pendents: {feed.current.reviews.length}.
            </p>
            <div className="row">
              <button className="btn" onClick={() => void exportBackup()}>Exporta una còpia</button>
              <label className="btn">
                Importa una còpia
                <input type="file" accept="application/json" hidden onChange={(e) => void importBackup(e.target.files?.[0])} />
              </label>
            </div>
            <p className="muted">Les dades només viuen en aquest dispositiu. La còpia és un fitxer JSON que guardes tu.</p>
            <button className="btn primary" onClick={() => setSheet(false)}>Tanca</button>
          </div>
        </div>
      )}
    </main>
  );
}
