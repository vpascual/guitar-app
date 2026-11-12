// Metronome with look-ahead scheduling, so timing does not depend on timer jitter.
import { audio, click } from './synth';

export class Metronome {
  private timer: number | null = null;
  private nextTime = 0;
  private beat = 0;
  bpm = 80;
  accents: number[] = [2, 0, 0, 0];
  /** Clicks per beat: 2 plays eighth-note subdivisions as weak clicks. */
  onBeat: (index: number) => void = () => {};

  get running(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.running) return;
    const ac = audio();
    this.beat = 0;
    this.nextTime = ac.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const ac = audio();
    while (this.nextTime < ac.currentTime + 0.12) {
      const index = this.beat % this.accents.length;
      click(this.nextTime, this.accents[index]);
      const delay = Math.max(0, (this.nextTime - ac.currentTime) * 1000);
      window.setTimeout(() => this.running && this.onBeat(index), delay);
      this.nextTime += 60 / this.bpm;
      this.beat++;
    }
  }
}
