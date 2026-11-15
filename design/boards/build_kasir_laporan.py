#!/usr/bin/env python3
"""Papan mode Kasir, laporan HP, unduh dokumen, dan Profil klinik.

Hasil: design/boards/kasir-laporan.html
dan /workspace/artifacts/kasir-laporan.html
Data sintetis. Tanpa JavaScript. Tidak mengubah kode app.
Gaya HeroUI v3 seperti menu-pengaturan-mode. Teal #0B6B62 hanya tombol primer. Grid 8pt.
"""
from __future__ import annotations

import base64
import io
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "design/boards/kasir-laporan.html"
ART = Path("/workspace/artifacts/kasir-laporan.html")
TOKENS = (ROOT / "design/tokens.css").read_text().replace("\u2014", "-")

ICONS = {

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

    "print": '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
    "wa": '<path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5z"/><path d="M8.5 9.5c.2 2 2.2 4.2 4.2 4.5M15.2 14.2c-.6.4-1.3.3-1.3.3"/>',
    "download": '<path d="M12 3v12M7 11l5 5 5-5M5 21h14"/>',
    "camera": '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    "scan": '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M4 12h16"/>',
    "cash": '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    "bank": '<path d="M3 10 12 3l9 7M4 10v10h16V10M9 20v-6h6v6"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "x": '<path d="M18 6 6 18M6 6l12 12"/>',
    "mail": '<path d="M4 4h16v16H4z"/><path d="m4 7 8 6 8-6"/>',
    "phone": '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.5-1.1a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2.1z"/>',
    "share": '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
    "split": '<path d="M16 3h5v5M21 3 9 15M8 13H3v5M3 18l8-8"/>',
    "alert": '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    "excel": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13l3 3 5-6"/>',

}

