import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:snowcraft_reforged/data/game_assets.dart';
import 'package:snowcraft_reforged/data/game_audio.dart';
import 'package:snowcraft_reforged/domain/game_engine.dart';
import 'package:snowcraft_reforged/main.dart';
import 'package:snowcraft_reforged/ui/game_page.dart';
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

class StalledAudio extends WidgetAudio {
  @override
  Future<void> prepare() => Completer<void>().future;
}

Finder fieldPaint() =>
    find.byWidgetPredicate((w) => w is CustomPaint && w.painter is GamePainter);

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

  testWidgets(
    'frames repaint only the playfield layer; the page rebuilds on displayed changes',
    (tester) async {
      final app = await launch(tester, const Size(900, 500));
      final menuPaint = tester.widget(fieldPaint());
      await frames(tester, 5);
      expect(
        tester.widget(fieldPaint()),
        same(menuPaint),
        reason: 'an idle menu neither rebuilds nor repaints',
      );
      await tester.tap(find.byKey(const ValueKey('start-game')));
      // Let the toolbar buttons finish their 200 ms colour transition.
      await frames(tester, 6);
      expect(find.text('Level 1'), findsOneWidget);
      final introPaint = tester.widget(fieldPaint());
      final boundary = tester.renderObject<RenderRepaintBoundary>(
        find
            .ancestor(of: fieldPaint(), matching: find.byType(RepaintBoundary))
            .first,
      );
      boundary.debugResetMetrics();
      final before = app.engine.elapsed;
      await frames(tester, 5);
      expect(app.engine.elapsed, greaterThan(before));
      expect(tester.widget(fieldPaint()), same(introPaint));
      expect(boundary.debugAsymmetricPaintCount, 5);
      expect(boundary.debugSymmetricPaintCount, 0);
      await frames(tester, 21);
      expect(app.engine.phase, GamePhase.playing);
      expect(find.text('Level 1'), findsOneWidget, reason: 'the HUD appeared');
      expect(tester.widget(fieldPaint()), isNot(same(introPaint)));
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    },
  );
  testWidgets(
    'rotating to portrait mid-fight suspends play and keeps a user pause',
    (tester) async {
      final app = await launch(tester, const Size(900, 500));
      await tester.tap(find.byKey(const ValueKey('start-game')));
      await frames(tester, 32);
      expect(app.engine.phase, GamePhase.playing);
      final field = tester.getRect(fieldPaint());
      Offset screen(Vec p) => Offset(
        field.left + p.x / stageWidth * field.width,
        field.top + p.y / stageHeight * field.height,
      );
      final held = app.engine.reds.firstWhere((k) => k.canGrab);
      final finger = await tester.startGesture(
        screen(held.position - const Vec(0, 14)),
        pointer: 1,
      );
      await frames(tester, 2);
      expect(app.engine.dragged, same(held));

      tester.view.physicalSize = const Size(390, 844);
      await tester.pump();
      expect(find.text('Turn to landscape'), findsOneWidget);
      expect(app.engine.paused, isTrue);
      expect(app.engine.dragged, isNull);
      expect(held.pose, isNot(anyOf(KidPose.windup, KidPose.cock)));
      final frozen = app.engine.elapsed;
      await frames(tester, 10);
      expect(app.engine.elapsed, frozen);

      tester.view.physicalSize = const Size(900, 500);
      await tester.pump();
      expect(app.engine.paused, isFalse);
      expect(find.text('Paused'), findsNothing);
      await frames(tester, 2);
      expect(app.engine.elapsed, greaterThan(frozen));
      await finger.up();
      final next = app.engine.reds.firstWhere((k) => k.canGrab);
      final again = await tester.startGesture(
        screen(next.position - const Vec(0, 14)),
        pointer: 2,
      );
      await tester.pump();
      expect(
        app.engine.dragged,
        same(next),
        reason: 'a drag cancelled by the prompt must not block the next grab',
      );
      await again.cancel();

      await tester.tap(find.byTooltip('Pause game'));
      await tester.pump();
      tester.view.physicalSize = const Size(390, 844);
      await tester.pump();
      tester.view.physicalSize = const Size(900, 500);
      await tester.pump();
      expect(app.engine.paused, isTrue);
      expect(find.text('Paused'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    },
  );
  testWidgets('Resume resumes a game that was only suspended', (tester) async {
    final app = await launch(tester, const Size(900, 500));
    await tester.tap(find.byKey(const ValueKey('start-game')));
    await frames(tester, 32);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    await tester.pump();
    expect(app.engine.paused, isTrue);
    expect(find.text('Paused'), findsOneWidget);
    await tester.tap(find.text('Resume game'));
    await tester.pump();
    expect(app.engine.paused, isFalse);
    expect(find.text('Paused'), findsNothing);
    expect(find.byTooltip('Pause game'), findsOneWidget);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    await tester.pump();
    await tester.tap(find.byTooltip('Resume game'));
    await tester.pump();
    expect(app.engine.paused, isFalse);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
  testWidgets(
    'Space activates a focused control and starts the game only when unclaimed',
    (tester) async {
      final app = await launch(tester, const Size(900, 500));
      Focus.of(tester.element(find.byIcon(Icons.volume_up_rounded)))
          .requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pump();
      expect(app.audio.muted, isTrue);
      expect(app.engine.phase, GamePhase.menu);

      Focus.of(
        tester.element(
          find
              .descendant(
                of: find.byType(GamePage),
                matching: find.byType(ListenableBuilder),
              )
              .first,
        ),
      ).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pump();
      expect(app.engine.phase, GamePhase.intro);
      expect(app.audio.muted, isTrue);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    },
  );
  testWidgets('an asset load failure shows an error screen, not a splash', (
    tester,
  ) async {
    final app = await bootstrap(
      () async => throw StateError('missing asset'),
      () => fail('audio must not start without assets'),
    );
    await tester.pumpWidget(app);
    expect(
      find.textContaining('could not load its game files'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
  testWidgets('a stalled audio start does not hold the first frame', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(900, 500);
    tester.view.devicePixelRatio = 1;
    final assets = (await tester.runAsync(GameAssets.load))!;
    final app = await bootstrap(
      () async => assets,
      () => GameAudio(StalledAudio(), WidgetPreferences()),
    );
    await tester.pumpWidget(app);
    await tester.pump();
    expect(find.text('Ready. Aim. Snow.'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('start-game')));
    await frames(tester, 32);
    expect(find.text('Level 1'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}
