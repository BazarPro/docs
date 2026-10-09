# BazarPro Hilfe

Dokumentation für [BazarPro](https://github.com/BazarPro/core): Anleitungen für Veranstalter, Verkäufer und Besucher sowie für den eigenen Betrieb (Selfhosting). Live unter **https://docs.bazarpro.de**.

Gebaut mit [Starlight](https://starlight.astro.build).

## Lokal starten

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # statische Seite in dist/
```

## Inhalte

Seiten liegen als Markdown/MDX in `src/content/docs/`. Jede Datei ist eine Seite, die Ordner bilden die Bereiche in der Seitenleiste. Über **„Seite bearbeiten“** auf jeder Seite lässt sich direkt ein Pull Request auf GitHub stellen.

## Screenshots

Die Bilder in `src/assets/screenshots/` werden mit Playwright aus einer laufenden BazarPro-Instanz mit Demo-Daten erzeugt – nie aus Produktion:

```bash
# BazarPro mit Demo-Daten lokal starten (siehe scripts/demo-stack.sh), dann:
BAZARPRO_URL=http://127.0.0.1:5199 npm run screenshots
```

Die Demo-Konten stammen aus dem Seed von BazarPro (`convex/seed.ts`, Passwort `123456`).

## Deployment

Pushes auf `main` bauen die Seite und veröffentlichen sie über GitHub Pages (`.github/workflows/deploy.yml`).
