#!/usr/bin/env python3
"""Generate Bitto odontogram SVG assets (2D five-surface chart + soft 3D graphical chart).

2D chart: no raster, filters, or gradients.
3D chart: simple linear/radial gradients and a soft highlight/shadow are allowed;
still no raster and no heavy filters.

Re-run from this folder:
    python3 generate.py
    python3 generate.py --no-preview   # SVGs only
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LEGEND_VERSION = "0.2.0"
CHROME = "/usr/bin/google-chrome"

# ---------------------------------------------------------------------------
# Palette — WCAG 2.2 non-text contrast >= 3:1 against #FFFFFF (checked below)
# ---------------------------------------------------------------------------
INK = "#1F2937"
INK_SOFT = "#4B5563"
LINE = "#6B7280"
RULE = "#D1D5DB"
PAPER = "#FFFFFF"
PAPER_SOFT = "#F8FAFC"
DRAFT = "#6D28D9"
DRAFT_WASH = "#F3EEFF"
AMBER = "#A15C00"
LOCK = "#111827"

CONDITIONS = {
    "sehat": {
        "label": "Sehat",
        "color": "#0B7A45",
        "applies-to": "surface",
        "glyph": "legend/sehat.svg",
        "mark": "check",
    },
    "karies": {
        "label": "Karies",
        "color": "#BE123C",
        "applies-to": "surface",
        "glyph": "legend/karies.svg",
        "mark": "dots",
    },
    "tambalan": {
        "label": "Tambalan",
        "color": "#1E40AF",
        "applies-to": "surface",
        "glyph": "legend/tambalan.svg",
        "mark": "solid",
    },
    "mahkota": {
        "label": "Mahkota",
        "color": "#6D28D9",
        "applies-to": "whole-tooth",
        "glyph": "legend/mahkota.svg",
        "mark": "ring",
    },
    "hilang": {
        "label": "Hilang",
        "color": "#3F3F46",
        "applies-to": "whole-tooth",
        "glyph": "legend/hilang.svg",
        "mark": "x",
    },
    "sisa_akar": {
        "label": "Sisa akar / akar tertinggal",
        "color": "#9A3412",
        "applies-to": "whole-tooth",
        "glyph": "legend/sisa_akar.svg",
        "mark": "root-v",
    },
    "perlu_dicabut": {
        "label": "Perlu dicabut",
        "color": "#A15C00",
        "applies-to": "whole-tooth",
        "glyph": "legend/perlu_dicabut.svg",
        "mark": "slash",
    },
    "implan": {
        "label": "Implan",
        "color": "#0F5F63",
        "applies-to": "whole-tooth",
        "glyph": "legend/implan.svg",
        "mark": "screw",
    },
}

# Procedure status — separate from condition colour+shape.
# Kemungkinan MVP, menunggu persetujuan Jerome.
STATUSES = {
    "kondisi": {
        "label": "Kondisi",
        "visual": "Default watch mark: small solid disk in the corner, full opacity.",
        "marker": "disk",
        "fill-opacity": 1.0,
        "outline": "solid",
        "color": "#374151",
    },
    "sudah_ada_sini": {
        "label": "Sudah ada (di sini)",
        "visual": "Small filled square marker, full opacity, solid outline.",
        "marker": "square-filled",
        "fill-opacity": 1.0,
        "outline": "solid",
        "color": "#0B7A45",
    },
    "sudah_ada_lain": {
        "label": "Sudah ada (di tempat lain)",
        "visual": "Small open square marker, slightly reduced opacity.",
        "marker": "square-open",
        "fill-opacity": 0.7,
        "outline": "solid",
        "color": "#1E40AF",
    },
    "direncanakan": {
        "label": "Direncanakan",
        "visual": "Small triangle marker, reduced opacity, dashed outline.",
        "marker": "triangle",
        "fill-opacity": 0.5,
        "outline": "dashed",
        "color": "#A15C00",
    },
    "selesai": {
        "label": "Selesai",
        "visual": "Small check marker, full opacity, solid outline.",
        "marker": "check",
        "fill-opacity": 1.0,
        "outline": "solid",
        "color": "#0F5F63",
    },
    "dirujuk": {
        "label": "Dirujuk",
        "visual": "Small arrow marker, slightly reduced opacity, dotted outline.",
        "marker": "arrow",
        "fill-opacity": 0.8,
        "outline": "dotted",
        "color": "#6D28D9",
    },
}


FONT = "Inter, IBM Plex Sans, Liberation Sans, system-ui, sans-serif"
FONT_NUM = "Inter, IBM Plex Sans, Liberation Sans, system-ui, sans-serif"

PERMANENT = {
    1: list(range(11, 19)),
    2: list(range(21, 29)),
    3: list(range(31, 39)),
    4: list(range(41, 49)),
}
PRIMARY = {
    5: list(range(51, 56)),
    6: list(range(61, 66)),
    7: list(range(71, 76)),
    8: list(range(81, 86)),
}
ALL_TEETH = (
    PERMANENT[1] + PERMANENT[2] + PERMANENT[3] + PERMANENT[4]
    + PRIMARY[5] + PRIMARY[6] + PRIMARY[7] + PRIMARY[8]
)


# ---------------------------------------------------------------------------
# Contrast
# ---------------------------------------------------------------------------
def _lin(c: float) -> float:
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)


def contrast_ratio(hex_color: str, bg: str = PAPER) -> float:
    a, b = luminance(hex_color), luminance(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def assert_contrast() -> None:
    bad = []
    for key, spec in CONDITIONS.items():
        ratio = contrast_ratio(spec["color"])
        spec["contrastVsWhite"] = round(ratio, 2)
        if ratio < 3.0:
            bad.append(f"{key} {spec['color']} {ratio:.2f}")
    for name, color in (("ink", INK), ("draft", DRAFT), ("amber", AMBER), ("lock", LOCK)):
        ratio = contrast_ratio(color)
        if ratio < 3.0:
            bad.append(f"{name} {color} {ratio:.2f}")
    if bad:
        raise SystemExit("Contrast < 3:1 vs white: " + ", ".join(bad))


# ---------------------------------------------------------------------------
# FDI helpers
# ---------------------------------------------------------------------------
def dentition_of(fdi: int) -> str:
    return "primary" if fdi >= 50 else "permanent"


def quadrant_of(fdi: int) -> int:
    return fdi // 10


def arch_of(fdi: int) -> str:
    q = quadrant_of(fdi)
    return "upper" if q in (1, 2, 5, 6) else "lower"


def tooth_type(fdi: int) -> str:
    pos = fdi % 10
    if fdi >= 50:
        if pos in (1, 2):
            return "incisor"
        if pos == 3:
            return "canine"
        return "molar"
    if pos in (1, 2):
        return "incisor"
    if pos == 3:
        return "canine"
    if pos in (4, 5):
        return "premolar"
    return "molar"


def center_letter(ttype: str) -> str:
    return "I" if ttype in ("incisor", "canine") else "O"


def is_right_quad(q: int) -> bool:
    """Patient's right = left side of the chart = quadrants 1, 4, 5, 8."""
    return q in (1, 4, 5, 8)


def surface_map(fdi: int) -> dict[str, str]:
    """Map geometric role (top/bottom/left/right/center) to surface letter.

    Chart convention (dentist facing the patient):
      - Mesial always faces the midline, so M/D swap between left and right
        sides of the chart.
      - Buccal/labial sits on the vestibular (outer) side of each arch, so
        B is at the top of upper cells and at the bottom of lower cells;
        L (lingual/palatal) is the inner side.
    """
    q = quadrant_of(fdi)
    ttype = tooth_type(fdi)
    roles = {"center": center_letter(ttype)}
    if arch_of(fdi) == "upper":
        roles["top"], roles["bottom"] = "B", "L"
    else:
        roles["top"], roles["bottom"] = "L", "B"
    if is_right_quad(q):
        # Patient right, chart left: midline is to the right of the cell.
        roles["left"], roles["right"] = "D", "M"
    else:
        roles["left"], roles["right"] = "M", "D"
    return roles


def visible_surface_label(fdi: int, letter: str) -> str:
    """On-screen letter for a surface. IDs and data-surface stay L for palatal."""
    if letter == "L" and arch_of(fdi) == "upper":
        return "P"
    return letter


def root_count(fdi: int) -> int:
    """Typical root count for the 3D chart (schematic, not a clinical exception table)."""
    ttype = tooth_type(fdi)
    if ttype in ("incisor", "canine"):
        return 1
    if ttype == "premolar":
        return 2 if fdi in (14, 24) else 1
    return 3 if arch_of(fdi) == "upper" else 2


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------
def fmt(v: float) -> str:
    r = round(float(v), 1)
    return str(int(r)) if abs(r - int(r)) < 1e-9 else f"{r:.1f}"


def pt(x: float, y: float) -> str:
    return f"{fmt(x)},{fmt(y)}"


def geometry(ttype: str, dentition: str) -> dict:
    """Tooth cell in a 100x100 space. Proportions differ by type."""
    primary = dentition == "primary"
    if ttype == "incisor":
        outer = (18, 8, 82, 92)
        inner = (34, 45, 66, 55)
        rx, center = (6 if primary else 3), "bar"
    elif ttype == "canine":
        outer = (16, 8, 84, 92)
        inner = (36, 44, 64, 56)
        rx, center = (7 if primary else 4), "diamond"
    elif ttype == "premolar":
        outer = (14, 14, 86, 86)
        inner = (38, 38, 62, 62)
        rx, center = 6, "square"
    else:  # molar
        if primary:
            outer = (10, 10, 90, 90)
            inner = (34, 34, 66, 66)
            rx = 12
        else:
            outer = (8, 8, 92, 92)
            inner = (32, 32, 68, 68)
            rx = 7
        center = "square"
    ox0, oy0, ox1, oy1 = (float(v) for v in outer)
    ix0, iy0, ix1, iy1 = (float(v) for v in inner)
    return {
        "outer": (ox0, oy0, ox1, oy1),
        "inner": (ix0, iy0, ix1, iy1),
        "rx": float(rx),
        "center": center,
        "cx": (ix0 + ix1) / 2,
        "cy": (iy0 + iy1) / 2,
    }


def _inner_top_pts(g: dict) -> list[tuple[float, float]]:
    ix0, iy0, ix1, iy1 = g["inner"]
    if g["center"] == "diamond":
        return [(ix0, g["cy"]), (g["cx"], iy0), (ix1, g["cy"])]
    return [(ix0, iy0), (ix1, iy0)]


def _inner_bottom_pts(g: dict) -> list[tuple[float, float]]:
    ix0, iy0, ix1, iy1 = g["inner"]
    if g["center"] == "diamond":
        return [(ix1, g["cy"]), (g["cx"], iy1), (ix0, g["cy"])]
    return [(ix1, iy1), (ix0, iy1)]


def _inner_right_pts(g: dict) -> list[tuple[float, float]]:
    ix0, iy0, ix1, iy1 = g["inner"]
    if g["center"] == "diamond":
        return [(g["cx"], iy0), (ix1, g["cy"]), (g["cx"], iy1)]
    return [(ix1, iy0), (ix1, iy1)]


def _inner_left_pts(g: dict) -> list[tuple[float, float]]:
    ix0, iy0, ix1, iy1 = g["inner"]
    if g["center"] == "diamond":
        return [(g["cx"], iy1), (ix0, g["cy"]), (g["cx"], iy0)]
    return [(ix0, iy1), (ix0, iy0)]


def path_center(g: dict) -> str:
    ix0, iy0, ix1, iy1 = g["inner"]
    if g["center"] == "diamond":
        return (
            f"M{pt(g['cx'], iy0)} L{pt(ix1, g['cy'])} "
            f"L{pt(g['cx'], iy1)} L{pt(ix0, g['cy'])} Z"
        )
    return (
        f"M{pt(ix0, iy0)} L{pt(ix1, iy0)} L{pt(ix1, iy1)} L{pt(ix0, iy1)} Z"
    )


def path_top(g: dict) -> str:
    ox0, oy0, ox1, oy1 = g["outer"]
    rx = g["rx"]
    inner = " ".join(f"L{pt(x, y)}" for x, y in reversed(_inner_top_pts(g)))
    return (
        f"M{pt(ox0 + rx, oy0)} L{pt(ox1 - rx, oy0)} "
        f"Q{pt(ox1, oy0)} {pt(ox1, oy0 + rx)} "
        f"{inner.replace('L', 'L', 1)} "
        f"L{pt(ox0, oy0 + rx)} Q{pt(ox0, oy0)} {pt(ox0 + rx, oy0)} Z"
    )


def path_bottom(g: dict) -> str:
    ox0, oy0, ox1, oy1 = g["outer"]
    rx = g["rx"]
    inner = " ".join(f"L{pt(x, y)}" for x, y in reversed(_inner_bottom_pts(g)))
    return (
        f"M{pt(ox1 - rx, oy1)} L{pt(ox0 + rx, oy1)} "
        f"Q{pt(ox0, oy1)} {pt(ox0, oy1 - rx)} "
        f"{inner.replace('L', 'L', 1)} "
        f"L{pt(ox1, oy1 - rx)} Q{pt(ox1, oy1)} {pt(ox1 - rx, oy1)} Z"
    )


def path_right(g: dict) -> str:
    ox0, oy0, ox1, oy1 = g["outer"]
    rx = g["rx"]
    inner = " ".join(f"L{pt(x, y)}" for x, y in reversed(_inner_right_pts(g)))
    # Vertical sides start after the rounded corners (owned by top/bottom).
    return (
        f"M{pt(ox1, oy0 + rx)} L{pt(ox1, oy1 - rx)} "
        f"{inner.replace('L', 'L', 1)} Z"
    )


def path_left(g: dict) -> str:
    ox0, oy0, ox1, oy1 = g["outer"]
    rx = g["rx"]
    inner = " ".join(f"L{pt(x, y)}" for x, y in reversed(_inner_left_pts(g)))
    return (
        f"M{pt(ox0, oy1 - rx)} L{pt(ox0, oy0 + rx)} "
        f"{inner.replace('L', 'L', 1)} Z"
    )


def path_outline(g: dict) -> str:
    ox0, oy0, ox1, oy1 = g["outer"]
    rx = g["rx"]
    return (
        f"M{pt(ox0 + rx, oy0)} L{pt(ox1 - rx, oy0)} "
        f"Q{pt(ox1, oy0)} {pt(ox1, oy0 + rx)} L{pt(ox1, oy1 - rx)} "
        f"Q{pt(ox1, oy1)} {pt(ox1 - rx, oy1)} L{pt(ox0 + rx, oy1)} "
        f"Q{pt(ox0, oy1)} {pt(ox0, oy1 - rx)} L{pt(ox0, oy0 + rx)} "
        f"Q{pt(ox0, oy0)} {pt(ox0 + rx, oy0)} Z"
    )


