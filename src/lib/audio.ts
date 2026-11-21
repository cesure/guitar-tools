/** Ein gemeinsamer AudioContext für die ganze Seite. Muss nach einer Nutzeraktion erzeugt werden. */
let ctx: AudioContext | null = null;

export function audio(): AudioContext {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
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
