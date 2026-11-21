import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHORD_INTERVALS, CHORDS, FINDER_QUALITIES, NOTE_NAMES, ROOT_NAMES, SCALES, TUNING,
  cagedShapes, chordPitchClasses, chordVoicings, spelling, type ScaleId,
} from '../src/lib/music.ts';

const ALL_ROOTS = [...Array(12).keys()];

/* ---------------- Akkorde ---------------- */

test('jeder Griff klingt genau mit den Tönen seines Akkords, Grundton im Bass', () => {
  let count = 0;
  for (const root of ALL_ROOTS) {
    for (const q of FINDER_QUALITIES) {
      const voicings = chordVoicings(root, q);
      assert.ok(voicings.length > 0, `kein Griff für ${NOTE_NAMES.en[root]}${q}`);
      for (const v of voicings) {
        count++;
        const name = `${NOTE_NAMES.en[root]}${q} [${v.frets.join(' ')}]`;
        const wanted = CHORD_INTERVALS[q].map((i) => (root + i) % 12);
        const pcs = chordPitchClasses(v);
        assert.equal(pcs[0], root, `${name}: Grundton nicht im Bass`);
        for (const pc of pcs) assert.ok(wanted.includes(pc), `${name}: fremder Ton ${NOTE_NAMES.en[pc]}`);
        // Terz bzw. sus-Ton muss klingen, sonst ist der Akkord nicht eindeutig
        const third = CHORD_INTERVALS[q][1];
        assert.ok(pcs.includes((root + third) % 12), `${name}: Terz/sus-Ton fehlt`);
        assert.ok(v.frets.filter((f) => f !== null).length >= 3, `${name}: zu wenige Saiten`);
      }
    }
  }
  assert.ok(count >= 150, `nur ${count} Griffe`);
});

test('Griffe sind spielbar: Finger passen zu den Bünden, Spannweite höchstens 4 Bünde', () => {
  const all = [...CHORDS, ...ALL_ROOTS.flatMap((r) => FINDER_QUALITIES.flatMap((q) => chordVoicings(r, q)))];
  for (const c of all) {
    const name = `${NOTE_NAMES.en[c.root]}${c.quality} [${c.frets.join(' ')}]`;
    assert.equal(c.frets.length, 6, name);
    assert.equal(c.fingers.length, 6, name);
    c.frets.forEach((f, i) => {
      if (f === null || f === 0) assert.equal(c.fingers[i], 0, `${name}: Finger auf leerer/stummer Saite ${i}`);
      else assert.ok(c.fingers[i] >= 1 && c.fingers[i] <= 4, `${name}: Saite ${i} ohne Finger`);
    });
    const fretted = c.frets.filter((f): f is number => f !== null && f > 0);
    if (fretted.length) assert.ok(Math.max(...fretted) - Math.min(...fretted) <= 3, `${name}: zu weit gespreizt`);
    if (c.barre) {
      for (let i = c.barre.from; i <= c.barre.to; i++) {
        const f = c.frets[i];
        assert.ok(f === null || f >= c.barre.fret, `${name}: Saite ${i} unter dem Barré`);
      }
    }
  }
});

test('Griffliste ohne Doppelte, offene Griffe zuerst', () => {
  for (const root of ALL_ROOTS) {
    for (const q of FINDER_QUALITIES) {
      const v = chordVoicings(root, q);
      const keys = v.map((c) => c.frets.join(','));
      assert.equal(new Set(keys).size, keys.length, `${root}${q}: doppelter Griff`);
      const firstBarre = v.findIndex((c) => c.kind !== 'open');
      if (firstBarre >= 0) assert.ok(v.slice(firstBarre).every((c) => c.kind !== 'open'), `${root}${q}: Reihenfolge`);
    }
  }
});

test('Lagerfeuer-Grundgriffe sind dabei', () => {
  const has = (root: number, q: '' | 'm', frets: (number | null)[]) =>
    chordVoicings(root, q).some((v) => v.frets.join() === frets.join());
  assert.ok(has(0, '', [null, 3, 2, 0, 1, 0]), 'C');
  assert.ok(has(7, '', [3, 2, 0, 0, 0, 3]), 'G');
  assert.ok(has(2, '', [null, null, 0, 2, 3, 2]), 'D');
  assert.ok(has(9, 'm', [null, 0, 2, 2, 1, 0]), 'Am');
  assert.ok(has(4, 'm', [0, 2, 2, 0, 0, 0]), 'Em');
});

