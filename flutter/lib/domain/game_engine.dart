import 'dart:math' as math;

const stageWidth = 592.0;
const stageHeight = 320.0;

enum Team { red, green }

enum GamePhase { menu, intro, playing, cleared, loss, victory }

enum KidPose { ready, walk, windup, cock, toss, hurt, down, dead, cheer }

enum BallPhase { flying, dropping, splat, melting }

enum Difficulty { easy, normal, hard }

class Vec {
  const Vec(this.x, this.y);
  final double x;
  final double y;
  Vec operator +(Vec other) => Vec(x + other.x, y + other.y);
  Vec operator -(Vec other) => Vec(x - other.x, y - other.y);
  Vec operator *(double factor) => Vec(x * factor, y * factor);
  double get length => math.sqrt(x * x + y * y);
  double get lane => y - x / 2;
}

class LevelSeed {
  const LevelSeed(this.reds, this.greens);
  final List<Vec> reds;
  final List<Vec> greens;
  factory LevelSeed.fromJson(Map<String, dynamic> json) {
    List<Vec> positions(String key) => (json[key] as List)
        .map((p) => Vec((p['x'] as num).toDouble(), (p['y'] as num).toDouble()))
        .toList(growable: false);
    return LevelSeed(positions('reds'), positions('greens'));
  }
}

class Kid {
  Kid({
    required this.id,
    required this.team,
    required this.position,
    required this.target,
    required this.maxHits,
  });
  final int id;
  final Team team;
  final int maxHits;
  Vec position;
  Vec target;
  KidPose pose = KidPose.walk;
  int hits = 0;
  double timer = 0;
  double decisionClock = 0;
  double committedThrow = 0;
  bool recovering = false;
  int queuedPower = 5;
  bool get alive => hits < maxHits;
  bool get canGrab => alive && timer <= 0 && team == Team.red;
}

class Snowball {
  Snowball(this.team, this.position, this.power) : remaining = power * 2;
  final Team team;
  final int power;
  Vec position;
  int remaining;
  BallPhase phase = BallPhase.flying;
  int frame = 0;
  Vec get step => team == Team.red ? const Vec(-20, -10) : const Vec(20, 10);
}

/// Native enhanced rules. Rendering and platform/audio access live elsewhere.
class GameEngine {
  GameEngine(this.levels, {int seed = 1}) : _random = math.Random(seed) {
    _populate(0, walkOn: false);
  }
  final List<LevelSeed> levels;
  final math.Random _random;
  void Function(String cue)? onSound;
  final List<Kid> _kids = [];
  final List<Snowball> _balls = [];
  List<Kid> get kids => List.unmodifiable(_kids);
  List<Snowball> get balls => List.unmodifiable(_balls);
  Iterable<Kid> get reds => _kids.where((k) => k.team == Team.red);
  Iterable<Kid> get greens => _kids.where((k) => k.team == Team.green);
  GamePhase phase = GamePhase.menu;
  Difficulty difficulty = Difficulty.normal;
  int levelIndex = 0;
  int score = 0;
  int defeatedThisLevel = 0;
  bool paused = false;
  double elapsed = 0;
  double phaseTime = 0;
  double _ballClock = 0;
  Kid? dragged;
  Vec? dragTarget;
  Vec _grabOffset = const Vec(0, 0);
  double chargeSeconds = 0;
  int get power => (chargeSeconds / (5 / 60)).floor().clamp(0, 8);
  bool get ended => phase == GamePhase.loss || phase == GamePhase.victory;

  static bool onRedSide(Vec p) => p.x >= 2 * (stageHeight - p.y);

  static Vec clampGreen(Vec p) {
    final x = p.x.clamp(20.0, 510.0);
    final bottom = math.max(40.0, stageHeight - x / 2 - 22);
    return Vec(x, p.y.clamp(40.0, math.min(294.0, bottom)));
  }

