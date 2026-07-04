#!/usr/bin/env python3
"""Generate public/og-image.png (1200x630 social share card).

Matches the site's E-Ink paper aesthetic: paper background, the black logo on
a white rounded box, wordmark + tagline + tool list. The black-on-transparent
logo.png alone is invisible on dark social cards, hence this branded card.

Needs the Inter TTFs (not committed). Fetch them, then run:
  curl -s "https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900" \
    | grep -o "https://[^)]*"   # download to FONT_DIR as inter-400/700/900.ttf
  FONT_DIR=/path/to/ttfs python3 tools/make-og-image.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
FONT_DIR = os.environ.get("FONT_DIR", os.path.join(ROOT, "tools", "og-fonts"))

W, H = 1200, 630
BG = (228, 228, 220, 255)        # --bg-color
PAPER = (240, 240, 232, 255)     # --paper-texture
INK = (10, 10, 10, 255)          # --text-primary
INK_SOFT = (58, 58, 58, 255)     # --text-secondary
BORDER = (60, 60, 60, 90)

font_900 = ImageFont.truetype(os.path.join(FONT_DIR, "inter-900.ttf"), 96)
font_700 = ImageFont.truetype(os.path.join(FONT_DIR, "inter-700.ttf"), 40)
font_400 = ImageFont.truetype(os.path.join(FONT_DIR, "inter-400.ttf"), 30)

img = Image.new("RGBA", (W, H), BG)
draw = ImageDraw.Draw(img)

# Subtle inner frame, like the site's glass cards.
draw.rounded_rectangle([28, 28, W - 28, H - 28], radius=24, outline=BORDER, width=2, fill=PAPER)

# Logo on a white rounded box (logo is black on transparent).
logo_full = Image.open(os.path.join(PUBLIC, "logo.png")).convert("RGBA")
bbox = logo_full.getbbox()
logo = logo_full.crop(bbox) if bbox else logo_full
BOX = 150
logo_box = Image.new("RGBA", (BOX, BOX), (0, 0, 0, 0))
mask = Image.new("L", (BOX, BOX), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, BOX - 1, BOX - 1], radius=32, fill=255)
white = Image.new("RGBA", (BOX, BOX), (255, 255, 255, 255))
logo_box.paste(white, (0, 0), mask)
inner = BOX - 2 * 24
scale = min(inner / logo.width, inner / logo.height)
resized = logo.resize((int(logo.width * scale), int(logo.height * scale)), Image.LANCZOS)
logo_box.alpha_composite(resized, ((BOX - resized.width) // 2, (BOX - resized.height) // 2))
img.alpha_composite(logo_box, (80, 80))

# Wordmark next to the logo box, vertically centered on it.
wm = "ASD123.ai"
wm_bbox = draw.textbbox((0, 0), wm, font=font_900)
draw.text((80 + BOX + 40, 80 + (BOX - (wm_bbox[3] - wm_bbox[1])) // 2 - wm_bbox[1]), wm, font=font_900, fill=INK)

# Tagline.
draw.text((84, 320), "Private AI text tools —", font=font_700, fill=INK)
draw.text((84, 372), "100% in your browser, nothing leaves your device.", font=font_700, fill=INK_SOFT)

# Tool list, two lines, dot-separated.
tools_1 = "Optimizer  ·  Anonymizer  ·  Local AI Chat"
tools_2 = "Context Estimator  ·  Markdown Converter  ·  Text to Speech"
draw.text((84, 478), tools_1, font=font_400, fill=INK_SOFT)
draw.text((84, 520), tools_2, font=font_400, fill=INK_SOFT)

out = os.path.join(PUBLIC, "og-image.png")
img.convert("RGB").save(out, "PNG", optimize=True)
print(f"wrote {out} ({os.path.getsize(out)} bytes)")
