import { useEffect, useState } from 'react';
import {
  BlockResult, BuildContext, MaterialState, PracticeBlock, Session, applyResult, buildSession, materialFor,
} from '../engine/session';
import { repo } from '../storage';
import { formatRef } from '../content/refs';
import { ChordDiagram } from '../ui/ChordDiagram';
import { ListenButton } from '../ui/ListenButton';
import { MetronomeControl } from '../ui/Metronome';
import { Tab } from '../ui/Tab';
import { Timer } from '../ui/Timer';
import { RhythmLine } from '../ui/RhythmLine';

const RESULT_CA: Record<BlockResult, string> = { clean: 'Net', sloppy: 'Brut', failed: 'Fallat' };

async function loadContext(): Promise<BuildContext> {
  const [attempts, sessions, materials] = await Promise.all([repo.listAttempts(), repo.listSessions(), repo.getMaterials()]);
  const conceptStats: BuildContext['conceptStats'] = {};
  for (const a of attempts) {
    if (!a.puzzle) continue;
    const st = (conceptStats[a.puzzle.conceptKey] ??= { wrong: 0, total: 0 });
    st.total++;
    if (!a.puzzle.correct) st.wrong++;
  }
  const history = sessions.sort((a, b) => a.createdAt - b.createdAt).map((s) => ({ focusId: s.focus.id, progressionId: s.progressionId }));
  return { conceptStats, history, materials, now: Date.now(), rand: Math.random };
}

function Block({ block, open, onRate }: { block: PracticeBlock; open: boolean; onRate: (r: BlockResult) => void }) {
  return (
    <details className="block" open={open}>
      <summary>
        <span className="block-title">{block.title}</span>
        <span className="badge">{block.minutes} min</span>
        {block.result && <span className={`badge ${block.result}`}>{RESULT_CA[block.result]}</span>}
      </summary>
      <p className="goal"><strong>Objectiu:</strong> {block.goal}</p>
      <div className="tools">
        <Timer minutes={block.minutes} />
        <MetronomeControl accents={block.accents} startBpm={block.startBpm} targetBpm={block.targetBpm} meterLabel={block.meterLabel} />
      </div>
      {block.listen && <div className="row">{block.listen.map((l) => <ListenButton key={l.label} what={l.what} label={l.label} />)}</div>}
      {block.rhythm && <RhythmLine groups={block.rhythm} />}
      <ul className="detail">{block.detail.map((d, i) => <li key={i}>{d}</li>)}</ul>
      {block.tabs.map((t) => <Tab key={t.title} tab={t} />)}
      {block.diagrams.length > 0 && (
        <div className="diagrams">{block.diagrams.map((d) => <ChordDiagram key={d.symbol} voicing={d.voicing} name={d.symbol} />)}</div>
      )}
      {block.chordTones.length > 0 && (
        <table className="tones">
          <thead><tr><th>Acord</th><th>Notes on caure</th><th>Color del mode</th><th>Compte</th></tr></thead>
          <tbody>
            {block.chordTones.map((r) => (
              <tr key={r.chord}><td>{r.chord}</td><td>{r.best}</td><td>{r.colour}</td><td>{r.avoid}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <details className="refs">
        <summary>Referències al llibre</summary>
        <ul>
          {block.bookConcepts.map((c) => <li key={c}>{formatRef(c)}</li>)}
          {block.bookConcepts.length === 0 && <li>{formatRef(null)}</li>}
        </ul>
      </details>
      <div className="rate">
        <span>Com ha anat?</span>
        {(['clean', 'sloppy', 'failed'] as BlockResult[]).map((r) => (
          <button key={r} className={`btn ${r}${block.result === r ? ' chosen' : ''}`} onClick={() => onRate(r)}>{RESULT_CA[r]}</button>
        ))}
      </div>
    </details>
  );
}

export function Practice() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    void repo.listSessions().then((all) => {
      const open = all.filter((s) => s.status === 'in-progress').sort((a, b) => b.createdAt - a.createdAt)[0];
      setSession(open ?? null);
      setDone(all.filter((s) => s.status === 'completed').length);
      setReady(true);
    });
  }, []);

  const start = async (minutes: 30 | 45 | 60) => {
    const s = buildSession(minutes, await loadContext());
    await repo.saveSession(s);
    setSession(s);
  };

  const rate = async (block: PracticeBlock, result: BlockResult) => {
    if (!session || block.result) return;
    const materials: Record<string, MaterialState> = await repo.getMaterials();
    materials[block.materialId] = applyResult(materialFor(materials, block.materialId, block.phase), result);
    const blocks = session.blocks.map((b) => (b.id === block.id ? { ...b, result } : b));
    const next: Session = { ...session, blocks, status: blocks.every((b) => b.result) ? 'completed' : 'in-progress' };
    await Promise.all([
      repo.saveMaterials(materials),
      repo.saveSession(next),
      repo.addAttempt({
        at: Date.now(), kind: 'block',
        block: { sessionId: session.id, blockId: block.id, materialId: block.materialId, result, bpm: block.startBpm },
      }),
    ]);
    setSession(next);
    if (next.status === 'completed') setDone((n) => n + 1);
  };

  const abandon = async () => {
    if (!session) return;
    await repo.saveSession({ ...session, status: 'abandoned' });
    setSession(null);
  };

  if (!ready) return <main className="practice" />;
  const current = session?.blocks.find((b) => !b.result);

  return (
    <main className="practice">
      <header className="topbar">
        <a className="btn ghost" href="#/">← Trencaclosques</a>
        <span className="today">sessions acabades: {done}</span>
      </header>

      {!session && (
        <section className="start">
          <h1>Sessió de pràctica</h1>
          <p>Tria la durada. L'app munta la sessió al voltant d'un sol focus, el que portes més fluix als trencaclosques.</p>
          <div className="durations">
            {([30, 45, 60] as const).map((m) => (
              <button key={m} className="btn primary big" onClick={() => void start(m)}>{m} min</button>
            ))}
          </div>
        </section>
      )}

      {session && (
        <section>
          <h1>{session.focus.label} <span className="badge">{session.minutes} min</span></h1>
          {session.status === 'completed' ? (
            <div className="result ok">
              <strong>Sessió acabada.</strong>
              <p>El tempo de cada exercici s'ha ajustat segons com ha anat. La propera sessió tindrà un altre focus i una altra progressió.</p>
              <button className="btn primary" onClick={() => setSession(null)}>Nova sessió</button>
            </div>
          ) : (
            <p className="muted">Escalfament → tècnica → acords → integració. Valora cada bloc quan l'acabis.</p>
          )}
          {session.blocks.map((b) => (
            <Block key={b.id} block={b} open={b.id === current?.id} onRate={(r) => void rate(b, r)} />
          ))}
          {session.status !== 'completed' && (
            <button className="btn ghost" onClick={() => void abandon()}>Deixa la sessió</button>
          )}
        </section>
      )}
    </main>
  );
}
