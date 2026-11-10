# Original SnowCraft graphics parity

This document records the recovered original-artwork mode. The optional web High resolution mode and enhanced-only Flutter edition now use the 35-frame [HD character pack](../artwork/hd-character-preview/README.md), with unchanged logical registration and original collision masks. Scenery and effects retain smooth 4× versions of their recovered art.

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
| Ground | Member 69 `ground` 600×320, loc **(296,160)**, reg (300,160), ink **copy** | `assets/classic/ground.png` (600×320) at that loc/reg (4 px overhang each side, clipped); recovered `069_ground.png` is kept in `web/assets/cast/` but not loaded |
| Kids 1–36 | PackBits BITD, matte index 0, registration from CASt | `web/assets/cast/00n_*.png` |
| Shadow | Member 1, loc = kid loc, ink matte | recovered BITD at kid loc |
| Power 0–8 | Members 37–45, loc = kid loc, reg x = −27 | BITDs at kid loc (not offset +15) |
| Snowball / drop / splat / melt | Members 57–66, height in the bitmap | recovered BITDs, registration applied |
| Title | Member 76 “SnowCraft” 122×22 at (296,160); blend 255→0→255 at **15 fps** (frames 10–34) | browser text “SnowCraft”; recovered `076_1.png` kept, not loaded |
| Level 2–9 | Member 78 “Level” (286,160) + digits 2–9 (326,160); fade-out **10 fps**, 11 frames | browser text “Level N”; recovered BITDs kept, not loaded (8-bit 2–4; **32-bit** 5–9 via D4 planar PackBits) |
| Level 10 | Member 87 “Bonus Round” at (285,160), 10 fps fade-out | browser text “Bonus Round”; recovered `087_bonus_round.png` kept, not loaded |
| Logo | Member 70 original BITD “Happy Holidays / IconMedialab” 254×64 (painted spelling; no © year). The kept PNG has Happy Holidays with the IconMedialab lettering removed. Event Loop ch2 at (296,140) **blend 255 (hidden)**. GreenWin (296,140) blend 0. Victory frames 317–325 fade in. | browser text “Happy Holidays” at the logo loc; `web/assets/cast/070_happy_holidays.png` kept, not loaded; original `docs/reference/snowcraft-original/source-evidence/recovered/070_happy_holidays.png` |
| Victory banner | Member 88 “Congratulations!” (295,160), 10 fps, blend 255→0→255 (frames 290–315) | browser text “Congratulations!”; recovered `088_congratulations.png` kept, not loaded |
| Play Again | Member 77 `snowcraft_palatte` 84×22, CASt reg (−216,−138). GreenWin ch4 loc (292,160) bbox (508,298)–(592,320); victory loc (296,160). Blend 255→0 over frames 40–45 / 320–325 at 10 fps. | browser text “Play Again”; recovered `077_play_again.png` kept, not loaded |
| Walk-on | Score tempo **15 fps** on Level 1, **10 fps** on Levels 2–10 | `walkon.json` paths; runtime uses `scoreTempoFps` |
| Hits | ink 8 matte; `sprite intersects` = opaque pixels | PNG alpha (index 0 / 32-bit white) overlap after AABB |
| Pixel filter | Stage pixels | Pre-existing Phaser `pixelArt: true` nearest-neighbour scaler |

32-bit decoder: ScummVM `BITDDecoder` for Director ≥4 stores each scanline as A,R,G,B planes, PackBits-compressed. These members were **not** unrecoverable; the previous decoder only tried 8-bit/BGRA. Alpha plane is unused (0); white is the matte. Evidence: `docs/recovered/ui-score.json`.

## Inferred / partial

| Item | Status |
|---|---|
| Level 1 numeral | Original uses the SnowCraft title BITD, not a “1” glyph. |
| Level 6 “Level” word ink 39 (darkest) | Digit still ink 8. Remake keeps matte ink 8 on the word. |
| 32-bit digit CASt regs | Parser is correct (ScummVM D8; DCR has the same digit-5/6 spec bytes). 8-bit 2–4 at loc 326 use reg_x ≈ −30 (left edge 356). 32-bit 5–9 CASt regs 54,30,7,−17,−41 are a 24px paint-window filmstrip that was not reset after splitting, while VWSC still uses loc 326. Placement uses the 2–4 slot left edge 356; CASt `castReg` is kept as evidence. Vertical CASt reg_y is unchanged. |
| Title sprite size | Score first frames use spr 203×31 vs BITD 122×22 (tween leftover). Remake now draws browser text, not the BITD. |
| Member 89 `snowcraft_256` | Unused 600×320 8-bit field; no VWSC sprite. |

## Unverified / blocked (not claimed)

| Item | Why |
|---|---|
| Pixel-matte vs Director runtime | Masks come from recovered PNG alpha; no Wine `sprite intersects` capture |
| DCR BITD pixels | Afterburner `snd `/BITD compression type 1 not decoded; EXE is the art source |
| EXE window chrome, 15 fps director tempo as wall-clock | Platform; not the inner movie |
| Play Again / SCORE field glyphs | Lingo UI, not BITDs. Remake keeps the existing Play Again button + SCORE counter |
| `playField.png` / `player.png` / `enemy.png` atlas leftovers | Not drawn for kids/ground now; left in the tree (pre-existing remake assets). `game.js` still preloads `player.png` and `enemy.png`; `playField.png` is not loaded by the game |

## Intentional / unavoidable platform deviations (not new this pass)

- Title starts on **click** rather than `rollover(1)` so the browser can unlock audio (already documented).
- Existing mute / difficulty / **600×320–1800×960 display scaler** stay (user edits). Difficulty Easy/Hard remain remake extras.
- Intro MP3 / looping BGM remain remake extras; combat SFX are original WAVs.

Perfect graphics parity is the **target**, not a claim.
