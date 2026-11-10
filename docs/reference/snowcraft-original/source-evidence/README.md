# Recovered parity / source-evidence notes

Static dumps taken from `extracted/SnowCraft.exe` (mmap / `KEY*` / VWSC / BITD /
labels) plus the Afterburner parse of `extracted/snowcraft.dcr`. The originals
were not executed.

| File | What it is |
|---|---|
| [`dcr-vs-exe.md`](dcr-vs-exe.md) | Projector movie vs Shockwave DCR: hashes, counts, what is still blocked |
| [`dcr-abmp-resources.json`](dcr-abmp-resources.json) | Afterburner ABMP resource table (tag, id, sizes) |
| [`recovered/dir-config.txt`](recovered/dir-config.txt) | DRCF: 592×320, 15 fps, Director 1600, 328 score frames |
| [`recovered/dir-cast.txt`](recovered/dir-cast.txt) | Cast 1–131 names, BITD sizes, registration points |
| [`recovered/dir-labels.txt`](recovered/dir-labels.txt) | Score labels (`Level 1`–`11`, `GreenWin`) |
| [`recovered/kid-bitmaps.json`](recovered/kid-bitmaps.json) | Members 1–36 used as kid sprites |
| [`recovered/bitmap_meta.json`](recovered/bitmap_meta.json) | BITD width/height/reg/depth |
| [`recovered/walkon.json`](recovered/walkon.json) | 15 fps walk-on paths from VWSC |
| [`recovered/event-loop-layouts.json`](recovered/event-loop-layouts.json) | Event Loop `#gd` / `#level` start locs |
| [`recovered/070_happy_holidays.png`](recovered/070_happy_holidays.png) | Original member 70 BITD (includes `IconMedialab`). Runtime `web/assets/cast/070_happy_holidays.png` is a derivative with that lettering removed. |

The duplicate copies formerly kept at [`docs/recovered/`](../../../recovered/)
were removed; that folder now holds only `ui-bitmaps.json` and `ui-score.json`. Runtime art/audio is **not** duplicated here except the
original member 70 PNG, kept because the live logo was edited.

Acknowledgments: [`../COPYRIGHT-NOTICES.md`](../COPYRIGHT-NOTICES.md).

Mechanics narrative: [`docs/reference-app.md`](../../../reference-app.md),
[`docs/PARITY.md`](../../../PARITY.md),
[`docs/classic-parity-plan.md`](../../../classic-parity-plan.md).
