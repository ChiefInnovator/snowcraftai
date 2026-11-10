#!/usr/bin/env python3
"""Extract original SnowCraft BITD bitmaps (kids, shadow, power, snowball,
drop, melt), Event Loop layouts, and score walk-on paths from a rebased
Director movie.

Static only — never executes the projector.

Usage:
  python3 -I tools/reference/extract_movie.py SnowCraft.exe out/SnowCraft.dxr
  python3 -I tools/reference/extract_bitmaps.py out/SnowCraft.dxr OUT_DIR

Writes OUT_DIR/bitmaps/*.png, bitmap_meta.json, layouts.json, walkon.json
"""
from __future__ import annotations

import json
import os
import re
import struct
import sys
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from inspect_movie import Movie, read_cast, read_config, read_labels, read_score, sprite, u16, u32  # noqa: E402

# Gameplay + stage UI BITDs recovered from the EXE movie (members 1–89).
# 67–68 are empty "nothing" placeholders.
# 32-bit BITDs (D4+ / Director 8) are PackBits of per-row ARGB planes, matching
# ScummVM engines/director/images.cpp BITDDecoder (version >= kFileVer400).
NEED = set(range(1, 90))


def packbits_rows(data: bytes, pitch: int, height: int):
    i = 0
    n = len(data)
    rows = []
    for _ in range(height):
        out = bytearray()
        while i < n and len(out) < pitch:
            flag = data[i]
            i += 1
            if flag > 127:
                count = 257 - flag
                if i >= n:
                    return None, i
                out.extend([data[i]] * count)
                i += 1
            else:
                count = flag + 1
                if i + count > n:
                    return None, i
                out.extend(data[i:i + count])
                i += count
        if len(out) < pitch:
            return None, i
        rows.append(bytes(out[:pitch]))
    return b"".join(rows), i


