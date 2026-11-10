# Santa Comes to Town

Santa begins behind the decorated Christmas grove, runs left to his visible stopping spot, turns to the viewer, winks, waves hello, then twitches his nose and magically vanishes in place with spiralling light, a white-gold starburst and lingering sparkles. This cameo is decorative and appears in both web artwork modes.

- [`v3/`](v3/README.md): current three-pose nose-twitch atlases, spell timing, validation and magic preview details.
- `v2/classic/` and `v2/hd/`: retained entrance/turn/wave animation atlases. `run-cycle.png` has eight running phases in a 4×2 grid; `turn-cycle.png` has eight quarter/frontal poses in a 4×2 grid; `wave-cycle.png` has three open-palm wrist positions in a 3×1 grid.
- [`v2/generation.json`](v2/generation.json): exact built-in image_gen prompts, references, selected outputs and HD run background-removal pass. The original [`generation.json`](generation.json) and `classic/` / `hd/` masters retain the current peek/wink and superseded pose history.
- [`web/assets/santa/manifest.json`](../../web/assets/santa/manifest.json): exported frame registration, source/output SHA-256 hashes, placement, timing, and grove masks.
- [`web/js/santa.js`](../../web/js/santa.js): independent visit timeline and renderer. It does not consume combat RNG or modify gameplay.

Rebuild with `node tools/artwork/build-santa.mjs` after installing the web Playwright dependency and Chromium. The matching Original-mode grove must first exist (`node tools/artwork/build-classic-ground.mjs`).

The exporter splits each atlas into registered cells and normalizes their hat-to-buckle span to 26 logical pixels. A shared torso baseline prevents per-pose resizing, while the solid soles in the actual exported pixels determine grounded placement. New runtime frames are padded to 72×64 (576×512 for HD); the peek/wink remain 64×64 (512×512 for HD). The padding accommodates extended boots and an open waving hand without shrinking Santa. Original uses nearest-neighbour sampling; HD uses smooth sampling.

The run advances through eight phases as distance increases. Only phases 3 and 7 are airborne. Quarter and front views bridge changes in direction, including the arrival at the greeting. The wave holds the raised shoulder/elbow steady, with an open white-gloved palm facing the viewer and the wrist moving side to side through three positions.

Every pose has a projected silhouette shadow in each style, with separate left-facing variants for the side/quarter poses. The renderer adds one or two small, darker contact ovals beneath the supporting boot soles. These use the actual exported sole pixels rather than the character center, and hide during airborne phases; the soft cast shadow remains visible.

Foreground masks use each style's own continuous grove silhouette, including the white snow-covered boughs: the pixel-art master's alpha supplies the Original outline, while the HD boughs use a traced outline. They copy the exact composed ground pixels at their original coordinates. The exporter verifies that drawing the masks over their background changes zero pixels, so the grove looks unchanged while Santa is hidden. Original recovered assets remain untouched. Santa remains behind the grove throughout his greeting and magical disappearance.

Preview locally at [http://localhost:8000/?santa](http://localhost:8000/?santa). Normal visits start after 12 seconds, then wait 35–50 seconds between appearances; the preview uses shorter waits.

[`preview.mp4`](preview.mp4) shows a full visit captured from the game at 60 fps: Original on the left, HD on the right.

The browser visit check covers both styles, fully hidden starts, supported entrance frames, the unchanged stopping spot, all three wave textures, nose-twitch positions, a stationary magical departure, simultaneous body/shadow/contact disappearance, lingering sparkles and unchanged combat. Lifecycle probes cover artwork switches, repeat visits, phone particle caps and scene cleanup. The current manifest references 122 runtime PNGs and 12 unique source images; earlier sources remain as history.

Validation: 71 unit tests and 17 browser groups pass with zero page/console errors. All 122 manifest PNGs and 12 masters pass hash, dimension and transparency checks, including the new nose-pose boot contacts. Receipts are in [`v3/validation.json`](v3/validation.json). The preview contains 504 actual composited frames per style at 60 fps (8.4 seconds).