/* ---------------- Tonnamen ---------------- */

test('Deutsch: H statt B, B = B♭', () => {
  assert.equal(NOTE_NAMES.de[11], 'H');
  assert.equal(ROOT_NAMES.de[10], 'B');
  assert.equal(ROOT_NAMES.en[11], 'B');
  assert.equal(ROOT_NAMES.en[10], 'B♭');
  // F-Dur hat ein B (nicht A♯), auf Deutsch heißt es "B"
  assert.equal(spelling('de', 5, 'major')[10], 'B');
  assert.equal(spelling('en', 5, 'major')[10], 'B♭');
});

test('Vorzeichen passend zur Tonart', () => {
  assert.equal(spelling('en', 7, 'major')[6], 'F♯'); // G-Dur: F♯
  assert.equal(spelling('en', 2, 'minor')[10], 'B♭'); // D-Moll: B♭
  assert.equal(spelling('en', 4, 'major')[1], 'C♯'); // E-Dur: C♯
  assert.equal(spelling('en', 9, 'blues')[3], 'E♭'); // A-Blues: Blue Note E♭
  // Jede Skala: kein Stammton doppelt (z. B. nicht A und A♯ in derselben Tonleiter).
  // Ausnahme Fis-/Ges-Dur (6 Vorzeichen): E♯ bzw. C♭ gibt es in der Namenstabelle nicht.
  const TO_MAJ: Record<string, number> = { major: 0, minor: 3, dorian: 10, mixolydian: 5 };
  for (const root of ALL_ROOTS) {
    for (const scale of ['major', 'minor', 'dorian', 'mixolydian'] as ScaleId[]) {
      if ((root + TO_MAJ[scale]) % 12 === 6) continue;
      const names = spelling('en', root, scale);
      const letters = SCALES[scale].map((i) => names[(root + i) % 12][0]);
      assert.equal(new Set(letters).size, letters.length, `${ROOT_NAMES.en[root]} ${scale}: ${letters.join(' ')}`);
    }
  }
});

/* ---------------- CAGED-Lagen ---------------- */

test('fünf Lagen, aufsteigend sortiert, alle Buchstaben C A G E D', () => {
  for (const root of ALL_ROOTS) {
    for (const scale of Object.keys(SCALES) as ScaleId[]) {
      const shapes = cagedShapes(root, scale);
      assert.equal(shapes.length, 5);
      assert.deepEqual(shapes.map((s) => s.name).sort(), ['A', 'C', 'D', 'E', 'G']);
      for (let i = 1; i < 5; i++) assert.ok(shapes[i].from >= shapes[i - 1].from, `${root} ${scale}: Reihenfolge`);
      for (const s of shapes) assert.ok(s.from >= 0 && s.to <= 15 && s.to > s.from, `${root} ${scale}: Bereich`);
    }
  }
});

test('Lagen enthalten den passenden Grundton (A-Moll-Pentatonik, C-Dur)', () => {
  const am = cagedShapes(9, 'minor-penta');
  // Lage um den 5. Bund (klassische "Box 1") enthält das A auf der tiefen E-Saite im 5. Bund
  const box = am.find((s) => s.from <= 5 && s.to >= 5 && s.name === 'G');
  assert.ok(box, 'Box im 5. Bund fehlt');
  const c = cagedShapes(0, 'major');
  assert.equal(c[0].name, 'C');
  assert.equal(c[0].from, 0);
  // Jede Lage einer Dur-Tonleiter enthält mindestens einen Grundton
  for (const root of ALL_ROOTS) {
    for (const s of cagedShapes(root, 'major')) {
      const hasRoot = TUNING.some((open) => {
        for (let f = s.from; f <= s.to; f++) if ((open + f) % 12 === root) return true;
        return false;
      });
      assert.ok(hasRoot, `${root}: Lage ${s.name} ohne Grundton`);
    }
  }
});
