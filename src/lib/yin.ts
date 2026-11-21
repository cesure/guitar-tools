/**
 * Tonhöhenerkennung (YIN) – reine Rechnung ohne Browser-Abhängigkeiten, daher auch in Node testbar.
 */

export interface Pitch {
  freq: number;
  /** MIDI-Notennummer (gerundet), z. B. 40 = tiefe E-Saite */
  midi: number;
  /** Abweichung vom nächsten Halbton in Cent (−50 … +50) */
  cents: number;
  /** Lautstärke (RMS) des Signals */
  level: number;
}

/**
 * YIN: findet die Periode eines Signals über die "kumulierte mittlere normierte Differenzfunktion".
 * Robuster gegen Obertöne als eine reine Frequenzanalyse – wichtig bei der Gitarre,
 * deren Obertöne oft lauter sind als der Grundton.
 */
export function yin(buf: Float32Array, sampleRate: number, minFreq = 60, maxFreq = 1400, threshold = 0.15): number | null {
  const half = Math.floor(buf.length / 2);
  const tauMin = Math.max(2, Math.floor(sampleRate / maxFreq));
  const tauMax = Math.min(half - 1, Math.floor(sampleRate / minFreq));
  const d = new Float32Array(tauMax + 2);

  for (let tau = 1; tau <= tauMax + 1; tau++) {
    let sum = 0;
    for (let i = 0; i < half; i++) {
      const delta = buf[i] - buf[i + tau];
      sum += delta * delta;
    }
    d[tau] = sum;
  }

  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    running += d[tau];
    d[tau] = running ? (d[tau] * tau) / running : 1;
  }

  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (d[t] < threshold) {
      while (t + 1 <= tauMax && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;

  // Parabel durch die drei Nachbarwerte → Periode genauer als ein Sample
  const x0 = d[tau - 1];
  const x2 = d[tau + 1];
  const denom = 2 * (2 * d[tau] - x2 - x0);
  const better = denom ? tau + (x2 - x0) / denom : tau;
  return sampleRate / better;
}

export function freqToPitch(freq: number, level: number, a4 = 440): Pitch {
  const exact = 69 + 12 * Math.log2(freq / a4);
  const midi = Math.round(exact);
  return { freq, midi, cents: Math.round((exact - midi) * 100), level };
}

