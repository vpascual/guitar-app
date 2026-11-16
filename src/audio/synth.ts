// Web Audio output: plucked strings, strummed chords, metronome clicks and the timer bell. No samples are downloaded.
import type { Listen } from '../puzzles/types';
import { midiFreq, pluckSamples } from './string';

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
const buffers = new Map<number, AudioBuffer>();

/** Impulse response of a small room: decaying noise. Gives the dry string some air. */
function roomImpulse(ac: AudioContext): AudioBuffer {
  const len = Math.floor(ac.sampleRate * 1.1);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let a = 12345 + ch * 999;
    for (let i = 0; i < len; i++) {
      a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
      data[i] = (a / 2147483648 - 1) * (1 - i / len) ** 3;
    }
  }
  return buf;
}

// ---- Mobile audio unlocking ----
//
// iPhones route Web Audio through the "ambient" audio session, which the ring/silent switch mutes:
// with the phone on silent, the app makes no sound at all. Two ways around it:
// - iOS 17+ exposes navigator.audioSession; asking for "playback" makes the app ignore the switch, like a music app.
// - Older iOS only switches to playback while an HTML <audio> element is playing, so a silent loop is played
//   for as long as the app is producing sound.

interface AudioSessionNav { audioSession?: { type: string } }

const isAppleMobile = (): boolean =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

let silent: HTMLAudioElement | null = null;
let silentStop = 0;

/** Half a second of silence as an 8-bit mono WAV, built once in memory. */
function silentWavUrl(): string {
  const rate = 8000;
  const n = 4000;
  const v = new DataView(new ArrayBuffer(44 + n));
  const text = (at: number, t: string) => [...t].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF'); v.setUint32(4, 36 + n, true); text(8, 'WAVE'); text(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  text(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([v.buffer], { type: 'audio/wav' }));
}

/**
 * Keep sound audible on a phone in silent mode for the next `seconds`.
 * Must first be called from a tap; later calls extend the window.
 */
export function holdPlayback(seconds: number): void {
  const session = (navigator as Navigator & AudioSessionNav).audioSession;
  if (session) {
    if (session.type !== 'playback') session.type = 'playback';
    return;
  }
  if (!isAppleMobile()) return;
  if (!silent) {
    silent = new Audio(silentWavUrl());
    silent.loop = true;
    silent.setAttribute('playsinline', '');
  }
  if (silent.paused) void silent.play().catch(() => undefined);
  const until = Date.now() + seconds * 1000;
  if (until > silentStop) {
    silentStop = until;
    window.setTimeout(() => {
      if (Date.now() >= silentStop - 50) silent?.pause();
    }, seconds * 1000 + 100);
  }
}

// After the phone locks or another app takes the audio, iOS leaves the context "interrupted".
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') void ctx.resume().catch(() => undefined);
});

/** Lazily create and resume the audio context. Must be called from a user gesture the first time. */
export function audio(): AudioContext {
  if (!ctx) {
    holdPlayback(2);
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    // Everything passes through one chain: guitar-body tone shaping, a touch of room, and a limiter for strums.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    limiter.connect(ctx.destination);

    const body = ctx.createBiquadFilter();
    body.type = 'peaking';
    body.frequency.value = 190;
    body.Q.value = 0.9;
    body.gain.value = 4;
    const air = ctx.createBiquadFilter();
    air.type = 'highshelf';
    air.frequency.value = 4500;
    air.gain.value = -5;
    const rumble = ctx.createBiquadFilter();
    rumble.type = 'highpass';
    rumble.frequency.value = 70;

    const room = ctx.createConvolver();
    room.buffer = roomImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.16;

    out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(rumble).connect(body).connect(air);
    air.connect(limiter);
    air.connect(room).connect(wet).connect(limiter);
  }
  // "suspended" before the first tap, "interrupted" on iOS after a call or the lock screen.
  if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
  return ctx;
}

function stringBuffer(ac: AudioContext, midi: number): AudioBuffer {
  let b = buffers.get(midi);
  if (!b) {
    const samples = pluckSamples(midiFreq(midi), ac.sampleRate, 3);
    b = ac.createBuffer(1, samples.length, ac.sampleRate);
    b.getChannelData(0).set(samples);
    buffers.set(midi, b);
  }
  return b;
}

/** One plucked string. `duration` is how long it rings before being damped, like lifting a finger. */
export function pluck(midi: number, when: number, duration = 1.6, gain = 0.5): void {
  const ac = audio();
  const src = ac.createBufferSource();
  src.buffer = stringBuffer(ac, midi);
  const amp = ac.createGain();
  amp.gain.setValueAtTime(gain, when);
  amp.gain.setValueAtTime(gain, when + duration);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + duration + 0.12);
  src.connect(amp).connect(out!);
  src.start(when);
  src.stop(when + duration + 0.15);
}

