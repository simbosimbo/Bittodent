#!/usr/bin/env python3
"""Side-by-side 'Sebelum' / 'Sesudah' of the root smoothing pass (upper molar + upper incisor, buccal @320)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BEFORE = ROOT / "preview" / "roots-before"
AFTER = ROOT / "3d-blender" / "buccal"
OUT = ROOT / "preview" / "roots-before-after.png"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
S = 2  # upscale for legibility

def font(sz):
    try:
        return ImageFont.truetype(FONT, sz)
    except OSError:
        return ImageFont.load_default()

pairs = [("Molar atas (16)", "molar-upper@320.webp"), ("Insisor atas (11)", "incisor-upper@320.webp")]
tiles = []
for title, fn in pairs:
    b = Image.open(BEFORE / fn).convert("RGBA"); a = Image.open(AFTER / fn).convert("RGBA")
    b = b.resize((b.width * S, b.height * S), Image.LANCZOS); a = a.resize((a.width * S, a.height * S), Image.LANCZOS)
    tiles.append((title, b, a))
pad, head, lab = 36, 56, 44
W = pad + sum(b.width + a.width + pad * 3 for _, b, a in tiles)
H = head + lab + max(max(b.height, a.height) for _, b, a in tiles) + pad
im = Image.new("RGBA", (W, H), (255, 255, 255, 255)); d = ImageDraw.Draw(im)
x = pad
for title, b, a in tiles:
    d.text((x, 16), title, fill=(31, 41, 55), font=font(26))
    for label, t in (("Sebelum", b), ("Sesudah", a)):
        d.text((x + t.width // 2, head + 8), label, fill=(75, 85, 99), font=font(24), anchor="mt")
        d.rounded_rectangle((x - 8, head + lab - 6, x + t.width + 8, head + lab + t.height + 6), 14, fill=(248, 250, 252), outline=(229, 231, 235), width=2)
        im.alpha_composite(t, (x, head + lab))
        x += t.width + pad
    x += pad
im.convert("RGB").save(OUT)
print(OUT)
