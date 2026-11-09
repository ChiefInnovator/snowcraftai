import 'dart:async';

import 'package:flutter/foundation.dart';

import '../data/game_audio.dart';
import '../domain/game_engine.dart';

class GameController extends ChangeNotifier {
  GameController(this.engine, this.audio) {
    engine.onSound = audio.cue;
  }
  final GameEngine engine;
  final GameAudio audio;
  bool _userPaused = false;
  bool _backgrounded = false;
  bool get userPaused => _userPaused;

  void advance(double seconds) {
    engine.advance(seconds);
    notifyListeners();
  }

  void start() {
    _userPaused = false;
    unawaited(audio.setPaused(false));
    engine.startGame();
    engine.paused = _backgrounded;
    notifyListeners();
  }

  void menu() {
    _userPaused = false;
    unawaited(audio.setPaused(false));
    engine.returnToMenu();
    engine.paused = _backgrounded;
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
    engine.paused = _userPaused || _backgrounded;
    unawaited(audio.setPaused(value));
    notifyListeners();
  }

  void pause() => setUserPaused(!_userPaused);

  void suspend(bool backgrounded) {
    _backgrounded = backgrounded;
    if (backgrounded) engine.cancelDrag();
    engine.paused = _userPaused || _backgrounded;
    unawaited(audio.suspend(backgrounded));
    notifyListeners();
  }

  void setDifficulty(Difficulty value) {
    engine.difficulty = value;
    menu();
  }

  @override
  void dispose() {
    engine.onSound = null;
    super.dispose();
  }
}