  static Vec clampRed(Vec p) {
    // Recovered cock/toss frames extend 30 px right / 20 px below the
    // feet; the full power meter extends 36 px right. Keep 4 px clear.
    final y = p.y.clamp(64.0, stageHeight - 20 - 4);
    final left = math.max(18.0, 2 * (stageHeight - y) + 16);
    return Vec(p.x.clamp(left, stageWidth - 36 - 4), y);
  }

  static int aimedPower(Vec from, Vec target) =>
      (((target.x - from.x) / 40) + 0.5).ceil().clamp(2, 8);

  void startGame({Difficulty? difficulty}) {
    if (difficulty != null) this.difficulty = difficulty;
    score = 0;
    paused = false;
    startLevel(0);
    onSound?.call('start');
  }

  void startLevel(int index) {
    if (index < 0 || index >= levels.length) {
      throw RangeError.index(index, levels);
    }
    _populate(index, walkOn: true);
    phase = GamePhase.intro;
    phaseTime = 0;
    defeatedThisLevel = 0;
    _ballClock = 0;
    cancelDrag();
  }

  void _populate(int index, {required bool walkOn}) {
    levelIndex = index;
    _kids.clear();
    _balls.clear();
    final seed = levels[index];
    var id = 0;
    for (final p in seed.reds) {
      final target = clampRed(p);
      _kids.add(
        Kid(
          id: id++,
          team: Team.red,
          position: walkOn ? target + const Vec(110, -100) : target,
          target: target,
          maxHits: 2,
        ),
      );
    }
    for (final p in seed.greens) {
      var target = clampGreen(p);
      for (var tries = 0; tries < 8; tries++) {
        if (!_kids.any(
          (k) => k.team == Team.green && (k.target - target).length < 24,
        )) {
          break;
        }
        target = clampGreen(target + const Vec(-22, 12));
      }
      // The bottom-left corner dead-ends; back up the throw axis from there.
      for (var tries = 0; tries < 12; tries++) {
        if (!_kids.any(
          (k) => k.team == Team.green && (k.target - target).length < 24,
        )) {
          break;
        }
        target = clampGreen(target + const Vec(-22, -11));
      }
      _kids.add(
        Kid(
          id: id++,
          team: Team.green,
          position: walkOn ? target + const Vec(-90, -60) : target,
          target: target,
          maxHits: difficulty == Difficulty.easy
              ? 2
              : difficulty == Difficulty.hard
              ? 4
              : 3,
        ),
      );
    }
    if (!walkOn) {
      for (final kid in _kids) {
        kid.pose = KidPose.ready;
      }
    }
  }

  void returnToMenu() {
    cancelDrag();
    paused = false;
    phase = GamePhase.menu;
    score = 0;
    _populate(0, walkOn: false);
    onSound?.call('stop');
  }

  bool grab(Vec point) {
    if (phase != GamePhase.playing || paused || dragged != null) return false;
    Kid? nearest;
    var distance = 35.0;
    for (final kid in reds.where((k) => k.canGrab)) {
      final d = (kid.position - const Vec(0, 14) - point).length;
      if (d <= distance) {
        nearest = kid;
        distance = d;
      }
    }
    if (nearest == null) return false;
    dragged = nearest;
    _grabOffset = nearest.position - point;
    dragTarget = nearest.position;
    chargeSeconds = 0;
    return true;
  }

  void movePointer(Vec point) {
    if (dragged == null) return;
    dragTarget = clampRed(point + _grabOffset);
  }

  void release() {
    final kid = dragged;
    final throwPower = power;
    cancelDrag();
    if (phase == GamePhase.playing &&
        !paused &&
        kid != null &&
        kid.canGrab &&
        throwPower > 0) {
      throwSnowball(kid, throwPower);
      kid.pose = KidPose.toss;
      kid.timer = 0.25;
    }
  }

