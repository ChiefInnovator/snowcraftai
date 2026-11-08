# Snowcraft Reforged

A modern, web-based recreation of the classic 1998 snowball fighting game, with original Director sound and throw rules restored from static analysis of `SnowCraft.exe` (the EXE is never run).

## Project Overview

This version uses **Phaser 3** and the 1998 sprite sheets. Snowball flight, charge, hits-to-KO, and audio follow recovered Lingo (`docs/PARITY.md`). Perfect visual/AI identity with the Director movie is **not** claimed; remaining gaps are listed there.

## How to Play

1. Open `index.html` in a web browser (use a local server for best results)
2. Players walk onto the field at the start of each level
3. Click and hold on a red team player to charge a throw (0–8)
4. Drag to move that player; release to throw along the original isometric diagonal
5. Red players fall after **two** hits; green after **three**
6. Clear the green team to advance (up to 11 named levels)

## Controls

- **Click & Hold** on a red player to move them and charge power
- **Release** to throw (always up-left; greens always throw down-right)
- Longer hold fills the 8-bar meter (about 83 ms per bar)
- **Mute** in the options bar (persists in `localStorage`)

Browsers block audio until a click/tap/key; the first gesture unlocks the sound context.

## Development

- `index.html` — game
- `js/snowcraft-parity.js` — recovered constants and mappings
- `js/snowcraft-audio.js` — channel-1 `puppetSound` / `soundBusy` behavior
- `assets/sounds/` — original 8-bit mono WAVs
- `docs/PARITY.md` — verified / inferred / unverified checklist
- `npm test` — WAV hashes, event wiring, mute/restart, original rules

## Technical Details

- **Engine**: Phaser 3.60
- **Canvas**: 600x320 pixels
- **Assets**: Original sprite sheets from 1998 Snowcraft plus lossless WAV re-wraps of the Director `sndS` samples
