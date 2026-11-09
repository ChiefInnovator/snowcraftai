# HD character reference candidate — Codex

**Stage 1 only. Visual approval is pending.** These are newly illustrated Red and Green ready-pose references. The remaining 33 character frames and integration into the game are intentionally awaiting the approval requested in the task.

- Baseline: `Prior-to-high-res-art`, commit `d0a7db7ea698613b75eaaf313d7998cf40099ed2`.
- Candidate branch: `feature/hd-character-preview-codex`.
- Candidate checkout: `/Users/rich/.openclaw/projects/snowcraftai-hd-preview-codex`.
- Only this new `artwork/hd-character-preview/` folder changes. Game code, original sprites, source archives, scenery, audio, mechanics, and the existing single-selection-ring fix are preserved.

## Review

Open [the interactive comparison](index.html) through the local server. It presents Original Red, Redrawn Red, Original Green, and Redrawn Green at enlarged detail, 3× gameplay display scale, and the original 1× logical size. Switch between light and dark backgrounds to assess alpha edges.

- [Light comparison](comparison.png)
- [Dark comparison](comparison-dark.png)
- [Phone layout](comparison-phone.png)
- [Transparent Red ready reference](assets/red-ready.png)
- [Transparent Green ready reference](assets/green-ready.png)

The generated canvases include transparent padding. The comparison fits each redrawn character's visible bounds into its original frame with uniform scaling and bottom alignment; it does not stretch either image. `validation.json` records the source rectangles and preview mappings. These mappings are for review, not approved production registration. Exact foot registration, animation consistency, and all 35 frame variants must be completed and tested in stage 2.

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

The candidate references are not yet approved as exact pose/silhouette matches. Their smooth, tactile illustration style is a visual choice for review. The complete animation pack, production frame registration, ring ownership, Flutter integration, gameplay execution with HD sprites, and final visual approval are pending stage 2. No gameplay, Flutter, or full application test pass is claimed for this preview-only change.

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
