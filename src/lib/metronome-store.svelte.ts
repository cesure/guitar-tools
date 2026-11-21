import { METER_IDS, Metronome, SOUND_IDS, type MeterId, type SoundId } from './metronome';
import { clampInt, load, oneOf, save } from './storage';

/**
 * Ein Metronom für die ganze App. Es lebt außerhalb der Seiten-Komponenten,
 * damit es beim Wechsel zu Skalen oder Akkorden weiterläuft (Seitenwechsel ohne Neuladen, siehe AppLayout).
 */
export const BPM_MIN = 30;
export const BPM_MAX = 300;
export const clampBpm = (v: number) => clampInt(v, BPM_MIN, BPM_MAX, 96);

const DEFAULTS = {
  bpm: 96,
  meter: '4/4' as MeterId,
  subdivision: 1,
  accent: true,
  sound: 'click' as SoundId,
  ramp: false,
  rampStep: 5,
  rampEvery: 4,
  rampTarget: 140,
};

function loadSettings() {
  return load('gt-metronome', DEFAULTS, (v) => ({
    bpm: clampBpm(v.bpm),
    meter: oneOf(v.meter, METER_IDS, '4/4'),
    subdivision: oneOf(v.subdivision, [1, 2, 3, 4], 1),
    accent: v.accent,
    sound: oneOf(v.sound, SOUND_IDS, 'click'),
    ramp: v.ramp,
    rampStep: clampInt(v.rampStep, 1, 50, 5),
    rampEvery: clampInt(v.rampEvery, 1, 64, 4),
    rampTarget: clampBpm(v.rampTarget),
  }));
}

class MetronomeStore {
  s = $state(loadSettings());
  running = $state(false);
  beat = $state(-1);
  bar = $state(0);

  private wakeLock: WakeLockSentinel | null = null;
  private taps: number[] = [];

  private engine = new Metronome({
    onBeat: (b) => (this.beat = b),
    onBar: (n) => {
      this.bar = n;
      const { ramp, rampEvery, rampStep, rampTarget, bpm } = this.s;
      // Zahlenfelder können kurz leer sein (null) → dann nichts tun
      if (ramp && rampEvery > 0 && rampStep > 0 && rampTarget > 0 && n % rampEvery === 0 && bpm < rampTarget) {
        this.s.bpm = Math.min(clampBpm(rampTarget), bpm + rampStep);
      }
    },
  });

  constructor() {
    if (typeof window === 'undefined') return;
    $effect.root(() => {
      $effect(() => save('gt-metronome', $state.snapshot(this.s)));
      // Einstellungen live ans Metronom geben – auch ungültige Zwischenwerte abfangen
      $effect(() => {
        this.engine.bpm = clampBpm(this.s.bpm);
        this.engine.meter = oneOf(this.s.meter, METER_IDS, '4/4');
        this.engine.subdivision = oneOf(this.s.subdivision, [1, 2, 3, 4], 1);
        this.engine.accent = this.s.accent !== false;
        this.engine.sound = oneOf(this.s.sound, SOUND_IDS, 'click');
      });
    });
    // Das System gibt die Bildschirmsperre frei, sobald die App in den Hintergrund geht → beim Zurückkommen neu holen
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.running) void this.keepScreenOn();
    });
  }

  start() {
    if (this.running) return;
    this.bar = 0;
    this.engine.start();
    this.running = true;
    void this.keepScreenOn();
  }

  stop() {
    this.engine.stop();
    this.running = false;
    this.beat = -1;
    void this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
  }

  toggle() {
    if (this.running) this.stop();
    else this.start();
  }

  /** Tempo tippen: Abstand der letzten Tipps mitteln; nach 2 s Pause beginnt eine neue Messung. */
  tap() {
    const now = performance.now();
    if (this.taps.length && now - this.taps[this.taps.length - 1] > 2000) this.taps = [];
    this.taps.push(now);
    if (this.taps.length > 6) this.taps.shift();
    if (this.taps.length < 2) return false;
    const avg = (this.taps[this.taps.length - 1] - this.taps[0]) / (this.taps.length - 1);
    this.s.bpm = clampBpm(60000 / avg);
    return true;
  }

  private async keepScreenOn() {
    try {
      this.wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      this.wakeLock = null;
    }
  }
}

export const metronome = new MetronomeStore();
