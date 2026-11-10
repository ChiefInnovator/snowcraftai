# Reference app: the original SnowCraft (1999)

This page covers four things about the original game: what the binary is, how to inspect it, how to run it on a Mac, and how it actually plays.

The mechanics come from two sources:
- **Decompiled Lingo and score data.** This is ground truth for rules and numbers.
- **A Wine playthrough (2026-11-08).** This is ground truth for what you see on screen.

Canonical original files live in [`docs/reference/snowcraft-original/`](reference/snowcraft-original/) (both user-supplied game archives, the extracted-sounds pack, SHA-256 manifest, provenance). That folder is **committed evidence**, not a running copy of the game. A gitignored root `reference/` directory is only a local Wine/decompile workspace. Runtime WAVs are `web/assets/sounds/`. This document records numbers, names, logic and observations; it does not replace the archives.

Each claim carries one of these tags:
- **[Lingo]** quoted directly from a decompiled script.
- **[score]** decoded from score/frame data by `tools/reference/inspect_movie.py`.
- **[obs]** seen in the Wine playthrough. Screenshots are under `reference/screenshots/`.
- **[inferred]** reasoning, not directly confirmed.

The gameplay rules most likely to be needed are in §5 (player), §6 (enemy AI), §7 (snowballs) and §8 (levels and score). Claims from the YouTube summary in `reference-video-notes.md` are checked one by one in §11.

## 1. What the binary is

| Item | Value |
|---|---|
| File | `SnowCraft.exe`, 3,833,256 bytes, PE32 i386 GUI |
| Type | Macromedia Director **8.0** Windows projector |
| Edition | **IconMedialab "Happy Holidays" edition**, by Nicholson NY (nny.com), 1999. Cast "1" is the "SnowCraft" title text. Cast "2" (254×64) is the "Happy Holidays / IconMedialab" logo, which links to `www.nny.com` [obs]. The internal dev path is `\\Doc\Users\Wells\SnowCraft.dir` |
| Embedded movie | One protected `XFIR/39VM` movie (little-endian, uncompressed) at file offset `0x306114`, 662,672 bytes |
| Projector container | `XFIR/LPPA` at `0x222151`. It bundles the Xtras: INetURL, NetFile, NetLingo, Mix Services, Sound Import Export, SWA decompression, Text/Font, DirectSound, Flash Asset, QT3Asset |
| Casts | One internal cast, members 1–131: 82 bitmaps, 16 sounds, 23 scripts, 2 fields, 3 text Xtras, 1 palette. **No music track** |
| Stage | **592 × 320** [score] |
| Tempo | 15 fps by default; gameplay frames are set to 500 fps (i.e. "as fast as possible") [score] |

## 2. Extracting and decompiling the movie

```bash
tools/reference/decompile-reference.sh
```

