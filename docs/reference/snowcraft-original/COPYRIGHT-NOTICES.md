# Copyright and license notices recovered from the original SnowCraft files

Static inspection only. `SnowCraft.exe` and `snowcraft.dcr` were **not**
executed. Original archive bytes and hashes are unchanged. Strings below are
copied with original spelling, spacing, and year. **Attribution is not a
license.** Internet Archive availability is not a license.

Coverage of this pass is listed at the end. After that coverage: **no
explicit license grant, EULA, permission statement, or redistribution terms
for the SnowCraft game, art, or audio were found.**

Canonical hashes: [`SHA256MANIFEST.txt`](SHA256MANIFEST.txt),
[`SOURCE-PROVENANCE.json`](SOURCE-PROVENANCE.json). Project summary:
[`NOTICE.md`](../../../NOTICE.md).

## 1. Game-creator credits (SnowCraft / Nicholson)

These strings sit in the **embedded Director movie**, not in the Macromedia
projector VERSIONINFO. They name people and studios. They do **not** grant
rights to this remake.

### Win32 projector movie (`extracted/SnowCraft.exe`)

File SHA-256 `2103bae31937095450962c91ec025e5e49eac920d2eccf1bdd89bcae2e130b8c`.
Little-endian movie `XFIR`/`39VM` at file offset `0x306114`.

| Exact string | Location |
|---|---|
| `wells packard - Nicholson \| NY` | EXE `0x3156a5` (inside the embedded movie) |
| `wells packard - Icon Nicholson` | EXE `0x3156c5` (immediately after the previous string) |
| `\\Doc\Users\Wells\SnowCraft.dir` | EXE `0x222a61` (projector container) |
| `\\Doc\Users\Wells\` | EXE `0x3156e5` (embedded movie, after the Wells Packard strings) |
| `http://www.nny.com` | EXE `0x311e0b` |
| `http://www.nny.com/` | EXE `0x312299` |
| `mailto:wells@nny.com` | EXE `0x3121df`, `0x314a0b` |
| `0mailto:SnowCraft_Winners@nny.com, wells@nny.com` | EXE `0x314b7d` |
| `winners@nny.com` | EXE `0x31117d` (cast xtra member 129) |
| `info@nny.com` | EXE `0x31126a` (cast xtra member 130) |
| `INFO@NNY.COM` | Cast field member 91 (`source-evidence/recovered/dir-cast.txt`) |

Exact recovered credit strings as stored in the movie (not Markdown table
escapes):

```
wells packard - Nicholson | NY
wells packard - Icon Nicholson
```

Cast / score names that are credits or studio contacts, not license text
(`dir-cast.txt`):

- Member 71 script `go nny` (behavior; title logo click-through in the original)
- Member 91 field `INFO@NNY.COM`
- Members 111–112 scripts `email loosers`, `email winners`
- Members 129–130 xtras `winners@nny.com`, `info@nny.com`
- Member 131 xtra `version` (no license text in the member name)

Internal author path recovered with the movie: `\\Doc\Users\Wells\SnowCraft.dir`.

### Shockwave Afterburner movie (`extracted/snowcraft.dcr`)

File SHA-256 `dbef86d17467b9e24e6e4a4227bc9c5d7aa8c3cb12e2f4f21722a5fc68380fa9`.
Afterburner body inflated from zlib at file offset **1905** (FGEI), 240387 bytes.
Never launched a Shockwave player.

| Exact string | Location |
|---|---|
| `wells packard - Nicholson \| NY` | FGEI `0x3aa2b` |
| `Wells Packard - Nicholson NY` | FGEI `0x3aa4b` (capitalization differs from the EXE movie) |
| ` C:\WINNT\Profiles\wells\Desktop\` | FGEI after the Wells Packard strings |
| `http://www.nny.com/` | FGEI `0x376ec` |
| `mailto:wells@nny.com` | FGEI `0x3a50c` |
| `mailto:mayumi@nny.com` | FGEI `0x3779e` (not present in the EXE movie strings) |
| `2mailto:info@nny.com, kchui@nny.com, wells@nny.com` | FGEI `0x3a5c1` (`kchui@nny.com` is a mailbox string, not a spelled-out legal name) |
| `winners@nny.com` / `info@nny.com` / `INFO@NNY.COM` | FGEI cast names, same members as the EXE |

Exact recovered DCR credit strings as stored in FGEI (not Markdown table
escapes):

```
wells packard - Nicholson | NY
Wells Packard - Nicholson NY
```

The EXE and DCR movies are **not** the same bytes. Credits overlap but are not
identical (DCR has `mayumi@nny.com` and `kchui@nny.com`; EXE has
`SnowCraft_Winners@nny.com` and `Icon Nicholson`).

## 2. Visual text in recovered BITDs (no © line)

Inspected as PNGs recovered from EXE BITDs. None of these original bitmaps
contain `©`, `Copyright`, a year, or license wording.

