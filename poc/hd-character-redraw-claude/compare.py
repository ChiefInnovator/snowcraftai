"""Side-by-side sheet: original vs redrawn frames at gameplay sizes and enlarged.

Usage: uv run --with pillow python3 poc/hd-character-redraw-claude/compare.py OUT.png 005_R_ready 024_G_ready
Original pixels are shown nearest-neighbour (as the game's Original mode draws them).
Redrawn frames are downsampled from the HD PNG, as the browser does in High resolution.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
CAST = ROOT / "web/assets/cast"
HD = Path(__file__).resolve().parent / "png"
FIELD = Image.open(ROOT / "web/assets/playField.png").convert("RGBA")
GAP, LABEL_H = 24, 26
SIZES = [1, 2, 3]  # gameplay render scales (1x logical stage, typical 2x/3x displays)
DETAIL = 10


def font(size):
    for f in ["/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"]:
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


def snow_bg(w, h):
    tile = FIELD.crop((220, 120, 220 + 60, 120 + 60))
    bg = Image.new("RGBA", (w, h))
    big = tile.resize((60 * 4, 60 * 4), Image.NEAREST)
    for y in range(0, h, big.height):
        for x in range(0, w, big.width):
            bg.paste(big, (x, y))
    return bg


def checker(w, h, s=8):
    bg = Image.new("RGBA", (w, h), (235, 235, 235, 255))
    d = ImageDraw.Draw(bg)
    for y in range(0, h, s):
        for x in range(0, w, s):
            if (x // s + y // s) % 2:
                d.rectangle([x, y, x + s - 1, y + s - 1], fill=(200, 200, 200, 255))
    return bg


def variants(name):
    orig = Image.open(CAST / f"{name}.png").convert("RGBA")
    hd = Image.open(HD / f"{name}.png").convert("RGBA")
    w, h = orig.size
    cells = []
    for s in SIZES:
        cells.append((f"{s}x", orig.resize((w * s, h * s), Image.NEAREST), hd.resize((w * s, h * s), Image.LANCZOS), "snow"))
    cells.append((f"detail {DETAIL}x", orig.resize((w * DETAIL, h * DETAIL), Image.NEAREST), hd.resize((w * DETAIL, h * DETAIL), Image.LANCZOS), "checker"))
    return cells


def main():
    out, names = sys.argv[1], sys.argv[2:]
    f_title, f_label = font(20), font(14)
    blocks = []
    for name in names:
        cells = variants(name)
        col_w = [max(o.width, r.width) for _, o, r, _ in cells]
        row_h = max(o.height for _, o, _, _ in cells)
        W = 150 + sum(c + GAP + 16 for c in col_w) + GAP
        H = (row_h + LABEL_H + GAP + 16) * 2 + 40
        blk = Image.new("RGBA", (W, H), (24, 31, 48, 255))
        d = ImageDraw.Draw(blk)
        d.text((GAP, 10), name.replace("_", " "), font=f_title, fill=(255, 255, 255, 255))
        for r, label in enumerate(["Original", "Redrawn"]):
            y = 40 + r * (row_h + LABEL_H + GAP + 16)
            d.text((GAP, y + row_h // 2), label, font=f_title, fill=(200, 220, 255, 255))
            x = 150
            for i, (cap, o, hd, bgkind) in enumerate(cells):
                im = o if r == 0 else hd
                pad = 8
                bg = (snow_bg if bgkind == "snow" else checker)(im.width + pad * 2, im.height + pad * 2)
                bg.alpha_composite(im, (pad, pad))
                blk.paste(bg, (x, y))
                d.text((x, y + im.height + pad * 2 + 4), cap, font=f_label, fill=(180, 190, 210, 255))
                x += col_w[i] + GAP + pad * 2
        blocks.append(blk)
    W = max(b.width for b in blocks)
    sheet = Image.new("RGBA", (W, sum(b.height for b in blocks)), (24, 31, 48, 255))
    y = 0
    for b in blocks:
        sheet.paste(b, (0, y))
        y += b.height
    sheet.save(out)
    print(out, sheet.size)


if __name__ == "__main__":
    main()
