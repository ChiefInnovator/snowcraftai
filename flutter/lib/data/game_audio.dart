import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

abstract interface class AudioPort {
  Future<void> prepare();
  Future<void> music(bool playing);
  Future<void> intro();
  Future<void> effect(String file);
  Future<void> stopEffects();
  Future<void> close();
}

abstract interface class PreferencePort {
  Future<bool?> read(String key);
  Future<void> write(String key, bool value);
}

class LocalPreferences implements PreferencePort {
  final _preferences = SharedPreferencesAsync();
  @override
  Future<bool?> read(String key) => _preferences.getBool(key);
  @override
  Future<void> write(String key, bool value) =>
      _preferences.setBool(key, value);
}

class NativeAudioPort implements AudioPort {
  final _music = AudioPlayer();
  final _intro = AudioPlayer();
  final _effects = List.generate(4, (_) => AudioPlayer());
  var _next = 0;
  bool _musicPrepared = false;

  // By default every Android player requests exclusive audio focus when it
  // starts, which pauses the others: the first effect would pause the music.
  // Only the music player keeps focus; the intro and effect voices request
  // none and mix over it. iOS and the web already mix one app's players (and
  // iOS applies a per-player context to the whole session), so they keep the
  // package defaults.
  static final _mixOverMusic = AudioContext(
    android: const AudioContextAndroid(audioFocus: AndroidAudioFocus.none),
  );

  @override
  Future<void> prepare() async {
    // Voices first: a music source that fails to load must not leave the
    // intro and effects unconfigured.
    final mix = !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
    if (mix) await _intro.setAudioContext(_mixOverMusic);
    await _intro.setReleaseMode(ReleaseMode.stop);
    await _intro.setVolume(0.55);
    for (final player in _effects) {
      if (mix) await player.setAudioContext(_mixOverMusic);
      await player.setReleaseMode(ReleaseMode.stop);
      await player.setVolume(0.72);
    }
    await _music.setReleaseMode(ReleaseMode.loop);
    await _music.setVolume(0.28);
    await _music.setSource(AssetSource('audio/musicAlt.mp3'));
    _musicPrepared = true;
  }

  @override
  Future<void> music(bool playing) async {
    if (!_musicPrepared) return;
    if (playing) {
      await _music.resume();
    } else {
      await _music.pause();
    }
  }

  @override
  Future<void> intro() => _intro.play(AssetSource('audio/intro.mp3'));
  @override
  Future<void> effect(String file) async {
    final player = _effects[_next++ % _effects.length];
    await player.stop();
    await player.play(AssetSource('audio/$file'));
  }

  @override
  Future<void> stopEffects() async {
    await Future.wait([_intro.stop(), ..._effects.map((p) => p.stop())]);
  }

  @override
  Future<void> close() async {
    await Future.wait([
      _music.dispose(),
      _intro.dispose(),
      ..._effects.map((p) => p.dispose()),
    ]);
  }
}

class GameAudio extends ChangeNotifier {
  GameAudio(this.port, this.preferences);
  final AudioPort port;
  final PreferencePort preferences;
  bool muted = false;
  bool musicEnabled = true;
  bool _active = false;
  bool _suspended = false; // actual app background / lifecycle
  bool _paused = false; // in-game pause / settings only
  bool _closed = false;
  bool _muteChosen = false;
  bool _musicChosen = false;
  int _cueSequence = 0;
  Future<void> _musicQueue = Future.value();
  Future<void> _preferenceQueue = Future.value();
  Future<void> _effectQueue = Future.value();
  int _effectGeneration = 0;
  String? lastError;

  /// Restores saved preferences, then prepares playback. Each step fails on
  /// its own: an unreadable preference keeps its default and never stops the
  /// players from being prepared. Safe to run unawaited behind the first frame.
  Future<void> initialize() async {
    final savedMute = await _saved('mute-all');
    final savedMusic = await _saved('music-enabled');
    if (_closed) return;
    // A choice made while the reads were pending wins over the saved one.
    if (!_muteChosen) muted = savedMute ?? muted;
    if (!_musicChosen) musicEnabled = savedMusic ?? musicEnabled;
    notifyListeners();
    await _safely(port.prepare);
    // A game may have started before the players were ready.
    await _syncMusic();
  }

