# Snowcraft Reforged — Flutter

A native landscape snowball fight for Android and iOS, with a Flutter web target for development and validation. This is an enhanced edition; it contains no original-artwork or legacy-gameplay toggle and does not embed the Phaser website or a WebView.

## Run

From this folder:

```sh
flutter pub get
flutter run
```

Choose an Android device/emulator or iOS simulator/device. Both landscape directions are enabled. In a portrait browser window, the web target shows a rotate prompt.

```sh
flutter analyze
flutter test
flutter build web --no-web-resources-cdn
flutter build apk --debug
flutter build ios --simulator --debug --no-codesign
```

A signed iOS/App Store build requires the project's own signing team and certificates. No signing or store publishing is performed here.

## Enhanced features

- Native Flutter canvas rendering and sharp widget text, with aligned menus, scores, round messages, and replay controls.
- The same 35 redrawn HD character frames as web High resolution mode, exported at 8× logical resolution from the approved reference designs. Original registration and logical geometry are retained. The field, power meter, shadows, and projectile effects remain smooth 4× versions of their recovered artwork.
- Ten recovered waves, three red teammates, fixed diagonal throws, charge power, per-kid health, score, victory/loss, and replay.
- Green spawns are brought inside the reachable green field; movement recovers from every boundary instead of freezing invaders on the centre line.
- Opponents seek a live red kid's throwing lane and choose enough power to reach the target; pointless off-field throws are avoided.
- Drag movement has a speed limit and slows while charging, preventing instant charged teleports.
- A green throw already cocked can still fire after a nonlethal hit, allowing hit trades.
- Touch/mouse controls keep ownership with the finger/pointer that started a drag. Space starts/replays; P or Esc pauses; native buttons support keyboard focus.
- Separate music and effects players, four effect voices, and saved independent background-music / mute-all controls. Mute-all overrides music without changing its saved preference.
- Native SFX copies are 44.1 kHz, 16-bit PCM, with peak balancing to at most −3 dBFS and amplification capped at +6 dB. The compressed remake intro/BGM are reused. Resampling does not restore frequencies absent from the original recordings.
- Backgrounding pauses simulation and sound; returning respects the previous pause state and audio preferences. Ticker, images, and players are disposed on teardown.

## Layout

- `lib/domain/game_engine.dart`: deterministic seeded simulation, input rules, waves, AI, collisions, and scoring.
- `lib/data/game_assets.dart`: static level/cast loading, complete HD-pack registration/8× image validation, and high-quality sprite decode. Failed partial loads dispose their decoded images.
- `lib/data/game_audio.dart`: audio playback and persisted preferences.
- `lib/ui/`: controller, native views, and field painter.
- `assets/`: native copies of text-free art, processed sound effects, MP3s, and statically extracted game metadata.
- `test/`: simulation, audio-precedence/persistence, and landscape widget/input tests.

Source art and metadata came from the sibling [`web/`](../web/) edition. Byte-exact original archives remain in [`docs/reference/snowcraft-original/`](../docs/reference/snowcraft-original/). Original art/audio rights are unchanged; see the root acknowledgments and source documentation. Original EXE/DCR files are never executed by this app or its tooling.

## Validated builds

Validated on 2026-11-09 with Flutter 3.47.9 / Dart 3.13.7:

- `flutter analyze`: no issues.
- `flutter test`: 55 passing tests. Coverage includes all ten legal wave layouts, bounded charging/dragging, actual diagonal hits and damage, four-corner AI reachability, committed throw trades, loss finality, ten-wave progression/replay, independent saved audio preferences, post-resample WAV headroom, real-asset widget controls, second-pointer ownership, pause/resume, and portrait/landscape transitions, charged sprite/meter visibility at every legal edge, delayed overlapping preference writes, pause → menu → start with music on/off, separate user/background pause, and late intro/effect-start cancellation. HD regressions verify all 35 decoded images at 8× with original geometry, incomplete/duplicate/wrong-scale/misregistered manifests, missing/wrong-sized image cleanup, and one selection ring during charge and throw. Review regressions cover green spacing on idle waves, pose resets after taps/cancels/round ends, the live-ball cap, 2p−1 snowball reach, downed-green recovery, bounded effect backlog, separate preference/audio failure handling, asset-load error screen, playfield-only frame repaints, portrait suspension, Resume during suspension, and Space on focused controls.
- `flutter build web --no-web-resources-cdn`: successful self-contained renderer build at `build/web/`.
- `flutter build apk --debug`: successful debug-signed Android APK at `build/app/outputs/flutter-apk/app-debug.apk`.
- `flutter build ios --simulator --debug --no-codesign`: successful iOS simulator app at `build/ios/iphonesimulator/Runner.app`.

The web build has an SDK icon-tree-shaking warning about an unused Cupertino fallback font; this app uses included Material icons. Android Gradle also reports a JVM native-access deprecation warning. Both builds succeed. Physical-device play, perceptual audio quality, and store-signed distribution have not been accepted. Release signing remains unset rather than reusing a debug key.
