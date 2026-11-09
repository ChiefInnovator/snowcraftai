import 'package:flutter/material.dart';

import '../data/game_assets.dart';
import '../domain/game_engine.dart';

class GamePainter extends CustomPainter {
  GamePainter(this.engine, this.assets);
  final GameEngine engine;
  final GameAssets assets;
  final _paint = Paint()..filterQuality = FilterQuality.high;

  void _sprite(
    Canvas canvas,
    ArtFrame frame,
    Vec position, {
    double opacity = 1,
  }) {
    final image = assets.images[frame.key];
    if (image == null) return;
    _paint.color = Colors.white.withValues(alpha: opacity);
    canvas.drawImageRect(
      image,
      Rect.fromLTWH(0, 0, image.width.toDouble(), image.height.toDouble()),
      Rect.fromLTWH(
        position.x - frame.regX,
        position.y - frame.regY,
        frame.width,
        frame.height,
      ),
      _paint,
    );
  }

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / stageWidth, size.height / stageHeight);
    canvas.clipRect(const Rect.fromLTWH(0, 0, stageWidth, stageHeight));
    canvas.drawColor(Colors.white, BlendMode.srcOver);
    _sprite(canvas, assets.ground, const Vec(296, 160));
    final sorted = List<Kid>.of(engine.kids)
      ..sort((a, b) => a.position.y.compareTo(b.position.y));
    final shadow = assets.named('shadow');
    for (final kid in sorted) {
      _sprite(canvas, shadow, kid.position, opacity: kid.alive ? 0.6 : 0.3);
    }
    for (final kid in sorted.where((k) => k != engine.dragged)) {
      _sprite(
        canvas,
        assets.kidFrame(
          kid,
          engine.elapsed,
          celebrate: engine.phase == GamePhase.loss,
        ),
        kid.position,
        opacity: kid.alive ? 1 : 0.72,
      );
    }
    for (final ball in engine.balls) {
      _sprite(canvas, assets.ballFrame(ball), ball.position);
    }
    final held = engine.dragged;
    if (held != null) {
      canvas.drawOval(
        Rect.fromCenter(
          center: Offset(held.position.x, held.position.y - 2),
          width: 44,
          height: 20,
        ),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2
          ..color = const Color(0xff13749c),
      );
      _sprite(canvas, assets.kidFrame(held, engine.elapsed), held.position);
      _sprite(canvas, assets.powers[engine.power], held.position);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant GamePainter oldDelegate) => true;
}
