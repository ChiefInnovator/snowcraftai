#!/usr/bin/env python3
"""Dump metadata from a Director 7/8 little-endian movie (XFIR/39VM) produced
by extract_movie.py: stage config, cast member list (number, name, type,
bitmap size + registration point), frame labels, and the decoded score
(sprite channels, positions, ink, blend, attached behaviors + parameters).

It never writes bitmap or sound data — metadata only.

Usage: python3 -I inspect_movie.py SnowCraft.dxr OUT_DIR
Writes OUT_DIR/config.txt, cast.txt, labels.txt, score.txt
"""
import os
import struct
import sys

CAST_TYPES = {1: "bitmap", 2: "filmloop", 3: "field", 4: "palette", 5: "picture",
              6: "sound", 7: "button", 8: "shape", 9: "movie", 10: "digitalvideo",
              11: "script", 12: "text", 13: "ole", 14: "transition", 15: "xtra"}
SCRIPT_TYPES = {1: "behavior", 3: "movie", 7: "parent"}
INKS = {0: "copy", 1: "transparent", 2: "reverse", 3: "ghost", 4: "notCopy", 8: "matte",
        9: "mask", 32: "blend", 33: "addPin", 35: "lightest", 36: "background transparent",
        37: "lighten", 38: "subtract", 39: "darkest", 40: "darken", 41: "lighten"}

MAIN_CH = 288   # D7+ main channel block (6 x 48)
SPR_CH = 48     # D7+ sprite channel record


def u32le(b, o): return struct.unpack_from("<I", b, o)[0]
def u32(b, o): return struct.unpack_from(">I", b, o)[0]
def u16(b, o): return struct.unpack_from(">H", b, o)[0]
def i16(b, o): return struct.unpack_from(">h", b, o)[0]


class Movie:
    def __init__(self, path):
        self.d = open(path, "rb").read()
        assert self.d[:4] == b"XFIR" and self.d[8:12] == b"39VM"
        mmap_off = u32le(self.d, 24)
        hdr_len, entry_len = struct.unpack_from("<hh", self.d, mmap_off + 8)
        used = struct.unpack_from("<i", self.d, mmap_off + 16)[0]
        self.entries = []
        p = mmap_off + 8 + hdr_len
        for i in range(used):
            fourcc = self.d[p:p + 4][::-1].decode("latin1")
            ln, off = struct.unpack_from("<II", self.d, p + 4)
            self.entries.append((fourcc, ln, off))
            p += entry_len

    def chunk(self, idx):
        fourcc, ln, off = self.entries[idx]
        return self.d[off + 8: off + 8 + ln]

    def first(self, fourcc):
        for i, e in enumerate(self.entries):
            if e[0] == fourcc:
                return self.chunk(i)
        return None


def read_config(m):
    c = m.first("DRCF")
    top, left, bottom, right = (i16(c, o) for o in (4, 6, 8, 10))
    return {"stage": (right - left, bottom - top), "stageRect": (left, top, right, bottom),
            "minMember": i16(c, 12), "maxMember": i16(c, 14),
            "frameRate": i16(c, 54), "directorVersion": i16(c, 36)}


def read_info_list(b):
    """ListChunk: dataOffset(u32) ... at dataOffset: u16 count, u32 offsets[count], u32 len, items."""
    if len(b) < 4:
        return []
    off = u32(b, 0)
    if off + 2 > len(b):
        return []
    n = u16(b, off)
    offs = [u32(b, off + 2 + 4 * i) for i in range(n)]
    base = off + 2 + 4 * n + 4
    items = []
    for i in range(n):
        end = offs[i + 1] if i + 1 < n else len(b) - base
        items.append(b[base + offs[i]: base + end])
    return items


def read_cast(m, cfg):
    cas = m.first("CAS*")
    ids = [u32(cas, i) for i in range(0, len(cas), 4)]
    members = []
    for i, sec in enumerate(ids):
        if sec == 0:
            continue
        num = cfg["minMember"] + i
        b = m.chunk(sec)
        typ, info_len, spec_len = u32(b, 0), u32(b, 4), u32(b, 8)
        info = b[12:12 + info_len]
        spec = b[12 + info_len: 12 + info_len + spec_len]
        items = read_info_list(info)
        name = ""
        if len(items) > 1 and items[1]:
            name = items[1][1:1 + items[1][0]].decode("latin1")
        row = {"num": num, "name": name, "type": CAST_TYPES.get(typ, str(typ))}
        if typ == 1 and len(spec) >= 26:
            top, left, bottom, right = (i16(spec, o) for o in (2, 4, 6, 8))
            reg_y, reg_x = i16(spec, 18), i16(spec, 20)
            depth = spec[23] if len(spec) > 23 else 0
            row.update(w=right - left, h=bottom - top, reg=(reg_x - left, reg_y - top), depth=depth)
        elif typ == 11 and len(spec) >= 2:
            row["scriptType"] = SCRIPT_TYPES.get(u16(spec, 0), u16(spec, 0))
        elif typ in (3, 12):
            row["detail"] = f"{len(spec)} bytes spec"
        members.append(row)
    return members


def read_labels(m):
    b = m.first("VWLB")
    if not b:
        return []
    n = u16(b, 0)
    pairs = [(u16(b, 2 + 4 * i), u16(b, 4 + 4 * i)) for i in range(n + 1)]
    base = 2 + 4 * (n + 1)
    out = []
    for i in range(n):
        frame, so = pairs[i]
        eo = pairs[i + 1][1]
        out.append((frame, b[base + so: base + eo].decode("latin1")))
    return out


