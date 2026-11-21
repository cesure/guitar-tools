import { freqToPitch, yin, type Pitch } from './yin';

export type { Pitch };

/**
 * Tonhöhenerkennung über Mikrofon oder Audio-Interface (YIN-Algorithmus).
 * Alles läuft lokal im Browser – das Audiosignal verlässt das Gerät nicht.
 *
 * Für Interfaces wie Focusrite oder Pod Go wichtig:
 * - eigener AudioContext mit der Abtastrate des Geräts (Firefox verbindet sonst gar nicht),
 * - es wird genau ein Kanal ausgewertet (Gitarre oft nur auf Eingang 1 oder 2), die anderen nur gemessen,
 * - niedrige Mindestlautstärke, da eine direkt eingesteckte Gitarre leise sein kann.
 */

export type MicError = 'unsupported' | 'denied' | 'notfound' | 'failed';

export interface InputDevice {
  id: string;
  label: string;
}

/** Unterhalb dieses Pegels (RMS) gilt das Signal als Stille. ≈ −56 dBFS */
export const GATE = 0.0015;

export class PitchListener {
  a4 = 440;
  /** Gerät, leer = Standardeingang des Systems */
  deviceId = '';
  /** Ausgewerteter Kanal 1 … n (z. B. Eingang 2 der Focusrite = Kanal 2) */
  channel = 1;

  /** Infos fürs UI */
  channels = 0;
  deviceLabel = '';
  sampleRate = 0;

  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analysers: AnalyserNode[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private recent: number[] = [];
  /** Pegel der letzten Messungen und Zeitpunkt des letzten Anschlags */
  private levelHist: number[] = [];
  private lastAttack = -Infinity;

  /** Pegel-Rückmeldung fürs UI: RMS aller Kanäle (Index 0 = Kanal 1) */
  onLevel: ((levels: number[]) => void) | null = null;

  constructor(private onPitch: (p: Pitch | null) => void) {}

  get running() {
    return this.timer !== null;
  }

  /** Verfügbare Eingänge. Namen liefert der Browser erst nach erteilter Erlaubnis. */
  static async inputs(): Promise<InputDevice[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    return all
      .filter((d) => d.kind === 'audioinput' && d.deviceId !== 'communications')
      .map((d, i) => ({ id: d.deviceId === 'default' ? '' : d.deviceId, label: d.label || `Input ${i + 1}` }));
  }

  async start(): Promise<MicError | null> {
    if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
    const constraints = (deviceId: string): MediaStreamConstraints => ({
      audio: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 2 },
      },
    });

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints(this.deviceId));
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
      // Gespeichertes Gerät nicht mehr da → Standardeingang versuchen
      if (this.deviceId && (name === 'OverconstrainedError' || name === 'NotFoundError')) {
        this.deviceId = '';
        return this.start();
      }
      return name === 'NotFoundError' ? 'notfound' : 'failed';
    }

    try {
      const track = this.stream.getAudioTracks()[0];
      const settings = track.getSettings();
      this.deviceLabel = track.label;
      this.channels = Math.max(1, settings.channelCount ?? 2);
      // AudioContext mit der Abtastrate des Geräts (44,1 / 48 / 96 kHz …)
      try {
        this.ctx = new AudioContext(settings.sampleRate ? { sampleRate: settings.sampleRate } : undefined);
      } catch {
        this.ctx = new AudioContext();
      }
      await this.ctx.resume();
      this.sampleRate = this.ctx.sampleRate;

      const source = this.ctx.createMediaStreamSource(this.stream);
      const splitter = this.ctx.createChannelSplitter(this.channels);
      source.connect(splitter);
      this.analysers = Array.from({ length: this.channels }, (_, i) => {
        const a = this.ctx!.createAnalyser();
        a.fftSize = 4096;
        splitter.connect(a, i);
        return a;
      });
    } catch {
      this.stop();
      return 'failed';
    }

    const bufs = this.analysers.map((a) => new Float32Array(a.fftSize));
    this.timer = setInterval(() => this.tick(bufs), 50);
    return null;
  }

  private tick(bufs: Float32Array<ArrayBuffer>[]) {
    if (!this.ctx || !this.analysers.length) return;
    // Pegel aller Kanäle messen
    const levels = this.analysers.map((a, i) => {
      a.getFloatTimeDomainData(bufs[i]);
      let sum = 0;
      for (const v of bufs[i]) sum += v * v;
      return Math.sqrt(sum / bufs[i].length);
    });
    const ch = Math.min(Math.max(1, this.channel), levels.length) - 1;
    const rms = levels[ch];
    this.onLevel?.(levels);

    // Anschlag = Pegel steigt innerhalb ~150 ms auf mehr als das Doppelte (≈ +6 dB)
    const now = performance.now();
    if (this.levelHist.length >= 3 && rms > GATE * 2 && rms > this.levelHist[0] * 2) this.lastAttack = now;
    this.levelHist.push(rms);
    if (this.levelHist.length > 3) this.levelHist.shift();

    const res = rms > GATE ? yin(bufs[ch], this.ctx.sampleRate) : null;
    if (!res) {
      this.recent = [];
      this.onPitch(null);
      return;
    }
    // Median der letzten Werte → ruhige Anzeige, Ausreißer fallen weg
    this.recent.push(res.freq);
    if (this.recent.length > 5) this.recent.shift();
    const sorted = [...this.recent].sort((a, b) => a - b);
    this.onPitch(freqToPitch(sorted[Math.floor(sorted.length / 2)], rms, this.a4, res.clarity, now - this.lastAttack));
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.analysers = [];
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.recent = [];
    this.levelHist = [];
    this.lastAttack = -Infinity;
  }
}
