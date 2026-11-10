# HD web animation

The six selected atlases add eight forward/backward gait phases, eight lateral
shuffle phases, and twelve action/idle poses per team. Reds retain their
back-three-quarter view toward the upper left; Greens face the lower right.

`generation.json` preserves the built-in image generation prompts and provenance.
`cleanup.json` records transparent-background cleanup; `references/` contains
copies of the approved HD characters used as references. `*-generated.png` keeps
the pre-cleanup sheet where a cleaned version was selected.

Rebuild the 56 registered poses, 56 projected shadows, release-hand anchors and
actual blue-sole contact records with:

```sh
node tools/artwork/build-game-animation.mjs
```

Runtime output: `web/assets/hd/motion/`. The 35 existing HD poses and recovered
collision sprites remain byte-for-byte unchanged. New poses use a shared atlas
scale and jacket anchor, exported at 4x on a padded 64x56 logical canvas.
`web/js/motion.js` owns presentation; `game.js` retains all authoritative state.

`preview.mp4` is a 60 fps capture of the actual composited local web game showing
the walk-on, charging/release, snowballs, recoil, backward falls, daze and idle.
Combat events are triggered through the game's scene helpers for this demo.
Validation receipts are in `validation.json`.

The subsequent Red charging/hit size correction is shown in
[`red-hit-size-fix.png`](red-hit-size-fix.png), with current measurements and
regression receipts in [`red-hit-size-fix.json`](red-hit-size-fix.json).
