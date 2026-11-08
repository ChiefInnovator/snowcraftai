# Original SnowCraft parity

This document is the checklist for matching Nicholson NY’s 1998–1999 Macromedia Director game (`SnowCraft.exe` / embedded `SnowCraft.dir`). Evidence is **static**: Projector mmap/`KEY*` parsing plus Lingo bytecode recovered with ProjectorRays’ instruction layout. **The Windows EXE was never executed.**

Status key:

- **Verified** — recovered from Lingo, cast names, VWLB labels, or WAV headers.
- **Inferred** — follows verified rules plus movie structure, but a value was not uniquely decoded.
- **Unverified / blocked** — needs a Director runtime, a legal playthrough capture, or score-channel bytes we could not fully expand.

## Audio (priority)

| Event | Cast / file | Status | Evidence |
|---|---|---|---|
| Full-power throw | `Whoosh` / `06_Whoosh.wav` | Verified | Snowball scripts: `if myRange = 16 then puppetSound("Whoosh")`. `myRange = integer(sb N) * 2`, so power 8. |
| Normal throw | `Whoosh Percusive` / `12_Whoosh_Percusive.wav` | Verified | Else branch of the same handlers (sb 0–7). |
| Person impact | `hit1` / `11_hit1.wav` | Verified | `puppetSound("hit1")` on sprite intersect in both snowball scripts. |
| Ground land / miss | `splat` / `14_splat.wav` | Verified | Member `splat`: `if not soundBusy(1) then puppetSound("splat")`. |
| Walk | `step` / `08_step.wav` | Verified | Green walk frames + movie `step`: `if not soundBusy(1) then puppetSound("step")`. |
| Red first hit (stun) | `bird_tweets` / `01_bird_tweets.wav` | Verified | RED DUDES on `R hit2` when `myHits <> 2`. |
| Red KO | `Ahhhh!` / `03_Ahhhh.wav` | Verified | RED DUDES on `R hit2` when `myHits = 2`. |
| Green 2nd hit | `hit2` / `15_hit2.wav` | Verified | GREEN DUDES on `G Hit2` when `myHits = 2`. |
| Green KO | `kids1`/`kids2`/`kids3` | Verified | `puppetSound("kids" & random(3))` when `myHits = 3`. |
| Hover unselectable red | `short_chirps` / `05_short_chirps.wav` | Verified call, inferred trigger | `mouseEnter` plays it when the first “selectable member” check fails; leftover pool includes `R dead`. Wired as hover-dead. |
| Level clear, pointer x &lt; 280 | `ugly` / `04_ugly.wav` | Verified | `nextLevel`: `if the mouseH < 280 then puppetSound("ugly")`. |
| Level clear, otherwise | `halaluja` / `16_halaluja.wav` | Verified | Else branch of `nextLevel`. |
| Game over | `laugh` / `02_laugh.wav` | Verified | Event Loop calls `ridicule()` twice; `ridicule` starts with `puppetSound("laugh")` and waits `soundBusy(1)`. |
| — | `Uh` / `13_Uh.wav` | Verified unused | Cast member exists; no `puppetSound` / score string recovered. **Not played.** |
| Looping BGM / intro sting | remake `musicAlt.mp3`, `intro.mp3` | Verified absent | All 16 sounds are short SFX. No SWA/MP3 members. Placeholder MP3s are no longer loaded. |

Playback rules recovered from Lingo:

- Default `puppetSound` uses **channel 1** and **replaces** whatever is already there (no random `detune`).
- `step` and `splat` play **only if `soundBusy(1)` is false**.
- Sample rates kept in the WAV headers: 11025, 11127, 11128, 22254 Hz. PCM bytes match `assets/sounds/inventory.json`.
- Browsers still resample to the output device rate after decode. That OS/browser step is **unavoidable** and is **not** an extra pitch effect in this remake.

## Mechanics

| Topic | Original (recovered) | Remake now | Status |
|---|---|---|---|
| Red hits to KO | 2 (`myHits = 2` → `Ahhhh!`, `gRDead++`) | 2 | Verified |
| Green hits to KO | 3 (`myHits = 3` → kids, `gGdead++`) | 3 | Verified |
| Charge | `(the timer - powerTime) / 5`, clamp 0–8 | 0–8 at 5 ticks/bar | Verified |
| Throw direction | Fixed isometric: red `point(-20,-10)`, green `point(20,10)` per ball tick | Same | Verified |
| Throw distance | `range = power * 2` steps of 20×10 px | Same | Verified |
| Whoosh vs percussive | `range = 16` (power 8) vs other | Same | Verified |
| Green throw power | `random(4) + 4` → sb 5–8 | 5–8 | Verified |
| Drag-to-move, release-to-throw | `stillDown` loop then spawn `sb && power` | Same control | Verified |
| Score on clear | `gScore = gScore + gGdead` | Same | Verified |
| Score on loss | `gScore = (gScore + gGdead) * level` | Same | Verified |
| Score UI | rolling `SCORE:` field | rolling text | Verified idea; font is not original |
| Levels | VWLB: Level 1–11 + GreenWin | 11 levels | Verified labels |
| Green count | Archive text: 3, then 5, “and so on”; 12 green sprite slots (18–29) | `min(12, 2*level+1)` | Level 1–5 verified by docs+formula; 6–11 **inferred** (capped at 12 sprites) |
| `gRDead = 3` ends match | Event Loop `go("GreenWin")` + `ridicule` | GAME OVER + two laughs | Verified outcome, **inferred** GreenWin layout |
| Red daze length | `mySteps = 15` at `myTempo = 5` | 15 cycles | Verified |
| No aim-at-target | Snowballs never take mouse angle | Fixed diagonal | Verified |
| Easy/Normal/Hard | Not in movie | UI kept; **does not change hit counts** | Remake extra |
| Camera shake | Not in movie | Removed | Verified absent |

## Visual / timing still open

| Topic | Status |
|---|---|
| Exact stage rect / Director tempo from `DRCF` | Unverified (bytes parsed, mapping to 600×320 not unique). Playfield PNG and IA screenshot are ~600×320. |
| Per-level `gd` / `level` sprite properties in `VWSC` | Blocked: score stream is compressed; not fully expanded without a Director score reader. |
| Pixel-perfect sprite registration, ink, shadows | Unverified. Remake still uses the 1998 atlases via Phaser. |
| Enemy walk as `loc = loc + myDirection` with `point(2,1)` etc. | Verified in Lingo; remake still uses Phaser `moveTo` for green roaming (**gap**). |
| Intro walk-on members `R Auto walk_1/2` | Verified members exist; remake uses a generic walk-in (**gap**). |
| Power meter art (`power 0`–`power 8` members) | Verified 9 cast members; remake uses 8 green bars (**visual gap**). |
| `sb 0`–`sb 9`, `drop`, `melt` bitmap sequence | Verified members; remake uses one snowball sprite + splash/puddle (**visual gap**). |
| After Level 11 | No `Level 12` label. Remake shows YOU WIN. **Inferred.** |
| NamuWiki “6 levels then loop” / 7–8s stun | Public write-up of a Flash copy; **not** used over this EXE’s Lingo. |

## Licensing / provenance

WAVs are historic third-party recordings extracted losslessly from the user-supplied `SnowCraft.exe` (Internet Archive `snowcraft_201912`, Nicholson NY). Copyright remains with the original authors. They are integrated here as a private restoration reference; **release licensing must be verified before any public redistribution** of the sound files. See `assets/sounds/README.md` and `assets/sounds/inventory.json`. The extractor is `tools/extract_snowcraft_sounds.py` (static mmap parse only).
