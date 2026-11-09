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
| Title | Member 76 “SnowCraft” 122×22 at (296,160); blend 255→0→255 at **15 fps** (frames 10–34) | `076_1.png` |
| Level 2–9 | Member 78 “Level” (286,160) + digits 2–9 (326,160); fade-out **10 fps**, 11 frames | 8-bit 2–4; **32-bit** 5–9 via D4 planar PackBits |
| Level 10 | Member 87 “Bonus Round” at (285,160), 10 fps fade-out | `087_bonus_round.png` |
| Logo | Member 70 “Happy Holidays / IconMedialab” 254×64. Event Loop ch2 at (296,140) **blend 255 (hidden)**. GreenWin (296,140) blend 0. Victory frames 317–325 fade in. | `070_happy_holidays.png` |
| Victory banner | Member 88 “Congratulations!” (295,160), 10 fps, blend 255→0→255 (frames 290–315) | `088_congratulations.png` |
| Walk-on | Score tempo **15 fps** on Level 1, **10 fps** on Levels 2–10 | `walkon.json` paths; runtime uses `scoreTempoFps` |
| Hits | ink 8 matte; `sprite intersects` = opaque pixels | PNG alpha (index 0 / 32-bit white) overlap after AABB |
| Pixel filter | Stage pixels | Pre-existing Phaser `pixelArt: true` nearest-neighbour scaler |

32-bit decoder: ScummVM `BITDDecoder` for Director ≥4 stores each scanline as A,R,G,B planes, PackBits-compressed. These members were **not** unrecoverable; the previous decoder only tried 8-bit/BGRA. Alpha plane is unused (0); white is the matte. Evidence: `docs/recovered/ui-score.json`.

## Inferred / partial

| Item | Status |
|---|---|
| Level 1 numeral | Original uses the SnowCraft title BITD, not a “1” glyph. |
| Member 77 `snowcraft_palatte` | 8-bit strip on GreenWin/victory ch4; not a GAME OVER glyph. Left unwired. |
| Level 6 “Level” word ink 39 (darkest) | Digit still ink 8. Remake keeps matte ink 8 on the word. |
| 32-bit digit CASt regs | VWSC loc is (326,160) for digits 2–9. 8-bit 2–4 regs (−30/−29/−30, 10) put the glyph ~50 px right of “Level”. 32-bit 5–9 CASt regs (54, 30, 7, −17, −41) fan the left edge across 272–367, so 5–7 overlap “Level” (`Le5el` in a Level 5 screenshot). Wired as recovered CASt+VWSC, not an inferred 2–4 alignment. Original projector not run. |

## Unverified / blocked (not claimed)

| Item | Why |
|---|---|
| Pixel-matte vs Director runtime | Masks come from recovered PNG alpha; no Wine `sprite intersects` capture |
| DCR BITD pixels | Afterburner `snd `/BITD compression type 1 not decoded; EXE is the art source |
| EXE window chrome, 15 fps director tempo as wall-clock | Platform; not the inner movie |
| Play Again / SCORE field glyphs | Lingo UI, not BITDs. Remake keeps the existing Play Again button + SCORE counter |
| `playField.png` / `player.png` atlas leftovers | Unused for kids/ground now; left in the tree (pre-existing remake assets) |

## Intentional / unavoidable platform deviations (not new this pass)

- Title starts on **click** rather than `rollover(1)` so the browser can unlock audio (already documented).
- Existing mute / difficulty / **600×320–1800×960 display scaler** stay (user edits). Difficulty Easy/Hard remain remake extras.
- Intro MP3 / looping BGM remain remake extras; combat SFX are original WAVs.

Perfect graphics parity is the **target**, not a claim.
