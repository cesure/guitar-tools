import { audio } from './audio';
import { freqToPitch, yin, type Pitch } from './yin';

export type { Pitch };

/**
 * Tonhöhenerkennung über das Mikrofon mit dem YIN-Algorithmus.
 * Alles läuft lokal im Browser – das Audiosignal verlässt das Gerät nicht.
 */

export type MicError = 'unsupported' | 'denied' | 'failed';

/** Mikrofon öffnen und regelmäßig erkannte Tonhöhen melden (null = Stille/unklar). */
export class PitchListener {
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private recent: number[] = [];
  a4 = 440;

  constructor(private onPitch: (p: Pitch | null) => void) {}

  get running() {
    return this.timer !== null;
  }

  async start(): Promise<MicError | null> {
    if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (e) {
      return (e as DOMException)?.name === 'NotAllowedError' ? 'denied' : 'failed';
    }
    const ctx = audio();
    const source = ctx.createMediaStreamSource(this.stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 4096;
    source.connect(this.analyser);
    const buf = new Float32Array(this.analyser.fftSize);

    this.timer = setInterval(() => {
      if (!this.analyser) return;
      this.analyser.getFloatTimeDomainData(buf);
      let rms = 0;
      for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
      rms = Math.sqrt(rms / buf.length);
      const freq = rms > 0.008 ? yin(buf, ctx.sampleRate) : null;
      if (!freq) {
        this.recent = [];
        this.onPitch(null);
        return;
      }
      // Median der letzten Werte → ruhige Anzeige, Ausreißer fallen weg
      this.recent.push(freq);
      if (this.recent.length > 5) this.recent.shift();
      const sorted = [...this.recent].sort((a, b) => a - b);
      this.onPitch(freqToPitch(sorted[Math.floor(sorted.length / 2)], rms, this.a4));
    }, 50);
    return null;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.analyser = null;
    this.recent = [];
  }
}
