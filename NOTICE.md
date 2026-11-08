# Notice

Snowcraft Reforged is a browser remake of **SnowCraft** (1999, Nicholson NY / IconMedialab).

## Third-party material

- **Sprites and images in `src/assets/`** (`player.png`, `enemy.png`, `playField.png`, `shadow.png`, `snowball*.png`, `splash.png`, `sink.png`, `puddle.png`, `smallHand.png`, and recovered BITD members in `src/assets/cast/` — `power_0`–`power_8`, `snowball`, `drop_*`, `splat`, `melt_*`) are derived from the original SnowCraft. Copyright remains with the original authors.
- **Original sound effects** in `src/assets/sounds/` (16 WAVs extracted from `SnowCraft.exe`; PCM is byte-exact, re-wrapped as WAV). Copyright remains with the original authors.
- **Music** (`src/assets/intro.mp3`, `src/assets/musicAlt.mp3`): source and license to be recorded here.

> **Permission:** _TODO — record the rights holder's permission for the material above (who granted it, when, and its scope)._

## Original to this project

- All code in `src/js/`, `src/css/`, `tools/`, and `.github/`.
- Synthesized extras in `src/assets/sfx/` (`tools/sfx/generate_sfx.py`); the live game uses the original WAVs in `src/assets/sounds/`.

Byte-for-byte original-game archives (Win32 projector zip, Shockwave DCR zip, extracted-sounds pack) are stored as **evidence** under `docs/reference/snowcraft-original/` with a SHA-256 manifest. Copyright remains with the original authors; inclusion is not a redistribution license. Runtime audio is `src/assets/sounds/`; the docs copies are archives and methodology, not a second live asset tree. A gitignored root `reference/` folder may still be used as a local Wine/decompile workspace. Do not execute the EXE or DCR from an agent run. No credentials are stored in those archives.
