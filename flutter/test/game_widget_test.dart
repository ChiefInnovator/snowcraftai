import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:snowcraft_reforged/data/game_assets.dart';
import 'package:snowcraft_reforged/data/game_audio.dart';
import 'package:snowcraft_reforged/domain/game_engine.dart';
import 'package:snowcraft_reforged/main.dart';
import 'package:snowcraft_reforged/ui/game_painter.dart';

class WidgetPreferences implements PreferencePort {
  final data = <String, bool>{};
  @override
  Future<bool?> read(String key) async => data[key];
  @override
  Future<void> write(String key, bool value) async {
    data[key] = value;
  }
}

class WidgetAudio implements AudioPort {
  @override
  Future<void> prepare() async {}
  @override
  Future<void> music(bool playing) async {}
  @override
  Future<void> intro() async {}
  @override
  Future<void> effect(String file) async {}
  @override
  Future<void> stopEffects() async {}
  @override
  Future<void> close() async {}
}

Future<({GameAssets assets, GameEngine engine, GameAudio audio})> launch(
  WidgetTester tester,
  Size size,
) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  final assets = (await tester.runAsync(GameAssets.load))!;
  final engine = GameEngine(assets.levels);
  final audio = GameAudio(WidgetAudio(), WidgetPreferences());
  await audio.initialize();
  await tester.pumpWidget(
    SnowcraftApp(assets: assets, engine: engine, audio: audio),
  );
  await tester.pump();
  return (assets: assets, engine: engine, audio: audio);
}

Future<void> frames(WidgetTester tester, int count) async {
  for (var i = 0; i < count; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

void main() {
  testWidgets(
    'landscape menu uses crisp widget text, one brand, and independent audio controls',
    (tester) async {
      final app = await launch(tester, const Size(900, 500));
      expect(find.text('Snowcraft Reforged'), findsOneWidget);
      expect(find.text('Ready. Aim. Snow.'), findsOneWidget);
      expect(app.assets.images[app.assets.ground.key]!.width, 2400);
      expect(
        app.assets.frames.values.any((f) => f.file.contains('play_again')),
        isFalse,
      );
      await tester.tap(find.byTooltip('Turn background music off'));
      await tester.pump();
      expect(app.audio.musicEnabled, isFalse);
      expect(app.audio.muted, isFalse);
      await tester.tap(find.byTooltip('Mute all sounds'));
      await tester.pump();
      expect(app.audio.muted, isTrue);
      await tester.tap(find.byTooltip('Unmute all sounds'));
      await tester.pump();
      expect(app.audio.muted, isFalse);
      expect(app.audio.musicEnabled, isFalse);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    },
  );
  testWidgets(
    'start, single-finger drag/throw, pause/resume and replay remain functional',
    (tester) async {
      final app = await launch(tester, const Size(900, 500));
      await tester.tap(find.byKey(const ValueKey('start-game')));
      await frames(tester, 32);
      expect(app.engine.phase, GamePhase.playing);
      final field = tester.getRect(
        find.byWidgetPredicate(
          (w) => w is CustomPaint && w.painter is GamePainter,
        ),
      );
      Offset screen(Vec p) => Offset(
        field.left + p.x / stageWidth * field.width,
        field.top + p.y / stageHeight * field.height,
      );
      final first = app.engine.reds.first;
      final finger = await tester.startGesture(
        screen(first.position - const Vec(0, 14)),
        pointer: 1,
      );
      await frames(tester, 4);
      expect(app.engine.dragged, same(first));
      final other = app.engine.reds.last;
      final second = await tester.startGesture(
        screen(other.position - const Vec(0, 14)),
        pointer: 2,
      );
      await second.moveBy(const Offset(50, 0));
      await frames(tester, 4);
      expect(app.engine.dragged, same(first));
      await second.up();
      expect(app.engine.dragged, same(first));
      await finger.moveBy(const Offset(-80, 30));
      await frames(tester, 4);
      await finger.up();
      expect(app.engine.dragged, isNull);
      expect(app.engine.balls.any((b) => b.team == Team.red), isTrue);
      await tester.tap(find.byTooltip('Pause game'));
      await tester.pump();
      expect(app.engine.paused, isTrue);
      expect(find.text('Paused'), findsOneWidget);
      await tester.tap(find.text('Resume game'));
      await tester.pump();
      expect(app.engine.paused, isFalse);
      for (final red in app.engine.reds) {
        app.engine.applyHit(red);
        app.engine.applyHit(red);
      }
      await tester.pump();
      expect(find.byKey(const ValueKey('play-again')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('play-again')));
      await tester.pump();
      expect(app.engine.levelIndex, 0);
      expect(app.engine.score, 0);
      expect(app.engine.phase, GamePhase.intro);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    },
  );
  testWidgets(
    'portrait gives a rotate prompt and phone landscape returns to a usable menu',
    (tester) async {
      await launch(tester, const Size(390, 844));
      expect(find.text('Turn to landscape'), findsOneWidget);
      tester.view.physicalSize = const Size(568, 320);
      await tester.pump();
      expect(find.text('Ready. Aim. Snow.'), findsOneWidget);
      expect(tester.takeException(), isNull);
      tester.view.physicalSize = const Size(390, 844);
      await tester.pump();
      expect(find.text('Turn to landscape'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    },
  );
}
