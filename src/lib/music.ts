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

export const MAIN_SCALES: ScaleId[] = ['minor-penta', 'major-penta', 'blues', 'major', 'minor'];
export const MORE_SCALES: ScaleId[] = ['harmonic-minor', 'melodic-minor', 'dorian', 'mixolydian'];

/** Halbtöne vom Grundton der Skala zum Grundton der zugehörigen Dur-Tonart (A-Moll → C-Dur = +3). */
const TO_MAJOR: Record<ScaleId, number> = {
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
 * Die fünf CAGED-Formen einer Skala, so sortiert, dass Form 1 den Grundton der Skala
 * auf der tiefen E-Saite am Anfang hat (Moll-Pentatonik: Form 1 = klassische „Box 1“).
 */
export function cagedShapes(root: number, scale: ScaleId): Shape[] {
  const majorRoot = (root + TO_MAJOR[scale]) % 12;
  const r = (majorRoot - (TUNING[0] % 12) + 12) % 12; // Bund des Dur-Grundtons auf der tiefen E-Saite
  const shapes = CAGED.map((c) => {
    const start = (((r + c.from + 1) % 12) + 12) % 12 - 1; // −1 … 10
    return { name: c.name, from: Math.max(0, start), to: start + (c.to - c.from) };
  });

  const rootFret = (root - (TUNING[0] % 12) + 12) % 12;
  let best = 0;
  let bestDist = Infinity;
  shapes.forEach((sh, i) => {
    for (const f of [rootFret, rootFret + 12]) {
      if (f >= sh.from && f <= sh.to && f - sh.from < bestDist) {
        bestDist = f - sh.from;
        best = i;
      }
    }
  });
  return [...shapes.slice(best), ...shapes.slice(0, best)];
}

/* ---------------- Akkorde ---------------- */

export type ChordQuality = '' | 'm' | '7' | 'maj7' | 'add9' | 'sus2' | 'sus4';
export type ChordGroup = 'major' | 'minor' | 'seventh' | 'variant';

export const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11],
  add9: [0, 2, 4, 7], sus2: [0, 2, 7], sus4: [0, 5, 7],
};

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