def path_divisions(g: dict) -> str:
    """Inner centre outline + four splits to the outer corners."""
    ox0, oy0, ox1, oy1 = g["outer"]
    ix0, iy0, ix1, iy1 = g["inner"]
    parts = [path_center(g).rstrip("Z").strip() + " Z"]
    if g["center"] == "diamond":
        parts += [
            f"M{pt(g['cx'], iy0)} L{pt((ox0 + ox1) / 2, oy0)}",
            f"M{pt(ix1, g['cy'])} L{pt(ox1, (oy0 + oy1) / 2)}",
            f"M{pt(g['cx'], iy1)} L{pt((ox0 + ox1) / 2, oy1)}",
            f"M{pt(ix0, g['cy'])} L{pt(ox0, (oy0 + oy1) / 2)}",
        ]
    else:
        parts += [
            f"M{pt(ix0, iy0)} L{pt(ox0, oy0)}",
            f"M{pt(ix1, iy0)} L{pt(ox1, oy0)}",
            f"M{pt(ix1, iy1)} L{pt(ox1, oy1)}",
            f"M{pt(ix0, iy1)} L{pt(ox0, oy1)}",
        ]
    return " ".join(parts)


def role_paths(g: dict) -> dict[str, str]:
    return {
        "top": path_top(g),
        "bottom": path_bottom(g),
        "left": path_left(g),
        "right": path_right(g),
        "center": path_center(g),
    }


# ---------------------------------------------------------------------------
# Shared CSS (also written to odontogram.css)
# ---------------------------------------------------------------------------
CSS = f"""/* Bitto odontogram — classes the React build should toggle */
.tooth-svg {{ color: {INK}; font-family: {FONT}; }}
.tooth-surface {{
  fill: {PAPER};
  stroke: none;
  pointer-events: auto;
  cursor: pointer;
}}
.tooth-outline, .tooth-divisions {{
  fill: none;
  stroke: currentColor;
  stroke-linejoin: round;
  stroke-linecap: round;
  pointer-events: none;
}}
.tooth-outline {{ stroke-width: 1.75; }}
.tooth-divisions {{ stroke-width: 1.15; }}
.tooth-number {{
  fill: {INK};
  font-family: {FONT_NUM};
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-anchor: middle;
  pointer-events: none;
}}
.tooth[data-state="draft"] .tooth-outline {{
  stroke: {DRAFT};
  stroke-width: 2.1;
  stroke-dasharray: 3.5 2.5;
}}
.tooth[data-state="draft"] .tooth-divisions {{ stroke: {DRAFT}; }}
.tooth[data-state="draft"] .tooth-wash {{ fill: {DRAFT_WASH}; }}
.tooth[data-state="signed"] .tooth-outline {{
  stroke: {LOCK};
  stroke-width: 2;
  stroke-dasharray: none;
}}
.tooth-lock {{ fill: {LOCK}; stroke: none; }}
.tooth-draft-mark {{ fill: {AMBER}; stroke: none; }}

.tooth-surface[data-condition="sehat"] {{ fill: #E8F6EE; }}
.tooth-surface[data-condition="karies"] {{ fill: {CONDITIONS['karies']['color']}; }}
.tooth-surface[data-condition="tambalan"] {{ fill: {CONDITIONS['tambalan']['color']}; }}

.surface-dots {{ fill: {PAPER}; pointer-events: none; }}
.overlay {{ pointer-events: none; }}
.overlay-mahkota {{
  fill: none;
  stroke: {CONDITIONS['mahkota']['color']};
  stroke-width: 3;
}}
.overlay-hilang {{
  fill: none;
  stroke: {CONDITIONS['hilang']['color']};
  stroke-width: 3.2;
  stroke-linecap: square;
}}
.overlay-sisa-akar {{
  fill: none;
  stroke: {CONDITIONS['sisa_akar']['color']};
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}}
.overlay-perlu-dicabut {{
  fill: none;
  stroke: {CONDITIONS['perlu_dicabut']['color']};
  stroke-width: 3.2;
  stroke-linecap: square;
}}
.overlay-implan {{
  fill: none;
  stroke: {CONDITIONS['implan']['color']};
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}}

/* Procedure status — independent of condition colour+shape.
   Kemungkinan MVP, menunggu persetujuan Jerome. */
.tooth-surface[data-status] {{ fill-opacity: 1; }}
.tooth-surface[data-status="sudah_ada_lain"] {{ fill-opacity: 0.7; }}
.tooth-surface[data-status="direncanakan"] {{ fill-opacity: 0.5; }}
.tooth-surface[data-status="dirujuk"] {{ fill-opacity: 0.8; }}
.tooth[data-status="direncanakan"] .tooth-outline {{
  stroke-dasharray: 4 2.5;
}}
.tooth[data-status="dirujuk"] .tooth-outline {{
  stroke-dasharray: 1.5 2;
}}
.tooth[data-baseline="missing"] {{ opacity: 0.45; }}
.tooth[data-baseline="missing"] .tooth-surface {{ fill: #E5E7EB; }}
.status-mark {{ pointer-events: none; }}

/* Soft 3D graphical chart */
.tooth-3d {{ cursor: pointer; }}
.tooth-3d .tooth-hit {{ fill: transparent; stroke: none; pointer-events: all; }}
.tooth-3d .anatomy, .tooth-3d .cond-mark {{ pointer-events: none; }}
.tooth-3d[data-state="draft"] .tooth-3d-frame {{
  fill: none;
  stroke: {DRAFT};
  stroke-width: 2.2;
  stroke-dasharray: 4 3;
}}
.tooth-3d[data-state="signed"] .tooth-3d-frame {{
  fill: none;
  stroke: {LOCK};
  stroke-width: 1.8;
}}
.tooth-3d[data-baseline="missing"] {{ opacity: 0.4; }}
"""


# ---------------------------------------------------------------------------
# Overlays & marks (drawn in 100x100 tooth space)
# ---------------------------------------------------------------------------
def karies_dots(g: dict, role: str, fill: str = PAPER, r: float = 1.6) -> str:
    """A few circles inside a surface, so karies is not colour-only."""
    ox0, oy0, ox1, oy1 = g["outer"]
    ix0, iy0, ix1, iy1 = g["inner"]
    cx, cy = (ox0 + ox1) / 2, (oy0 + oy1) / 2
    if role == "center":
        pts = [(g["cx"] - 5, g["cy"] - 4), (g["cx"] + 5, g["cy"] - 4),
               (g["cx"], g["cy"] + 2), (g["cx"] - 4, g["cy"] + 5),
               (g["cx"] + 4, g["cy"] + 5)]
        if g["center"] == "bar":
            pts = [(g["cx"] - 8, g["cy"]), (g["cx"], g["cy"]), (g["cx"] + 8, g["cy"])]
        elif g["center"] == "diamond":
            pts = [(g["cx"], g["cy"] - 3), (g["cx"] + 5, g["cy"]),
                   (g["cx"], g["cy"] + 3), (g["cx"] - 5, g["cy"])]
    elif role == "top":
        mid_y = (oy0 + iy0) / 2
        pts = [(cx - 8, mid_y), (cx, mid_y - 1.5), (cx + 8, mid_y)]
    elif role == "bottom":
        mid_y = (oy1 + iy1) / 2
        pts = [(cx - 8, mid_y), (cx, mid_y + 1.5), (cx + 8, mid_y)]
    elif role == "left":
        mid_x = (ox0 + ix0) / 2
        pts = [(mid_x, cy - 8), (mid_x - 1.5, cy), (mid_x, cy + 8)]
    else:
        mid_x = (ox1 + ix1) / 2
        pts = [(mid_x, cy - 8), (mid_x + 1.5, cy), (mid_x, cy + 8)]
    return "".join(
        f'<circle class="surface-dots" cx="{fmt(x)}" cy="{fmt(y)}" r="{fmt(r)}" fill="{fill}"/>'
        for x, y in pts
    )


def overlay_mahkota(g: dict, color: str | None = None) -> str:
    ox0, oy0, ox1, oy1 = g["outer"]
    c = color or CONDITIONS["mahkota"]["color"]
    # Outset ring around the whole tooth.
    pad = 4
    rx = g["rx"] + 3
    x, y, w, h = ox0 - pad, oy0 - pad, (ox1 - ox0) + 2 * pad, (oy1 - oy0) + 2 * pad
    return (
        f'<rect class="overlay overlay-mahkota" x="{fmt(x)}" y="{fmt(y)}" '
        f'width="{fmt(w)}" height="{fmt(h)}" rx="{fmt(rx)}" ry="{fmt(rx)}" '
        f'stroke="{c}"/>'
    )


def overlay_hilang(g: dict, color: str | None = None) -> str:
    ox0, oy0, ox1, oy1 = g["outer"]
    c = color or CONDITIONS["hilang"]["color"]
    inset = 6
    return (
        f'<path class="overlay overlay-hilang" stroke="{c}" d="'
        f'M{pt(ox0 + inset, oy0 + inset)} L{pt(ox1 - inset, oy1 - inset)} '
        f'M{pt(ox1 - inset, oy0 + inset)} L{pt(ox0 + inset, oy1 - inset)}"/>'
    )


def overlay_sisa_akar(g: dict, color: str | None = None) -> str:
    ox0, oy0, ox1, oy1 = g["outer"]
    c = color or CONDITIONS["sisa_akar"]["color"]
    cx = (ox0 + ox1) / 2
    # Horizontal cervical line + two roots as a V (crown is gone).
    y0 = oy0 + (oy1 - oy0) * 0.36
    y1 = oy1 - 8
    return (
        f'<path class="overlay overlay-sisa-akar" stroke="{c}" d="'
        f'M{pt(ox0 + 16, y0)} L{pt(ox1 - 16, y0)} '
        f'M{pt(cx - 5, y0)} L{pt(cx - 20, y1)} '
        f'M{pt(cx + 5, y0)} L{pt(cx + 20, y1)} '
        f'M{pt(cx, y0)} L{pt(cx, y0 + 8)}"/>'
    )


def overlay_perlu_dicabut(g: dict, color: str | None = None) -> str:
    ox0, oy0, ox1, oy1 = g["outer"]
    c = color or CONDITIONS["perlu_dicabut"]["color"]
    # Single slash + a small outward arrow head, distinct from the hilang X.
    x0, y0 = ox0 + 16, oy1 - 16
    x1, y1 = ox1 - 16, oy0 + 16
    # arrow at the upper end
    ang = math.atan2(y1 - y0, x1 - x0)
    ah = 8
    a1 = ang + math.radians(28)
    a2 = ang - math.radians(28)
    hx1, hy1 = x1 - ah * math.cos(a1), y1 - ah * math.sin(a1)
    hx2, hy2 = x1 - ah * math.cos(a2), y1 - ah * math.sin(a2)
    return (
        f'<path class="overlay overlay-perlu-dicabut" stroke="{c}" d="'
        f'M{pt(x0, y0)} L{pt(x1, y1)} M{pt(hx1, hy1)} L{pt(x1, y1)} L{pt(hx2, hy2)}"/>'
    )


def overlay_implan(g: dict, color: str | None = None) -> str:
    ox0, oy0, ox1, oy1 = g["outer"]
    c = color or CONDITIONS["implan"]["color"]
    cx = (ox0 + ox1) / 2
    top, bot = oy0 + 16, oy1 - 12
    # Screw: platform, shaft, three threads, slightly pointed tip.
    return (
        f'<path class="overlay overlay-implan" stroke="{c}" d="'
        f'M{pt(cx - 12, top)} L{pt(cx + 12, top)} '
        f'M{pt(cx - 8, top)} L{pt(cx - 8, top + 6)} L{pt(cx + 8, top + 6)} L{pt(cx + 8, top)} '
        f'M{pt(cx, top + 6)} L{pt(cx, bot - 6)} L{pt(cx - 4, bot)} M{pt(cx, bot - 6)} L{pt(cx + 4, bot)} '
        f'M{pt(cx - 9, top + 16)} L{pt(cx + 9, top + 16)} '
        f'M{pt(cx - 9, top + 26)} L{pt(cx + 9, top + 26)} '
        f'M{pt(cx - 9, top + 36)} L{pt(cx + 9, top + 36)}"/>'
    )


def lock_glyph(x: float = 74, y: float = -6, s: float = 0.72) -> str:
    """Padlock at the top-right of the 100x100 cell (24x28 design space)."""
    return (
        f'<g class="tooth-lock overlay" transform="translate({fmt(x)} {fmt(y)}) scale({fmt(s)})" aria-hidden="true">'
        f'<path fill="{LOCK}" d="M8 12.2V8.4C8 5.4 10.2 3 13 3s5 2.4 5 5.4v3.8h2.2c.8 0 1.5.7 1.5 1.5v10.3c0 .8-.7 1.5-1.5 1.5H5.8c-.8 0-1.5-.7-1.5-1.5V13.7c0-.8.7-1.5 1.5-1.5H8zm2.4 0h5.2V8.4c0-1.5-1.2-2.7-2.6-2.7s-2.6 1.2-2.6 2.7v3.8z"/>'
        f'<circle cx="13" cy="19" r="1.6" fill="{PAPER}"/>'
        f"</g>"
    )


def draft_mark(x: float = 4, y: float = 4) -> str:
    """Small violet diamond — draft accent, complements the dashed outline."""
    return (
        f'<path class="tooth-draft-mark overlay" d="'
        f'M{pt(x + 5, y)} L{pt(x + 10, y + 5)} L{pt(x + 5, y + 10)} L{pt(x, y + 5)} Z"/>'
    )


# ---------------------------------------------------------------------------
# SVG snippets
# ---------------------------------------------------------------------------
def xml_header(view: str, width: str, height: str, title: str, extra_attr: str = "") -> str:
    return (
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" '
        f'width="{width}" height="{height}" role="img" aria-labelledby="title" '
        f'class="tooth-svg" color="{INK}" {extra_attr}>\n'
        f'  <title id="title">{esc(title)}</title>\n'
    )


def esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def style_block(extra: str = "") -> str:
    css = CSS + extra
    return f"  <style>\n{css}  </style>\n"



def status_marker(key: str, x: float, y: float, size: float = 10) -> str:
    """Small corner glyph for procedure status. Colour + shape, not colour alone."""
    spec = STATUSES.get(key)
    if not spec:
        return ""
    c = spec["color"]
    s = size
    kind = spec["marker"]
    if kind == "disk":
        body = f'<circle cx="{fmt(x + s/2)}" cy="{fmt(y + s/2)}" r="{fmt(s/2.4)}" fill="{c}"/>'
    elif kind == "square-filled":
        body = (
            f'<rect x="{fmt(x + 1)}" y="{fmt(y + 1)}" width="{fmt(s - 2)}" height="{fmt(s - 2)}" '
            f'rx="1" fill="{c}"/>'
        )
    elif kind == "square-open":
        body = (
            f'<rect x="{fmt(x + 1.2)}" y="{fmt(y + 1.2)}" width="{fmt(s - 2.4)}" height="{fmt(s - 2.4)}" '
            f'rx="1" fill="none" stroke="{c}" stroke-width="1.6"/>'
        )
    elif kind == "triangle":
        body = (
            f'<path d="M{pt(x + s/2, y + 1)} L{pt(x + s - 1, y + s - 1)} L{pt(x + 1, y + s - 1)} Z" '
            f'fill="{c}"/>'
        )
    elif kind == "check":
        body = (
            f'<path d="M{pt(x + 1.5, y + s*0.52)} L{pt(x + s*0.4, y + s - 1.5)} '
            f'L{pt(x + s - 1.2, y + 1.8)}" fill="none" stroke="{c}" stroke-width="1.8" '
            f'stroke-linecap="round" stroke-linejoin="round"/>'
        )
    else:  # arrow
        body = (
            f'<path d="M{pt(x + 1.5, y + s*0.7)} L{pt(x + s*0.55, y + s*0.7)} '
            f'L{pt(x + s*0.55, y + s - 1)} L{pt(x + s - 1, y + s/2)} '
            f'L{pt(x + s*0.55, y + 1)} L{pt(x + s*0.55, y + s*0.3)} L{pt(x + 1.5, y + s*0.3)} Z" '
            f'fill="{c}"/>'
        )
    return f'<g class="status-mark" data-status="{key}">{body}</g>'


