import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'data/game_assets.dart';
import 'data/game_audio.dart';
import 'domain/game_engine.dart';
import 'ui/game_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Explicit product requirement: native play supports either landscape direction.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  runApp(
    await bootstrap(
      GameAssets.load,
      () => GameAudio(NativeAudioPort(), LocalPreferences()),
    ),
  );
}

/// Builds the game, or a plain error screen when the bundled game data cannot
/// be loaded. Audio restores its preferences and prepares its players behind
/// the first frame, so a slow or failed audio start never holds the splash.
Future<Widget> bootstrap(
  Future<GameAssets> Function() loadAssets,
  GameAudio Function() createAudio,
) async {
  final GameAssets assets;
  try {
    assets = await loadAssets();
  } catch (_) {
    return const LoadFailedApp();
  }
  final audio = createAudio();
  unawaited(audio.initialize());
  return SnowcraftApp(
    assets: assets,
    engine: GameEngine(
      assets.levels,
      seed: DateTime.now().millisecondsSinceEpoch,
    ),
    audio: audio,
  );
}

class LoadFailedApp extends StatelessWidget {
  const LoadFailedApp({super.key});
  @override
  Widget build(BuildContext context) => const MaterialApp(
    title: 'SnowCraft Reforged',
    debugShowCheckedModeBanner: false,
    home: Scaffold(
      backgroundColor: Color(0xff0c1520),
      body: Center(
        child: Padding(
          padding: EdgeInsets.all(28),
          child: Text(
            'SnowCraft could not load its game files.\n'
            'Close the app and open it again. If this keeps happening, '
            'reinstall it.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white, fontSize: 18, height: 1.4),
          ),
        ),
      ),
    ),
  );
}

class SnowcraftApp extends StatelessWidget {
  const SnowcraftApp({
    super.key,
    required this.assets,
    required this.engine,
    required this.audio,
  });
  final GameAssets assets;
  final GameEngine engine;
  final GameAudio audio;
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'SnowCraft Reforged',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: const Color(0xff0c1520),
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xffd2493d),
        brightness: Brightness.dark,
        primary: const Color(0xffffa598),
        surface: const Color(0xff152434),
      ),
    ),
    home: GamePage(assets: assets, engine: engine, audio: audio),
  );
}
