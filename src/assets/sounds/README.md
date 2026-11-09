# SnowCraft — extracted sounds

**Application:** SnowCraft (Nicholson NY, 1999), a Windows Macromedia Director 7/8 projector (`SnowCraft.exe`, from Internet Archive item `snowcraft_201912`). The evidence: `PROJECTOR` resource, embedded `SnowCraft.dir` (RIFX/MV93), Director Xtras list, and archive.org metadata.

**Method:** static parsing only; the app was never executed. The script reads the movie memory map (`mmap`) and `KEY*` table, then maps each `sndS` (PCM) and `sndH` (header) to its cast member name. Samples are written byte-for-byte into a WAV container, so they are **lossless originals, not reconstructions**. One clip (`halaluja`) held a classic Mac `snd ` resource, and its 42-byte header was stripped.

| # | File | Cast name | Import fmt | Rate | Dur (s) |
|---|---|---|---|---|---|
| 1 | 01_bird_tweets.wav | bird_tweets | kMoaCfFormat_WAVE | 11025 Hz | 1.231 |
| 2 | 02_laugh.wav | laugh | kMoaCfFormat_snd | 11025 Hz | 2.622 |
| 3 | 03_Ahhhh.wav | Ahhhh! | kMoaCfFormat_WAVE | 11025 Hz | 1.195 |
| 4 | 04_ugly.wav | ugly | kMoaCfFormat_snd | 11127 Hz | 1.857 |
| 5 | 05_short_chirps.wav | short_chirps | kMoaCfFormat_AIFF | 22254 Hz | 0.569 |
| 6 | 06_Whoosh.wav | Whoosh | kMoaCfFormat_snd | 11127 Hz | 0.909 |
| 7 | 07_kids3.wav | kids3 | kMoaCfFormat_snd | 11025 Hz | 0.824 |
| 8 | 08_step.wav | step | kMoaCfFormat_AIFF | 22254 Hz | 0.327 |
| 9 | 09_kids2.wav | kids2 | kMoaCfFormat_snd | 11025 Hz | 0.582 |
| 10 | 10_kids1.wav | kids1 | kMoaCfFormat_snd | 11025 Hz | 0.511 |
| 11 | 11_hit1.wav | hit1 | kMoaCfFormat_snd | 11025 Hz | 0.403 |
| 12 | 12_Whoosh_Percusive.wav | Whoosh Percusive | kMoaCfFormat_snd | 11127 Hz | 0.192 |
| 13 | 13_Uh.wav | Uh | kMoaCfFormat_snd | 11025 Hz | 0.162 |
| 14 | 14_splat.wav | splat | kMoaCfFormat_snd | 11025 Hz | 0.105 |
| 15 | 15_hit2.wav | hit2 | kMoaCfFormat_snd | 11025 Hz | 0.296 |
| 16 | 16_halaluja.wav | halaluja | ? | 11128 Hz | 2.008 |

All files are 8-bit unsigned mono PCM. There are 16 unique sounds, no duplicates, and the total is about 13.8 s. SHA-256 of the PCM payloads is in `inventory.json`. `Uh` is stored but **not wired** (no Lingo `puppetSound` recovered). Event mapping is in `docs/PARITY.md`.

**Coverage / caveats:** These are all 16 sound cast members in the movie. There are no external sound files, no streaming SWA/MP3 members, no Flash audio, and no procedural/synth audio. The other XFIR container holds only Xtras (DLL code). Name `Uh` was recovered from cast info. Sample rates come from the stored header: 11025, 11127 and 11128 (legacy Mac 11.127 kHz) and 22254 Hz. Playback quality is the original 1999 8-bit low-fi.

**Provenance / licensing:** Historic third-party recordings from the user-supplied Internet Archive projector (`snowcraft_201912`). Movie credits name Wells Packard / Nicholson (see `docs/reference/snowcraft-original/COPYRIGHT-NOTICES.md`). **No explicit license for these WAVs was found in the original files.** Copyright remains with the original rights holders. Inclusion here is not permission to redistribute. The extractor (`tools/extract_snowcraft_sounds.py`) only re-wraps PCM in a WAV container; it does not resample or reconstruct samples.

Re-run: `python3 tools/extract_snowcraft_sounds.py docs/reference/snowcraft-original/extracted/SnowCraft.exe src/assets/sounds`

The user-supplied pack (same 16 WAV bytes + inventory) is archived at `docs/reference/snowcraft-original/archives/nicholson-snowcraft-1999-extracted-sounds-pack.zip`. Methodology: `docs/reference/snowcraft-original/sounds-methodology/`. This folder is the **runtime** audio tree the game loads.