# Technical Specifications: Snowcraft Reforged

## Core Mechanics

* **Engine:** Phaser 3.60 (Arcade Physics).
* **Perspective:** Pseudo-3D (2.5D).
  * **Z-Axis:** Simulated via a custom `z` property on projectiles.
  * **Gravity:** `zSpeed` decreases by 0.5/frame.
  * **Shadows:** Rendered at `y + z` to create depth perception.
  * **Collisions:** Only trigger if `ball.z < 40` (Head height).

## AI Behavior Model

The AI (Green Team) uses a specific targeting algorithm:

1. **Selection:** Randomly selects a thrower and a target.
2. **Leading:** The AI calculates where to drag the mouse *from* in order to shoot *at* the player.
3. **Accuracy (Error Margin):**
   * **Level 1:** +/- 0.35 radians (Very inaccurate).
   * **Level 5:** +/- 0.05 radians (Sniper accuracy).

## Game Loop

The `LEVEL_CONFIG` array controls the pacing.

* **Win:** Kill all Green Team members -> Next Level.
* **Lose:** All Red Team members die -> Game Over (Click to Reload).