  void cancelDrag() {
    final kid = dragged;
    if (kid != null &&
        (kid.pose == KidPose.windup || kid.pose == KidPose.cock)) {
      // A zero-power tap, pause, backgrounding or pointer-cancel must not
      // leave the kid charging forever.
      kid.pose = KidPose.ready;
    }
    dragged = null;
    dragTarget = null;
    chargeSeconds = 0;
  }

  void advance(double seconds) {
    if (paused || seconds <= 0) return;
    // A hidden/resumed app must not teleport actors or simulate an unfair catch-up.
    final dt = math.min(seconds, 0.05);
    elapsed += dt;
    phaseTime += dt;
    if (phase == GamePhase.intro) {
      for (final kid in _kids) {
        kid.position = _toward(kid.position, kid.target, 160 * dt);
      }
      if (phaseTime >= 1.4) {
        for (final kid in _kids) {
          kid.position = kid.target;
          kid.pose = KidPose.ready;
        }
        phase = GamePhase.playing;
        phaseTime = 0;
      }
      return;
    }
    if (phase == GamePhase.cleared) {
      if (phaseTime >= 1.1) startLevel(levelIndex + 1);
      return;
    }
    if (phase != GamePhase.playing) return;

    if (dragged != null) {
      if (!dragged!.alive || !dragged!.canGrab) {
        cancelDrag();
      } else {
        chargeSeconds += dt;
        final speed = 300 - power * 9.0;
        dragged!.position = clampRed(
          _toward(dragged!.position, dragTarget!, speed * dt),
        );
        dragged!.pose = power > 4 ? KidPose.cock : KidPose.windup;
      }
    }
    for (final kid in _kids.where((k) => k.alive)) {
      if (kid == dragged) continue;
      if (kid.committedThrow > 0) {
        kid.committedThrow -= dt;
        if (kid.committedThrow <= 0) {
          throwSnowball(kid, kid.queuedPower);
        }
      }
      if (kid.timer > 0) {
        kid.timer = math.max(0, kid.timer - dt);
        if (kid.timer > 0) continue;
        if (kid.pose == KidPose.down) {
          // Back on their feet and hittable again, but two 0.5 s recovery
          // stages pass before a downed green can act.
          kid.pose = KidPose.hurt;
          kid.timer = 0.5;
          kid.recovering = true;
          continue;
        }
        if (kid.recovering) {
          kid.recovering = false;
          kid.pose = KidPose.ready;
          kid.timer = 0.5;
          continue;
        }
        if (kid.pose == KidPose.windup) {
          kid.pose = KidPose.cock;
          kid.timer = difficulty == Difficulty.hard ? 0.25 : 0.4;
          continue;
        }
        if (kid.pose == KidPose.cock && kid.committedThrow <= 0) {
          throwSnowball(kid, kid.queuedPower);
          kid.pose = KidPose.toss;
          kid.timer = 0.35;
          continue;
        }
        kid.pose = KidPose.ready;
      }
      if (kid.team == Team.green) _think(kid, dt);
    }
    _ballClock += dt;
    while (_ballClock >= 0.05 && phase == GamePhase.playing) {
      _ballClock -= 0.05;
      _advanceBalls();
    }
  }

