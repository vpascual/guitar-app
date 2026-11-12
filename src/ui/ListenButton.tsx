import { useState } from 'react';
import type { Listen } from '../puzzles/types';
import { playListen } from '../audio/synth';

/** Optional playback. Sound never starts by itself: the feed stays silent unless this is tapped. */
export function ListenButton({ what, label = 'Escolta', big = false }: { what: Listen; label?: string; big?: boolean }) {
  const [playing, setPlaying] = useState(false);
  return (
    <button
      className={big ? 'btn listen big' : 'btn listen'}
      disabled={playing}
      onClick={() => {
        const seconds = playListen(what);
        setPlaying(true);
        window.setTimeout(() => setPlaying(false), seconds * 1000);
      }}
    >
      {playing ? '♪ sonant…' : `▶ ${label}`}
    </button>
  );
}
