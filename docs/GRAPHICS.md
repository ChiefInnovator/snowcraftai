# Original SnowCraft graphics parity

Exact recreation of the 1999 Director 8 movie’s **internal** graphics. Outer
browser chrome, GitHub Pages hosting, and a click-to-unlock title (browsers
block audio until a gesture) are platform compatibility, not gameplay redesign.
No new player-facing controls, settings, pause, or onboarding were added in
this pass.

Evidence is static BITD / VWSC / DRCF parse of
`docs/reference/snowcraft-original/extracted/SnowCraft.exe` (never executed).

## Verified (recovered and wired)

| Item | Original | Remake now |
|---|---|---|
| Stage | DRCF **592×320** | Logical canvas 592×320, uniformly FIT into Rich’s 600×320–1800×960 scaler |
| Ground | Member 69 `ground` 600×320, loc **(296,160)**, reg (300,160), ink **copy** | `069_ground.png` at that loc/reg (4 px overhang each side, clipped) |
| Kids 1–36 | PackBits BITD, matte index 0, registration from CASt | `src/assets/cast/00n_*.png` |
| Shadow | Member 1, loc = kid loc, ink matte | recovered BITD at kid loc |
| Power 0–8 | Members 37–45, loc = kid loc, reg x = −27 | BITDs at kid loc (not offset +15) |
| Snowball / drop / splat / melt | Members 57–66, height in the bitmap | recovered BITDs, registration applied |
| Title | Member 76 “SnowCraft” 122×22 at (296,160) after walk-on | `076_1.png` |
| Level 2–4 | Member 78 “Level” (286,160) + digits 2–4 (326,160) | recovered 8-bit BITDs |
| Level 10 | Member 87 “Bonus Round” at (285,160) | `087_bonus_round.png` |
| Walk-on | VWSC 15 fps, original members | `walkon.json` |
| Hits | ink 8 matte; `sprite intersects` = opaque pixels | PNG alpha (index 0) overlap after AABB |
| Pixel filter | Stage pixels | Pre-existing Phaser `pixelArt: true` nearest-neighbour scaler |

## Inferred / partial

| Item | Status |
|---|---|
| Levels 5–9 digits (members 82–86, **32-bit BITD**) | Decode failed. “Level” word BITD is shown; the numeral falls back to a small Arial digit at the original loc. |
| Level 1 numeral | Original uses the SnowCraft title BITD, not a “1” glyph. |

## Unverified / blocked (not claimed)

| Item | Why |
|---|---|
| Member 70 Happy Holidays logo (254×64, 32-bit) during Event Loop at (296,140) | BITD did not decode; original shows it on the field while playing |
| Member 88 (190×31, 32-bit) on `Level 11` | Likely victory art; GAME OVER / YOU WIN remain remake text |
| Member 77 palette strip on GreenWin | Recovered PNG exists, not yet placed (loss screen is remake) |
| Pixel-matte vs Director runtime | Masks come from recovered PNG alpha; no Wine `sprite intersects` capture |
| DCR BITD pixels | Afterburner `snd `/BITD compression type 1 not decoded; EXE is the art source |
| EXE window chrome, 15 fps director tempo as wall-clock | Platform; not the inner movie |
| `playField.png` / `player.png` atlas leftovers | Unused for kids/ground now; left in the tree (pre-existing remake assets) |

## Intentional / unavoidable platform deviations (not new this pass)

- Title starts on **click** rather than `rollover(1)` so the browser can unlock audio (already documented).
- Existing mute / difficulty / **600×320–1800×960 display scaler** stay (user edits). Difficulty Easy/Hard remain remake extras.
- Intro MP3 / looping BGM remain remake extras; combat SFX are original WAVs.

Perfect graphics parity is the **target**, not a claim.
