import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:snowcraft_reforged/data/game_audio.dart';
import 'package:snowcraft_reforged/domain/game_engine.dart';
import 'package:snowcraft_reforged/ui/game_controller.dart';

class MemoryPreferences implements PreferencePort {
  final values = <String, bool>{};
  @override
  Future<bool?> read(String key) async => values[key];
  @override
  Future<void> write(String key, bool value) async {
    values[key] = value;
  }
}

class RecordingAudio implements AudioPort {
  final calls = <String>[];
  @override
  Future<void> prepare() async {
    calls.add('prepare');
  }

  @override
  Future<void> music(bool playing) async {
    calls.add('music:$playing');
  }

  @override
  Future<void> intro() async {
    calls.add('intro');
  }

  @override
  Future<void> effect(String file) async {
    calls.add('effect:$file');
  }

  @override
  Future<void> stopEffects() async {
    calls.add('stopEffects');
  }

  @override
  Future<void> close() async {
    calls.add('close');
  }
}

class DelayedStopAudio extends RecordingAudio {
  final gate = Completer<void>();
  @override
  Future<void> stopEffects() async {
    calls.add('stopEffects');
    await gate.future;
  }
}

class DelayedEffectAudio extends RecordingAudio {
  final gate = Completer<void>();
  @override
  Future<void> effect(String file) async {
    await gate.future;
    calls.add('effect:$file');
  }
}

class DelayedIntroAudio extends RecordingAudio {
  final gate = Completer<void>();
  @override
  Future<void> intro() async {
    await gate.future;
    calls.add('intro');
  }
}

class DelayedPreferences extends MemoryPreferences {
  final gate = Completer<void>();
  int entered = 0;
  @override
  Future<void> write(String key, bool value) async {
    if (entered++ == 0) await gate.future;
    values[key] = value;
  }
}

GameEngine fixtureEngine() => GameEngine([
  LevelSeed(
    [const Vec(508, 192), const Vec(377, 268), const Vec(484, 282)],
    [const Vec(176, 49)],
  ),
]);

