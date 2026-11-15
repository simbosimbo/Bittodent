#!/usr/bin/env python3
"""Papan odontogram v2 (revisi klinis): simbol resmi PDGI 2015, sel 2D 48px, palet pemeriksaan awal, gigi sulung.

Hasil: design/boards/odontogram-v2.html dan /workspace/artifacts/bittodent-board-odontogram-v2.html
Data sintetis. Tanpa JavaScript. Tidak mengubah kode app. Gaya HeroUI v3, token Bittodent.
Teal #0B6B62 hanya tombol primer; kontrol terpilih primary-800.
"""
from __future__ import annotations

import base64
import io
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "design/boards/odontogram-v2.html"
ART = Path("/workspace/artifacts/bittodent-board-odontogram-v2.html")
TOKENS = (ROOT / "design/tokens.css").read_text().replace("\u2014", "-")  # CSS comment only
PREVIEW = ROOT / "design/odontogram/preview"


def img_data_uri(name: str, max_w: int = 720) -> str:
    """Resize a preview PNG to width <=720 and return a WebP data URI."""
    im = Image.open(PREVIEW / name).convert("RGB")
    w, h = im.size
    if w > max_w:
        im = im.resize((max_w, int(round(h * max_w / w))), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="WEBP", quality=75, method=6)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/webp;base64,{b64}"


ICONS: dict[str, str] = {
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "x": '<path d="M18 6 6 18M6 6l12 12"/>',
    "chevron-left": '<path d="M15 18l-6-6 6-6"/>',
    "chevron-down": '<path d="M6 9l6 6 6-6"/>',
    "search": '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    "more": (
        '<circle cx="6" cy="12" r="1.15" fill="currentColor" stroke="none"/>'
        '<circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"/>'
        '<circle cx="18" cy="12" r="1.15" fill="currentColor" stroke="none"/>'
    ),
    "tooth": (
        '<path d="M8 4.5C8 3.1 9.6 2 12 2s4 1.1 4 2.5c0 .7-.2 1.4-.5 2 1.7.3 3 1.6 3.2 3.6.4 3.2-1 7.2-2.8 9.2-.6.7-1.7.3-1.7-.6 0-1.8-.3-3.2-.7-4.1-.3-.6-.9-.8-1.5-.4-.4.2-.8.2-1.2 0-.6-.4-1.2-.2-1.5.4-.4.9-.7 2.3-.7 4.1 0 .9-1.1 1.3-1.7.6-1.8-2-3.2-6-2.8-9.2.2-2 1.5-3.3 3.2-3.6-.3-.6-.5-1.3-.5-2z"/>'
    ),
    "star": (
        '<path d="M12 3.2 14.7 9l6.3.9-4.6 4.5 1.1 6.4L12 17.8 6.5 20.8l1.1-6.4L3 9.9 9.3 9z"/>'
    ),
    "clock": '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    "home": '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    "calendar": (
        '<rect x="3" y="4" width="18" height="18" rx="2"/>'
        '<path d="M16 2v4M8 2v4M3 10h18"/>'
    ),
    "users": (
        '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>'
        '<circle cx="9" cy="7" r="4"/>'
        '<path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'
    ),
    "info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
}


def ico(name: str, cls: str = "ic") -> str:
    return (
        f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        f'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" '
        f'aria-hidden="true">{ICONS[name]}</svg>'
    )


ICONS.update({
    "undo": '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    "list": '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    "queue": '<path d="M4 6h16M4 12h16M4 18h10"/>',
    "chev-r": '<path d="M9 18l6-6-6-6"/>',
})

INK = "#1A1A1A"
OPT = {"cof": "#15803D", "gif": "#15803D", "fis": "#DB2777", "gmc": "#D92D20"}  # warna opsional PDGI