  Future<bool?> _saved(String key) async {
    try {
      return await preferences.read(key);
    } catch (error) {
      lastError = '$error';
      return null;
    }
  }

  Future<void> _safely(Future<void> Function() operation) async {
    if (_closed) return;
    try {
      await operation();
    } catch (error) {
      lastError = '$error';
    }
  }

  Future<void> _syncMusic() {
    _musicQueue = _musicQueue.then(
      (_) => _safely(
        () => port.music(
          _active && !_suspended && !_paused && !muted && musicEnabled,
        ),
      ),
    );
    return _musicQueue;
  }

  /// Starts are serialised. When a slow start lets cues pile up, a
  /// [droppable] cue that more than two newer cues are already waiting behind
  /// is stale and is skipped, so the backlog stays short and a round-end cue
  /// is not played late. Cues that are not droppable always play.
  void _queueCue(Future<void> Function() operation, {bool droppable = false}) {
    final generation = _effectGeneration;
    final sequence = ++_cueSequence;
    _effectQueue = _effectQueue.then((_) async {
      if (generation != _effectGeneration ||
          !_active ||
          muted ||
          _suspended ||
          _paused ||
          (droppable && _cueSequence - sequence > 2)) {
        return;
      }
      await _safely(operation);
    });
  }

  Future<void> _stopEffects() {
    _effectQueue = _effectQueue.then((_) => _safely(port.stopEffects));
    return _effectQueue;
  }

  Future<void> _persist(String key, bool value) {
    // Enqueue at setter entry, before any audio await: late completions of an
    // older request must never overwrite the user's latest preference.
    _preferenceQueue = _preferenceQueue.then(
      (_) => _safely(() => preferences.write(key, value)),
    );
    return _preferenceQueue;
  }

  Future<void> setMuted(bool value) async {
    muted = value;
    _muteChosen = true;
    if (value) _effectGeneration++;
    final saved = _persist('mute-all', value);
    notifyListeners();
    await Future.wait([if (value) _stopEffects(), _syncMusic(), saved]);
  }

  Future<void> setMusicEnabled(bool value) async {
    musicEnabled = value;
    _musicChosen = true;
    final saved = _persist('music-enabled', value);
    notifyListeners();
    await Future.wait([_syncMusic(), saved]);
  }

  Future<void> setPaused(bool value) async {
    _paused = value;
    if (value) _effectGeneration++;
    await Future.wait([if (value) _stopEffects(), _syncMusic()]);
  }

  Future<void> suspend(bool value) async {
    _suspended = value;
    if (value) _effectGeneration++;
    await Future.wait([if (value) _stopEffects(), _syncMusic()]);
  }

  void cue(String cue) {
    if (cue == 'start') {
      _effectGeneration++;
      _active = true;
      unawaited(_syncMusic());
      if (!muted && !_suspended && !_paused) {
        _queueCue(port.intro);
      }
      return;
    }
    if (cue == 'stop') {
      _effectGeneration++;
      _active = false;
      unawaited(_syncMusic());
      unawaited(_stopEffects());
      return;
    }
    if (muted || _suspended || _paused) return;
    final file = switch (cue) {
      'throw' => '06_Whoosh.wav',
      'splat' => '14_splat.wav',
      'hit' => '11_hit1.wav',
      'red_ko' => '03_Ahhhh.wav',
      'green_ko' => '09_kids2.wav',
      'clear' => '04_ugly.wav',
      'loss' => '02_laugh.wav',
      'victory' => '16_halaluja.wav',
      _ => null,
    };
    if (file != null) {
      _queueCue(
        () => port.effect(file),
        droppable: cue == 'throw' || cue == 'splat',
      );
    }
  }

  Future<void> close() async {
    await Future.wait([_musicQueue, _preferenceQueue, _effectQueue]);
    await _safely(port.close);
    _closed = true;
    super.dispose();
  }
}
