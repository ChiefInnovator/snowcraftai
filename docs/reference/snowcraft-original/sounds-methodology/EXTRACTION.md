# Sound extraction methodology

The 16 original SnowCraft clips are **lossless re-wraps** of PCM found in the
Director movie inside `SnowCraft.exe`. The Windows projector was never executed.

## Source

1. User zip `archives/nicholson-snowcraft-1999-win32-projector-ia-snowcraft-201912.zip`
   (Cursor upload `ba07317d…_52b2.zip`, SHA-256 `2aa0f56411608c4b7a986f4f267b83b4ce26c9c51ca6dea6d15d4f9c5718bf0e`).
2. Inner `snowcraft_201912/SnowCraft.exe`
   (SHA-256 `2103bae31937095450962c91ec025e5e49eac920d2eccf1bdd89bcae2e130b8c`).
3. Embedded little-endian movie `XFIR`/`39VM` at file offset `0x306114`.

## Steps (what `extract_snowcraft_sounds.py` does)

1. Locate the `XFIR....39VM` movie in the PE without running it.
2. Parse `mmap` (`pamm` little-endian) and `KEY*` so each `sndS` payload maps to
   a cast member.
3. Read the paired `sndH` header: sample count, rate, bits, channels.
4. Copy PCM bytes into a WAV container (`wave` module). No resample, no
   normalize, no reconstruction.
5. Special case: `halaluja` starts with a 42-byte Mac `snd ` resource header
   (`00 01 00 01` …); that header is stripped, PCM is not invented.
6. Write `inventory.json` with per-file PCM SHA-256.

The committed extractor in this folder is the copy from
`application-sounds.zip`. The same script also lives at
`tools/extract_snowcraft_sounds.py`.

## Inventory (16 unique, 0 duplicates)

| File | Cast | Import | Rate | Duration | PCM SHA-256 (prefix) |
|---|---|---|---|---|---|
| 01_bird_tweets.wav | bird_tweets | WAVE | 11025 | 1.231 s | `14283666…` |
| 02_laugh.wav | laugh | snd | 11025 | 2.622 s | `83b13dd5…` |
| 03_Ahhhh.wav | Ahhhh! | WAVE | 11025 | 1.195 s | `92484f40…` |
| 04_ugly.wav | ugly | snd | 11127 | 1.857 s | `fb5a7674…` |
| 05_short_chirps.wav | short_chirps | AIFF | 22254 | 0.569 s | `110170a3…` |
| 06_Whoosh.wav | Whoosh | snd | 11127 | 0.909 s | `dec3edb7…` |
| 07_kids3.wav | kids3 | snd | 11025 | 0.824 s | `8fb8466c…` |
| 08_step.wav | step | AIFF | 22254 | 0.327 s | `e2429c9c…` |
| 09_kids2.wav | kids2 | snd | 11025 | 0.582 s | `c2843c41…` |
| 10_kids1.wav | kids1 | snd | 11025 | 0.511 s | `bbd06a7c…` |
| 11_hit1.wav | hit1 | snd | 11025 | 0.403 s | `886eb9d9…` |
| 12_Whoosh_Percusive.wav | Whoosh Percusive | snd | 11127 | 0.192 s | `fd5f48cb…` |
| 13_Uh.wav | Uh | snd | 11025 | 0.162 s | `baf377fb…` |
| 14_splat.wav | splat | snd | 11025 | 0.105 s | `b7e28862…` |
| 15_hit2.wav | hit2 | snd | 11025 | 0.296 s | `0df32bb2…` |
| 16_halaluja.wav | halaluja | Mac snd | 11128 | 2.008 s | `d030a0b1…` |

Full records: `inventory.json`. `Uh` is stored in the movie and **not** wired
in recovered Lingo.

## Where the bytes live

| Copy | Purpose |
|---|---|
| `archives/nicholson-snowcraft-1999-extracted-sounds-pack.zip` | User-uploaded pack (WAVs + this methodology) |
| `web/assets/sounds/*.wav` | Runtime assets the remake loads (byte-identical to the pack WAVs) |
| This folder | Inventory + extractor only — **not** a third WAV tree |

Channel-1 playback (`puppetSound` / `soundBusy(1)`) is `web/js/audio.js`.
Event mapping is `docs/PARITY.md`.

## DCR sounds

The Shockwave DCR also has **16** `snd ` resources (Afterburner ABMP). Those
payloads use compression type 1 and were not decoded to PCM here, so they are
**not** a second source of the runtime WAVs. See `source-evidence/dcr-vs-exe.md`.
