# EXE projector vs Shockwave DCR (static)

Both user-supplied originals are SnowCraft (Nicholson NY / iconNicholson). They
are **not** the same movie bytes. Neither file was executed.

## Identities

| | Win32 projector | Shockwave DCR |
|---|---|---|
| Archive | `archives/nicholson-snowcraft-1999-win32-projector-ia-snowcraft-201912.zip` | `archives/nicholson-snowcraft-1999-shockwave-afterburner-dcr.zip` |
| Inner file | `extracted/SnowCraft.exe` (3,833,256 bytes) | `extracted/snowcraft.dcr` (235,392 bytes) |
| SHA-256 | `2103bae31937095450962c91ec025e5e49eac920d2eccf1bdd89bcae2e130b8c` | `dbef86d17467b9e24e6e4a4227bc9c5d7aa8c3cb12e2f4f21722a5fc68380fa9` |
| Other hash | PE32 i386 GUI | MD5 `6c5631ca78293144ffe031dd0a75ee30` (matches the zip's vendor README and FlashArch) |
| Container | Director **8.0** projector, `XFIR`/`LPPA` Xtras + one `XFIR`/`39VM` movie | Afterburner Shockwave, `XFIR`/`FGDM` (`Fver` / `Fcdr` / `ABMP` / `FGEI`) |
| Movie | Uncompressed little-endian Director movie at EXE offset `0x306114`, 662,672 bytes, SHA-256 `5fad8ec00836e63e276c7aa5b060bab2f04f10d8778cff494827730978f5442b` | Same franchise packed with Afterburner varint map + zlib ILS/FGEI body (240,387 bytes inflated) |
| Label in vendor text | Internet Archive item `snowcraft_201912`, 1999 IconMedialab “Happy Holidays” edition | FlashArch / IA `flashgamenet` file `41_snowcraft.dcr`, marked 1998 |

## Cast / resource counts (static)

EXE movie (`docs/recovered/dir-config.txt`, `dir-cast.txt`):

- Stage 592×320, default 15 fps, Director version 1600
- Members 1–131: **82 bitmaps**, **16 sounds**, 23 scripts, 2 fields, 3 text Xtras, 1 palette
- VWSC: 328 frames, 48-byte sprite records

DCR Afterburner ABMP (`dcr-abmp-resources.json`, 263 mapped resources after the ILS fourcc):

- **82 `BITD`**, **16 `snd `**, **125 `CASt`**, **19 `Lscr`**
- Present: `VWSC`, `VWLB`, `VWFI`, `DRCF`, `CLUT`, `KEY*`, `CAS*`, `Lnam`
- `snd ` compression type 1 (not raw zlib); PCM was **not** byte-compared to the EXE WAVs in this pass

Same bitmap and sound **counts**, fewer scripts/cast records in the DCR. That is
consistent with an Afterburner / Shockwave packaging of the same game (or a
very close build), not with a rebased copy of the EXE movie.

## What this does *not* prove

- The DCR is not a byte-identical `SnowCraft.dir`.
- DCR `snd ` payloads were not inflated to PCM, so audio identity vs the 16
  EXE WAVs is count-level only.
- DCR BITDs were not decoded to PNGs; kid art in `src/assets/cast/` comes from
  the **EXE** movie’s BITDs.
- Pixel-perfect matte hits and Event Loop wall-clock remain runtime-blocked
  (see `docs/PARITY.md`).

## Reproduction (static only)

Do not run `SnowCraft.exe` or `snowcraft.dcr`.

```bash
python3 - <<'PY'
# Afterburner map: ABMP zlib at file offset 188 (1712 -> 3726 bytes).
# FGEI body zlib at offset 1905 inflates to 240387 bytes.
# Resource loop after the ILS fourcc: varint id, offset, csize, usize, u8 compression, 4-byte XFIR tag.
PY
mkdir -p /tmp/snowcraft-dxr
python3 -I tools/reference/extract_movie.py \
  docs/reference/snowcraft-original/extracted/SnowCraft.exe \
  /tmp/snowcraft-dxr/SnowCraft.dxr
python3 -I tools/reference/inspect_movie.py \
  /tmp/snowcraft-dxr/SnowCraft.dxr \
  /tmp/snowcraft-dxr/analysis
python3 tools/extract_snowcraft_sounds.py \
  docs/reference/snowcraft-original/extracted/SnowCraft.exe \
  /tmp/snowcraft-wav-check
```

`extract_movie.py` carves the `39VM` movie and rebases mmap offsets.
`inspect_movie.py` then reads the resulting `.dxr` (`XFIR` header). Neither
launches Wine.