def tooth_group(
    fdi: int,
    state: str = "empty",
    surface_conditions: dict[str, str] | None = None,
    whole_condition: str | None = None,
    show_number: bool = False,
    number_y: float = 112,
    transform: str | None = None,
    scale: float = 1.0,
    status: str | None = None,
    surface_statuses: dict[str, str] | None = None,
    baseline: str | None = None,
) -> str:
    ttype = tooth_type(fdi)
    dent = dentition_of(fdi)
    g = geometry(ttype, dent)
    roles = surface_map(fdi)
    paths = role_paths(g)
    surface_conditions = surface_conditions or {}
    surface_statuses = surface_statuses or {}
    classes = f"tooth tooth--{ttype} tooth--{dent}"
    attrs = (
        f'id="t{fdi}" class="{classes}" data-tooth="{fdi}" data-type="{ttype}" '
        f'data-dentition="{dent}" data-arch="{arch_of(fdi)}" data-quadrant="{quadrant_of(fdi)}" '
        f'data-state="{state}"'
    )
    if whole_condition:
        attrs += f' data-condition="{whole_condition}"'
    if status:
        attrs += f' data-status="{status}"'
    if baseline:
        attrs += f' data-baseline="{baseline}"'
    tf = f' transform="{transform}"' if transform else ""
    if scale != 1.0 and not transform:
        tf = f' transform="scale({fmt(scale)})"'
    parts = [f'<g {attrs}{tf}>']
    if state == "draft":
        ox0, oy0, ox1, oy1 = g["outer"]
        parts.append(
            f'<rect class="tooth-wash" x="{fmt(ox0)}" y="{fmt(oy0)}" '
            f'width="{fmt(ox1 - ox0)}" height="{fmt(oy1 - oy0)}" rx="{fmt(g["rx"])}" fill="{DRAFT_WASH}"/>'
        )
    # Surfaces in a stable letter order
    letter_to_role = {letter: role for role, letter in roles.items()}
    for letter in ("M", "D", center_letter(ttype), "B", "L"):
        role = letter_to_role[letter]
        d = paths[role]
        cond = surface_conditions.get(letter)
        st = surface_statuses.get(letter)
        cond_attr = f' data-condition="{cond}"' if cond else ""
        st_attr = f' data-status="{st}"' if st else ""
        parts.append(
            f'<path id="t{fdi}-{letter}" class="tooth-surface" '
            f'data-tooth="{fdi}" data-surface="{letter}"{cond_attr}{st_attr} d="{d}"/>'
        )
        if cond == "karies":
            parts.append(karies_dots(g, role))
    parts.append('<g class="tooth-lines" pointer-events="none">')
    parts.append(f'<path class="tooth-divisions" d="{path_divisions(g)}"/>')
    parts.append(f'<path class="tooth-outline" d="{path_outline(g)}"/>')
    parts.append("</g>")
    if whole_condition == "mahkota":
        parts.append(overlay_mahkota(g))
    elif whole_condition == "hilang":
        parts.append(overlay_hilang(g))
    elif whole_condition == "sisa_akar":
        parts.append(overlay_sisa_akar(g))
    elif whole_condition == "perlu_dicabut":
        parts.append(overlay_perlu_dicabut(g))
    elif whole_condition == "implan":
        parts.append(overlay_implan(g))
    if status:
        parts.append(status_marker(status, 7, 7, 13))
    if state == "draft":
        parts.append(draft_mark())
    if state == "signed":
        parts.append(lock_glyph())
    if show_number:
        parts.append(
            f'<text class="tooth-number" x="50" y="{fmt(number_y)}" font-size="13">{fdi}</text>'
        )
    parts.append("</g>")
    return "\n".join(parts)


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not content.endswith("\n"):
        content += "\n"
    path.write_text(content, encoding="utf-8")


# ---------------------------------------------------------------------------
# Per-tooth + type template SVGs
# ---------------------------------------------------------------------------
TOOTH_VB_W, TOOTH_VB_H = 100, 122


def emit_tooth_svg(fdi: int) -> str:
    arch = arch_of(fdi)
    # Number sits below the cell; React can hide or reposition .tooth-number.
    title = f"Gigi FDI {fdi} ({tooth_type(fdi)}, {dentition_of(fdi)}, {arch})"
    body = tooth_group(fdi, show_number=True, number_y=116)
    return (
        xml_header(f"0 0 {TOOTH_VB_W} {TOOTH_VB_H}", "100", "122", title)
        + f"  <desc>Lima permukaan dengan id t{fdi}-M/D/{center_letter(tooth_type(fdi))}/B/L. "
        + "Mesial menghadap garis tengah; B di sisi vestibular.</desc>\n"
        + style_block()
        + f"  {body}\n"
        + "</svg>\n"
    )


def emit_type_svg(ttype: str, dentition: str) -> str:
    """Canonical outline in upper-right (quadrant 1 / 5) orientation."""
    fdi = {"incisor": 11, "canine": 13, "premolar": 14, "molar": 16}[ttype] if dentition == "permanent" else {
        "incisor": 51, "canine": 53, "molar": 54
    }[ttype]
    # Use the real FDI only as a geometry key; ids are type-* to stay generic.
    g = geometry(ttype, dentition)
    roles = surface_map(fdi)
    paths = role_paths(g)
    letter_to_role = {letter: role for role, letter in roles.items()}
    title = f"Kerangka {ttype} {dentition} (orientasi kuadran {'1' if dentition=='permanent' else '5'})"
    parts = [
        xml_header("0 0 100 122", "100", "122", title),
        f"  <desc>Templat tipe. Permukaan memakai id type-{ttype}-{dentition}-{{huruf}}. "
        "Orientasi: B atas, L bawah, D kiri, M kanan (kanan atas pasien).</desc>\n",
        style_block(),
        f'  <g id="type-{ttype}-{dentition}" class="tooth tooth--{ttype} tooth--{dentition}" '
        f'data-type="{ttype}" data-dentition="{dentition}" data-state="empty">\n',
    ]
    for letter in ("M", "D", center_letter(ttype), "B", "L"):
        role = letter_to_role[letter]
        parts.append(
            f'    <path id="type-{ttype}-{dentition}-{letter}" class="tooth-surface" '
            f'data-surface="{letter}" d="{paths[role]}"/>\n'
        )
    parts.append(
        '    <g class="tooth-lines" pointer-events="none">\n'
        f'      <path class="tooth-divisions" d="{path_divisions(g)}"/>\n'
        f'      <path class="tooth-outline" d="{path_outline(g)}"/>\n'
        "    </g>\n"
        f'    <text class="tooth-number" x="50" y="116" font-size="11">'
        f"{ttype} · {'sulung' if dentition=='primary' else 'tetap'}</text>\n"
        "  </g>\n</svg>\n"
    )
    return "".join(parts)


def emit_state_svg(fdi: int, state: str) -> str:
    ttype = tooth_type(fdi)
    labels = {
        "empty": "Kosong (belum diisi)",
        "draft": "Draf AI, perlu persetujuan dokter",
        "signed": "Terkunci (sudah ditandatangani)",
    }
    surface_conditions = {}
    if state != "empty":
        # Show a couple of filled surfaces so the state + condition combo is visible.
        if ttype in ("incisor", "canine"):
            surface_conditions = {"I": "karies", "M": "tambalan"}
        else:
            surface_conditions = {"O": "karies", "M": "tambalan"}
    title = f"Gigi FDI {fdi} — {labels[state]}"
    caption = labels[state]
    body = tooth_group(fdi, state=state, surface_conditions=surface_conditions)
    extra = (
        f'  <text class="tooth-number" x="50" y="116" font-size="9" fill="{INK_SOFT}">'
        f"{esc(caption)}</text>\n"
    )
    return (
        xml_header("-10 -10 120 140", "160", "186", title)
        + style_block()
        + f"  {body}\n"
        + extra
        + "</svg>\n"
    )


def emit_states_sheet() -> str:
    items = [
        (16, "empty"), (16, "draft"), (16, "signed"),
        (11, "empty"), (11, "draft"), (11, "signed"),
    ]
    w, h = 780, 460
    parts = [
        xml_header(f"0 0 {w} {h}", str(w), str(h), "Contoh state: kosong, draf AI, terkunci"),
        style_block(
            "  .sheet-title { font-weight: 650; font-size: 18px; fill: #111827; }\n"
            "  .sheet-sub { font-size: 11px; fill: #4B5563; }\n"
            "  .sheet-cap { font-size: 11px; fill: #1F2937; font-weight: 600; text-anchor: middle; }\n"
            "  .sheet-hint { font-size: 10px; fill: #6B7280; text-anchor: middle; }\n"
        ),
        f'  <rect width="{w}" height="{h}" fill="{PAPER}"/>\n',
        f'  <text class="sheet-title" x="32" y="36" font-family="{FONT}">State variants</text>\n',
        f'  <text class="sheet-sub" x="32" y="52" font-family="{FONT}">'
        "Toggle data-state pada grup .tooth (kosong, draft, atau signed).</text>\n"
        f'  <text class="sheet-sub" x="32" y="68" font-family="{FONT}">'
        "Draf AI = garis putus violet + rombus ambar, selaras lencana “Draf AI, perlu persetujuan dokter”. "
        "Terkunci = garis solid + gembok.</text>\n",
    ]
    labels = {
        "empty": ("Kosong", "data-state tidak diisi, atau empty"),
        "draft": ("Draf AI, perlu persetujuan dokter", 'data-state="draft"'),
        "signed": ("Terkunci — sudah ditandatangani", 'data-state="signed"'),
    }
    cell = 160
    for i, (fdi, state) in enumerate(items):
        row, col = divmod(i, 3)
        x = 50 + col * 245
        y = 92 + row * 172
        ttype = tooth_type(fdi)
        sc = {}
        if state != "empty":
            sc = {"I" if ttype in ("incisor", "canine") else "O": "karies", "M": "tambalan"}
        # scale 1.2 from 100-unit cell
        parts.append(f'  <g transform="translate({x} {y}) scale(1.15)">\n')
        parts.append("    " + tooth_group(fdi, state=state, surface_conditions=sc) + "\n")
        parts.append("  </g>\n")
        cap, hint = labels[state]
        parts.append(
            f'  <text class="sheet-cap" x="{x + 58}" y="{y + 128}" font-family="{FONT}">'
            f"t{fdi} · {esc(cap)}</text>\n"
            f'  <text class="sheet-hint" x="{x + 58}" y="{y + 143}" font-family="{FONT}">'
            f"{esc(hint)}</text>\n"
        )
    parts.append("</svg>\n")
    return "".join(parts)


# ---------------------------------------------------------------------------
# Legend
# ---------------------------------------------------------------------------
def legend_icon_content(key: str, size: float = 64) -> str:
    """Draw a compact icon for one condition, in a size×size box."""
    color = CONDITIONS[key]["color"]
    # Use a small molar-like cell, scaled from 100 to size-ish with padding.
    g = geometry("molar", "permanent")
    scale = (size - 8) / 100
    tx, ty = 4, 4
    wrap_open = f'<g transform="translate({fmt(tx)} {fmt(ty)}) scale({fmt(scale)})">'
    wrap_close = "</g>"
    # Base tooth (faint) + the distinctive mark.
    base = (
        f'<path d="{path_outline(g)}" fill="{PAPER}" stroke="{INK}" stroke-width="1.8"/>'
        f'<path d="{path_divisions(g)}" fill="none" stroke="{INK}" stroke-width="1.15"/>'
    )
    if key == "sehat":
        # Light green wash + check.
        mark = (
            f'<path d="{path_center(g)}" fill="#E8F6EE" stroke="none"/>'
            f'<path d="M40 52 L47 60 L62 42" fill="none" stroke="{color}" '
            f'stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'
        )
    elif key == "karies":
        mark = (
            f'<path d="{path_center(g)}" fill="{color}" stroke="none"/>'
            + karies_dots(g, "center", fill=PAPER, r=2.1)
        )
    elif key == "tambalan":
        mark = f'<path d="{path_center(g)}" fill="{color}" stroke="none"/>'
    elif key == "mahkota":
        mark = overlay_mahkota(g, color)
    elif key == "hilang":
        mark = overlay_hilang(g, color)
    elif key == "sisa_akar":
        mark = overlay_sisa_akar(g, color)
    elif key == "perlu_dicabut":
        mark = overlay_perlu_dicabut(g, color)
    else:  # implan
        mark = overlay_implan(g, color)
    return wrap_open + base + mark + wrap_close


def emit_legend_symbol(key: str) -> str:
    spec = CONDITIONS[key]
    title = f"{spec['label']} (legenda internal)"
    return (
        xml_header("0 0 64 64", "64", "64", title)
        + f"  <desc>Huruf/bentuk: {spec['mark']}. Warna {spec['color']}. "
        + f"Berlaku pada {spec['applies-to']}. Bukan standar resmi Kemenkes/PDGI.</desc>\n"
        + f'  <g id="legend-{key}">\n'
        + "    " + legend_icon_content(key, 64) + "\n"
        + "  </g>\n</svg>\n"
    )


