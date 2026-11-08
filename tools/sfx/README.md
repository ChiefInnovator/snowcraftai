# Sound effects

Original SFX synthesized from scratch by `generate_sfx.py` (stdlib only, fixed seed, no audio inputs).
Regenerate from the repo root with `python3 -I tools/sfx/generate_sfx.py`. Output: `src/assets/sfx/*.wav`, 22050 Hz, 16-bit mono, peak -1 dBFS.

| File | Event | Duration | Synthesis |
|---|---|---|---|
| `throw.wav` | Throw, partial power | 0.18 s | White noise through a band-pass sweeping 700 to 2600 Hz, hump envelope, plus a faint low-passed air layer |
| `throw_full.wav` | Throw, full power | 0.35 s | Two band-passed noise layers sweeping 450 to 3300 Hz (and 1.5x), plus a rising low-passed air layer |
| `hit.wav` | Snowball hits a kid | 0.20 s | Sine thump (150 to 55 Hz drop) with a soft click, granular band-passed noise crunch, low-passed "poof" |
| `splat.wav` | Missed ball lands in snow | 0.12 s | Small granular noise crunch around 2.9 kHz with a faint low thump |
| `knockdown.wav` | Enemy knocked down | 0.40 s | Heavier thump and crunch, then a triangle+sine "bonk" falling 560 to 250 Hz |
| `green_out.wav` | Enemy knocked out | 0.60 s | Slide whistle: sine (plus weak 2nd harmonic) gliding 1500 to 330 Hz with vibrato, breathy resonant noise tracking the pitch |
| `red_daze.wav` | Player kid dazed | 0.80 s | Four sine chirps, each a fast up-then-down glide (2.2 to 4.1 kHz) with fast flutter |
| `red_out.wav` | Player kid knocked out | 0.80 s | Two notes (311 Hz, then 262 sagging to 220 Hz): detuned squares + triangle through a resonant low-pass that opens then closes, with vibrato |
| `deny.wav` | Click/hover on a dazed kid | 0.15 s | Two short low-passed square blips (1760 Hz, 1480 Hz) |
| `step.wav` | Kids walking onto the field | 0.08 s | Few-grain low band-passed noise crunch with a faint low thump |
| `cheer.wav` | Enemies win | 1.00 s | Staccato square/triangle zig-zag climb through a major pentatonic with pitch bounce on each onset, ending in a wobbly top note; small room |
| `level_clear.wav` | Level cleared | 1.20 s | FM bells (ratio 2) + triangle: D5, F#5, A5, E5, then held D6 over A5; small room |
| `victory.wav` | All levels cleared | 2.50 s | Detuned-saw "brass" through an enveloped low-pass playing an original F-major fanfare, F-major chord pad, sine drum thumps, FM-bell sparkle arpeggio; small room |
| `level_start.wav` | Level banner appears | 0.60 s | Two-note chime (A5 then D6): soft FM bell + sine; small room |
