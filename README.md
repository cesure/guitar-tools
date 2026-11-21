# Guitar Tools

Kleine Übungswerkzeuge für Gitarre: **Metronom** mit Tempo-Steigerung, **Stimmgerät**, **Tonfinder** (mit
Tonerkennung übers Mikrofon), **Skalen** mit CAGED-Formen und ein **Akkord-Finder**.

Läuft im Browser, ist als App installierbar (PWA) und funktioniert offline. Kein Server, kein Konto, kein Tracking.

→ **https://cesure.github.io/guitar-tools/**

## Entwicklung

Alles läuft im Devcontainer (Node 22). Auf dem Mac braucht es nur Docker (z. B. Colima).

- **VS Code:** „Reopen in Container“, dann `npm run dev`.
- **Ohne VS Code:** das Skript `./dc` startet Befehle im selben Image:

```bash
./dc npm ci          # Abhängigkeiten installieren
./dc dev             # Dev-Server → http://localhost:4321/guitar-tools/
./dc npm run build   # Typprüfung + Build nach dist/
./dc npm test        # Tests (Tonerkennung)
./dc preview         # fertigen Build inkl. Offline-Modus testen
./dc npm run icons   # App-Icons aus public/favicon.svg erzeugen
```

## Aufbau

| Ordner | Inhalt |
|---|---|
| `src/pages/[...path].astro` | eine Seite pro Sprache und Werkzeug: Deutsch ohne Kürzel (`/skalen/`), Englisch unter `/en/` (`/en/scales/`); Metronom ist die Startseite, alte `/de/…`-Links leiten weiter |
| `src/components/*.svelte` | die interaktiven Werkzeuge |
| `src/lib/` | Musiklogik, Audio, Metronom-Taktgeber, Tonerkennung (YIN) |
| `tests/` | Tests, laufen mit Node ohne Browser |
| `src/i18n/ui.ts` | alle Texte (Deutsch, Englisch) |
| `src/styles/global.css` | Farben (hell/dunkel) und Layout |
| `mockups/` | frühe UI-Entwürfe und die ursprüngliche Ein-Datei-Version |

Veröffentlicht wird automatisch per GitHub Action bei jedem Push auf `main`.
