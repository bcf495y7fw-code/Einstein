# Einstein (PWA)

A minimalist, offline-capable web remake of the open-source logic puzzle
**Einstein** (itself a remake of the DOS game *Sherlock*). No hints, no undo.

## Rules
- The board is 4×4 or 6×6. Each row contains one full set of symbols
  (numbers, letters, signs, shapes, Greek letters, colors), each exactly once.
- A few cells are revealed at the start. The statements below the board
  describe column relationships between symbols.
- Tap an empty cell, then tap a symbol to place it. Correct placements are
  final; a wrong placement is rejected and costs one of three tries.
- Fill the whole board to win; three misses lose.
- Puzzles are generated randomly and verified by a constraint-propagation
  solver: the solution is unique and reachable purely by logic.

## Run locally
    python3 -m http.server 8000
Then open http://localhost:8000

## Deploy on GitHub Pages
1. Push this folder to a repository (files at the repo root).
2. Settings → Pages → "Deploy from a branch" → `main` / `/ (root)`.
3. Open `https://<user>.github.io/<repo>/` — HTTPS enables install and offline mode.

## Install on iPhone / iPad
Open the page in Safari → Share → **Add to Home Screen**. The game then runs
full-screen and works offline.

## Icons (optional but recommended)
`icon.svg` is included; generate the PNGs once with any SVG→PNG tool, e.g. ImageMagick:

    magick icon.svg -resize 512x512 icon-512.png
    magick icon.svg -resize 192x192 icon-192.png
    magick icon.svg -resize 180x180 apple-touch-icon.png

`manifest.webmanifest` and `index.html` already reference these files.

## Tuning
In `app.js`: `nRevealed` (starting cells), `MAX_MISTAKES` (tries),
`HINT_BASE` (hint-type variety), `SET` palettes in `style.css`.
