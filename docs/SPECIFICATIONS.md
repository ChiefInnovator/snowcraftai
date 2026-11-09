# Snowcraft Reforged — web specifications

All values live in `RULES` at the top of `web/js/game.js` and `web/js/parity.js`. Stage is the original Director **592×320** (ground BITD 600×320 at loc 296,160). Times in ms.

## Rendering

* **Engine:** Phaser 4.2, no physics engine (movement is stepped by the game).
* **Resolution:** the canvas renders at `ceil(displayScale × devicePixelRatio)` (1–4×) with the camera zoomed to match. All game lettering is browser-rendered DOM text, so it stays sharp independently of canvas resolution and sprite filtering. Original sprites use nearest-neighbour filtering (`pixelArt: true`). The optional high-resolution mode uses 35 redrawn character frames exported at 8× logical resolution; scenery and effects use smooth 4× textures from the recovered images. Both modes retain original world dimensions, registration and collision masks. HD selection rings belong to the renderer; the original charging/throwing frames retain their embedded rings.
* **Display size:** "Fit to window" (default) or a fixed 1×–3× multiple of **600×320** (900×480, 1200×640, 1500×800, 1800×960). The Director stage inside is 592×320, mapped with uniform Phaser FIT so pointer aim/drag/throw stay on original coordinates.

Preferences for artwork, background music and mute-all persist independently. Disabling music leaves sound effects enabled; mute-all silences effects, intro and music, and unmuting respects the saved music choice. Artwork changes update existing objects without restarting a level.

## Player (red team)

* 3 kids every level, all back to full health.
* **Drag:** the kid follows the pointer (keeping the grab offset) and cannot cross the original centre line `x ≥ 2·(320 − y)` from (0,320) to (640,0). Its shadow moves with it (the original left the shadow at the grab point until release; the remake doesn't). The game keeps running while you hold.
* **Power:** +1 every 83.33 ms (5 Director ticks) from 0 to 8 (full at ~0.67 s). The meter is the original `power 0`–`power 8` BITD members, registered 27 px to the right of the kid.
* **Hits:** 2 to knock out. The first hit dazes the kid for 4.5 s: it can't be grabbed (hovering plays `deny`) but **can** still be hit.

## Snowballs

* Fixed 2:1 diagonal: red `loc += (−20,−10)`, green `loc += (20,10)` every 50 ms.
* Flight is `power × 2` steps, then 4 drop frames of half-step `(±10,±5)`, splat, and 4 melt frames. Height is baked into the original `snowball` / `drop` bitmaps (registration near the shadow).
* Hits only register during fly steps while `myRange > 0` after the decrement; never during drop/melt.
* At most 10 balls per team in the air; a throw with none free does nothing.

## Enemies (green team)

* **Hits to knock out:** Easy 2, Normal 3, Hard 4. The second-to-last hit knocks the kid down for 2.5 s, immune; earlier hits stagger it for 1.5 s (still hittable).
* **AI (every 100 ms while ready):** 10% `loc += myDirection` of `(±2,±1)` for 1–99 steps then throw; 10% side-step `(±1,±2)` × 5; 20% throw; 60% stand still. `locH < 40` steers `(4,1)`; `locV < 40` steers `(1,4)`. Crossing the centre line triggers a throw. Greens **never aim**.
* **Starts:** per-level VWSC Event Loop positions (`web/js/parity.js` / `docs/recovered/event-loop-layouts.json`). Off-stage greens spawn at those locs and walk in under the edge rule.
* **Throw:** wind-up 0.5 s, cock 0.6–1.5 s, release at random power 5–8, toss pose 0.5 s.

## Levels & score

* Greens per level: 3, 5, 7, 9, then 12 for levels 5–10. Clearing level 10 wins.
* Clearing a level adds the number of greens on it. Losing: `score = (score + kills this level) × level`. Winning: `score × 10`, capped at 1000 if over 900.
* End screen shows `SCORE: n` (hidden when 0) and **Play Again** (back to level 1, score reset).

## Phones (web)

* **Touch:** a tap picks the nearest red kid within 34 px (no hover needed). While dragging, the kid is drawn 36 px above the finger. Lifting the finger throws. Tapping a dazed kid plays the "can't pick up" chirp.
* **Landscape** (touch devices, `max-height: 520px`): nav and settings hide and the game fills the viewport. Portrait shows a dismissible "Turn your phone sideways" hint.
* **Rotation:** layout re-runs on `resize`, `orientationchange` and `visualViewport` resize (at 120 ms and 600 ms, since phones report sizes late) and calls `game.scale.refresh()`. The game box is sized by width with a CSS `aspect-ratio` and `max-width: 100%`, so it can't make the page wider than the screen.
* **Full screen:** works like a video player. A button on the top-right of the game (or the F key) toggles it; Esc, F or the button exits. The game letterboxes to fill the screen. Uses the Fullscreen API where available (desktop, Android, with a landscape lock on touch devices); iPhone Safari has no element full screen, so the game covers the browser window instead. Add to Home Screen (`manifest.webmanifest`, `display: fullscreen`) gives iPhone a true full-screen launch.
* **Rendering:** render scale capped at 2× on touch devices.

## Debug

Add `?debug` to the URL: coordinate labels, the centre line, keys `1`–`9`/`0` to jump to a level, `z` to revive the red team (revived kids can't be hit again).