def emit_legend_sheet() -> str:
    keys = list(CONDITIONS.keys())
    w, h = 980, 470
    parts = [
        xml_header(f"0 0 {w} {h}", str(w), str(h), "Legenda internal odontogram Bitto"),
        style_block(
            "  .lg-title { font-weight: 700; font-size: 22px; fill: #111827; }\n"
            "  .lg-badge { font-weight: 650; font-size: 11px; fill: #6D28D9; }\n"
            "  .lg-disc { font-size: 12px; fill: #4B5563; }\n"
            "  .lg-name { font-weight: 650; font-size: 13px; fill: #111827; }\n"
            "  .lg-meta { font-size: 10.5px; fill: #6B7280; }\n"
            "  .lg-swatch { stroke: #E5E7EB; stroke-width: 1; }\n"
        ),
        f'  <rect width="{w}" height="{h}" fill="{PAPER}"/>\n',
        f'  <text class="lg-title" x="32" y="36" font-family="{FONT}">Legenda internal</text>\n',
        f'  <rect x="214" y="20" width="228" height="20" rx="4" fill="{DRAFT_WASH}"/>\n',
        f'  <text class="lg-badge" x="224" y="34" font-family="{FONT}">BUKAN standar resmi Kemenkes/PDGI</text>\n',
        f'  <text class="lg-disc" x="32" y="58" font-family="{FONT}">'
        "Warna + bentuk (bukan warna saja). Komponen ini bisa diganti saat formulir resmi tersedia. "
        "Kontras non-teks ≥ 3:1 terhadap putih (WCAG 2.2).</text>\n",
    ]
    col_w, row_h = 232, 168
    origin_x, origin_y = 32, 78
    for i, key in enumerate(keys):
        spec = CONDITIONS[key]
        col, row = i % 4, i // 4
        x = origin_x + col * col_w
        y = origin_y + row * row_h
        applies = "permukaan" if spec["applies-to"] == "surface" else "seluruh gigi"
        label = spec["label"]
        if " / " in label:
            a, b = label.split(" / ", 1)
            name_bits = (
                f'    <text class="lg-name" x="84" y="48" font-family="{FONT}">{esc(a)}</text>\n'
                f'    <text class="lg-name" x="84" y="64" font-family="{FONT}">/ {esc(b)}</text>\n'
                f'    <text class="lg-meta" x="84" y="84" font-family="{FONT}">{esc(applies)} · {spec["mark"]}</text>\n'
                f'    <text class="lg-meta" x="84" y="100" font-family="{FONT}">{spec["color"]} · {spec["contrastVsWhite"]}:1</text>\n'
            )
        else:
            name_bits = (
                f'    <text class="lg-name" x="84" y="50" font-family="{FONT}">{esc(label)}</text>\n'
                f'    <text class="lg-meta" x="84" y="70" font-family="{FONT}">{esc(applies)} · {spec["mark"]}</text>\n'
                f'    <text class="lg-meta" x="84" y="86" font-family="{FONT}">{spec["color"]} · {spec["contrastVsWhite"]}:1</text>\n'
            )
        parts.append(
            f'  <g id="legend-item-{key}" transform="translate({x} {y})">\n'
            f'    <rect x="0" y="0" width="216" height="152" rx="10" fill="{PAPER_SOFT}" stroke="{RULE}"/>\n'
            f'    <g transform="translate(8 12)">{legend_icon_content(key, 72)}</g>\n'
            f'    <rect class="lg-swatch" x="88" y="18" width="14" height="14" rx="3" fill="{spec["color"]}"/>\n'
            + name_bits +
            "  </g>\n"
        )
    parts.append(
        f'  <text class="lg-disc" x="32" y="428" font-family="{FONT}">'
        "Berlaku per permukaan: sehat, karies, tambalan. "
        "Berlaku pada seluruh gigi: mahkota, hilang, sisa akar, perlu dicabut, implan.</text>\n"
        f'  <text class="lg-disc" x="32" y="446" font-family="{FONT}">'
        "React: data-condition pada .tooth-surface (sehat, karies, tambalan) "
        "atau pada grup .tooth (mahkota, hilang, sisa akar, perlu dicabut, implan).</text>\n"
        "</svg>\n"
    )
    return "".join(parts)


# ---------------------------------------------------------------------------
# Full chart
# ---------------------------------------------------------------------------
# Layout constants (px, 1 unit = 1 px in the full chart viewBox)
CELL = 56
GAP_X = 6
MID = 22
MARGIN_L = 108
MARGIN_R = 64
MARGIN_TOP = 64
NUM_H = 16
ROW_GAP = 10
OPENING = 108

# Column index 0..15; 0-7 = patient right (chart left), 8-15 = patient left.
# Permanent occupies all 16 columns. Primary occupies columns 3..7 and 8..12.


def col_x(col: int) -> float:
    # col 0-7 left block, 8-15 right block, with midline gap between 7 and 8
    if col < 8:
        return MARGIN_L + col * (CELL + GAP_X)
    return MARGIN_L + 8 * (CELL + GAP_X) - GAP_X + MID + (col - 8) * (CELL + GAP_X)


def chart_width() -> float:
    return col_x(15) + CELL + MARGIN_R


def tooth_col(fdi: int) -> int:
    q = quadrant_of(fdi)
    pos = fdi % 10  # 1-8 (or 1-5)
    if q in (1, 4):  # upper/lower right permanent: 18..11 left to right
        return 8 - pos  # 18 -> 0, 11 -> 7
    if q in (2, 3):  # 21..28 / 31..38
        return 7 + pos  # 21 -> 8, 28 -> 15
    if q in (5, 8):  # primary right: 55..51, aligned under 15..11 (cols 3..7)
        return 8 - pos  # 55 -> 3, 51 -> 7
    # q in (6, 7): 61..65 / 71..75, aligned under 21..25 (cols 8..12)
    return 7 + pos


