# HD character integration validation — 2026-11-09

## Scope

The web High resolution option and enhanced-only Flutter game use the same 35 redrawn character frames: 15 Red and 20 Green, exported at 8× their original logical canvas sizes. Original artwork mode, cast registrations, collision masks, scenery, audio and gameplay rules remain intact. The earlier vector study is preserved under `poc/` and is unused at runtime.

Reference-pair approval is recorded in the [artwork notes](README.md). This report records implementation checks and agent visual inspection; it does not claim final human acceptance of every animation frame, physical-device play, perceptual audio acceptance or signed store distribution.

## Export and visual inspection

- Both runtime manifests and all 35 PNGs are byte-identical between web and Flutter.
- Each runtime's character PNGs total **4,514,292 bytes**. Manifest SHA-256: `75bcf2eb0c00c8275decf30ca669b59c50232e22b48aa3775f61f78c43fc61b5`.
- Repeating `node tools/artwork/build-hd-pack.mjs` reproduced all export and manifest bytes exactly. [Machine receipt](integration-evidence/export-validation.json).
- All 35 poses were inspected on light and dark checkerboards at the same 2× logical scale as the original artwork. The capture collected zero page errors. [Capture receipt](integration-evidence/contact-sheet-validation.json).
- The review caught and fixed collapsed hit/falling sprites caused by using detached blue boots as upright anchors. Those poses now use a uniform bounds fit. Upright poses retain original foot height, moving horizontally within the original frame before reducing scale. No illustration is stretched.
- Original source art and archives were not modified or executed.

[Light contact sheet](integration-evidence/character-sheet-light.png) · [Dark contact sheet](integration-evidence/character-sheet-dark.png)

## Runtime validation

- `npm test --prefix web`: **56 passing unit tests**, including complete pack/hash/geometry checks and an independent decoded-PNG-alpha regression for hit/falling sprite size.
- All **10 browser regression groups** have passing local evidence. The full run passed nine groups; after replacing a fixed replay-fade sleep with actual UI-readiness waiting, the four affected victory/loss/phone/error groups passed together. CI runs the complete suite again for the PR.
- Browser checks cover all 35 live HD textures, original↔HD switching without changing collision mattes, single selection rings, a real charge/throw, all level banners, victory/loss/replay, HiDPI/full screen, and phone portrait→landscape→portrait with touch throwing and replay. Final checks reported zero page/console errors.
- Browser testing reproduced a delayed-frame Phaser Clock catch-up error in completed walk-on timers. The callback now ignores already-completed/cancelled walk-ons; a regression forces a 10-second Clock update and verifies every kid completes exactly once.
- The supplied `develop-web-game` client completed a real HD gameplay action sequence, producing [a gameplay screenshot](integration-evidence/web-gameplay.png) and [text state](integration-evidence/web-gameplay-state.json) with projectiles from both teams. Its first headless WebGL readback was black; the complete browser matrix supplies the primary rendering evidence. A headed retry timed out loading external dependencies.
- `flutter analyze`: **no issues**. `flutter test`: **34 permanent tests pass**, including malformed/incomplete HD pack rejection, decoded dimensions, partial-load cleanup and one selection ring during charge/toss.
- Real-asset Flutter widget captures were inspected for charge/throw, hurt/down/dead poses, victory/loss and orientation. These captures use the Flutter test font and are not physical-device evidence.
- `flutter build web --no-web-resources-cdn`: **successful**. Compiled-runtime captures verify actual typography and HD art in eight states/orientations with zero page/console errors. Packaged web assets match all 35 source PNGs and the manifest byte-for-byte.
- A separate compiled-runtime probe waited for the active HUD before sending pointer input: charge, drag/throw and phone captures completed with zero errors. The [charge capture](integration-evidence/flutter-web-charge.png) shows a full meter and exactly one selection ring.
- Android debug APK and unsigned iOS simulator build results, including packaged-asset readback, are recorded in the integration PR before merge. These builds do not establish physical-device or signed-store acceptance.

[Web hit/down/dead poses](integration-evidence/web-hit-down-dead.png) · [Compiled Flutter web level intro](integration-evidence/flutter-web-level-intro.png) · [Compiled Flutter web charge](integration-evidence/flutter-web-charge.png)

## Reproduce

From the repository root:

```sh
npm ci --prefix web
npx --prefix web playwright install chromium
node tools/artwork/build-hd-pack.mjs
node tools/artwork/capture-hd-pack.mjs /tmp/snowcraft-hd-pack
npm test --prefix web
npm run test:browser --prefix web
```

Flutter analysis, tests and build commands are documented in [flutter/README.md](../../flutter/README.md).