def read_score(m):
    b = m.first("VWSC")
    list_start = u32(b, 8)
    num_entries, list_size = u32(b, list_start), u32(b, list_start + 4)
    index_start = list_start + 12
    data_off = index_start + list_size * 4
    offs = [u32(b, index_start + 4 * i) for i in range(list_size)]

    def detail(i):
        if i <= 0 or i + 1 >= len(offs):
            return b""
        return b[data_off + offs[i]: data_off + offs[i + 1]]

    p = data_off + offs[0]
    frames_size = u32(b, p)
    hdr = b[p:p + 20]
    _, _, nframes, fver, rec, nch = struct.unpack(">IIIHHH", hdr[:18])
    p += 20
    end = data_off + offs[0] + frames_size
    buf = bytearray(MAIN_CH + SPR_CH * (nch + 2))
    frames = []
    while p < end:
        fsize = u16(b, p)
        if fsize == 0:
            break
        q, fend = p + 2, p + fsize
        while q < fend:
            csize, coff = u16(b, q), u16(b, q + 2)
            buf[coff:coff + csize] = b[q + 4:q + 4 + csize]
            q += 4 + csize
        frames.append(bytes(buf))
        p = fend

    def behaviors(list_idx):
        out = []
        raw = detail(list_idx + 1)
        for k in range(0, len(raw) - 7, 8):
            lib, mem, init = u16(raw, k), u16(raw, k + 2), u32(raw, k + 4)
            params = detail(init).decode("latin1").strip("\x00") if init else ""
            out.append((mem, params))
        return out

    return {"nframes": nframes, "version": fver, "recSize": rec, "channels": nch,
            "frames": frames, "behaviors": behaviors}


def sprite(fr, ch):
    o = MAIN_CH + (ch - 1) * SPR_CH
    r = fr[o:o + SPR_CH]
    return {"type": r[0], "ink": r[1] & 0x3F, "member": u16(r, 6), "list": u32(r, 8),
            "y": i16(r, 12), "x": i16(r, 14), "h": i16(r, 16), "w": i16(r, 18),
            "flags": r[20], "blend": r[21]}


def main(src, out):
    os.makedirs(out, exist_ok=True)
    m = Movie(src)
    cfg = read_config(m)
    cast = read_cast(m, cfg)
    names = {c["num"]: c["name"] or f"#{c['num']}" for c in cast}
    labels = read_labels(m)
    sc = read_score(m)

    with open(os.path.join(out, "config.txt"), "w") as f:
        for k, v in cfg.items():
            f.write(f"{k}: {v}\n")
        f.write(f"score: {len(sc['frames'])} frames decoded (header says {sc['nframes']}), "
                f"framesVersion {sc['version']}, spriteRecord {sc['recSize']}, channels {sc['channels']}\n")

    with open(os.path.join(out, "cast.txt"), "w") as f:
        for c in cast:
            extra = ""
            if c["type"] == "bitmap":
                extra = f"{c['w']}x{c['h']} reg={c['reg']} depth={c['depth']}"
            elif c["type"] == "script":
                extra = str(c.get("scriptType", ""))
            f.write(f"{c['num']:4d}  {c['type']:<8} {c['name']:<24} {extra}\n")

    with open(os.path.join(out, "labels.txt"), "w") as f:
        for fr, name in labels:
            f.write(f"{fr:4d}  {name}\n")

    label_at = dict(labels)
    with open(os.path.join(out, "score.txt"), "w") as f:
        prev = None
        for n, fr in enumerate(sc["frames"], 1):
            script_mem = u16(fr, 2)
            script_list = u32(fr, 4)
            tempo = fr[48 + 6]
            snd1, snd2 = u16(fr, 192 + 2), u16(fr, 144 + 2)
            sprites = []
            for ch in range(1, sc["channels"] + 1):
                s = sprite(fr, ch)
                if s["member"]:
                    beh = sc["behaviors"](s["list"]) if s["list"] else []
                    sprites.append((ch, s, beh))
            key = (script_mem, tempo, u16(fr, 52), snd1, snd2,
                   tuple((ch, s["member"], s["x"], s["y"], s["ink"], s["blend"]) for ch, s, _ in sprites))
            if key == prev and n not in label_at:
                continue
            prev = key
            head = f"--- frame {n}"
            if n in label_at:
                head += f"  [label: {label_at[n]}]"
            f.write(head + "\n")
            if script_mem:
                beh = sc["behaviors"](script_list) if script_list else []
                params = "; ".join(p for _, p in beh if p)
                f.write(f"  script: {names.get(script_mem, script_mem)}  {params}\n")
            if tempo:
                cue = u16(fr, 48 + 4)
                meaning = {246: f"{cue} fps", 247: f"wait {cue} s", 248: "wait for click",
                           254: "wait for sound 2", 255: "wait for sound 1"}.get(tempo, f"raw {tempo}")
                f.write(f"  tempo: {meaning}\n")
            for lab, snd in (("sound1", snd1), ("sound2", snd2)):
                if snd:
                    f.write(f"  {lab}: {names.get(snd, snd)}\n")
            for ch, s, beh in sprites:
                bnames = ", ".join(names.get(mm, str(mm)) + (f" {p}" if p else "") for mm, p in beh)
                f.write(f"  ch{ch:<3} {names.get(s['member'], s['member']):<20} loc=({s['x']},{s['y']}) "
                        f"ink={INKS.get(s['ink'], s['ink'])} blend={s['blend']}"
                        + (f"  behaviors: {bnames}" if bnames else "") + "\n")
    print(f"wrote {out}/config.txt cast.txt labels.txt score.txt "
          f"({len(cast)} members, {len(labels)} labels, {len(sc['frames'])} frames)")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
