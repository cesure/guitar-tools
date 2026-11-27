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

/* ---------- Protokoll für die Fehlersuche (?debug) ---------- */
export const audioLog: string[] = [];
let lastFail = '';
export function logAudio(msg: string) {
  const d = new Date();
  const t = `${d.toLocaleTimeString('de-DE')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  audioLog.push(`${t} ${msg}`);
  if (audioLog.length > 80) audioLog.shift();
}

function wake(reason = '') {
  if (!ctx || ctx.state === 'running' || ctx.state === 'closed' || resuming) return;
  resuming = true;
  const before = ctx.state;
  ctx.resume()
    .then(() => {
      lastFail = '';
      logAudio(`resume (${reason || 'intern'}) aus ${before} → ${ctx?.state}`);
    })
    .catch((e: Error) => {
      const msg = `resume (${reason || 'intern'}) fehlgeschlagen: ${e?.name ?? ''} ${e?.message ?? e}`;
      if (msg !== lastFail) logAudio(msg); // nicht alle 25 ms dieselbe Meldung
      lastFail = msg;
    })
    .finally(() => (resuming = false));
}

function create() {
  const c = new AudioContext();
  ctx = c;
  (globalThis as { __gtAudio?: AudioContext }).__gtAudio = c; // für die Debug-Anzeige (?debug)
  c.onstatechange = () => {
    if (c !== ctx) return; // alter, gerade geschlossener Kontext
    logAudio(`Zustand → ${c.state}`);
    listeners.forEach((fn) => fn(c.state));
  };
  logAudio(`AudioContext erstellt (${ctx.state}, ${ctx.sampleRate} Hz)`);
}

export function audio(): AudioContext {
  if (!ctx || ctx.state === 'closed') create();
  wake();
  return ctx!;
}

/**
 * Kontext wegwerfen und neu anlegen. Hilft, wenn iOS nach einer Unterbrechung „running“ meldet,
 * aber stumm bleibt. Nur nach einer Nutzeraktion aufrufen.
 */
export function restartAudio() {
  const old = ctx;
  ctx = null;
  void old?.close().catch(() => {});
  create();
  wake('Neustart');
  listeners.forEach((fn) => fn(ctx?.state ?? 'none'));
}

/*
 * Ausgabe-Weg. Standard: direkt auf ctx.destination. Alternative (Test, ?debug): über ein <audio>-Element.
 * Hintergrund: Safari auf dem Mac bindet Web Audio eines Tabs an das Ausgabegerät beim Öffnen des Tabs;
 * wechselt die Standard-Ausgabe (Interface, Kopfhörer), bleibt der Tab stumm. Media-Elemente folgen dem Wechsel.
 */
let viaElement = (() => {
  try {
    return localStorage.getItem('gt-audio-out') === 'element';
  } catch {
    return false;
  }
})();
let outNode: AudioNode | null = null;
let outCtx: AudioContext | null = null;
let el: HTMLAudioElement | null = null;

/** Knoten, an den alle Klänge angeschlossen werden. */
export function output(): AudioNode {
  const c = audio();
  if (!viaElement) return c.destination;
  if (outCtx !== c || !outNode) {
    const dest = c.createMediaStreamDestination();
    const g = c.createGain();
    g.connect(dest);
    el ??= new Audio();
    el.srcObject = dest.stream;
    void el.play().then(() => logAudio('Ausgabe über Audio-Element')).catch((e: Error) => logAudio(`Audio-Element: ${e?.name} ${e?.message}`));
    outNode = g;
    outCtx = c;
  }
  return outNode;
}
export const elementOutput = () => viaElement;
export function setElementOutput(on: boolean) {
  viaElement = on;
  outNode = null;
  if (!on && el) {
    el.pause();
    el.srcObject = null;
  }
  try {
    localStorage.setItem('gt-audio-out', on ? 'element' : 'direct');
  } catch {
    /* ohne Speichern */
  }
  logAudio(`Ausgabe-Weg: ${on ? 'Audio-Element' : 'direkt'}`);
  if (on) output();
}

/** iOS: Ton auch bei Lautlos-Schalter abspielen (wie Musik-Apps). Ab Safari 16.4. */
export function setPlaybackSession(on: boolean) {
  const s = (navigator as { audioSession?: { type: string } }).audioSession;
  if (!s) return logAudio('audioSession nicht verfügbar (kein iOS/Safari 16.4+)');
  s.type = on ? 'playback' : 'auto';
  logAudio(`audioSession.type = ${s.type}`);
}
export const playbackSession = () => (navigator as { audioSession?: { type: string } }).audioSession?.type ?? '–';

/** Gibt es schon eine Audio-Ausgabe? */
export const hasAudio = () => ctx !== null && ctx.state !== 'closed';

/** Aktueller Zustand: none | running | suspended | interrupted (Safari) | closed */
export const audioState = (): string => ctx?.state ?? 'none';

/** Bei Zustandswechsel benachrichtigen. Gibt eine Abmelde-Funktion zurück. */
export function onAudioState(fn: (state: string) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

if (typeof window !== 'undefined') {
  // Nutzeraktion → angehaltenen Kontext wieder starten (Safari erlaubt das nur hier zuverlässig)
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, () => wake(ev), { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    logAudio(`Seite ${document.visibilityState === 'visible' ? 'sichtbar' : 'verborgen'}${ctx ? ` (Audio: ${ctx.state})` : ''}`);
    if (document.visibilityState === 'visible') wake('sichtbar');
  });
  window.addEventListener('pageshow', (e) => {
    logAudio(`pageshow${e.persisted ? ' (aus Zwischenspeicher)' : ''}`);
    wake('pageshow');
  });
  window.addEventListener('pagehide', (e) => logAudio(`pagehide${e.persisted ? ' (in Zwischenspeicher)' : ''}`));
}

/** Gezupfter Ton aus Grundton + Obertönen mit Abklingkurve. */
export function pluck(freq: number, duration = 2.5, volume = 0.5, delay = 0) {
  const ac = audio();
  const now = ac.currentTime + delay;
  const master = ac.createGain();
  master.connect(output());
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
