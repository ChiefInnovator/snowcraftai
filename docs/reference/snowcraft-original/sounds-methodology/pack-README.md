# SnowCraft — extracted sounds

**Application:** SnowCraft (Nicholson NY, 1999), a Windows Macromedia Director 7/8 projector (`SnowCraft.exe`, from Internet Archive item `snowcraft_201912`). The evidence: `PROJECTOR` resource, embedded `SnowCraft.dir` (RIFX/MV93), Director Xtras list, and archive.org metadata.

**Method:** static parsing only; the app was never executed. The script reads the movie memory map (`mmap`) and `KEY*` table, then maps each `sndS` (PCM) and `sndH` (header) to its cast member name. Samples are written byte-for-byte into a WAV container, so they are **lossless originals, not reconstructions**. One clip (`halaluja`) held a classic Mac `snd ` resource, and its 42-byte header was stripped.

| # | File | Cast name | Import fmt | Rate | Dur (s) |
|---|---|---|---|---|---|
| 1 | sounds/01_bird_tweets.wav | bird_tweets | kMoaCfFormat_WAVE | 11025 Hz | 1.231 |
| 2 | sounds/02_laugh.wav | laugh | kMoaCfFormat_snd | 11025 Hz | 2.622 |
| 3 | sounds/03_Ahhhh.wav | Ahhhh! | kMoaCfFormat_WAVE | 11025 Hz | 1.195 |
| 4 | sounds/04_ugly.wav | ugly | kMoaCfFormat_snd | 11127 Hz | 1.857 |
| 5 | sounds/05_short_chirps.wav | short_chirps | kMoaCfFormat_AIFF | 22254 Hz | 0.569 |
| 6 | sounds/06_Whoosh.wav | Whoosh | kMoaCfFormat_snd | 11127 Hz | 0.909 |
| 7 | sounds/07_kids3.wav | kids3 | kMoaCfFormat_snd | 11025 Hz | 0.824 |
| 8 | sounds/08_step.wav | step | kMoaCfFormat_AIFF | 22254 Hz | 0.327 |
| 9 | sounds/09_kids2.wav | kids2 | kMoaCfFormat_snd | 11025 Hz | 0.582 |
| 10 | sounds/10_kids1.wav | kids1 | kMoaCfFormat_snd | 11025 Hz | 0.511 |
| 11 | sounds/11_hit1.wav | hit1 | kMoaCfFormat_snd | 11025 Hz | 0.403 |
| 12 | sounds/12_Whoosh_Percusive.wav | Whoosh Percusive | kMoaCfFormat_snd | 11127 Hz | 0.192 |
| 13 | sounds/13_Uh.wav | Uh | kMoaCfFormat_snd | 11025 Hz | 0.162 |
| 14 | sounds/14_splat.wav | splat | kMoaCfFormat_snd | 11025 Hz | 0.105 |
| 15 | sounds/15_hit2.wav | hit2 | kMoaCfFormat_snd | 11025 Hz | 0.296 |
| 16 | sounds/16_halaluja.wav | halaluja | ? | 11128 Hz | 2.008 |

All files are 8-bit unsigned mono PCM. There are 16 unique sounds, no duplicates, and the total is about 13.8 s.

**Coverage / caveats:** These are all 16 sound cast members in the movie. There are no external sound files, no streaming SWA/MP3 members, no Flash audio, and no procedural/synth audio. The other XFIR container holds only Xtras (DLL code). Name `Uh` was recovered from cast info. Sample rates come from the stored header: 11025, 11127 and 11128 (legacy Mac 11.127 kHz) and 22254 Hz. Playback quality is the original 1999 8-bit low-fi. Copyright belongs to the original authors; these are for reference only.

Re-run: `python3 extract_snowcraft_sounds.py SnowCraft.exe sounds`