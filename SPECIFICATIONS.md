# Technical Specifications: Snowcraft Reforged

## Core Mechanics

* **Engine:** Phaser 3.60 (Arcade Physics for bodies; snowballs use original isometric steps).
* **Charge:** `(elapsed ticks) / 5`, clamped **0–8** (Director `the timer`).
* **Throws:** Fixed isometric steps, `range = power * 2`.
  * Red: `(-20, -10)` per ball tick (`myTempo = 2`).
  * Green: `(20, 10)` per ball tick; power `random(4)+4` → 5–8.
* **Hits to KO:** Red **2**, green **3** (Lingo `myHits`).
* **Audio:** Original WAVs on a single replaceable SFX channel; `step`/`splat` only if idle. See `docs/PARITY.md`.

## Levels

VWLB labels `Level 1` … `Level 11`. Green counts `min(12, 2*level+1)` (3, 5, … capped at 12 sprite slots). Counts for levels 6–11 are inferred from the formula plus the 12 green channels.

## Score

* Clear: `gScore = gScore + gGdead`
* Loss: `gScore = (gScore + gGdead) * level` then game over (`ridicule` / laugh)

## AI Behavior Model

Greens pick walk vs windup with `random(10)` in the original. This remake still uses Phaser roaming for pathing (**parity gap**) but throws in the recovered fixed direction rather than aiming at a red player.