BASE_CSS = r"""
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
.inp{display:flex;align-items:center;justify-content:space-between;height:48px;border-radius:14px;border:1px solid var(--color-neutral-300);padding:0 16px;font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden}

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

EXTRA_CSS = r"""
/* Kasir, laporan, dokumen */
.scroll{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:16px}
.kpi-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.kpi{background:#fff;border:1px solid var(--color-neutral-200);border-radius:16px;padding:12px 16px;display:flex;flex-direction:column;gap:4px;min-height:72px}
.kpi small{font-size:12px;font-weight:600;color:var(--color-neutral-500)}
.kpi b{font-size:18px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.kpi .up{color:var(--color-success-fg);font-size:11px;font-weight:700;letter-spacing:0;text-transform:none}
.chips{display:flex;gap:8px;overflow:hidden}
.body.compact{gap:12px}
.logo-up.sm{width:64px;height:64px;border-radius:12px}
.fchip{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 16px;border-radius:999px;border:1px solid var(--color-neutral-200);
  background:#fff;font-size:13px;font-weight:600;color:var(--color-neutral-700);flex:none;white-space:nowrap}
.fchip.on{background:var(--color-neutral-900);color:#fff;border-color:var(--color-neutral-900)}
.bill{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid var(--color-neutral-200);border-radius:16px;padding:12px 16px;min-height:80px}
.bill .who{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font-size:15px;font-weight:700}
.bill .who small{font-size:12px;font-weight:500;color:var(--color-neutral-500);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bill .amt{text-align:right;font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;display:flex;flex-direction:column;gap:4px;align-items:flex-end}
.line{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;font-size:14px;font-weight:600}
.line small{display:block;font-size:12px;font-weight:500;color:var(--color-neutral-500)}
.line .r{font-variant-numeric:tabular-nums;text-align:right}
.tot{font-size:16px;font-weight:700}
.dock{flex:none;padding:8px 16px 12px;background:#fff;border-top:1px solid var(--color-neutral-100);display:flex;flex-direction:column;gap:8px}
.meth{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.meth .ro{min-height:80px;flex-direction:column;align-items:flex-start;gap:8px;padding:12px}
.meth .ro .lead{width:32px;height:32px;border-radius:10px}
.meth .ro .dot{position:absolute;right:12px;top:12px}
.meth .ro{position:relative}
.big{font-size:28px;font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1.1}
.ok-mark{width:64px;height:64px;border-radius:999px;background:var(--color-success-bg);color:var(--color-success-fg);display:grid;place-items:center;margin:8px auto 0}
.ok-mark svg{width:32px;height:32px}
.acts-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.acts-row .button{flex-direction:column;gap:4px;min-height:64px;padding:8px;border-radius:16px;background:var(--color-neutral-100);font-size:12px}
.receipt,.paper{background:#fff;border:1px solid var(--color-neutral-200);border-radius:8px;padding:16px;font-size:12px;line-height:1.45;color:var(--color-neutral-800)}
.receipt{width:100%}
.kop{display:flex;gap:12px;align-items:flex-start;padding:0 0 12px;border-bottom:1px solid var(--color-neutral-200);margin:0 0 12px}
.kop img,.logo-mark{width:40px;height:40px;border-radius:10px;flex:none}
.kop .nm{font-size:13px;font-weight:700;letter-spacing:-.01em}
.kop .ad{font-size:11px;font-weight:500;color:var(--color-neutral-600);margin-top:2px}
.bars{display:flex;align-items:flex-end;gap:6px;height:88px;padding:0 4px}
.bars i{flex:1;background:var(--color-primary-200);border-radius:4px 4px 0 0;display:block}
.bars i.on{background:var(--color-primary-700)}
.bars-lab{display:flex;gap:6px;font-size:10px;font-weight:600;color:var(--color-neutral-500);justify-content:space-between}
.rep{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid var(--color-neutral-200);border-radius:16px;padding:12px 16px;min-height:64px}
.rep .lt{flex:1;display:flex;flex-direction:column;gap:2px;font-size:15px;font-weight:700}
.rep .lt small{font-size:12px;font-weight:500;color:var(--color-neutral-500)}
.chk{width:22px;height:22px;border-radius:6px;border:2px solid var(--color-neutral-300);flex:none;display:grid;place-items:center;background:#fff}
.chk.on{background:var(--color-primary-700);border-color:var(--color-primary-700);color:#fff}
.chk.on svg{width:14px;height:14px}
.format{display:flex;flex-direction:column;gap:8px}
.a4{width:420px;height:594px;background:#fff;border:1px solid var(--color-neutral-200);border-radius:4px;box-shadow:0 8px 24px rgba(22,33,43,.08);
  padding:28px 28px 20px;display:flex;flex-direction:column;gap:12px;font-size:11px;color:var(--color-neutral-800);flex:none}
.a4 h2{margin:0;font-size:16px;font-weight:700;letter-spacing:-.02em}
.a4 .period{font-size:11px;font-weight:600;color:var(--color-neutral-500)}
.a4 table{width:100%;border-collapse:collapse;font-size:10px}
.a4 th{text-align:left;font-size:10px;color:var(--color-neutral-500);font-weight:700;padding:6px 0;border-bottom:1px solid var(--color-neutral-200)}
.a4 td{padding:6px 0;border-bottom:1px solid var(--color-neutral-100);font-weight:600}
.a4 td.r,.a4 th.r{text-align:right;font-variant-numeric:tabular-nums}
.a4 .sum{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.a4 .sum div{background:var(--color-neutral-50);border-radius:8px;padding:8px}
.a4 .sum small{display:block;font-size:9px;font-weight:600;color:var(--color-neutral-500)}
.a4 .sum b{font-size:13px;font-weight:700}
.a4 .ft{margin-top:auto;display:flex;justify-content:space-between;font-size:9px;color:var(--color-neutral-500);border-top:1px solid var(--color-neutral-200);padding-top:8px}
.logo-up{width:96px;height:96px;border-radius:16px;border:1px dashed var(--color-neutral-300);display:grid;place-items:center;overflow:hidden;background:var(--color-neutral-50);flex:none}
.logo-up img{width:100%;height:100%;object-fit:cover}
.crop{position:relative;width:280px;height:280px;margin:0 auto;background:var(--color-neutral-200);border-radius:16px;overflow:hidden}
.crop img{width:100%;height:100%;object-fit:cover;opacity:.7}
.crop .frame{position:absolute;left:40px;top:40px;width:200px;height:200px;border:2px solid #fff;box-shadow:0 0 0 200px rgba(16,24,40,.45);border-radius:8px}
.field{display:flex;flex-direction:column;gap:6px}
.field label{font-size:12px;font-weight:600;color:var(--color-neutral-600)}
.desk.tall{height:960px}
.detail.rowish{flex-direction:row;align-items:flex-start;gap:24px}
.detail .form{flex:1;min-width:0;display:flex;flex-direction:column;gap:16px}
.preview-col{width:280px;flex:none}
.warn-box{background:var(--color-warning-bg);border:1px solid var(--color-warning-border);color:var(--color-warning-fg);border-radius:14px;padding:12px 16px;display:flex;gap:12px;align-items:flex-start;font-size:13px;font-weight:600}
.ok-box{background:var(--color-success-bg);color:var(--color-success-fg);border-radius:14px;padding:12px 16px;font-size:13px;font-weight:600}
.newtag{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;background:var(--color-primary-50);color:var(--color-primary-800);font-size:10px;font-weight:700;letter-spacing:.04em}
body.board{background:#E8EEF0}
"""
def make_logo() -> str:
    im = Image.new("RGB", (256, 256), "#0B6B62")
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((16, 16, 240, 240), 48, fill="#0B6B62")
    d.ellipse((78, 64, 178, 164), outline="#FFFFFF", width=14)
    d.arc((70, 100, 186, 200), 20, 160, fill="#FFFFFF", width=14)
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


LOGO = make_logo()


def ico(name: str, cls: str = "ic") -> str:
    return (f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg>')


def syn() -> str:
    return '<span class="syn">DATA SINTETIS</span>'


def btn(label: str, kind: str = "ghost", icon: str = "", extra: str = "", aria: str = "") -> str:
    i = ico(icon) if icon else ""
    a = f' aria-label="{aria}"' if aria else ""
    return f'<button class="button button--{kind} {extra}" type="button"{a}>{i}{label}</button>'


def icon_btn(icon: str, aria: str) -> str:
    return f'<button class="button button--ghost button--icon" type="button" aria-label="{aria}">{ico(icon)}</button>'


NAV = {
    "Kasir": [("Kasir", "card"), ("Antrean", "queue"), ("Pasien", "users"), ("Lainnya", "more")],
    "Pemilik": [("Beranda", "home"), ("Jadwal", "calendar"), ("Pasien", "users"), ("Laporan", "chart"), ("Lainnya", "more")],
}


def bnav(role: str = "Kasir", active: str = "Kasir", badge: dict | None = None) -> str:
    badge = badge or {}
    items = []
    for lab, icon in NAV[role]:
        on = " on" if lab == active else ""
        cur = ' aria-current="page"' if on else ""
        b = f'<span class="bdg">{badge[lab]}</span>' if lab in badge else ""
        items.append(f'<a class="navi{on}"{cur}><span class="pill">{ico(icon)}</span>{lab}{b}</a>')
    return f'<nav class="bnav" aria-label="Navigasi utama"><div class="bnav-row">{"".join(items)}</div><div class="safe"><i></i></div></nav>'


def header_home(clinic: str = "Senyum Sehat Kemang", sub: str = "Minggu, 15 Nov", initials: str = "RH", right: str = "") -> str:
    r = right or icon_btn("logout", "Tutup shift")
    return (f'<header class="hd"><div class="clinic"><b>{clinic}</b><span>{sub}</span></div>{syn()}'
            f'{r}</header>')


def header_back(title: str, right: str = "") -> str:
    return f'<header class="hd back">{icon_btn("chev-l", "Kembali")}<h1>{title}</h1>{right or syn()}</header>'


def phone(header: str, body: str, nav: str = "", overlay: str = "", white: bool = False, dock: str = "", compact: bool = False) -> str:
    cls = "body"
    if white:
        cls += " white"
    if compact:
        cls += " compact"
    return (f'<div class="ph"><div class="ph-bar"><span>09.40</span><span></span></div>{header}'
            f'<div class="{cls}">{body}</div>{dock}{nav}{overlay}</div>')


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


def chip(text: str, kind: str = "") -> str:
    return f'<span class="chip {kind}">{text}</span>'


def fchips(*pairs: tuple[str, bool]) -> str:
    out = []
    for lab, on in pairs:
        out.append(f'<button class="fchip{" on" if on else ""}" type="button">{lab}</button>')
    return f'<div class="chips">{"".join(out)}</div>'


def kop(size: int = 40) -> str:
    return (f'<div class="kop"><img src="{LOGO}" alt="" width="{size}" height="{size}">'
            '<div><div class="nm">Klinik Gigi Senyum Sehat</div>'
            '<div class="ad">Jl. Kemang Raya No. 18, Jakarta Selatan 12730<br>'
            'Tel (021) 7182-4410 · NPWP 10.0.1.3-012.000</div></div></div>')


def ro(icon: str, label: str, sub: str = "", on: bool = False) -> str:
    return (f'<div class="ro{" on" if on else ""}"><span class="lead">{ico(icon)}</span>'
            f'<span class="rt">{label}{"<small>"+sub+"</small>" if sub else ""}</span><span class="dot"></span></div>')


def ab(num: str, title: str, desc: str, inner: str) -> str:
    return (f'<section class="ab" id="ab-{num}"><div class="ab-k"><span class="ab-n">{num}</span>'
            f'<span class="ab-t">{title}</span></div><p class="ab-d">{desc}</p><div class="row">{inner}</div></section>')


# ----- artboards -----

def ab01() -> str:
    kpi = ('<div class="kpi-row"><div class="kpi"><small>Belum bayar</small><b>3</b></div>'
           '<div class="kpi"><small>Diterima hari ini</small><b>Rp 2,15 jt</b></div></div>')
    chips = fchips(("Semua", False), ("Belum", True), ("BPJS", False), ("Tempo", False))
    rows = [
        ("SN", "Sari Nugroho", "09.20 · Andi · Tumpatan 26", "Rp 450.000", "Belum bayar", "warn"),
        ("HH", "Hendra Hidayat", "10.05 · Andi · Scaling, klaim BPJS", "Rp 150.000", "Sisa", "warn"),
        ("BS", "Budi Santoso", "11.00 · Bunga · Kontrol", "Rp 250.000", "Belum bayar", "warn"),
    ]
    bills = []
    for av, who, sub, amt, st, tone in rows:
        bills.append(f'<div class="bill"><span class="av sm">{av}</span><span class="who">{who}<small>{sub}</small></span>'
                     f'<span class="amt">{amt}{chip(st, tone)}</span></div>')
    body = kpi + chips + "".join(bills)
    p1 = phone(header_home(right=icon_btn("logout", "Tutup shift")), body, bnav("Kasir", "Kasir", {"Kasir": 3}))
    # Lainnya: Kasir hides Laporan, Pemilik has it as a tab already - show Lainnya lists
    kasir_lain = phone(
        header_home("Rudi Hartono", "Kasir · Kemang", "RH", icon_btn("x", "Tutup")),
        '<p class="grp-t">Menu</p><div class="card">'
        + li("Antrean", "queue", "Hadir di klinik")
        + li("Shift hari ini", "cash", "Buka 08.00")
        + li("Pengaturan", "settings", "Tampilan, PIN")
        + "</div>",
        bnav("Kasir", "Lainnya", {"Kasir": 3}),
        white=False,
    )
    mil = phone(
        header_home("Andi Contoh", "Pemilik · Kemang", "AC", icon_btn("x", "Tutup")),
        '<p class="grp-t">Menu</p><div class="card">'
        + li("Kasir", "card", "3 belum bayar")
        + li("Pengaturan", "settings", "Profil klinik, pengguna")
        + "</div>",
        bnav("Pemilik", "Lainnya"),
    )
    return ab("01", "Antrean tagihan, mode Kasir",
              "Beranda Kasir di HP. Tab Kasir / Antrean / Pasien / Lainnya, lencana 3 belum bayar. "
              "Kartu tagihan, bukan tabel. Laporan tidak tampil di bar Kasir (disembunyikan), tampil sebagai tab pada pemilik.",
              ph_col(p1, "<b>Antrean.</b> Satu titik fokus: siapa yang belum bayar. Tutup shift di ikon header.")
              + ph_col(kasir_lain, "<b>Lainnya, Kasir.</b> Tidak ada baris Laporan.")
              + ph_col(mil, "<b>Lainnya, Pemilik.</b> Laporan tetap di tab bar, bukan dikunci di sini."))


def ab02() -> str:
    lines = (
        '<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">'
        '<div class="line"><span>Tumpatan komposit 26 MOD<small>Dari RM · Andi · 26 MOD</small></span><span class="r">Rp 350.000</span></div>'
        '<div class="line"><span>Scaling<small>Dari RM · Andi</small></span><span class="r">Rp 150.000</span></div>'
        '<div class="line"><span>Diskon anggota 10%</span><span class="r">- Rp 50.000</span></div>'
        '<div class="line"><span>Asuransi / BPJS</span><span class="r">Tidak dipakai</span></div>'
        '<div class="line tot"><span>Tagihan</span><span class="r">Rp 450.000</span></div></div>'
    )
    body = (
        '<div class="bill" style="margin:0"><span class="av sm">SN</span>'
        '<span class="who">Sari Nugroho<small>BT-000040 · 13 th · Umum</small></span></div>'
        + lines +
        '<button class="button button--secondary" type="button">Tambah diskon atau klaim</button>'
    )
    dock = '<div class="dock">' + btn("Bayar Rp 450.000", "primary", extra="button--full") + "</div>"
    p = phone(header_back("Tagihan TG-2415"), body, bnav("Kasir", "Kasir", {"Kasir": 3}), dock=dock)
    # BPJS variant
    lines2 = (
        '<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">'
        '<div class="line"><span>Scaling<small>Dari RM · Andi</small></span><span class="r">Rp 400.000</span></div>'
        '<div class="line"><span>Klaim BPJS<small>Disetujui sebagian</small></span><span class="r">- Rp 250.000</span></div>'
        '<div class="line tot"><span>Sisa dibayar pasien</span><span class="r">Rp 150.000</span></div></div>'
    )
    body2 = (
        '<div class="bill" style="margin:0"><span class="av sm">HH</span>'
        '<span class="who">Hendra Hidayat<small>BT-000009 · 65 th · BPJS</small></span></div>'
        + lines2
    )
    dock2 = '<div class="dock">' + btn("Bayar sisa Rp 150.000", "primary", extra="button--full") + "</div>"
    p2 = phone(header_back("Tagihan TG-2416"), body2, bnav("Kasir", "Kasir", {"Kasir": 3}), dock=dock2)
    return ab("02", "Detail tagihan: tindakan RM, diskon, BPJS",
              "Rincian hanya dari tindakan yang sudah dicatat di rekam medis. Diskon dan klaim terlihat sebelum bayar. Satu tombol primer.",
              ph_col(p, "<b>Umum.</b> Dua tindakan dari RM, diskon 10 persen, total Rp 450.000.")
              + ph_col(p2, "<b>BPJS.</b> Klaim mengurangi tagihan. Yang dibayar kasir hanya sisanya."))


def ab03() -> str:
    methods = ('<div class="meth">'
               + ro("cash", "Tunai", "Kembalian dihitung", True)
               + ro("scan", "QRIS", "QR statis cabang")
               + ro("card", "Debit", "EDC")
               + ro("bank", "Transfer", "Rekening klinik")
               + "</div>")
    body = (
        '<div><small class="k">Sisa tagihan</small><div class="big">Rp 450.000</div></div>'
        + methods +
        '<div class="card" style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between">'
        '<span class="lt" style="display:flex;flex-direction:column;gap:2px;font-size:15px;font-weight:700">Pecah pembayaran<small style="font-weight:500;color:var(--color-neutral-500);font-size:12px">Tunai plus QRIS atau debit</small></span>'
        + sw(False) + "</div>"
        '<div class="field"><label>Uang diterima</label><div class="inp">Rp 500.000</div></div>'
        '<div class="line"><span class="mu" style="font-weight:600">Kembalian</span><span class="r">Rp 50.000</span></div>'
    )
    dock = '<div class="dock">' + btn("Terima Rp 450.000", "primary", extra="button--full") + "</div>"
    p1 = phone(header_back("Bayar"), body, bnav("Kasir", "Kasir", {"Kasir": 3}), dock=dock)
    body2 = (
        '<div><small class="k">Sisa tagihan</small><div class="big">Rp 450.000</div></div>'
        '<div class="card" style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between">'
        '<span style="font-size:15px;font-weight:700">Pecah pembayaran</span>' + sw(True) + "</div>"
        + ro("cash", "Tunai", "Rp 200.000", True)
        + ro("scan", "QRIS", "Rp 250.000", True)
        + '<div class="line tot"><span>Diterima</span><span class="r">Rp 450.000</span></div>'
    )
    dock2 = '<div class="dock">' + btn("Terima Rp 450.000", "primary", extra="button--full") + "</div>"
    p2 = phone(header_back("Bayar"), body2, bnav("Kasir", "Kasir", {"Kasir": 3}), dock=dock2)
    return ab("03", "Pembayaran: tunai, QRIS, debit, transfer, pecah",
              "Empat metode sebagai RadioGroup kartu berikon, bukan deretan tombol primer. Pecah pembayaran memakai sakelar, lalu dua metode aktif.",
              ph_col(p1, "<b>Tunai penuh.</b> Uang diterima dan kembalian. Satu primer Terima.")
              + ph_col(p2, "<b>Pecah.</b> Tunai Rp 200.000 plus QRIS Rp 250.000."))


def ab04() -> str:
    acts = ('<div class="acts-row">'
            f'<button class="button" type="button">{ico("print")}Cetak</button>'
            f'<button class="button" type="button">{ico("wa")}WhatsApp</button>'
            f'<button class="button" type="button">{ico("download")}PDF</button></div>')
    body = (
        f'<div class="ok-mark">{ico("check")}</div>'
        '<div style="text-align:center"><div class="big">Rp 450.000</div>'
        '<div style="font-size:13px;font-weight:600;color:var(--color-neutral-500);margin-top:4px">Sari Nugroho · Lunas · Tunai</div></div>'
        + acts
    )
    dock = '<div class="dock">' + btn("Selesai", "primary", extra="button--full") + "</div>"
    p1 = phone(header_back("Pembayaran diterima"), body, bnav("Kasir", "Kasir", {"Kasir": 2}), dock=dock)
    rec = (
        '<div class="receipt">' + kop()
        + '<div style="font-weight:700;margin:0 0 8px">Kuitansi TG-2415</div>'
        '<div class="line"><span>Pasien</span><span class="r">Sari Nugroho</span></div>'
        '<div class="line"><span>Tumpatan 26 MOD</span><span class="r">Rp 350.000</span></div>'
        '<div class="line"><span>Scaling</span><span class="r">Rp 150.000</span></div>'
        '<div class="line"><span>Diskon 10%</span><span class="r">- Rp 50.000</span></div>'
        '<div class="line tot"><span>Diterima tunai</span><span class="r">Rp 450.000</span></div>'
        '<div class="line"><span>Kembalian</span><span class="r">Rp 50.000</span></div>'
        '<div style="margin-top:12px;font-size:11px;color:var(--color-neutral-500)">15 Nov 2026, 09.41 · Kasir Rudi Hartono · Kemang</div></div>'
    )
    p2 = phone(header_back("Struk"), rec, bnav("Kasir", "Kasir", {"Kasir": 2}), white=True)
    wa = phone(
        header_back("Kirim struk"),
        '<div class="field"><label>WhatsApp pasien</label><div class="inp">+62 812-0000-1940</div></div>'
        '<div class="field"><label>Pesan</label><div class="inp" style="height:auto;min-height:72px;align-items:flex-start;padding:12px 16px;white-space:normal;font-size:13px;font-weight:500">Kuitansi Senyum Sehat Kemang, TG-2415, Rp 450.000. Lampiran PDF.</div></div>',
        bnav("Kasir", "Kasir", {"Kasir": 2}),
        dock='<div class="dock">' + btn("Kirim WhatsApp", "primary", extra="button--full") + btn("Batal", "secondary", extra="button--full") + "</div>",
    )
    return ab("04", "Berhasil, lalu struk: cetak, WhatsApp, PDF",
              "Sukses bukan akhir. Tiga aksi sekunder berikon, satu primer Selesai. Struk memakai kop yang sama dengan laporan: logo, nama, alamat, telepon, NPWP.",
              ph_col(p1, "<b>Berhasil.</b> Jumlah dan metode di tengah. Cetak, WA, PDF bukan tombol primer.")
              + ph_col(p2, "<b>Struk.</b> Kop klinik, rincian, kasir, cabang.")
              + ph_col(wa, "<b>Kirim WA.</b> Nomor terisi dari data pasien, PDF terlampir."))


def ab05() -> str:
    rows = (
        '<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px">'
        '<div class="line"><span>Kas awal</span><span class="r">Rp 1.000.000</span></div>'
        '<div class="line"><span>Tunai masuk</span><span class="r">Rp 1.250.000</span></div>'
        '<div class="line"><span>QRIS</span><span class="r">Rp 800.000</span></div>'
        '<div class="line"><span>Debit</span><span class="r">Rp 450.000</span></div>'
        '<div class="line"><span>Transfer</span><span class="r">Rp 200.000</span></div>'
        '<div class="line tot"><span>Seharusnya di laci</span><span class="r">Rp 2.250.000</span></div>'
        '<div class="field"><label>Kas dihitung</label><div class="inp">Rp 2.240.000</div></div>'
        '</div>'
        '<div class="warn-box">' + ico("alert") + '<span>Selisih kurang Rp 10.000. Isi alasan sebelum menutup, atau hitung ulang.</span></div>'
        '<div class="field"><label>Alasan selisih</label><div class="inp" style="color:var(--color-neutral-500);font-weight:500">Kembalian salah hitung, sudah dicatat</div></div>'
    )
    dock = '<div class="dock">' + btn("Tutup shift", "primary", extra="button--full") + "</div>"
    p1 = phone(header_back("Tutup shift"), '<div><small class="k">Rudi Hartono · 08.00–14.00</small><div style="font-size:15px;font-weight:700">Minggu, 15 Nov 2026</div></div>' + rows,
               bnav("Kasir", "Kasir"), dock=dock)
    p2 = phone(
        header_back("Shift ditutup"),
        f'<div class="ok-mark">{ico("check")}</div>'
        '<div style="text-align:center;font-size:15px;font-weight:700">Shift 15 Nov ditutup</div>'
        '<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px">'
        '<div class="line"><span>Diterima</span><span class="r">Rp 2.700.000</span></div>'
        '<div class="line"><span>Tunai di laci</span><span class="r">Rp 2.240.000</span></div>'
        '<div class="line"><span>Selisih</span><span class="r" style="color:var(--color-warning-fg)">- Rp 10.000</span></div></div>'
        '<p style="margin:0;font-size:13px;font-weight:500;color:var(--color-neutral-500)">Rekap masuk laporan harian pemilik. Kasir tidak melihat laporan ringkas di tab bar.</p>',
        bnav("Kasir", "Kasir"),
        dock='<div class="dock">' + btn("Selesai", "primary", extra="button--full") + "</div>",
    )
    return ab("05", "Tutup shift: rekap metode dan selisih kas",
              "Rekap per metode, kas awal, kas dihitung, selisih. Jika kurang atau lebih, alasan wajib sebelum primer Tutup shift aktif dalam produk (di papan sudah terisi).",
              ph_col(p1, "<b>Hitung.</b> Selisih kurang Rp 10.000, alasan terlihat, primer tetap satu.")
              + ph_col(p2, "<b>Sesudah tutup.</b> Ringkasan singkat, bukan laporan lengkap."))


def ab06() -> str:
    kpis = ('<div class="kpi-row">'
            '<div class="kpi"><small>Pendapatan</small><b>Rp 18,4 jt</b><span class="up">+8% vs 1-15 Okt</span></div>'
            '<div class="kpi"><small>Transaksi</small><b>86</b><span class="up">+5</span></div>'
            '<div class="kpi"><small>Piutang</small><b>Rp 2,10 jt</b></div>'
            '<div class="kpi"><small>Kunjungan</small><b>79</b></div></div>')
    bars = ('<div class="card" style="padding:16px"><div style="font-size:13px;font-weight:700;margin:0 0 8px">Pendapatan 7 hari</div>'
            '<div class="bars">' + "".join(f'<i style="height:{h}%" class="{"on" if i==6 else ""}"></i>' for i, h in enumerate([40, 55, 48, 70, 62, 80, 90])) + "</div>"
            '<div class="bars-lab"><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span>Min</span></div></div>')
    reps = (
        '<div class="rep">' + f'<span class="lead" style="width:40px;height:40px;border-radius:12px;background:var(--color-neutral-100);display:grid;place-items:center">{ico("chart")}</span>'
        '<span class="lt">Pendapatan<small>Per hari dan per metode</small></span>' + ico("chev-r", "ic chev") + "</div>"
        '<div class="rep">' + f'<span class="lead" style="width:40px;height:40px;border-radius:12px;background:var(--color-neutral-100);display:grid;place-items:center">{ico("user")}</span>'
        '<span class="lt">Per dokter<small>Andi, Bunga</small></span>' + ico("chev-r", "ic chev") + "</div>"
        '<div class="rep">' + f'<span class="lead" style="width:40px;height:40px;border-radius:12px;background:var(--color-neutral-100);display:grid;place-items:center">{ico("tooth")}</span>'
        '<span class="lt">Per tindakan<small>Tumpatan, scaling, mahkota</small></span>' + ico("chev-r", "ic chev") + "</div>"
        '<div class="rep">' + f'<span class="lead" style="width:40px;height:40px;border-radius:12px;background:var(--color-neutral-100);display:grid;place-items:center">{ico("alert")}</span>'
        '<span class="lt">Piutang<small>3 pasien, Rp 2,10 jt</small></span>' + ico("chev-r", "ic chev") + "</div>"
        '<div class="rep">' + f'<span class="lead" style="width:40px;height:40px;border-radius:12px;background:var(--color-neutral-100);display:grid;place-items:center">{ico("calendar")}</span>'
        '<span class="lt">Kunjungan<small>79 hadir, 4 tidak hadir</small></span>' + ico("chev-r", "ic chev") + "</div>"
    )
    body = fchips(("Hari ini", False), ("7 hari", False), ("Bulan ini", True), ("Pilih", False)) + kpis + bars
    # period is in body, reports list too - might overflow 800. Split: overview on this phone, types are the cards - maybe drop chart labels or shrink.
    p = phone(
        header_back("Laporan", icon_btn("download", "Unduh")),
        fchips(("Hari ini", False), ("7 hari", False), ("Bulan ini", True), ("Pilih", False)) + kpis + bars +
        '<p class="grp-t">Jenis</p>' + reps,
        bnav("Pemilik", "Laporan"),
    )
    # This might overflow the phone body. body has overflow hidden. Need to be careful.
    # 800 - 32 bar - 56 hd - 80 bnav-safe = ~632. chips 48 + kpi 2 rows ~152 + chart ~140 + 5 reps 320 = too much.
    # Split: phone 1 is KPI+chart, phone 2 is jenis list. Yes.
    p1 = phone(
        header_back("Laporan", icon_btn("download", "Unduh")),
        fchips(("Hari ini", False), ("7 hari", False), ("Bulan ini", True), ("Pilih", False)) + kpis + bars +
        '<p style="margin:0;font-size:12px;font-weight:600;color:var(--color-neutral-500)">1-15 Nov 2026 · Cabang Kemang</p>',
        bnav("Pemilik", "Laporan"),
    )
    p2 = phone(
        header_back("Laporan", icon_btn("download", "Unduh")),
        '<p class="grp-t">Pilih jenis, lalu unduh atau buka</p>' + reps,
        bnav("Pemilik", "Laporan"),
    )
    return ab("06", "Laporan HP: KPI, periode, grafik, jenis",
              "Untuk pemilik (tab Laporan). Chip periode 48 px, empat KPI, grafik batang 7 hari, jenis sebagai kartu. Bukan tabel lebar. Kasir tidak punya tab ini.",
              ph_col(p1, "<b>Ringkasan.</b> Bisa dipindai dalam satu lipatan: periode, angka, tren.")
              + ph_col(p2, "<b>Jenis.</b> Pendapatan, per dokter, per tindakan, piutang, kunjungan."))


def ab07() -> str:
    docs = [
        ("Andi Contoh", "52 tindakan · 41 pasien", "Rp 11,20 jt"),
        ("Bunga Lestari", "28 tindakan · 22 pasien", "Rp 5,40 jt"),
        ("Pemilik, tindakan sendiri", "6 tindakan", "Rp 1,80 jt"),
    ]
    cards = []
    for n, s, a in docs:
        cards.append(f'<div class="rep"><span class="av sm">{n[0]}{n.split()[0][1] if False else n.split()[0][0:1]}{n.split()[1][0]}</span>'
                     f'<span class="lt">{n}<small>{s}</small></span><b style="font-variant-numeric:tabular-nums">{a}</b></div>')
    # fix initials properly
    cards = [
        '<div class="rep"><span class="av sm">AC</span><span class="lt">Andi Contoh<small>52 tindakan · 41 pasien</small></span><b style="font-variant-numeric:tabular-nums">Rp 11,20 jt</b></div>',
        '<div class="rep"><span class="av sm">BL</span><span class="lt">Bunga Lestari<small>28 tindakan · 22 pasien</small></span><b style="font-variant-numeric:tabular-nums">Rp 5,40 jt</b></div>',
        '<div class="rep"><span class="av sm">CM</span><span class="lt">Citra Maharani<small>6 tindakan · 5 pasien</small></span><b style="font-variant-numeric:tabular-nums">Rp 1,80 jt</b></div>',
    ]
    p1 = phone(header_back("Per dokter", icon_btn("download", "Unduh")),
               fchips(("Bulan ini", True), ("Kemang", True)) + "".join(cards),
               bnav("Pemilik", "Laporan"))
    piut = [
        '<div class="rep"><span class="av sm">BS</span><span class="lt">Budi Santoso<small>3 hari · Kontrol</small></span><b>Rp 250.000</b></div>',
        '<div class="rep"><span class="av sm">HH</span><span class="lt">Hendra Hidayat<small>Sisa klaim · 1 hari</small></span><b>Rp 150.000</b></div>',
        '<div class="rep"><span class="av sm">RL</span><span class="lt">Rina Lestari<small>12 hari · Mahkota</small></span><b>Rp 1.700.000</b></div>',
    ]
    p2 = phone(header_back("Piutang", icon_btn("download", "Unduh")),
               '<div class="kpi"><small>Total piutang</small><b>Rp 2,10 jt</b><span style="font-size:12px;font-weight:600;color:var(--color-neutral-500)">3 pasien</span></div>'
               + "".join(piut)
               + '<div class="dock" style="border:0;padding:0">' + btn("Ingatkan lewat WA", "secondary", extra="button--full") + "</div>",
               bnav("Pemilik", "Laporan"))
    return ab("07", "Drill-down: per dokter dan piutang, list kartu",
              "Angka dokter dan piutang sebagai kartu, bisa diketuk. Tombol Ingatkan hanya di piutang, sekunder. Unduh tetap di header.",
              ph_col(p1, "<b>Per dokter.</b> Andi menanggung sebagian besar pendapatan bulan ini.")
              + ph_col(p2, "<b>Piutang.</b> Nama, umur piutang, nominal. Satu aksi sekunder untuk mengingatkan."))


def ab08() -> str:
    checks = [
        ("Tanggal dan nomor", True),
        ("Pasien dan dokter", True),
        ("Tindakan", True),
        ("Metode bayar", True),
        ("Diskon dan klaim", True),
        ("Kasir", False),
    ]
    ch = []
    for lab, on in checks:
        mark = ico("check") if on else ""
        ch.append(f'<div class="li"><span class="chk{" on" if on else ""}">{mark}</span><span class="lt">{lab}</span></div>')
    sheet = (
        '<div class="scrim"></div><div class="sheet" style="padding-bottom:12px">'
        '<div class="handle-hit"><div class="handle"></div></div>'
        "<h2>Unduh laporan</h2>"
        '<p class="sub">Pendapatan · 1-15 Nov 2026 · Kemang</p>'
        '<p class="grp-t">Format</p>'
        + ro("file", "PDF", "Untuk cetak dan arsip, ukuran A4", True)
        + ro("excel", "Excel", "Untuk diolah di lembar kerja")
        + '<p class="grp-t">Kolom</p><div class="ingrp">' + "".join(ch) + "</div>"
        + btn("Unduh PDF", "primary", extra="button--full")
        + btn("Batal", "ghost", extra="button--full")
        + "</div>"
    )
    p1 = phone(
        header_back("Laporan", icon_btn("download", "Unduh")),
        fchips(("Bulan ini", True),) + '<div class="kpi"><small>Pendapatan</small><b>Rp 18,4 jt</b></div>',
        bnav("Pemilik", "Laporan"),
        overlay=sheet,
    )
    a4 = (
        f'<div class="a4">{kop(36)}'
        "<h2>Laporan Pendapatan</h2>"
        '<div class="period">1-15 November 2026 · Cabang Kemang · DATA SINTETIS</div>'
        '<div class="sum"><div><small>Pendapatan</small><b>Rp 18.400.000</b></div>'
        "<div><small>Transaksi</small><b>86</b></div>"
        "<div><small>Piutang</small><b>Rp 2.100.000</b></div></div>"
        "<table><thead><tr><th>Tanggal</th><th>Metode</th><th class='r'>Jumlah</th></tr></thead><tbody>"
        "<tr><td>3 Nov</td><td>Tunai</td><td class='r'>Rp 1.250.000</td></tr>"
        "<tr><td>3 Nov</td><td>QRIS</td><td class='r'>Rp 800.000</td></tr>"
        "<tr><td>7 Nov</td><td>Debit</td><td class='r'>Rp 1.100.000</td></tr>"
        "<tr><td>10 Nov</td><td>Transfer</td><td class='r'>Rp 600.000</td></tr>"
        "<tr><td>15 Nov</td><td>Tunai</td><td class='r'>Rp 1.250.000</td></tr>"
        "<tr><td colspan='2'>Subtotal halaman</td><td class='r'>Rp 5.000.000</td></tr>"
        "</tbody></table>"
        '<div class="ft"><span>Dicetak 15 Nov 2026, 21.10 WIB · Andi Contoh</span><span>Halaman 1 dari 3</span></div></div>'
    )
    return ab("08", "Unduh laporan dan pratinjau PDF A4",
              "Sheet: PDF utama, Excel kedua, periode dari layar sebelumnya, kolom bisa dipilih. Pratinjau A4 memakai kop yang sama dengan struk: logo, nama, alamat, telepon, NPWP, lalu judul, periode, ringkasan, tabel, footer waktu cetak, pencetak, nomor halaman.",
              ph_col(p1, "<b>Sheet unduh.</b> Satu primer Unduh PDF. Excel tidak disembunyikan.")
              + f'<div class="ph-col">{a4}<p class="ph-cap"><b>Pratinjau A4.</b> Dokumen siap cetak, bukan tangkapan layar tabel.</p></div>')


def ab09() -> str:
    groups = (
        '<p class="grp-t">Saya</p><div class="card">'
        + li("Profil saya", "user", "Nama, PIN, kata sandi")
        + li("Tampilan dan mode", "settings")
        + "</div>"
        '<p class="grp-t">Klinik</p><div class="card">'
        + li("Profil klinik", "building", "Logo, alamat, kop dokumen", cls="on", right='<span class="newtag">BARU</span>')
        + li("Tarif dan tagihan", "tag")
        + li("Pengguna dan peran", "users")
        + "</div>"
    )
    p1 = phone(header_back("Pengaturan"), groups, bnav("Pemilik", "Lainnya"))
    form = (
        '<div style="display:flex;gap:16px;align-items:center">'
        f'<div class="logo-up sm"><img src="{LOGO}" alt="Logo klinik"></div>'
        + btn("Ganti logo", "secondary", "camera", extra="button--sm")
        + "</div>"
        '<div class="field"><label>Nama klinik</label><div class="inp">Klinik Gigi Senyum Sehat</div></div>'
        '<div class="field"><label>Telepon</label><div class="inp">(021) 7182-4410</div></div>'
        '<div class="field"><label>Email</label><div class="inp">halo@senyumsehat.contoh</div></div>'
        '<div class="field"><label>NPWP</label><div class="inp">10.0.1.3-012.000</div></div>'
        '<p class="grp-t">Alamat per cabang</p><div class="card">'
        + li("Kemang", "building", "Jl. Kemang Raya No. 18, Jakarta Selatan")
        + li("Tebet", "building", "Jl. Tebet Raya No. 21, Jakarta Selatan")
        + "</div>"
    )
    dock = '<div class="dock">' + btn("Simpan", "primary", extra="button--full") + "</div>"
    p2 = phone(header_back("Profil klinik"), form, bnav("Pemilik", "Lainnya"), dock=dock, compact=True)
    crop = (
        '<div class="crop"><img src="' + LOGO + '" alt=""><div class="frame"></div></div>'
        '<p style="margin:0;text-align:center;font-size:13px;font-weight:500;color:var(--color-neutral-500)">Geser dan cubit. Rasio 1:1, dipakai di kop.</p>'
    )
    p3 = phone(header_back("Potong logo"), crop, bnav("Pemilik", "Lainnya"),
               dock='<div class="dock">' + btn("Pakai logo", "primary", extra="button--full") + btn("Batal", "secondary", extra="button--full") + "</div>",
               white=True)
    return ab("09", "Pengaturan: Profil klinik di HP",
              "Grup baru di level 1 Pengaturan (menggantikan nama Klinik dan cabang yang terlalu sempit). Unggah logo, potong 1:1, nama, telepon, email, NPWP, alamat per cabang. Pratinjau kop menyusul di desktop agar tidak menumpuk di 360.",
              ph_col(p1, "<b>Level 1.</b> Profil klinik di grup Klinik, lencana BARU hanya di papan ini.")
              + ph_col(p2, "<b>Isian.</b> Logo di atas, cabang sebagai daftar, satu primer Simpan.")
              + ph_col(p3, "<b>Potong.</b> Bingkai 1:1, primer Pakai logo."))


def ab10() -> str:
    left = (
        '<div class="glist"><p class="grp-t">Saya</p>'
        + li("Profil saya", "user", chev=False)
        + li("Tampilan dan mode", "settings", chev=False)
        + '<p class="grp-t">Klinik</p>'
        + li("Profil klinik", "building", "Logo, alamat, kop", chev=False, cls="on")
        + li("Tarif dan tagihan", "tag", chev=False)
        + li("Pengguna dan peran", "users", chev=False)
        + "</div>"
    )
    form = (
        '<div class="form"><h3>Profil klinik</h3>'
        '<p class="mu">Dipakai di struk, kuitansi, dan laporan PDF. Berlaku per cabang untuk alamat.</p>'
        '<div style="display:flex;gap:16px;align-items:center">'
        f'<div class="logo-up"><img src="{LOGO}" alt="Logo klinik"></div>'
        + btn("Ganti logo", "secondary", "camera")
        + "</div>"
        '<div class="field"><label>Nama klinik</label><div class="inp">Klinik Gigi Senyum Sehat</div></div>'
        '<div class="field"><label>Telepon</label><div class="inp">(021) 7182-4410</div></div>'
        '<div class="field"><label>Email</label><div class="inp">halo@senyumsehat.contoh</div></div>'
        '<div class="field"><label>NPWP</label><div class="inp">10.0.1.3-012.000</div></div>'
        '<div class="field"><label>SIP atau izin (opsional, tampil di kop)</label><div class="inp" style="color:var(--color-neutral-500);font-weight:500">Kosongkan jika tidak dipakai</div></div>'
        '<p class="grp-t">Cabang</p><div class="card">'
        + li("Kemang", sub="Jl. Kemang Raya No. 18, Jakarta Selatan 12730", chev=True)
        + li("Tebet", sub="Jl. Tebet Raya No. 21, Jakarta Selatan 12810", chev=True)
        + "</div>"
        + btn("Simpan", "primary")
        + "</div>"
    )
    preview = (
        '<div class="preview-col"><p class="grp-t">Pratinjau kop</p>'
        f'<div class="receipt">{kop()}<div style="font-weight:700">Laporan Pendapatan</div>'
        '<div class="period" style="margin-top:4px">1-15 Nov 2026 · Kemang</div>'
        '<div style="margin-top:12px;font-size:11px;color:var(--color-neutral-500)">Perubahan logo dan alamat langsung terlihat di sini.</div></div></div>'
    )
    desk = (
        '<div class="desk tall"><aside class="side"><div class="brand"><i>B</i>Bittodent</div>'
        f'<div class="cap">KLINIK</div><a>{ico("home")}Beranda</a><a>{ico("calendar")}Jadwal</a>'
        f'<a>{ico("users")}Pasien</a><div class="cap">KEUANGAN</div>'
        f'<a>{ico("card")}Kasir</a><a>{ico("chart")}Laporan</a>'
        f'<div class="cap">SISTEM</div><a class="on">{ico("settings")}Pengaturan</a></aside>'
        '<div class="dcol"><div class="dtop"><h2>Pengaturan</h2>' + syn() +
        '<div class="who"><span class="av sm">AC</span><div>Andi Contoh<small>Pemilik · Kemang</small></div></div></div>'
        f'<div class="split">{left}<div class="detail rowish">{form}{preview}</div></div></div></div>'
    )
    return ab("10", "Profil klinik di desktop, dua kolom",
              "Daftar grup kiri 320 px, isian dan pratinjau kop berdampingan. Klik grup tidak pindah halaman. SIP opsional di kop. Satu primer Simpan.",
              desk)


def build() -> str:
    css = TOKENS + "\n" + BASE_CSS + "\n" + EXTRA_CSS
    body = "\n".join([ab01(), ab02(), ab03(), ab04(), ab05(), ab06(), ab07(), ab08(), ab09(), ab10()])
    return f"""<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bittodent · Kasir, laporan, profil klinik</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
{css}
  </style>
</head>
<body class="board">
  <div class="wrap">
    <h1 class="page">Mode Kasir, laporan HP, unduh, dan profil klinik</h1>
    <p class="lede">Papan untuk kasir di HP (antrean sampai struk dan tutup shift), laporan yang nyaman dibaca di 360, unduh PDF A4 berkop, dan pengaturan logo plus alamat. Pola HeroUI v3, token Bittodent, teal hanya tombol primer, grid 8pt, target 48 px. {syn()}</p>
    {body}
  </div>
</body>
</html>
"""


def main() -> None:
    html = build().replace("\u2014", "-").replace("\u2013", "-")
    OUT.write_text(html)
    ART.parent.mkdir(parents=True, exist_ok=True)
    ART.write_text(html)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
    print(f"wrote {ART}")


if __name__ == "__main__":
    main()
