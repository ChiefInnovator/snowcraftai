#!/usr/bin/env python3
"""Carve the embedded Director movie (XFIR/39VM) out of a Windows Director
projector and rebase its memory map so standalone tools (ProjectorRays,
ScummVM) can read it.

Usage: python3 -I extract_movie.py SnowCraft.exe out/SnowCraft.dxr
"""
import re
import struct
import sys


def main(src, dst):
    data = open(src, "rb").read()
    movies = [m.start() for m in re.finditer(rb"XFIR....39VM", data, re.S)]
    if not movies:
        sys.exit("no little-endian Director movie (XFIR/39VM) found")
    base = movies[0]
    size = struct.unpack_from("<I", data, base + 4)[0]
    movie = bytearray(data[base:base + 8 + size])

    # imap chunk at offset 12: 'pami' len version mmapOffset ...
    assert movie[12:16] == b"pami"
    mmap_off = struct.unpack_from("<I", movie, 24)[0]
    struct.pack_into("<I", movie, 24, mmap_off - base)
    m = mmap_off - base
    assert movie[m:m + 4] == b"pamm", "mmap not where imap says"
    hdr_len, entry_len = struct.unpack_from("<hh", movie, m + 8)
    count_max, count_used = struct.unpack_from("<ii", movie, m + 12)
    p = m + 8 + hdr_len
    rebased = 0
    for _ in range(count_used):
        off = struct.unpack_from("<I", movie, p + 8)[0]
        if off >= base:
            struct.pack_into("<I", movie, p + 8, off - base)
            rebased += 1
        p += entry_len
    open(dst, "wb").write(movie)
    print(f"movie @0x{base:x} size {len(movie)} bytes, rebased {rebased}/{count_used} chunks -> {dst}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
