// Web Audio synthesis: plucked notes, strummed chords, metronome clicks and the timer bell. No samples.
import type { Listen } from '../puzzles/types';

let ctx: AudioContext | null = null;

/** Lazily create and resume the audio context. Must be called from a user gesture the first time. */
export function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

const freq = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** One plucked string: a bright attack that decays through a closing low-pass filter. */
export function pluck(midi: number, when: number, duration = 1.2, gain = 0.22): void {
  const ac = audio();
  const osc = ac.createOscillator();
  const filter = ac.createBiquadFilter();
  const amp = ac.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = freq(midi);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(6000, freq(midi) * 8), when);
  filter.frequency.exponentialRampToValueAtTime(Math.max(200, freq(midi) * 1.5), when + duration * 0.6);
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime(gain, when + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(filter).connect(amp).connect(ac.destination);
  osc.start(when);
  osc.stop(when + duration + 0.05);
}

/** Strum low to high. */
export function strum(midi: number[], when: number, duration = 1.6): void {
  midi.forEach((m, i) => pluck(m, when + i * 0.022, duration, 0.16));
}

/** Metronome click; level 2 = downbeat, 1 = group start, 0 = weak. */
export function click(when: number, level: number): void {
  const ac = audio();
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = 'square';
  osc.frequency.value = [900, 1300, 1900][level];
  amp.gain.setValueAtTime([0.08, 0.16, 0.26][level], when);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
  osc.connect(amp).connect(ac.destination);
  osc.start(when);
  osc.stop(when + 0.06);
}

/** Two-tone bell for the end of a block. */
export function bell(): void {
  const t = audio().currentTime + 0.02;
  [76, 83, 88].forEach((m, i) => pluck(m, t + i * 0.18, 1.8, 0.2));
}

/** Play a puzzle's or block's sound. Returns the total duration in seconds. */
export function playListen(l: Listen): number {
  const t0 = audio().currentTime + 0.05;
  switch (l.type) {
    case 'scale':
      l.midi.forEach((m, i) => pluck(m, t0 + i * 0.32, 0.9));
      return l.midi.length * 0.32 + 0.6;
    case 'chord':
      strum(l.midi, t0);
      l.midi.forEach((m, i) => pluck(m, t0 + 1.3 + i * 0.25, 0.8));
      return 1.3 + l.midi.length * 0.25 + 0.6;
    case 'progression':
      l.chords.forEach((c, i) => {
        strum(c, t0 + i * 1.5);
        strum(c, t0 + i * 1.5 + 0.75, 0.9);
      });
      return l.chords.length * 1.5 + 0.5;
    case 'clicks': {
      const step = 60 / l.bpm;
      const bars = 3;
      for (let b = 0; b < bars; b++) l.accents.forEach((a, i) => click(t0 + (b * l.accents.length + i) * step, a));
      return bars * l.accents.length * step + 0.2;
    }
  }
}
