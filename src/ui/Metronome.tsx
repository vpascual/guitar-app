import { useEffect, useRef, useState } from 'react';
import { Metronome as Engine } from '../audio/metronome';

/** Metronome control: start/stop, tempo steps, and a dot per beat showing the accent pattern. */
export function MetronomeControl({ accents, startBpm, targetBpm, meterLabel }: {
  accents: number[]; startBpm: number; targetBpm: number; meterLabel: string;
}) {
  const engine = useRef<Engine | null>(null);
  const [bpm, setBpm] = useState(startBpm);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);

  useEffect(() => {
    const e = new Engine();
    e.onBeat = setBeat;
    engine.current = e;
    return () => e.stop();
  }, []);

  useEffect(() => {
    if (engine.current) {
      engine.current.bpm = bpm;
      engine.current.accents = accents;
    }
  }, [bpm, accents]);

  const toggle = () => {
    const e = engine.current!;
    if (e.running) {
      e.stop();
      setBeat(-1);
    } else e.start();
    setRunning(e.running);
  };

  return (
    <div className="metronome">
      <button className="btn primary" onClick={toggle} aria-label="Metrònom">{running ? '■ Atura' : '▶ Metrònom'}</button>
      <div className="bpm">
        <button className="btn" onClick={() => setBpm((b) => Math.max(30, b - 4))} aria-label="Més lent">−</button>
        <span><strong>{bpm}</strong> bpm · {meterLabel}</span>
        <button className="btn" onClick={() => setBpm((b) => Math.min(240, b + 4))} aria-label="Més ràpid">+</button>
      </div>
      <div className="beats" aria-hidden="true">
        {accents.map((a, i) => (
          <span key={i} className={`beat a${a}${i === beat ? ' on' : ''}`} />
        ))}
      </div>
      <p className="muted">Comença a {startBpm} bpm. Objectiu: {targetBpm} bpm.</p>
    </div>
  );
}
