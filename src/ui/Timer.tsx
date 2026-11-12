import { useEffect, useRef, useState } from 'react';
import { bell } from '../audio/synth';

/** Countdown for a block. Uses wall-clock time so it stays right when the tab is in the background. */
export function Timer({ minutes, onDone }: { minutes: number; onDone?: () => void }) {
  const total = minutes * 60;
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);
  const rung = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const s = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setLeft(s);
      if (s === 0 && !rung.current) {
        rung.current = true;
        bell();
        setRunning(false);
        onDone?.();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [running, onDone]);

  const toggle = () => {
    if (!running) {
      endAt.current = Date.now() + (left || total) * 1000;
      if (left === 0) setLeft(total);
      rung.current = false;
    }
    setRunning(!running);
  };
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <div className="timer">
      <span className={left === 0 ? 'clock done' : 'clock'} role="timer">{mm}:{ss}</span>
      <button className="btn primary" onClick={toggle}>{running ? 'Pausa' : left === 0 ? 'Torna-hi' : left === total ? 'Comença' : 'Continua'}</button>
    </div>
  );
}
