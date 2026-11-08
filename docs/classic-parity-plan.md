# Classic parity plan: gameplay gaps vs. the original SnowCraft

This plan lists where `src/js/game.js` (as of 2026-11-08) plays differently from the 1999 original, highest-impact gaps first. It covers rules, numbers, timing, AI and flow only — not art or look. The full source and evidence for every original value is in [reference-app.md](reference-app.md); section numbers below point there.

All coordinates assume the original's 592×320 stage. Ours is 600×320: scale x by 600/592 if you keep 600.

## Status (2026-11-08)

Implemented in `src/js/game.js` (`RULES`): items 1–6, 8, 9, 10 (level-clear sound gates the next level), 11, 12, 13, 14 (our own synthesized sounds), 15 (behind `?debug`), and 7's counts and 10-level end.

Deliberate differences:
- **7:** enemy start positions are generated (3 fixed + random free spots), not ported from the original layouts. Level 10 reds start in the usual spots.
- **16:** the title waits for a **click** rather than a hover, because browsers only allow audio after a click.
- **14:** we keep our background music; the original had none.
- Greens never collide with each other or with reds (as in the original); the earlier arcade-physics colliders are gone.

## P0: core rules that change how the game plays

1. **Enemy aiming → no aiming.**
   - *Ours:* `enemyThrowSnowball` picks a live red and solves for the strength that lands on its x, with an `errorMargin` miss. This makes enemies snipers.
   - *Original:* greens never look at the reds. Each throw goes down-right on the fixed diagonal from wherever the green stands, at a **random power of 5–8** (240–360 px including the drop). Threat comes from lane alignment and volume (§6–7).
   - *Change:* drop target selection and `errorMargin`; use `power = rand(5..8)` on the original range scale.
2. **Hit points.**
   - *Ours:* player `health = 3`; enemy 1/3/4 by difficulty.
   - *Original:* **red dies on the 2nd hit; green dies on the 3rd** (§5–6).
   - *Change:* red 2; green 3 on the default difficulty.
3. **Hit/stun reactions and immunity.**
   - *Ours:* `!kid.isStunned` makes any stunned kid immune.
   - *Original:*
     - **Red, 1st hit:** dazed for about 4.5 s, cannot be grabbed, and **can still be hit** (the 2nd hit kills).
     - **Green, 1st hit:** `ow` 1.0 s, then `recover` 0.5 s, still hittable.
     - **Green, 2nd hit:** knocked **down for 2.5 s and immune**, then `ow` and `recover` 0.5 s each.
     - **Green, 3rd hit:** dead.
   - *Change:* make immunity apply only to a downed green.
4. **Throw power curve and range.**
   - *Ours:* strength 1–100 on an exponential ramp; `distance = 5 * strength`, up to 500 px.
   - *Original:* **9 power steps (0–8), +1 every 83 ms, full at 0.67 s (linear).** Horizontal distance is `20·max(2p,1) + 40` px, i.e. 60–400 px; vertical is half (§5, §7).
   - *Change:* replace `increaseStrength` with a linear tick, and quantise the meter to 9 states.
5. **When balls can hit.**
   - *Ours:* the Bezier arc hits when `|dx| < 15 && |dy| < 18` at any point.
   - *Original:* collisions only **during flight** (all steps but the last), **never during the 4-step drop**. Ball speed is 400 px/s horizontal, constant: 20 px per 50 ms step. The ball is drawn about 38 px above a ground point that travels the diagonal, so in effect the hit box is the ground-track lane under the kid (§7).
   - *Change:* use linear ground-track motion with no z-arc, and stop hit tests at drop start.
