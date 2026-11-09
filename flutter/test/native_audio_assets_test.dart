import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'all native SFX are valid 44.1kHz 16-bit PCM with post-resample headroom',
    () {
      final clips = Directory('assets/audio')
          .listSync()
          .whereType<File>()
          .where((f) => f.path.endsWith('.wav'))
          .toList();
      expect(clips.length, 15);
      for (final clip in clips) {
        final bytes = clip.readAsBytesSync();
        final data = ByteData.sublistView(bytes);
        expect(
          String.fromCharCodes(bytes.sublist(0, 4)),
          'RIFF',
          reason: clip.path,
        );
        expect(String.fromCharCodes(bytes.sublist(8, 12)), 'WAVE');
        var foundPcm = false, foundData = false;
        var offset = 12;
        while (offset + 8 <= bytes.length) {
          final id = String.fromCharCodes(bytes.sublist(offset, offset + 4));
          final count = data.getUint32(offset + 4, Endian.little);
          final start = offset + 8;
          expect(
            start + count,
            lessThanOrEqualTo(bytes.length),
            reason: clip.path,
          );
          if (id == 'fmt ') {
            expect(data.getUint16(start, Endian.little), 1);
            expect(data.getUint32(start + 4, Endian.little), 44100);
            expect(data.getUint16(start + 14, Endian.little), 16);
            foundPcm = true;
          }
          if (id == 'data') {
            expect(count, greaterThan(0));
            var peak = 0;
            for (var index = start; index < start + count; index += 2) {
              peak = math.max(peak, data.getInt16(index, Endian.little).abs());
            }
            expect(
              peak,
              lessThanOrEqualTo(23200),
              reason: '${clip.path} must have at least 3 dB of headroom',
            );
            foundData = true;
          }
          offset = start + count + (count.isOdd ? 1 : 0);
        }
        expect(foundPcm && foundData, isTrue, reason: clip.path);
      }
    },
  );
}