| Member | File | Visible text (as drawn) |
|---|---|---|
| 76 (`1`) | `src/assets/cast/076_1.png` | `SnowCraft` |
| 70 (`2`) | `source-evidence/recovered/070_happy_holidays.png` (original BITD) | `Happy Holidays` / `IconMedialab` |
| 88 | `src/assets/cast/088_congratulations.png` | `Congratulations!` |
| 77 (`snowcraft_palatte`) | `src/assets/cast/077_play_again.png` | `Play Again` |

`IconMedialab` is the spelling **painted in the original bitmap**. The movie
strings use `Icon Nicholson` and `Nicholson | NY`. Both spellings are
recorded; they are not the same string.

**Runtime derivative (explicit remake exception, not a license change):**
`src/assets/cast/070_happy_holidays.png` keeps `Happy Holidays` and the
254×64 canvas, and has the `IconMedialab` lettering removed. The original
BITD with that lettering is unchanged at
`source-evidence/recovered/070_happy_holidays.png`. Credits above still
apply. This is not permission to reuse the original art.

Internet Archive item art in the EXE zip
(`snowcraft_201912/snowcraft.png`, `__ia_thumb.jpg`) is a gameplay screenshot
of kids on the snow field. **No copyright caption** is drawn on those images.

## 3. Macromedia / Director / Shockwave runtime notices

These are **projector and Xtra** notices. They are Macromedia’s runtime, not
a SnowCraft game license, and they do not put the SnowCraft art or WAVs under
Macromedia’s terms for redistribution of this remake.

### PE VERSIONINFO (`extracted/SnowCraft.exe`)

UTF-16 `VS_VERSION_INFO` at file offset `0xa446`. Fields:

| Field | Exact value |
|---|---|
| CompanyName | `Macromedia, Inc.` |
| FileDescription | `Macromedia Projector` |
| FileVersion | `8.0r178` |
| InternalName | `Projector` |
| LegalCopyright | `Copyright 1985-2000 Macromedia, Inc.` |
| LegalTrademarks | `Director is a registered trademark and Shockwave(tm) is a trademark of Macromedia, Inc.` |
| OriginalFilename | `Projector.exe` |
| ProductName | `Director 8 Shockwave Studio` |

(The LegalCopyright bytes are stored as `Copyright ` then ` 1985-2000 Macromedia, Inc.` in the VERSIONINFO string table; concatenated field value is as above.)

### Other Macromedia / Microsoft strings in the same EXE

| Exact string | Location | What it is |
|---|---|---|
| `Copyright 1989-95 MacroMedia, Inc. All rights reserved.` | EXE `0x13712c` and `0x1d112c` | Projector/Xtra ASCII notice (`MacroMedia` spelling as stored) |
| `; Copyright 1994-1997, Macromedia, Inc.  All Rights Reserved.` | EXE `0x30be46` (inside the embedded movie blob; Xtra comment) | Macromedia Xtra source comment |
| `Copyright (C) Microsoft Corp. 1981-1998` | UTF-16 in the projector | Microsoft C runtime bundled with the projector |
| `http://www.macromedia.com/` | projector ASCII | Macromedia download/site URL |
| `Macromedia Splash Screen` | projector ASCII | Projector chrome, not a game splash BITD |

Lingo property **names** `movieAboutInfo` and `movieCopyrightInfo` appear in
the projector at `0x13cbac` / `0x13cbbc`. Those are engine identifiers. No
filled SnowCraft about/copyright **value** was found next to them.

`swcopyright` at `0x1a65c` is a Shockwave player setting name in the projector
update XML, not game copyright text.

## 4. Internet Archive item metadata (not a license)

From `extracted/ia-snowcraft-201912-meta.xml`, copied from zip member
`snowcraft_201912/snowcraft_201912_meta.xml`:

| Element | Exact text |
|---|---|
| `<identifier>` | `snowcraft_201912` |
| `<mediatype>` | `software` |
| `<collection>` | `cdrom_contributions` |
| `<creator>` | `Nicholson NY` |
| `<date>` | `1999` |
| `<title>` | `SnowCraft` |
| `<subject>` | `SnowCraft` |
| `<uploader>` | `legobrett67@gmail.com` |
| `<publicdate>` | `2019-12-08 05:53:17` |
| `<scanner>` | `Internet Archive HTML5 Uploader 1.6.4` |

There is **no** `<licenseurl>`, `<rights>`, `<license>`, or Creative Commons
element in that XML.

The same zip’s `snowcraft_201912_meta.sqlite` upload headers include
`x-archive-meta01-collection: uri(open_source_software)` and
`x-archive-meta01-creator: uri(Nicholson%20NY)`. That is **uploader-supplied
Internet Archive collection tagging**. It is not a software license and is
not treated as permission to relicense SnowCraft.

`snowcraft_201912_files.xml` lists checksums and formats only (EXE, PNG,
metadata). No rights field.

## 5. DCR zip vendor README (untrusted third-party text)