def decode8(bitd: bytes, width: int, height: int):
    even = (width + 1) & ~1
    pitches = []
    for pitch in (even, width, ((width + 3) // 4) * 4):
        if pitch > 0 and pitch not in pitches:
            pitches.append(pitch)
    for pitch in pitches:
        if len(bitd) == pitch * height:
            return b"".join(bitd[y * pitch:y * pitch + width] for y in range(height)), f"raw@{pitch}"
    for pitch in pitches:
        raw, consumed = packbits_rows(bitd, pitch, height)
        if raw is not None and consumed == len(bitd):
            return b"".join(raw[y * pitch:y * pitch + width] for y in range(height)), f"pb@{pitch}"
    return None, "fail"


def decode32(bitd: bytes, width: int, height: int):
    """Director 8 / D4+ 32-bit BITD: PackBits, one row = A,R,G,B planes of `width`.

    Alpha is unused (all 0) on SnowCraft's 32-bit text BITDs; white is the matte
    (same role as palette index 0 on the 8-bit members). ScummVM forces alpha to
    0xff and composites in 32bpp; we emit PNG alpha so Phaser matte ink matches.
    """
    pitch = width * 4
    need = pitch * height
    how = None
    pixels = None
    if len(bitd) == need:
        pixels, how = bitd, "raw-planar32"
    else:
        rows, consumed = packbits_rows(bitd, pitch, height)
        if rows is not None and consumed == len(bitd):
            pixels, how = rows, f"pb-planar32@{pitch}"
    if pixels is None:
        return None, "fail32"
    rgba = bytearray(width * height * 4)
    for y in range(height):
        base = y * pitch
        for x in range(width):
            a = pixels[base + x]
            r = pixels[base + width + x]
            g = pixels[base + 2 * width + x]
            b = pixels[base + 3 * width + x]
            if r == 255 and g == 255 and b == 255:
                a_out = 0
            elif a == 0:
                a_out = 255
            else:
                a_out = a
            o = (y * width + x) * 4
            rgba[o:o + 4] = bytes([r, g, b, a_out])
    return bytes(rgba), how


def parse_clut(blob: bytes):
    pal = []
    for i in range(min(256, len(blob) // 6)):
        r, g, b = struct.unpack_from(">HHH", blob, i * 6)
        pal.append((r >> 8, g >> 8, b >> 8))
    while len(pal) < 256:
        pal.append((0, 0, 0))
    return pal


def write_png(path, width, height, rgba):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + rgba[y * width * 4:(y + 1) * width * 4] for y in range(height))
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "wb") as handle:
        handle.write(
            b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b"")
        )


def key_table(movie: Movie):
    blob = movie.first("KEY*")
    count = struct.unpack_from("<I", blob, 4)[0]
    out = []
    pos = 12
    for _ in range(count):
        if pos + 12 > len(blob):
            break
        mmap_i, cast_i = struct.unpack_from("<II", blob, pos)
        four = blob[pos + 8:pos + 12][::-1].decode("latin1")
        out.append((mmap_i, cast_i, four))
        pos += 12
    return out


def dump_layouts(movie, names, dest):
    score = read_score(movie)
    labels = dict(read_labels(movie))
    levels = []
    for number, frame in enumerate(score["frames"], 1):
        script_mem = u16(frame, 2)
        script_list = u32(frame, 4)
        if names.get(script_mem) != "Event Loop":
            continue
        behaviors = score["behaviors"](script_list) if script_list else []
        params = "; ".join(text for _, text in behaviors if text)
        greens = []
        reds = []
        for channel in range(1, score["channels"] + 1):
            spr = sprite(frame, channel)
            if not spr["member"]:
                continue
            name = names.get(spr["member"], "")
            loc = {"ch": channel, "member": name, "x": spr["x"], "y": spr["y"]}
            if 18 <= channel <= 29 and name not in ("", "nothing"):
                greens.append(loc)
            if 30 <= channel <= 32:
                reds.append(loc)
        levels.append({"frame": number, "label": labels.get(number), "params": params,
                       "greens": greens, "reds": reds})
    with open(dest, "w") as handle:
        json.dump(levels, handle, indent=2)
        handle.write("\n")
    print(f"wrote {dest} ({len(levels)} Event Loop frames)")
    return levels


def main(src, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    movie = Movie(src)
    cfg = read_config(movie)
    cast = read_cast(movie, cfg)
    names = {member["num"]: member["name"] or f"#{member['num']}" for member in cast}
    by_num = {member["num"]: member for member in cast}
    keys = key_table(movie)
    ids = [u32(movie.first("CAS*"), i) for i in range(0, len(movie.first("CAS*")), 4)]
    bitd_for = {cast_i: mmap_i for mmap_i, cast_i, four in keys if four == "BITD"}
    clut_mmap = next((mmap_i for mmap_i, _, four in keys if four == "CLUT"), None)
    palette = parse_clut(movie.chunk(clut_mmap)) if clut_mmap is not None else [(i, i, i) for i in range(256)]

    bmp_dir = os.path.join(out_dir, "bitmaps")
    os.makedirs(bmp_dir, exist_ok=True)
    meta = []
    for num in sorted(NEED):
        member = by_num.get(num)
        if not member or member["type"] != "bitmap":
            continue
        width, height = member.get("w", 0), member.get("h", 0)
        if width <= 0 or height <= 0:
            continue
        cas_mmap = ids[num - cfg["minMember"]]
        bitd_mmap = bitd_for.get(cas_mmap)
        if not bitd_mmap:
            print("no BITD for", num, member["name"])
            continue
        raw = movie.chunk(bitd_mmap)
        rec = {
            "num": num, "name": member["name"], "w": width, "h": height,
            "reg": list(member.get("reg", (0, 0))), "depth": member.get("depth"),
        }
        depth = member.get("depth") or 8
        rec["depth"] = depth
        rgba = None
        how = None
        if depth == 32:
            rgba_bytes, how = decode32(raw, width, height)
            rec["how"] = how
            if rgba_bytes is None:
                print("decode fail", rec)
                continue
            rgba = bytearray(rgba_bytes)
        else:
            pixels, how = decode8(raw, width, height)
            rec["how"] = how
            if pixels is None:
                rgba_bytes, how = decode32(raw, width, height)
                rec["how"] = how
                if rgba_bytes is None:
                    print("decode fail", rec)
                    continue
                rgba = bytearray(rgba_bytes)
            else:
                rgba = bytearray(width * height * 4)
                for i, idx in enumerate(pixels):
                    r, g, b = palette[idx]
                    rgba[i * 4:i * 4 + 4] = bytes([r, g, b, 0 if idx == 0 else 255])
        # Cast names come from the movie file; keep them inside bmp_dir.
        slug_name = re.sub(r"[^A-Za-z0-9_-]", "_", (member["name"] or "unnamed").replace(" ", "_"))
        if num == 70:
            slug_name = "happy_holidays"
        elif num == 88:
            slug_name = "congratulations"
        slug = f"{num:03d}_{slug_name}"
        path = os.path.join(bmp_dir, slug + ".png")
        write_png(path, width, height, bytes(rgba))
        rec["file"] = os.path.basename(path)
        meta.append(rec)
        print(f"  {slug}.png {width}x{height} {how}")

    with open(os.path.join(out_dir, "bitmap_meta.json"), "w") as handle:
        json.dump(meta, handle, indent=2)
        handle.write("\n")
    dump_layouts(movie, names, os.path.join(out_dir, "layouts.json"))
    dump_walkon(movie, names, os.path.join(out_dir, "walkon.json"))


def dump_walkon(movie, names, dest):
    """Score frames from each Level N label up to (not including) Event Loop."""
    score = read_score(movie)
    labels = dict(read_labels(movie))
    level_at = {}
    for frame, name in labels.items():
        if name.startswith("Level ") and name[6:].isdigit():
            level_at[int(name[6:])] = frame
    loops = []
    for number, frame in enumerate(score["frames"], 1):
        script_mem = u16(frame, 2)
        if names.get(script_mem) == "Event Loop":
            loops.append(number)
    out = []
    for level in range(1, 11):
        start = level_at.get(level)
        if not start:
            continue
        end = next((n for n in loops if n > start), None)
        if not end:
            continue
        frames = []
        for number in range(start, end):
            fr = score["frames"][number - 1]
            kids = []
            for channel in range(12, 33):
                spr = sprite(fr, channel)
                if not spr["member"]:
                    continue
                name = names.get(spr["member"], "")
                if name in ("", "nothing"):
                    continue
                kids.append({
                    "ch": channel, "member": name,
                    "x": spr["x"], "y": spr["y"], "ink": spr["ink"]
                })
            frames.append({"frame": number, "kids": kids})
        out.append({"level": level, "startFrame": start, "eventLoopFrame": end, "frames": frames})
    with open(dest, "w") as handle:
        json.dump(out, handle, indent=2)
        handle.write("\n")
    print(f"wrote {dest} ({len(out)} level walk-ons)")
    return out


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