CSS = r"""
:root{--motion-fast:120ms;--motion-std:200ms;--motion-slow:280ms;--motion-ease-standard:cubic-bezier(0.2,0,0,1);
  --sel:var(--color-primary-800);--sel-bg:var(--color-primary-50);--focus:2px solid var(--color-primary-800)}
*{box-sizing:border-box}
button{font-family:inherit}
html,body{margin:0;background:#E8EEF0;color:var(--color-neutral-800);font-family:var(--font-family-sans);-webkit-font-smoothing:antialiased}
body{padding:48px 40px 80px}
.wrap{max-width:1760px;margin:0 auto}
h1.page{font-size:28px;font-weight:700;letter-spacing:-.02em;margin:0 0 8px;color:var(--color-neutral-900)}
.lede{margin:0 0 40px;color:var(--color-neutral-600);font-size:14px;font-weight:500;max-width:880px;line-height:1.5}
.ab{margin:0 0 64px;width:max-content;padding:8px 8px 8px 16px}
.ab-k{display:flex;align-items:baseline;gap:12px;margin:0 0 8px}
.ab-n{font-size:12px;font-weight:700;letter-spacing:.08em;color:var(--color-primary-800)}
.ab-t{font-size:16px;font-weight:650;color:var(--color-neutral-800)}
.ab-d{font-size:12px;font-weight:500;color:var(--color-neutral-500);margin:0 0 16px;max-width:880px;line-height:1.5}
.row{display:flex;gap:24px;align-items:flex-start}
.ph-col{display:flex;flex-direction:column;gap:8px;flex:none}
.ph-cap{margin:0;font-size:12px;font-weight:600;color:var(--color-neutral-600);max-width:360px;line-height:1.4}
.ph-cap b{color:var(--color-neutral-800)}
.ic{width:20px;height:20px;flex:none}
.ic-btn{width:18px;height:18px}
.syn{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;background:#FFFAEB;color:#B54708;border:1px solid #F5C14A;font-size:10px;font-weight:700;letter-spacing:.04em}
.mu{font-size:12px;font-weight:500;color:var(--color-neutral-500);margin:0}
.k{font-size:12px;font-weight:700;color:var(--color-neutral-600);margin:0}
code,.code{font-family:var(--font-family-mono, ui-monospace, monospace);font-size:12px;font-weight:600;color:var(--color-neutral-600);text-transform:none}

/* HeroUI v3 button */
.button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 24px;border-radius:999px;border:0;
  font:600 14px/1 var(--font-family-sans);background:transparent;color:var(--color-neutral-800)}
.button--sm{min-height:40px;padding:0 16px;font-size:13px}
.button--primary{background:var(--color-primary-700);color:#fff}
.button--secondary{background:var(--color-neutral-100);color:var(--color-neutral-800)}
.button--ghost{color:var(--color-neutral-700)}
.button--icon{width:48px;height:48px;padding:0}
.button--full{width:100%}

/* Chip 28 */
.chip{display:inline-flex;align-items:center;gap:8px;height:28px;padding:0 12px;border-radius:999px;font-size:12px;font-weight:600;background:var(--color-neutral-100);color:var(--color-neutral-700)}

/* Phone */
.ph{width:360px;height:800px;background:#fff;border:1px solid var(--color-neutral-200);border-radius:32px;overflow:hidden;position:relative;display:flex;flex-direction:column;flex:none;box-shadow:0 8px 24px rgba(22,33,43,.06)}
.ph-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 24px 0;min-height:32px;font-size:12px;font-weight:600}
.hd{background:#fff;padding:0 8px 0 4px;display:flex;align-items:center;gap:8px;min-height:56px;border-bottom:1px solid var(--color-neutral-100)}
.hd h1{margin:0;font-size:18px;font-weight:700;flex:1}
.body{flex:1;background:var(--color-canvas);padding:16px;display:flex;flex-direction:column;gap:16px;min-height:0;overflow:hidden}
.bnav{flex:none;background:#fff;border-top:1px solid var(--color-neutral-200);padding:8px 4px 0}
.bnav-row{display:flex}
.navi{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-height:56px;padding-top:2px;font-size:12px;font-weight:600;color:var(--color-neutral-600);white-space:nowrap}
.navi .pill{width:56px;height:32px;border-radius:999px;display:grid;place-items:center}
.navi.on{color:var(--color-primary-800);font-weight:700}
.navi.on .pill{background:var(--color-primary-100)}
.safe{height:24px;display:grid;place-items:center}
.safe i{width:112px;height:4px;border-radius:4px;background:var(--color-neutral-800);opacity:.85}

/* Desktop */
.desk{width:1280px;background:#fff;border:1px solid var(--color-neutral-200);border-radius:16px;overflow:hidden;display:flex;flex:none;box-shadow:0 8px 24px rgba(22,33,43,.06)}
.rail{width:72px;background:#F4F7F7;border-right:1px solid var(--color-neutral-200);display:flex;flex-direction:column;align-items:center;padding:16px 8px;gap:8px;flex:none}
.rail .logo{width:40px;height:40px;border-radius:14px;background:var(--color-primary-700);color:#fff;display:grid;place-items:center;margin-bottom:8px}
.rbtn{width:56px;min-height:56px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:var(--color-neutral-600);font-size:11px;font-weight:700}
.rbtn.on{background:var(--color-primary-100);color:var(--color-primary-800)}
.dcol{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--color-canvas)}
.top{display:flex;align-items:center;justify-content:space-between;min-height:64px;padding:0 24px;background:#fff;border-bottom:1px solid var(--color-neutral-200);gap:16px}
.top h2{margin:0;font-size:18px;font-weight:700}
.crumb{font-size:12px;font-weight:600;color:var(--color-neutral-500)}
.dbody{flex:1;padding:24px;display:flex;flex-direction:column;gap:16px;min-height:0}

/* Tabs / segmented, 48 */
.tabs{display:flex;gap:4px;padding:4px;background:var(--color-neutral-100);border-radius:14px}
.tab{flex:1;min-height:48px;border:0;border-radius:10px;background:transparent;color:var(--color-neutral-600);font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 8px;white-space:nowrap}
.tab.on{background:#fff;color:var(--color-neutral-900);box-shadow:0 1px 2px rgba(22,33,43,.08)}
.tabs.fit .tab{flex:none;padding:0 16px}
.tab svg.st{width:18px;height:18px}
.tabs.stg .tab{padding:0 4px;gap:4px;font-size:12px}

/* 2D chart card */
.od{background:#fff;border:1px solid var(--color-neutral-200);border-radius:16px;padding:8px;display:flex;flex-direction:column;gap:8px}
.od-hd{display:flex;align-items:center;gap:8px;justify-content:space-between}
.od-hd h3{margin:0 0 0 8px;font-size:14px;font-weight:700}
.vp{position:relative;overflow:hidden;border-radius:10px;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 16px,#000 calc(100% - 16px),transparent 100%)}
.vp.full{-webkit-mask-image:none}
.vp.full .jaws{margin:0 auto}
.jaws{display:flex;flex-direction:column;gap:8px;width:max-content}
.jrow{display:grid;column-gap:4px}
.jrow .mid{width:8px;border-left:1.5px dashed var(--color-neutral-300);margin-left:3px}
.qlab{display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:var(--color-neutral-500);padding:0 8px}
.tc{width:48px;height:64px;border:1px solid transparent;border-radius:10px;background:#fff;padding:0;display:block;position:relative}
.tc svg{display:block;overflow:visible}
.tc.on{border:2px solid var(--sel);background:var(--sel-bg)}
.tc.ghost{visibility:hidden}
.minimap{display:flex;align-items:center;gap:8px;height:24px;padding:0 8px}
.mm{flex:1;height:8px;border-radius:999px;background:var(--color-neutral-100);position:relative}
.mm i{position:absolute;top:-4px;height:16px;border-radius:6px;border:2px solid var(--color-neutral-600);background:rgba(255,255,255,.4)}

/* Drawer */
.drawer{position:absolute;left:0;right:0;bottom:0;z-index:4;background:#fff;border-radius:16px 16px 0 0;box-shadow:0 -8px 32px rgba(22,33,43,.14);display:flex;flex-direction:column}
.drawer-handle{width:48px;height:4px;border-radius:999px;background:var(--color-neutral-300);margin:8px auto 0;flex:none}
.drawer-hd{display:flex;align-items:center;gap:8px;min-height:48px;padding:0 8px 0 16px}
.drawer-hd h3{margin:0;font-size:16px;font-weight:700;flex:1}
.drawer-bd{padding:0 16px 8px;display:flex;flex-direction:column;gap:8px}
.drawer-ft{padding:8px 16px 16px;border-top:1px solid var(--color-neutral-100);display:flex}
.drawer-ft .button--primary{flex:1}

/* Surface pads, 56, gap 8 */
.surf{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.surf b{min-height:56px;border-radius:14px;border:1px solid var(--color-neutral-200);background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:15px;font-weight:700;color:var(--color-neutral-700)}
.surf b small{font-size:10px;font-weight:600;color:var(--color-neutral-500)}
.surf b.on{border:2px solid var(--sel);background:var(--sel-bg);color:var(--sel)}

/* RadioGroup cards 2 col, Listbox: official symbol 28 */
.rcards{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.rc{display:flex;align-items:center;gap:8px;min-height:48px;padding:0 12px 0 8px;border-radius:14px;border:1px solid var(--color-neutral-200);background:#fff;font-size:13px;font-weight:600;color:var(--color-neutral-800)}
.rc span:not(.code){text-align:left;line-height:1.2}
.rc .code{margin-left:auto}
.rc.on{border:2px solid var(--sel);background:var(--sel-bg);padding:0 11px 0 7px}
.rc.on .code{color:var(--sel)}
.rc.more{justify-content:center;color:var(--color-neutral-700)}
.sym{width:28px;height:28px;flex:none;display:block}
.list{display:flex;flex-direction:column;gap:4px}
.litem{display:flex;align-items:center;gap:12px;min-height:48px;padding:0 12px 0 8px;border-radius:10px;font-size:14px;font-weight:600;color:var(--color-neutral-800)}
.litem .code{margin-left:auto}
.litem .ck{width:20px;height:20px;color:transparent}
.litem.on{background:var(--sel-bg);color:var(--color-neutral-900)}
.litem.on .ck{color:var(--sel)}
.roles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}

/* Palette dock */
.dock{position:absolute;left:0;right:0;bottom:0;background:#fff;border-top:1px solid var(--color-neutral-200);border-radius:16px 16px 0 0;box-shadow:0 -8px 24px rgba(22,33,43,.10);padding:8px 16px 0;display:flex;flex-direction:column;gap:8px;z-index:4}
.tools{display:flex;gap:8px;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,#000 85%,transparent)}
.tool{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:56px;min-height:56px;border-radius:14px;border:1px solid var(--color-neutral-200);background:#fff}
.tool .code{font-size:11px}
.tool.on{border:2px solid var(--sel);background:var(--sel-bg)}
.tool.on .code{color:var(--sel)}
.pop{position:absolute;left:16px;right:16px;z-index:5;background:#fff;border:1px solid var(--color-neutral-200);border-radius:16px;box-shadow:0 8px 24px rgba(22,33,43,.14);padding:12px;display:flex;flex-direction:column;gap:8px}
.toast{position:absolute;left:16px;right:16px;min-height:48px;border-radius:14px;background:var(--color-neutral-900);color:#fff;display:flex;align-items:center;gap:12px;padding:4px 4px 4px 16px;font-size:14px;font-weight:600;z-index:6}
.toast .tx{flex:1}
.toast .button{color:#A8E0D9;min-height:40px;padding:0 12px}

/* Legend / tables */
.leg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.leg-card{background:#fff;border:1px solid var(--color-neutral-200);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:4px}
.leg-card h3{margin:0 0 4px;font-size:14px;font-weight:700}
.leg-item{display:flex;align-items:center;gap:12px;min-height:36px;font-size:13px;font-weight:600}
.leg-item .code{margin-left:auto}
.leg-item .ex{margin-left:auto;font-family:var(--font-family-mono, ui-monospace, monospace);font-size:12px;color:var(--color-neutral-700)}
.tbl{border-collapse:separate;border-spacing:0;background:#fff;border:1px solid var(--color-neutral-200);border-radius:16px;overflow:hidden;font-size:13px}
.tbl th,.tbl td{padding:0 16px;height:48px;text-align:left;border-bottom:1px solid var(--color-neutral-100);font-weight:600}
.tbl th{background:var(--color-neutral-50);font-size:12px;color:var(--color-neutral-600)}
.tbl tr:last-child td{border-bottom:0}
.tbl td.n{font:700 16px/1 var(--font-family-sans)}
.tbl td.win{color:var(--color-success-fg)}
.view-3d{width:100%;border-radius:16px;border:1px solid var(--color-neutral-200);background:#fff;object-fit:contain;max-height:440px;display:block}
.note-ro{display:flex;align-items:center;gap:8px;min-height:48px;padding:0 16px;border-radius:14px;background:var(--color-neutral-50);border:1px solid var(--color-neutral-200);color:var(--color-neutral-700);font-size:12px;font-weight:600}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none !important;transition:none !important}}
"""