  void _think(Kid kid, double dt) {
    // Recover any legacy invader position instead of freezing on the centre line.
    kid.position = clampGreen(kid.position);
    Kid? target;
    var best = double.infinity;
    for (final red in reds.where((k) => k.alive)) {
      final dx = red.position.x - kid.position.x;
      if (dx < 8 || dx > 315) continue;
      final error = (red.position.lane - kid.position.lane).abs();
      if (error < best) {
        best = error;
        target = red;
      }
    }
    if (target == null) {
      // A red behind us or beyond maximum range needs an upstream approach,
      // not endless forward walking along the edge of the field.
      Kid? nearest;
      var distance = double.infinity;
      for (final red in reds.where((k) => k.alive)) {
        final candidate = (red.position - kid.position).length;
        if (candidate < distance) {
          nearest = red;
          distance = candidate;
        }
      }
      var moved = false;
      if (nearest != null) {
        final launchPoint = clampGreen(nearest.position - const Vec(120, 60));
        moved = _walkGreen(
          kid,
          _toward(kid.position, launchPoint, 50 * dt),
          dt,
        );
      }
      kid.pose = moved ? KidPose.walk : KidPose.ready;
      return;
    }
    final laneError = target.position.lane - kid.position.lane;
    if (laneError.abs() > 10) {
      final sign = laneError.sign;
      final moved = _walkGreen(
        kid,
        kid.position + Vec(-sign * 25 * dt, sign * 50 * dt),
        dt,
      );
      kid.pose = moved ? KidPose.walk : KidPose.ready;
    } else {
      kid.pose = KidPose.ready;
    }
    kid.decisionClock -= dt;
    if (kid.decisionClock > 0) return;
    kid.decisionClock = 0.2;
    final chance = difficulty == Difficulty.easy
        ? 0.28
        : difficulty == Difficulty.normal
        ? 0.42
        : 0.65;
    final firstStepsInBounds =
        kid.position.x + 20 < stageWidth && kid.position.y + 10 < stageHeight;
    if (laneError.abs() <= 14 &&
        firstStepsInBounds &&
        _liveBalls(Team.green) < 10 &&
        _random.nextDouble() < chance) {
      kid.queuedPower = aimedPower(kid.position, target.position);
      kid.pose = KidPose.windup;
      kid.timer = difficulty == Difficulty.easy
          ? 0.85
          : difficulty == Difficulty.normal
          ? 0.55
          : 0.35;
    }
  }

  /// Splat and melting balls are spent and do not count toward the cap.
  int _liveBalls(Team team) => _balls
      .where(
        (b) =>
            b.team == team &&
            b.phase != BallPhase.splat &&
            b.phase != BallPhase.melting,
      )
      .length;

  bool throwSnowball(Kid kid, int power) {
    if (!kid.alive ||
        phase != GamePhase.playing ||
        _liveBalls(kid.team) >= 10) {
      return false;
    }
    _balls.add(Snowball(kid.team, kid.position, power.clamp(1, 8)));
    onSound?.call('throw');
    return true;
  }

  void _advanceBalls() {
    for (final ball in List<Snowball>.of(_balls)) {
      if (phase != GamePhase.playing) return;
      if (ball.phase == BallPhase.flying) {
        final before = ball.position;
        ball.position = ball.position + ball.step;
        ball.remaining--;
        var hit = false;
        // Hits need range left after the decrement: reach is 2p-1 steps.
        for (final kid in _kids.where(
          (k) => ball.remaining > 0 && k.team != ball.team && k.alive,
        )) {
          if (kid.pose == KidPose.down) continue;
          if (_segmentDistance(kid.position, before, ball.position) < 18) {
            applyHit(kid);
            hit = true;
            break;
          }
        }
        if (hit || ball.remaining <= 0) {
          ball.phase = BallPhase.dropping;
          ball.frame = 0;
        }
      } else if (ball.phase == BallPhase.dropping) {
        ball.position = ball.position + ball.step * 0.5;
        if (++ball.frame >= 4) {
          ball.phase = BallPhase.splat;
          ball.frame = 0;
          onSound?.call('splat');
        }
      } else if (ball.phase == BallPhase.splat) {
        ball.phase = BallPhase.melting;
        ball.frame = 0;
      } else if (++ball.frame >= 4) {
        _balls.remove(ball);
      }
      if (ball.position.x < -80 ||
          ball.position.x > stageWidth + 80 ||
          ball.position.y < -80 ||
          ball.position.y > stageHeight + 80) {
        _balls.remove(ball);
      }
    }
  }

