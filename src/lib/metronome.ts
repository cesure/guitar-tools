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

export type MeterId = '2/4' | '3/4' | '4/4' | '5/4' | '6/8' | '7/8' | '12/8';
export type SoundId = 'click' | 'wood' | 'drums';

/** Taktarten: Schläge, Nebenbetonungen (Gruppen) und Schlagzeug-Muster je Schlag (k = Bassdrum, s = Snare). */
export const METERS: Record<MeterId, { beats: number; accents: number[]; drums: string }> = {
  '2/4': { beats: 2, accents: [], drums: 'ks' },
  '3/4': { beats: 3, accents: [], drums: 'kss' },
  '4/4': { beats: 4, accents: [], drums: 'ksks' },
  '5/4': { beats: 5, accents: [3], drums: 'kskks' },
  '6/8': { beats: 6, accents: [3], drums: 'k--s--' },
  '7/8': { beats: 7, accents: [2, 4], drums: 'k-s-k--' },
  '12/8': { beats: 12, accents: [3, 6, 9], drums: 'k--s--k--s--' },
};
export const METER_IDS = Object.keys(METERS) as MeterId[];
export const SOUND_IDS: SoundId[] = ['click', 'wood', 'drums'];

const LOOKAHEAD_S = 0.1;
const INTERVAL_MS = 25;

export class Metronome {
  bpm = 96;
  meter: MeterId = '4/4';
  /** Klicks pro Schlag (1 Viertel, 2 Achtel, 3 Triolen, 4 Sechzehntel) */
  subdivision = 1;
  /** Ersten Schlag (und Gruppenanfänge) betonen */
  accent = true;
  sound: SoundId = 'click';

  private tick = 0;
  private bar = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private noise: AudioBuffer | null = null;

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
    // Nach einer Pause (Tab im Hintergrund, Handy gesperrt) nicht alle verpassten Klicks nachholen
    if (this.nextTime < ac.currentTime - 0.2) this.nextTime = ac.currentTime + 0.05;
    while (this.nextTime < ac.currentTime + LOOKAHEAD_S) {
      const m = METERS[this.meter] ?? METERS['4/4'];
      const sub = Math.max(1, this.subdivision);
      const perBar = m.beats * sub;
      const pos = this.tick % perBar;
      const isBeat = pos % sub === 0;
      const beat = Math.floor(pos / sub);

      if (this.sound === 'drums') this.drums(this.nextTime, isBeat ? m.drums[beat] : '', isBeat);
      else {
        const level = !isBeat ? 0 : !this.accent ? 1 : pos === 0 ? 3 : m.accents.includes(beat) ? 2 : 1;
        this.click(this.nextTime, level);
      }

      if (isBeat && this.cb.onBeat) {
        const delay = Math.max(0, (this.nextTime - ac.currentTime) * 1000);
        setTimeout(() => this.running && this.cb.onBeat?.(beat), delay);
      }

      this.nextTime += 60 / Math.max(1, this.bpm) / sub;
      this.tick++;
      if (this.tick % perBar === 0) {
        this.bar++;
        this.cb.onBar?.(this.bar);
      }
    }
  }

  /** level: 0 Unterteilung, 1 Schlag, 2 Nebenbetonung, 3 Takt-Eins */
  private click(time: number, level: number) {
    const ac = audio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    if (this.sound === 'wood') {
      // Holzblock: kurzer, tiefer Sinus mit schnellem Abklingen
      osc.type = 'sine';
      osc.frequency.setValueAtTime([700, 900, 1000, 1150][level], time);
      osc.frequency.exponentialRampToValueAtTime([500, 650, 720, 820][level], time + 0.03);
      gain.gain.setValueAtTime([0.25, 0.55, 0.65, 0.8][level], time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    } else {
      osc.frequency.value = [800, 1150, 1400, 1700][level];
      gain.gain.setValueAtTime([0.12, 0.3, 0.38, 0.45][level], time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    }
    osc.connect(gain).connect(ac.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  /** Einfacher Schlagzeug-Beat: Hi-Hat auf jedem Klick, dazu Bassdrum/Snare laut Muster. */
  private drums(time: number, hit: string, isBeat: boolean) {
    const ac = audio();
    this.noiseHit(time, isBeat ? 0.12 : 0.07, 7000, 0.04); // Hi-Hat
    if (hit === 'k') {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.frequency.setValueAtTime(140, time);
      osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
      g.gain.setValueAtTime(0.9, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
      osc.connect(g).connect(ac.destination);
      osc.start(time);
      osc.stop(time + 0.26);
    } else if (hit === 's') {
      this.noiseHit(time, 0.4, 1800, 0.14);
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190, time);
      g.gain.setValueAtTime(0.25, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
      osc.connect(g).connect(ac.destination);
      osc.start(time);
      osc.stop(time + 0.1);
    }
  }

  private noiseHit(time: number, volume: number, highpass: number, length: number) {
    const ac = audio();
    if (!this.noise || this.noise.sampleRate !== ac.sampleRate) {
      this.noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.3), ac.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    const filter = ac.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = highpass;
    const g = ac.createGain();
    g.gain.setValueAtTime(volume, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + length);
    src.connect(filter).connect(g).connect(ac.destination);
    src.start(time);
    src.stop(time + length + 0.01);
  }
}
