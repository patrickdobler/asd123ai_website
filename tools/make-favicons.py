#!/usr/bin/env python3
"""Generate the site favicons from public/logo.png.

The logo is black on a transparent background, which is invisible on dark
browser tabs. So every favicon places the logo on a rounded box tinted in the
site's light background colour (#e4e4dc). The logo's transparent margins are
trimmed first so it fills the box (otherwise it looks like a tiny dot at 16px).
Re-run after changing the logo:  python3 tools/make-favicons.py
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
LOGO = os.path.join(PUBLIC, "logo.png")

BG = (228, 228, 220, 255)  # --bg-color #e4e4dc (site light theme)

_logo_full = Image.open(LOGO).convert("RGBA")
_bbox = _logo_full.getbbox()           # trim transparent margins -> content only
logo = _logo_full.crop(_bbox) if _bbox else _logo_full


def make(size, pad_ratio=0.08, radius_ratio=0.22):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # Rounded-rect background in the site's light colour.
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255
    )
    canvas = Image.composite(Image.new("RGBA", (size, size), BG), canvas, mask)
    # Fit the logo into the padded inner box, preserving aspect ratio, centered.
    inner = size * (1 - 2 * pad_ratio)
    lw, lh = logo.size
    scale = inner / max(lw, lh)
    nw, nh = max(1, round(lw * scale)), max(1, round(lh * scale))
    resized = logo.resize((nw, nh), Image.LANCZOS)
    canvas.alpha_composite(resized, ((size - nw) // 2, (size - nh) // 2))
    return canvas


def out(name):
    return os.path.join(PUBLIC, name)


make(512).save(out("favicon-512.png"))
make(180).save(out("apple-touch-icon.png"))
make(32, pad_ratio=0.07, radius_ratio=0.20).save(out("favicon-32.png"))
make(16, pad_ratio=0.05, radius_ratio=0.16).save(out("favicon-16.png"))
# Multi-resolution .ico for classic favicon support.
make(256).save(out("favicon.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

print("Favicons written to", PUBLIC)