# ---------------- Taxonomy, Panduan RM Kedokteran Gigi Kemenkes-PDGI 2015 ----------------
# (label, code, kind) kind: draw rule used by glyph()
PERM = [  # wajib permukaan MODVL
    ("Karies", "car"), ("Tambalan amalgam", "amf"), ("Tambalan komposit", "cof"), ("Tambalan GIC", "gif"),
    ("Sealant", "fis"), ("Inlay", "inl"), ("Onlay", "onl"), ("Fraktur mahkota", "cfr"), ("Abrasi", "abr"), ("Atrisi", "att"),
]
WHOLE = [
    ("Gigi non-vital", "nvt"), ("Perawatan saluran akar", "rct"), ("Mahkota logam", "fmc"), ("Mahkota porselen", "poc"),
    ("Mahkota metal porselen", "mpc"), ("Mahkota emas", "gmc"), ("Sisa akar", "rrx"), ("Gigi hilang", "mis"),
    ("Tidak ada, tidak diketahui", "non"), ("Belum erupsi", "une"), ("Erupsi sebagian", "pre"), ("Impaksi visible", "imv"),
    ("Anomali", "ano"), ("Diastema", "dia"), ("Migrasi atau rotasi", "panah"),
]
SPAN = [("Jembatan logam", "meb"), ("Jembatan porselen", "pob"), ("Gigi tiruan sebagian", "prd"), ("Gigi tiruan lengkap", "fld")]
ROLES = [("Pontik", "pon"), ("Gigi penyangga", "abu"), ("Akrilik (bahan protesa)", "acr"), ("Frame (bahan protesa)", "frm")]
IMPL = [("Implan", "ipx")]
FREE = ["erosi", "goyang", "veneer", "splint", "bracket orto", "sulung persisten"]
LABEL = {c: l for l, c in PERM + WHOLE + SPAN + ROLES + IMPL}
LABEL["sou"] = "Sehat"
SHORT = {"amf": "Amalgam", "cof": "Komposit", "gif": "GIC", "meb": "Logam", "pob": "Porselen", "prd": "GT sebagian", "fld": "GT lengkap"}
TEXTCODE = {"non", "une", "pre", "imv", "ano", "dia", "abr", "att"}

# ---------------- Official glyph (5 surfaces) ----------------
POLY = {
    "top": "2,2 38,2 27,13 13,13", "bottom": "2,38 38,38 27,27 13,27",
    "left": "2,2 13,13 13,27 2,38", "right": "38,2 27,13 27,27 38,38", "center": "13,13 27,13 27,27 13,27",
}


def side(tooth: int, s: str) -> str:
    q = tooth // 10
    upper = q in (1, 2, 5, 6)
    chart_left = q in (1, 4, 5, 8)  # patient right, mesial faces the midline on the chart right
    if s in ("O", "I"):
        return "center"
    if s == "V":
        return "top" if upper else "bottom"
    if s == "L":
        return "bottom" if upper else "top"
    if s == "M":
        return "right" if chart_left else "left"
    return "left" if chart_left else "right"


DEFS = ""  # patterns live once in GLOBAL_DEFS (unique ids, explicit colors)


def _pat(pid: str, col: str, cross: bool = False) -> str:
    if cross:
        return (f'<pattern id="{pid}" width="4" height="4" patternUnits="userSpaceOnUse">'
                f'<path d="M0 0l4 4M4 0 0 4" stroke="{col}" stroke-width=".9"/></pattern>')
    return (f'<pattern id="{pid}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
            f'<line x1="0" y1="0" x2="0" y2="4" stroke="{col}" stroke-width="1.4"/></pattern>')


GLOBAL_DEFS = ('<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
               + _pat("h", "#1A1A1A") + _pat("hg", "#15803D") + _pat("x", "#1A1A1A", True) + _pat("xp", "#DB2777", True)
               + "</defs></svg>")


