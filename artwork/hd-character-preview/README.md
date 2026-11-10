# HD characters — references and animation pack

**Reference designs approved on 2026-11-09.** Rich approved the pair with “Yes, these are awesome”. The complete 35-frame pack now replaces the characters in web High resolution mode and the enhanced-only Flutter game. The original stage-1 screenshots below retain their review-time captions; reference-pair approval does not imply human approval of every animation frame.

**Current corrections:** [backward Red falls, facing, body scale, shadows and the redrawn snowfield](corrections/README.md). These supersede the initial bounds-fit export and unchanged-HD-scenery descriptions below. Original recovered assets remain intact.

- Baseline: `Prior-to-high-res-art`, commit `d0a7db7ea698613b75eaaf313d7998cf40099ed2`.
- Candidate branch: `feature/hd-character-preview-codex`.
- Candidate checkout: `/Users/rich/.openclaw/projects/snowcraftai-hd-preview-codex`.
- Stage 1 changed only this reference folder. Stage 2 adds generated masters, registered exports, runtime loading and regression coverage. Original sprites, source archives, scenery, audio, gameplay rules and collision masks remain unchanged.

## Complete animation pack

- `animation-sources/`: 35 transparent generated masters (15 Red and 20 Green), with generation, revision and cleanup records. `animation-prompts.json` and `generation-*.json` preserve the generation history.
- [`web/assets/hd/characters/`](../../web/assets/hd/characters/): 8× runtime PNGs and `manifest.json`, with logical size, original registration, export/original/master SHA-256 hashes and source-to-frame transforms.
- [`flutter/assets/hd/characters/`](../../flutter/assets/hd/characters/): byte-identical native copy of the runtime pack and manifest.
- [`tools/artwork/build-hd-pack.mjs`](../../tools/artwork/build-hd-pack.mjs): deterministic registration/export from the existing masters; it does not generate illustrations. Upright poses retain the original boot height and body height, translating horizontally when needed to fit the frame. Hit/falling poses use a uniform bounds fit because detached boots are unsuitable standing anchors. Both modes retain the original logical frame and registration, validate transparent corners and write both runtime copies.
- Both renderers own HD selection rings; generated character art contains no selection ellipse. The web Original artwork option retains the recovered BITDs and their original embedded rings.
- The unused vector alternative, a superseded two-pose study formerly under `poc/hd-character-redraw-claude/`, has been removed from the tree; it remains in git history.

To reproduce exports after `npm ci --prefix web` and installing Playwright Chromium:

```sh
node tools/artwork/build-hd-pack.mjs
node --test web/tests/hd-characters.test.js
node tools/artwork/capture-hd-pack.mjs /tmp/snowcraft-hd-pack
```

## Review

Open [the interactive comparison](index.html) through the local server. It presents Original Red, Redrawn Red, Original Green, and Redrawn Green at enlarged detail, 3× gameplay display scale, and the original 1× logical size. Switch between light and dark backgrounds to assess alpha edges.

- [Light comparison](comparison.png)
- [Dark comparison](comparison-dark.png)
- [Phone layout](comparison-phone.png)
- [Transparent Red ready reference](assets/red-ready.png)
- [Transparent Green ready reference](assets/green-ready.png)

The generated canvases include transparent padding. The stage-1 comparison fits each redrawn character's visible bounds into its original frame with uniform scaling and bottom alignment; it does not stretch either image. `validation.json` records those historical preview mappings. Production placement is recorded separately in the runtime manifests, including the original reference anchor, final mapped anchor and uniform transform.

## Art direction and iteration

The original tiny sprites and both original animation atlases were inspected before drawing. Red retains a back/side view and Green a front three-quarter view, with red/green winter clothing, white mittens, blue trousers and boots, large heads, short bodies, and richer fabric and seam detail. Cast shadows, selection rings, and text are excluded from the generated references.

Generation used the built-in `image_gen` tool with local image references and `transparent_background: true`; no CLI/API fallback or pixel-upscale substitution was used. Generation is stochastic; the prompts and references allow repeating the direction, not guaranteeing identical bytes.

1. Two identical initial Red requests with `005_R_ready.png` and `player.png` references returned `moderation_blocked` at the output stage with the generic category `other`; no images were returned. Request IDs: `d1509e52-3c8e-4238-9f7c-c2210c701c1b`, `f2149d3c-fe15-4d75-97e2-f58104bd5892`. The initial prompt is retained in [red-ready.txt](prompts/red-ready.txt).
2. Green generated successfully from `024_G_ready.png` and `enemy.png`, using [green-ready.txt](prompts/green-ready.txt). Output filename: `exec-8a86d30f-684a-4191-a9c9-d7990afcc2d8.png`.
3. Red generated successfully using `005_R_ready.png` as the pose reference and the generated Green as the material/style reference, using [red-ready-style-match.txt](prompts/red-ready-style-match.txt). Output filename: `exec-7ee131b1-0d02-48d1-8375-d2772e6726e8.png`. This initial successful Red was too slender against the source silhouette and is retained as an iteration reference in [red-ready-first-pass.png](references/red-ready-first-pass.png).
4. A targeted Red proportion correction used the initial successful Red, the original ready sprite, and the Green reference, with [red-ready-proportions.txt](prompts/red-ready-proportions.txt). It broadened the head/coat and shortened the visible legs while retaining the finish. The selected Red output filename is `exec-7e69666c-3cea-4852-ba68-1d509ac947b3.png`.

The generated source files remain at the tool's default `/Users/rich/.codex/generated_images/01a1be21-1c26-7d61-8427-a3aa41909931/` location as well as the project copies above.

## Validation and limits

`capture-preview.mjs` decodes all four source PNGs, verifies HD reference size (at least 4× logical dimensions), genuine transparency, and transparent corners, renders 12 comparisons, captures light/dark/phone screenshots, checks horizontal overflow at desktop and phone widths, records SHA-256 hashes, and collects browser console/page errors. Results are in [validation.json](validation.json).

The references were approved for their smooth, tactile illustration direction; exact original silhouettes are not claimed for redrawn art. `validation.json` covers only the stage-1 comparison and is not full-game evidence. Stage-2 test/build and screenshot results are recorded in [integration-validation.md](integration-validation.md). Final human visual acceptance of the full animation pack, physical-device play, perceptual audio acceptance and signed store distribution remain separate from automated integration validation.

## Reproduce the preview

From the candidate checkout:

```sh
npm ci --prefix web
python3 -m http.server 8018 --bind 127.0.0.1 --directory .
```

Open `http://127.0.0.1:8018/artwork/hd-character-preview/`. To regenerate screenshots in a second terminal:

```sh
node artwork/hd-character-preview/capture-preview.mjs
```

The initial capture reused the already-installed Playwright dependency in the primary checkout through `SNOWCRAFT_PLAYWRIGHT_MODULE`. A normal installation under `web/node_modules` needs no override.

## Attribution and reuse

The original SnowCraft character design is acknowledged to Nicholson NY and Kevin Chiu in [NOTICE.md](../../NOTICE.md); recovered source notices remain in [COPYRIGHT-NOTICES.md](../../docs/reference/snowcraft-original/COPYRIGHT-NOTICES.md). These redraws derive from those designs. Their generation does not establish a new licence or clearance for the original character IP. No original-game archive was executed.
