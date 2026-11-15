// Plucked-string synthesis (Karplus-Strong). Pure functions, so the waveform can be unit tested.

/** Frequency in Hz of a MIDI note (A4 = 69 = 440 Hz). */
export const midiFreq = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** Small deterministic noise source, so a given note always sounds the same. */
function noise(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 2147483648 - 1;
  };
}

/**
 * One plucked string as raw samples.
 *
 * A burst of noise circulates in a delay line one period long. Each pass through a gentle low-pass
 * removes high harmonics faster than low ones, which is how a real string decays: bright attack, mellow tail.
 * `brightness` (0..1) softens the initial burst, like picking nearer the neck.
 */
export function pluckSamples(freq: number, sampleRate: number, seconds: number, brightness = 0.6): Float32Array {
  const period = sampleRate / freq;
  const n = Math.floor(period);
  const frac = period - n;
  const out = new Float32Array(Math.floor(seconds * sampleRate));
  const line = new Float32Array(n + 1);
  const rand = noise(Math.round(freq * 100));

  // Excitation: noise, smoothed by brightness, with the mean removed so the string does not drift.
  let prev = 0;
  let mean = 0;
  for (let i = 0; i <= n; i++) {
    prev = brightness * rand() + (1 - brightness) * prev;
    line[i] = prev;
    mean += prev;
  }
  mean /= n + 1;
  let peak = 0;
  for (let i = 0; i <= n; i++) {
    line[i] -= mean;
    peak = Math.max(peak, Math.abs(line[i]));
  }
  for (let i = 0; i <= n; i++) line[i] /= peak || 1;

  // Higher strings ring shorter; the loss per pass is set so every note decays in about the same time.
  const decaySeconds = Math.max(1.2, 3.2 - freq / 400);
  const loss = 10 ** (-3 / (decaySeconds * freq));
  // First-order all-pass tunes the loop to the exact pitch (the delay line alone is only whole samples).
  const c = (1 - frac) / (1 + frac);
  let apIn = 0;
  let apOut = 0;
  let last = 0;
  let pos = 0;
  for (let i = 0; i < out.length; i++) {
    const x = line[pos];
    out[i] = x;
    const avg = 0.5 * (x + last);
    last = x;
    apOut = c * avg + apIn - c * apOut;
    apIn = avg;
    line[pos] = apOut * loss;
    pos = pos + 1 > n ? 0 : pos + 1;
  }
  // Short fades so the buffer starts and ends without a click.
  const fade = Math.min(out.length, Math.floor(sampleRate * 0.08));
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  const attack = Math.min(out.length, Math.floor(sampleRate * 0.002));
  for (let i = 0; i < attack; i++) out[i] *= i / attack;
  return out;
}
