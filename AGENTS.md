# Snowcraft Reforged — agent guide

Browser snowball-fight game (Phaser 3.60 via CDN, plain JS, no build step). Live at https://chiefinnovator.github.io/snowcraftai/.

## Layout
- `src/` — the deployed site root (GitHub Pages publishes this folder as-is).
  - `index.html` (game page + SEO metadata), `js/game.js` (all game logic), `css/game.css`
  - `sprites.html`, `js/sprites.js`, `css/sprites.css` — sprite/animation viewer dev tool
  - `assets/` — sprites and audio; `robots.txt`, `sitemap.xml`, `llms.txt`
- `docs/` — `SPECIFICATIONS.md` (our rules), `reference-app.md` (original game analysis), `classic-parity-plan.md` (gaps + status), `reference-video-notes.md`
- `NOTICE.md` — third-party material and its permission status
- `tools/reference/` — run (`run-reference.sh`, Wine only — never ScummVM, it hangs) and decompile the original
- `tools/sfx/generate_sfx.py` — synthesizes `src/assets/sfx/*.wav` (all sound effects are ours; regenerate, don't hand-edit)
- `reference/` — original SnowCraft.exe + extracted assets. **Gitignored. Never commit it** (copyrighted, public repo).
- `.github/workflows/` — `pages.yml` (deploy `src/` on push to main), `main-pr-source.yml` (required check)

## Run locally
`python3 -m http.server 8000 -d src` → http://localhost:8000. Audio/asset loading needs a server, not `file://`.

## Branching (enforced by rulesets)
- `develop` is the default/integration branch. Branch `feature/*`, `fix/*`, `chore/*` from `develop`; PR back into `develop`.
- PRs into `develop` get an automatic GitHub Copilot review (ruleset). Do not request reviews manually.
- Release = PR `develop` → `main`. The `require-develop-source` check blocks PRs into `main` from any other branch.
- `main` and `develop`: no direct pushes, no force-push, no deletion. Merge commits only — never rebase.

## Conventions
- Asset paths in JS/HTML are relative to `src/` (`assets/...`). Absolute URLs in SEO tags point at the Pages root.
- Gameplay constants live in `RULES` at the top of `src/js/game.js`; keep `docs/SPECIFICATIONS.md` in sync when they change.
- Use `?debug` for testing: centre line, coordinates, keys `1`–`9`/`0` jump levels, `z` revives reds.
- Coordinates are logical 600×320; the camera is zoomed by the render scale, so use `pointer.worldX/worldY`, never `pointer.x/y`.
- Use the original game's behaviour (`docs/reference-app.md`) as the reference for mechanics, but ship only our own code and assets — nothing extracted from `reference/`.
