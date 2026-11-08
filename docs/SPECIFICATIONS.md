# Technical Specifications: Snowcraft Reforged

All values live in `RULES` at the top of `src/js/game.js`. Stage is 600×320 logical pixels; times in ms.

## Rendering

* **Engine:** Phaser 3.60, no physics engine (movement is stepped by the game).
* **Resolution:** the canvas renders at `ceil(displayScale × devicePixelRatio)` (1–4×) with the camera zoomed to match, so text and UI stay sharp on HiDPI screens. Sprites scale with nearest-neighbour filtering (`pixelArt: true`).
* **Display size:** "Fit to window" (default) or a fixed 1×–3× multiple.

## Player (red team)

* 3 kids every level, all back to full health.
* **Drag:** the kid follows the pointer (keeping the grab offset) and cannot cross the centre line from (0,320) to (648,0). Its shadow stays at the grab point until release. The game keeps running while you hold.
* **Power:** +1 every 83 ms from 0 to 8 (full at ~0.67 s); the meter shows 0–8 bars.
* **Hits:** 2 to knock out. The first hit dazes the kid for 4.5 s: it can't be grabbed (hovering plays `deny`) but **can** still be hit.

## Snowballs

* Fixed 2:1 diagonal: red up-left, green down-right, 400 px/s horizontally.
* Flight length = `20 × max(2 × power, 1)` px, then a 40 px drop at half speed. Total range 60–400 px.
* Hits only register during the flight, never in its final 20 px or during the drop.
* At most 10 balls per team in the air; a throw with none free does nothing.

## Enemies (green team)

* **Hits to knock out:** Easy 2, Normal 3, Hard 4. The second-to-last hit knocks the kid down for 2.5 s, immune; earlier hits stagger it for 1.5 s (still hittable).
* **AI (every 100 ms while ready):** 10% walk along the throw axis 2 px/step for 1–99 steps then throw; 10% side-step 5 steps; 20% throw; 60% stand still. Greens near the top/left edges steer in; reaching the centre line triggers a throw. Greens **never aim** — danger comes from shared lanes and volume.
* **Throw:** wind-up 0.5 s, cock 0.6–1.5 s, release at random power 5–8, toss pose 0.5 s.

## Levels & score

* Greens per level: 3, 5, 7, 9, then 12 for levels 5–10. Clearing level 10 wins.
* Clearing a level adds the number of greens on it. Losing: `score = (score + kills this level) × level`. Winning: `score × 10`, capped at 1000 if over 900.
* End screen shows `SCORE: n` (hidden when 0) and **Play Again** (back to level 1, score reset).

## Debug

Add `?debug` to the URL: coordinate labels, the centre line, keys `1`–`9`/`0` to jump to a level, `z` to revive the red team.