def glyph(tooth: int, marks: list[tuple[str, str]], status: str = "ada", color: bool = False) -> str:
    """Inner SVG (0..40 box) for one tooth. marks: (code, surfaces)."""
    dash = ' stroke-dasharray="3 2"' if status == "rencana" else ""
    out = [f'<rect x="2" y="2" width="36" height="36" fill="#fff" stroke="{INK}" stroke-width="1.2"/>']
    out += [f'<polygon points="{POLY[k]}" fill="none" stroke="{INK}" stroke-width="1"/>' for k in ("top", "bottom", "left", "right")]
    over = []
    for code, surfs in marks:
        col = OPT.get(code, INK) if color else INK
        for s in surfs:
            pts = POLY[side(tooth, s)]
            if status == "rencana" and code in ("amf", "inl", "onl", "cof", "gif", "fis"):
                out.append(f'<polygon points="{pts}" fill="none" stroke="{col}" stroke-width="2.4"{dash}/>')
            elif code in ("amf", "inl", "onl"):
                out.append(f'<polygon points="{pts}" fill="{col}"/>')
            elif code in ("cof", "gif"):
                out.append(f'<polygon points="{pts}" fill="url(#{"hg" if col != INK else "h"})" stroke="{col}" stroke-width=".8"/>')
            elif code == "fis":
                out.append(f'<polygon points="{pts}" fill="url(#{"xp" if col != INK else "x"})" stroke="{col}" stroke-width=".8"/>')
            elif code == "car":
                out.append(f'<polygon points="{pts}" fill="none" stroke="{col}" stroke-width="3" stroke-linejoin="round"{dash}/>')
        if code == "cfr":
            over.append(f'<path d="M16 10l-3 20M24 10l-3 20M11 17h18M10 24h18" stroke="{col}" stroke-width="2"{dash}/>')
        if code in ("fmc", "gmc", "mpc", "poc", "ipx", "abu"):
            if code in ("poc", "mpc", "ipx"):
                out.append('<rect x="2" y="2" width="36" height="36" fill="url(#h)"/>')
            if code == "mpc":
                out.append(f'<rect x="13" y="13" width="14" height="14" fill="{col}"/>')
            over.append(f'<rect x="1.5" y="1.5" width="37" height="37" fill="none" stroke="{col}" stroke-width="4"{dash}/>')
        if code in ("mis", "pon", "prd", "fld"):
            over.append(f'<path d="M-1-3 41 43M41-3-1 43" stroke="{col}" stroke-width="2.4"{dash}/>')
        if code == "rrx":
            over.append(f'<path d="M6-4 20 42 34-4" fill="none" stroke="{col}" stroke-width="2.4"{dash}/>')
    return "".join(out + over)


def badge(status: str) -> str:
    if status == "selesai":
        return (f'<circle cx="38" cy="2" r="7" fill="#fff" stroke="{INK}" stroke-width="1.2"/>'
                f'<path d="M34.6 2.2l2.4 2.4 4.2-4.6" fill="none" stroke="{INK}" stroke-width="1.6"/>')
    if status == "lain":
        return (f'<circle cx="38" cy="2" r="7" fill="#fff" stroke="{INK}" stroke-width="1.2"/>'
                f'<text x="38" y="5" text-anchor="middle" font-size="9" font-weight="800" fill="{INK}">L</text>')
    return ""


def band(marks: list[tuple[str, str]], upper: bool, bridge: str = "") -> str:
    """Root / text band (12px) beside the glyph, away from the occlusal plane."""
    codes = [c for c, _ in marks]
    bits = []
    y0 = 0 if upper else 52
    if "rct" in codes or "nvt" in codes:
        fill = INK if "rct" in codes else "#fff"
        tri = (f"18,{y0+11} 30,{y0+11} 24,{y0+1}" if upper else f"18,{y0+1} 30,{y0+1} 24,{y0+11}")
        bits.append(f'<polygon points="{tri}" fill="{fill}" stroke="{INK}" stroke-width="1.2"/>')
    txt = [c for c in codes if c in TEXTCODE or c in ("ipx", "prd", "fld")]
    if txt and not bits:
        bits.append(f'<text x="24" y="{y0+10}" text-anchor="middle" font-size="10" font-weight="700" fill="{INK}" font-family="ui-monospace,monospace">{txt[0]}</text>')
    if "panah" in codes:
        bits.append(f'<path d="M12 {y0+6}h22M30 {y0+2}l4 4-4 4" fill="none" stroke="{INK}" stroke-width="1.6"/>')
    if bridge:
        y = y0 + (3 if upper else 9)
        x1, x2 = (-3, 51)
        if bridge == "L":
            x1 = 24
        if bridge == "R":
            x2 = 24
        bits.append(f'<path d="M{x1} {y}H{x2}" stroke="{INK}" stroke-width="2.4"/>')
        if bridge in ("L", "R"):
            bits.append(f'<path d="M24 {y}V{y0 + (12 if upper else 0)}" stroke="{INK}" stroke-width="2.4"/>')
    return "".join(bits)


def cell(tooth: int, marks=None, status: str = "ada", on: bool = False, bridge: str = "", color: bool = False, ghost: bool = False) -> str:
    marks = marks or []
    q = tooth // 10
    upper = q in (1, 2, 5, 6)
    gy = 9 if upper else 15
    num_y = 59 if upper else 12
    g = glyph(tooth, marks, status, color)
    svg = (f'<svg width="48" height="64" viewBox="0 0 48 64" aria-hidden="true">{DEFS}'
           f'{band(marks, upper, bridge)}<g transform="translate(4 {gy})">{g}{badge(status) if marks else ""}</g>'
           f'<text x="24" y="{num_y}" text-anchor="middle" font-size="11" font-weight="700" fill="#344054">{tooth}</text></svg>')
    cls = "tc" + (" on" if on else "") + (" ghost" if ghost else "")
    lab = f"Gigi {tooth}" + (": " + " ".join(f"{s} {c}".strip() for c, s in marks) if marks else "")
    return f'<button class="{cls}" type="button" aria-label="{lab}">{svg}</button>'


def sym(code: str, color: bool = False) -> str:
    """28px official symbol for a list option."""
    t = 26  # upper-left quadrant for M/D orientation
    marks = {"car": [("car", "O")], "amf": [("amf", "O")], "cof": [("cof", "O")], "gif": [("gif", "O")], "fis": [("fis", "O")],
             "inl": [("inl", "O")], "onl": [("onl", "OM")], "sou": []}.get(code, [(code, "")])
    status = "ada"
    inner = glyph(t, marks, status, color)
    extra = ""
    if code in ("rct", "nvt"):
        fill = INK if code == "rct" else "#fff"
        extra = f'<polygon points="16,41 24,41 20,48" fill="{fill}" stroke="{INK}" stroke-width="1.4"/>'
        return (f'<svg class="sym" viewBox="-2 -2 44 52" aria-hidden="true">{DEFS}<g transform="translate(4 0) scale(.8)">{inner}</g>{extra}</svg>')
    if code in TEXTCODE or code in ("ipx", "prd", "fld", "acr", "frm"):
        extra = f'<text x="20" y="9" text-anchor="middle" font-size="11" font-weight="800" fill="{INK}" font-family="ui-monospace,monospace">{code}</text>'
        return (f'<svg class="sym" viewBox="-2 -2 44 48" aria-hidden="true">{DEFS}{extra}<g transform="translate(6 12) scale(.7)">{inner}</g></svg>')
    if code in ("meb", "pob"):
        b = ("<g transform='translate(0 10) scale(.5)'>" + glyph(26, [("abu" if code == "meb" else "poc", "")]) + "</g>"
             "<g transform='translate(20 10) scale(.5)'>" + glyph(26, [("pon", "")]) + "</g>"
             f'<path d="M4 6H36M4 6v4M36 6v4" stroke="{INK}" stroke-width="2.2" fill="none"/>')
        return f'<svg class="sym" viewBox="-2 0 44 34" aria-hidden="true">{DEFS}{b}</svg>'
    if code == "panah":
        return (f'<svg class="sym" viewBox="-2 -2 44 48" aria-hidden="true">{DEFS}<path d="M8 6h22M26 2l4 4-4 4" fill="none" stroke="{INK}" stroke-width="2"/>'
                f'<g transform="translate(6 12) scale(.7)">{glyph(t, [])}</g></svg>')
    return f'<svg class="sym" viewBox="-4 -4 48 48" aria-hidden="true">{DEFS}{inner}</svg>'


STATUS = [("ada", "Ada sebelumnya", "Ada"), ("lain", "Klinik lain", "Lain"), ("rencana", "Rencana", "Rencana"), ("selesai", "Selesai", "Selesai")]


