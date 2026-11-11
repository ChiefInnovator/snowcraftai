# SnowCraft Reforged — web edition

This folder is the GitHub Pages site root. The game runs directly in the browser without a build step.

From the repository root:

```sh
python3 -m http.server 8000 -d web
npm --prefix web ci
npm --prefix web test
npm --prefix web exec -- playwright install chromium
npm --prefix web run test:browser
```

Open http://localhost:8000. Use `?debug` for coordinate labels and level-jump keys. Browser regression checks start their own temporary local server.

Under the game, the **1999** print selects the Original artwork (nearest-neighbour sprites) and the **2026** print selects High resolution: redrawn 8× character frames and a redrawn 4× snowfield. Art without a redrawn version, such as effects, falls back to smooth 4× interpolation of the same source art, which does not add missing source detail. Both modes use sharp HTML lettering and retain original collision masks and logical sizes. Artwork changes do not restart the level.

**Background music** controls only the looping remake music. **Mute all** also silences the intro and sound effects. Both settings and artwork preferences persist locally.

Game rules and timings remain based on the recovered original; see [specifications](../docs/SPECIFICATIONS.md), [parity evidence](../docs/PARITY.md), and the root [enhancement list](../README.md#enhancements-over-the-original). The native enhanced-only landscape edition is in [flutter/](../flutter/README.md).