/** Strum a chord. Down = low string first; up = high string first and a little softer, as a hand plays it. */
export function strum(midi: number[], when: number, duration = 1.8, up = false): void {
  const order = up ? [...midi].reverse() : midi;
  const level = (up ? 0.26 : 0.34) / Math.sqrt(Math.max(1, midi.length / 3));
  order.forEach((m, i) => pluck(m, when + i * (up ? 0.014 : 0.024), duration, level * (i === 0 ? 1.15 : 1)));
}

/** Metronome click: a short pitched knock, like a woodblock. Level 2 = downbeat, 1 = group start, 0 = weak. */
export function click(when: number, level: number): void {
  const ac = audio();
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  const f = [1050, 1400, 2100][level];
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f * 1.5, when);
  osc.frequency.exponentialRampToValueAtTime(f, when + 0.012);
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime([0.22, 0.4, 0.65][level], when + 0.002);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + [0.035, 0.05, 0.07][level]);
  // Straight to the output: a click should stay dry and sharp, without the room.
  osc.connect(amp).connect(ac.destination);
  osc.start(when);
  osc.stop(when + 0.09);
}

/** Soft three-note chime for the end of a block: sine partials with a slow decay. */
export function bell(): void {
  const ac = audio();
  holdPlayback(3);
  const t = ac.currentTime + 0.02;
  [76, 80, 83].forEach((m, i) => {
    for (const [mult, level] of [[1, 0.2], [2.76, 0.06], [5.4, 0.025]]) {
      const osc = ac.createOscillator();
      const amp = ac.createGain();
      const at = t + i * 0.22;
      osc.frequency.value = midiFreq(m) * mult;
      amp.gain.setValueAtTime(0.0001, at);
      amp.gain.exponentialRampToValueAtTime(level, at + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, at + 2.2 / mult ** 0.5);
      osc.connect(amp).connect(out!);
      osc.start(at);
      osc.stop(at + 2.4);
    }
  });
}

/** Every MIDI note a sound will use, so the strings can be built before timing starts. */
const notesOf = (l: Listen): number[] =>
  l.type === 'scale' || l.type === 'chord' ? l.midi : l.type === 'progression' ? l.chords.flat() : [];

/** Play a puzzle's or block's sound. Returns the total duration in seconds. */
export function playListen(l: Listen): number {
  const ac = audio();
  // Build the string sounds first: on a phone this takes long enough to push the first notes late.
  for (const m of notesOf(l)) stringBuffer(ac, m);
  const t0 = ac.currentTime + 0.08;
  holdPlayback(estimate(l) + 1);
  switch (l.type) {
    case 'scale': {
      // Each note rings into the next, and the last one is held.
      const step = 0.36;
      l.midi.forEach((m, i) => pluck(m, t0 + i * step, i === l.midi.length - 1 ? 1.6 : step * 1.5, 0.5));
      return l.midi.length * step + 1.4;
    }
    case 'chord': {
      // Strummed, then broken up note by note so each chord tone can be heard.
      strum(l.midi, t0, 1.5);
      const step = 0.3;
      l.midi.forEach((m, i) => pluck(m, t0 + 1.7 + i * step, 1.4, 0.42));
      return 1.7 + l.midi.length * step + 1.4;
    }
    case 'progression': {
      // One bar per chord at 92 bpm: down, down-up, down.
      const beat = 60 / 92;
      l.chords.forEach((c, i) => {
        const bar = t0 + i * beat * 4;
        const last = i === l.chords.length - 1;
        strum(c, bar, last ? 2.6 : beat * 1.9);
        if (last) return;
        strum(c, bar + beat * 2, beat * 0.9);
        strum(c, bar + beat * 2.5, beat * 0.45, true);
        strum(c, bar + beat * 3, beat * 0.95);
      });
      return (l.chords.length - 1) * beat * 4 + 2.8;
    }
    case 'clicks': {
      const step = 60 / l.bpm;
      const bars = 3;
      for (let b = 0; b < bars; b++) l.accents.forEach((a, i) => click(t0 + (b * l.accents.length + i) * step, a));
      return bars * l.accents.length * step + 0.2;
    }
  }
}

/** Length of a sound in seconds, matching playListen's timing. */
function estimate(l: Listen): number {
  switch (l.type) {
    case 'scale': return l.midi.length * 0.36 + 1.4;
    case 'chord': return 1.7 + l.midi.length * 0.3 + 1.4;
    case 'progression': return (l.chords.length - 1) * (60 / 92) * 4 + 2.8;
    case 'clicks': return 3 * l.accents.length * (60 / l.bpm) + 0.2;
  }
}
