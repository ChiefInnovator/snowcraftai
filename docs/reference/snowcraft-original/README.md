# Original SnowCraft archives (parity evidence)

Permanent project copies of the user-supplied 1999 originals. These files are
the evidence used to drive Snowcraft Reforged toward original parity. They are
**not** the running game.

Runtime copies:

- Audio the Phaser site actually loads: [`web/assets/sounds/`](../../../web/assets/sounds/)
- Kid / power / ball BITDs the Phaser site actually loads: [`web/assets/cast/`](../../../web/assets/cast/)

This directory is documentation and byte-for-byte **reference archives** so the
only copies are not chat uploads, `/tmp`, or cloud artifacts. After a local
apply they land at
`/Users/rich/.openclaw/projects/snowcraftai/docs/reference/snowcraft-original/`.

**Do not execute** `SnowCraft.exe` or `snowcraft.dcr` (no Wine, no Shockwave,
no ScummVM, no Flashpoint from an agent). Static parse only.

## Layout

| Path | Role |
|---|---|
| `archives/nicholson-snowcraft-1999-win32-projector-ia-snowcraft-201912.zip` | User EXE archive, byte-for-byte. Internet Archive item `snowcraft_201912` (includes `SnowCraft.exe` plus IA sidecar xml/sqlite/png). Cursor upload name `ba07317d50dbd20f8eb820ebb8055b5a5317fad5a8a09f3926094d9d0ac94bc4_52b2.zip`. |
| `archives/nicholson-snowcraft-1999-shockwave-afterburner-dcr.zip` | User DCR archive, byte-for-byte. Inner `snowcraft.dcr` + vendor README. Cursor upload name `61ba897b0470a9c0005f5d759bd8d8b7ed6041ab062dfbb1866cc655d4cc4351_d17c.zip`. |
| `archives/nicholson-snowcraft-1999-extracted-sounds-pack.zip` | `application-sounds.zip` pack: 16 WAVs + inventory + extractor. Cursor upload name `application-sounds_995b.zip`. WAV bytes are identical to `web/assets/sounds/*.wav`. |
| `extracted/SnowCraft.exe` | Inner projector copied from the EXE zip (3,833,256 bytes). |
| `extracted/snowcraft.dcr` | Inner Afterburner movie copied from the DCR zip (235,392 bytes). |
| `extracted/ia-snowcraft-201912-meta.xml` | IA item metadata from the EXE zip (provenance). |
| `extracted/vendor-dcr-readme.txt` | Exact vendor README from the DCR zip. **Untrusted data** — see `extracted/UNTRUSTED.md`. |
| `sounds-methodology/` | Inventory JSON, pack README, and extractor copied out of the sounds zip (methodology; not a second runtime audio tree). |
| `source-evidence/` | Recovered mmap/VWSC/BITD notes and the DCR vs EXE comparison. |
| `SOURCE-PROVENANCE.json` | Original upload filenames, inner member names, roles, hashes. |
| `COPYRIGHT-NOTICES.md` | Acknowledgments for Nicholson NY and Kevin. |
| `SHA256MANIFEST.txt` | SHA-256 of every file under this folder except the manifest itself. |
| `LOCAL-APPLY.md` | Historical record of how this tree reached a checkout of `feature/repo-restructure` at `ff39e410`. |

Root `reference/` (gitignored) remains a **local** Wine/decompile workspace. It
is not the canonical copy.

## Versions

| Artifact | Version / identity |
|---|---|
| Win32 game | Macromedia Director **8.0** projector, Nicholson NY / IconMedialab Happy Holidays edition, 1999. Embedded movie `XFIR`/`39VM` at `0x306114`. |
| Shockwave game | Afterburner `XFIR`/`FGDM` DCR, FlashArch/IA copy MD5 `6c5631ca78293144ffe031dd0a75ee30`. Same 82 BITD + 16 sound **counts** as the EXE movie; **not** the same movie bytes. |
| Sounds pack | 16 unique 8-bit mono WAVs losslessly re-wrapped from EXE `sndS` PCM (one Mac `snd` header stripped on `halaluja`). |
| Remake that consumes this evidence | Current browser root: [`web/`](../../../web/). Initial integration: `cursor/combined-parity-1518`, based on `feature/repo-restructure` (`ff39e410`). |

