import type { Lang } from '../i18n/ui';

/** Tonnamen je Sprache – im Deutschen H statt B (und B = B♭). Index = Tonklasse (0 = C). */
export const NOTE_NAMES: Record<Lang, string[]> = {
  de: ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'H'],
  en: ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'],
};
const FLAT_NAMES: Record<Lang, string[]> = {
  de: ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B', 'H'],
  en: ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'],
};
/** Übliche Schreibweise der Grundtöne (Mischung aus ♯ und ♭). */
export const ROOT_NAMES: Record<Lang, string[]> = {
  de: ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B', 'H'],
  en: ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'],
};

export const INTERVALS = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
export const NATURALS = [0, 2, 4, 5, 7, 9, 11];

/* ---------------- Skalen ---------------- */

export const SCALES = {
  'minor-penta': [0, 3, 5, 7, 10],
  'major-penta': [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  'melodic-minor': [0, 2, 3, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
} as const satisfies Record<string, readonly number[]>;
export type ScaleId = keyof typeof SCALES;

/** Reihenfolge: Grundlagen zuerst, Paare (Dur/Moll) nebeneinander. */
export const MAIN_SCALES: ScaleId[] = ['major', 'minor', 'major-penta', 'minor-penta', 'blues'];
export const MORE_SCALES: ScaleId[] = ['harmonic-minor', 'melodic-minor', 'dorian', 'mixolydian'];

/** Halbtöne vom Grundton der Skala zum Grundton der zugehörigen Dur-Tonart (A-Moll → C-Dur = +3). */
export const TO_MAJOR: Record<ScaleId, number> = {
  'minor-penta': 3, 'major-penta': 0, blues: 3, major: 0, minor: 3,
  'harmonic-minor': 3, 'melodic-minor': 3, dorian: 10, mixolydian: 5,
};

/** Töne, die den Klang der Skala ausmachen – werden extra eingefärbt. */
export const CHARACTERISTIC: Partial<Record<ScaleId, number[]>> = {
  blues: [6],
  'harmonic-minor': [11],
  'melodic-minor': [9, 11],
  dorian: [9],
  mixolydian: [10],
};

/** Parallel-Tonart mit denselben Tönen (A-Moll-Pentatonik ↔ C-Dur-Pentatonik). */
export const PARALLEL: Partial<Record<ScaleId, { scale: ScaleId; shift: number }>> = {
  'minor-penta': { scale: 'major-penta', shift: 3 },
  'major-penta': { scale: 'minor-penta', shift: 9 },
  minor: { scale: 'major', shift: 3 },
  major: { scale: 'minor', shift: 9 },
};

/** Tonnamen passend zur Tonart: b-Tonarten (F, B, Es, As, Des und ihre Verwandten) mit ♭, sonst ♯. */
export function spelling(lang: Lang, root: number, scale: ScaleId): string[] {
  const majorKey = (root + TO_MAJOR[scale]) % 12;
  const names = [...([5, 10, 3, 8, 1].includes(majorKey) ? FLAT_NAMES[lang] : NOTE_NAMES[lang])];
  // Die Blue Note ist eine erniedrigte Quinte → immer mit ♭ schreiben (A-Blues: E♭)
  if (scale === 'blues') names[(root + 6) % 12] = FLAT_NAMES[lang][(root + 6) % 12];
  return names;
}

/* ---------------- Griffbrett ---------------- */

/** Standardstimmung als MIDI-Noten, von der tiefen E- zur hohen e-Saite. */
export const TUNING = [40, 45, 50, 55, 59, 64];
export const STRING_LABELS: Record<Lang, string[]> = {
  de: ['E', 'A', 'D', 'G', 'H', 'e'],
  en: ['E', 'A', 'D', 'G', 'B', 'e'],
};

export const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Tiefste Lage (Bund 0–11) eines Tons auf einer Saite, als MIDI-Note. */
export function midiOnString(stringIndex: number, pitchClass: number): number {
  const open = TUNING[stringIndex];
  return open + ((pitchClass - (open % 12) + 12) % 12);
}

/**
 * CAGED-Fenster relativ zum Dur-Grundton auf der tiefen E-Saite (E-Form).
 * Gilt für die Dur-Tonleiter und ihre Pentatonik; Moll & Modi nutzen die Fenster ihrer Dur-Parallele.
 */
const CAGED = [
  { name: 'E', from: -1, to: 2 },
  { name: 'D', from: 1, to: 5 },
  { name: 'C', from: 4, to: 7 },
  { name: 'A', from: 6, to: 10 },
  { name: 'G', from: 9, to: 12 },
];
export interface Shape { name: string; from: number; to: number }

/**
 * Die fünf CAGED-Formen einer Skala, von links nach rechts nach ihrer Lage auf dem Griffbrett sortiert
 * (Form 1 = die Form, die am nächsten am Sattel liegt).
 */
export function cagedShapes(root: number, scale: ScaleId): Shape[] {
  const majorRoot = (root + TO_MAJOR[scale]) % 12;
  const r = (majorRoot - (TUNING[0] % 12) + 12) % 12; // Bund des Dur-Grundtons auf der tiefen E-Saite
  return CAGED.map((c) => {
    const start = (((r + c.from + 1) % 12) + 12) % 12 - 1; // −1 … 10
    return { name: c.name, from: Math.max(0, start), to: start + (c.to - c.from) };
  }).sort((a, b) => a.from - b.from || a.to - b.to);
}

/* ---------------- Akkorde ---------------- */

export type ChordQuality = '' | 'm' | '7' | 'maj7' | 'm7' | 'add9' | 'sus2' | 'sus4';
export type ChordGroup = 'major' | 'minor' | 'seventh' | 'variant';

export const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
  add9: [0, 2, 4, 7], sus2: [0, 2, 7], sus4: [0, 5, 7],
};

/** Akkordarten im Akkord-Finder (für jeden Grundton gibt es mindestens einen Griff). */
export const FINDER_QUALITIES: ChordQuality[] = ['', 'm', '7', 'maj7', 'm7', 'sus2', 'sus4'];

export interface Chord {
  root: number;
  quality: ChordQuality;
  group: ChordGroup;
  /** Lagerfeuer-Grundausstattung */
  basic?: boolean;
  /** Bund je Saite (tiefe E → hohe e); null = nicht spielen, 0 = leer */
  frets: (number | null)[];
  /** Finger je Saite (1 Zeige- … 4 kleiner Finger), 0 = keiner */
  fingers: number[];
  barre?: { fret: number; from: number; to: number };
}

const x = null;
export const CHORDS: Chord[] = [
  { root: 0, quality: '', group: 'major', basic: true, frets: [x, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  { root: 2, quality: '', group: 'major', basic: true, frets: [x, x, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  { root: 4, quality: '', group: 'major', basic: true, frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  { root: 5, quality: '', group: 'major', frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 1, from: 0, to: 5 } },
  { root: 7, quality: '', group: 'major', basic: true, frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  { root: 9, quality: '', group: 'major', basic: true, frets: [x, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },

  { root: 9, quality: 'm', group: 'minor', basic: true, frets: [x, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  { root: 2, quality: 'm', group: 'minor', basic: true, frets: [x, x, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  { root: 4, quality: 'm', group: 'minor', basic: true, frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  { root: 11, quality: 'm', group: 'minor', frets: [x, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 2, from: 1, to: 5 } },

  { root: 9, quality: '7', group: 'seventh', frets: [x, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
  { root: 0, quality: '7', group: 'seventh', frets: [x, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
  { root: 2, quality: '7', group: 'seventh', frets: [x, x, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  { root: 4, quality: '7', group: 'seventh', frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  { root: 7, quality: '7', group: 'seventh', frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  { root: 11, quality: '7', group: 'seventh', frets: [x, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },

  { root: 5, quality: 'maj7', group: 'variant', frets: [x, x, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  { root: 0, quality: 'add9', group: 'variant', frets: [x, 3, 2, 0, 3, 3], fingers: [0, 2, 1, 0, 3, 4] },
  { root: 2, quality: 'sus2', group: 'variant', frets: [x, x, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 2, 0] },
  { root: 2, quality: 'sus4', group: 'variant', frets: [x, x, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3] },
  { root: 9, quality: 'sus2', group: 'variant', frets: [x, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0] },
  { root: 9, quality: 'sus4', group: 'variant', frets: [x, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0] },
];

/**
 * Verschiebbare Griffe: E-Form (Grundton auf der tiefen E-Saite) und A-Form (Grundton auf der A-Saite).
 * Bünde relativ zum Grundton-Bund, Finger für die Barré-Variante.
 */
type Template = { frets: (number | null)[]; fingers: number[]; barre: boolean };
const MOVABLE: Record<'E' | 'A', Partial<Record<ChordQuality, Template>>> = {
  E: {
    '': { frets: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1], barre: true },
    m: { frets: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1], barre: true },
    '7': { frets: [0, 2, 0, 1, 0, 0], fingers: [1, 3, 1, 2, 1, 1], barre: true },
    maj7: { frets: [0, x, 1, 1, 0, x], fingers: [1, 0, 3, 4, 2, 0], barre: false },
    m7: { frets: [0, 2, 0, 0, 0, 0], fingers: [1, 3, 1, 1, 1, 1], barre: true },
    sus4: { frets: [0, 2, 2, 2, 0, 0], fingers: [1, 2, 3, 4, 1, 1], barre: true },
  },
  A: {
    '': { frets: [x, 0, 2, 2, 2, 0], fingers: [0, 1, 2, 3, 4, 1], barre: true },
    m: { frets: [x, 0, 2, 2, 1, 0], fingers: [0, 1, 3, 4, 2, 1], barre: true },
    '7': { frets: [x, 0, 2, 0, 2, 0], fingers: [0, 1, 3, 1, 4, 1], barre: true },
    maj7: { frets: [x, 0, 2, 1, 2, 0], fingers: [0, 1, 3, 2, 4, 1], barre: true },
    m7: { frets: [x, 0, 2, 0, 1, 0], fingers: [0, 1, 3, 1, 2, 1], barre: true },
    sus2: { frets: [x, 0, 2, 2, 0, 0], fingers: [0, 1, 3, 4, 1, 1], barre: true },
    sus4: { frets: [x, 0, 2, 2, 3, 0], fingers: [0, 1, 2, 3, 4, 1], barre: true },
  },
};

export interface Voicing extends Chord {
  kind: 'open' | 'E' | 'A';
  /** Bund des Grundtons (0 = offen) */
  position: number;
}

/** Alle bekannten Griffe für Grundton + Akkordart: offene zuerst, dann nach Lage sortiert. */
export function chordVoicings(root: number, quality: ChordQuality): Voicing[] {
  const out: Voicing[] = [];
  const key = (frets: (number | null)[]) => frets.join(',');

  (['E', 'A'] as const).forEach((shape) => {
    const tpl = MOVABLE[shape][quality];
    if (!tpl) return;
    const open = TUNING[shape === 'E' ? 0 : 1] % 12;
    const r = (root - open + 12) % 12;
    const frets = tpl.frets.map((f) => (f === null ? null : f + r));
    // Offene Variante: Finger rücken um eins nach unten, leere Saiten brauchen keinen Finger
    const fingers = tpl.fingers.map((fg, i) => (frets[i] === null ? 0 : r === 0 ? (frets[i] === 0 ? 0 : fg - 1) : fg));
    const zeroStrings = tpl.frets.flatMap((f, i) => (f === 0 ? [i] : []));
    out.push({
      root, quality, group: 'major', frets, fingers, kind: r === 0 ? 'open' : shape, position: r,
      barre: tpl.barre && r > 0 ? { fret: r, from: zeroStrings[0], to: zeroStrings[zeroStrings.length - 1] } : undefined,
    });
  });

  // Offene Griffe aus der Sammlung ergänzen (z. B. C, G, D, Cadd9)
  CHORDS.filter((c) => c.root === root && c.quality === quality).forEach((c) => {
    if (!out.some((v) => key(v.frets) === key(c.frets))) {
      out.push({ ...c, kind: c.barre ? (c.frets[0] === null ? 'A' : 'E') : 'open', position: c.barre?.fret ?? 0 });
    }
  });

  return out.sort((a, b) => (a.kind === 'open' ? 0 : 1) - (b.kind === 'open' ? 0 : 1) || a.position - b.position);
}

/** Tonklassen, die ein Griff tatsächlich erklingen lässt (tiefste zuerst, ohne Doppelte). */
export function chordPitchClasses(chord: Chord): number[] {
  const pcs: number[] = [];
  chord.frets.forEach((f, i) => {
    if (f === null) return;
    const pc = (TUNING[i] + f) % 12;
    if (!pcs.includes(pc)) pcs.push(pc);
  });
  return pcs;
}
