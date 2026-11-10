# Snowcraft Reforged — web specifications

All values live in `RULES` at the top of `web/js/game.js` and `web/js/parity.js`. Stage is the original Director **592×320** (ground BITD 600×320 at loc 296,160). Times in ms.

## Rendering

* **Engine:** Phaser 4.2, no physics engine (movement is stepped by the game).
* **Resolution:** the canvas renders at `ceil(displayScale × devicePixelRatio)` (1–4×) with the camera zoomed to match. All game lettering is browser-rendered DOM text, so it stays sharp independently of canvas resolution and sprite filtering. Original sprites use nearest-neighbour filtering (`pixelArt: true`). The optional high-resolution mode uses 35 redrawn character frames exported at 8× logical resolution and a newly illustrated 4× snowfield; effects use smooth 4× textures from the recovered images. HD Reds face upper-left toward Green; their hit/knockout poses fall backward, with fallen bodies scaled against their standing body area rather than scattered-prop bounds. Standing shadows hide while a child is down or out and return on recovery/revival. Both modes retain original world dimensions, registration and collision masks. HD selection rings belong to the renderer; the original charging/throwing frames retain their embedded rings.
* **Display size:** "Fit to window" (default) or a fixed 1×–3× multiple of **600×320** (900×480, 1200×640, 1500×800, 1800×960). The Director stage inside is 592×320, mapped with uniform Phaser FIT so pointer aim/drag/throw stay on original coordinates.

* **HD shadows:** each of the 35 poses has an 8× translucent shadow projected from its actual character silhouette, with cool soft penumbra and darker boot contact. Light projects from upper-left toward lower-right. Down/out poses use close body contact shadows instead of a detached standing shadow; shadows follow movement, pose changes and fade-out. Web Original mode retains the recovered shadow artwork. Flutter uses the same HD masks.
* **HD scenery:** the forts retain opposing orientations. The field has open, flat edges without a circular perimeter mound. One group of snow-covered evergreen trees, decorated with outdoor Christmas ornaments and lights, occupies the top-right corner; the other edges and central play area remain clear.
* **Original-mode scenery:** a clean 8-bit snowfield removes scan grain and dotted artifacts while preserving the two forts' positions, footprints and opposing orientations. The existing pixel-art Christmas grove retains its placement, snow, ornaments and lights. The composed 600×320 field uses the recovered 256-color palette without new dithering; canonical recovered art is preserved separately. Browser Fit scaling uses nearest-neighbor sampling for every Original-mode character and effect, including all 35 recovered fighter poses, without altering their pixels, registration or collision mattes.
* **HD web animation:** `motion.js` draws a separate presentation layer using 56 additional 4× poses (eight walking and eight lateral-shuffle phases plus twelve action/idle poses per team). Walk-on positions interpolate the recorded path at display frame rate using its existing 15/10 fps timer; endpoints, arrival times, level activation, authoritative coordinates and original collision mattes are unchanged. Cadence follows distance, reverses for backward steps, and varies by child. Children brake and settle at arrivals; dragging remains immediate.
* **HD web actions and contact:** common atlas scale and jacket registration preserve proportions. Tight separate contact shadows use actual opaque blue sole pixels, and disappear during falling poses. Throws progress through gather, cock, release and follow-through while retaining the original projectile release instant. Hits use recoil, backward fall, kneeling and rising transitions; daze, immunity and recovery durations remain unchanged. Red hit/knockout poses use the same colored-body area as the charging/ready actor and share the terminal fall's body centre, preventing growth or a position jump when changing artwork packs. The Red stun holds the matching grounded ready body with gentle sway and orbiting stars. Idle children breathe, blink and shift weight independently. These additions belong only to the HD web renderer; Original mode and Flutter retain their existing animation.
* **HD web snowballs:** spherical snowballs and soft ground shadows interpolate toward the next authoritative 50 ms step. Snowballs retain the original 11-pixel logical canvas (about 10 pixels of visible sphere), with a cool blue-gray outline for contrast against snow. New balls begin at the release point even partway through that clock. Drop height interpolates to ground contact, followed by a small snowburst, splat and melt. Original collision/range/count limits and phase durations remain authoritative. Decorative particles are capped at 40 (16 with coarse pointers), expire within 240 ms and clear on level reset.

High resolution is the default artwork. An explicit Original choice is remembered. On the page the choice is the 1999 / 2026 pair of prints under the game (they drive the `#artwork-select` control the game reads), and the first enclosure shows one frame in both artworks with a line to drag across. Preferences for artwork, background music and mute-all persist independently. Disabling music leaves sound effects enabled; mute-all silences effects, intro and music, and unmuting respects the saved music choice. Artwork changes update existing objects without restarting a level. Players who chose Original download the high-resolution pack only when they switch to it.

