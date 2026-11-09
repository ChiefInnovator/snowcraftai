import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:snowcraft_reforged/domain/game_engine.dart';

List<LevelSeed> recoveredLevels() =>
    ((jsonDecode(File('assets/data/game.json').readAsStringSync())
                as Map)['levels']
            as List)
        .map((j) => LevelSeed.fromJson(j))
        .toList();

void tick(GameEngine engine, double seconds) {
  for (var t = 0.0; t < seconds; t += 0.01) {
    engine.advance(0.01);
  }
}

void main() {
  test('all ten recovered waves enter reachable legal positions', () {
    final engine = GameEngine(recoveredLevels());
    expect(engine.levels.map((l) => l.greens.length), [
      3,
      5,
      7,
      9,
      12,
      12,
      12,
      12,
      12,
      12,
    ]);
    for (var level = 0; level < 10; level++) {
      engine.startLevel(level);
      tick(engine, 1.5);
      expect(engine.phase, GamePhase.playing);
      expect(engine.reds.length, 3);
      for (final kid in engine.greens) {
        expect(
          GameEngine.onRedSide(kid.position),
          isFalse,
          reason: 'level ${level + 1}, kid ${kid.id}',
        );
        expect(kid.position.x, inInclusiveRange(20, 510));
        expect(kid.position.y, inInclusiveRange(40, 294));
      }
      for (final kid in engine.reds) {
        expect(GameEngine.onRedSide(kid.position), isTrue);
      }
    }
  });

  test(
    'drag follows at a bounded speed and full power fires from actual position',
    () {
      final engine = GameEngine(recoveredLevels())..startGame();
      tick(engine, 1.5);
      final kid = engine.reds.first;
      final before = kid.position;
      expect(engine.grab(kid.position - const Vec(0, 14)), isTrue);
      engine.movePointer(const Vec(50, 300));
      engine.advance(0.016);
      expect((kid.position - before).length, lessThanOrEqualTo(4.8));
      expect(GameEngine.onRedSide(kid.position), isTrue);
      tick(engine, 0.75);
      expect(engine.power, 8);
      final origin = kid.position;
      engine.release();
      expect(engine.dragged, isNull);
      final ball = engine.balls.where((b) => b.team == Team.red).single;
      expect(ball.power, 8);
      expect(ball.position.x, origin.x);
      expect(ball.position.y, origin.y);
    },
  );

  test('fixed-diagonal snowballs hit opponents along their lane and use damage states', () {
    final level = LevelSeed(
      [const Vec(300, 200), const Vec(450, 250), const Vec(520, 280)],
      [const Vec(100, 100)],
    );
    final engine = GameEngine([level])..startGame();
    tick(engine, 1.5);
    final red = engine.reds.first;
    final green = engine.greens.single;
    green.decisionClock = 100;
    expect(engine.throwSnowball(red, 6), isTrue);
    tick(engine, 0.55);
    expect(green.hits, 1);
    expect(green.pose, KidPose.hurt);
    expect(
      engine.balls.where((b) => b.team == Team.red).single.phase,
      BallPhase.dropping,
    );
    tick(engine, 0.6);
    expect(engine.balls.where((b) => b.team == Team.red), isEmpty);
    expect(engine.throwSnowball(green, 6), isTrue);
    tick(engine, 0.55);
    expect(red.hits, 1);
    expect(red.canGrab, isFalse);
    expect(engine.grab(red.position - const Vec(0, 14)), isFalse);
  });

  test(
    'charged power meter and active red poses stay visible at every legal edge',
    () {
      final json =
          jsonDecode(File('assets/data/game.json').readAsStringSync()) as Map;
      final frames = [
        ...(json['kids'] as List).where(
          (frame) =>
              (frame['name'] as String).startsWith('R ') &&
              frame['name'] != 'R dead',
        ),
        ...(json['power'] as List),
      ];
      void visible(Vec feet) {
        for (final frame in frames) {
          final left = feet.x - (frame['reg'][0] as num);
          final top = feet.y - (frame['reg'][1] as num);
          expect(left, greaterThanOrEqualTo(0), reason: frame['key']);
          expect(top, greaterThanOrEqualTo(0), reason: frame['key']);
          expect(
            left + (frame['w'] as num),
            lessThanOrEqualTo(stageWidth),
            reason: frame['key'],
          );
          expect(
            top + (frame['h'] as num),
            lessThanOrEqualTo(stageHeight),
            reason: frame['key'],
          );
        }
      }

      for (final point in [
        const Vec(0, 0),
        const Vec(592, 0),
        const Vec(0, 320),
        const Vec(592, 320),
      ]) {
        visible(GameEngine.clampRed(point));
      }
      final engine = GameEngine(recoveredLevels())..startGame();
      tick(engine, 1.5);
      final held = engine.reds.first
        ..position = GameEngine.clampRed(const Vec(592, 320));
      expect(engine.grab(held.position - const Vec(0, 14)), isTrue);
      engine.movePointer(const Vec(1000, 1000));
      tick(engine, 0.75);
      expect(engine.power, 8);
      visible(held.position);
      engine.release();
      expect(held.pose, KidPose.toss);
      visible(held.position);
    },
  );

  test('pause prevents charging, motion and projectiles from advancing', () {
    final engine = GameEngine(recoveredLevels())..startGame();
    tick(engine, 1.5);
    final kid = engine.reds.first;
    engine.grab(kid.position - const Vec(0, 14));
    final before = kid.position;
    engine.paused = true;
    engine.movePointer(const Vec(100, 300));
    tick(engine, 1);
    expect(engine.power, 0);
    expect(kid.position.x, before.x);
    engine.release();
    expect(engine.balls.where((b) => b.team == Team.red), isEmpty);
  });

  test('lane seeking reduces aim error and recovers an invader instead of freezing', () {
    final level = LevelSeed(
      [const Vec(320, 240), const Vec(500, 280), const Vec(550, 260)],
      [const Vec(80, 80)],
    );
    final engine = GameEngine([level])..startGame();
    tick(engine, 1.5);
    final green = engine.greens.single;
    final before = (engine.reds.first.position.lane - green.position.lane)
        .abs();
    tick(engine, 0.4);
    expect(
      (engine.reds.first.position.lane - green.position.lane).abs(),
      lessThan(before),
    );
    green.position = const Vec(490, 295);
    green.timer = 0;
    engine.advance(0.01);
    expect(GameEngine.onRedSide(green.position), isFalse);
    expect(green.position.y, lessThan(80));
  });

  test(
    'lane seeking can threaten red positions at every usable field corner',
    () {
      for (final point in [
        const Vec(0, 0),
        const Vec(592, 0),
        const Vec(0, 320),
        const Vec(592, 320),
      ]) {
        final red = GameEngine.clampRed(point);
        final level = LevelSeed([red], [const Vec(176, 49)]);
        final engine = GameEngine([level], seed: 3)
          ..startGame(difficulty: Difficulty.hard);
        var throws = 0;
        engine.onSound = (cue) {
          if (cue == 'throw') throws++;
        };
        tick(engine, 20);
        expect(
          throws,
          greaterThan(0),
          reason: 'AI must not freeze or waste all shots at ${red.x},${red.y}',
        );
      }
    },
  );

  test(
    'aimed power covers a reachable target and stays within available charge',
    () {
      expect(GameEngine.aimedPower(const Vec(100, 50), const Vec(300, 150)), 6);
      expect(GameEngine.aimedPower(const Vec(100, 50), const Vec(700, 350)), 8);
      expect(GameEngine.aimedPower(const Vec(100, 50), const Vec(110, 55)), 2);
      final power = GameEngine.aimedPower(
        const Vec(100, 50),
        const Vec(300, 150),
      );
      expect((2 * power - 1) * 20, greaterThanOrEqualTo(200));
    },
  );

  test('a cocked nonlethal green throw can trade a hit instead of always cancelling', () {
    final engine = GameEngine(recoveredLevels())..startGame();
    tick(engine, 1.5);
    final green = engine.greens.first;
    green.pose = KidPose.cock;
    green.timer = 0.2;
    green.queuedPower = 7;
    engine.applyHit(green);
    expect(green.pose, KidPose.hurt);
    tick(engine, 0.22);
    expect(
      engine.balls.any((b) => b.team == Team.green && b.power == 7),
      isTrue,
    );
  });

  test('a loss clears in-flight hits and cannot turn into a victory', () {
    final engine = GameEngine(recoveredLevels())..startGame();
    tick(engine, 1.5);
    engine.throwSnowball(engine.reds.first, 8);
    for (final red in engine.reds) {
      engine.applyHit(red);
      engine.applyHit(red);
    }
    expect(engine.phase, GamePhase.loss);
    expect(engine.balls, isEmpty);
    final green = engine.greens.first;
    final hits = green.hits;
    engine.applyHit(green);
    expect(green.hits, hits);
    expect(engine.throwSnowball(green, 8), isFalse);
    tick(engine, 10);
    expect(engine.phase, GamePhase.loss);
    engine.startGame();
    expect(engine.levelIndex, 0);
    expect(engine.score, 0);
    expect(engine.reds.every((k) => k.hits == 0), isTrue);
  });

  test('all waves progress to victory and replay resets the match', () {
    final fixture = LevelSeed(
      [const Vec(508, 192), const Vec(377, 268), const Vec(484, 282)],
      [const Vec(20, 40)],
    );
    final engine = GameEngine(List.filled(10, fixture))..startGame();
    for (var level = 0; level < 10; level++) {
      tick(engine, 1.5);
      expect(engine.levelIndex, level);
      final green = engine.greens.single;
      engine.applyHit(green);
      tick(engine, 1.6);
      engine.applyHit(green);
      expect(green.pose, KidPose.down);
      final hits = green.hits;
      engine.applyHit(green);
      expect(green.hits, hits, reason: 'downed greens are temporarily immune');
      tick(engine, 2.6);
      engine.applyHit(green);
      expect(engine.phase, level == 9 ? GamePhase.victory : GamePhase.cleared);
      if (level < 9) tick(engine, 1.15);
    }
    expect(engine.score, 100);
    engine.startGame();
    expect(engine.phase, GamePhase.intro);
    expect(engine.score, 0);
    expect(engine.levelIndex, 0);
  });
}
