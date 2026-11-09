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
  final assets = await GameAssets.load();
  final audio = GameAudio(NativeAudioPort(), LocalPreferences());
  await audio.initialize();
  runApp(
    SnowcraftApp(
      assets: assets,
      engine: GameEngine(
        assets.levels,
        seed: DateTime.now().millisecondsSinceEpoch,
      ),
      audio: audio,
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
    title: 'Snowcraft Reforged',
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
