# Snowcraft Reforged

A modern, web-based recreation of the classic 1998 snowball fighting game.

## Project Overview

This version uses **Phaser 3** to replay the 1999 Director rules: fixed-diagonal throws, recovered level layouts, and original power / snowball / drop / melt bitmaps. See [docs/PARITY.md](docs/PARITY.md).

## How to Play

1. Run `python3 -m http.server 8000 -d src` and open http://localhost:8000 (or play online at https://chiefinnovator.github.io/snowcraftai/)
2. Players walk onto the field at the start of each level
3. Click and hold on a red team player to charge a throw
4. Release to throw a snowball at the green team
5. Defeat all green team players to advance to the next level
6. Watch out - the green team throws back!

## Controls

- **Click & Hold** on a player to charge throw power
- **Release** to throw a snowball
- Power meter fills in 8 steps over ~0.7 s (longer hold = further throw)

## Game Features

- 10 levels (3, 5, 7, 9, then 12 enemies) and a final score
- Hit animations with stunned states
- Original snowball / drop / melt BITD sequence (height baked into the art)
- Original 16 SnowCraft WAVs on a single channel-1 puppetSound path
- Per-level VWSC start positions, including off-stage greens that walk in
- Player selection highlighting
- Win/lose conditions with replay option

## Project Structure

- `src/` - Site root deployed to GitHub Pages
  - `index.html`, `js/game.js`, `js/parity.js`, `js/audio.js`, `css/game.css` - Main game
  - `parity-check.html` - recovered-constant checks
  - `sprites.html`, `js/sprites.js`, `css/sprites.css` - Sprite viewer showing all animation frames
  - `assets/` - Sprites and audio
- `docs/` - [Specifications](docs/SPECIFICATIONS.md), [original game analysis](docs/reference-app.md), and [original archives](docs/reference/snowcraft-original/)
- `tools/` - Developer scripts
- `docs/reference/snowcraft-original/` - Committed byte-for-byte original EXE/DCR/sounds archives (evidence). Root `reference/` is a gitignored local workspace only.

## Contributing

`develop` is the default branch. Branch from `develop`, open PRs into `develop` (GitHub Copilot reviews them automatically), and release by opening a PR from `develop` into `main`. Pushing to `main` deploys the site. See [AGENTS.md](AGENTS.md).

## Technical Details

- **Engine**: Phaser 3.60
- **Canvas**: 592×320 Director stage, scaled with the existing 600×320–1800×960 display options (ground BITD is 600×320 at loc 296,160)
- **Assets**: Recovered original BITD sprites from the 1999 Snowcraft projector

## Gameplay Rules

Rules and timings live in the `RULES` object at the top of `src/js/game.js` and are documented in [docs/SPECIFICATIONS.md](docs/SPECIFICATIONS.md).
