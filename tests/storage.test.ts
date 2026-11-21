import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampInt, load, oneOf } from '../src/lib/storage.ts';

const mem = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
};

const DEF = { bpm: 96, meter: '4/4', ramp: false, strings: [true, true, true] };

test('gültige Werte werden übernommen', () => {
  mem.set('x', JSON.stringify({ bpm: 120, meter: '3/4', ramp: true, strings: [true, false, true] }));
  assert.deepEqual(load('x', DEF), { bpm: 120, meter: '3/4', ramp: true, strings: [true, false, true] });
});

test('kaputte, veraltete oder fremde Daten führen nie zum Absturz', () => {
  for (const raw of ['nicht json{', 'null', '42', '"text"', '[1,2]', '{"bpm":"schnell","meter":null,"strings":[1,2]}', '{"bpm":1e999}']) {
    mem.set('x', raw);
    const v = load('x', DEF);
    assert.equal(typeof v.bpm, 'number', raw);
    assert.equal(typeof v.meter, 'string', raw);
    assert.equal(v.strings.length, 3, raw);
  }
  // Alter Schlüssel (z. B. "beats" aus früheren Versionen) wird ignoriert, neue Schlüssel bekommen den Standard
  mem.set('x', JSON.stringify({ beats: 3, bpm: 100 }));
  assert.deepEqual(load('x', DEF), { ...DEF, bpm: 100 });
});

test('Prüffunktion begrenzt Werte, Fehler darin fallen auf den Standard zurück', () => {
  mem.set('x', JSON.stringify({ bpm: 9999, meter: '13/7' }));
  const v = load('x', DEF, (s) => ({ ...s, bpm: clampInt(s.bpm, 30, 300, 96), meter: oneOf(s.meter, ['4/4', '3/4'], '4/4') }));
  assert.equal(v.bpm, 300);
  assert.equal(v.meter, '4/4');
  assert.deepEqual(load('x', DEF, () => { throw new Error('kaputt'); }), DEF);
});

test('Bestzeiten: nur Zahlen', () => {
  mem.set('b', JSON.stringify({ 'one-10-7': 12345, kaputt: 'x', nan: null }));
  assert.deepEqual(load<Record<string, number>>('b', {}), { 'one-10-7': 12345 });
});
