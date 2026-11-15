#!/usr/bin/env python3
"""Papan menu bar, Lainnya, Pengaturan (progressive disclosure), dan ganti mode.

Hasil: design/boards/menu-pengaturan-mode.html
dan /workspace/artifacts/bittodent-board-menu-pengaturan-mode.html
Data sintetis. Tanpa JavaScript. Tidak mengubah kode app.
Gaya HeroUI v3 seperti odontogram-v2. Teal #0B6B62 hanya tombol primer. Grid 8pt.
"""
from __future__ import annotations

import base64
import io
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "design/boards/menu-pengaturan-mode.html"
ART = Path("/workspace/artifacts/bittodent-board-menu-pengaturan-mode.html")
TOKENS = (ROOT / "design/tokens.css").read_text().replace("\u2014", "-")  # CSS comment only
ASSETS = ROOT / "design/boards/assets/menu-mode"


def img_data_uri(name: str, max_w: int = 720) -> str:
    im = Image.open(ASSETS / name).convert("RGB")
    w, h = im.size
    if w > max_w:
        im = im.resize((max_w, int(round(h * max_w / w))), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="WEBP", quality=78, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


ICONS: dict[str, str] = {
    "home": '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    "calendar": '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    "users": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    "tooth": '<path d="M8 4.5C8 3.1 9.6 2 12 2s4 1.1 4 2.5c0 .7-.2 1.4-.5 2 1.7.3 3 1.6 3.2 3.6.4 3.2-1 7.2-2.8 9.2-.6.7-1.7.3-1.7-.6 0-1.8-.3-3.2-.7-4.1-.3-.6-.9-.8-1.5-.4-.4.2-.8.2-1.2 0-.6-.4-1.2-.2-1.5.4-.4.9-.7 2.3-.7 4.1 0 .9-1.1 1.3-1.7.6-1.8-2-3.2-6-2.8-9.2.2-2 1.5-3.3 3.2-3.6-.3-.6-.5-1.3-.5-2z"/>',
    "more": '<circle cx="6" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.15" fill="currentColor" stroke="none"/>',
    "queue": '<path d="M4 6h16M4 12h16M4 18h10"/>',
    "receipt": '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    "card": '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    "chart": '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    "settings": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    "user": '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
    "building": '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    "file": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    "tag": '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
    "shield": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    "bell": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    "palette": '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h9"/>',
    "swap": '<path d="M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
    "logout": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    "chev-r": '<path d="M9 18l6-6-6-6"/>',
    "chev-l": '<path d="M15 18l-6-6 6-6"/>',
    "chev-d": '<path d="M6 9l6 6 6-6"/>',
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "search": '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    "pin": '<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    "steth": '<path d="M5 3v6a5 5 0 0 0 10 0V3M5 3h2M13 3h2"/><path d="M10 14v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/>',
    "desk": '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    "crown": '<path d="M3 7l4 4 5-7 5 7 4-4-2 12H5z"/>',
    "alert": '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    "lock": '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "x": '<path d="M18 6 6 18M6 6l12 12"/>',
}


def ico(name: str, cls: str = "ic") -> str:
    return (f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg>')


CSS = r"""
:root{--motion-fast:120ms;--motion-std:200ms;--motion-slow:280ms;
  --motion-ease-standard:cubic-bezier(0.2,0,0,1);--motion-ease-spring:cubic-bezier(0.32,0.72,0,1);
  --focus:2px solid var(--color-primary-700)}
*{box-sizing:border-box}
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
.ic-sm{width:16px;height:16px;flex:none}
.syn{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;background:#FFFAEB;color:#B54708;
  border:1px solid #F5C14A;font-size:10px;font-weight:700;letter-spacing:.04em}

/* HeroUI v3 button: sm 40, md 44, lg 48. Radius full. */
.button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 24px;border-radius:999px;border:0;
  font:600 14px/1 var(--font-family-sans);background:transparent;color:var(--color-neutral-800)}
.button--sm{min-height:40px;padding:0 16px;font-size:13px}
.button--primary{background:var(--color-primary-700);color:#fff}
.button--secondary{background:var(--color-neutral-100);color:var(--color-neutral-800)}
.button--ghost{color:var(--color-neutral-700)}
.button--danger-soft{background:var(--color-danger-bg);color:var(--color-danger-fg)}
.button--danger{background:var(--color-danger-solid);color:#fff}
.button--icon{width:48px;height:48px;padding:0;border-radius:999px}
.button--full{width:100%}

/* Phone frame 360x800 */
.ph{width:360px;height:800px;background:#fff;border:1px solid var(--color-neutral-200);border-radius:32px;overflow:hidden;position:relative;
  display:flex;flex-direction:column;flex:none;box-shadow:0 8px 24px rgba(22,33,43,.06)}
.ph-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 24px 0;min-height:32px;font-size:12px;font-weight:600}
.hd{background:#fff;padding:0 8px 0 16px;display:flex;align-items:center;gap:8px;min-height:56px;border-bottom:1px solid var(--color-neutral-100)}
.hd.back{padding-left:4px}
.hd h1{margin:0;font-size:18px;font-weight:700;flex:1;letter-spacing:-.01em}
.hd .clinic{flex:1;min-width:0;display:flex;flex-direction:column}
.hd .clinic b{font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hd .clinic span{font-size:12px;font-weight:600;color:var(--color-neutral-500)}
.body{flex:1;background:var(--color-canvas);padding:16px;display:flex;flex-direction:column;gap:16px;min-height:0;overflow:hidden}
.body.white{background:#fff}

/* Bottom bar: 64 + safe area. Pill on active, target 48+. */
.bnav{flex:none;background:#fff;border-top:1px solid var(--color-neutral-200);padding:8px 4px 0}
.bnav-row{display:flex}
.navi{flex:1;white-space:nowrap;display:flex;flex-direction:column;align-items:center;gap:4px;min-height:56px;padding-top:2px;font-size:12px;font-weight:600;
  color:var(--color-neutral-600);position:relative}
.navi .pill{width:56px;height:32px;border-radius:999px;display:grid;place-items:center}
.navi.on{color:var(--color-primary-800);font-weight:700}
.navi.on .pill{background:var(--color-primary-100)}
.navi .bdg{position:absolute;top:0;left:calc(50% + 8px);min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--color-danger-solid);
  color:#fff;font-size:11px;font-weight:700;display:grid;place-items:center;border:2px solid #fff}
.safe{height:24px;display:grid;place-items:center}
.safe i{width:112px;height:4px;border-radius:4px;background:var(--color-neutral-800);opacity:.85}
.bnav.annot .navi{outline:1px dashed rgba(181,71,8,.55);outline-offset:-2px}
.bnav.annot .safe{background:repeating-linear-gradient(45deg,#FFFAEB 0 6px,#fff 6px 12px)}

/* Cards, lists */
.card{background:#fff;border:1px solid var(--color-neutral-200);border-radius:16px;overflow:hidden}
.grp-t{font-size:12px;font-weight:700;color:var(--color-neutral-500);margin:0 0 -8px 4px;letter-spacing:.02em}
.li{display:flex;align-items:center;gap:16px;min-height:56px;padding:8px 16px;font-size:15px;font-weight:600;color:var(--color-neutral-800)}
.li + .li{border-top:1px solid var(--color-neutral-100)}
.li .lt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.li .lt small{font-size:12px;font-weight:500;color:var(--color-neutral-500);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.li .val{font-size:13px;font-weight:600;color:var(--color-neutral-500)}
.li .lead{width:40px;height:40px;border-radius:12px;background:var(--color-neutral-100);color:var(--color-neutral-700);display:grid;place-items:center;flex:none}
.li .chev{color:var(--color-neutral-400)}
.li.on{background:var(--color-primary-50)}
.li.on .lead{background:var(--color-primary-100);color:var(--color-primary-800)}
.li.danger{color:var(--color-danger-fg)}
.av{width:48px;height:48px;border-radius:999px;background:var(--color-primary-100);color:var(--color-primary-800);display:grid;place-items:center;
  font-weight:700;font-size:16px;flex:none;position:relative}
.av.sm{width:40px;height:40px;font-size:14px}
.av .mb{position:absolute;right:-6px;bottom:-6px;width:20px;height:20px;border-radius:999px;background:#fff;border:1px solid var(--color-neutral-200);
  display:grid;place-items:center;color:var(--color-neutral-700)}
.av .mb svg{width:12px;height:12px}

/* Switch (HeroUI) */
.sw{width:44px;height:24px;border-radius:999px;background:var(--color-neutral-300);position:relative;flex:none}
.sw::after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:999px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2)}
.sw.on{background:var(--color-primary-800)}
.sw.on::after{left:22px}
.sw-wrap{min-width:48px;min-height:48px;display:grid;place-items:center;margin-right:-8px}

/* Chips */
.chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:600;
  background:var(--color-neutral-100);color:var(--color-neutral-700)}
.chip.ok{background:var(--color-success-bg);color:var(--color-success-fg)}
.chip.warn{background:var(--color-warning-bg);color:var(--color-warning-fg)}
.chip.mode{background:var(--color-primary-50);color:var(--color-primary-800)}

/* Sheet */
.scrim{position:absolute;inset:0;background:rgba(16,24,40,.42)}
.sheet{position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:24px 24px 0 0;padding:8px 16px 0;display:flex;flex-direction:column;gap:16px;
  box-shadow:0 -8px 24px rgba(16,24,40,.12)}
.handle{width:40px;height:4px;border-radius:4px;background:var(--color-neutral-300);margin:0 auto}
.handle-hit{height:24px;display:grid;place-items:center;margin:-8px -16px -8px}
.sheet h2{margin:0;font-size:18px;font-weight:700}
.sheet .sub{margin:-12px 0 0;font-size:13px;font-weight:500;color:var(--color-neutral-500)}
.prof{display:flex;align-items:center;gap:16px;padding:8px 0}
.prof .pt{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.prof .pt b{font-size:17px;font-weight:700}
.prof .pt span{font-size:13px;font-weight:600;color:var(--color-neutral-500)}
.ingrp{border:1px solid var(--color-neutral-200);border-radius:16px;overflow:hidden}

/* RadioGroup with icon (HeroUI Radio, card style) */
.rg{display:flex;flex-direction:column;gap:8px}
.ro{display:flex;align-items:center;gap:16px;min-height:72px;padding:12px 16px;border:1px solid var(--color-neutral-200);border-radius:16px;background:#fff}
.ro .lead{width:40px;height:40px;border-radius:12px;background:var(--color-neutral-100);color:var(--color-neutral-700);display:grid;place-items:center;flex:none}
.ro .rt{flex:1;display:flex;flex-direction:column;gap:2px;font-size:15px;font-weight:700}
.ro .rt small{font-size:12px;font-weight:500;color:var(--color-neutral-500)}
.ro .dot{width:22px;height:22px;border-radius:999px;border:2px solid var(--color-neutral-300);flex:none;display:grid;place-items:center}
.ro.on{border-color:var(--color-primary-800);border-width:2px;padding:11px 15px;background:var(--color-primary-50)}
.ro.on .lead{background:var(--color-primary-100);color:var(--color-primary-800)}
.ro.on .dot{border-color:var(--color-primary-800)}
.ro.on .dot::after{content:"";width:10px;height:10px;border-radius:999px;background:var(--color-primary-800)}
.ro.dis{opacity:1}

/* Toast */
.toast{position:absolute;left:16px;right:16px;bottom:104px;min-height:48px;border-radius:14px;background:var(--color-neutral-900);color:#fff;
  display:flex;align-items:center;gap:12px;padding:4px 4px 4px 16px;font-size:14px;font-weight:600;box-shadow:0 8px 24px rgba(16,24,40,.24)}
.toast .ic{color:#6CE9A6}
.toast .tx{flex:1}
.toast .button{color:#A8E0D9;min-height:40px;padding:0 12px}

/* Dialog */
.dlg{position:absolute;left:16px;right:16px;top:50%;transform:translateY(-50%);background:#fff;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:16px;
  box-shadow:0 16px 40px rgba(16,24,40,.24)}
.dlg h2{margin:0;font-size:18px;font-weight:700}
.dlg p{margin:0;font-size:14px;font-weight:500;color:var(--color-neutral-600);line-height:1.45}
.dlg .ib{width:48px;height:48px;border-radius:999px;display:grid;place-items:center;background:var(--color-warning-bg);color:var(--color-warning-fg)}
.dlg .ib.d{background:var(--color-danger-bg);color:var(--color-danger-fg)}
.dlg .acts{display:flex;flex-direction:column;gap:8px}

/* Accordion */
.acc-h{display:flex;align-items:center;gap:16px;min-height:56px;padding:8px 16px;font-size:15px;font-weight:600;color:var(--color-neutral-700)}
.acc-h .ic:last-child{color:var(--color-neutral-500);margin-left:auto}
.acc.open .acc-h .ic:last-child{transform:rotate(180deg)}
.acc .acc-b{border-top:1px solid var(--color-neutral-100)}

/* Content blocks */
.k{font-size:12px;font-weight:700;color:var(--color-neutral-500)}
.appt{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid var(--color-neutral-200);border-radius:16px;padding:12px 16px;min-height:72px}
.appt .tm{font:700 14px/1 var(--font-family-sans);width:48px}
.appt .who{flex:1;display:flex;flex-direction:column;gap:4px;font-size:15px;font-weight:700}
.appt .who small{font-size:12px;font-weight:500;color:var(--color-neutral-500)}
.searchf{display:flex;align-items:center;gap:8px;height:48px;border-radius:14px;background:var(--color-neutral-100);padding:0 16px;color:var(--color-neutral-500);font-size:14px;font-weight:500}
.inp{display:flex;align-items:center;justify-content:space-between;height:48px;border-radius:14px;border:1px solid var(--color-neutral-300);padding:0 16px;font-size:15px;font-weight:600}

/* Desktop */
.desk{width:1280px;height:760px;background:#fff;border:1px solid var(--color-neutral-200);border-radius:16px;overflow:hidden;display:flex;flex:none;
  box-shadow:0 8px 24px rgba(22,33,43,.06)}
.side{width:232px;background:#F4F7F7;border-right:1px solid var(--color-neutral-200);padding:16px 12px;display:flex;flex-direction:column;gap:4px;flex:none}
.side .brand{display:flex;align-items:center;gap:8px;font-weight:700;font-size:16px;padding:0 8px 16px}
.side .brand i{width:32px;height:32px;border-radius:10px;background:var(--color-primary-700);color:#fff;display:grid;place-items:center}
.side .cap{font-size:11px;font-weight:700;color:var(--color-neutral-500);letter-spacing:.06em;padding:12px 8px 4px}
.side a{display:flex;align-items:center;gap:12px;height:44px;padding:0 12px;border-radius:12px;font-size:14px;font-weight:600;color:var(--color-neutral-700)}
.side a.on{background:var(--color-primary-100);color:var(--color-primary-800)}
.dcol{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--color-canvas)}
.dtop{display:flex;align-items:center;gap:16px;min-height:64px;padding:0 24px;background:#fff;border-bottom:1px solid var(--color-neutral-200)}
.dtop h2{margin:0;font-size:18px;font-weight:700;flex:1}
.dtop .who{display:flex;align-items:center;gap:12px;font-size:13px;font-weight:600}
.dtop .who small{display:block;color:var(--color-neutral-500);font-weight:500}
.split{flex:1;display:flex;min-height:0}
.glist{width:320px;border-right:1px solid var(--color-neutral-200);background:#fff;padding:16px;display:flex;flex-direction:column;gap:8px;flex:none}
.glist .li{border-radius:12px;min-height:56px}
.glist .li + .li{border-top:0}
.detail{flex:1;padding:24px 32px;display:flex;flex-direction:column;gap:16px;overflow:hidden}
.detail h3{margin:0;font-size:20px;font-weight:700}
.detail .mu{margin:-8px 0 0;font-size:13px;font-weight:500;color:var(--color-neutral-500)}
.dnote{position:absolute}
.matrix{border-collapse:separate;border-spacing:0;background:#fff;border:1px solid var(--color-neutral-200);border-radius:16px;overflow:hidden;font-size:13px}
.matrix th,.matrix td{padding:0 16px;height:44px;text-align:left;border-bottom:1px solid var(--color-neutral-100);font-weight:600}
.matrix th{background:var(--color-neutral-50);font-size:12px;color:var(--color-neutral-600)}
.matrix tr:last-child td{border-bottom:0}
.matrix td.y{color:var(--color-success-fg)}
.matrix td.n{color:var(--color-neutral-400)}

/* Flow diagram */
.flow{display:grid;grid-template-columns:repeat(5,1fr);width:1540px;gap:24px 40px;align-items:center;background:#fff;border:1px solid var(--color-neutral-200);
  border-radius:16px;padding:24px 32px}
.node{position:relative;min-height:64px;border:1px solid var(--color-neutral-300);border-radius:14px;padding:12px 16px;font-size:13px;font-weight:600;
  background:#fff;display:flex;flex-direction:column;gap:4px;justify-content:center}
.node small{font-size:11px;font-weight:500;color:var(--color-neutral-500)}
.node.dec{border-style:dashed;border-color:var(--color-warning-fg);background:var(--color-warning-bg)}
.node.ok{border-color:var(--color-success-fg);background:var(--color-success-bg)}
.node.st{background:var(--color-neutral-50)}
.node.arr::after{content:"";position:absolute;right:-32px;top:50%;width:24px;border-top:2px solid var(--color-neutral-400)}
.node.arr::before{content:"";position:absolute;right:-34px;top:calc(50% - 5px);border:5px solid transparent;border-left:7px solid var(--color-neutral-400)}
.node.up::before{content:"";position:absolute;left:50%;top:-25px;height:24px;border-left:2px solid var(--color-neutral-400)}
.node.dec.up::before{border-left-style:dashed;border-left-color:var(--color-warning-fg)}
.lbl{font-size:11px;font-weight:700;color:var(--color-neutral-500)}
.spec{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:24px;width:1540px}
.spec .card{padding:16px;display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:500;color:var(--color-neutral-700);line-height:1.45}
.spec .card b{font-size:14px;color:var(--color-neutral-900)}
.before{width:360px;height:812px;border-radius:32px;overflow:hidden;border:1px solid var(--color-neutral-200);flex:none;position:relative}
.before img{width:100%;display:block}
.tagx{position:absolute;padding:4px 8px;border-radius:8px;background:var(--color-danger-solid);color:#fff;font-size:11px;font-weight:700}
.dim{opacity:.55}
"""


def syn() -> str:
    return '<span class="syn">DATA SINTETIS</span>'


def btn(label: str, kind: str = "ghost", icon: str = "", extra: str = "", aria: str = "") -> str:
    i = ico(icon) if icon else ""
    a = f' aria-label="{aria}"' if aria else ""
    return f'<button class="button button--{kind} {extra}" type="button"{a}>{i}{label}</button>'


def icon_btn(icon: str, aria: str) -> str:
    return f'<button class="button button--ghost button--icon" type="button" aria-label="{aria}">{ico(icon)}</button>'


NAV = {
    "Dokter": [("Beranda", "home"), ("Jadwal", "calendar"), ("Pasien", "users"), ("RM", "tooth"), ("Lainnya", "more")],
    "Asisten": [("Beranda", "home"), ("Antrean", "queue"), ("Pasien", "users"), ("RM", "tooth"), ("Lainnya", "more")],
    "Resepsionis": [("Beranda", "home"), ("Jadwal", "calendar"), ("Pasien", "users"), ("Kasir", "card"), ("Lainnya", "more")],
    "Kasir": [("Kasir", "card"), ("Antrean", "queue"), ("Pasien", "users"), ("Lainnya", "more")],
    "Pemilik": [("Beranda", "home"), ("Jadwal", "calendar"), ("Pasien", "users"), ("Laporan", "chart"), ("Lainnya", "more")],
}
NAV["Meja depan"] = NAV["Resepsionis"]


def bnav(role: str = "Dokter", active: str = "Beranda", badge: dict[str, int] | None = None, annot: bool = False) -> str:
    badge = badge or {}
    items = []
    for lab, icon in NAV[role]:
        on = " on" if lab == active else ""
        cur = ' aria-current="page"' if on else ""
        b = f'<span class="bdg">{badge[lab]}</span>' if lab in badge else ""
        aria = ' aria-label="Rekam Medis"' if lab == "RM" else ""
        items.append(f'<a class="navi{on}"{cur}{aria}><span class="pill">{ico(icon)}</span>{lab}{b}</a>')
    cls = "bnav annot" if annot else "bnav"
    return f'<nav class="{cls}" aria-label="Navigasi utama"><div class="bnav-row">{"".join(items)}</div><div class="safe"><i></i></div></nav>'


def header_home(clinic: str = "Senyum Sehat Kemang", sub: str = "Minggu, 15 Nov", initials: str = "AC", mode_icon: str = "steth") -> str:
    return (f'<header class="hd"><div class="clinic"><b>{clinic}</b><span>{sub}</span></div>{syn()}'
            f'<button class="button button--ghost button--icon" type="button" aria-label="Akun dan mode">'
            f'<span class="av sm">{initials}<span class="mb">{ico(mode_icon)}</span></span></button></header>')


def header_back(title: str, right: str = "") -> str:
    return f'<header class="hd back">{icon_btn("chev-l", "Kembali")}<h1>{title}</h1>{right or syn()}</header>'


def phone(header: str, body: str, nav: str = "", overlay: str = "", white: bool = False) -> str:
    cls = "body white" if white else "body"
    return (f'<div class="ph"><div class="ph-bar"><span>09.40</span><span></span></div>{header}'
            f'<div class="{cls}">{body}</div>{nav}{overlay}</div>')


def ph_col(ph: str, cap: str) -> str:
    return f'<div class="ph-col">{ph}<p class="ph-cap">{cap}</p></div>'


def li(label: str, icon: str = "", sub: str = "", val: str = "", chev: bool = True, cls: str = "", right: str = "") -> str:
    lead = f'<span class="lead">{ico(icon)}</span>' if icon else ""
    s = f"<small>{sub}</small>" if sub else ""
    v = f'<span class="val">{val}</span>' if val else ""
    c = ico("chev-r", "ic chev") if chev else ""
    return f'<div class="li {cls}">{lead}<span class="lt">{label}{s}</span>{v}{right}{c}</div>'


def sw(on: bool) -> str:
    return f'<span class="sw-wrap"><span class="sw{" on" if on else ""}" role="switch" aria-checked="{"true" if on else "false"}"></span></span>'


def appts(n: int = 3, doctor: bool = False) -> str:
    rows = [("09.00", "Budi Santoso", "Tambal 26 · Kursi 1", "ok", "Hadir"),
            ("09.30", "Rina Lestari", "Kontrol · Kursi 2", "", "Terjadwal"),
            ("10.00", "Dimas Pratama", "Scaling · Kursi 1", "", "Terjadwal"),
            ("10.30", "Sari Wulandari", "Konsultasi · Kursi 2", "warn", "Perlu konfirmasi")]
    out = []
    for tm, who, what, tone, st in rows[:n]:
        out.append(f'<div class="appt"><span class="tm">{tm}</span><span class="who">{who}<small>{what}</small></span>'
                   f'<span class="chip {tone}">{st}</span></div>')
    return "".join(out)


# ---------- 01 Lainnya ----------
def lainnya_sheet() -> str:
    return (
        '<div class="scrim"></div><div class="sheet" role="dialog" aria-label="Lainnya">'
        '<div class="handle-hit"><span class="handle"></span></div>'
        '<div class="prof"><span class="av">AC<span class="mb">' + ico("steth") + '</span></span>'
        '<span class="pt"><b>drg. Andi Contoh</b><span>Pemilik · Dokter Gigi</span></span></div>'
        '<div class="ingrp">'
        + li("Mode", "swap", val="Dokter")
        + li("Cabang", "pin", val="Kemang")
        + "</div>"
        '<div class="ingrp">'
        + li("Antrean", "queue")
        + li("Resep", "receipt")
        + li("Laporan", "chart")
        + "</div>"
        '<div class="ingrp">' + li("Pengaturan", "settings") + "</div>"
        + btn("Keluar", "danger-soft", "logout", "button--full")
        + '<div class="safe"><i></i></div></div>'
    )


def cabang_sheet() -> str:
    rows = [("Senyum Sehat Kemang", "Jakarta Selatan", True), ("Senyum Sehat Tebet", "Jakarta Selatan", False),
            ("Senyum Sehat Depok", "Depok", False)]
    ro = "".join(
        f'<div class="ro{" on" if on else ""}" role="radio" aria-checked="{"true" if on else "false"}">'
        f'<span class="lead">{ico("building")}</span><span class="rt">{n}<small>{s}</small></span><span class="dot"></span></div>'
        for n, s, on in rows)
    return ('<div class="scrim"></div><div class="sheet" role="dialog" aria-label="Pilih cabang">'
            '<div class="handle-hit"><span class="handle"></span></div>'
            '<h2>Cabang</h2>'
            f'<div class="rg" role="radiogroup" aria-label="Cabang">{ro}</div>'
            '<div class="safe"><i></i></div></div>')


def ab01() -> str:
    before = (f'<div class="before"><img src="{img_data_uri("before-lainnya.jpg")}" alt="Sebelum: sheet Lainnya di staging">'
              '<span class="tagx" style="top:380px;right:16px">Tanpa grup</span>'
              '<span class="tagx" style="top:560px;right:16px">Select mentah</span>'
              '<span class="tagx" style="top:676px;right:16px">Tutup dobel</span></div>')
    home = '<p class="k">Hari ini</p>' + appts(4)
    after = phone(header_home(), home, bnav("Dokter", "Lainnya"), lainnya_sheet())
    cab = phone(header_home(), home, bnav("Dokter", "Lainnya"), cabang_sheet())
    body = ('<div class="row">'
            + ph_col(before, "<b>Sebelum.</b> Daftar datar, Pengaturan RM di menu utama, select cabang mentah, Keluar dan Tutup bersaing.")
            + ph_col(after, "<b>Sesudah.</b> Profil di atas. Mode dan Cabang jadi baris. Menu per peran. Satu Pengaturan. Keluar danger-soft. Tutup: geser atau ketuk scrim.")
            + ph_col(cab, "<b>Cabang.</b> Sheet kedua, RadioGroup ikon. Ketuk langsung pindah, toast \"Cabang Tebet\". Satu cabang: baris jadi teks, tanpa chevron.")
            + "</div>")
    return ab("01", "Lainnya di HP: sebelum dan sesudah",
              "Contoh: drg. Andi Contoh, Pemilik dan Dokter Gigi, mode Dokter. Isi grup menu mengikuti peran dan mode. Sheet masuk 280ms spring, keluar 200ms. Tanpa tombol primer.",
              body)


# ---------- 02 Bottom bar ----------
def ab02() -> str:
    rows = [
        ("Dokter", "Dokter", "Beranda", {}, "Beranda = Pasien saya. Lainnya: Antrean, Resep, Pengaturan."),
        ("Asisten", "Asisten", "Antrean", {}, "Antrean di bar, Jadwal masuk Lainnya. Tanpa Kasir."),
        ("Resepsionis", "Resepsionis", "Jadwal", {"Jadwal": 2}, "Lencana = booking online menunggu. Antrean masuk Lainnya."),
        ("Kasir", "Kasir", "Kasir", {"Kasir": 3}, "4 tab. Kasir jadi beranda. Lencana = belum bayar."),
        ("Pemilik", "Pemilik", "Laporan", {}, "Laporan di bar. Pemilik + Dokter di mode Dokter memakai bar Dokter."),
    ]
    cards = []
    for name, role, active, badge, note in rows:
        cards.append(
            '<div class="ph-col"><div class="card" style="width:360px">'
            f'<div style="padding:12px 16px 4px;display:flex;justify-content:space-between;align-items:center"><b style="font-size:15px">{name}</b>'
            f'<span class="chip">{len(NAV[role])} tab</span></div>'
            f'{bnav(role, active, badge)}</div><p class="ph-cap">{note}</p></div>')
    spec = (
        '<div class="ph-col"><div class="card" style="width:360px">'
        '<div style="padding:12px 16px 4px"><b style="font-size:15px">Ukuran</b></div>'
        f'{bnav("Dokter", "Beranda", annot=True)}</div>'
        '<p class="ph-cap">Bar 64 + safe-area (env(safe-area-inset-bottom), min 8). Target tiap tab penuh, min 56 tinggi. Pill 56x32, primary-100. '
        'Ikon 20, label 12/600, selalu tampil. Pill geser 200ms standard. Gerak dikurangi: tanpa geser.</p></div>'
    )
    grid = ('<div style="display:grid;grid-template-columns:repeat(3,360px);gap:24px 32px">' + "".join(cards) + spec + "</div>")
    return ab("02", "Bottom bar per peran",
              "Tab yang tidak boleh diakses disembunyikan, bukan dikunci. Urutan tetap: beranda kerja, alat utama, Pasien, alat peran, Lainnya. Sumber izin: Permissions::MATRIX dan NAV di App.tsx.",
              grid)


# ---------- 03 Pengaturan HP ----------
GROUPS = [
    ("Profil saya", "user", "Nama, PIN Selesai, kata sandi"),
    ("Tampilan dan mode", "palette", "Mode Dokter · teks normal"),
    ("Notifikasi", "bell", "Janji baru, pasien hadir"),
    ("Rekam medis", "file", "PIN wajib · koreksi 24 jam"),
    ("Tarif dan tagihan", "tag", "3 tingkat tarif"),
    ("Klinik dan cabang", "building", "3 cabang"),
    ("Pengguna dan peran", "shield", "8 staf"),
]


def ab03() -> str:
    lvl1 = (f'<div class="searchf">{ico("search")}Cari setelan</div>'
            '<p class="grp-t">Saya</p><div class="card">' + "".join(li(n, i, s) for n, i, s in GROUPS[:3]) + "</div>"
            '<p class="grp-t">Klinik</p>'
            '<div class="card">' + "".join(li(n, i, s) for n, i, s in GROUPS[3:]) + "</div>")
    p1 = phone(header_back("Pengaturan"), lvl1, bnav("Pemilik", "Lainnya"))

    common = ('<div class="card">'
              + li("Wajib PIN saat Selesai", sub="Semua dokter", chev=False, right=sw(True))
              + li("Tenggat koreksi bebas", val="24 jam")
              + li("Template tindakan", val="12")
              + "</div>")
    acc_closed = (f'<div class="card acc"><div class="acc-h">Lanjutan{ico("chev-d")}</div></div>')
    p2 = phone(header_back("Rekam medis"), common + acc_closed, bnav("Pemilik", "Lainnya"))

    acc_open = ('<div class="card acc open"><div class="acc-h">Lanjutan' + ico("chev-d") + '</div><div class="acc-b">'
                + li("Format No. RM", val="KM-0001")
                + li("Dentisi dari umur", sub="Bisa diubah per pasien", chev=False, right=sw(True))
                + li("Tampilan awal bagan", val="2D")
                + li("Ekspor rekam medis", sub="Butuh PIN pemilik")
                + "</div></div>")
    toast = (f'<div class="toast" role="status">{ico("check")}<span class="tx">Tersimpan</span></div>')
    p3 = phone(header_back("Rekam medis"), common + acc_open, bnav("Pemilik", "Lainnya"), toast)

    staff = ('<div class="card">'
             + li("Sari Wulandari", sub="Resepsionis · Kemang")
             + li("drg. Nadia Putri", sub="Dokter Gigi · Kemang, Tebet")
             + li("Rudi Hartono", sub="Kasir · Kemang")
             + "</div>")
    dlg = ('<div class="scrim"></div><div class="dlg" role="alertdialog" aria-labelledby="d1">'
           f'<span class="ib">{ico("shield")}</span><h2 id="d1">Ubah peran Sari jadi Kasir?</h2>'
           '<p>Sari tidak bisa lagi membuat janji. Berlaku saat ia masuk berikutnya. Tercatat di log audit.</p>'
           '<div class="acts">' + btn("Ubah peran", "primary", extra="button--full") + btn("Batal", "secondary", extra="button--full") + "</div></div>")
    p4 = phone(header_back("Pengguna dan peran"), staff, bnav("Pemilik", "Lainnya"), dlg)

    body = ('<div class="row">'
            + ph_col(p1, "<b>Level 1.</b> Grup ringkas + nilai kini. Grup tanpa izin tidak muncul. Cari setelan untuk lompat langsung.")
            + ph_col(p2, "<b>Level 2.</b> Tiga setelan umum. Switch simpan langsung. Baris bernilai membuka sheet edit dengan satu tombol Simpan.")
            + ph_col(p3, "<b>Lanjutan dibuka.</b> Accordion 0fr ke 1fr, 200ms. Toast Tersimpan 200ms masuk, 120ms keluar.")
            + ph_col(p4, "<b>Setelan berisiko.</b> Ubah peran, nonaktifkan staf, hapus cabang: dialog konfirmasi. Hapus memakai tombol danger dan ketik nama.")
            + "</div>")
    return ab("03", "Pengaturan HP: level 1, level 2, Lanjutan",
              "Push navigation: tiap level layar penuh, kembali di kiri atas atau geser dari tepi. Bottom bar tetap. Pengaturan RM lama pindah ke Rekam medis dan Profil saya (PIN Selesai).",
              body)


# ---------- 04 Pengaturan desktop ----------
def ab04() -> str:
    side_items = [("KLINIK", None), ("Beranda", "home"), ("Jadwal", "calendar"), ("Antrean", "queue"), ("Pasien", "users"),
                  ("KLINIS", None), ("Rekam Medis", "tooth"), ("Resep", "receipt"), ("KEUANGAN", None), ("Kasir", "card"), ("Laporan", "chart")]
    side = [f'<div class="brand"><i>{ico("tooth", "ic-sm")}</i>Bittodent</div>']
    for lab, icn in side_items:
        side.append(f'<div class="cap">{lab}</div>' if icn is None else f'<a>{ico(icn)}{lab}</a>')
    side.append('<div style="flex:1"></div>')
    side.append(f'<a class="on">{ico("settings")}Pengaturan</a>')
    glist = (f'<div class="searchf">{ico("search")}Cari setelan</div>'
             + "".join(li(n, i, chev=False, cls="on" if n == "Rekam medis" else "") for n, i, s in GROUPS))
    detail = ('<h3>Rekam medis</h3><p class="mu">Berlaku untuk semua cabang.</p>'
              '<div class="card" style="max-width:640px">'
              + li("Wajib PIN saat Selesai", sub="Semua dokter", chev=False, right=sw(True))
              + li("Tenggat koreksi bebas", sub="Setelah lewat, koreksi butuh persetujuan pemilik", val="24 jam")
              + li("Template tindakan", val="12")
              + "</div>"
              '<div class="card acc open" style="max-width:640px"><div class="acc-h">Lanjutan' + ico("chev-d") + '</div><div class="acc-b">'
              + li("Format No. RM", val="KM-0001")
              + li("Dentisi dari umur", sub="Bisa diubah per pasien", chev=False, right=sw(True))
              + li("Tampilan awal bagan", val="2D")
              + "</div></div>")
    top = ('<div class="dtop"><h2>Pengaturan</h2>' + syn()
           + '<span class="who"><span class="av sm">AC<span class="mb">' + ico("steth") + '</span></span>'
           '<span>drg. Andi Contoh<small>Mode Dokter · Kemang</small></span></span></div>')
    desk = (f'<div class="desk"><aside class="side">{"".join(side)}</aside><div class="dcol">{top}'
            f'<div class="split"><div class="glist">{glist}</div><div class="detail">{detail}</div></div></div></div>')

    roles = ["Pemilik", "Dokter", "Asisten", "Resepsionis", "Kasir"]
    vis = {
        "Profil saya": "yyyyy", "Tampilan dan mode": "yyyyy", "Notifikasi": "yyyyy", "Rekam medis": "yynnn",
        "Tarif dan tagihan": "ynnnn", "Klinik dan cabang": "ynnnn", "Pengguna dan peran": "ynnnn",
    }
    head = "<tr><th>Grup</th>" + "".join(f"<th>{r}</th>" for r in roles) + "</tr>"
    body_rows = "".join(
        f"<tr><td>{g}</td>" + "".join('<td class="y">Tampil</td>' if c == "y" else '<td class="n">Sembunyi</td>' for c in v) + "</tr>"
        for g, v in vis.items())
    note = ('<div class="ph-col" style="max-width:420px"><p class="ph-cap"><b>Dokter</b> melihat Rekam medis versi pribadi: PIN Selesai saya dan template tindakan. '
            'Wajib PIN dan tenggat koreksi hanya untuk pemilik (settings.manage).</p>'
            '<p class="ph-cap"><b>Tarif dan tagihan</b> tampil bila tariff.manage. Kasir dan resepsionis melihat tarif di Kasir, bukan di Pengaturan.</p>'
            '<p class="ph-cap"><b>Mode</b> di Tampilan dan mode hanya muncul bila akun punya 2 mode atau lebih.</p></div>')
    body = (desk + '<div class="row" style="margin-top:24px">'
            f'<table class="matrix">{head}{body_rows}</table>{note}</div>')
    return ab("04", "Pengaturan desktop: dua kolom",
              "Daftar grup kiri 320px, tanpa chevron karena tidak pindah layar, detail kanan. Pilihan umum di kartu atas, Lanjutan dilipat. Klik grup ganti detail tanpa pindah halaman (fade 120ms). URL #/pengaturan/rekam-medis agar bisa ditautkan.",
              body)


# ---------- 05 Mode ----------
MODES = [
    ("Dokter", "steth", "Pasien saya, RM, odontogram"),
    ("Meja depan", "desk", "Jadwal, check-in, kasir"),
    ("Pemilik", "crown", "Laporan, persetujuan, pengaturan"),
]


def mode_sheet(current: str) -> str:
    ro = "".join(
        f'<div class="ro{" on" if n == current else ""}" role="radio" aria-checked="{"true" if n == current else "false"}">'
        f'<span class="lead">{ico(i)}</span><span class="rt">{n}<small>{d}</small></span><span class="dot"></span></div>'
        for n, i, d in MODES)
    return ('<div class="scrim"></div><div class="sheet" role="dialog" aria-label="Ganti mode">'
            '<div class="handle-hit"><span class="handle"></span></div>'
            '<div class="prof"><span class="av">AC</span><span class="pt"><b>drg. Andi Contoh</b><span>Pemilik · Dokter Gigi</span></span></div>'
            f'<div class="rg" role="radiogroup" aria-label="Mode">{ro}</div>'
            '<div class="ingrp">' + li("Cabang", "pin", val="Kemang") + "</div>"
            '<div class="safe"><i></i></div></div>')


def flow() -> str:
    n = [
        ('node st arr', 'Ketuk avatar', 'atau Lainnya, baris Mode'),
        ('node arr', 'Sheet Mode', 'RadioGroup ikon, mode kini terpilih'),
        ('node arr', 'Ketuk mode lain', 'tanpa tombol Terapkan'),
        ('node dec arr', 'Ada isian belum disimpan?', 'Tidak: langsung ganti'),
        ('node ok', 'Ganti', 'nav + beranda berubah, 200ms'),
    ]
    cells = "".join(f'<div class="{c}">{t}<small>{s}</small></div>' for c, t, s in n)
    row2 = (
        '<div></div><div></div><div></div>'
        '<div class="node dec up" style="grid-column:4">Ya: draf klinis<small>disimpan otomatis sebagai draf, lalu ganti</small></div>'
        '<div class="node ok up">Toast<small>"Mode Meja depan" + Urungkan, 5 detik</small></div>'
        '<div></div><div></div><div></div>'
        '<div class="node dec up" style="grid-column:4">Ya: form lain<small>dialog: Simpan dan ganti / Batal / Buang</small></div>'
        '<div class="node ok up">Ingat di perangkat<small>mode:{tenant}:{user}, gagal = default peran</small></div>'
    )
    return f'<div class="flow">{cells}{row2}</div>'


def ab05() -> str:
    home_desk = '<p class="k">Perlu tindakan</p>' + appts(4)
    p1 = phone(header_home(mode_icon="desk"), home_desk, bnav("Meja depan", "Beranda", {"Jadwal": 2}))
    p2 = phone(header_home(mode_icon="desk"), home_desk, bnav("Meja depan", "Beranda", {"Jadwal": 2}), mode_sheet("Meja depan"))
    form = ('<p class="k">Pasien baru</p><div class="inp">Nama<span style="color:var(--color-neutral-500)">Rina Lestari</span></div>'
            '<div class="inp">No. HP<span style="color:var(--color-neutral-500)">0812 0000 0000</span></div>')
    dlg = ('<div class="scrim"></div><div class="dlg" role="alertdialog" aria-labelledby="d2">'
           f'<span class="ib">{ico("alert")}</span><h2 id="d2">Simpan pasien baru dulu?</h2>'
           '<p>Isian belum disimpan. Pilih Simpan dan ganti agar tidak hilang.</p>'
           '<div class="acts">' + btn("Simpan dan ganti", "primary", extra="button--full") + btn("Batal", "secondary", extra="button--full")
           + btn("Buang isian", "ghost", extra="button--full") + "</div></div>")
    p3 = phone(header_back("Pasien Baru"), form, bnav("Meja depan", "Pasien"), dlg)
    home_doc = ('<p class="k">Pasien saya · 3</p>' + appts(3)
                )
    toast = (f'<div class="toast" role="status">{ico("check")}<span class="tx">Mode Dokter</span>'
             + btn("Urungkan", "ghost", extra="button--sm") + "</div>")
    p4 = phone(header_home(mode_icon="steth"), home_doc, bnav("Dokter", "Beranda"), toast)
    phones = ('<div class="row">'
              + ph_col(p1, "<b>Meja depan.</b> Lencana mode di avatar. Ketuk avatar membuka sheet Mode (hanya bila 2 mode atau lebih).")
              + ph_col(p2, "<b>Sheet Mode.</b> RadioGroup ikon, 72px per opsi. Ketuk langsung berlaku dan sheet tutup. Cabang di bawah, satu tempat untuk konteks.")
              + ph_col(p3, "<b>Isian belum disimpan.</b> Form biasa: dialog, Simpan dan ganti primer. Catatan klinis tidak pernah dibuang: jadi draf otomatis.")
              + ph_col(p4, "<b>Sesudah.</b> Bar Dokter, Beranda = Pasien saya. Pill pindah 200ms, konten fade 120ms keluar lalu masuk. Toast dengan Urungkan.")
              + "</div>")
    spec = ('<div class="spec">'
            '<div class="card"><b>Mode di kode</b>Jadwal HP (feat/jadwal-mobile, feat/motion): Meja depan | Dokter, hanya untuk dokter yang juga punya peran meja. '
            'Disimpan jadwal-mode:{user}, sinkron ke Beranda lewat event. Staging belum punya mode.</div>'
            '<div class="card"><b>Yang berubah</b>Mode = tampilan saja: bar, Beranda, urutan menu Lainnya. Izin tetap gabungan semua peran, server tetap memeriksa. '
            'Rute yang tidak ada di mode baru pindah ke Beranda.</div>'
            '<div class="card"><b>Ingat per perangkat</b>localStorage mode:{tenant}:{user}. HP klinik bersama tetap per akun. '
            'Login pertama: default peran (dokter saja = Dokter, ada peran meja = Meja depan, pemilik saja = Pemilik).</div>'
            '<div class="card"><b>Gerak</b>Total 200ms atau kurang: pill transform 200ms standard, konten opacity 120ms. '
            'Sheet masuk 280ms spring. prefers-reduced-motion: ganti tanpa gerak. Mulai kunjungan tetap pindah ke Dokter otomatis + toast.</div>'
            '</div>')
    body = flow() + '<div style="height:24px"></div>' + phones + spec
    return ab("05", "Ganti mode: flow, sheet, dan sesudah ganti",
              "Akun contoh: Pemilik + Dokter Gigi, 3 mode. Dua jalan masuk: avatar di header (2 ketukan) atau Lainnya, baris Mode. Desktop: menu avatar memakai RadioGroup yang sama.",
              body)


def ab(num: str, title: str, desc: str, body: str) -> str:
    return (f'<section class="ab" id="ab-{num}"><div class="ab-k"><span class="ab-n">{num}</span><span class="ab-t">{title}</span></div>'
            f'<p class="ab-d">{desc}</p>{body}</section>')


def build() -> str:
    parts = [ab01(), ab02(), ab03(), ab04(), ab05()]
    return f"""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Bittodent · Menu, Pengaturan, Mode</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
{TOKENS}
{CSS}
</style>
</head>
<body>
<div class="wrap">
  <h1 class="page">Menu bar, Lainnya, Pengaturan, dan ganti mode</h1>
  <p class="lede">HP dan desktop. Pola HeroUI v3: tabs pill, sheet, RadioGroup, Switch, Accordion, toast. Token Bittodent, teal hanya tombol primer, grid 8pt. {syn()}</p>
  {''.join(parts)}
</div>
</body>
</html>
"""


def main() -> None:
    html = build()
    if "\u2014" in html:
        raise SystemExit("em dash found")
    if 'src="http' in html:
        raise SystemExit("external image reference")
    OUT.write_text(html)
    ART.parent.mkdir(parents=True, exist_ok=True)
    ART.write_text(html)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
    print(f"wrote {ART}")


if __name__ == "__main__":
    main()