def st_icon(key: str) -> str:
    dash = ' stroke-dasharray="3 2"' if key == "rencana" else ""
    g = f'<rect x="3" y="3" width="26" height="26" rx="2" fill="none" stroke="{INK}" stroke-width="2"{dash}/>'
    if key in ("selesai", "lain"):
        g += badge(key).replace('cx="38" cy="2"', 'cx="29" cy="5"').replace("M34.6 2.2l2.4 2.4 4.2-4.6", "M25.6 5.2l2.4 2.4 4.2-4.6").replace('x="38" y="5"', 'x="29" y="8"')
    return f'<svg class="st" viewBox="-2 -6 44 40" aria-hidden="true">{g}</svg>'


def status_seg(sel: str, opts=None) -> str:
    opts = opts or STATUS
    bits = "".join(
        f'<button class="tab{" on" if k == sel else ""}" type="button" role="radio" aria-checked="{"true" if k == sel else "false"}">{st_icon(k)}{short}</button>'
        for k, _, short in opts)
    return f'<div class="tabs stg" role="radiogroup" aria-label="Status">{bits}</div>'


# ---------------- Chrome ----------------
def syn() -> str:
    return '<span class="syn">DATA SINTETIS</span>'


def button(label: str, variant: str = "primary", icon: str | None = None, icon_only: bool = False, aria: str = "", extra: str = "") -> str:
    ic = ico(icon, "ic-btn") if icon else ""
    cls = f"button button--{variant} {extra}"
    if icon_only:
        return f'<button class="{cls} button--icon" type="button" aria-label="{aria or label}">{ic}</button>'
    return f'<button class="{cls}" type="button">{ic}{label}</button>'


def tabs(items: list[tuple[str, bool]], fit: bool = False, aria: str = "") -> str:
    bits = "".join(f'<button class="tab{" on" if on else ""}" type="button">{lab}</button>' for lab, on in items)
    return f'<div class="tabs{" fit" if fit else ""}" role="tablist" aria-label="{aria}">{bits}</div>'


def bnav(active: str = "RM") -> str:
    items = [("Beranda", "home"), ("Jadwal", "calendar"), ("Pasien", "users"), ("RM", "tooth"), ("Lainnya", "more")]
    out = "".join(f'<a class="navi{" on" if l == active else ""}"><span class="pill">{ico(i)}</span>{l}</a>' for l, i in items)
    return f'<nav class="bnav"><div class="bnav-row">{out}</div><div class="safe"><i></i></div></nav>'


def phone(inner: str, title: str = "Rekam Medis", overlay: str = "", nav: bool = True) -> str:
    return (f'<div class="ph"><div class="ph-bar"><span>09.40</span>{syn()}</div>'
            f'<header class="hd">{button("", "ghost", "chevron-left", True, "Kembali")}<h1>{title}</h1>{button("", "ghost", "more", True, "Lainnya")}</header>'
            f'<div class="body">{inner}</div>{bnav() if nav else ""}{overlay}</div>')


def rail() -> str:
    items = [("Beranda", "home"), ("Jadwal", "calendar"), ("Pasien", "users"), ("RM", "tooth")]
    bits = [f'<div class="logo">{ico("tooth")}</div>'] + [f'<div class="rbtn{" on" if l == "RM" else ""}">{ico(i)}<span>{l}</span></div>' for l, i in items]
    return f'<aside class="rail">{"".join(bits)}</aside>'


def desk(body: str, crumb: str = "15 Nov 2026 · Senyum Sehat Kemang · Budi Santoso", title: str = "Rekam Medis") -> str:
    return (f'<div class="desk">{rail()}<div class="dcol"><div class="top"><div><h2>{title}</h2><div class="crumb">{crumb}</div></div>'
            f'<div style="display:flex;align-items:center;gap:8px">{syn()}<span class="mu">drg. Andi Contoh</span></div></div>'
            f'<div class="dbody">{body}</div></div></div>')


def ab(num: str, title: str, desc: str, body: str) -> str:
    return (f'<section class="ab" id="ab-{num}"><div class="ab-k"><span class="ab-n">{num}</span><span class="ab-t">{title}</span></div>'
            f'<p class="ab-d">{desc}</p>{body}</section>')


def ph_col(ph: str, cap: str) -> str:
    return f'<div class="ph-col">{ph}<p class="ph-cap">{cap}</p></div>'


def drawer(title: str, body: str, save: str, search: bool = False) -> str:
    s = button("", "ghost", "search", True, "Cari kondisi") if search else ""
    return (f'<div class="drawer" role="dialog" aria-label="{title}"><div class="drawer-handle"></div>'
            f'<div class="drawer-hd"><h3>{title}</h3>{s}{button("", "ghost", "x", True, "Tutup")}</div>'
            f'<div class="drawer-bd">{body}</div><div class="drawer-ft">{button(save, "primary")}</div></div>')


# ---------------- Chart ----------------
Q1, Q2 = [18, 17, 16, 15, 14, 13, 12, 11], [21, 22, 23, 24, 25, 26, 27, 28]
Q4, Q3 = [48, 47, 46, 45, 44, 43, 42, 41], [31, 32, 33, 34, 35, 36, 37, 38]
P5, P6 = [55, 54, 53, 52, 51], [61, 62, 63, 64, 65]
P8, P7 = [85, 84, 83, 82, 81], [71, 72, 73, 74, 75]
COLW = 52  # 48 + gap 4


def jrow(left: list[int], right: list[int], data: dict, sel: set, bridge: dict, color: bool, pad_left: int = 0, pad_right: int = 0) -> str:
    n_left = len(left) + pad_left
    cols = " ".join(["48px"] * n_left + ["8px"] + ["48px"] * (len(right) + pad_right))
    cells = ['<span class="tc ghost"></span>'] * pad_left
    cells += [cell(t, *data.get(t, ([], "ada"))[:2], on=t in sel, bridge=bridge.get(t, ""), color=color) for t in left]
    cells.append('<span class="mid"></span>')
    cells += [cell(t, *data.get(t, ([], "ada"))[:2], on=t in sel, bridge=bridge.get(t, ""), color=color) for t in right]
    cells += ['<span class="tc ghost"></span>'] * pad_right
    return f'<div class="jrow" style="grid-template-columns:{cols}">{"".join(cells)}</div>'


