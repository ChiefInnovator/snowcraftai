import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:snowcraft_reforged/data/game_assets.dart';
import 'package:snowcraft_reforged/domain/game_engine.dart';
import 'package:snowcraft_reforged/ui/game_painter.dart';

const _manifestPath = 'assets/hd/characters/manifest.json';

class _OverlayBundle extends CachingAssetBundle {
  _OverlayBundle(this.overrides);
  final Map<String, ByteData?> overrides;

  @override
  Future<ByteData> load(String key) async {
    if (!overrides.containsKey(key)) return rootBundle.load(key);
    final bytes = overrides[key];
    if (bytes == null) throw FlutterError('Missing test asset: $key');
    return bytes;
  }
}

Future<Map<String, dynamic>> _manifest() async =>
    jsonDecode(await rootBundle.loadString(_manifestPath))
        as Map<String, dynamic>;

ByteData _encode(Map<String, dynamic> data) =>
    ByteData.sublistView(Uint8List.fromList(utf8.encode(jsonEncode(data))));

class _RingCanvas implements ui.Canvas {
  final rings = <ui.Rect>[];

  @override
  void drawOval(ui.Rect rect, ui.Paint paint) => rings.add(rect);

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'all 35 HD frames decode at 8x with original logical geometry',
    () async {
      final assets = await GameAssets.load();
      addTearDown(assets.dispose);
      final frames = (await _manifest())['frames'] as List;
      expect(frames.length, 35);
      for (final entry in frames) {
        final frame = assets.frames[entry['key']]!;
        final image = assets.images[frame.key]!;
        expect(image.width, frame.width * 8, reason: frame.key);
        expect(image.height, frame.height * 8, reason: frame.key);
        expect([frame.regX, frame.regY], entry['reg'], reason: frame.key);
      }
      expect(assets.images[assets.ground.key]!.width, assets.ground.width * 4);
    },
  );

  for (final defect in [
    'missing frame',
    'duplicate frame',
    'wrong scale',
    'registration drift',
  ]) {
    test('rejects HD manifest with $defect', () async {
      final manifest = await _manifest();
      final frames = manifest['frames'] as List;
      switch (defect) {
        case 'missing frame':
          frames.removeLast();
        case 'duplicate frame':
          frames[1] = frames[0];
        case 'wrong scale':
          manifest['pixelScale'] = 4;
        case 'registration drift':
          frames[0]['reg'][0] += 1;
      }
      await expectLater(
        GameAssets.load(
          bundle: _OverlayBundle({_manifestPath: _encode(manifest)}),
        ),
        throwsFormatException,
      );
    });
  }

  for (final defect in ['missing image', 'original-sized image']) {
    test('rejects $defect and disposes every partially loaded image', () async {
      final first = ((await _manifest())['frames'] as List).first;
      final created = <ui.Image>[];
      final disposed = <ui.Image>[];
      final oldCreate = ui.Image.onCreate;
      final oldDispose = ui.Image.onDispose;
      ui.Image.onCreate = created.add;
      ui.Image.onDispose = disposed.add;
      addTearDown(() {
        ui.Image.onCreate = oldCreate;
        ui.Image.onDispose = oldDispose;
      });
      final bytes = defect == 'missing image'
          ? null
          : await rootBundle.load('assets/art/${first['file']}');
      await expectLater(
        GameAssets.load(
          bundle: _OverlayBundle({
            'assets/hd/characters/${first['file']}': bytes,
          }),
        ),
        defect == 'missing image' ? throwsFlutterError : throwsFormatException,
      );
      expect(created, isNotEmpty);
      expect(disposed, unorderedEquals(created));
    });
  }

  test(
    'selection ring is drawn once under a charging or throwing red kid',
    () async {
      final assets = await GameAssets.load();
      addTearDown(assets.dispose);
      final engine = GameEngine(assets.levels)..startGame();
      for (var i = 0; i < 150; i++) {
        engine.advance(0.01);
      }
      final red = engine.reds.first;
      expect(engine.grab(red.position - const Vec(0, 14)), isTrue);
      engine.advance(0.05);
      engine.advance(0.05);
      List<ui.Rect> rings() {
        final canvas = _RingCanvas();
        GamePainter(engine, assets).paint(canvas, const ui.Size(592, 320));
        return canvas.rings;
      }

      final expected = ui.Rect.fromCenter(
        center: ui.Offset(red.position.x, red.position.y + 3),
        width: 44,
        height: 18,
      );
      expect(rings(), [expected]);
      engine.release();
      expect(red.pose, KidPose.toss);
      engine.greens.first.pose = KidPose.toss;
      expect(rings(), [expected]);
      engine.phase = GamePhase.menu;
      expect(rings(), isEmpty);
    },
  );
}
