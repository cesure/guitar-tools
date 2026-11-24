/**
 * Ein gemeinsamer AudioContext für die ganze Seite. Muss nach einer Nutzeraktion erzeugt werden.
 *
 * Safari (vor allem iOS) hält den Kontext an, wenn die Seite in den Hintergrund geht, der Bildschirm
 * gesperrt wird oder die Seite aus dem Zwischenspeicher zurückkommt. Der Zustand heißt dann „suspended“
 * oder – nur Safari – „interrupted“. Die Audio-Uhr steht, es kommt kein Ton. Wieder starten darf die Seite
 * ihn oft nur nach einer Nutzeraktion → jedes Tippen auf der Seite versucht es (siehe unten).
 */
let ctx: AudioContext | null = null;
let resuming = false;
const listeners = new Set<(state: string) => void>();

function wake() {
  if (!ctx || ctx.state === 'running' || ctx.state === 'closed' || resuming) return;
  resuming = true;
  ctx.resume().catch(() => {}).finally(() => (resuming = false));
}

export function audio(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext();
    (globalThis as { __gtAudio?: AudioContext }).__gtAudio = ctx; // für die Debug-Anzeige (?debug)
    ctx.onstatechange = () => listeners.forEach((fn) => fn(ctx?.state ?? 'none'));
  }
  wake();
  return ctx;
}

/** Aktueller Zustand: none | running | suspended | interrupted (Safari) | closed */
export const audioState = (): string => ctx?.state ?? 'none';

/** Bei Zustandswechsel benachrichtigen. Gibt eine Abmelde-Funktion zurück. */
export function onAudioState(fn: (state: string) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

if (typeof window !== 'undefined') {
  // Nutzeraktion → angehaltenen Kontext wieder starten (Safari erlaubt das nur hier zuverlässig)
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, wake, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && wake());
  window.addEventListener('pageshow', wake);
}

/** Gezupfter Ton aus Grundton + Obertönen mit Abklingkurve. */
export function pluck(freq: number, duration = 2.5, volume = 0.5, delay = 0) {
  const ac = audio();
  const now = ac.currentTime + delay;
  const master = ac.createGain();
  master.connect(ac.destination);
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(volume, now + 0.008);
  master.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  [0.5, 0.25, 0.12, 0.06, 0.03].forEach((vol, i) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = i === 0 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq * (i + 1), now);
    g.gain.setValueAtTime(vol, now);
    osc.connect(g).connect(master);
    osc.start(now);
    osc.stop(now + duration);
  });
}