def chart(data=None, sel=(), dent: str = "tetap", jaws: str = "both", view_w: int | None = None, focus: int | None = None,
          bridge=None, color: bool = False, header: str = "", minimap: bool = True) -> str:
    """view_w: visible px (HP). focus: tooth to center. jaws: both|upper|lower."""
    data = data or {}
    sel = set(sel)
    bridge = bridge or {}
    rows = []
    if dent == "sulung":
        if jaws in ("both", "upper"):
            rows.append(jrow(P5, P6, data, sel, bridge, color))
        if jaws in ("both", "lower"):
            rows.append(jrow(P8, P7, data, sel, bridge, color))
        order = P5 + P6
    else:
        if jaws in ("both", "upper"):
            rows.append(jrow(Q1, Q2, data, sel, bridge, color))
            if dent == "campuran":
                rows.append(jrow(P5, P6, data, sel, bridge, color, pad_left=3, pad_right=3))
        if jaws in ("both", "lower"):
            if dent == "campuran":
                rows.append(jrow(P8, P7, data, sel, bridge, color, pad_left=3, pad_right=3))
            rows.append(jrow(Q4, Q3, data, sel, bridge, color))
        order = Q1 + Q2
    total = len(order) * COLW + 8
    shift = 0
    if view_w and total > view_w:
        idx = 0
        if focus is not None:
            key = focus % 10 + (focus // 10 in (2, 3, 6, 7)) * 100
            for i, t in enumerate(order):
                if t % 10 + (t // 10 in (2, 3, 6, 7)) * 100 == key:
                    idx = i
        center = idx * COLW + (8 if idx >= len(order) // 2 else 0) + 24
        shift = max(0, min(total - view_w, center - view_w // 2))
    vp_cls = "vp" if view_w and total > view_w else "vp full"
    inner = f'<div class="jaws" style="transform:translateX(-{shift}px)">{"".join(rows)}</div>'
    mm = ""
    if view_w and total > view_w and minimap:
        left = shift / total * 100
        width = view_w / total * 100
        mm = (f'<div class="minimap"><span class="mu">{order[0]}</span><span class="mm" aria-hidden="true"><i style="left:{left:.1f}%;width:{width:.1f}%"></i></span>'
              f'<span class="mu">{order[-1]}</span></div>')
    hd = header or ""
    return f'<div class="od">{hd}<div class="{vp_cls}" style="{f"width:{view_w}px" if view_w else ""}">{inner}</div>{mm}</div>'


def od_header(view: str = "2D", dent: str | None = None) -> str:
    t = tabs([("2D", view == "2D"), ("3D", view == "3D")], fit=True, aria="Tampilan bagan")
    return f'<div class="od-hd"><h3>Odontogram</h3>{t}</div>'


def dent_tabs(dent: str, fit: bool = False) -> str:
    return tabs([("Tetap", dent == "tetap"), ("Sulung", dent == "sulung"), ("Campuran", dent == "campuran")], fit=fit, aria="Dentisi")


def rcard(code: str, on: bool = False) -> str:
    return (f'<button class="rc{" on" if on else ""}" type="button" role="radio" aria-checked="{"true" if on else "false"}">'
            f'{sym(code)}<span>{SHORT.get(code, LABEL[code])}</span><span class="code">{code}</span></button>')


def litem(code: str, on: bool = False) -> str:
    return (f'<div class="litem{" on" if on else ""}" role="option" aria-selected="{"true" if on else "false"}">{sym(code)}'
            f'<span>{LABEL[code]}</span><span class="code">{code}</span>{ico("check", "ck")}</div>')


def pads(on: str = "", tooth: int = 26) -> str:
    names = {"M": "mesial", "O": "oklusal", "D": "distal", "V": "vestibular", "L": "lingual"}
    if tooth % 10 <= 3:
        names["O"] = "insisal"
    lab = {"O": "I" if tooth % 10 <= 3 else "O"}
    return '<div class="surf" role="group" aria-label="Permukaan">' + "".join(
        f'<b class="{"on" if s in on else ""}" aria-pressed="{"true" if s in on else "false"}">{lab.get(s, s)}<small>{names[s]}</small></b>' for s in "MODVL") + "</div>"


# ---------------- Artboards ----------------
VIEW = 310  # visible chart width in HP card (328 - 2*8 padding - borders)
BUDI = {16: ([("cof", "O"), ("rct", "")], "ada"), 36: ([("fmc", "")], "lain"), 46: ([("mis", "")], "ada"), 47: ([("amf", "MO")], "ada"),
        26: ([("car", "O")], "rencana"), 11: ([("cof", "M")], "selesai")}


def ab01() -> str:
    body = (tabs([("Permukaan", True), ("Seluruh gigi", False), ("Rentang", False)])
            + pads("O")
            + '<p class="k">Kondisi</p><div class="rcards" role="radiogroup" aria-label="Kondisi permukaan">'
            + "".join(rcard(c, c == "car") for c in ("car", "amf", "cof", "gif", "fis"))
            + '<button class="rc more" type="button">5 lainnya</button></div>'
            + '<p class="k">Status</p>' + status_seg("rencana"))
    ov = drawer("Gigi 26", body, "Simpan 26 O car")
    inner = '<p class="mu">Budi Santoso · ketuk gigi untuk mencatat</p>' + chart(BUDI, {26}, jaws="upper", view_w=VIEW, focus=26, minimap=False)
    return ab("01", "Perawatan: permukaan, karies 26 O",
              "Tooth-first. Saat sheet terbuka bagan menyempit ke rahang gigi terpilih, tetap terlihat. Pad MODVL 56px, kondisi RadioGroup kartu 2 kolom dengan simbol resmi 28px, status lewat bentuk garis. Tombol Simpan memuat catatan resmi: 26 O car.",
              '<div class="row">' + ph_col(phone(inner, overlay=ov), "Pad O terpilih: garis 2px primary-800 + latar primary-50, bukan teal. Karies digambar garis batas tebal, Rencana = garis putus.") + "</div>")


def ab02() -> str:
    body = (tabs([("Permukaan", False), ("Seluruh gigi", True), ("Rentang", False)])
            + '<div class="list" role="listbox" aria-multiselectable="true" aria-label="Kondisi seluruh gigi">'
            + "".join(litem(c, c in ("poc", "rct")) for c in ("nvt", "rct", "fmc", "poc", "rrx"))
            + "</div>" + '<p class="k">Status</p>' + status_seg("ada"))
    ov = drawer("Gigi 16", body, "Simpan 16 poc-rct", search=True)
    d = dict(BUDI)
    d[16] = ([("poc", ""), ("rct", "")], "ada")
    inner = '<p class="mu">Budi Santoso · ketuk gigi untuk mencatat</p>' + chart(d, {16}, jaws="upper", view_w=VIEW, focus=16, minimap=False)
    return ab("02", "Perawatan: seluruh gigi, poc-rct 16",
              "Listbox multi-pilih untuk 15 kondisi seluruh gigi, digabung dengan tanda hubung sesuai panduan (poc-rct). Cari di header sheet. Kode huruf kecil di kanan, centang primary-800 untuk terpilih.",
              '<div class="row">' + ph_col(phone(inner, overlay=ov), "Mahkota porselen = garis tebal + arsir; rct = segitiga akar hitam. Ada sebelumnya = garis utuh tanpa lencana.") + "</div>")


def ab03() -> str:
    roles = ('<div class="roles" role="group" aria-label="Peran gigi">'
             '<button class="rc" type="button"><span>34</span><span class="code">abu</span></button>'
             '<button class="rc on" type="button"><span>35</span><span class="code">mis-pon</span></button>'
             '<button class="rc" type="button"><span>36</span><span class="code">abu</span></button></div>')
    body = (tabs([("Permukaan", False), ("Seluruh gigi", False), ("Rentang", True)])
            + '<div class="rcards" role="radiogroup" aria-label="Jenis rentang">' + "".join(rcard(c, c == "pob") for c in ("meb", "pob", "prd", "fld")) + "</div>"
            + '<p class="k">Peran, ketuk untuk ganti</p>' + roles
            + '<p class="k">Status</p>' + status_seg("rencana"))
    ov = drawer("Jembatan 34-36", body, "Simpan 34-36 pob")
    d = {34: ([("abu", ""), ("poc", "")], "rencana"), 35: ([("pon", ""), ("poc", "")], "rencana"), 36: ([("abu", ""), ("poc", "")], "rencana"),
         46: ([("mis", "")], "ada"), 47: ([("amf", "MO")], "ada")}
    br = {34: "L", 35: "M", 36: "R"}
    inner = '<p class="mu">Sari Nugroho · ketuk gigi pertama dan terakhir</p>' + chart(d, {34, 35, 36}, jaws="lower", view_w=VIEW, focus=35, bridge=br, minimap=False)
    return ab("03", "Perawatan: rentang, jembatan porselen 34-36",
              "Pilih jenis rentang (meb, pob, prd, fld), ketuk gigi pertama dan terakhir. Peran per gigi otomatis: ujung abu, tengah mis-pon. Catatan jadi 35: mis-pon-pob. Batang penghubung digambar seperti simbol resmi.",
              '<div class="row">' + ph_col(phone(inner, overlay=ov), "Tiga gigi terpilih berbingkai primary-800. Rencana = garis putus pada mahkota dan pontik.") + "</div>")


def _leg(title: str, codes: list[str], note: str = "") -> str:
    items = "".join(f'<div class="leg-item">{sym(c)}<span>{LABEL[c]}</span><span class="code">{c}</span></div>' for c in codes)
    n = f'<p class="mu" style="margin-top:4px">{note}</p>' if note else ""
    return f'<article class="leg-card"><h3>{title}</h3>{items}{n}</article>'


def ab04() -> str:
    status = ('<article class="leg-card"><h3>Status, lapisan produk</h3>'
              + "".join(f'<div class="leg-item">{st_icon(k).replace("class=\"st\"", "class=\"sym\"")}<span>{lab}</span><span class="code">{d}</span></div>'
                        for (k, lab, _), d in zip(STATUS, ["garis utuh", "lencana L", "garis putus", "lencana centang"]))
              + '<p class="mu" style="margin-top:4px">Bukan kolom formulir PDGI. Tidak memakai warna, jadi arti warna resmi tetap.</p></article>')
    warna = ('<article class="leg-card"><h3>Warna</h3>'
             f'<div class="leg-item">{sym("amf")}<span>Bawaan: hitam-putih</span><span class="code">resmi</span></div>'
             f'<div class="leg-item">{sym("cof", True)}<span>Sewarna gigi: hijau</span><span class="code">opsional</span></div>'
             f'<div class="leg-item">{sym("fis", True)}<span>Sealant: merah muda</span><span class="code">opsional</span></div>'
             f'<div class="leg-item">{sym("gmc", True)}<span>Logam emas: merah</span><span class="code">opsional</span></div>'
             '<p class="mu" style="margin-top:4px">Opsi di Pengaturan, Rekam medis, Lanjutan. Hijau tidak berarti selesai.</p></article>')
    contoh = ('<article class="leg-card"><h3>Contoh penulisan</h3>'
              + "".join(f'<div class="leg-item"><span>{a}</span><span class="ex">{b}</span></div>' for a, b in [
                  ("Karies oklusal", "36: O car"), ("Tambalan 3 permukaan", "46: MOD amf"), ("Komposit + PSA", "16: O cof-rct"),
                  ("Pontik jembatan porselen", "45: mis-pon-pob"), ("Gigi tiruan akrilik", "prd-acr"), ("Campuran", "15: une; 55: sou"),
                  ("Di luar daftar", "12: cfr \"1/2 insisal\"")])
              + "</article>")
    bebas = ('<article class="leg-card"><h3>Catatan bebas, bukan kode</h3>'
             f'<p class="mu">Tidak ada di daftar singkatan, ditulis dalam tanda kutip: {", ".join(chr(34) + f + chr(34) for f in FREE)}. '
             'Perlu dicabut masuk tabel perawatan sebagai rencana tindakan, bukan simbol bagan.</p></article>')
    body = ('<div class="leg-grid">'
            + _leg("Permukaan, 10, wajib MODVL", [c for _, c in PERM])
            + _leg("Seluruh gigi, 15", [c for _, c in WHOLE])
            + '<div style="display:flex;flex-direction:column;gap:16px">'
            + _leg("Rentang dan protesa, 4", [c for _, c in SPAN])
            + _leg("Peran dan bahan", [c for _, c in ROLES])
            + _leg("Implan, 1", ["ipx"], "Baseline: sou, gigi sehat, ditulis, tidak dikosongkan.")
            + "</div>"
            + status + warna + contoh + bebas + "</div>")
    return ab("04", "Legenda simbol resmi",
              "Panduan Rekam Medis Kedokteran Gigi, Kemenkes dan PB PDGI 2015, hlm. 13-19. Permukaan kapital di depan (MODVL), kondisi huruf kecil, gabungan dengan tanda hubung. 30 kondisi + sou, plus peran pon/abu dan bahan acr/frm.",
              desk(body, "Legenda · Senyum Sehat Kemang", "Odontogram"))


def ab05() -> str:
    full = chart(BUDI, (), view_w=VIEW, focus=11, header=od_header("2D"))
    ph_2d = phone('<p class="mu">Budi Santoso · ketuk gigi untuk mencatat</p>' + full + dent_tabs("tetap"))
    img_hp = f'<img class="view-3d" src="{img_data_uri("odontogram-3d-app-360.png")}" alt="Pratinjau odontogram 3D, hanya baca">'
    ph_3d = phone('<p class="mu">Budi Santoso · tampilan baca</p>'
                  f'<div class="od">{od_header("3D")}{img_hp}</div><div class="note-ro">{ico("info")}3D hanya baca. Catat di 2D.</div>')
    img_desk = f'<img class="view-3d" src="{img_data_uri("odontogram-3d-app-1280.png")}" alt="Pratinjau odontogram 3D, hanya baca">'
    d3 = desk(f'<div class="od">{od_header("3D")}<div class="note-ro">{ico("info")}3D hanya baca. Untuk mencatat, kembali ke 2D.</div>{img_desk}</div>')
    body = ('<div class="row">'
            + ph_col(ph_2d, "<b>2D.</b> Sel gigi 48x64, simbol 40x40 (diukur di papan). Satu penggulir untuk dua rahang agar 18 sejajar 48; buka di garis tengah. Minimap menunjukkan posisi.")
            + ph_col(ph_3d, "<b>3D.</b> Render Odontogram3D terbaru (fix/mobile-ui 697577a), rahang pas lebar kartu. Hanya baca.")
            + "</div>" + '<div class="row" style="margin-top:24px">' + d3 + "</div>")
    return ab("05", "Toggle 2D atau 3D",
              "Toggle 48px seperti tab lain. 2D untuk input, 3D untuk baca dan edukasi. Gerak dikurangi atau 3D gagal muat: tetap 2D.", body)


def ab06() -> str:
    tools = lambda on: '<div class="tools" role="radiogroup" aria-label="Alat">' + "".join(
        f'<button class="tool{" on" if c == on else ""}" type="button" role="radio" aria-label="{LABEL[c]}">{sym(c)}<span class="code">{c}</span></button>'
        for c in ("sou", "mis", "rrx", "car", "amf", "cof", "fmc", "poc")) + "</div>"
    head = tabs([("Perawatan", False), ("Pemeriksaan awal", True)], aria="Mode isi")

    def dock(tool: str, save: str, extra: str = "") -> str:
        lab = LABEL[tool]
        return (f'<div class="dock"><div class="od-hd"><span class="k">Alat: {lab} <code>{tool}</code></span>'
                f'{button("Semua", "ghost", "list", extra="button--sm")}</div>{tools(tool)}'
                + status_seg("ada", [STATUS[0], STATUS[2]]) + extra
                + f'<div style="display:flex;gap:8px">{button("", "secondary", "undo", True, "Urungkan")}{button(save, "primary", extra="button--full")}</div>'
                '<div class="safe"><i></i></div></div>')

    mis = {t: ([("mis", "")], "ada") for t in (18, 28, 38, 48, 46, 36, 17, 27)}
    a = dict(mis)
    a.update({15: ([("rrx", "")], "ada"), 25: ([("rrx", "")], "ada")})
    p1 = phone(head + chart(a, (), view_w=VIEW, focus=16), "Pemeriksaan awal", dock("mis", "Simpan 10 gigi"), nav=False)
    b = dict(a)
    b[47] = ([("amf", "MOD")], "ada")
    pop = ('<div class="pop" style="bottom:300px"><div class="od-hd"><span class="k">Gigi 47</span><code>MOD amf</code></div>' + pads("MOD", 47) + "</div>")
    p2 = phone(head + chart(b, {47}, view_w=VIEW, focus=46), "Pemeriksaan awal", pop + dock("amf", "Simpan 11 gigi"), nav=False)
    sou_btn = button("Tandai sisa sou (21)", "secondary", "check", extra="button--full")
    p3 = phone(head + chart(b, (), view_w=VIEW, focus=26), "Pemeriksaan awal", dock("sou", "Simpan 32 gigi", sou_btn), nav=False)
    table = ('<table class="tbl"><tr><th>Skenario</th><th>Tooth-first (Perawatan)</th><th>Palet (Pemeriksaan awal)</th></tr>'
             '<tr><td>Karies 36 O</td><td class="n">5</td><td class="n win">4</td></tr>'
             '<tr><td>Tambalan 47 MOD amf</td><td class="n">7</td><td class="n win">6</td></tr>'
             '<tr><td>8 hilang + 2 sisa akar</td><td class="n">40-50</td><td class="n win">13</td></tr>'
             '<tr><td>Mulut lengkap: 8 mis, 2 rrx, 1 MOD amf, 21 sou</td><td class="n">130+</td><td class="n win">19</td></tr></table>'
             '<p class="ph-cap" style="max-width:640px;margin-top:8px">Cara hitung. Tooth-first: gigi, tab atau permukaan, kondisi, status, Simpan per gigi. '
             'Palet: alat 1x, lalu 1 ketuk per gigi (atau gigi + permukaan), Simpan sekali. 8 hilang + 2 sisa akar = mis 1 + 8 gigi + rrx 1 + 2 gigi + Simpan 1 = 13. '
             'Mulut lengkap = 12 + amf 1 + gigi 47 1 + M O D 3 + Tandai sisa sou 1 + Simpan 1 = 19. Tooth-first mulut lengkap: 10 gigi x 4-5 + MOD 7 + 21 sou x 4 = 131 atau lebih. Status bawaan Ada sebelumnya, tidak dihitung.</p>')
    body = ('<div class="row">'
            + ph_col(p1, "<b>Alat seluruh gigi.</b> Pilih mis sekali, ketuk 8 gigi. Ketuk lagi = hapus. Simpan menghitung gigi berubah.")
            + ph_col(p2, "<b>Alat permukaan.</b> Ketuk gigi membuka pad MODVL kecil di atas dock, ketuk permukaan langsung tercatat. Gigi berikutnya menutup pad.")
            + ph_col(p3, "<b>Selesai periksa.</b> Tandai sisa sou mengisi semua gigi kosong (panduan: sehat ditulis). Satu Simpan untuk 32 gigi, lalu paraf dan tanggal.")
            + "</div>" + '<div style="margin-top:24px">' + table + "</div>")
    return ab("06", "Pemeriksaan awal: palet alat, ketuk banyak gigi, Simpan sekali",
              "Panduan PDGI: seluruh gigi diperiksa dan dicatat pada kunjungan pertama. Mode palet mengikuti pola Open Dental dan Dentrix. Bottom bar disembunyikan selama mode periksa, dock memuat satu tombol primer.",
              body)


def ab07() -> str:
    kid = {55: ([("car", "O")], "ada"), 85: ([("amf", "O")], "ada"), 64: ([("rrx", "")], "ada"), 75: ([("fis", "O")], "ada")}
    p1 = phone('<p class="mu">Alya Putri · 5 th</p>' + dent_tabs("sulung") + chart(kid, (), dent="sulung", view_w=VIEW, focus=51))
    mix = {16: ([("fis", "O")], "ada"), 15: ([("une", "")], "ada"), 55: ([("car", "O")], "ada"), 11: ([("cof", "M")], "ada"), 85: ([("amf", "O")], "ada"), 45: ([("une", "")], "ada")}
    p2 = phone('<p class="mu">Raka Pratama · 9 th</p>' + dent_tabs("campuran") + chart(mix, (), dent="campuran", view_w=VIEW, focus=14))
    dsk = desk('<div style="display:flex">' + dent_tabs("campuran", True) + "</div>" + chart(mix, (), dent="campuran", header=od_header("2D")), "15 Nov 2026 · Senyum Sehat Kemang · Raka Pratama")
    body = ('<div class="row">'
            + ph_col(p1, "<b>Sulung.</b> 51-55, 61-65, 71-75, 81-85. Bawaan dari umur kurang dari 6 tahun (dentitionFromDob).")
            + ph_col(p2, "<b>Campuran.</b> Empat baris seperti formulir anak: sulung di bawah penggantinya, 55 di bawah 15. Contoh 15: une; 55: car.")
            + "</div>" + '<div class="row" style="margin-top:24px">' + dsk + "</div>")
    return ab("07", "Gigi sulung dan campuran",
              "Toggle Tetap | Sulung | Campuran di bawah bagan, 48px. Bawaan dari umur (6-12 th = campuran), dokter bisa ubah. Sel dan simbol sama dengan gigi tetap.",
              body)


def build() -> str:
    parts = [ab01(), ab02(), ab03(), ab04(), ab05(), ab06(), ab07()]
    return f"""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Bittodent · Odontogram v2</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
{TOKENS}
{CSS}
</style>
</head>
<body>
{GLOBAL_DEFS}
<div class="wrap">
  <h1 class="page">Odontogram v2: simbol resmi PDGI, 2D untuk input, 3D untuk baca</h1>
  <p class="lede">Taksonomi dan simbol mengikuti Panduan Rekam Medis Kedokteran Gigi (Kemenkes dan PB PDGI, 2015). Dua mode isi: Perawatan (tooth-first) dan Pemeriksaan awal (palet). Sel gigi 48px atau lebih. Kontrol terpilih primary-800, teal hanya tombol primer. {syn()} Lihat design/odontogram-kondisi.md.</p>
  {''.join(parts)}
</div>
</body>
</html>
"""


def main() -> None:
    html = build()
    if "\u2014" in html:
        raise SystemExit("em dash found")
    if 'src="http' in html or "../odontogram/preview/" in html:
        raise SystemExit("external image reference found in board HTML")
    if html.count("data:image/webp;base64,") < 2:
        raise SystemExit("expected two embedded WebP data URIs")
    if "#0B6B62" in CSS:
        raise SystemExit("teal literal in board CSS")
    OUT.write_text(html)
    ART.parent.mkdir(parents=True, exist_ok=True)
    ART.write_text(html)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
    print(f"wrote {ART}")


if __name__ == "__main__":
    main()