void main() {
  for (final action in ['mute', 'pause', 'background']) {
    test(
      '$action completion stops an in-flight intro start without late playback',
      () async {
        final port = DelayedIntroAudio();
        final audio = GameAudio(port, MemoryPreferences());
        await audio.initialize();
        audio.cue('start');
        await Future<void>.delayed(Duration.zero);
        final stopping = switch (action) {
          'mute' => audio.setMuted(true),
          'pause' => audio.setPaused(true),
          _ => audio.suspend(true),
        };
        await Future<void>.delayed(Duration.zero);
        port.gate.complete();
        await stopping;
        final intro = port.calls.indexOf('intro');
        expect(intro, greaterThanOrEqualTo(0));
        expect(port.calls.indexOf('stopEffects'), greaterThan(intro));
        final count = port.calls.where((c) => c.startsWith('effect:')).length;
        audio.cue('hit');
        await Future<void>.delayed(Duration.zero);
        expect(port.calls.where((c) => c.startsWith('effect:')).length, count);
        await audio.close();
      },
    );
  }

  test('mute completes after an in-flight effect start is stopped, without late playback', () async {
    final port = DelayedEffectAudio();
    final audio = GameAudio(port, MemoryPreferences());
    await audio.initialize();
    audio.cue('start');
    await Future<void>.delayed(Duration.zero);
    audio.cue('hit');
    await Future<void>.delayed(Duration.zero);
    final mute = audio.setMuted(true);
    await Future<void>.delayed(Duration.zero);
    port.gate.complete();
    await mute;
    final effect = port.calls.indexOf('effect:11_hit1.wav');
    expect(effect, greaterThanOrEqualTo(0));
    expect(port.calls.indexOf('stopEffects'), greaterThan(effect));
    final count = port.calls.where((c) => c.startsWith('effect:')).length;
    audio.cue('throw');
    await Future<void>.delayed(Duration.zero);
    expect(port.calls.where((c) => c.startsWith('effect:')).length, count);
    await audio.close();
  });

  test('overlapping mute setters persist latest intent even when old stopEffects finishes last', () async {
    final port = DelayedStopAudio();
    final prefs = MemoryPreferences();
    final audio = GameAudio(port, prefs);
    await audio.initialize();
    final older = audio.setMuted(true);
    final newer = audio.setMuted(false);
    await newer;
    expect(audio.muted, isFalse);
    expect(prefs.values['mute-all'], isFalse);
    port.gate.complete();
    await older;
    expect(prefs.values['mute-all'], isFalse);
    final restored = GameAudio(RecordingAudio(), prefs);
    await restored.initialize();
    expect(restored.muted, isFalse);
    await restored.close();
    await audio.close();
  });

  test('delayed overlapping music and mute writes retain both latest independent preferences', () async {
    final prefs = DelayedPreferences();
    final audio = GameAudio(RecordingAudio(), prefs);
    await audio.initialize();
    final operations = [
      audio.setMusicEnabled(false),
      audio.setMuted(true),
      audio.setMusicEnabled(true),
      audio.setMuted(false),
    ];
    await Future<void>.delayed(Duration.zero);
    expect(
      prefs.entered,
      1,
      reason: 'preference writes must serialize at invocation order',
    );
    prefs.gate.complete();
    await Future.wait(operations);
    expect(prefs.values, {'music-enabled': true, 'mute-all': false});
    final restored = GameAudio(RecordingAudio(), prefs);
    await restored.initialize();
    expect(restored.musicEnabled, audio.musicEnabled);
    expect(restored.muted, audio.muted);
    await restored.close();
    await audio.close();
  });

  for (final music in [true, false]) {
    test(
      'pause → menu → start clears UI suspension with music $music',
      () async {
        final port = RecordingAudio();
        final audio = GameAudio(port, MemoryPreferences());
        await audio.initialize();
        await audio.setMusicEnabled(music);
        final controller = GameController(fixtureEngine(), audio);
        controller.start();
        await Future<void>.delayed(Duration.zero);
        controller.pause();
        await Future<void>.delayed(Duration.zero);
        expect(controller.engine.paused, isTrue);
        controller.menu();
        controller.start();
        await Future<void>.delayed(Duration.zero);
        expect(controller.engine.paused, isFalse);
        expect(audio.musicEnabled, music);
        expect(
          port.calls.where((c) => c.startsWith('music:')).last,
          'music:$music',
        );
        final count = port.calls.where((c) => c.startsWith('effect:')).length;
        audio.cue('hit');
        await Future<void>.delayed(Duration.zero);
        expect(
          port.calls.where((c) => c.startsWith('effect:')).length,
          count + 1,
        );
        expect(port.calls.where((c) => c == 'intro').length, 2);
        controller.dispose();
        await audio.close();
      },
    );
  }

  test(
    'new game clears UI pause without clearing actual background suspension',
    () async {
      final port = RecordingAudio();
      final audio = GameAudio(port, MemoryPreferences());
      await audio.initialize();
      final controller = GameController(fixtureEngine(), audio);
      controller.start();
      controller.pause();
      controller.suspend(true);
      controller.menu();
      controller.start();
      await Future<void>.delayed(Duration.zero);
      expect(controller.engine.paused, isTrue);
      expect(
        port.calls.where((c) => c.startsWith('music:')).last,
        'music:false',
      );
      final count = port.calls.where((c) => c.startsWith('effect:')).length;
      audio.cue('hit');
      await Future<void>.delayed(Duration.zero);
      expect(port.calls.where((c) => c.startsWith('effect:')).length, count);
      controller.suspend(false);
      await Future<void>.delayed(Duration.zero);
      expect(controller.engine.paused, isFalse);
      expect(
        port.calls.where((c) => c.startsWith('music:')).last,
        'music:true',
      );
      controller.dispose();
      await audio.close();
    },
  );

  test('music-off preserves effects and mute-all overrides both without losing music preference', () async {
    final port = RecordingAudio();
    final prefs = MemoryPreferences();
    final audio = GameAudio(port, prefs);
    await audio.initialize();
    audio.cue('start');
    await Future<void>.delayed(Duration.zero);
    expect(port.calls, contains('music:true'));
    await audio.setMusicEnabled(false);
    audio.cue('hit');
    await Future<void>.delayed(Duration.zero);
    expect(port.calls, contains('effect:11_hit1.wav'));
    expect(port.calls.last, 'effect:11_hit1.wav');
    await audio.setMuted(true);
    final effectCount = port.calls.where((c) => c.startsWith('effect:')).length;
    audio.cue('throw');
    await Future<void>.delayed(Duration.zero);
    expect(
      port.calls.where((c) => c.startsWith('effect:')).length,
      effectCount,
    );
    await audio.setMuted(false);
    expect(audio.musicEnabled, isFalse);
    expect(port.calls.last, 'music:false');
    await audio.setMuted(true);
    await audio.setMusicEnabled(true);
    expect(port.calls.last, 'music:false');
    await audio.setMuted(false);
    expect(port.calls.last, 'music:true');
    await audio.close();
  });
  test('preferences survive a new service and lifecycle suspension silences the game', () async {
    final prefs = MemoryPreferences();
    final first = GameAudio(RecordingAudio(), prefs);
    await first.initialize();
    await first.setMuted(true);
    await first.setMusicEnabled(false);
    await first.close();
    final port = RecordingAudio();
    final next = GameAudio(port, prefs);
    await next.initialize();
    expect(next.muted, isTrue);
    expect(next.musicEnabled, isFalse);
    await next.setMuted(false);
    await next.setMusicEnabled(true);
    next.cue('start');
    await Future<void>.delayed(Duration.zero);
    await next.suspend(true);
    expect(port.calls.last, 'music:false');
    final count = port.calls.length;
    next.cue('hit');
    await Future<void>.delayed(Duration.zero);
    expect(port.calls.length, count);
    await next.suspend(false);
    expect(port.calls.last, 'music:true');
    await next.close();
  });
}
