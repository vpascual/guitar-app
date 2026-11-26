import { useCallback, useEffect, useRef, useState } from 'react';
import type { FretPos } from '../theory/guitar';
import type { Puzzle, SkillArea } from '../puzzles/types';
import { FeedState, Served, initialFeedState, nextPuzzle, normalizeFeedState, recordAnswer } from '../engine/feed';
import { makePuzzle } from '../puzzles/registry';
import { SKILLS } from '../engine/elo';
import { solvedByDay, weekRhythm } from '../engine/progress';
import { repo, sync } from '../storage';
import { formatKey } from '../sync/engine';
import { DEFAULT_SETTINGS, DayStats, Settings, localDate, migrateSettings } from '../storage/repository';
import { formatRef } from '../content/refs';
import { getTopic, topicFor } from '../content/theory';
import { theoryHref } from './Theory';
import { GLOSSARY } from '../i18n/ca';
import { ChordDiagram } from '../ui/ChordDiagram';
import { Fretboard, FretDot } from '../ui/Fretboard';
import { RhythmLine } from '../ui/RhythmLine';
import { FormChart } from '../ui/FormChart';
import { BarGrid } from '../ui/BarGrid';
import { ListenButton } from '../ui/ListenButton';

const SKILL_CA: Record<SkillArea, string> = { modes: 'Modes i escales', chords: 'Acords', harmony: 'Harmonia', rhythm: 'Ritme', form: 'Composició' };

