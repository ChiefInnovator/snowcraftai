import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/services.dart';

import '../domain/game_engine.dart';

class ArtFrame {
  const ArtFrame({
    required this.key,
    required this.file,
    required this.width,
    required this.height,
    required this.regX,
    required this.regY,
  });
  final String key;
  final String file;
  final double width, height, regX, regY;
  factory ArtFrame.fromJson(Map<String, dynamic> json) => ArtFrame(
    key: json['key'] as String,
    file:
        json['file'] as String? ??
        '${json['key']}.png'.replaceFirst('cast_', ''),
    width: (json['w'] as num).toDouble(),
    height: (json['h'] as num).toDouble(),
    regX: (json['reg'][0] as num).toDouble(),
    regY: (json['reg'][1] as num).toDouble(),
  );
}

class GameAssets {
  GameAssets({
    required this.levels,
    required this.frames,
    required this.images,
    required this.names,
    required this.powers,
    required this.snowball,
    required this.drops,
    required this.splat,
    required this.melts,
    required this.ground,
  });
  final List<LevelSeed> levels;
  final Map<String, ArtFrame> frames;
  final Map<String, ui.Image> images;
  final Map<String, List<ArtFrame>> names;
  final List<ArtFrame> powers, drops, melts;
  final ArtFrame snowball, splat, ground;

  /// Redrawn characters and snowfield; recovered effects are smoothed at 4x.
  static Future<GameAssets> load({AssetBundle? bundle}) async {
    final source = bundle ?? rootBundle;
    final data = jsonDecode(
      await source.loadString('assets/data/game.json'),
    ) as Map<String, dynamic>;
    final hd = jsonDecode(
      await source.loadString('assets/hd/characters/manifest.json'),
    ) as Map<String, dynamic>;
    if (hd['version'] != 1 ||
        hd['pixelScale'] != 8 ||
        hd['selectionRing'] != 'renderer' ||
        hd['frames'] is! List ||
        (hd['frames'] as List).length != 35) {
      throw const FormatException('Incomplete HD character pack');
    }
    final hdFrames = <String, Map<String, dynamic>>{};
    for (final item in hd['frames'] as List) {
      if (item is! Map<String, dynamic> ||
          item['key'] is! String ||
          hdFrames.containsKey(item['key'])) {
        throw const FormatException('Invalid HD character entry');
      }
      hdFrames[item['key'] as String] = item;
    }
    final frames = <String, ArtFrame>{};
    final names = <String, List<ArtFrame>>{};
    ArtFrame read(dynamic item) {
      final frame = ArtFrame.fromJson(item as Map<String, dynamic>);
      frames[frame.key] = frame;
      return frame;
    }

    for (final item in data['kids'] as List) {
      final frame = read(item);
      names.putIfAbsent(item['name'] as String, () => []).add(frame);
      if (item['name'] != 'shadow') {
        final replacement = hdFrames[frame.key];
        if (replacement == null ||
            replacement['file'] != frame.file ||
            replacement['pixelScale'] != 8 ||
            replacement['w'] != frame.width ||
            replacement['h'] != frame.height ||
            replacement['reg'] is! List ||
            (replacement['reg'] as List).length != 2 ||
            replacement['reg'][0] != frame.regX ||
            replacement['reg'][1] != frame.regY) {
          throw FormatException('HD registration mismatch: ${frame.key}');
        }
      }
    }
    final powers = (data['power'] as List).map(read).toList();
    final snowball = read(data['snowball']);
    final drops = (data['drop'] as List).map(read).toList();
    final splat = read(data['splat']);
    final melts = (data['melt'] as List).map(read).toList();
    final ground = read(data['ground']);
    final shadowKeys = <String>{};
    for (final character in hdFrames.values) {
      final shadow = character['shadow'];
      if (shadow is! Map<String, dynamic> ||
          shadow['key'] != 'hd_shadow_${character['key']}' ||
          shadow['file'] != 'shadow_${character['file']}' ||
          shadow['pixelScale'] != 8) {
        throw const FormatException('Missing HD pose shadow');
      }
      shadowKeys.add(read(shadow).key);
    }
    final images = <String, ui.Image>{};
    try {
      for (final frame in frames.values) {
        final character = hdFrames[frame.key];
        final isHd = character != null || shadowKeys.contains(frame.key);
        final isGround = frame.key == ground.key;
        final bytes = await source.load(
          isGround
              ? 'assets/hd/scenery/ground.png'
              : isHd
              ? 'assets/hd/characters/${frame.file}'
              : 'assets/art/${frame.file}',
        );
        final codec = await ui.instantiateImageCodec(
          bytes.buffer.asUint8List(bytes.offsetInBytes, bytes.lengthInBytes),
          // Decode HD at its real size so a damaged export cannot be hidden by
          // upscaling. Recovered scenery/effects retain the existing 4x decode.
          targetWidth: !isHd && !isGround ? (frame.width * 4).round() : null,
          targetHeight: !isHd && !isGround ? (frame.height * 4).round() : null,
          allowUpscaling: true,
        );
        try {
          final image = (await codec.getNextFrame()).image;
          if (isHd &&
              (image.width != frame.width * 8 ||
                  image.height != frame.height * 8)) {
            image.dispose();
            throw FormatException('HD image size mismatch: ${frame.key}');
          }
          images[frame.key] = image;
        } finally {
          codec.dispose();
        }
      }
    } catch (_) {
      for (final image in images.values) {
        image.dispose();
      }
      rethrow;
    }
    return GameAssets(
      levels: (data['levels'] as List)
          .map((j) => LevelSeed.fromJson(j))
          .toList(),
      frames: frames,
      images: images,
      names: names,
      powers: powers,
      snowball: snowball,
      drops: drops,
      splat: splat,
      melts: melts,
      ground: ground,
    );
  }

  ArtFrame named(String name, [int variant = 0]) {
    final options = names[name]!;
    return options[variant % options.length];
  }

  ArtFrame kidFrame(Kid kid, double time, {bool celebrate = false}) {
    final red = kid.team == Team.red;
    if (!kid.alive) return named(red ? 'R dead' : 'G dead', kid.id);
    if (celebrate && !red) return named('G yea', (time * 5).floor());
    return switch (kid.pose) {
      KidPose.walk => named(
        red
            ? ((time * 6).floor().isEven ? 'R Auto walk_1' : 'R Auto walk_2')
            : ((time * 6).floor().isEven ? 'G Walk V1' : 'G Walk V2'),
      ),
      KidPose.windup => named(red ? 'R pop' : 'G windup'),
      KidPose.cock => named(red ? 'R cock' : 'G cock'),
      KidPose.toss => named(red ? 'R toss' : 'G toss'),
      KidPose.hurt => named(
        red ? 'R daze${1 + (time * 6).floor() % 3}' : 'G ow',
      ),
      KidPose.down => named(red ? 'R hit' : 'G down'),
      KidPose.dead => named(red ? 'R dead' : 'G dead', kid.id),
      KidPose.cheer => named(red ? 'R ready' : 'G yea'),
      KidPose.ready => named(red ? 'R ready' : 'G ready'),
    };
  }

  ArtFrame ballFrame(Snowball ball) => switch (ball.phase) {
    BallPhase.flying => snowball,
    BallPhase.dropping => drops[ball.frame.clamp(0, 3)],
    BallPhase.splat => splat,
    BallPhase.melting => melts[ball.frame.clamp(0, 3)],
  };

  void dispose() {
    for (final image in images.values) {
      image.dispose();
    }
  }
}