## Santa Comes to Town (web)

* Santa starts hidden behind the Christmas grove in the top-right corner. He runs left from behind the trees to his visible stopping spot, turns toward the viewer, winks, and waves hello. He then twitches his nose and magically disappears in that same spot; he never runs out across the field.
* The first visit starts after 12 seconds. Each visit lasts 8.2 seconds (run in 2.4 s, pause 0.4 s, wink 1 s, wave 1.8 s, nose twitch 0.9 s, magic 1.7 s), followed by a random 35–50 second wait. His clock and randomness are independent of combat and continue on the title and end screens.
* Both artwork modes have 24 matching poses, including three nose positions, the existing eight-frame entrance run, eight turning poses, three open-palm waves and peek/wink. Original Santa uses one coherent model sheet, one shared scale, an eight-color palette, binary transparency and genuine indexed 8-bit exports without dithering. Nose twitches move the nose sideways while the body stays still. Golden/icy sparkles gather around Santa, then a localized white-gold starburst masks his instantaneous disappearance 520 ms into the spell. His body, cast shadow and boot contacts vanish together; expanding sparkles linger and fade afterward. Original uses 12 spaced pixel stars (8 on phones) around the silhouette so his face stays readable; HD retains spiralling ribbons, smooth four-point stars and glows. Effects clear on restart/shutdown and never join combat.
* Running cadence follows distance travelled. Shared source scale and torso registration keep body proportions steady across each animation atlas. New frames use a padded 72×64 logical canvas (576×512 for HD); the peek/wink retain 64×64 (512×512 for HD). Original uses nearest-neighbour sampling and HD uses smooth sampling.
* Both modes project a soft pose shadow toward the lower-right. Separate tight, dark contact shadows sit directly beneath the actual rendered boot soles; they disappear for the two airborne running phases and return on landing. The foreground grove silhouette includes white boughs as well as colored branches, preventing sprite strips from showing through snow.
* Santa is decorative: no hitbox, pointer handler, team, health, score or snowball interaction. Artwork changes update him and the grove in place. `?santa` previews the visit after 0.75 seconds and repeats it with six-second waits.

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
* **Starts:** per-level VWSC Event Loop positions (`web/js/parity.js` / `docs/reference/snowcraft-original/source-evidence/recovered/event-loop-layouts.json`). Off-stage greens spawn at those locs and walk in under the edge rule.
* **Throw:** wind-up 0.5 s, cock 0.6–1.5 s, release at random power 5–8, toss pose 0.5 s.

## Levels & score

* Greens per level: 3, 5, 7, 9, then 12 for levels 5–10. Clearing level 10 wins.
* Clearing a level adds the number of greens on it. Losing: `score = (score + kills this level) × level`. Winning: `score × 10`, capped at 1000 if over 900.
* End screen shows `SCORE: n` (hidden when 0) and **Play Again** (back to level 1, score reset).

## Phones (web)

* **Touch:** a tap picks the nearest red kid within 34 px (no hover needed). While dragging, the kid is drawn 36 px above the finger. Lifting the finger throws. Tapping a dazed kid plays the "can't pick up" chirp.
* **Landscape** (touch devices, `max-height: 520px`): the card, envelope and settings hide and the game fills the viewport. Portrait shows a dismissible "Turn your phone sideways" hint.
* **Rotation:** layout re-runs on `resize`, `orientationchange` and `visualViewport` resize (at 120 ms and 600 ms, since phones report sizes late) and calls `game.scale.refresh()`. The game box is sized by width with a CSS `aspect-ratio` and `max-width: 100%`, so it can't make the page wider than the screen.
* **Full screen:** works like a video player. A button on the top-right of the game (or the F key) toggles it; Esc, F or the button exits. The game letterboxes to fill the screen. Uses the Fullscreen API where available (desktop, Android, with a landscape lock on touch devices); iPhone Safari has no element full screen, so the game covers the browser window instead. Add to Home Screen (`manifest.webmanifest`, `display: fullscreen`) gives iPhone a true full-screen launch. The canvas is re-sized to the new display size without restarting the level.
* **Rendering:** render scale capped at 2× on touch devices.

## Debug

Add `?debug` to the URL: coordinate labels, the centre line, keys `1`–`9`/`0` to jump to a level, `z` to revive the red team (revived kids can't be hit again).
