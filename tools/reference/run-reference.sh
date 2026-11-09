#!/usr/bin/env bash
# Run the original 1999 SnowCraft (Macromedia Director 8 Windows projector) on macOS.
#
# Default: Wine (Gcenx macOS build, x86_64 under Rosetta 2, 32-bit exe via wow64)
#          with an isolated prefix in reference/wineprefix. Full game + sound.
# ScummVM is intentionally not supported: it hangs on this game and has no D8 sound.
#
# Usage: tools/reference/run-reference.sh [extra args]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REF="$ROOT/reference"
GAME_DIR="$REF/snowcraft_201912"
WINE_VERSION="11.21"   # github.com/Gcenx/macOS_Wine_builds release tag

if [[ ! -f "$GAME_DIR/SnowCraft.exe" ]]; then
  echo "Missing $GAME_DIR/SnowCraft.exe (reference/ is gitignored; copy the archive.org snowcraft_201912 files there)." >&2
  exit 1
fi

# --- Wine ---
if ! arch -x86_64 /usr/bin/true 2>/dev/null; then
  echo "Rosetta 2 is required: softwareupdate --install-rosetta --agree-to-license" >&2
  exit 1
fi

WINE_BIN=""
if command -v wine >/dev/null 2>&1; then
  WINE_BIN="$(dirname "$(command -v wine)")"
else
  LOCAL_APP="$REF/tools/wine/Wine Devel.app"
  if [[ ! -x "$LOCAL_APP/Contents/Resources/wine/bin/wine" ]]; then
    # Homebrew's wine casks are disabled (Gatekeeper), so fetch the same build directly.
    echo "Downloading Wine $WINE_VERSION (Gcenx macOS build, ~225 MB) into reference/tools/wine ..." >&2
    mkdir -p "$REF/tools/wine"
    TARBALL="$REF/tools/wine/wine-devel-$WINE_VERSION-osx64.tar.xz"
    if command -v gh >/dev/null 2>&1; then
      gh release download "$WINE_VERSION" -R Gcenx/macOS_Wine_builds \
        -p "wine-devel-$WINE_VERSION-osx64.tar.xz" -D "$REF/tools/wine" --clobber
    else
      curl -fL -o "$TARBALL" \
        "https://github.com/Gcenx/macOS_Wine_builds/releases/download/$WINE_VERSION/wine-devel-$WINE_VERSION-osx64.tar.xz"
    fi
    tar -xJf "$TARBALL" -C "$REF/tools/wine"
    rm -f "$TARBALL"
    xattr -dr com.apple.quarantine "$LOCAL_APP" 2>/dev/null || true
  fi
  WINE_BIN="$LOCAL_APP/Contents/Resources/wine/bin"
fi

export WINEPREFIX="$REF/wineprefix"
export WINEDEBUG="${WINEDEBUG:--all}"
if [[ ! -d "$WINEPREFIX/drive_c" ]]; then
  echo "Creating Wine prefix at $WINEPREFIX ..." >&2
  "$WINE_BIN/wineboot" -i >/dev/null 2>&1
fi

cd "$GAME_DIR"
exec "$WINE_BIN/wine" SnowCraft.exe "$@"