  void applyHit(Kid kid) {
    if (phase != GamePhase.playing || !kid.alive || kid.pose == KidPose.down) {
      return;
    }
    if (dragged == kid) cancelDrag();
    if (kid.pose == KidPose.cock && kid.team == Team.green) {
      kid.committedThrow = math.max(0.01, kid.timer);
    }
    kid.hits++;
    if (!kid.alive) {
      kid.pose = KidPose.dead;
      kid.timer = 0;
      kid.committedThrow = 0;
      if (kid.team == Team.green) defeatedThisLevel++;
      onSound?.call(kid.team == Team.red ? 'red_ko' : 'green_ko');
    } else {
      kid.pose = kid.team == Team.green && kid.hits == kid.maxHits - 1
          ? KidPose.down
          : KidPose.hurt;
      kid.timer = kid.team == Team.red
          ? 4.5
          : kid.pose == KidPose.down
          ? 2.5
          : 1.5;
      onSound?.call('hit');
    }
    if (!reds.any((k) => k.alive)) {
      score = (score + defeatedThisLevel) * (levelIndex + 1);
      _finish(GamePhase.loss, 'loss');
    } else if (!greens.any((k) => k.alive)) {
      score += levels[levelIndex].greens.length;
      if (levelIndex == levels.length - 1) {
        score *= 10;
        if (score > 900) score = 1000;
        _finish(GamePhase.victory, 'victory');
      } else {
        _finish(GamePhase.cleared, 'clear');
      }
    }
  }

  void _finish(GamePhase next, String cue) {
    cancelDrag();
    _balls.clear();
    // Nothing advances poses after the round ends; leave nobody mid-throw
    // or dazed on the end screen.
    for (final kid in _kids.where((k) => k.alive)) {
      kid.pose = KidPose.ready;
      kid.timer = 0;
      kid.committedThrow = 0;
      kid.recovering = false;
    }
    phase = next;
    phaseTime = 0;
    onSound?.call(cue);
  }

  /// Whether standing at [to] would bring [kid] inside another green's space
  /// and closer to it than it is now.
  bool _crowds(Kid kid, Vec to) => _blocker(kid, to) != null;

  Kid? _blocker(Kid kid, Vec to) {
    Kid? nearest;
    var best = 22.0;
    for (final other in _kids) {
      if (other == kid || other.team != Team.green || !other.alive) continue;
      final gap = (to - other.position).length;
      if (gap < best && gap < (kid.position - other.position).length) {
        nearest = other;
        best = gap;
      }
    }
    return nearest;
  }

  /// Greens never walk onto each other. A step that would crowd another green
  /// becomes a sidestep along the throw axis, which keeps the lane (and aim);
  /// if that is crowded or leaves the field, the kid waits. Returns whether
  /// the kid moved.
  bool _walkGreen(Kid kid, Vec to, double dt) {
    final step = clampGreen(to);
    final blocker = _blocker(kid, step);
    if (blocker == null) {
      kid.position = step;
      return true;
    }
    final delta = kid.position - blocker.position;
    final along = 2 * delta.x + delta.y;
    final sign = along != 0 ? along.sign : (kid.id < blocker.id ? -1.0 : 1.0);
    final aside = kid.position + const Vec(2, 1) * (sign * 22 * dt);
    final legal = clampGreen(aside);
    if (legal.x != aside.x || legal.y != aside.y || _crowds(kid, aside)) {
      return false;
    }
    kid.position = aside;
    return true;
  }

  static Vec _toward(Vec from, Vec to, double maximum) {
    final delta = to - from;
    return delta.length <= maximum || delta.length == 0
        ? to
        : from + delta * (maximum / delta.length);
  }

  static double _segmentDistance(Vec p, Vec a, Vec b) {
    final delta = b - a;
    final lengthSquared = delta.x * delta.x + delta.y * delta.y;
    if (lengthSquared == 0) return (p - a).length;
    final ratio =
        (((p.x - a.x) * delta.x + (p.y - a.y) * delta.y) / lengthSquared).clamp(
          0.0,
          1.0,
        );
    return (p - (a + delta * ratio)).length;
  }
}
