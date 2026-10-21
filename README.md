# BazarPro Docs

Dokumentation für [BazarPro](https://github.com/BazarPro/core): Anleitungen für Veranstalter, Verkäufer und Besucher sowie für den eigenen Betrieb (Selfhosting). Live unter **https://docs.bazarpro.de**.

Gebaut mit [Starlight](https://starlight.astro.build).

## Lokal starten

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # statische Seite in dist/
```

## Inhalte

Seiten liegen als Markdown/MDX in `src/content/docs/`. Jede Datei ist eine Seite, die Ordner bilden die Bereiche in der Seitenleiste.

Die englische Übersetzung liegt in `src/content/docs/en/` unter **demselben Dateinamen** wie das deutsche Original, z. B. `en/ratgeber/kinderbasar-organisieren.mdx`. Nur so verknüpft Starlight beide Sprachen (Sprachumschalter, `hreflang`). Fehlt eine Übersetzung, zeigt `/en/…` die deutsche Seite mit einem Hinweis. Links in englischen Seiten beginnen mit `/en/`. Über **„Seite bearbeiten“** auf jeder Seite lässt sich direkt ein Pull Request auf GitHub stellen.

## Screenshots

Die Bilder in `src/assets/screenshots/` werden mit Playwright aus einer laufenden BazarPro-Instanz mit Demo-Daten erzeugt – nie aus Produktion:

```bash
# BazarPro mit Demo-Daten lokal starten (siehe scripts/demo-stack.sh), dann:
BAZARPRO_URL=http://127.0.0.1:5199 npm run screenshots
```

Das Skript erzeugt jedes Bild auf Deutsch (`src/assets/screenshots/`) und Englisch (`src/assets/screenshots/en/`). Für die Kasse bekommt Chromium eine Fake-Kamera mit einem Standbild aus `public/boerse.webp`, dafür muss `ffmpeg` installiert sein.

Die Demo-Konten stammen aus dem Seed von BazarPro (`bazarpro-backend seed`, `backend/src/demo`, Passwort `123456`). Für `scripts/demo-stack.sh` braucht es Docker, Rust (cargo) und Node.

## Deployment

Pushes auf `main` bauen die Seite und veröffentlichen sie über GitHub Pages (`.github/workflows/deploy.yml`).

## Lizenz

[MIT](./LICENSE) – wie BazarPro selbst.