def emit_full_chart() -> str:
    # Row y positions
    y = MARGIN_TOP
    y_num_up_perm = y
    y_up_perm = y_num_up_perm + NUM_H
    y_num_up_prim = y_up_perm + CELL + ROW_GAP
    y_up_prim = y_num_up_prim + NUM_H
    y_lo_prim = y_up_prim + CELL + OPENING
    y_num_lo_prim = y_lo_prim + CELL + 2
    y_lo_perm = y_num_lo_prim + NUM_H + ROW_GAP
    y_num_lo_perm = y_lo_perm + CELL + 2
    height = y_num_lo_perm + 28 + 36
    width = chart_width()
    scale = CELL / 100.0

    rows = [
        ("upper", "permanent", [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
         y_up_perm, y_num_up_perm + 12, "Gigi tetap"),
        ("upper", "primary", [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
         y_up_prim, y_num_up_prim + 12, "Gigi sulung"),
        ("lower", "primary", [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
         y_lo_prim, y_num_lo_prim + 12, "Gigi sulung"),
        ("lower", "permanent", [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
         y_lo_perm, y_num_lo_perm + 12, "Gigi tetap"),
    ]

    mid_x = (col_x(7) + CELL + col_x(8)) / 2

    parts = [
        xml_header(f"0 0 {fmt(width)} {fmt(height)}", fmt(width), fmt(height),
                   "Odontogram Bitto — gigi tetap dan gigi sulung, penomoran FDI",
                   extra_attr='data-dentition="mixed"'),
        "  <desc>Tata letak standar: atas 18..11 | 21..28, sulung 55..51 | 61..65, "
        "sulung 85..81 | 71..75, bawah 48..41 | 31..38. Kanan pasien di kiri bagan. "
        "Legenda internal, bukan standar resmi Kemenkes/PDGI.</desc>\n",
        style_block(
            "  .chart-title { font-weight: 700; font-size: 20px; fill: #111827; }\n"
            "  .chart-sub { font-size: 11px; fill: #4B5563; }\n"
            "  .chart-side { font-size: 11px; fill: #6B7280; font-weight: 600; letter-spacing: 0.04em; }\n"
            "  .chart-row { font-size: 10px; fill: #6B7280; font-weight: 600; }\n"
            "  .chart-mid { stroke: #9CA3AF; stroke-width: 1; }\n"
            "  .orient-label { font-size: 15px; font-weight: 700; fill: #111827; "
            "stroke: #FFFFFF; stroke-width: 3; paint-order: stroke fill; "
            "text-anchor: middle; dominant-baseline: middle; pointer-events: none; }\n"
        ),
        f'  <rect width="{fmt(width)}" height="{fmt(height)}" fill="{PAPER}"/>\n',
        f'  <text class="chart-title" x="{MARGIN_L}" y="28" font-family="{FONT}">Odontogram</text>\n',
        f'  <text class="chart-sub" x="{MARGIN_L}" y="46" font-family="{FONT}">'
        "Penomoran FDI · gigi tetap dan gigi sulung · bagan dari pandangan operator "
        "(kanan pasien di kiri). Legenda internal, bukan formulir resmi Kemenkes/PDGI.</text>\n",
        # Midline
        f'  <line class="chart-mid" x1="{fmt(mid_x)}" y1="{fmt(y_num_up_perm - 4)}" '
        f'x2="{fmt(mid_x)}" y2="{fmt(y_num_lo_perm + 16)}"/>\n',
        # Side labels sit in their own outer column, vertically centered on the
        # whole chart, so they never sit on top of the Tetap/Sulung row labels.
        f'  <text class="chart-side" x="20" y="{fmt((y_up_perm + y_lo_perm + CELL) / 2)}" '
        f'text-anchor="middle" transform="rotate(90 20 {fmt((y_up_perm + y_lo_perm + CELL) / 2)})" '
        f'font-family="{FONT}">KANAN PASIEN</text>\n',
        f'  <text class="chart-side" x="{fmt(width - 20)}" y="{fmt((y_up_perm + y_lo_perm + CELL) / 2)}" '
        f'text-anchor="middle" transform="rotate(90 {fmt(width - 20)} {fmt((y_up_perm + y_lo_perm + CELL) / 2)})" '
        f'font-family="{FONT}">KIRI PASIEN</text>\n',
    ]

    # Row labels in the inner left margin, clear of the vertical side label.
    parts.append(
        f'  <text class="chart-row" x="{fmt(MARGIN_L - 12)}" y="{fmt(y_up_perm + CELL / 2 + 3)}" '
        f'text-anchor="end" font-family="{FONT}">Tetap</text>\n'
        f'  <text class="chart-row" x="{fmt(MARGIN_L - 12)}" y="{fmt(y_up_prim + CELL / 2 + 3)}" '
        f'text-anchor="end" font-family="{FONT}">Sulung</text>\n'
        f'  <text class="chart-row" x="{fmt(MARGIN_L - 12)}" y="{fmt(y_lo_prim + CELL / 2 + 3)}" '
        f'text-anchor="end" font-family="{FONT}">Sulung</text>\n'
        f'  <text class="chart-row" x="{fmt(MARGIN_L - 12)}" y="{fmt(y_lo_perm + CELL / 2 + 3)}" '
        f'text-anchor="end" font-family="{FONT}">Tetap</text>\n'
    )

    for arch, dent, teeth, y_tooth, y_num, _label in rows:
        for fdi in teeth:
            x = col_x(tooth_col(fdi))
            parts.append(f'  <g transform="translate({fmt(x)} {fmt(y_tooth)}) scale({fmt(scale)})">\n')
            parts.append("    " + tooth_group(fdi) + "\n")
            parts.append("  </g>\n")
            parts.append(
                f'  <text class="tooth-number" x="{fmt(x + CELL / 2)}" y="{fmt(y_num)}" '
                f'font-size="11" font-family="{FONT_NUM}">{fdi}</text>\n'
            )

    # Orientation key in the bite opening (boxed, clearly not a patient tooth).
    def letter_pos_for(fdi: int):
        g = geometry(tooth_type(fdi), dentition_of(fdi))
        roles = surface_map(fdi)
        ox0, oy0, ox1, oy1 = g["outer"]
        ix0, iy0, ix1, iy1 = g["inner"]
        pos = {
            "top": ((ox0 + ox1) / 2, (oy0 + iy0) / 2),
            "bottom": ((ox0 + ox1) / 2, (oy1 + iy1) / 2),
            "left": ((ox0 + ix0) / 2, (oy0 + oy1) / 2),
            "right": ((ox1 + ix1) / 2, (oy0 + oy1) / 2),
            "center": (g["cx"], g["cy"]),
        }
        return g, roles, pos

    box_w, box_h = 368, 98
    box_x = mid_x - box_w / 2
    box_y = y_up_prim + CELL + (OPENING - box_h) / 2
    parts.append(
        f'  <g id="orientasi-permukaan" transform="translate({fmt(box_x)} {fmt(box_y)})">\n'
        f'    <rect x="0" y="0" width="{fmt(box_w)}" height="{fmt(box_h)}" rx="8" '
        f'fill="{PAPER_SOFT}" stroke="{RULE}"/>\n'
        f'    <text class="chart-sub" x="14" y="16" font-family="{FONT}" font-weight="600">'
        "Orientasi permukaan (bukan gigi pasien)</text>\n"
    )
    for idx, (fdi, caption) in enumerate(((16, "16 · kanan atas"), (46, "46 · kanan bawah"))):
        _g, roles, pos = letter_pos_for(fdi)
        tx = 16 + idx * 180
        ty = 20
        s_ins = 0.68
        parts.append(f'    <g transform="translate({tx} {ty}) scale({s_ins})">\n')
        parts.append(f"      {tooth_group(fdi)}\n")
        for role, (lx, ly) in pos.items():
            letter = visible_surface_label(fdi, roles[role])
            parts.append(
                f'      <text class="orient-label" x="{fmt(lx)}" y="{fmt(ly)}" '
                f'font-size="15" font-family="{FONT_NUM}">{letter}</text>\n'
            )
        parts.append("    </g>\n")
        parts.append(
            f'    <text class="chart-sub" x="{fmt(tx + 34)}" y="90" font-family="{FONT}">'
            f"{esc(caption)}</text>\n"
        )
    parts.append("  </g>\n")

    parts.append(
        f'  <text class="chart-sub" x="{MARGIN_L}" y="{fmt(height - 14)}" font-family="{FONT}">'
        "Id: t16-O, t11-I, t16-M, t16-D, t16-B, t16-L. "
        "Label tampak: P di gigi atas (palatal), L di gigi bawah (lingual); data-surface tetap L. "
        "I = insisal. Pandangan operator (kanan pasien di kiri).</text>\n"
        "</svg>\n"
    )
    return "".join(parts)


# ---------------------------------------------------------------------------
# README + legend.json
# ---------------------------------------------------------------------------
README = """# Odontogram Bitto — aset SVG 2D

Bagan gigi datar (bukan 3D, tanpa raster, filter, atau gradien). **Legenda internal**, bukan formulir resmi Kemenkes/PDGI; komponen bisa diganti nanti.

Hasilkan ulang: `python3 generate.py` (dari folder ini). Pratinjau PNG: `preview/`.

Cek skema + kontras WCAG: `python3 check_legend.py` (berjalan pada `legend.json` lawan `legend.schema.json`). Skrip keluar non-nol jika suatu warna di bawah ambang AA pada latar yang dinyatakan, atau jika suatu kondisi tidak punya glif/bentuk.

## Isi folder

| Path | Isi |
|---|---|
| `generate.py` | Skrip pembuat (sumber kebenaran) |
| `odontogram.css` | Kelas yang di-toggle React |
| `odontogram-full.svg` | Bagan lengkap, tata letak standar |
| `teeth/t11.svg` … `t48.svg`, `t51.svg` … `t85.svg` | Satu file per gigi FDI (52 file) |
| `types/{incisor,canine,premolar,molar}-{permanent,primary}.svg` | Kerangka per tipe (premolar hanya gigi tetap) |
| `legend/{sehat,karies,tambalan,mahkota,hilang,sisa_akar,perlu_dicabut,implan}.svg` | Ikon kondisi |
| `legend.svg` | Lembar legenda |
| `legend.json` | Pemetaan kunci → label, warna, glif, applies-to |
| `states/t16-{empty,draft,signed}.svg`, `states/t11-*.svg` | Contoh state molar + insisor |
| `states/examples.svg` | Keenam contoh dalam satu lembar |
| `states/statuses.svg` | Contoh lapisan status tindakan |
| `3d/t11.svg` … `t85.svg` | Bagan grafis 3D lembut, satu file per gigi |
| `3d/odontogram-3d-full.svg` | Bagan 3D lengkap, tata letak FDI yang sama |
| `3d/conditions-row.svg` | Semua kondisi dilukis pada molar dan insisor 3D |
| `preview/odontogram-full.png`, `preview/legend.png`, `preview/states.png`, `preview/statuses.png` | Tangkapan layar 2D |
| `preview/odontogram-3d-full.png`, `preview/odontogram-3d-conditions.png` | Tangkapan layar 3D |

## Skema ID

- Grup gigi: `t16` (nomor FDI, tanpa titik).
- Permukaan: `t16-O`, `t16-M`, `t16-D`, `t16-B`, `t16-L`.
- Gigi anterior (insisor, kaninus) memakai **`I`** di pusat, bukan `O`: `t11-I`.
- Atribut: `data-tooth="16"` `data-surface="O"` pada setiap path permukaan.
- Templat tipe: `type-molar-permanent-O`, dst.

Huruf permukaan (database.md pada D-021: enum `M`, `D`, `O`/`I`, `B`/`L`/`P`):

| Huruf | Arti | Dipakai di |
|---|---|---|
| `M` | Mesial | Semua gigi |
| `D` | Distal | Semua gigi |
| `O` | Oklusal | Premolar dan molar |
| `I` | Insisal | Insisor dan kaninus |
| `B` | Bukal / labial | Semua gigi (labial di anterior) |
| `L` | Lingual (bawah) / palatal (atas) | Semua gigi — **id dan `data-surface` selalu `L`** |

Label *tampak* di bagan: **P** pada gigi rahang atas (palatal), **L** pada gigi rahang bawah (lingual). Huruf P tidak dipakai di id atau `data-surface`, supaya id tetap 5 huruf yang stabil. `surface` boleh `null` di data (seluruh gigi) — itu kondisi whole-tooth, bukan path kelima.

## Aturan cermin (mirroring)

Bagan dari pandangan operator (pasien menghadap dokter): **kanan pasien di kiri bagan**.

- **M selalu menghadap garis tengah.** Kuadran kanan pasien (1, 4, 5, 8 — kiri bagan): M di sisi kanan sel, D di kiri. Kuadran kiri pasien (2, 3, 6, 7 — kanan bagan): M di kiri sel, D di kanan.
- **B di sisi vestibular (luar lengkung).** Rahang atas: B di atas sel, label tampak **P** di bawah (`data-surface` tetap `L`). Rahang bawah: L di atas sel, B di bawah.
- Urutan bagan: atas 18..11 | 21..28, sulung 55..51 | 61..65, sulung 85..81 | 71..75, bawah 48..41 | 31..38. Gigi sulung rata dengan posisi 15–11 dan 21–25 (tidak ada sulung di 16–18 / 26–28).

Lihat sisipan “Orientasi permukaan” di `odontogram-full.svg` (gigi 16 menampilkan P di sisi palatal).

## Legenda (kunci)

Kunci, label, berlaku pada, dan tanda (selalu warna **plus** bentuk):

| Kunci | Label | Berlaku pada | Tanda |
|---|---|---|---|
| `sehat` | Sehat | permukaan | centang hijau |
| `karies` | Karies | permukaan | isi solid + titik |
| `tambalan` | Tambalan | permukaan | isi solid polos |
| `mahkota` | Mahkota | seluruh gigi | cincin di sekeliling gigi |
| `hilang` | Hilang | seluruh gigi | huruf X besar |
| `sisa_akar` | Sisa akar / akar tertinggal | seluruh gigi | garis servikal + V akar |
| `perlu_dicabut` | Perlu dicabut | seluruh gigi | garis miring + panah |
| `implan` | Implan | seluruh gigi | glif sekrup |

Warna di `legend.json` diperiksa `check_legend.py` pada latar putih / token permukaan: glif bersifat teks-ish (kondisi, status, tinta state) ≥ 4,5:1 (WCAG AA teks); grafis non-teks ≥ 3:1. Setiap kondisi wajib punya warna + glif/bentuk. Jangan andalkan warna saja: karies selalu membawa titik (`.surface-dots`).

## Atribut state

Pada grup `.tooth`:

- `data-state="empty"` (atau atribut dihilangkan) — garis solid abu, tanpa aksen.
- `data-state="draft"` — garis putus violet (`#6D28D9`), wash ungu muda, rombus di sudut. Selaras lencana “Draf AI, perlu persetujuan dokter”.
- `data-state="signed"` — garis solid lebih tebal + glif gembok. Entri yang sudah ditandatangani terkunci.

Pada path `.tooth-surface`: `data-condition="karies"` (atau `sehat`, `tambalan`).

Pada grup `.tooth` untuk kondisi seluruh gigi: `data-condition="mahkota"` / `hilang` / `sisa_akar` / `perlu_dicabut` / `implan`. React menambahkan overlay (contoh path ada di `legend/*.svg` dan di `generate.py`).

## Status tindakan dan baseline

*Kemungkinan MVP, menunggu persetujuan Jerome.*

Lapisan **status** terpisah dari kondisi (warna + bentuk di atas). Alur inspirasi Open Dental: ketuk gigi, ketuk permukaan, pilih status, baru pilih kondisi atau tindakan. Status tidak mengganti `data-condition`.

Atribut: `data-status` pada `.tooth-surface` (per permukaan) atau pada grup `.tooth` (seluruh gigi). Kunci di `legend.json` → `statuses`:

| Kunci | Label | Perlakuan visual |
|---|---|---|
| `kondisi` | Kondisi | Titik sudut solid, opasitas penuh |
| `sudah_ada_sini` | Sudah ada (di sini) | Kotak sudut terisi, opasitas penuh |
| `sudah_ada_lain` | Sudah ada (di tempat lain) | Kotak sudut berongga, opasitas 0,7 |
| `direncanakan` | Direncanakan | Segitiga sudut, opasitas 0,5, garis putus |
| `selesai` | Selesai | Centang sudut, opasitas penuh |
| `dirujuk` | Dirujuk | Panah sudut, opasitas 0,8, garis titik |

Status memakai bentuk di sudut + opasitas/gaya garis, bukan warna kondisi. Jika `data-state="draft"` juga aktif, garis putus violet (draf AI) tetap diutamakan; status tetap terlihat dari penanda sudut.

**Baseline gigi** (kunjungan pertama: tandai gigi hilang dan gigi susu/tetap/campuran dulu):

- Pada bagan: `data-dentition="permanent|primary|mixed"` (bagan lengkap memakai `mixed`).
- Pada gigi: `data-dentition="permanent|primary"` (sudah ada) dan `data-baseline="missing"` untuk gigi yang tidak ada sebelum temuan diisi. Kondisi `hilang` tetap temuan klinis; baseline adalah flag kehadiran di peta.

## Bagan grafis 3D lembut (SVG, versi lama)

`3d/*.svg` adalah percobaan pertama (digambar tangan sebagai SVG). **Diganti oleh render Blender di `3d-blender/`** (lihat bagian berikut). File lama tetap dihasilkan untuk perbandingan; jangan dipakai di aplikasi baru.

## Tampilan 3D — render Blender (`3d-blender/`)

**Aturan (review EHR Architect):** render Blender hanya *gambar dasar netral* — gigi sehat per tipe/tampak, plus varian struktural (implan, sisa akar, gigi pudar). Tidak ada gambar per kondisi yang "dibakar". Semua kondisi/status di 3D adalah overlay + mask dari data, diwarnai dari `legend.json`, dengan bentuk glif yang sama dengan 2D. Gigi hilang = slot garis putus + X (overlay), bukan gambar. **Tampilan 3D hanya-baca.**

Gigi 3D lembut dimodelkan prosedural (bidang jarak bertanda + marching cubes, subdivision surface, smooth shading) dan dirender dengan Cycles CPU. **Bagan 2D lima permukaan tetap jadi input per permukaan**; tampilan 3D hanya menampilkan data yang sama (ketuk gigi 3D = pilih gigi).

Hasilkan ulang (dari folder ini), satu perintah:

```bash
blender -b -P blender/teeth.py && python3 blender/compose.py
```

- `blender/teeth.py` — model + render (±25 menit di 8 CPU). Opsi: `-- --only molar-upper,incisor-lower`, `--samples 32`, `--quick`. Butuh `scikit-image` di Python bawaan Blender: `/home/box/opt/blender/4.2/python/bin/python3.11 -m pip install "scikit-image<0.25"`.
- `blender/compose.py` — membuat `legend-vars.css` dari `legend.json`, menyalin `odontogram-3d.css` + `tooth3d.js`, menulis `preview.html` (hanya terang), menambah bbox mask ke `manifest.json`, dan mengambil screenshot `preview/odontogram-3d-blender-*.png` (tanpa varian gelap).
- Prototipe menyalin aset dari `3d-blender/` ke `design/prototype/public/odontogram-3d/` lewat `cd ../prototype && npm run sync-3d` (juga di `predev` / `prebuild`). Jangan salin manual.
- Blender: 4.2 LTS portable di `/home/box/opt/blender`, symlink `~/.local/bin/blender`.

### Model

15 model: tetap atas `incisor`, `canine`, `premolar1` (2 akar, untuk 14/24), `premolar` (1 akar), `molar` (3 akar); tetap bawah `incisor`, `canine`, `premolar`, `molar` (2 akar + batang akar); sulung atas/bawah `p-incisor`, `p-canine`, `p-molar`. Gigi lain memakai model tipe yang sama dengan skala seragam (mis. 12 = insisor × 0,80; 17 = molar × 0,92) — tabel ada di `tooth3d.js` (`POS*`).

### File

| Path | Isi |
|---|---|
| `3d-blender/buccal/<model>@160.webp`, `@320.webp` | Tampak bukal, transparan. Atas: akar ke atas; bawah: akar ke bawah |
| `3d-blender/occlusal/<model>@{160,320}.webp` | Tampak oklusal (tonjol/fisura). Atas: bukal di atas gambar; bawah: bukal di bawah |
| `3d-blender/roots/<model>-{buccal,occlusal}@*.webp` | Sisa akar (mahkota patah) |
| `3d-blender/implant/<model>@*.webp` | Implan: mahkota di atas sekrup titanium (gigi tetap) |
| `3d-blender/ghost/<model>@*.webp` | Gigi pudar (baseline: belum ada / belum erupsi) |
| `3d-blender/masks/<model>-{buccal,occlusal}.webp` | Sprite 7 bingkai: `M, D, O(=I), B, L, crown, root` (alpha = area) |
| `3d-blender/manifest.json` | Ukuran piksel, garis CEJ, lebar mahkota, anchor (titik tengah) dan bbox tiap permukaan |
| `3d-blender/tooth3d.js`, `odontogram-3d.css`, `legend-vars.css` | Spesifikasi komponen (referensi untuk React) |
| `3d-blender/preview.html` | Bagan FDI lengkap + baris kondisi + baris state (`?only=full|conditions|states`). MVP hanya terang; tidak ada varian gelap. |

Ukuran: kepadatan piksel sama untuk semua gigi (`ppm160` = 5,08 px/mm pada set @160), jadi garis CEJ semua gigi sejajar. Set @320 tepat 2×. Bingkai bukal tetap 160 px (sulung 114 px), oklusal 72 px (sulung 58 px).

### Aturan cermin

Semua render menghadapkan **mesial ke kanan gambar**. Kuadran kanan pasien (1, 4, 5, 8; kiri bagan) dipakai apa adanya; kuadran kiri pasien (2, 3, 6, 7; kanan bagan) memakai `transform: scaleX(-1)` pada kotak gambar + mask. Glif overlay **tidak** dicerminkan (supaya tetap terbaca); posisi anchor-nya saja yang dibalik (`x → 1 − x`).

### Overlay (kondisi tidak dibakar ke render)

Satu rekaman data per gigi — sama dengan bagan 2D — menggerakkan kedua tampilan:

```js
{ tooth: 16, state: "signed",
  layers: [ { condition: "tambalan", surfaces: ["O","M"], status: "sudah_ada_sini" },
            { condition: "mahkota", status: "direncanakan" } ] }   // tanpa surfaces = seluruh gigi
```

- Grup `.t3` membawa `data-tooth`, `data-state`, `data-condition` / `data-status` (kondisi seluruh gigi), `data-baseline`. Tiap lapisan `.t3-layer` membawa `data-condition`, `data-status`, `data-surface` — atribut yang sama dengan path `.tooth-surface` di 2D.
- **Pewarnaan permukaan**: `div` dengan `mask-image` (sprite mask) + `background: var(--cc)` + `mix-blend-mode: multiply`, jadi bayangan render tetap terlihat. Karies selalu bertitik; direncanakan selalu berarsir.
- **Glif** (SVG di atas render, dari bentuk legenda): titik karies, kotak tambalan, cincin/tudung mahkota, X hilang + slot putus-putus, V sisa akar, garis miring + panah perlu dicabut, sekrup implan; penanda status di sudut. Draf AI: bingkai putus violet + rombus amber. Terkunci: bingkai solid + gembok.
- **Berlapis**: beberapa lapisan per gigi; opasitas per status dari `statuses.items[].fill-opacity`. `hilang` menyembunyikan semua lapisan lain; `sisa_akar` dan `implan` mengganti gambar dasar. Slot supernumerari opsional (`data-tooth="S12"`, setengah ukuran).
- **Warna hanya dari `legend.json`**: `compose.py` menulis `legend-vars.css` (`--c-<kondisi>`, `--s-<status>`, `--state-*`). Ganti palet = ubah `legend.json` lalu jalankan ulang `compose.py`. Bentuk glif tetap.

## Contoh pemakaian React

SVG inline (disarankan — id tetap bisa di-query, `currentColor` mengikuti CSS):

```tsx
import { useId } from "react";

type Surface = "M" | "D" | "O" | "I" | "B" | "L";

export function ToothCell({
  fdi,
  state = "empty",
  surfaces = {},
  whole,
  onSurfaceClick,
}: {
  fdi: number;
  state?: "empty" | "draft" | "signed";
  surfaces?: Partial<Record<Surface, "sehat" | "karies" | "tambalan">>;
  whole?: "mahkota" | "hilang" | "sisa_akar" | "perlu_dicabut" | "implan";
  onSurfaceClick?: (fdi: number, surface: Surface) => void;
}) {
  // Impor isi teeth/t{fdi}.svg sebagai komponen, atau tempel inline.
  // Contoh handler:
  const handle = (el: SVGPathElement) => {
    const surface = el.dataset.surface as Surface | undefined;
    if (surface) onSurfaceClick?.(fdi, surface);
  };
  return (
    <svg viewBox="0 0 100 122" className="tooth-svg" color="currentColor">
      {/* grup #t{fdi} dari file, dengan data-state dan data-condition */}
    </svg>
  );
}

// Atau <use>:
// <svg viewBox="0 0 100 122">
//   <use href="/odontogram/teeth/t16.svg#t16" />
// </svg>
```

Kelas CSS ada di `odontogram.css` (juga tertanam di setiap SVG supaya file mandiri tetap terlihat benar).

Ketuk path `.tooth-surface` untuk set kondisi per permukaan. Bandingkan kunjungan dengan menumpuk dua bagan dan menandai path yang `data-condition`-nya berbeda.
"""


def emit_legend_json() -> str:
    conditions = []
    for key, spec in CONDITIONS.items():
        conditions.append({
            "key": key,
            "label": spec["label"],
            "color": spec["color"],
            "glyph": spec["glyph"],
            "applies-to": spec["applies-to"],
            "mark": spec["mark"],
            "contrastVsWhite": spec["contrastVsWhite"],
        })
    doc = {
        "version": LEGEND_VERSION,
        "title": "Legenda internal",
        "official": False,
        "disclaimer": (
            "Bukan standar resmi Kemenkes/PDGI. "
            "Komponen dapat diganti saat formulir resmi tersedia."
        ),
        "contrast": {
            "method": "WCAG 2.2 non-text contrast against #FFFFFF",
            "minimum": 3.0,
        },
        "surfaces": {
            "M": "Mesial",
            "D": "Distal",
            "O": "Oklusal (premolar, molar)",
            "I": "Insisal (insisor, kaninus)",
            "B": "Bukal / labial",
            "L": "Lingual (rahang bawah) / palatal (rahang atas). Id dan data-surface selalu L.",
            "visibleLabel": "P on upper teeth (palatal), L on lower teeth (lingual). P is never used in ids or data-surface.",
        },
        "baseline": {
            "note": "Kemungkinan MVP, menunggu persetujuan Jerome.",
            "chart": {
                "attr": "data-dentition=\"permanent|primary|mixed\"",
                "look": "Chart-level dentition mix. The full chart uses mixed.",
            },
            "tooth": {
                "attr": "data-baseline=\"missing\"",
                "look": "Ghosted tooth; first-visit presence flag, distinct from condition hilang.",
                "dentition": "data-dentition=\"permanent|primary\" already exists on each tooth.",
            },
        },
        "states": {
            "empty": {
                "attr": 'data-state="empty"',
                "look": "Solid grey outline, no accent",
            },
            "draft": {
                "attr": 'data-state="draft"',
                "look": "Dashed violet outline, light violet wash, diamond mark",
                "badge": "Draf AI, perlu persetujuan dokter",
                "color": DRAFT,
                "accent": AMBER,
                "wash": DRAFT_WASH,
            },
            "signed": {
                "attr": 'data-state="signed"',
                "look": "Solid thicker outline plus lock glyph",
                "badge": "Terkunci",
                "color": LOCK,
            },
        },
        "conditions": conditions,
        "layering": {
            "note": "3D view (3d-blender/). One tooth record holds an ordered list of layers; later layers paint on top.",
            "layer": "{condition, surfaces?: [M|D|O|I|B|L], status}. No surfaces = whole tooth.",
            "opacity": "Per status: statuses.items[].fill-opacity.",
            "planned": "direncanakan = hatched tint + dashed glyph/outline; selesai / sudah_ada = solid.",
            "hides": "hilang hides every other layer (empty dashed slot + X). sisa_akar swaps to the roots-only render. implan swaps to the implant render.",
            "supernumerary": "Optional small slot next to a tooth: data-tooth=\"S12\" (half size).",
        },
        "statuses": {
            "note": "Kemungkinan MVP, menunggu persetujuan Jerome. Independent of condition colour+shape.",
            "attr": "data-status on .tooth-surface or .tooth",
            "items": [
                {
                    "key": k,
                    "label": s["label"],
                    "visual": s["visual"],
                    "marker": s["marker"],
                    "outline": s["outline"],
                    "fill-opacity": s["fill-opacity"],
                    "color": s["color"],
                }
                for k, s in STATUSES.items()
            ],
        },
    }
    return json.dumps(doc, indent=2, ensure_ascii=False) + "\n"


# ---------------------------------------------------------------------------
# Soft 3D graphical tooth chart
# Canonical space: 100 x 160, roots toward y=0, occlusal toward y=160.
# Lower teeth flip vertically; left quadrants flip horizontally so mesial
# still faces the midline. Our own drawing — not a copy of Open Dental.
# ---------------------------------------------------------------------------

T3_W, T3_H = 100, 160


def defs_3d() -> str:
    return f"""  <defs>
    <linearGradient id="enamel" x1="0.2" y1="0.1" x2="0.85" y2="0.95">
      <stop offset="0" stop-color="#FFF9F2"/>
      <stop offset="0.45" stop-color="#F0E2CC"/>
      <stop offset="1" stop-color="#D2BB9A"/>
    </linearGradient>
    <linearGradient id="enamel-occlusal" x1="0.3" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="#E6D3B6"/>
      <stop offset="1" stop-color="#C4AB88"/>
    </linearGradient>
    <linearGradient id="root-grad" x1="0.3" y1="1" x2="0.7" y2="0">
      <stop offset="0" stop-color="#EAD4B4"/>
      <stop offset="1" stop-color="#D0B087"/>
    </linearGradient>
    <linearGradient id="root-back" x1="0.3" y1="1" x2="0.7" y2="0">
      <stop offset="0" stop-color="#E0C49A"/>
      <stop offset="1" stop-color="#C4A078"/>
    </linearGradient>
    <radialGradient id="soft-shadow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#8A7A68" stop-opacity="0.3"/>
      <stop offset="1" stop-color="#8A7A68" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cap-grad" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#DDD6FE"/>
      <stop offset="1" stop-color="#7C3AED"/>
    </linearGradient>
    <linearGradient id="implant-grad" x1="0.3" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="#5EEAD4"/>
      <stop offset="1" stop-color="#0F5F63"/>
    </linearGradient>
    <linearGradient id="prosthetic" x1="0.2" y1="0.1" x2="0.85" y2="0.95">
      <stop offset="0" stop-color="#F5F0E8"/>
      <stop offset="1" stop-color="#C8B8A0"/>
    </linearGradient>
  </defs>
"""


def path_root(base_x: float, base_y: float, tip_x: float, tip_y: float,
              base_w: float, tip_w: float = 2.2) -> str:
    dx, dy = tip_x - base_x, tip_y - base_y
    length = math.hypot(dx, dy) or 1.0
    px, py = -dy / length, dx / length
    bl = (base_x - px * base_w / 2, base_y - py * base_w / 2)
    br = (base_x + px * base_w / 2, base_y + py * base_w / 2)
    # Mid-taper control, slightly waisted.
    mid_x, mid_y = (base_x + tip_x) / 2, (base_y + tip_y) / 2
    mid_w = (base_w + tip_w) / 2 * 0.92
    ml = (mid_x - px * mid_w / 2, mid_y - py * mid_w / 2)
    mr = (mid_x + px * mid_w / 2, mid_y + py * mid_w / 2)
    tl = (tip_x - px * tip_w / 2, tip_y - py * tip_w / 2)
    tr = (tip_x + px * tip_w / 2, tip_y + py * tip_w / 2)
    return (
        f"M{pt(*bl)} C{pt(*ml)} {pt(*tl)} {pt(tip_x, tip_y)} "
        f"C{pt(*tr)} {pt(*mr)} {pt(*br)} Z"
    )


def _width_for(fdi: int) -> dict:
    ttype = tooth_type(fdi)
    pos = fdi % 10
    primary = dentition_of(fdi) == "primary"
    if ttype == "incisor":
        # Centrals wider than laterals; lower incisors only slightly narrower.
        central = pos == 1
        lower = arch_of(fdi) == "lower"
        mid = 36 if central else 30
        if lower:
            mid -= 2
        return {"cervix": mid - 10, "mid": mid, "edge": mid - 2, "crown_h": 52, "root_len": 54}
    if ttype == "canine":
        return {"cervix": 22, "mid": 32, "edge": 13, "crown_h": 54, "root_len": 62, "pointed": True}
    if ttype == "premolar":
        return {"cervix": 26, "mid": 36, "edge": 32, "crown_h": 44, "root_len": 50, "occlusal": True}
    # molar: 8s slightly smaller
    mid = 50 if pos != 8 else 44
    return {"cervix": mid - 8, "mid": mid, "edge": mid - 6, "crown_h": 48, "root_len": 52, "occlusal": True,
            "bulbous": primary}


def tooth3d_layout(fdi: int) -> dict:
    """Canonical upper-right geometry (roots up, occlusal down, mesial on the right)."""
    spec = _width_for(fdi)
    primary = dentition_of(fdi) == "primary"
    ttype = tooth_type(fdi)
    nroots = root_count(fdi)
    # Scale and shift primary teeth so they sit smaller and slightly more crown-heavy.
    scale = 0.82 if primary else 1.0
    cervix_y = 76 if not primary else 70
    occlusal_y = cervix_y + spec["crown_h"] * (1.08 if primary else 1.0)
    root_len = spec["root_len"] * (0.78 if primary else 1.0)
    tip_y = cervix_y - root_len
    cx = 50.0
    # Root bases along the cervix.
    roots = []  # (base_x, tip_x, tip_y, base_w, behind)
    if nroots == 1:
        roots.append((cx, cx, tip_y + 2, spec["cervix"] * 0.55, False))
    elif nroots == 2:
        spread = 9 if ttype == "premolar" else 11
        # Palatal/behind first for upper premolar; for lower molars both are buccal-ish.
        if ttype == "premolar":
            # Buccal and palatal clearly separated (upper first premolar).
            roots.append((cx - 7, cx - 13, tip_y + 2, spec["cervix"] * 0.34, True))
            roots.append((cx + 7, cx + 13, tip_y + 5, spec["cervix"] * 0.36, False))
        else:
            # Lower molar: distal left, mesial right (canonical UR).
            roots.append((cx - spread, cx - spread - 2, tip_y + 2, spec["cervix"] * 0.36, False))
            roots.append((cx + spread, cx + spread + 2, tip_y + 2, spec["cervix"] * 0.36, False))
    else:
        # Upper molar: palatal behind (longer), two buccal in front.
        roots.append((cx, cx + 1, tip_y - 2, spec["cervix"] * 0.3, True))
        roots.append((cx - 11, cx - 16, tip_y + 6, spec["cervix"] * 0.3, False))
        roots.append((cx + 11, cx + 16, tip_y + 6, spec["cervix"] * 0.3, False))

    return {
        "spec": spec,
        "scale": scale,
        "cervix_y": cervix_y,
        "occlusal_y": occlusal_y,
        "cx": cx,
        "roots": roots,
        "primary": primary,
        "ttype": ttype,
        "nroots": nroots,
    }


def path_crown(layout: dict) -> str:
    spec = layout["spec"]
    y0, y1 = layout["cervix_y"], layout["occlusal_y"]
    cx = layout["cx"]
    wc, wm, we = spec["cervix"], spec["mid"], spec["edge"]
    ym = y0 + (y1 - y0) * 0.48
    if spec.get("pointed"):
        return (
            f"M{pt(cx - wc / 2, y0)} "
            f"C{pt(cx - wc / 2 - 1, y0 + 10)} {pt(cx - wm / 2, ym - 2)} {pt(cx - wm / 2, ym + 4)} "
            f"C{pt(cx - we / 2 - 2, y1 - 14)} {pt(cx - 5, y1 - 3)} {pt(cx, y1)} "
            f"C{pt(cx + 5, y1 - 3)} {pt(cx + we / 2 + 2, y1 - 14)} {pt(cx + wm / 2, ym + 4)} "
            f"C{pt(cx + wm / 2, ym - 2)} {pt(cx + wc / 2 + 1, y0 + 10)} {pt(cx + wc / 2, y0)} Z"
        )
    if spec.get("occlusal"):
        # Flared body into a rounded occlusal table.
        r = 5
        return (
            f"M{pt(cx - wc / 2, y0)} "
            f"C{pt(cx - wc / 2 - 2, y0 + 8)} {pt(cx - wm / 2, ym)} {pt(cx - wm / 2, ym + 4)} "
            f"C{pt(cx - wm / 2, y1 - 10)} {pt(cx - we / 2, y1 - r)} {pt(cx - we / 2 + r, y1)} "
            f"L{pt(cx + we / 2 - r, y1)} "
            f"C{pt(cx + we / 2, y1 - r)} {pt(cx + wm / 2, y1 - 10)} {pt(cx + wm / 2, ym + 4)} "
            f"C{pt(cx + wm / 2, ym)} {pt(cx + wc / 2 + 2, y0 + 8)} {pt(cx + wc / 2, y0)} Z"
        )
    # Incisor: almost flat incisal with a slight bow.
    bow = y1 - 1.2
    return (
        f"M{pt(cx - wc / 2, y0)} "
        f"C{pt(cx - wc / 2 - 1, y0 + 12)} {pt(cx - wm / 2, ym)} {pt(cx - wm / 2, ym + 2)} "
        f"C{pt(cx - wm / 2, ym + 12)} {pt(cx - we / 2, y1 - 5)} {pt(cx - we / 2 + 1.5, y1)} "
        f"Q{pt(cx, bow)} {pt(cx + we / 2 - 1.5, y1)} "
        f"C{pt(cx + we / 2, y1 - 5)} {pt(cx + wm / 2, ym + 12)} {pt(cx + wm / 2, ym + 2)} "
        f"C{pt(cx + wm / 2, ym)} {pt(cx + wc / 2 + 1, y0 + 12)} {pt(cx + wc / 2, y0)} Z"
    )


def path_occlusal_table(layout: dict) -> str | None:
    spec = layout["spec"]
    if not spec.get("occlusal"):
        return None
    cx, y1 = layout["cx"], layout["occlusal_y"]
    w = spec["edge"] - 8
    h = 9 if layout["ttype"] == "molar" else 7
    x0, y0 = cx - w / 2, y1 - h - 2
    rx = 3.5
    return (
        f"M{pt(x0 + rx, y0)} L{pt(x0 + w - rx, y0)} Q{pt(x0 + w, y0)} {pt(x0 + w, y0 + rx)} "
        f"L{pt(x0 + w, y0 + h - rx)} Q{pt(x0 + w, y0 + h)} {pt(x0 + w - rx, y0 + h)} "
        f"L{pt(x0 + rx, y0 + h)} Q{pt(x0, y0 + h)} {pt(x0, y0 + h - rx)} "
        f"L{pt(x0, y0 + rx)} Q{pt(x0, y0)} {pt(x0 + rx, y0)} Z"
    )


def path_highlight(layout: dict) -> str:
    """Soft specular streak on the upper-left of the buccal face."""
    y0, y1 = layout["cervix_y"], layout["occlusal_y"]
    cx = layout["cx"]
    w = layout["spec"]["mid"]
    x = cx - w / 2 + 6
    top = y0 + 8
    bot = y0 + (y1 - y0) * 0.55
    return (
        f"M{pt(x, top)} C{pt(x + 7, top + 2)} {pt(x + 8, bot - 8)} {pt(x + 3, bot)} "
        f"C{pt(x + 1, bot - 10)} {pt(x - 1, top + 10)} {pt(x, top)} Z"
    )


def surface_anchor(layout: dict, letter: str) -> tuple[float, float]:
    """Canonical (upper-right) position for a surface mark."""
    cx, y0, y1 = layout["cx"], layout["cervix_y"], layout["occlusal_y"]
    mid_y = y0 + (y1 - y0) * 0.4
    w = layout["spec"]["mid"]
    if letter in ("O", "I"):
        return (cx, y1 - 6)
    if letter == "B":
        return (cx, mid_y)
    if letter == "L":
        return (cx, y1 - 16)
    if letter == "M":
        return (cx + w / 2 - 7, mid_y + 4)
    return (cx - w / 2 + 7, mid_y + 4)  # D


def anatomy_transform(fdi: int) -> str:
    """Flip canonical upper-right anatomy into the tooth's quadrant."""
    parts = []
    # Center of the 100x160 cell is (50, 80).
    if not is_right_quad(quadrant_of(fdi)):
        parts.append("translate(100,0) scale(-1,1)")
    if arch_of(fdi) == "lower":
        parts.append("translate(0,160) scale(1,-1)")
    return " ".join(parts)


def dots_at(x: float, y: float, color: str, n: int = 5, r: float = 1.7, spread: float = 5.5) -> str:
    # A tight cluster, not colour alone.
    offsets = {
        3: [(-spread, 0), (0, 0), (spread, 0)],
        4: [(0, -spread * 0.6), (-spread, 0.4), (spread, 0.4), (0, spread * 0.7)],
        5: [(0, 0), (-spread, -1), (spread, -1), (-spread * 0.6, spread * 0.8), (spread * 0.6, spread * 0.8)],
    }[n]
    return "".join(
        f'<circle class="cond-mark" cx="{fmt(x + dx)}" cy="{fmt(y + dy)}" r="{fmt(r)}" fill="{color}"/>'
        for dx, dy in offsets
    )


def patch_at(x: float, y: float, color: str, w: float = 12, h: float = 9) -> str:
    return (
        f'<rect class="cond-mark" x="{fmt(x - w/2)}" y="{fmt(y - h/2)}" '
        f'width="{fmt(w)}" height="{fmt(h)}" rx="2.5" fill="{color}"/>'
    )


def tooth3d_anatomy(
    fdi: int,
    surface_conditions: dict[str, str] | None = None,
    whole_condition: str | None = None,
) -> str:
    layout = tooth3d_layout(fdi)
    surface_conditions = surface_conditions or {}
    y0, y1 = layout["cervix_y"], layout["occlusal_y"]
    cx = layout["cx"]
    ink = "#6F5E4A"
    parts = []
    # Soft contact shadow at the bite end (in canonical space, near occlusal).
    parts.append(
        f'<ellipse cx="{fmt(cx + 2)}" cy="{fmt(y1 + 4)}" rx="26" ry="7" fill="url(#soft-shadow)"/>'
    )
    hide_roots = whole_condition == "implan"
    hide_crown = whole_condition in ("sisa_akar", "implan")
    faint_crown = whole_condition == "sisa_akar"

    if not hide_roots:
        for base_x, tip_x, tip_y, base_w, behind in layout["roots"]:
            fill = "url(#root-back)" if behind else "url(#root-grad)"
            parts.append(
                f'<path d="{path_root(base_x, y0 + 1, tip_x, tip_y, base_w)}" '
                f'fill="{fill}" stroke="{ink}" stroke-width="1.05" stroke-linejoin="round"/>'
            )
        # Soft cervix cap so roots meet the crown cleanly.
        cw = layout["spec"]["cervix"] + 2
        parts.append(
            f'<ellipse cx="{fmt(cx)}" cy="{fmt(y0)}" rx="{fmt(cw / 2)}" ry="5.5" '
            f'fill="url(#enamel)" stroke="{ink}" stroke-width="0.8"/>'
        )

    if whole_condition == "implan":
        # Screw replacing roots, plus a simple prosthetic crown.
        tip = min(r[2] for r in layout["roots"]) if layout["roots"] else 14
        parts.append(
            f'<path d="M{pt(cx - 6, y0)} L{pt(cx - 6, tip + 12)} L{pt(cx, tip)} L{pt(cx + 6, tip + 12)} L{pt(cx + 6, y0)} Z" '
            f'fill="url(#implant-grad)" stroke="#0F5F63" stroke-width="1.1"/>'
        )
        for ty in (y0 - 10, y0 - 20, y0 - 30, y0 - 40):
            if ty > tip + 10:
                parts.append(
                    f'<path d="M{pt(cx - 8, ty)} L{pt(cx + 8, ty)}" fill="none" stroke="#0F5F63" '
                    f'stroke-width="1.6" stroke-linecap="round"/>'
                )
        # Abutment + prosthetic crown
        parts.append(
            f'<rect x="{fmt(cx - 8)}" y="{fmt(y0 - 2)}" width="16" height="8" rx="1.5" '
            f'fill="#5F7468" stroke="#0F5F63" stroke-width="0.9"/>'
        )
        parts.append(
            f'<path d="{path_crown(layout)}" fill="url(#prosthetic)" stroke="{ink}" '
            f'stroke-width="1.15" stroke-linejoin="round"/>'
        )
        occ = path_occlusal_table(layout)
        if occ:
            parts.append(
                f'<path d="{occ}" fill="url(#enamel-occlusal)" stroke="{ink}" stroke-width="0.8"/>'
            )

    if faint_crown:
        parts.append(
            f'<path d="{path_crown(layout)}" fill="url(#enamel)" fill-opacity="0.18" '
            f'stroke="{ink}" stroke-width="1" stroke-dasharray="3 2" stroke-linejoin="round"/>'
        )
        # Cervical cut line
        w = layout["spec"]["cervix"]
        parts.append(
            f'<path d="M{pt(cx - w/2 - 2, y0)} L{pt(cx + w/2 + 2, y0)}" fill="none" '
            f'stroke="{CONDITIONS["sisa_akar"]["color"]}" stroke-width="2.2" stroke-linecap="round"/>'
        )

    if not hide_crown and not faint_crown:
        opacity = "0.35" if whole_condition == "hilang" else "1"
        parts.append(
            f'<path d="{path_crown(layout)}" fill="url(#enamel)" fill-opacity="{opacity}" '
            f'stroke="{ink}" stroke-width="1.15" stroke-linejoin="round"/>'
        )
        occ = path_occlusal_table(layout)
        if occ:
            parts.append(
                f'<path d="{occ}" fill="url(#enamel-occlusal)" fill-opacity="{opacity}" '
                f'stroke="{ink}" stroke-width="0.85"/>'
            )
        if whole_condition != "hilang":
            parts.append(
                f'<path d="{path_highlight(layout)}" fill="#FFFFFF" fill-opacity="0.42"/>'
            )

        # Per-surface condition marks (inside the flip group, so M/D stay correct).
        for letter, cond in surface_conditions.items():
            ax, ay = surface_anchor(layout, letter)
            if cond == "karies":
                n = 3 if letter in ("I",) else 5
                parts.append(dots_at(ax, ay, CONDITIONS["karies"]["color"], n=n, r=1.8, spread=4.6))
            elif cond == "tambalan":
                w, h = (14, 8) if letter in ("O",) else (10, 8)
                if letter == "I":
                    w, h = 16, 5
                parts.append(patch_at(ax, ay, CONDITIONS["tambalan"]["color"], w, h))
            elif cond == "sehat":
                # Tiny check, does not compete with a healthy default tooth.
                parts.append(
                    f'<path class="cond-mark" d="M{pt(ax - 3, ay)} L{pt(ax - 0.5, ay + 3)} L{pt(ax + 4, ay - 3)}" '
                    f'fill="none" stroke="{CONDITIONS["sehat"]["color"]}" stroke-width="1.6" '
                    f'stroke-linecap="round"/>'
                )

        if whole_condition == "mahkota":
            # Cap over the crown, slightly outset.
            cap = path_crown(layout)
            parts.append(
                f'<path d="{cap}" fill="none" stroke="{CONDITIONS["mahkota"]["color"]}" '
                f'stroke-width="3.2" stroke-linejoin="round"/>'
            )
            # A slightly shorter inner wash so it reads as a shell.
            parts.append(
                f'<path d="{cap}" fill="url(#cap-grad)" fill-opacity="0.22" stroke="none"/>'
            )

        if whole_condition == "perlu_dicabut":
            parts.append(
                f'<path d="M{pt(cx - 22, y1 - 4)} L{pt(cx + 22, y0 + 6)}" fill="none" '
                f'stroke="{CONDITIONS["perlu_dicabut"]["color"]}" stroke-width="3" '
                f'stroke-linecap="square"/>'
            )
            # Small arrow head at the upper end (toward the roots).
            parts.append(
                f'<path d="M{pt(cx + 22, y0 + 6)} L{pt(cx + 14, y0 + 3)} L{pt(cx + 18, y0 + 13)}" '
                f'fill="none" stroke="{CONDITIONS["perlu_dicabut"]["color"]}" stroke-width="3" '
                f'stroke-linejoin="round" stroke-linecap="round"/>'
            )

        if whole_condition == "hilang":
            parts.append(
                f'<path d="M{pt(cx - 18, y0 + 6)} L{pt(cx + 18, y1 - 4)} '
                f'M{pt(cx + 18, y0 + 6)} L{pt(cx - 18, y1 - 4)}" fill="none" '
                f'stroke="{CONDITIONS["hilang"]["color"]}" stroke-width="3.2" stroke-linecap="square"/>'
            )

    return "".join(parts)


def tooth3d_group(
    fdi: int,
    state: str = "empty",
    surface_conditions: dict[str, str] | None = None,
    whole_condition: str | None = None,
    status: str | None = None,
    baseline: str | None = None,
    show_number: bool = False,
) -> str:
    ttype = tooth_type(fdi)
    dent = dentition_of(fdi)
    classes = f"tooth tooth-3d tooth--{ttype} tooth--{dent}"
    attrs = (
        f'id="t{fdi}" class="{classes}" data-tooth="{fdi}" data-type="{ttype}" '
        f'data-dentition="{dent}" data-arch="{arch_of(fdi)}" data-quadrant="{quadrant_of(fdi)}" '
        f'data-roots="{root_count(fdi)}" data-state="{state}"'
    )
    if whole_condition:
        attrs += f' data-condition="{whole_condition}"'
    if status:
        attrs += f' data-status="{status}"'
    if baseline:
        attrs += f' data-baseline="{baseline}"'
    tf = anatomy_transform(fdi)
    tf_attr = f' transform="{tf}"' if tf else ""
    parts = [f'<g {attrs}>']
    parts.append(f'<g class="anatomy"{tf_attr}>')
    parts.append(tooth3d_anatomy(fdi, surface_conditions, whole_condition))
    parts.append("</g>")
    # Frame, status, draft, lock — not flipped, so badges stay readable.
    if state in ("draft", "signed"):
        parts.append(
            f'<rect class="tooth-3d-frame" x="6" y="4" width="88" height="152" rx="14"/>'
        )
    if state == "draft":
        parts.append(draft_mark(8, 8))
    if state == "signed":
        parts.append(lock_glyph(76, 4, 0.7))
    if status:
        parts.append(status_marker(status, 8, 22, 11))
    if show_number:
        # Numbers sit below lower teeth / above upper teeth in the full chart,
        # not inside the anatomy. For standalone files, put the number at the
        # open end (away from the roots).
        ny = 12 if arch_of(fdi) == "lower" else 154
        parts.append(
            f'<text class="tooth-number" x="50" y="{fmt(ny)}" font-size="11">{fdi}</text>'
        )
    # Whole-tooth hit target (3D click selects the tooth, not a surface).
    parts.append(
        f'<rect class="tooth-hit" x="8" y="6" width="84" height="148" rx="12">'
        f'<title>Pilih gigi {fdi}</title></rect>'
    )
    parts.append("</g>")
    return "".join(parts)


def emit_tooth3d_svg(fdi: int) -> str:
    title = (
        f"Gigi FDI {fdi} (grafis 3D, {tooth_type(fdi)}, {dentition_of(fdi)}, "
        f"{arch_of(fdi)}, {root_count(fdi)} akar)"
    )
    return (
        xml_header(f"0 0 {T3_W} {T3_H}", "100", "160", title)
        + f"  <desc>Bagan grafis 3D lembut. Ketuk untuk memilih gigi {fdi}, bukan per permukaan. "
        + "Sasaran ketuk per permukaan ada di bagan 2D.</desc>\n"
        + style_block()
        + defs_3d()
        + f"  {tooth3d_group(fdi, show_number=True)}\n"
        + "</svg>\n"
    )


def emit_full_chart_3d() -> str:
    # Taller cells than the 2D chart.
    cell_w, cell_h = 58, 96
    gap_x, mid, margin_l, margin_r, margin_top = 7, 24, 108, 64, 70
    num_h, row_gap, opening = 16, 8, 36

    def x_of(col: int) -> float:
        if col < 8:
            return margin_l + col * (cell_w + gap_x)
        return margin_l + 8 * (cell_w + gap_x) - gap_x + mid + (col - 8) * (cell_w + gap_x)

    def arch_offset(fdi: int) -> float:
        pos = fdi % 10
        mag = 7 * (1 - (pos - 1) / 7) ** 1.15
        return mag if arch_of(fdi) == "upper" else -mag

    y = margin_top
    y_num_up_perm = y
    y_up_perm = y_num_up_perm + num_h
    y_num_up_prim = y_up_perm + cell_h + row_gap
    y_up_prim = y_num_up_prim + num_h
    y_lo_prim = y_up_prim + cell_h + opening
    y_num_lo_prim = y_lo_prim + cell_h + 2
    y_lo_perm = y_num_lo_prim + num_h + row_gap
    y_num_lo_perm = y_lo_perm + cell_h + 2
    height = y_num_lo_perm + 72
    width = x_of(15) + cell_w + margin_r
    mid_x = (x_of(7) + cell_w + x_of(8)) / 2
    scale = cell_h / T3_H
    # After scaling height to cell_h, width is 100*scale; center in cell_w.
    x_adjust = (cell_w - T3_W * scale) / 2
    y_side = (y_up_perm + y_lo_perm + cell_h) / 2

    rows = [
        ("upper", "permanent",
         [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
         y_up_perm, y_num_up_perm + 12),
        ("upper", "primary",
         [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
         y_up_prim, y_num_up_prim + 12),
        ("lower", "primary",
         [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
         y_lo_prim, y_num_lo_prim + 12),
        ("lower", "permanent",
         [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
         y_lo_perm, y_num_lo_perm + 12),
    ]

    parts = [
        xml_header(f"0 0 {fmt(width)} {fmt(height)}", fmt(width), fmt(height),
                   "Odontogram Bitto — bagan grafis 3D lembut, penomoran FDI",
                   extra_attr='data-dentition="mixed"'),
        "  <desc>Bagan grafis, pandangan operator (kanan pasien di kiri). "
        "Akar atas ke atas, akar bawah ke bawah. Ketuk gigi untuk memilih gigi; "
        "isian per permukaan memakai bagan 2D. Gaya sendiri, bukan salinan Open Dental.</desc>\n",
        style_block(
            "  .chart-title { font-weight: 700; font-size: 20px; fill: #111827; }\n"
            "  .chart-sub { font-size: 11px; fill: #4B5563; }\n"
            "  .chart-side { font-size: 11px; fill: #6B7280; font-weight: 600; letter-spacing: 0.04em; }\n"
            "  .chart-row { font-size: 10px; fill: #6B7280; font-weight: 600; }\n"
            "  .chart-mid { stroke: #9CA3AF; stroke-width: 1; }\n"
        ),
        defs_3d(),
        f'  <rect width="{fmt(width)}" height="{fmt(height)}" fill="{PAPER}"/>\n',
        f'  <text class="chart-title" x="{margin_l}" y="28" font-family="{FONT}">Odontogram grafis</text>\n',
        f'  <text class="chart-sub" x="{margin_l}" y="46" font-family="{FONT}">'
        "Penomoran FDI · pandangan operator (kanan pasien di kiri). "
        "Bagan 3D untuk tampilan; ketuk gigi untuk memilih. Isian per permukaan di bagan 2D. "
        "Legenda internal, bukan formulir resmi Kemenkes/PDGI.</text>\n",
        f'  <line class="chart-mid" x1="{fmt(mid_x)}" y1="{fmt(y_num_up_perm - 4)}" '
        f'x2="{fmt(mid_x)}" y2="{fmt(y_num_lo_perm + 16)}"/>\n',
        f'  <text class="chart-side" x="20" y="{fmt(y_side)}" text-anchor="middle" '
        f'transform="rotate(90 20 {fmt(y_side)})" font-family="{FONT}">KANAN PASIEN</text>\n',
        f'  <text class="chart-side" x="{fmt(width - 20)}" y="{fmt(y_side)}" text-anchor="middle" '
        f'transform="rotate(90 {fmt(width - 20)} {fmt(y_side)})" font-family="{FONT}">KIRI PASIEN</text>\n',
        f'  <text class="chart-row" x="{fmt(margin_l - 12)}" y="{fmt(y_up_perm + cell_h / 2 + 3)}" '
        f'text-anchor="end" font-family="{FONT}">Tetap</text>\n'
        f'  <text class="chart-row" x="{fmt(margin_l - 12)}" y="{fmt(y_up_prim + cell_h / 2 + 3)}" '
        f'text-anchor="end" font-family="{FONT}">Sulung</text>\n'
        f'  <text class="chart-row" x="{fmt(margin_l - 12)}" y="{fmt(y_lo_prim + cell_h / 2 + 3)}" '
        f'text-anchor="end" font-family="{FONT}">Sulung</text>\n'
        f'  <text class="chart-row" x="{fmt(margin_l - 12)}" y="{fmt(y_lo_perm + cell_h / 2 + 3)}" '
        f'text-anchor="end" font-family="{FONT}">Tetap</text>\n',
    ]

    for arch, dent, teeth, y_tooth, y_num in rows:
        for fdi in teeth:
            x = x_of(tooth_col(fdi)) + x_adjust
            y_t = y_tooth + arch_offset(fdi)
            parts.append(
                f'  <g transform="translate({fmt(x)} {fmt(y_t)}) scale({fmt(scale)})">\n'
                f"    {tooth3d_group(fdi)}\n"
                "  </g>\n"
            )
            # Numbers stay on the row, not on the arched offset, for a clean line.
            parts.append(
                f'  <text class="tooth-number" x="{fmt(x_of(tooth_col(fdi)) + cell_w / 2)}" '
                f'y="{fmt(y_num)}" font-size="11" font-family="{FONT_NUM}">{fdi}</text>\n'
            )

    parts.append(
        f'  <text class="chart-sub" x="{margin_l}" y="{fmt(height - 14)}" font-family="{FONT}">'
        "Akar: insisor/kaninus 1; premolar 1 (14 dan 24: 2); molar atas 3, molar bawah 2. "
        "Gigi sulung lebih kecil. Gaya sendiri, bukan salinan Open Dental.</text>\n"
        "</svg>\n"
    )
    return "".join(parts)


def emit_conditions_row_3d() -> str:
    """All legend conditions painted on a molar (16) and an incisor (11)."""
    items = [
        ("sehat", None, {"O": "sehat"} if False else {"B": "sehat"}),
        ("karies", None, {"O": "karies"}),
        ("tambalan", None, {"O": "tambalan"}),
        ("mahkota", "mahkota", {}),
        ("hilang", "hilang", {}),
        ("sisa_akar", "sisa_akar", {}),
        ("perlu_dicabut", "perlu_dicabut", {}),
        ("implan", "implan", {}),
    ]
    # For incisor, use I instead of O.
    w, h = 1080, 520
    col_w = 126
    parts = [
        xml_header(f"0 0 {w} {h}", str(w), str(h), "Kondisi pada gigi 3D — molar 16 dan insisor 11"),
        style_block(
            "  .sheet-title { font-weight: 700; font-size: 20px; fill: #111827; }\n"
            "  .sheet-sub { font-size: 11px; fill: #4B5563; }\n"
            "  .sheet-cap { font-size: 11px; fill: #1F2937; font-weight: 600; text-anchor: middle; }\n"
        ),
        defs_3d(),
        f'  <rect width="{w}" height="{h}" fill="{PAPER}"/>\n',
        f'  <text class="sheet-title" x="32" y="32" font-family="{FONT}">Kondisi pada bagan grafis 3D</text>\n',
        f'  <text class="sheet-sub" x="32" y="50" font-family="{FONT}">'
        "Molar 16 (atas) dan insisor 11 (atas). Legenda internal, bukan standar resmi Kemenkes/PDGI. "
        "Karies di oklusal/insisal; kondisi seluruh gigi menutupi mahkota atau akar.</text>\n",
    ]
    for row, fdi in enumerate((16, 11)):
        y = 70 + row * 220
        label = "Molar 16" if fdi == 16 else "Insisor 11"
        parts.append(
            f'  <text class="sheet-sub" x="32" y="{y + 8}" font-family="{FONT}" font-weight="600">{label}</text>\n'
        )
        for i, (key, whole, surfaces) in enumerate(items):
            sc = dict(surfaces)
            if fdi == 11 and "O" in sc:
                sc = {"I": sc["O"]}
            x = 24 + i * col_w
            parts.append(f'  <g transform="translate({x} {y + 12}) scale(1.05)">\n')
            # unique ids: temporarily avoid duplicate t16 ids by wrapping without reusing id... 
            # Multiple t16 in one file is invalid. Emit with a suffix via a local rewrite.
            g = tooth3d_group(fdi, surface_conditions=sc, whole_condition=whole)
            g = g.replace(f'id="t{fdi}"', f'id="t{fdi}-{key}"', 1)
            parts.append("    " + g + "\n  </g>\n")
            parts.append(
                f'  <text class="sheet-cap" x="{x + 50}" y="{y + 196}" font-family="{FONT}">'
                f"{esc(CONDITIONS[key]['label'])}</text>\n"
            )
    parts.append("</svg>\n")
    return "".join(parts)


def emit_statuses_sheet() -> str:
    """2D status layer examples — kemungkinan MVP, menunggu persetujuan Jerome."""
    keys = list(STATUSES.keys())
    w, h = 920, 440
    parts = [
        xml_header(f"0 0 {w} {h}", str(w), str(h), "Status tindakan odontogram (kemungkinan MVP)"),
        style_block(
            "  .sheet-title { font-weight: 700; font-size: 20px; fill: #111827; }\n"
            "  .sheet-sub { font-size: 11px; fill: #4B5563; }\n"
            "  .sheet-cap { font-size: 11px; fill: #1F2937; font-weight: 600; text-anchor: middle; }\n"
            "  .sheet-hint { font-size: 10px; fill: #6B7280; text-anchor: middle; }\n"
        ),
        f'  <rect width="{w}" height="{h}" fill="{PAPER}"/>\n',
        f'  <text class="sheet-title" x="32" y="32" font-family="{FONT}">Status tindakan</text>\n',
        f'  <text class="sheet-sub" x="32" y="50" font-family="{FONT}">'
        "Kemungkinan MVP, menunggu persetujuan Jerome. Lapisan terpisah dari kondisi "
        "(semua contoh memakai karies di O + tambalan di M). data-status pada .tooth.</text>\n",
    ]
    for i, key in enumerate(keys):
        x = 30 + i * 148
        y = 80
        g = tooth_group(
            16,
            surface_conditions={"O": "karies", "M": "tambalan"},
            status=key,
        )
        g = g.replace('id="t16"', f'id="t16-status-{key}"', 1)
        g = g.replace('id="t16-', f'id="t16s{i}-')
        parts.append(f'  <g transform="translate({x} {y}) scale(1.15)">\n    {g}\n  </g>\n')
        parts.append(
            f'  <text class="sheet-cap" x="{x + 58}" y="{y + 140}" font-family="{FONT}">'
            f"{esc(STATUSES[key]['label'])}</text>\n"
            f'  <text class="sheet-hint" x="{x + 58}" y="{y + 156}" font-family="{FONT}">'
            f'data-status="{key}"</text>\n'
        )
    # Baseline missing example on the right of a second strip? Room at the bottom.
    g_miss = tooth_group(16, baseline="missing")
    g_miss = g_miss.replace('id="t16"', 'id="t16-baseline-missing"', 1)
    g_miss = g_miss.replace('id="t16-', 'id="t16b-')
    parts.append(f'  <g transform="translate(30 280) scale(0.95)">\n    {g_miss}\n  </g>\n')
    parts.append(
        f'  <text class="sheet-sub" x="150" y="330" font-family="{FONT}" font-weight="600">'
        "Baseline: data-baseline=\"missing\" (kunjungan pertama, bukan temuan hilang)</text>\n"
        f'  <text class="sheet-sub" x="150" y="348" font-family="{FONT}">'
        "Kemungkinan MVP, menunggu persetujuan Jerome. Bagan: data-dentition=\"permanent|primary|mixed\".</text>\n"
        "</svg>\n"
    )
    return "".join(parts)


# ---------------------------------------------------------------------------
# Preview (headless Chrome)
# ---------------------------------------------------------------------------
def emit_preview_html(svg_name: str, width: int, height: int) -> str:
    return (
        "<!doctype html>\n<meta charset=\"utf-8\">\n"
        "<title>preview</title>\n"
        "<style>html,body{margin:0;background:#fff;} img{display:block;}</style>\n"
        f'<img src="../{svg_name}" width="{width}" height="{height}" alt="">\n'
    )


def screenshot(html: Path, dest: Path, width: int, height: int) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Device scale 2 for a sharper PNG. Window matches the content size.
    cmd = [
        CHROME,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--hide-scrollbars",
        "--force-device-scale-factor=2",
        f"--window-size={width},{height}",
        "--default-background-color=FFFFFF",
        f"--screenshot={dest}",
        html.resolve().as_uri(),
    ]
    subprocess.run(cmd, check=True, capture_output=True, text=True)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def generate(preview: bool = True) -> None:
    assert_contrast()
    # CSS + docs
    write(ROOT / "odontogram.css", CSS)
    write(ROOT / "README.md", README)
    write(ROOT / "legend.json", emit_legend_json())

    # Type templates
    types = [
        ("incisor", "permanent"),
        ("canine", "permanent"),
        ("premolar", "permanent"),
        ("molar", "permanent"),
        ("incisor", "primary"),
        ("canine", "primary"),
        ("molar", "primary"),
    ]
    for ttype, dent in types:
        write(ROOT / "types" / f"{ttype}-{dent}.svg", emit_type_svg(ttype, dent))

    # Per-tooth
    for fdi in ALL_TEETH:
        write(ROOT / "teeth" / f"t{fdi}.svg", emit_tooth_svg(fdi))

    # Full chart + legend
    full = emit_full_chart()
    write(ROOT / "odontogram-full.svg", full)
    write(ROOT / "legend.svg", emit_legend_sheet())
    for key in CONDITIONS:
        write(ROOT / "legend" / f"{key}.svg", emit_legend_symbol(key))

    # States
    for fdi in (16, 11):
        for state in ("empty", "draft", "signed"):
            write(ROOT / "states" / f"t{fdi}-{state}.svg", emit_state_svg(fdi, state))
    write(ROOT / "states" / "examples.svg", emit_states_sheet())
    write(ROOT / "states" / "statuses.svg", emit_statuses_sheet())

    # Soft 3D graphical chart
    for fdi in ALL_TEETH:
        write(ROOT / "3d" / f"t{fdi}.svg", emit_tooth3d_svg(fdi))
    write(ROOT / "3d" / "odontogram-3d-full.svg", emit_full_chart_3d())
    write(ROOT / "3d" / "conditions-row.svg", emit_conditions_row_3d())

    if preview:
        # Parse width/height from the SVGs we just wrote.
        def svg_size(name: str) -> tuple[int, int]:
            text = (ROOT / name).read_text()
            # width=".." height=".."
            import re
            m = re.search(r'width="([\d.]+)" height="([\d.]+)"', text)
            if not m:
                raise RuntimeError(f"no size in {name}")
            return int(math.ceil(float(m.group(1)))), int(math.ceil(float(m.group(2))))

        preview_dir = ROOT / "preview"
        preview_dir.mkdir(parents=True, exist_ok=True)
        for svg_name, png_name in (
            ("odontogram-full.svg", "odontogram-full.png"),
            ("legend.svg", "legend.png"),
            ("states/examples.svg", "states.png"),
            ("states/statuses.svg", "statuses.png"),
            ("3d/odontogram-3d-full.svg", "odontogram-3d-full.png"),
            ("3d/conditions-row.svg", "odontogram-3d-conditions.png"),
        ):
            w, h = svg_size(svg_name)
            html_name = png_name.replace(".png", ".html")
            # img src is relative to preview/
            src = "../" + svg_name
            html = (
                "<!doctype html>\n<meta charset=\"utf-8\">\n"
                "<style>html,body{margin:0;background:#fff;} img{display:block;}</style>\n"
                f'<img src="{src}" width="{w}" height="{h}" alt="">\n'
            )
            html_path = preview_dir / html_name
            write(html_path, html)
            screenshot(html_path, preview_dir / png_name, w, h)

    # Summary
    svgs = list(ROOT.rglob("*.svg"))
    print(f"Wrote {len(svgs)} SVGs under {ROOT}")
    print(f"Teeth 2D: {len(ALL_TEETH)}  3D: {len(ALL_TEETH)}  types: {len(types)}  legend icons: {len(CONDITIONS)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-preview", action="store_true")
    args = parser.parse_args()
    generate(preview=not args.no_preview)
