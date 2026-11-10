# Original-mode Christmas grove

The Original artwork option now has a pixel-art version of the same four decorated, snow-covered trees used in the HD scene's top-right corner.

- [`trees-source.png`](trees-source.png): transparent pixel-art master, produced with the built-in image_gen tool. The exact prompt and reference paths are recorded in [`generation.json`](generation.json).
- [`web/assets/classic/ground.png`](../../web/assets/classic/ground.png): 600×320 composed runtime background, using nearest-neighbour sampling for the grove.
- [`export.json`](export.json): source/output hashes, crop and placement. Only the upper-right 140×100 region may change; the exporter verifies every pixel outside that region against the recovered ground.
- The original recovered ground remains at `web/assets/cast/069_ground.png`. The rest of the Original snowfield and both forts keep their existing pixels. HD and Flutter scenery are unchanged.

Rebuild with `node tools/artwork/build-classic-ground.mjs` after installing the web Playwright dependency and Chromium.

Validation: all 60 web unit tests and three existing browser groups passed, covering Original/HD level banners, real drag/throw with live artwork changes, and ground-mode switching. Browser page/console errors: zero. The Original-mode composed screenshot was visually inspected.
