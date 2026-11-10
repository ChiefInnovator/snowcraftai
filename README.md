# Snowcraft Reforged

Web and native Flutter recreations of the classic 1999 SnowCraft snowball fight.

## Project Overview

The web edition uses **Phaser 4** to replay the 1999 Director rules: fixed-diagonal throws, recovered level layouts, and original power / snowball / drop / melt bitmaps. See [docs/PARITY.md](docs/PARITY.md).

## How to Play

1. Run `python3 -m http.server 8000 -d web` and open http://localhost:8000 (or play online at https://chiefinnovator.github.io/snowcraftai/)
2. Players walk onto the field at the start of each level
3. Click and hold on a red team player to charge a throw
4. Release to throw a snowball at the green team
5. Defeat all green team players to advance to the next level
6. Watch out - the green team throws back!

## Controls

- **Click & Hold** on a player to charge throw power
- **Release** to throw a snowball
- **On a phone:** turn it sideways, touch a kid, hold, slide to move, lift to throw
- Power meter fills in 8 steps over ~0.7 s (longer hold = further throw)

## Game Features

- 10 levels (3, 5, 7, 9, then 12 enemies) and a final score
- Hit animations with stunned states
- Original snowball / drop / melt BITD sequence (height baked into the art)
- 15 shipped original SnowCraft WAVs on a single channel-1 puppetSound path
- Per-level VWSC start positions, including off-stage greens that walk in
- Player selection highlighting
- Win/lose conditions with replay option

## Enhancements over the original

### Web edition

- Runs in modern browsers without the original Director player.
- Mouse and touch controls, responsive sizing, landscape phone play and full screen.
- Crisp browser-rendered lettering for every title, level number, score and replay control, aligned to the stage rather than bitmap registration offsets.
- A choice of original artwork or **35 redrawn HD character frames**, based on the approved Red and Green designs, plus a newly illustrated 4× snowfield. The HD pack exports at 8× logical resolution with original registration and collision masks. Reds face their opponents and fall backward; fallen bodies keep their standing scale. Effects retain smooth 4× versions of their recovered art.
- Independent, saved background-music and mute-all controls; the remake includes intro and background music.
- HD pose shadows with soft edges and grounded contact, plus an open snowfield with opposing forts and a decorated Christmas grove in the top-right corner.
- Easy/Normal/Hard difficulty, clearer selection feedback, and a shadow that follows a dragged kid.
- A cleaner menu with one visible page title, accessible controls and keyboard-operable replay.

### Flutter edition

The native [Flutter game](flutter/README.md) is a separate **landscape-only, enhanced-only** edition. It uses the same redrawn HD character pack as the web HD mode, with native text. Its enhanced movement and aiming, reachable spawn positions, bounded drag speed, and updated audio are documented in its README.

## Run and test

```sh
python3 -m http.server 8000 -d web
npm --prefix web ci
npm --prefix web test
npm --prefix web exec -- playwright install chromium
npm --prefix web run test:browser
cd flutter
flutter pub get
flutter run
```

See [flutter/README.md](flutter/README.md) for platform requirements and native validation.

## Project Structure

- `web/` - Browser game and site root deployed to GitHub Pages
  - `index.html`, `js/game.js`, `js/parity.js`, `js/audio.js`, `css/game.css` - Main game
  - `parity-check.html` - recovered-constant checks
  - `assets/` - Sprites and audio
  - `tests/` and `package.json` - Node and browser regression checks
- `flutter/` - Native Flutter game, platform projects, bundled assets and tests.
- `web/tests/` and `web/package.json` - Browser edition regression checks and local-server command.
- `docs/` - [Specifications](docs/SPECIFICATIONS.md), [original game analysis](docs/reference-app.md), and [original archives](docs/reference/snowcraft-original/)
- `tools/` - Developer scripts
- `docs/reference/snowcraft-original/` - Committed byte-for-byte original EXE/DCR/sounds archives (evidence). Root `reference/` is a gitignored local workspace only.

## Contributing

`develop` is the default branch. Branch from `develop`, open PRs into `develop` (GitHub Copilot reviews them automatically), and release by opening a PR from `develop` into `main`. Only a PR from this repository's `develop` can update `main`; its merge deploys the site. After release, synchronize `main` back into `develop` with a merge PR. See [AGENTS.md](AGENTS.md).

## Rights

Remake code and this site are by **Richard Crane** / **MILL5**. SnowCraft
(1999) art, audio, EXE, and DCR remain with their original rights holders.
Richard Crane and MILL5 are not affiliated with or endorsed by Nicholson NY,
IconMedialab, Macromedia, or Adobe. No explicit license for the original game
was found. Credits are not permission. See [`NOTICE.md`](NOTICE.md) and
[`docs/reference/snowcraft-original/COPYRIGHT-NOTICES.md`](docs/reference/snowcraft-original/COPYRIGHT-NOTICES.md).

## Technical Details

- **Engine**: Phaser 4.2
- **Browser text**: native HTML overlay, independent of sprite filtering and canvas resolution.
- **Canvas**: 592×320 Director stage, scaled with the existing 600×320–1800×960 display options (ground BITD is 600×320 at loc 296,160)
- **Assets**: Recovered original BITD sprites from the 1999 Snowcraft projector

## Gameplay Rules

Rules and timings live in the `RULES` object at the top of `web/js/game.js` and are documented in [docs/SPECIFICATIONS.md](docs/SPECIFICATIONS.md).
