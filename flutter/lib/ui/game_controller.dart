import 'dart:async';

import 'package:flutter/foundation.dart';

import '../data/game_audio.dart';
import '../domain/game_engine.dart';

class GameController extends ChangeNotifier {
  GameController(this.engine, this.audio) {
    engine.onSound = audio.cue;
    _shown = _chrome();
  }
  final GameEngine engine;
  final GameAudio audio;

  /// Ticks once per simulated frame; only the playfield painter listens.
  /// Listeners of the controller itself hear about state the page chrome
  /// displays, not about every frame.
  final ValueNotifier<int> frame = ValueNotifier(0);
  bool _userPaused = false;
  bool _backgrounded = false;
  bool _obscured = false; // rotate prompt covers the field
  late Object _shown;
  bool get userPaused => _userPaused;

  /// Everything the widgets around the playfield read from the engine.
  Object _chrome() => (
    engine.phase,
    engine.paused,
    engine.levelIndex,
    engine.difficulty,
    engine.score,
    engine.greens.where((k) => k.alive).length,
    engine.reds.fold(0, (mask, k) => mask * 2 + (k.alive ? 1 : 0)),
  );

  @override
  void notifyListeners() {
    _shown = _chrome();
    super.notifyListeners();
  }

  void advance(double seconds) {
    engine.advance(seconds);
    // The menu, a pause and the victory screen are still pictures.
    if (!engine.paused &&
        engine.phase != GamePhase.menu &&
        engine.phase != GamePhase.victory) {
      frame.value++;
    }
    if (_chrome() != _shown) notifyListeners();
  }

  void start() {
    _userPaused = false;
    unawaited(audio.setPaused(false));
    engine.startGame();
    engine.paused = _backgrounded || _obscured;
    notifyListeners();
  }

  void menu() {
    _userPaused = false;
    unawaited(audio.setPaused(false));
    engine.returnToMenu();
    engine.paused = _backgrounded || _obscured;
    notifyListeners();
  }

  void grab(Vec point) {
    engine.grab(point);
    notifyListeners();
  }

  void move(Vec point) => engine.movePointer(point);
  void release() {
    engine.release();
    notifyListeners();
  }

  void cancel() {
    engine.cancelDrag();
    notifyListeners();
  }

  void setUserPaused(bool value) {
    engine.cancelDrag();
    _userPaused = value;
    engine.paused = _userPaused || _backgrounded || _obscured;
    unawaited(audio.setPaused(value));
    notifyListeners();
  }

  /// Pause toggle. Whatever paused the game, the control that says "Resume"
  /// resumes rather than adding a user pause on top of a suspension.
  void pause() => engine.paused ? resume() : setUserPaused(true);

  void resume() {
    _backgrounded = false;
    _applySuspension();
    setUserPaused(false);
  }

  void suspend(bool backgrounded) {
    _backgrounded = backgrounded;
    _applySuspension();
    notifyListeners();
  }

  /// Suspends play while the rotate prompt replaces the field, independently
  /// of a user pause. Called while the page is being laid out, so it does not
  /// notify.
  void obscure(bool value) {
    if (_obscured == value) return;
    _obscured = value;
    _applySuspension();
    _shown = _chrome();
  }

  void _applySuspension() {
    final hidden = _backgrounded || _obscured;
    if (hidden) engine.cancelDrag();
    engine.paused = _userPaused || hidden;
    unawaited(audio.suspend(hidden));
  }

  void setDifficulty(Difficulty value) {
    engine.difficulty = value;
    menu();
  }

  @override
  void dispose() {
    engine.onSound = null;
    frame.dispose();
    super.dispose();
  }
}