type Pick = { index: number } | { pos: FretPos } | { skip: true };

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
    case 'form':
      return <FormChart blocks={v.blocks} />;
    case 'bars':
      return <BarGrid bars={v.bars} perRow={v.perRow} />;
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
    // "#/teoria?g=<generator>&c=<concept>" starts on one concept (the home tip's "try it" button).
    // "?g=<generator>&seed=<n>&level=<n>" in the page address pins a puzzle, for audits and screenshots.
    const fromHash = new URLSearchParams(location.hash.split('?')[1] ?? '');
    const q = new URLSearchParams(location.search);
    const g = fromHash.get('g') ?? q.get('g');
    if (g) {
      try {
        const seed = q.get('seed') ? Number(q.get('seed')) : Math.floor(Math.random() * 2 ** 31);
        return { puzzle: makePuzzle(g, seed, Number(q.get('level') ?? 1), fromHash.get('c') ?? undefined) };
      } catch { /* unknown generator: fall through to the normal feed */ }
    }
    return nextPuzzle(feed.current, DEFAULT_SETTINGS, Date.now(), Math.random);
  });
  const [pick, setPick] = useState<Pick | null>(null);
  const [hint, setHint] = useState(false);
  const [today, setToday] = useState(0);
  const [weekDays, setWeekDays] = useState<number | null>(null);
  const otherDays = useRef(0);
  const [rating, setRating] = useState<{ after: number; delta: number } | null>(null);
  const [sheet, setSheet] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [newTerms, setNewTerms] = useState<string[]>([]);
  const [, rerender] = useState(0);

  useEffect(() => {
    const readLocal = async () => {
      const [f, s, attempts] = await Promise.all([repo.getFeedState(), repo.getSettings(), repo.listAttempts()]);
      // Counters come from the attempt log, which syncs, so they include what was solved on another device.
      const days = solvedByDay(attempts);
      const solvedToday = days.find((x) => x.date === localDate())?.solved ?? 0;
      otherDays.current = weekRhythm(days.filter((x) => x.date !== localDate()), new Date()).filter((x) => x.active).length;
      setWeekDays(otherDays.current + (solvedToday > 0 ? 1 : 0));
      setToday(solvedToday);
      if (f) feed.current = normalizeFeedState(f);
      if (s) settings.current = migrateSettings({ ...DEFAULT_SETTINGS, ...s, knownSkills: s.knownSkills });
      return f;
    };
    loaded.current = (async () => {
      await readLocal();
      const d = await repo.getDay(localDate());
      day.current = d ? { ...d, opens: d.opens + 1 } : day.current;
      await repo.saveDay(day.current);
      // Sync in the background. If nothing was answered meanwhile, adopt what the other device changed.
      const snapshot = feed.current;
      void sync.sync().then((changed) => {
        if (changed && feed.current === snapshot) void readLocal();
        rerender((n) => n + 1);
      });
    })().catch(() => undefined);
    // Upload when the app goes to the background, which on a phone is the last moment it reliably runs.
    const onHide = () => {
      if (document.visibilityState === 'hidden') void sync.push(true).catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
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
    setRating({ after: res.ratingAfter, delta: res.ratingAfter - res.ratingBefore });
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
      setToday((n) => n + 1);
      setWeekDays(otherDays.current + 1);
    }
    void repo.saveFeedState(feed.current);
    void repo.saveSettings(settings.current);
    void repo.saveDay(day.current);
    await repo.addAttempt({
      at: now, kind: 'puzzle',
      puzzle: {
        generatorId: puzzle.generatorId, seed: puzzle.seed, level: puzzle.level, conceptKey: puzzle.conceptKey,
        skill: puzzle.skill, correct, ms, usedHint: hint, ratingBefore: res.ratingBefore, ratingAfter: res.ratingAfter,
        ...('skip' in p ? { skipped: true } : {}),
      },
    });
    void sync.push().catch(() => undefined);
  }, [pick, puzzle, served, hint]);

  const next = () => {
    setServed(nextPuzzle(feed.current, settings.current, Date.now(), Math.random));
    setPick(null);
    setHint(false);
    setNewTerms([]);
    setRating(null);
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

  const skipped = !!pick && 'skip' in pick;
  const where = topicFor(puzzle.generatorId, puzzle.conceptKey);
  const theory = { href: theoryHref(where.topic, where.anchor), title: getTopic(where.topic)?.title ?? 'Teoria' };
  const correct = pick && (puzzle.answer.type === 'choice'
    ? 'index' in pick && pick.index === puzzle.answer.correctIndex
    : 'pos' in pick && puzzle.answer.accept.some((a) => a.string === pick.pos.string && a.fret === pick.pos.fret));

  return (
    <main className="feed">
      <header className="topbar">
        <span className="today" title="Trencaclosques resolts avui i dies actius aquesta setmana">
          avui: {today}{weekDays !== null && ` · setmana: ${weekDays}/7`}
        </span>
        <nav>
          <button className="btn ghost" onClick={() => setSheet(true)}>Opcions</button>
        </nav>
      </header>

      <section className="puzzle" data-testid="puzzle" data-prompt={puzzle.id} key={puzzle.id}>
        <p className="skill">
          <span>{SKILL_CA[puzzle.skill]}{served.review ? ' · repàs' : ''}</span>
          <span className="level">nivell {feed.current.ratings[puzzle.skill]}</span>
        </p>
        <h1 className="prompt">{puzzle.prompt}</h1>
        <div className="visual"><Visual puzzle={puzzle} pick={pick} onTap={(pos) => void answer({ pos })} /></div>
        {hint && !pick && (
          <div className="hint">
            <p>{puzzle.hint}</p>
            <a href={theory.href}>Repassa la teoria: {theory.title} ›</a>
          </div>
        )}

        {pick && (
          <div className={correct ? 'result ok' : skipped ? 'result skip' : 'result ko'} data-testid="explanation">
            <strong>
              {correct ? 'Correcte.' : skipped ? (puzzle.answer.type === 'choice'
                ? `La resposta és: ${puzzle.answer.options[puzzle.answer.correctIndex]}.`
                : 'Les posicions bones estan marcades en verd.') : puzzle.answer.type === 'choice'
                ? `No. Era: ${puzzle.answer.options[puzzle.answer.correctIndex]}.`
                : 'No. Les posicions bones estan marcades en verd.'}
            </strong>
            <p>{puzzle.explanation}</p>
            <h2 className="steps-title">Pas a pas</h2>
            <ol className="steps" data-testid="steps">{puzzle.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
            <a className={correct ? 'btn theory-link' : 'btn primary theory-link'} href={theory.href} data-testid="theory-link">
              {correct ? 'Més teoria' : 'Aprèn-ho'}: {theory.title} ›
            </a>
            {rating && (
              <p className="rating-line" data-testid="rating">
                {SKILL_CA[puzzle.skill]}: nivell {rating.after}{' '}
                <span className={rating.delta >= 0 ? 'up' : 'down'}>({rating.delta >= 0 ? '+' : '−'}{Math.abs(rating.delta)})</span>
              </p>
            )}
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
        {!pick && (
          <div className="helpers">
            {puzzle.hint && !hint && <button className="btn ghost" onClick={() => setHint(true)}>Pista</button>}
            <button className="btn ghost" onClick={() => void answer({ skip: true })} data-testid="skip">No ho sé</button>
          </div>
        )}
        {pick && <button className="btn primary next" onClick={next} data-testid="next">Següent</button>}
      </footer>

      {sheet && (
        <div className="sheet" role="dialog" aria-label="Opcions">
          <div className="sheet-body">
            <span className="grabber" aria-hidden="true" />
            <h2>Opcions</h2>
            <label className="check">
              <input type="checkbox" checked={settings.current.audio}
                onChange={(e) => updateSettings({ ...settings.current, audio: e.target.checked })} />
              <span>Trencaclosques d'oïda (amb auriculars)</span>
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
                <span>{SKILL_CA[s]} <span className="muted">· nivell {feed.current.ratings[s]}</span></span>
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
            <p className="muted">La còpia és un fitxer JSON que guardes tu.</p>
            <h3>Sincronització entre dispositius</h3>
            {!sync.configured && <p className="muted">No disponible en aquesta versió.</p>}
            {sync.configured && !sync.key && (
              <>
                <p className="muted">
                  Desactivada: les dades només viuen en aquest dispositiu. Activa-la aquí i copia la clau a l'altre
                  dispositiu, o enganxa la clau que ja tens.
                </p>
                <button className="btn" onClick={() => void sync.enable().then(() => sync.sync()).then(() => rerender((n) => n + 1))}>
                  Activa i crea una clau
                </button>
                <div className="row">
                  <input id="sync-key" className="field" placeholder="Clau de l'altre dispositiu" autoCapitalize="characters"
                    autoComplete="off" spellCheck={false} value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
                  <button className="btn" disabled={keyInput.replace(/[^a-z0-9]/gi, '').length < 20}
                    onClick={() => void sync.enable(keyInput).then(() => sync.sync()).then(() => location.reload())}>
                    Connecta
                  </button>
                </div>
              </>
            )}
            {sync.configured && sync.key && (
              <>
                <p className="muted">
                  Activa. {sync.lastSync ? `Última sincronització: ${new Date(sync.lastSync).toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' })}.` : 'Encara no s\'ha sincronitzat.'}
                  {sync.pending > 0 && ` Canvis pendents d'enviar: ${sync.pending}.`}
                </p>
                <p className="key" data-testid="sync-key">{formatKey(sync.key)}</p>
                <p className="muted">Aquesta clau és l'única protecció de les teves dades. Enganxa-la a l'altre dispositiu i no la publiquis.</p>
                <div className="row">
                  <button className="btn" onClick={() => void navigator.clipboard?.writeText(sync.key!).catch(() => undefined)}>Copia la clau</button>
                  <button className="btn" onClick={() => void sync.sync().then(() => rerender((n) => n + 1))}>Sincronitza ara</button>
                  <button className="btn" onClick={() => { sync.disable(); rerender((n) => n + 1); }}>Desactiva</button>
                </div>
              </>
            )}
            <button className="btn primary" onClick={() => setSheet(false)}>Tanca</button>
          </div>
        </div>
      )}
    </main>
  );
}
