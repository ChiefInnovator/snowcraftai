# Original SnowCraft parity (web/ layout)

This report describes the web edition. The native Flutter edition intentionally adds enhanced movement, aiming and presentation; its behavior is documented separately in [`flutter/README.md`](../flutter/README.md).

Checklist for matching Nicholson NY’s 1999 Macromedia Director 8 projector
(`SnowCraft.exe` / embedded `SnowCraft.dir`). Evidence is **static**: mmap/`KEY*`
parse, VWSC score decode (`tools/reference/inspect_movie.py`), BITD decode
(`tools/reference/extract_bitmaps.py`), and Lingo recovered from `Lscr`.
**The Windows EXE was never executed in this static workstream.** The separate
Wine playthrough of 2026-11-08, run from the gitignored root `reference/`
workspace, is recorded in [`reference-app.md`](reference-app.md).

This document is for the combined `web/` tree: `feature/repo-restructure`
(`ff39e410`) + recovered BITD/VWSC/movement + the 15 played original WAVs + local
restructure edits (SEO copy, debug-revive immunity, `winctl.py` cursor notes).
That tree has since been merged into `develop` and `main`; the current branch
model is in [`AGENTS.md`](../AGENTS.md).

Status key:

- **Verified** — recovered from Lingo, VWSC, BITD, or WAV headers.
- **Inferred** — follows verified rules plus movie structure, but a value was not uniquely decoded.
- **Unverified / blocked** — needs a Director runtime playthrough, Wine capture, or bytes we could not expand.

## Combined tree (historical)

Base was `ff39e410` (`feature/repo-restructure`). Older develop-rooted PRs could
not absorb this without mixing deleted paths. Local uncommitted edits from that
HEAD were **included** (SEO/copy, `z` revive immunity, `winctl.py`).

## Audio

The 15 played original WAVs live in `web/assets/sounds/` with PCM SHA-256 pins in
`inventory.json` / `tests/wav-integrity.test.js`. Channel 1 is
`web/js/audio.js` (`puppetSound` replace; `step`/`splat` idle-gated).

Intro/`musicAlt.mp3` still play on level 1 (original had no BGM).

| Event | Original cast | Remake now | Status |
|---|---|---|---|
| Full-power throw | `Whoosh` | `whoosh` | Verified sample + trigger |
| Other throw | `Whoosh Percusive` | `whoosh_percussive` | Verified |
| Person impact | `hit1` | `hit1` | Verified |
| Ground land | `splat` (idle channel 1) | idle-gated `splat` | Verified |
| Walk | `step` (idle channel 1) | idle-gated `step` | Verified |
| Red 1st hit | `bird_tweets` | `bird_tweets` | Verified |
| Red KO | `Ahhhh!` | `ahhhh` | Verified |
| Green 2nd hit | `hit2` | `hit2` | Verified |
| Green KO | `kids1–3` | `kids` + `random(3)` | Verified |
| Hover dazed red | `short_chirps` | `short_chirps` | Verified |
| Level clear | `ugly` / `halaluja` if `mouseH < 280` | same split on `pointer.worldX` | Verified |
| Game over | `laugh` ×2, each waits `soundBusy(1)` | `whenSfxIdle` ×2 | Verified |
| Level clear after last kill | `nextLevel` waits `soundBusy(1)` | wait, then ugly/halaluja | Verified |
| `Uh` | unused cast | unused | Verified unused |
| BGM | none | `musicAlt.mp3` | Deliberate remake extra |

## Mechanics

