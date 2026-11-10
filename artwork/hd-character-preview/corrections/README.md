# Artwork corrections — 2026-11-09

Requested: turn Red toward Green, make Red fall backward, remove orphaned standing shadows, keep fallen body size consistent, and redraw the background with the character illustration process.

- Upright Red exports face upper-left; the existing toss master already faced that way and stays unmirrored.
- Five new Red masters preserve separate hit/knockout poses: `009_R_hit.png`, `010_R_hit2.png`, `014_R_dead.png`, `015_R_dead.png`, `016_R_dead.png`. Faces and coat fronts remain upward as the characters fall backward toward the lower-right.
- Fallen bodies use the standing teammate's coloured body area as their scale reference, bounded by their original frame. Detached hats, boots and snow no longer enlarge the body.
- The final `ground.png` master has opposing forts, flat open edges without the circular mound, and one snow-covered evergreen grove with outdoor Christmas decorations/lights only in the top-right corner. The scattered edge trees were removed at the user's request. Runtime exports are 2400×1280 (4×). [Original/HD comparison](background-comparison.png).
- Every HD pose has its own projected soft shadow with translucent blue-grey penumbra and darker boot contact. Down/out poses use close body contact shadows, never a leftover standing shadow. Original mode retains recovered shadow art; Flutter shares the HD masks.

Generation used the built-in **image_gen** tool with local style/pose references and genuine alpha for characters. [generation.json](generation.json) contains the exact final prompts and source paths for all six saved masters in this directory. An additional halo-removal attempt for frame 009 did not improve the output and was discarded; the first generated master is used. Exporting/registering PNGs is deterministic canvas processing, not a pixel-filter substitute for illustration. Previous generation masters remain in `../animation-sources/`.

Shipped files:

- [`web/assets/hd/characters/`](../../../web/assets/hd/characters/) and the byte-identical [`flutter/assets/hd/characters/`](../../../flutter/assets/hd/characters/), including manifests that record each master path/hash and export transform.
- Both character directories also contain 35 `shadow_*.png` masks, with dimensions, registration, kind and SHA-256 in each character's manifest entry. [`render-shadow.mjs`](../../../tools/artwork/render-shadow.mjs) derives them deterministically from the registered HD alpha silhouettes. They follow the pose and body fade in each renderer.
- [`web/assets/hd/scenery/ground.png`](../../../web/assets/hd/scenery/ground.png) and its byte-identical [`flutter` copy](../../../flutter/assets/hd/scenery/ground.png).

Validation: **60 web unit tests**, **13 full browser groups**, **35 Flutter tests**, and Flutter analysis passed. Browser groups exercise actual hits, knockout/revival shadows, pose changes, alpha/fade/movement, original↔HD switching, charge/throw, replay and phone rotation. Tests independently decode all shadow PNGs to verify feathered alpha, translucency and unclipped blur. Browser page/console errors: zero. A connected Flutter debug client completed a hot restart and displayed the new soft shadows. After the final Christmas-grove-only background revision, the asset checks were rerun and final web gameplay captured with zero errors.

The contact sheet and actual web/Flutter screenshots were visually inspected. [Web gameplay](gameplay.png) shows a Red knockout on its back, consistent body scale and no orphaned standing shadow. [All 35 exported poses](character-sheet-light.png) show their relative sizes and directions. These are agent inspection evidence, not a claim of human approval of every pose.

Full local measurements and browser screenshots: `/tmp/snowcraft-artwork-fixes/`. The standard skill client was also run headless and headed; its direct WebGL readback is black, so composed page screenshots provide the visual evidence.
