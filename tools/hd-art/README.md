# HD character redraw

The redrawn characters are hand-authored vector illustrations, not upscaled or filtered copies of the original sprites.

- **Source:** each frame is one SVG in `svg/`, named after the original cast file it replaces, for example `005_R_ready.svg` for `web/assets/cast/005_R_ready.png`.
- **Coordinates:** the SVG `viewBox` uses the original frame's pixel coordinates, for example `0 0 26 34`. Registration points, feet and the frame bounds therefore carry over exactly.
- **Reference:** the original BITD frames are used only as a visual reference for proportions, colours and poses.

## Style rules

| Element | Rule |
| --- | --- |
| Light | From the upper left. Each shape uses a radial gradient: highlight, base, shade, deep shade. |
| Contour | About 0.35 frame-pixels, in the darkest team tone. Red: `#360104`. Green: `#012a04`. Boots: `#0d1238`. |
| Red team | Seen from behind, three-quarter view. Big knit hood with a pompom tuft. A small sliver of face shows at the right-hand hood opening. Quilted puffer coat, cream mittens, navy boots. Gradient `#f2402f → #d0110d → #930808 → #5c0405`. |
| Green team | Three-quarter front view, facing down-right. Knit hood with a pompom tuft, framing a peach face that has one near eye and one far eye. Quilted puffer coat with a zip placket, navy trousers and boots. Gradient `#5ae83f → #14b412 → #068107 → #034806`. |
| Materials | Matte knit on hoods: faint rib lines and a soft diffuse sheen, no gloss. Quilting seams on coats. Rubber sheen on boots. Snowballs are white to `#9eb0cf`. |
| Readability | Detail lines stay at opacity 0.3–0.6, so the frame still reads as the original silhouette at 1×. |

## Render

```sh
NODE_PATH=/path/to/node_modules node tools/hd-art/render.js            # all SVGs, 8x
node tools/hd-art/render.js --scale 8 005_R_ready.svg                   # one frame
uv run --with pillow python3 tools/hd-art/compare.py out.png 005_R_ready 024_G_ready
```

- **`render.js`:** uses `puppeteer-core` with Google Chrome to rasterise each SVG into a transparent PNG in `web/assets/cast-hd/`, at 8× the original frame size.
- **`compare.py`:** builds the side-by-side sheet. It shows the originals with nearest-neighbour scaling and the redraws downsampled the way the browser draws them.