| Topic | Original | Remake now | Status |
|---|---|---|---|
| Red hits to KO | 2 | 2 | Verified |
| Green hits to KO | 3 | 3 on Normal; Easy 2 / Hard 4 | Verified default; difficulty extra |
| Charge | `(timer − powerTime) / 5`, clamp 0–8 | same | Verified |
| Throw vector | red `(-20,-10)`, green `(20,10)` per 50 ms | same discrete steps | Verified |
| Range | `myRange = power * 2` fly steps, then 4 drop of half step | same | Verified |
| Hits during drop | never | never | Verified |
| Green AI | 10% walk `(±2,±1)` × `random(99)` then throw; 10% side `(±1,±2)` × 5; 20% throw; 60% idle | same | Verified |
| `loc += myDirection` | integer point add; `locH<40 → (4,1)`, `locV<40 → (1,4)` | same | Verified |
| Centre line | `x ≥ 2*(320 − y)` → (0,320)–(640,0) | same | Verified |
| Green throw power | `random(4)+4` → 5–8 | 5–8 | Verified |
| Caps | 10 balls per team | 10 | Verified |
| Score clear | `gScore += gd` | same | Verified |
| Score loss | `(gScore + gGdead) * level` | same | Verified |
| Victory score | `×10`, cap 1000 if &gt;900 | same | Verified |
| Levels | VWSC Event Loop `#gd/#level` 1–10 | same counts + **exact locs** | Verified |
| Debug `z` revive | `myHits ≥ 2` so `myHits = 2` death never fires | `isImmune` (can't be hit again) | Verified intent, remake flag |

## Visuals recovered this round

| Member | Size | Registration | Status |
|---|---|---|---|
| `power 0`–`power 8` | 4×3 … 9×30 | x = −27 (drawn to the right of the kid) | Verified BITD |
| `snowball` | 11×42 | (5, 38) — height baked in | Verified BITD |
| `drop` ×4 | 11×39 … 10×18 | (5, 35) … (5, 14) | Verified BITD |
| `splat` | 16×7 | (8, 3) | Verified BITD |
| `melt` ×4 | 17×13, 22×16 | (8, 6) / (11, 8) | Verified BITD |
| `sb 0`–`sb 9` | 1×1 placeholders | (1, 4) | Verified; not drawn |

PNGs live in `web/assets/cast/`. They are original-derived, same class as
`player.png` / `enemy.png`. SHA-256 pins are in `tests/cast-bitmaps.test.js`.

## Level layouts (VWSC Event Loop)

Decoded from compressed VWSC delta frames (328 frames, 48-byte sprite records).
Full dump: `docs/reference/snowcraft-original/source-evidence/recovered/event-loop-layouts.json`.

| Level | `#gd` | Notes |
|---|---|---|
| 1 | 3 | Triangle (176,49) (73,46) (71,108); reds (508,192) (377,268) (484,282) |
| 2 | 5 | +2 off-stage, walk in via edge rule |
| 3 | 7 | +4 off-stage / along the top |
| 4 | 9 | +6 |
| 5 | 12 | triangle + 9 along top/left edges |
| 6 | 12 | three triangles, some closer to the reds |
| 7 | 12 | two parallel diagonal rows of 6 |
| 8 | 12 | two wedges of 6 |
| 9 | 12 | two wedges of 6 |
| 10 | 12 | lower-left cluster; **reds closer** (408,221) (346,257) (290,300) |

Off-stage starts (`x<8` or `y<8`) spawn at the score loc and walk in with
`loc += myDirection` after the match starts. On-stage kids still take a short
2:1 walk-on (original frames 3–27 are a scripted walk; exact per-frame paths
are in `score.txt` but are not replayed tick-for-tick).

## Newly decoded from the original ZIP (`SnowCraft.exe`)

Static `XFIR`/`VWSC`/`BITD` parse of
`docs/reference/snowcraft-original/extracted/SnowCraft.exe`
(SHA-256 `2103bae31937095450962c91ec025e5e49eac920d2eccf1bdd89bcae2e130b8c`),
from `archives/nicholson-snowcraft-1999-win32-projector-ia-snowcraft-201912.zip`
(Cursor upload `ba07317d…zip`). A second original,
`extracted/snowcraft.dcr`, is compared in
`docs/reference/snowcraft-original/source-evidence/dcr-vs-exe.md`.
EXE and DCR were **not** executed.

| Topic | Original file | Remake now | Status |
|---|---|---|---|
| Kid BITDs 1–36 | Cast names, size, **reg**, PackBits, matte index 0 | `web/assets/cast/00n_*.png` + `CAST.kids` | Verified |
| Shadow | 36×21 reg (6,17), drawn at the kid loc | recovered BITD at kid loc | Verified |
| Walk-on | Score frames from each `Level N` label to Event Loop; tempo **15 fps** on Level 1, **10 fps** on 2–10 | `walkon.json` paths; runtime `scoreTempoFps` | Verified tempo from VWSC |
| Sprite ink | kids/balls **matte** (8); ground **copy** | PNG-alpha matte overlap (index 0 / 32-bit white transparent) | Verified BITD; runtime Director collide **unverified** |
| Daze members | `R daze1/2/3`, `mySteps=15` | those BITDs, 15×3 Lingo ticks | Verified |
| Green hit members | `G Hit` → `G ow` (`myMove=10`); `G down` (`25`); recover (`5`) | same BITDs + move counts | Verified |
| Event Loop tempo | VWSC `500 fps` after walk-on; Lingo still gates on `the timer` | 100 ms / 50 ms from `timer > clock + myTempo` | Verified inequality; runtime clock **blocked** |
| DRCF | stage 592×320, frameRate 15, Director 8 (`1600`) | canvas **592×320**; ground 600×320 at (296,160) | Verified |
| Title / level cards | Member 76 SnowCraft; 78+digits 2–9; 87 Bonus Round | recovered BITDs retained unchanged as evidence; runtime title, Level 2–9 and Bonus Round use crisp centered browser text | Verified BITDs + slot; CASt filmstrip documented |
| `Level 11` / `GreenWin` | Congratulations #88 then logo #70; Play Again #77; loss is logo (no GAME OVER BITD) | Congratulations!, Happy Holidays, SCORE and Play Again use crisp browser text; original fade/hold timings retained | Verified BITDs; field 90 SCORE still remake |

## Still open / blocked

| Topic | What’s missing | Evidence needed |
|---|---|---|
| Pixel-matte vs Director runtime | PNG-alpha overlap from recovered BITDs | Wine/`sprite intersects` capture (do **not** auto-run the EXE) |
| Event Loop “500 fps” wall-clock | Lingo is timer-gated; how fast `prepareFrame` polls is machine-dependent | Runtime clock trace (do **not** auto-run the EXE) |
| SCORE field (member 90) | Lingo field, not a BITD | Remake SCORE counter; original field metrics not recovered as pixels |
| Original EXE look / window chrome | Not the inner movie; superseded as a target | Do **not** auto-run Wine/`run-reference.sh` |

Perfect parity remains the target, not a claim.
