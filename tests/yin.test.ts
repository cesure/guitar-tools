// Prüft die Tonhöhenerkennung mit künstlichen, gitarrenähnlichen Tönen.  Aufruf: ./dc npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freqToPitch, yin } from '../src/lib/yin.ts';

const SR = 48000;
const N = 4096;

/** Ton mit kräftigen Obertönen (teils lauter als der Grundton) und etwas Rauschen. */
function guitarLike(freq: number): Float32Array {
  const amps = [0.6, 1.0, 0.8, 0.5, 0.35, 0.2, 0.12];
  const buf = new Float32Array(N);
  let seed = 1;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.01;
  for (let i = 0; i < N; i++) {
    let v = 0;
    amps.forEach((a, h) => (v += a * Math.sin((2 * Math.PI * freq * (h + 1) * i) / SR + h)));
    buf[i] = v * 0.1 + noise();
  }
  return buf;
}

// Leere Saiten, gegriffene Töne und hohe Lagen
const NOTES = [82.41, 110, 146.83, 196, 246.94, 329.63, 87.31, 130.81, 415.3, 659.26, 880];

for (const base of NOTES) {
  for (const cents of [0, 12, -20]) {
    const freq = base * 2 ** (cents / 1200);
    test(`${freq.toFixed(2)} Hz`, () => {
      const got = yin(guitarLike(freq), SR);
      assert.ok(got, 'kein Ton erkannt');
      const want = freqToPitch(freq, 0.1);
      const p = freqToPitch(got, 0.1);
      assert.equal(p.midi, want.midi, 'falscher Ton / falsche Oktave');
      assert.ok(Math.abs(p.cents - want.cents) <= 2, `Cent-Abweichung ${p.cents} statt ${want.cents}`);
    });
  }
}

test('Stille wird nicht als Ton erkannt', () => {
  const buf = new Float32Array(N);
  let seed = 7;
  for (let i = 0; i < N; i++) buf[i] = ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.002;
  assert.equal(yin(buf, SR), null);
});
