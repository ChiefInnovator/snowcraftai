# Original SnowCraft parity (src/ layout)

Checklist for matching Nicholson NY’s 1999 Macromedia Director 8 projector
(`SnowCraft.exe` / embedded `SnowCraft.dir`). Evidence is **static**: mmap/`KEY*`
parse, VWSC score decode (`tools/reference/inspect_movie.py`), BITD decode
(`tools/reference/extract_bitmaps.py`), and Lingo recovered from `Lscr`.
**The Windows EXE was never executed in this workstream.**

This document is for the `src/` tree on `feature/repo-restructure` (`ff39e410`)
plus the parity patches in this branch. It does **not** merge that feature
branch into `develop`.

Status key:

- **Verified** — recovered from Lingo, VWSC, BITD, or WAV headers.
- **Inferred** — follows verified rules plus movie structure, but a value was not uniquely decoded.
- **Unverified / blocked** — needs a Director runtime playthrough, Wine capture, or bytes we could not expand.

## Can the existing develop PR absorb this?

**No.** PR targeting `develop` still uses the pre-restructure root `index.html`
tree. `feature/repo-restructure` @ `ff39e410` moved the game to `src/js/game.js`,
rewrote mechanics, and replaced SFX with synthesized WAVs. Merging the two would
mix unrelated in-flight work and fight over deleted paths. This branch is based
on the **committed** restructure only; it does not include uncommitted local
edits to `docs/SPECIFICATIONS.md`, `src/index.html`, `src/js/game.js`, or
`tools/reference/winctl.py`.

## Audio

Synthesized `src/assets/sfx/*.wav` (this tree’s licensing choice) stay. Event
mapping still follows original Lingo. Original 16 WAVs remain on the older
develop-based parity branch and can be extracted with `tools/extract_snowcraft_sounds.py`
from a local `reference/` copy. They are **not** committed here.

| Event | Original cast | Remake SFX | Status |
|---|---|---|---|
| Full-power throw | `Whoosh` | `throw_full` | Verified trigger, synthesized sample |
| Other throw | `Whoosh Percusive` | `throw` | Verified trigger, synthesized sample |
| Person impact | `hit1` | `hit` | Verified trigger |
| Ground land | `splat` (idle channel 1) | `splat` if no other SFX playing | Verified rule |
| Walk | `step` (idle channel 1) | `step` if idle | Verified rule |
| Red 1st hit | `bird_tweets` | `red_daze` | Verified trigger |
| Red KO | `Ahhhh!` | `red_out` | Verified trigger |
| Green 2nd hit | `hit2` | `knockdown` | Verified trigger |
| Green KO | `kids1–3` | `green_out` | Verified trigger, one clip not three |
| Hover dazed red | `short_chirps` | `deny` | Verified trigger |
| Level clear | `ugly` / `halaluja` | `level_clear` / `victory` | Verified idea; mouseH&lt;280 split **not** wired (remake extra) |
| Game over | `laugh` ×2 | `cheer` ×2 | Verified idea |
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

## Visuals recovered this round

| Member | Size | Registration | Status |
|---|---|---|---|
| `power 0`–`power 8` | 4×3 … 9×30 | x = −27 (drawn to the right of the kid) | Verified BITD |
| `snowball` | 11×42 | (5, 38) — height baked in | Verified BITD |
| `drop` ×4 | 11×39 … 10×18 | (5, 35) … (5, 14) | Verified BITD |
| `splat` | 16×7 | (8, 3) | Verified BITD |
| `melt` ×4 | 17×13, 22×16 | (8, 6) / (11, 8) | Verified BITD |
| `sb 0`–`sb 9` | 1×1 placeholders | (1, 4) | Verified; not drawn |

PNGs live in `src/assets/cast/`. They are original-derived, same class as
`player.png` / `enemy.png`. SHA-256 pins are in `tests/cast-bitmaps.test.js`.

## Level layouts (VWSC Event Loop)

Decoded from compressed VWSC delta frames (328 frames, 48-byte sprite records).
Full dump: `docs/recovered/event-loop-layouts.json`.

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

## Still open / blocked

| Topic | What’s missing | Evidence needed |
|---|---|---|
| Pixel-perfect kid registration / ink | Remake still uses atlas slices from `player.png`/`enemy.png`, not per-member BITD | BITD dump of kid members **or** a Wine screenshot overlay |
| Walk-on frames 3–27 | Score has per-frame locs; remake uses a shortened 2:1 tween | Optional: replay those 25 frames at 10–15 fps |
| `ugly` vs `halaluja` by `mouseH < 280` | Remake uses one clear clip, victory clip on level 10 | Wire if original SFX are restored |
| Matte `sprite intersects` hit boxes | Remake uses a 16×20 ground-track window | Runtime Director collide, or a capture of borderline hits |
| Exact daze/ow member cycling | Times match Lingo; frames are atlas names not `R daze1–3` | BITD of those members |
| Stage 592 vs canvas 600 | Ground bitmap is 600×320; stage rect is 592×320 | Keep as-is; 8 px is the original ground overhang |
| Tempo “500 fps” Event Loop | Director “as fast as possible”; remake uses 50/100 ms timers | Needs a runtime clock trace |
| Original EXE look | Wine playthrough exists in `docs/reference-app.md` [obs] from the author’s machine | Do **not** auto-run Wine/`run-reference.sh` in this agent |

Perfect parity remains the target, not a claim.
