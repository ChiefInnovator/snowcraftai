#!/usr/bin/env bash
# Reproducibly extract + decompile the original SnowCraft Director movie.
# Outputs (all under reference/, which is gitignored):
#   reference/extracted/SnowCraft.dxr          movie carved from the projector, memory map rebased
#   reference/extracted/decompiled/            ProjectorRays output (.dir + Lingo .ls/.lasm)
#   reference/analysis/{config,cast,labels,score}.txt   metadata dump (no bitmaps/sounds)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REF="$ROOT/reference"
TOOLS="$REF/tools"
PR="$TOOLS/ProjectorRays/projectorrays"

if [[ ! -x "$PR" ]]; then
  brew list boost >/dev/null 2>&1 || brew install boost
  brew list mpg123 >/dev/null 2>&1 || brew install mpg123
  mkdir -p "$TOOLS"
  [[ -d "$TOOLS/ProjectorRays" ]] || git clone https://github.com/ProjectorRays/ProjectorRays.git "$TOOLS/ProjectorRays"
  BREW="$(brew --prefix)"
  make -C "$TOOLS/ProjectorRays" -j8 \
    CPPFLAGS="-I$BREW/include -DVERSION_NUMBER=0.2.1 -DGIT_SHA=$(git -C "$TOOLS/ProjectorRays" rev-parse --short HEAD)" \
    LDFLAGS="-L$BREW/lib"
fi

mkdir -p "$REF/extracted/decompiled" "$REF/analysis"
python3 -I "$ROOT/tools/reference/extract_movie.py" "$REF/snowcraft_201912/SnowCraft.exe" "$REF/extracted/SnowCraft.dxr"
"$PR" version "$REF/extracted/SnowCraft.dxr"
"$PR" decompile "$REF/extracted/SnowCraft.dxr" -o "$REF/extracted/decompiled" --dump-scripts
python3 -I "$ROOT/tools/reference/inspect_movie.py" "$REF/extracted/SnowCraft.dxr" "$REF/analysis"
