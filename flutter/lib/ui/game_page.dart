import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';

import '../data/game_assets.dart';
import '../data/game_audio.dart';
import '../domain/game_engine.dart';
import 'game_controller.dart';
import 'game_painter.dart';

extension DifficultyLabel on Difficulty {
  String get label => switch (this) {
    Difficulty.easy => 'Easy',
    Difficulty.normal => 'Normal',
    Difficulty.hard => 'Hard',
  };
}

class GamePage extends StatefulWidget {
  const GamePage({
    super.key,
    required this.assets,
    required this.engine,
    required this.audio,
  });
  final GameAssets assets;
  final GameEngine engine;
  final GameAudio audio;
  @override
  State<GamePage> createState() => _GamePageState();
}

class _GamePageState extends State<GamePage>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final GameController _controller;
  late final Listenable _updates;
  late final Ticker _ticker;
  Duration _previous = Duration.zero;
  int? _pointer;
  GameEngine get game => _controller.engine;

  @override
  void initState() {
    super.initState();
    _controller = GameController(widget.engine, widget.audio);
    _updates = Listenable.merge([_controller, widget.audio]);
    _ticker = createTicker((now) {
      final delta = (now - _previous).inMicroseconds / 1000000;
      _previous = now;
      _controller.advance(delta);
    })..start();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _controller.suspend(state != AppLifecycleState.resumed);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _ticker.dispose();
    _controller.dispose();
    unawaited(widget.audio.close());
    widget.assets.dispose();
    super.dispose();
  }

  KeyEventResult _key(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;
    if (event.logicalKey == LogicalKeyboardKey.keyP ||
        event.logicalKey == LogicalKeyboardKey.escape) {
      if (game.phase != GamePhase.menu && !game.ended) _controller.pause();
      return KeyEventResult.handled;
    }
    // A focused control (mute, music, settings, difficulty, start) activates
    // on Space itself; only an otherwise unclaimed Space starts the game.
    if (event.logicalKey == LogicalKeyboardKey.space &&
        node.hasPrimaryFocus &&
        (game.phase == GamePhase.menu || game.ended)) {
      _controller.start();
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Focus(
        autofocus: true,
        onKeyEvent: _key,
        child: ListenableBuilder(
          listenable: _updates,
          builder: (context, _) => LayoutBuilder(
            builder: (context, bounds) {
              // The browser cannot be orientation-locked by Flutter. Keep the game
              // landscape-only there too; native platforms request both landscape modes.
              // The fight must not carry on unseen behind the prompt.
              final portrait = bounds.maxWidth < bounds.maxHeight;
              _controller.obscure(portrait);
              if (portrait) return _rotatePrompt();
              final compact = bounds.maxHeight < 430;
              return Column(
                children: [
                  _toolbar(compact),
                  Expanded(
                    child: LayoutBuilder(
                      builder: (context, field) {
                        final width = math.min(
                          field.maxWidth - 16,
                          (field.maxHeight - 12) * stageWidth / stageHeight,
                        );
                        final height = width * stageHeight / stageWidth;
                        return Center(
                          child: SizedBox(
                            width: width,
                            height: height,
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: _field(Size(width, height)),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    ),
  );

  Widget _rotatePrompt() => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.screen_rotation_rounded,
            size: 54,
            color: Color(0xffb8dce9),
          ),
          const SizedBox(height: 18),
          const Text(
            'Turn to landscape',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 10),
          const Text(
            'Snowcraft plays sideways. Rotate your screen to join the fight.',
            textAlign: TextAlign.center,
          ),
        ],
      ),
    ),
  );

  Widget _toolbar(bool compact) => Container(
    height: compact ? 50 : 62,
    padding: const EdgeInsets.symmetric(horizontal: 14),
    decoration: const BoxDecoration(
      border: Border(bottom: BorderSide(color: Color(0xff2a3a49))),
    ),
    child: Row(
      children: [
        RawImage(
          image: widget.assets.images[widget.assets.named('R ready').key],
          width: 22,
          height: 32,
          filterQuality: FilterQuality.high,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            'Snowcraft Reforged',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: compact ? 17 : 20,
              fontFamily: 'Georgia',
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        if (game.phase == GamePhase.menu || game.ended) ...[
          DropdownButtonHideUnderline(
            child: DropdownButton<Difficulty>(
              key: const ValueKey('difficulty'),
              value: game.difficulty,
              items: Difficulty.values
                  .map((d) => DropdownMenuItem(value: d, child: Text(d.label)))
                  .toList(),
              onChanged: (value) {
                if (value != null) _controller.setDifficulty(value);
              },
            ),
          ),
          const SizedBox(width: 8),
        ],
        if (game.phase != GamePhase.menu && !game.ended)
          IconButton(
            tooltip: game.paused ? 'Resume game' : 'Pause game',
            onPressed: _controller.pause,
            icon: Icon(
              game.paused ? Icons.play_arrow_rounded : Icons.pause_rounded,
            ),
          ),
        IconButton(
          tooltip: widget.audio.musicEnabled
              ? 'Turn background music off'
              : 'Turn background music on',
          onPressed: () =>
              widget.audio.setMusicEnabled(!widget.audio.musicEnabled),
          icon: Icon(
            widget.audio.musicEnabled
                ? Icons.music_note_rounded
                : Icons.music_off_rounded,
          ),
          color: widget.audio.musicEnabled
              ? const Color(0xffb8dce9)
              : const Color(0xffa6b4c2),
        ),
        IconButton(
          tooltip: widget.audio.muted ? 'Unmute all sounds' : 'Mute all sounds',
          onPressed: () => widget.audio.setMuted(!widget.audio.muted),
          icon: Icon(
            widget.audio.muted
                ? Icons.volume_off_rounded
                : Icons.volume_up_rounded,
          ),
          color: widget.audio.muted
              ? const Color(0xffffa598)
              : const Color(0xffb8dce9),
        ),
        IconButton(
          tooltip: 'Settings and how to play',
          onPressed: _settings,
          icon: const Icon(Icons.tune_rounded),
        ),
        if (game.phase != GamePhase.menu)
          IconButton(
            tooltip: 'Back to menu',
            onPressed: _controller.menu,
            icon: const Icon(Icons.home_outlined),
          ),
      ],
    ),
  );

  Widget _field(Size size) {
    Vec point(Offset local) => Vec(
      local.dx / size.width * stageWidth,
      local.dy / size.height * stageHeight,
    );
    return Listener(
      behavior: HitTestBehavior.opaque,
      onPointerDown: (event) {
        if (_pointer != null) return;
        _controller.grab(point(event.localPosition));
        if (game.dragged != null) _pointer = event.pointer;
      },
      onPointerMove: (event) {
        if (event.pointer == _pointer) {
          _controller.move(point(event.localPosition));
        }
      },
      onPointerUp: (event) {
        if (event.pointer == _pointer) {
          _pointer = null;
          _controller.release();
        }
      },
      onPointerCancel: (event) {
        if (event.pointer == _pointer) {
          _pointer = null;
          _controller.cancel();
        }
      },
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Frames repaint this layer alone; the widgets around it rebuild
          // only when the controller reports a change they display.
          RepaintBoundary(
            child: CustomPaint(
              painter: GamePainter(
                game,
                widget.assets,
                repaint: _controller.frame,
              ),
            ),
          ),
          if (game.phase == GamePhase.menu) _menu(size),
          if (game.phase == GamePhase.intro)
            _message(
              game.levelIndex == 9
                  ? 'Bonus round'
                  : 'Level ${game.levelIndex + 1}',
              '${game.greens.length} Green players. Keep your team standing.',
            ),
          if (game.phase == GamePhase.cleared)
            _message('Round clear', 'On to level ${game.levelIndex + 2}'),
          if (game.ended) _endScreen(size),
          if (game.phase == GamePhase.playing) ...[
            Positioned(top: 10, left: 12, child: IgnorePointer(child: _hud())),
            if (!game.paused)
              Positioned(
                bottom: 8,
                left: 12,
                child: IgnorePointer(
                  child: Text(
                    'Pick · Hold · Slide · Release',
                    style: TextStyle(
                      color: const Color(0xff27495b),
                      fontWeight: FontWeight.w600,
                      fontSize: size.height < 280 ? 11 : 13,
                    ),
                  ),
                ),
              ),
          ],
          if (game.paused)
            ColoredBox(
              color: const Color(0xcc0c1520),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Paused',
                      style: TextStyle(
                        fontSize: 30,
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: _controller.resume,
                      icon: const Icon(Icons.play_arrow_rounded),
                      label: const Text('Resume game'),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _menu(Size size) {
    final small = size.height < 290;
    return Center(
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Container(
          width: small ? 330 : 390,
          padding: EdgeInsets.symmetric(
            horizontal: 22,
            vertical: small ? 16 : 24,
          ),
          decoration: BoxDecoration(
            color: const Color(0xf2ffffff),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xffc0d9e5)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x1f19495e),
                blurRadius: 24,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Ready. Aim. Snow.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Georgia',
                  color: const Color(0xff145f7c),
                  fontSize: small ? 28 : 36,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Three kids. Ten rounds. One snowball fight.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: small ? 13 : 15,
                  color: const Color(0xff35576a),
                ),
              ),
              SizedBox(height: small ? 14 : 20),
              SizedBox(
                width: double.infinity,
                height: 46,
                child: FilledButton.icon(
                  key: const ValueKey('start-game'),
                  onPressed: _controller.start,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xffbd352d),
                    foregroundColor: Colors.white,
                  ),
                  icon: const Icon(Icons.play_arrow_rounded),
                  label: const Text(
                    'Start snowball fight',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Hold a red kid to charge. Slide into position.\nRelease to throw across the field.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: small ? 12 : 14,
                  height: 1.4,
                  color: const Color(0xff35576a),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _message(String title, String subtitle) => IgnorePointer(
    child: Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xefffffff),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 30,
                fontFamily: 'Georgia',
                fontWeight: FontWeight.w700,
                color: Color(0xff145f7c),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: Color(0xff35576a)),
            ),
          ],
        ),
      ),
    ),
  );

  Widget _hud() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
    decoration: BoxDecoration(
      color: const Color(0xeeffffff),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'Level ${game.levelIndex + 1}',
          style: const TextStyle(
            color: Color(0xff145f7c),
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(width: 12),
        Text(
          'Green: ${game.greens.where((k) => k.alive).length}',
          style: const TextStyle(color: Color(0xff245e3b)),
        ),
        const SizedBox(width: 12),
        ...game.reds.map(
          (k) => Padding(
            padding: const EdgeInsets.only(right: 3),
            child: Icon(
              k.alive ? Icons.favorite_rounded : Icons.heart_broken_rounded,
              size: 15,
              color: k.alive
                  ? const Color(0xffb92f29)
                  : const Color(0xff64757f),
            ),
          ),
        ),
      ],
    ),
  );

  Widget _endScreen(Size size) => Center(
    child: FittedBox(
      fit: BoxFit.scaleDown,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 20),
        decoration: BoxDecoration(
          color: const Color(0xf5ffffff),
          border: Border.all(color: const Color(0xffbcd4df)),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              game.phase == GamePhase.victory
                  ? 'Congratulations!'
                  : 'Green won this round.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: size.height < 280 ? 25 : 31,
                fontFamily: 'Georgia',
                color: const Color(0xff145f7c),
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Score: ${game.score}',
              style: const TextStyle(
                fontSize: 24,
                color: Color(0xffb02f28),
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              key: const ValueKey('play-again'),
              onPressed: _controller.start,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xffbd352d),
                foregroundColor: Colors.white,
                minimumSize: const Size(200, 46),
              ),
              icon: const Icon(Icons.replay_rounded),
              label: const Text('Play again'),
            ),
          ],
        ),
      ),
    ),
  );

  Future<void> _settings() async {
    final wasPaused = _controller.userPaused;
    _controller.setUserPaused(true);
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      constraints: const BoxConstraints(maxWidth: 540),
      builder: (context) => SafeArea(
        child: SingleChildScrollView(
          child: ListenableBuilder(
            listenable: widget.audio,
            builder: (context, _) => Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Make it your snowball fight',
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Background music'),
                    subtitle: const Text(
                      'Keep effects even when music is off.',
                    ),
                    value: widget.audio.musicEnabled,
                    onChanged: widget.audio.setMusicEnabled,
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Mute all sounds'),
                    value: widget.audio.muted,
                    onChanged: widget.audio.setMuted,
                  ),
                  const Divider(),
                  const Text(
                    'Pick a red kid, hold to build power, slide into a throwing lane, and release. Your teammates can take two hits. Clear the green team to advance through ten rounds.',
                    style: TextStyle(height: 1.5),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Opponents look for a clear throwing lane, so keep moving between throws. Your kid moves at a steady pace while you drag and slows while charging.',
                    style: TextStyle(height: 1.5, color: Color(0xffbacbd8)),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Keyboard: Space starts or replays. P / Esc pauses. Tab moves between menu controls.',
                    style: TextStyle(fontSize: 12, color: Color(0xffbacbd8)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    if (!mounted) return;
    _controller.setUserPaused(wasPaused);
  }
}