6. **Enemy behaviour model.**
   - *Ours:* move to a random point with `physics.moveTo` at 40 px/s, 1–2 segments, then a fixed 300/750/1000 ms throw sequence.
   - *Original:* a random state machine stepping every 100 ms (§6):
     - Each step: 10% walk along the throw axis 2 px/step for `random(99)` steps then throw; 10% side-step (1,2)/step × 5; 20% throw; 60% idle.
     - Throw timing: windup 0.5 s, cock 0.6–1.5 s, toss 0.5 s.
     - Walking rules: steer in from the edges (x<40 → (4,1), y<40 → (1,4)); crossing the centre line triggers an immediate throw.
     - At most **10 green snowballs in flight**.
7. **Levels and enemy counts.**
   - *Ours:* 5 configs (3, 5, 7, 9, 11), and then `LEVEL_CONFIG[last]` repeats forever.
   - *Original:* **10 fixed levels: 3, 5, 7, 9, then 12 ×6**, each with a hand-placed layout. Reds start closer on level 10. Clearing level 10 ends the game with a victory sequence (§8).
   - *Change:* port the per-level green start positions from §8 / `reference/analysis/score.txt`. Greens that start off-stage walk in under the edge rule.

## P1: flow and scoring

8. **Score.**
   - *Ours:* none.
   - *Original:*
     - Clearing a level adds `+greens on that level`.
     - On loss, `score = (score + kills this level) × level`.
     - A full clear gives `score × 10`, capped at 1000 if over 900.
     - Shown on the game-over or victory screen as `SCORE: n`, counting up (blank when 0) (§8).
9. **Game-over and victory screens.**
   - *Ours:* "GAME OVER" text, click → `scene.restart()`.
   - *Original — loss:* greens cheer (laugh ×2), corpses fade, the logo fades in, then a **Play Again** button bottom-right plus the score. Play Again resets the score and returns to level 1, which waits for the mouse to enter the field.
   - *Original — win:* a victory banner sequence and the final score.
10. **Between-level flow.**
    - *Ours:* a 2 s delay, then the next level.
    - *Original:* live reds go to their rest pose while the "level cleared" sound plays; the next level starts only after it finishes. Then a walk-on with a "Level N" banner, played at 10 fps.
    - Dead reds come back each level, and everyone's hit counters reset. Ours already recreates 3 reds, which matches.
11. **Player snowball cap.** The original allows 10 red balls in flight; at 10, a release does nothing. Ours has no cap.

## P2: feel and edge details

12. **Drag rules.**
    - *Ours:* the boundary is `y ≥ 320 − x·320/600`, the line from (0,320) to (600,0).
    - *Original:* `x ≥ 2·(320 − y)`, the line from (0,320) to (640,0), plus the ground-rect constraint. The drag speed is unlimited in both. In the original, the held kid's shadow stays at the grab point until release.
    - The game keeps running while you hold, which ours already matches.
13. **Selection rules.** In the original, a dazed red cannot be grabbed (hover plays `short_chirps`), and a hit cancels the ring and meter. Ours cancels the drag on stun, which matches; check that hovering a dazed red shows no ring.
14. **Sound triggers.** Map ours to the original's events (§9):
    - `Whoosh` at full power, `Whoosh Percusive` otherwise.
    - `hit1` on any hit; `hit2` when a green is knocked down; `kids1–3` when a green dies.
    - `bird_tweets` when a red is dazed; `Ahhhh!` when a red dies.
    - `splat` on a miss; `laugh` on loss; `ugly`/`halaluja` on level clear.
    - The original has **no music track**.
15. **Debug keys (optional).** The original has `1`–`9` and `0` to jump to a level, and `z` to revive reds (who then become invulnerable). Ours has none; these are worth adding behind a debug flag for testing.
16. **Start gate.** Level 1 waits for the mouse to be over the field, both before and after the walk-on. Ours starts automatically.

## Already matching (no change needed)

- Fixed-diagonal throws for both teams (`throwSnowball` ignores the target).
- 3 reds every level.
- Corpses stay on the field.
- The game keeps running while you drag.
- Stun cancels the current drag and actions.
- Game over restarts at level 1 (`START_LEVEL = 1`).
