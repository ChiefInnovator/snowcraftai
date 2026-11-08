# Snowcraft Reforged

A modern, web-based recreation of the classic 1998 snowball fighting game.

## Project Overview

This version uses **Phaser 3** to replicate the original gameplay while introducing "2.5D" physics (snowballs have height and gravity) and a modern AI that scales in difficulty.

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
- Snowball arc trajectories with shadows
- Player selection highlighting
- Win/lose conditions with replay option

## Project Structure

- `src/` - Site root deployed to GitHub Pages
  - `index.html`, `js/game.js`, `css/game.css` - Main game
  - `sprites.html`, `js/sprites.js`, `css/sprites.css` - Sprite viewer showing all animation frames
  - `assets/` - Sprites and audio
- `docs/` - [Specifications](docs/SPECIFICATIONS.md) and [original game analysis](docs/reference-app.md)
- `tools/` - Developer scripts
- `reference/` - Local-only copy of the original game (gitignored)

## Contributing

`develop` is the default branch. Branch from `develop`, open PRs into `develop` (GitHub Copilot reviews them automatically), and release by opening a PR from `develop` into `main`. Pushing to `main` deploys the site. See [AGENTS.md](AGENTS.md).

## Technical Details

- **Engine**: Phaser 3.60
- **Canvas**: 600x320 pixels
- **Assets**: Original sprite sheets from 1998 Snowcraft

## Gameplay Rules

Rules and timings live in the `RULES` object at the top of `src/js/game.js` and are documented in [docs/SPECIFICATIONS.md](docs/SPECIFICATIONS.md).
