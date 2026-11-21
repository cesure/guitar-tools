import { audio } from './audio';

/**
 * Metronom mit Vorausplanung auf der Audio-Uhr ("lookahead scheduling").
 * Ein Timer läuft alle 25 ms und plant alle Klicks der nächsten 100 ms exakt im AudioContext ein.
 * So bleibt das Timing stabil, auch wenn der Browser-Thread kurz beschäftigt ist.
 */
export interface MetronomeCallbacks {
  /** Wird synchron zum hörbaren Schlag aufgerufen (beat = 0-basiert). */
  onBeat?: (beat: number) => void;
  /** Wird nach jedem vollständigen Takt aufgerufen (bar = Anzahl fertiger Takte). */
  onBar?: (bar: number) => void;
}

const LOOKAHEAD_S = 0.1;
const INTERVAL_MS = 25;

export class Metronome {
  bpm = 96;
  /** Schläge pro Takt (4/4 → 4, 3/4 → 3, 6/8 → 6) */
  beats = 4;
  /** Klicks pro Schlag (1 Viertel, 2 Achtel, 3 Triolen, 4 Sechzehntel) */
  subdivision = 1;
  /** Zusätzliche Betonungen innerhalb des Takts, z. B. Schlag 4 bei 6/8 */
  secondaryAccents: number[] = [];

  private tick = 0;
  private bar = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private cb: MetronomeCallbacks = {}) {}

  get running() {
    return this.timer !== null;
  }

  start() {
    if (this.running) return;
    const ac = audio();
    this.tick = 0;
    this.bar = 0;
    this.nextTime = ac.currentTime + 0.06;
    this.timer = setInterval(() => this.schedule(), INTERVAL_MS);
    this.schedule();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule() {
    const ac = audio();
    while (this.nextTime < ac.currentTime + LOOKAHEAD_S) {
      const perBar = this.beats * this.subdivision;
      const pos = this.tick % perBar;
      const isBeat = pos % this.subdivision === 0;
      const beat = Math.floor(pos / this.subdivision);
      const level = pos === 0 ? 3 : isBeat && this.secondaryAccents.includes(beat) ? 2 : isBeat ? 1 : 0;
      this.click(this.nextTime, level);

      if (isBeat && this.cb.onBeat) {
        const delay = Math.max(0, (this.nextTime - ac.currentTime) * 1000);
        setTimeout(() => this.running && this.cb.onBeat?.(beat), delay);
      }

      this.nextTime += 60 / this.bpm / this.subdivision;
      this.tick++;
      if (this.tick % perBar === 0) {
        this.bar++;
        this.cb.onBar?.(this.bar);
      }
    }
  }

  private click(time: number, level: number) {
    const ac = audio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.frequency.value = [800, 1150, 1400, 1700][level];
    gain.gain.setValueAtTime([0.12, 0.3, 0.38, 0.45][level], time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(gain).connect(ac.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }
}
