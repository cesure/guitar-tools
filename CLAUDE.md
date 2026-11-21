# Guitar Tools – Hinweise für Claude

Trainings-Web-App für Gitarrenschüler (vor allem Lagerfeuer-Anfänger): Metronom, Tonfinder, Stimmgerät,
Skalen, Akkord-Finder. Live: https://cesure.github.io/guitar-tools/

## Zusammenarbeit
- **Immer auf Deutsch antworten.**
- **Nichts live stellen ohne Freigabe.** „Live stellen“ heißt: Push auf `main` → GitHub Action baut und
  deployt auf GitHub Pages (Pages-Quelle: „GitHub Actions“). Vorher nur lokal ändern, bauen, testen.
- Die Schrift **Staatliches** nicht verwenden (der User mag sie nicht).

## Musik-Konventionen
- UI ist zweisprachig (Deutsch + Englisch), alle Texte in `src/i18n/ui.ts` – beide Sprachen pflegen.
- Deutsche Tonnamen: **H statt B**, B = B♭. Saiten: E A D G H e.
- Vorzeichen passend zur Tonart (`spelling()` in `src/lib/music.ts`), Blue Note immer mit ♭.
- Skalen-Lagen: nummeriert nach Lage am Griffbrett (1 = nah am Sattel), zusätzlich benannt nach dem
  offenen Griff darin (CAGED; bei Moll-Skalen Moll-Griffe Am/Gm/Em/Dm/Cm).

## Technik
- Astro 7 (statisch) + Svelte 5 (Runes) + TypeScript, PWA via `@vite-pwa/astro`, kein Backend.
- Befehle (in der Cloud direkt npm; lokal läuft alles im Devcontainer bzw. über `./dc`, z. B. `./dc dev`):
  - `npm ci`
  - `npm run dev`
  - `npm run build` – `astro check` + Build, muss fehlerfrei durchlaufen
  - `npm test` – Node-Tests (`tests/*.test.ts`) für die Tonerkennung (YIN)
- Routing: `src/pages/[...path].astro`. Deutsch ohne Präfix, Englisch unter `/en/`, alte `/de/`-Links
  leiten weiter.
- Komponenten: `src/components` (Metronome, Tuner, NoteFinder, ScaleMap, ChordChart, MicPanel,
  AudioSettings, Seg …). Logik: `src/lib` (music.ts, metronome.ts, pitch.ts + yin.ts, audio.ts, storage.ts).
- Einstellungen im localStorage (`gt-theme`, `gt-lang`, `gt-metronome`, `gt-finder`, `gt-chords`,
  `gt-tuner`); Skalen-/Akkordwahl steht in der URL (teilbar).
- Layout: ab 720px Seitenleiste, darunter Tab-Leiste unten. Helles/dunkles Theme über CSS-Variablen.

## Tonerkennung (Feintuning)
Getestet mit Line 6 Pod Go und Focusrite-Interface. Schwellen bei Bedarf hier anpassen:
- `NoteFinder.svelte`: Treffer nach 3 stabilen Messungen; Fehler nur bei clarity ≥ 0.9, 8 Messungen
  und frischem Anschlag.
- `pitch.ts`: Anschlag-Erkennung (Pegelsprung ×2), Gate ≈ −56 dBFS.