Byte-for-byte copy: `extracted/vendor-dcr-readme.txt` ← zip member
`snowcraft-original/README.txt`. See [`extracted/UNTRUSTED.md`](extracted/UNTRUSTED.md).
It is **not** a license file. The complete file (1117 bytes) is quoted
below because it is the only human-authored text bundled with the DCR.
Play instructions in it are provenance text only; they were not followed.

```
Snowcraft (1998) - original Shockwave movie
===========================================

snowcraft.dcr   Adobe/Macromedia Director "Afterburner" Shockwave movie (XFIR/MDGF header), 235,392 bytes
                MD5 6c5631ca78293144ffe031dd0a75ee30

Credits:   iconNicholson, New York (per FlashArch). Home of the Underdogs credits Kevin Chiu as designer.
Source:    https://archive.org/download/flashgamenet_0-999/41_snowcraft.dcr
           (Internet Archive item "flashgamenet_0-999", file 41_snowcraft.dcr, marked "original")
Same MD5 as FlashArch's copy: https://flasharch.com/en/archive/play/6c5631ca78293144ffe031dd0a75ee30

The .ogg/.png/.afpk files in that archive.org item were left out on purpose. Archive.org
misidentified the .dcr as an MP3 and generated those files from it, so they are not game assets.

How to play
-----------
- Flashpoint Archive (https://flashpointarchive.org) includes the Shockwave plugin; import or launch the .dcr there.
- Or open it in a standalone Shockwave projector/player under Windows (or Wine).
- Modern browsers have no Shockwave plugin; Ruffle does NOT play .dcr files.
```

Notes:

- Year **1998** and spelling **Snowcraft** / **iconNicholson** are the
  README’s words, not the EXE movie’s. IA metadata says **1999** and
  **Nicholson NY**. The movie strings say **Nicholson | NY** / **Icon Nicholson**.
- “Kevin Chiu as designer” is attributed there to Home of the Underdogs /
  FlashArch, **not** to a string inside `snowcraft.dcr`. The DCR does contain
  mailbox `kchui@nny.com`. That mailbox is not the same thing as the spelled
  name in the README.
- The Source / FlashArch URLs and “How to play” lines are provenance
  pointers. They are not license grants. Do not fetch those URLs or launch
  Shockwave/Flashpoint/Wine as part of an agent run.

## 6. Sounds pack

Zip `archives/nicholson-snowcraft-1999-extracted-sounds-pack.zip` contains 16
WAVs plus `README.md` / `inventory.json` / extractor. The pack README says
copyright belongs to the original authors and the files are for reference.
That sentence is **this restoration’s note**, not a 1999 SnowCraft license
found in the projector. PCM bytes match `src/assets/sounds/`. No license
file is in the zip.

The original movie has **no music cast members**. Remake files
`src/assets/intro.mp3` and `src/assets/musicAlt.mp3` are **not** recovered
from the 1999 movie; no original copyright notice for them exists in the
EXE/DCR inspection.

## 7. What was not found

Inspected and **not present** as a license or permission grant:

- No `LICENSE`, `COPYING`, `COPYRIGHT` file in either game zip
- No Lingo or score text `All rights reserved` belonging to Nicholson / IconMedialab / Wells Packard
- No Creative Commons / MIT / GPL / public-domain dedication in the movies
- No filled `movieCopyrightInfo` value
- No © year on the title, Happy Holidays / IconMedialab, Congratulations, or Play Again BITDs
- No rights field in IA `*_meta.xml`

Therefore: **no explicit license for SnowCraft game content was found.**
Credits and Macromedia runtime notices are recorded above. They are not
converted into permission to redistribute original art, audio, EXE, or DCR.
This repository’s remake **code** (if any later license is chosen for code)
does **not** apply to original-derived assets.

## 8. Coverage of this inspection

| Source | How inspected |
|---|---|
| EXE zip member list | `zipfile` listing (exe, IA xml/sqlite/png/thumb/torrent, AppleDouble) |
| `extracted/SnowCraft.exe` | ASCII + UTF-16 string harvest; PE VERSIONINFO; offset dumps; no execution |
| Embedded `XFIR`/`39VM` movie | Same EXE bytes at `0x306114`; cast dump `dir-cast.txt` |
| DCR zip | `snowcraft.dcr` + `README.txt` |
| `extracted/snowcraft.dcr` | zlib inflate of ABMP @ 188 and FGEI @ 1905; string harvest; no Shockwave |
| IA `*_meta.xml`, `*_files.xml`, `*_meta.sqlite` | Read as files |
| IA `snowcraft.png` / `__ia_thumb.jpg` | Visual inspection |
| Recovered BITDs 70, 76, 77, 88 | Visual inspection of PNGs |
| Sounds pack README / inventory | Read as files |
| `movieAboutInfo` / `movieCopyrightInfo` | Present as projector property names only |

Remake JavaScript/CSS under `src/js/` and `src/css/` is original to this
project and is outside the 1999 notices above.