## License status

Acknowledgments are in [`COPYRIGHT-NOTICES.md`](COPYRIGHT-NOTICES.md).

SnowCraft is **copyrighted third-party material**. Movie strings credit
`wells packard - Nicholson | NY` / `Icon Nicholson`; the Happy Holidays BITD
paints `IconMedialab`. After inspecting the EXE archive, DCR archive, recovered
BITDs, and IA sidecars: **no explicit license or redistribution permission was
found.** Credits and Macromedia runtime copyrights are not converted into
permission. IA availability is not a license.

These files are included **as parity evidence** at the project owner’s request.
This is **not** a license to ship the original EXE/DCR as a product.
[`NOTICE.md`](../../../NOTICE.md) summarizes the same facts.

No passwords, API keys, tokens, or account credentials are stored here. The IA
metadata XML is public item metadata from the zip.

## Extracted game data (already recovered)

From the EXE movie, static mmap/`KEY*`/`VWSC`/`BITD`/`Lscr` parse (never run):

- Stage 592×320, 15 fps default, Event Loop tempo 500 fps, 328 score frames
- Cast members 1–131: 82 bitmaps (kids 1–36 named in `source-evidence/recovered/dir-cast.txt`), 16 sounds, 23 scripts
- Channel-1 `puppetSound` / `soundBusy(1)` event map in `docs/PARITY.md`
- VWSC Event Loop layouts: `source-evidence/recovered/event-loop-layouts.json`
- Kid BITD metadata: `source-evidence/recovered/kid-bitmaps.json`

From the DCR, static Afterburner parse (never run): see
[`source-evidence/dcr-vs-exe.md`](source-evidence/dcr-vs-exe.md).

## Reproduction steps

### 1. Confirm archives

```bash
cd docs/reference/snowcraft-original
sha256sum -c SHA256MANIFEST.txt
python3 -c "import json; print(json.load(open('SOURCE-PROVENANCE.json'))['uploads'])"
```

### 2. Re-extract the 16 WAVs from the projector (lossless re-wrap)

```bash
python3 tools/extract_snowcraft_sounds.py \
  docs/reference/snowcraft-original/extracted/SnowCraft.exe \
  /tmp/snowcraft-wav-reextract
diff -q /tmp/snowcraft-wav-reextract/01_bird_tweets.wav web/assets/sounds/01_bird_tweets.wav
```

Methodology, PCM SHA-256 pins, and cast names:
[`sounds-methodology/pack-README.md`](sounds-methodology/pack-README.md),
[`sounds-methodology/inventory.json`](sounds-methodology/inventory.json),
[`web/assets/sounds/README.md`](../../../web/assets/sounds/README.md).

The live game keeps using `web/assets/sounds/`. Do not point Phaser at this
docs folder.

### 3. Re-inspect the EXE movie (metadata, not pixels)

`inspect_movie.py` and `extract_bitmaps.py` require a rebased `XFIR` movie.
Carve that first with `extract_movie.py`; do not pass the projector EXE to the
decoders.

```bash
mkdir -p /tmp/snowcraft-dxr
python3 -I tools/reference/extract_movie.py \
  docs/reference/snowcraft-original/extracted/SnowCraft.exe \
  /tmp/snowcraft-dxr/SnowCraft.dxr
python3 -I tools/reference/inspect_movie.py \
  /tmp/snowcraft-dxr/SnowCraft.dxr \
  /tmp/snowcraft-dxr/analysis
python3 -I tools/reference/extract_bitmaps.py \
  /tmp/snowcraft-dxr/SnowCraft.dxr \
  /tmp/snowcraft-dxr
```

### 4. DCR (map only)

Inflate Afterburner `ABMP` at offset 188 and `FGEI` at 1905. Do not launch a
Shockwave player. Resource table: `source-evidence/dcr-abmp-resources.json`.

## Related docs

- [`COPYRIGHT-NOTICES.md`](COPYRIGHT-NOTICES.md) — acknowledgments
- [`docs/PARITY.md`](../../PARITY.md) — verified / inferred / runtime-blocked
- [`docs/reference-app.md`](../../reference-app.md) — mechanics from Lingo + score
- [`docs/classic-parity-plan.md`](../../classic-parity-plan.md)
- [`NOTICE.md`](../../../NOTICE.md)