The script runs four steps:
1. **Builds [ProjectorRays](https://github.com/ProjectorRays/ProjectorRays)** into `reference/tools/ProjectorRays`. It needs `brew install boost mpg123`.
2. **`extract_movie.py` carves out the movie and rebases its offsets.** Inside a projector, the movie's `imap.mmapOffset` and each `mmap` entry offset are absolute exe offsets, so the script subtracts the movie base `0x306114`. Without that, ProjectorRays fails with `Read past end of stream`. Pointed at the exe directly, it fails with `Codec unsupported`.
3. **`projectorrays decompile … --dump-scripts`** writes `reference/extracted/decompiled/` (`.ls` Lingo and `.lasm` bytecode).
4. **`inspect_movie.py`** writes `reference/analysis/{config,cast,labels,score}.txt`. These hold the cast list and the decoded score: sprites, positions, ink, blend, tempo, sounds, and behaviours with their parameters. It writes metadata only; no bitmaps or sounds.

The score decoder follows ScummVM's D7+ layout:
- 288-byte main-channel block and 48-byte sprite records.
- Delta frames.
- Behaviour list taken from sprite-detail entry `spriteListIdx + 1`.
- Tempo codes: 246 = fps (value in the cue point), 247 = wait N seconds, 255/254 = wait for sound channel.

## 3. Running it on macOS

```bash
tools/reference/run-reference.sh   # Wine
```

- **Wine is the only supported way to run it** [obs]. Verified on 2026-11-08 on Apple-silicon macOS 27 with Wine 11.21 from [Gcenx/macOS_Wine_builds](https://github.com/Gcenx/macOS_Wine_builds):
  - Wine runs as x86_64 under Rosetta 2, and the 32-bit exe runs through wow64.
  - The script downloads Wine into `reference/tools/wine/` and uses an isolated prefix at `reference/wineprefix/`.
  - All Xtras load and the game plays. Screenshots: `wine_level1.png`, `wine_gameplay.png`.
  - Homebrew's `wine-stable` and `wine@devel` casks are disabled (they fail the Gatekeeper check since 2026-09-01), which is why the script fetches the same build directly.
  - **Quirk: click once on the stage before play starts.** The movie waits for `rollover(1)` [Lingo], and under Wine that does not register until the window has received a click.
  - **Quirk: the window cannot be captured while covered.** It refuses `screencapture -l` and ScreenCaptureKit, so automated captures only work when it is the frontmost window.
- **ScummVM does not work — do not use it** [obs]:
  - In our session it detected the movie and rendered level 1 (`scummvm_level1.png`).
  - There is no audio: it logs `STUB: SoundCastMember::load(): Sounds not yet supported for version v800`.
  - The user reported the game **hanging** under ScummVM.
- **Parallels** (already installed on this Mac) is the last-resort fallback: in a Windows 11 ARM VM, copy the `snowcraft_201912` folder in and run `SnowCraft.exe`. x86 emulation handles the 32-bit exe.
- **Driving it from scripts:** `tools/reference/winctl.py` runs inside Wine's Windows Python. It sends keys with `PostMessage` and mouse input with `SetCursorPos` and `SendInput`, so clicks are only ever delivered to Wine.
  - Using `cliclick` instead sends real clicks, which land in whatever window is on top.
  - `SetCursorPos` still moves the real macOS cursor.

## 4. Movie structure

| Frame | Label | What happens [score/Lingo/obs] |
|---|---|---|
| 1–2 | — | Snow field only, 15 fps |
| 3 | **Level 1** | Holds on this frame until the mouse is over the stage (`rollover(1)`) [Lingo, obs] |
| 3–27 | | Scripted walk-on for both teams, with the `step` sound |
| 28–29 | | "SnowCraft" title text (cast "1") appears; waits for rollover again, then 1 s [score, obs] |
| 35 | | **Event Loop** `[#gd: 3, #level: 1]`; loops at 500 fps during play |
| 40–45 | **GreenWin** | Game over: the "Happy Holidays / IconMedialab" logo stays up; a **Play Again** button (bottom-right) and the `SCORE: n` field fade in. The score counts up and is blank when it is 0 [score, obs] |
| 50, 70, 90, 110, 130, 160, 194, 226, 259 | **Level 2…10** | Waits for the "level cleared" sound, then the walk-on at 10 fps with a level banner (see below) [score] |
| 65, 85, 105, 125, 156, 191, 221, 253, 286 | | Event Loop for levels 2–10 |
| 290–328 | **Level 11** | Victory sequence: a banner (#88) fades in and out; the logo, Play Again, `SCORE` (×10, capped at 1000), a `winners@nny.com` mailto and the version text appear [score; not reached in play] |

**Level banners** [score]:
- Levels 2–7 show the "Level" bitmap plus a digit bitmap.
- Levels 8–9 show only the digit, because the "Level" channel is taken by a walking shadow [inferred].
- Level 10 has its own 158×23 banner (#87).

### Sprite channels [Lingo/score]

| Channels | Use |
|---|---|
| 1 | Ground (600×320); also the drag-constraint rect for reds |
| 2 | Title, logo and banner slot |
| 3–14 / 15–17 | Green / red shadows. A dead kid's body is drawn in its shadow channel |
| 18–29 / 30–32 | Green kids (up to 12) / red kids (always 3) |
| 33 / 34 | Selection ring (`R pop/cock/toss`) / power meter (`power 0`–`8`) |
| 40–49 / 50–59 | Green / red snowball pools, **10 each** |

**Timing** [Lingo]:
- All gameplay is gated on `the timer`, which counts 60 ticks per second.
- **Kids** (`myTempo = 5`) step at most every 6 ticks: **100 ms**.
- **Snowballs** (`myTempo = 2`) step every 3 ticks: **50 ms**.

## 5. Player (red team)

- **Three kids every level.** [score + inferred]
  - Each level's red sprites are new score spans, and the score sets them back to their walk-on members. So a red that died in level N walks back on, healthy, in level N+1.
  - Hit counters also reset, because `beginSprite` creates a fresh behaviour instance.
  - Not observed: the bot could not clear a level (§10).
- **Hover** shows the dashed blue ring and an empty meter [Lingo, obs].
- **Press and drag** [Lingo, obs]:
  - The kid follows the cursor at **unlimited speed**, keeping the offset from where you grabbed it.
  - It is clamped to the red side of the line `x = 2·(320 − y)`, which runs from (0,320) to (640,0). This was observed: dragging toward the upper-left stops the kid at the line.
  - The kid's shadow stays where the drag started until you release [obs].
- **Power** [Lingo, obs]:
  - `power = (the timer − pressTime) / 5`, clamped to 0..8.
  - It rises by **1 every 83 ms** and is **full at 0.67 s**.
  - The meter is a vertical green bar to the right of the kid, with 9 states.
- **The game keeps running while you hold** [obs]. Greens move and throw, and snowballs fly and hit other reds, during a 2.5 s hold (`throwtest_freeze.png`).
  - This refutes an earlier "freezes while dragging" inference based on Director's blocking `repeat while the stillDown`.
- **Release** throws from the kid's current spot, using the first free red snowball (10 maximum in flight).
- **Getting hit** [Lingo, obs]:
  - **2 hits to die.**
  - **First hit:** `bird_tweets`, then a daze cycle 15 × (`daze1→2→3`) of roughly 4.5 s. During it the kid cannot be grabbed, and hovering plays `short_chirps`. Observed: a red was hit and was still alive afterwards.
  - **Second hit:** `Ahhhh!`; the body stays on the field (`R dead`) for the rest of the level.
  - **Reds can be hit while dazed** — there is no immunity window.
  - A hit cancels the selection ring and meter.

## 6. Enemy (green team) AI [Lingo, obs]

Every 100 ms, a green in `G ready` rolls `random(10)`:

| Roll | Chance | Action |
|---|---|---|
| 1 | 10% | Walk along the throw axis ±(2,1) px per step for `random(99)` steps, **then throw** |
| 2 | 10% | Side-step ±(1,2) px per step for 5 steps, then go back to ready |
| 3–4 | 20% | Wind up and throw |
| 5–10 | 60% | Stand still |

- **Walking rules:**
  - Near the edges: `locH < 40` sets direction (4,1); `locV < 40` sets (1,4). This is how greens that start off-stage walk on.
  - **Crossing the centre line triggers an immediate wind-up.**
- **Throw sequence:** windup 0.5 s, then cock 0.6–1.5 s (`random(10)+5` steps), then release, then toss pose 0.5 s.
  - Power is **random 5–8** (`sb (random(4)+4)`).
  - A green throws only if one of the 10 green snowballs is free.
- **There is no aiming and no dodging.** No code reads the reds' positions or the positions of incoming balls. Hits come from the shared diagonal lanes plus the volume of fire.
  - Observed [obs]: an idle red team is wiped out in about 6 s on level 2 and about 12 s on level 7.
- **Getting hit (3 hits to kill)** [Lingo; first hit observed]:
  1. `G ow` for 1.0 s, then `G recover` for 0.5 s.
  2. `hit2` sound, then `G down` for **2.5 s, immune**, then `ow` and `recover` for 0.5 s each.
  3. `kids1|2|3` sound; a corpse (one of 3 random `G dead` frames) stays on the field.
  - Greens are immune only while `G down` and while dead.

## 7. Snowballs [Lingo, obs]

- **Direction is fixed.** Red balls move (−20,−10) and green balls (+20,+10) per 50 ms step: a 2:1 diagonal at about 447 px/s, or 400 px/s horizontally.
  - Dragging, or releasing while moving, has **no effect on direction** [obs: `throwtest_aim.png`].
- **Flight:**
  - The ball flies `myRange = 2 × power` steps (at least 1).
  - The **collision test runs on every flight step except the last**: `sprite intersects`, with matte outlines.
  - The ball is drawn about 38 px above its ground point, with its shadow below, so in effect the hit box is a thin vertical column [inferred].
- **Drop:** 4 more steps of (∓10,∓5) as the ball falls through 4 bitmaps of decreasing height, then `splat` and 4 `melt` frames. **Nothing is hit during the drop.**
- **Range (horizontal):**

| Power | Distance |
|---|---|
| 0 | 60 px |
| 4 | 200 px |
| 8 | **360 px** |

  The formula is `20·max(2p,1) + 40`, and vertical distance is half that. The hit-active part of the flight is `(2p − 1)·20` px. Green throws cover 240–360 px.
  - **Observed** (`throwtest_tap/mid/full.png`):

| Hold | Observed landing distance (horizontal) | Predicted power |
|---|---|---|
| Tap | ≈ 60 px | 0 |
| 330 ms | ≈ 200 px | 4 |
| 1000 ms | ≥ 330 px; hit the green at (176,49) from (508,192), and the green survived | 8 |

- **There is no arc or height variable.** The height is baked into the art.

## 8. Levels, win and loss, score

### Levels [score; obs via level-jump keys]

| Level | Greens | Layout |
|---|---|---|
| 1 | 3 | Triangle (176,49) (73,46) (71,108) |
| 2 | 5 | Level-1 triangle, plus 2 that walk on from the top-left |
| 3 | 7 | Level-1 triangle, plus 4 walking on |
| 4 | 9 | Level-1 triangle, plus 6 walking on |
| 5 | 12 | Level-1 triangle, plus 9 along the top and left edges |
| 6 | 12 | Three triangles, the middle and right ones further toward the reds, plus 3 walking on |
| 7 | 12 | Two parallel diagonal rows of 6 across the middle |
| 8 | 12 | Two wedges of 6: upper-right near the reds and lower-left |
| 9 | 12 | Two wedges of 6: top-centre and lower-left |
| 10 | 12 | Cluster at the lower-left plus 2 near the centre; **reds start closer**: (408,221) (346,257) (290,300) |

- **Formula:** greens = 3, 5, 7, 9, then 12 from level 5 on (`#gd` per level). Reds always start at (508,192) (377,268) (484,282), except on level 10.
- **The game is not endless:**
  - **Clear level 10** → the victory sequence (Level 11) → Play Again → level 1.
  - **Lose at any level** → GreenWin → Play Again → level 1 (frame 1, then the rollover wait) [obs].

### Flow and score [Lingo]

- **Level cleared:**
  - `gScore += greens on that level`.
  - All live reds go to `R rest`, then the `ugly` sound plays, or `halaluja` after level 10.
  - Then the next level's walk-on.
- **Loss** (3 reds down):
  - All greens switch to `G yea` and cheer.
  - `ridicule()` runs twice: the `laugh` sound plays, the logo fades in, and the corpses fade out [obs: `lose_01…04`].
  - `gScore = (gScore + kills this level) × level`, then GreenWin.
  - The score field stays blank when the score is 0 [obs].
- **Full clear:** `gScore × 10`, and if that is more than 900 it becomes 1000. Starting from level 1, a full clear is 96 kills → 960 → **always 1000** [inferred].
- **Play Again** resets the score and goes to frame 1 [Lingo, obs].
- **The digit keys do not reset `gScore`**, so the score can be inflated by jumping between levels.

## 9. Keys, sounds, extras

### Keys [Lingo; 2–9 and 0 observed]

| Key | Effect |
|---|---|
| `1`–`9` | Jump to that level (resets the dead counters only) |
| `0` | Jump to level 10 |
| `z` | Revive all reds. A revived red keeps `myHits ≥ 2`, so it can never die again [inferred] |
| `w` | Toggle the window type |
| space | `close(window)`; probably no effect in a projector [inferred] |

There are no menus and no sound toggle.

### Sounds (all on channel 1, so a new one cuts off the last)

| Sound | When it plays |
|---|---|
| `step` | Walk-on and green walking |
| `Whoosh` / `Whoosh Percusive` | Throw at power 8 / any other power |
| `hit1` | Any snowball hit |
| `splat` | A missed ball lands |
| `hit2` | A green is knocked down (2nd hit) |
| `kids1–3` | A green dies |
| `bird_tweets` | A red is dazed (1st hit) |
| `Ahhhh!` | A red dies |
| `short_chirps` | Hovering a dazed red |
| `laugh` | Loss |
| `ugly` / `halaluja` | Level 1–9 cleared / level 10 cleared |
| `Uh` | Unused |

## 10. Observation log (Wine, 2026-11-08)

| Topic | Observed | Lingo/score | Agree? |
|---|---|---|---|
| Start | Empty field, waits for mouse; walk-on; "SnowCraft" title; play | frames 3–35, `rollover(1)` | ✓ |
| Throw direction | Always up-left on the diagonal, whatever the drag path | fixed (−20,−10) | ✓ |
| Distance vs hold | ≈60 / ≈200 / ≥330 px for tap / 330 ms / 1 s | 60 / 200 / 360 | ✓ |
| Drag | Kid follows the cursor, stops at the centre line; shadow left behind until release | clamp `x ≥ 2(320−y)` | ✓ |
| Hold freezes game? | **No.** AI and balls keep running | (earlier inference said yes) | ✗ (inference refuted) |
| Red after 1 hit | Dazed and stays alive | 2 hits to die | ✓ (partial) |
| Green after 1 hit | Flinches and stays alive | 3 hits to die | ✓ (partial) |
| Level counts and layouts (keys 2–9, 0) | Matched the table above (`level*_layout.png`, `levels_2-10_sheet.png`) | `#gd` and score positions | ✓ |
| Loss | Greens cheer, logo fades in, corpses fade, then the Play Again screen | `ridicule()` and GreenWin | ✓ |
| Play Again | Back to level 1, 3 reds vs 3 greens | `continue` → `go(1)` | ✓ |
| Enemy pressure | Idle reds wiped out in ≈6–12 s | random 20–30%/100 ms throw starts × 12 kids | ✓ (plausible) |

**Not observed:**
- Clearing a level naturally. An automated bot never killed a green within 3 minutes, even with the `z` revive.
- Survivor carry-over.
- The victory sequence.
- The non-zero score display.

All four rest on Lingo and score data only.

## 11. Claims in `reference-video-notes.md`

| Video claim | Verdict |
|---|---|
| Throws on a fixed diagonal | **Confirmed** [Lingo, obs] |
| Distance grows with hold time | **Confirmed**: linear in 9 steps, capped at 0.67 s |
| Green dies in 1 hit | **Refuted**: 3 hits [Lingo]; a green survived a full-power hit [obs] |
| Red dies in 3 hits | **Refuted**: 2 hits [Lingo]. Observed: survives 1 hit, dazed. The "bare head" look is likely the daze/hit art |
| Greens per level: L2 = 3, L3 = 4, L5 = 6 | **Refuted**: 5, 7, 12 [score, obs]. Several greens start off-stage and walk on, which can make early counts look lower |
| Wraps to "Level 2" with a horde after L8 | **Refuted**: L8 → L9 → L10 → victory [score]. Levels 8–9 show only a digit, and level 10 has its own banner, so the "Level 2" reading is probably a misread banner on level 9 or 10 [inferred] |
| Enemies dodge incoming balls | **Refuted**: no code reads ball positions. The random 10% side-steps can look like dodging |
| Survivors don't carry over (fresh 3 each level) | **Consistent** with the score (new sprite spans each level) [inferred, not observed] |
| Game-over screen with SCORE and PLAY AGAIN | **Confirmed**. Score = `(sum of cleared-level kills + kills this level) × level`. The video's 2730 can't come from a normal run from level 1 (maximum 960); it would need the digit-key level jumps, which don't reset the score, or a different build |
| Corpses stay on the field | **Confirmed** [Lingo, obs] |
| Looping winter music | **Not in this build**: the cast has no music member, only the 16 effects in §9 |
| "Happy Holidays" title | **Confirmed**: this is the IconMedialab holiday edition |

## 12. Differences vs. our Phaser implementation

See [classic-parity-plan.md](classic-parity-plan.md) for the prioritised list.
