#!/usr/bin/env python3
"""Papan desain Bittodent: AI dan input cepat klinik gigi, gap vs KlinikMe.

Hasil: design/boards/klinikme-gigi.html
dan /workspace/artifacts/bittodent-board-klinikme-gigi.html
Data sintetis. Tanpa JavaScript. Tidak mengubah kode app.
Gaya Zendenta; merek tetap #0B6B62.
"""
from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "design/boards/klinikme-gigi.html"
ART = Path("/workspace/artifacts/bittodent-board-klinikme-gigi.html")
TOKENS = (ROOT / "design/tokens.css").read_text()

# Lucide-like line icons (ISC). Stroke set in CSS. ViewBox 24.
ICONS: dict[str, str] = {
    "calendar": (
        '<rect x="3" y="4" width="18" height="18" rx="2"/>'
        '<path d="M16 2v4M8 2v4M3 10h18"/>'
    ),
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "x": '<path d="M18 6 6 18M6 6l12 12"/>',
    "chevron-right": '<path d="M9 18l6-6-6-6"/>',
    "chevron-left": '<path d="M15 18l-6-6 6-6"/>',
    "chevron-down": '<path d="M6 9l6 6 6-6"/>',
    "file-text": (
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>'
        '<path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>'
    ),
    "user": (
        '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>'
        '<circle cx="12" cy="7" r="4"/>'
    ),
    "users": (
        '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>'
        '<circle cx="9" cy="7" r="4"/>'
        '<path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'
    ),
    "home": (
        '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>'
    ),
    "clock": (
        '<circle cx="12" cy="12" r="10"/>'
        '<path d="M12 6v6l4 2"/>'
    ),
    "more": (
        '<circle cx="6" cy="12" r="1.15" fill="currentColor" stroke="none"/>'
        '<circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"/>'
        '<circle cx="18" cy="12" r="1.15" fill="currentColor" stroke="none"/>'
    ),
    "search": '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    "bell": (
        '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>'
        '<path d="M10.22 21a2 2 0 0 0 3.56 0"/>'
    ),
    "pill": (
        '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>'
        '<path d="m8.5 8.5 7 7"/>'
    ),
    "spark": (
        '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>'
    ),
    "quote": (
        '<path d="M3 10a5 5 0 0 1 5-5M3 10v4a3 3 0 0 0 3 3h1v-5H4a5 5 0 0 1-1-2z"/>'
        '<path d="M15 10a5 5 0 0 1 5-5M15 10v4a3 3 0 0 0 3 3h1v-5h-3a5 5 0 0 1-1-2z"/>'
    ),
    "settings": (
        '<circle cx="12" cy="12" r="3"/>'
        '<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>'
    ),
    "tooth": (
        '<path d="M8 4.5C8 3.1 9.6 2 12 2s4 1.1 4 2.5c0 .7-.2 1.4-.5 2 1.7.3 3 1.6 3.2 3.6.4 3.2-1 7.2-2.8 9.2-.6.7-1.7.3-1.7-.6 0-1.8-.3-3.2-.7-4.1-.3-.6-.9-.8-1.5-.4-.4.2-.8.2-1.2 0-.6-.4-1.2-.2-1.5.4-.4.9-.7 2.3-.7 4.1 0 .9-1.1 1.3-1.7.6-1.8-2-3.2-6-2.8-9.2.2-2 1.5-3.3 3.2-3.6-.3-.6-.5-1.3-.5-2z"/>'
    ),
    "mic": (
        '<rect x="9" y="2" width="6" height="11" rx="3"/>'
        '<path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>'
    ),
    "camera": (
        '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>'
        '<circle cx="12" cy="13" r="4"/>'
    ),
    "id-card": (
        '<rect x="2" y="5" width="20" height="14" rx="2"/>'
        '<circle cx="8" cy="12" r="2"/>'
        '<path d="M13 10h5M13 14h5"/>'
    ),
    "pen": (
        '<path d="M12 20h9"/>'
        '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'
    ),
    "image": (
        '<rect x="3" y="3" width="18" height="18" rx="2"/>'
        '<circle cx="8.5" cy="8.5" r="1.5"/>'
        '<path d="M21 15l-5-5L5 21"/>'
    ),
    "alert": (
        '<circle cx="12" cy="12" r="10"/>'
        '<path d="M12 8v4M12 16h.01"/>'
    ),
    "lock": (
        '<rect x="3" y="11" width="18" height="11" rx="2"/>'
        '<path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
    ),
    "trash": (
        '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'
    ),
    "printer": (
        '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>'
        '<rect x="6" y="14" width="12" height="8"/>'
    ),
    "stamp": (
        '<path d="M12 3v8"/>'
        '<path d="M8 11h8v3H8z"/>'
        '<path d="M5 21h14v-4H5z"/>'
    ),
    "shield": (
        '<path d="M12 3 5 6v6c0 5 3.5 8 7 9 3.5-1 7-4 7-9V6z"/>'
        '<path d="M9 12l2 2 4-4"/>'
    ),
}


def ico(name: str, cls: str = "ic") -> str:
    return (
        f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        f'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" '
        f'aria-hidden="true">{ICONS[name]}</svg>'
    )


def initials(name: str) -> str:
    parts = [p for p in name.replace("drg.", "").split() if p]
    return "".join(p[0] for p in parts[:2]).upper()


def av(name: str, tone: str = "") -> str:
    cls = f" av-{tone}" if tone else ""
    return f'<span class="av{cls}" aria-hidden="true">{initials(name)}</span>'


def chip(label: str, kind: str, icon: str | None = None) -> str:
    if icon is None:
        icon = {
            "draf": "pen",
            "ok": "check",
            "tolak": "x",
            "warn": "alert",
            "karies": "alert",
            "konfirm": "alert",
            "tunggu": "clock",
            "rawat": "tooth",
            "bayar": "alert",
            "med": "alert",
            "isi": "lock",
            "ada": "check",
            "sebagian": "clock",
        }.get(kind)
    ic = ico(icon, "ic-sm") if icon else ""
    return f'<span class="chip st-{kind}">{ic}{label}</span>'


def btn(label: str, kind: str = "pri", icon: str | None = None, disabled: bool = False) -> str:
    ic = ico(icon, "ic-btn") if icon else ""
    cls = f"btn {kind}"
    if disabled:
        cls += " dis"
    aria = ' aria-disabled="true"' if disabled else ""
    return f'<button class="{cls}" type="button"{aria}>{ic}{label}</button>'


def syn() -> str:
    return '<span class="syn">DATA SINTETIS</span>'


def sum_row(*parts: str) -> str:
    return f'<div class="sum-row">{"".join(parts)}</div>'


def seg(items: list[tuple[str, bool]]) -> str:
    btns = []
    for lab, on in items:
        cls = "seg-btn on" if on else "seg-btn"
        btns.append(f'<button class="{cls}" type="button">{lab}</button>')
    return f'<div class="seg" role="tablist">{"".join(btns)}</div>'


def fold(title: str, body: str, open_: bool = False, hint: str = "") -> str:
    op = " open" if open_ else ""
    hint_h = f'<span class="mu">{hint}</span>' if hint else ""
    return (
        f'<details class="fold"{op}><summary>{title}{hint_h}'
        f'{ico("chevron-down", "ic-sm chev")}</summary>'
        f'<div class="fold-body">{body}</div></details>'
    )


def dock(*buttons: str) -> str:
    return f'<div class="dock">{"".join(buttons)}</div>'


def empty_scribe_img() -> str:
    src = Path("/workspace/artifacts/illustrations/test-magnific.png")
    if not src.exists():
        return ""
    try:
        from PIL import Image
        im = Image.open(src).convert("RGB")
        im.thumbnail((280, 280), Image.Resampling.LANCZOS)
        buf = BytesIO()
        im.save(buf, format="JPEG", quality=72, optimize=True)
        b64 = base64.b64encode(buf.getvalue()).decode()
        return (
            f'<img class="empty-fig" src="data:image/jpeg;base64,{b64}" '
            f'width="160" height="160" alt=""/>'
        )
    except Exception:
        return ""


CSS = r"""
*{box-sizing:border-box}
html,body{margin:0;background:#E8EEF0;color:var(--color-neutral-800);
  font-family:var(--font-family-sans);-webkit-font-smoothing:antialiased}
body{padding:48px 40px 80px}
.wrap{max-width:1760px;margin:0 auto}
h1.page{font-size:28px;font-weight:700;letter-spacing:-.02em;margin:0 0 4px;color:var(--color-neutral-900)}
.lede{margin:0 0 36px;color:var(--color-neutral-600);font-size:14px;font-weight:500;max-width:820px;line-height:1.5}
.ab{margin:0 0 64px;width:max-content;max-width:none;padding:8px 8px 8px 16px}
.ab-k{display:flex;align-items:baseline;gap:12px;margin:0 0 8px}
.ab-n{font-size:12px;font-weight:700;letter-spacing:.08em;color:var(--color-primary-700);text-transform:uppercase}
.ab-t{font-size:16px;font-weight:650;color:var(--color-neutral-800)}
.ab-d{font-size:12px;font-weight:500;color:var(--color-neutral-500);margin:0 0 14px;max-width:820px;line-height:1.45}
.row{display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap}
.pair{display:flex;flex-direction:column;gap:0}

.ic{width:20px;height:20px;flex:none}
.ic-btn{width:16px;height:16px}
.ic-sm{width:16px;height:16px}
.ic-lg{width:24px;height:24px}

.syn{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;
  background:#FFFAEB;color:#B54708;border:1px solid #F5C14A;font-size:10px;font-weight:700;letter-spacing:.04em}
.chip{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:16px;gap:4px;
  font-size:11px;font-weight:700;letter-spacing:.01em;white-space:nowrap}
.chip .ic-sm{width:12px;height:12px}
.st-draf{background:#FFF6E5;color:#7A5200}
.st-ai{background:var(--color-appointment-checkin-bg);color:var(--color-appointment-checkin-fg)}
.st-ok{background:var(--color-appointment-selesai-bg);color:var(--color-appointment-selesai-fg)}
.st-tolak{background:var(--color-danger-bg);color:var(--color-danger-fg)}
.st-warn{background:var(--color-warning-bg);color:var(--color-warning-fg)}
.st-info{background:var(--color-info-bg);color:var(--color-info-fg)}
.st-mute{background:var(--color-neutral-100);color:var(--color-neutral-600)}
.st-ada{background:var(--color-appointment-selesai-bg);color:var(--color-appointment-selesai-fg)}
.st-sebagian{background:#FFF6E5;color:#7A5200}
.st-belum{background:var(--color-neutral-100);color:var(--color-neutral-600)}
.st-karies{background:#FDECEC;color:#B42318}
.st-isi{background:var(--color-primary-50);color:var(--color-primary-800)}
.st-konfirm{background:var(--color-appointment-terjadwal-bg);color:var(--color-appointment-terjadwal-fg)}
.st-tunggu{background:var(--color-appointment-checkin-bg);color:var(--color-appointment-checkin-fg)}
.st-rawat{background:var(--color-appointment-merawat-bg);color:var(--color-appointment-merawat-fg)}
.st-bayar{background:var(--color-warning-bg);color:var(--color-warning-fg)}
.st-med{background:var(--color-danger-bg);color:var(--color-danger-fg)}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 18px;
  border-radius:24px;font-size:13px;font-weight:700;border:0;background:transparent;color:var(--color-neutral-800);
  cursor:default;transition:background .15s,box-shadow .15s,transform .1s,border-color .15s,filter .15s}
.btn.pri{background:var(--color-primary-700);color:#fff}
.btn.pri:hover{background:#0A5650}
.btn.sec{background:var(--color-neutral-0);color:var(--color-primary-800);border:1px solid var(--color-primary-200)}
.btn.sec:hover{background:var(--color-primary-50)}
.btn.ghost{background:var(--color-neutral-0);color:var(--color-neutral-700);border:1px solid var(--color-neutral-200)}
.btn.ghost:hover{background:var(--color-neutral-50)}
.btn.danger{background:var(--color-danger-solid);color:#fff}
.btn.danger:hover{filter:brightness(.95)}
.btn.danger-soft{background:var(--color-danger-bg);color:var(--color-danger-fg)}
.btn.danger-soft:hover{background:#FEE4E2}
.btn:active{transform:scale(.97)}
.btn:focus-visible,.icon-btn:focus-visible,.cite:focus-visible,.phrase:focus-visible,
.navi:focus-visible,.rbtn:focus-visible,.seg-btn:focus-visible,.od-t:focus-visible{
  outline:2px solid var(--color-primary-700);outline-offset:2px}
.btn.dis{opacity:.45}
.icon-btn{width:48px;height:48px;display:grid;place-items:center;border:0;background:transparent;
  border-radius:16px;color:var(--color-neutral-700);flex:none;padding:0;transition:background .15s}
.icon-btn:hover{background:var(--color-neutral-50)}
.icon-btn:active{transform:scale(.97)}

.av{width:32px;height:32px;border-radius:999px;background:var(--color-primary-100);color:var(--color-primary-800);
  display:grid;place-items:center;font-size:11px;font-weight:800;flex:none}
.av-fd{background:#E8F0FE;color:#1D4ED8}

.desk{width:1280px;background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);
  border-radius:24px;overflow:hidden;display:flex;flex:none;box-shadow:0 8px 24px rgba(22,33,43,.06)}
.rail{width:72px;background:#F4F7F7;border-right:1px solid var(--color-neutral-200);display:flex;flex-direction:column;
  align-items:center;padding:16px 8px 12px;gap:4px;flex:none}
.rail .logo{width:40px;height:40px;border-radius:16px;background:var(--color-primary-700);color:#fff;
  display:grid;place-items:center;margin-bottom:8px}
.rail .logo .ic{width:20px;height:20px}
.rspacer{flex:1}
.rbtn{width:48px;height:48px;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:2px;color:var(--color-neutral-500);font-size:9px;font-weight:700;letter-spacing:.02em;border:0;background:transparent}
.rbtn .ic{width:20px;height:20px}
.rbtn.on{background:var(--color-primary-700);color:#fff}
.desk-col{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--color-canvas)}
.top{display:flex;align-items:center;justify-content:space-between;min-height:56px;padding:0 16px 0 20px;
  background:var(--color-neutral-0);border-bottom:1px solid var(--color-neutral-200);gap:12px}
.top h2{margin:0;font-size:16px;font-weight:700;color:var(--color-neutral-900)}
.top .who{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--color-neutral-600)}
.crumb{font-size:12px;font-weight:600;color:var(--color-neutral-500)}
.crumb b{color:var(--color-neutral-800);font-weight:700}
.desk-body{flex:1;padding:16px;display:flex;gap:16px;min-height:0}
.desk-body.col{flex-direction:column}
.dock{flex:none;display:flex;align-items:center;justify-content:flex-end;gap:8px;
  padding:12px 16px;background:var(--color-neutral-0);border-top:1px solid var(--color-neutral-200);
  box-shadow:0 -8px 24px rgba(22,33,43,.05)}
.ph .dock{justify-content:stretch}
.ph .dock .btn.pri{flex:1}

.ph{width:360px;background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);
  border-radius:28px;overflow:hidden;position:relative;display:flex;flex-direction:column;flex:none;
  box-shadow:0 8px 24px rgba(22,33,43,.06)}
.ph-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 16px 0;min-height:28px;
  background:var(--color-neutral-0)}
.ph-time{font-size:12px;font-weight:600;color:var(--color-neutral-700)}
.hd{background:var(--color-neutral-0);padding:0 8px;display:flex;align-items:center;justify-content:space-between;
  min-height:56px;gap:8px;border-bottom:1px solid var(--color-neutral-100)}
.h-sm{margin:0;font-size:16px;font-weight:700;flex:1}
.ph-body{flex:1;background:var(--color-canvas);padding:12px 16px;display:flex;flex-direction:column;gap:10px}
.bnav{position:relative;flex:none;min-height:80px;height:auto;background:var(--color-neutral-0);
  border-top:1px solid var(--color-neutral-200);display:flex;padding:4px 4px 12px}
.navi{flex:1;border:0;background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:2px;font-size:10px;font-weight:700;color:var(--color-neutral-500);min-height:48px;min-width:48px;border-radius:16px}
.navi .ic{width:20px;height:20px}
.navi.on{color:var(--color-primary-700)}

.card{background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);border-radius:24px;padding:16px;
  display:flex;flex-direction:column;gap:12px;box-shadow:0 8px 24px rgba(22,33,43,.04)}
.card h3{margin:0;font-size:13px;font-weight:700;color:var(--color-neutral-800);display:flex;align-items:center;gap:8px}
.note{font-size:13px;line-height:1.45;color:var(--color-neutral-700)}
.note b{font-weight:700;color:var(--color-neutral-900)}
.mu{font-size:12px;font-weight:500;color:var(--color-neutral-500)}
.kicker{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--color-neutral-500)}
.banner{display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border-radius:16px;font-size:12px;font-weight:600;line-height:1.4}
.banner.warn{background:var(--color-warning-bg);color:var(--color-warning-fg);border:1px solid var(--color-warning-border)}
.banner.info{background:var(--color-info-bg);color:var(--color-info-fg);border:1px solid var(--color-info-border)}
.banner.ok{background:var(--color-success-bg);color:var(--color-success-fg);border:1px solid var(--color-success-border)}
.banner .ic{margin-top:1px}
.field{display:flex;flex-direction:column;gap:4px;margin:0}
.lab{font-size:11px;font-weight:700;color:var(--color-neutral-500);letter-spacing:.04em;text-transform:uppercase}
.inp{min-height:48px;border:1px solid var(--color-neutral-200);border-radius:16px;background:var(--color-neutral-0);
  padding:10px 12px;font-size:14px;font-weight:600;color:var(--color-neutral-800);display:flex;align-items:center;gap:8px}
.inp.area{min-height:52px;align-items:flex-start;font-weight:500;line-height:1.4}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.split{display:grid;grid-template-columns:1fr 1fr;gap:16px;flex:1;min-height:0}
.split-5{display:grid;grid-template-columns:1.15fr .85fr;gap:16px;flex:1;min-height:0}
.scroll-col{display:flex;flex-direction:column;gap:10px;min-width:0}

.sum-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.seg{display:inline-flex;padding:4px;gap:4px;background:var(--color-neutral-100);border-radius:16px}
.seg-btn{min-height:48px;padding:0 14px;border:0;border-radius:12px;background:transparent;
  font-size:13px;font-weight:700;color:var(--color-neutral-600)}
.seg-btn.on{background:#fff;color:var(--color-primary-800);box-shadow:0 1px 3px rgba(22,33,43,.08)}
.fold{border:1px solid var(--color-neutral-200);border-radius:24px;background:var(--color-neutral-0);
  padding:0 16px;box-shadow:0 8px 24px rgba(22,33,43,.04)}
.fold>summary{min-height:48px;display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;
  color:var(--color-neutral-800);cursor:default;list-style:none}
.fold>summary::-webkit-details-marker{display:none}
.fold>summary .chev{margin-left:auto;flex:none}
.fold[open]>summary .chev{transform:rotate(180deg)}
.fold-body{padding:0 0 14px;display:flex;flex-direction:column;gap:8px}
.empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px;padding:8px}
.empty-fig{width:160px;height:160px;object-fit:cover;border-radius:24px;display:block}

.icode{display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid var(--color-neutral-200);
  border-radius:16px;background:var(--color-neutral-0)}
.icode.on{border-color:var(--color-primary-300);background:var(--color-primary-50);box-shadow:0 0 0 2px var(--color-primary-100)}
.icode .code,.aitem .code{font-size:14px;font-weight:800;color:var(--color-neutral-900);font-variant-numeric:tabular-nums}
.icode .nm,.aitem .nm{font-size:13px;font-weight:600;color:var(--color-neutral-800)}
.checkb{width:20px;height:20px;border-radius:6px;border:1.5px solid var(--color-neutral-300);flex:none;margin-top:2px;
  display:grid;place-items:center;color:#fff}
.icode.on .checkb{background:var(--color-primary-700);border-color:var(--color-primary-700)}

.aitem{border:1px solid var(--color-neutral-200);border-radius:20px;padding:12px;background:var(--color-neutral-0);
  display:flex;flex-direction:column;gap:8px;border-left-width:4px;border-left-color:var(--color-neutral-300)}
.aitem.st-draf{border-left-color:#7A5200}
.aitem.st-ok{border-left-color:var(--color-appointment-selesai-fg)}
.aitem.st-tolak{border-left-color:var(--color-danger-fg)}
.aitem.compact{padding:8px 12px}
.aitem-top{display:flex;align-items:center;gap:8px}
.aitem-top .grow{flex:1;min-width:0}
.iacts{display:flex;gap:8px}
.iacts .btn{flex:1;padding:0 12px}
.cite{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:48px;min-width:48px;
  padding:0 10px;border-radius:16px;border:1px solid var(--color-primary-200);background:var(--color-neutral-0);
  color:var(--color-primary-800);font-size:12px;font-weight:700;flex:none;transition:background .15s,box-shadow .15s}
.cite:hover{background:var(--color-primary-50)}
.cite.on{background:var(--color-primary-50);border-color:var(--color-primary-400);
  box-shadow:0 0 0 2px var(--color-primary-100)}
.cite .ic-sm{width:14px;height:14px}
.pop{position:relative;background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);border-radius:24px;
  box-shadow:0 8px 24px rgba(22,33,43,.12);padding:14px 16px;margin-top:8px}
.pop:before{content:"";position:absolute;top:-6px;right:28px;width:12px;height:12px;background:#fff;
  border-left:1px solid var(--color-neutral-200);border-top:1px solid var(--color-neutral-200);transform:rotate(45deg)}
.pop-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.pop-hd .kicker{margin:0}
.pop .src{font-size:13px;font-weight:500;line-height:1.5;color:var(--color-neutral-700)}
.hl{background:var(--color-primary-100);color:var(--color-primary-900);font-weight:700;padding:0 3px;border-radius:4px}
.note .hl{font-weight:700}
.sheet{position:absolute;left:0;right:0;bottom:0;z-index:4;background:var(--color-neutral-0);
  border-top:1px solid var(--color-neutral-200);border-radius:24px 24px 0 0;
  box-shadow:0 -8px 24px rgba(22,33,43,.12);padding:8px 16px 16px;display:flex;flex-direction:column;gap:8px}
.sheet .grab{width:36px;height:4px;border-radius:999px;background:var(--color-neutral-300);margin:4px auto}
.sheet-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:48px}
.sheet-hd h3{margin:0;font-size:14px;font-weight:700}
.sheet .src{font-size:13px;font-weight:500;line-height:1.5;color:var(--color-neutral-700)}
.sheet-ft{display:flex;justify-content:flex-end;padding-top:4px}

.phrase{display:inline-flex;align-items:center;min-height:48px;padding:0 14px;border-radius:16px;
  border:1px solid var(--color-primary-200);background:var(--color-neutral-0);color:var(--color-primary-800);
  font-size:12px;font-weight:700;transition:background .15s,color .15s}
.phrase:hover{background:var(--color-primary-50)}
.phrase.on{background:var(--color-primary-700);color:#fff;border-color:var(--color-primary-700)}
.phrases{display:flex;flex-wrap:wrap;gap:8px}

.od-grid{display:flex;flex-direction:column;gap:8px}
.od-row{display:flex;gap:4px;justify-content:center}
.od-t{width:32px;height:40px;border-radius:8px;border:1px solid var(--color-neutral-200);background:#fff;
  display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:9px;font-weight:800;
  color:var(--color-neutral-600)}
.od-t .sq{width:14px;height:14px;border-radius:3px;border:1px solid var(--color-neutral-300);background:#fff;margin-bottom:2px}
.od-t.on{border-color:var(--color-primary-700);background:var(--color-primary-50);color:var(--color-primary-800)}
.od-t.on .sq{background:#FDECEC;border-color:#B42318}
.od-lab{text-align:center;font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--color-neutral-500)}
.surf{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.surf b{min-height:48px;border-radius:16px;border:1px solid var(--color-neutral-200);background:#fff;
  display:grid;place-items:center;font-size:12px;font-weight:800;color:var(--color-neutral-600)}
.surf b.on{background:var(--color-primary-700);color:#fff;border-color:var(--color-primary-700)}

.ktp{width:100%;max-height:168px;aspect-ratio:1.6;border-radius:24px;background:linear-gradient(180deg,#1F4E79,#163A5F);
  color:#fff;padding:16px;display:flex;flex-direction:column;justify-content:space-between;position:relative}
.ktp .idlab{font-size:10px;font-weight:800;letter-spacing:.12em}
.ktp .who{font-size:16px;font-weight:800}
.ktp .meta{font-size:11px;font-weight:600;opacity:.85;line-height:1.5}
.ktp .photo{position:absolute;right:16px;top:36px;width:64px;height:80px;border-radius:12px;background:#C5D4E3}

.sig{height:88px;border:1.5px dashed var(--color-neutral-300);border-radius:16px;background:var(--color-neutral-25);
  display:flex;align-items:flex-end;padding:8px 16px;color:var(--color-neutral-400)}
.sig svg{width:180px;height:70px;stroke:var(--color-neutral-800);fill:none;stroke-width:2;stroke-linecap:round}

.ba{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.well{min-height:120px;border:1.5px dashed var(--color-neutral-300);border-radius:24px;background:var(--color-neutral-25);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--color-neutral-500);
  font-size:12px;font-weight:700;text-align:center;padding:16px}
.well.has{border-style:solid;background:#E8F0E9;color:var(--color-primary-900);border-color:var(--color-primary-200)}
.well .ic{width:28px;height:28px}

.rx,.attach{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;min-height:48px;
  border:1px solid var(--color-neutral-200);border-radius:20px;background:#fff}
.attach{gap:10px}
.attach .grow{flex:1;min-width:0}
.attach .nm{font-size:13px;font-weight:700}
.attach .ds{font-size:12px;font-weight:500;color:var(--color-neutral-500)}
.rx .nm{font-size:13px;font-weight:700}
.rx .ds{font-size:12px;font-weight:500;color:var(--color-neutral-500)}

table.gap{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid var(--color-neutral-200);
  border-radius:24px;overflow:hidden;font-size:13px;box-shadow:0 8px 24px rgba(22,33,43,.04)}
table.gap th,table.gap td{padding:10px 12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--color-neutral-100);
  line-height:1.4}
table.gap th{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--color-neutral-500);
  background:var(--color-neutral-50)}
table.gap tr:last-child td{border-bottom:0}
table.gap td.ft{font-weight:700;color:var(--color-neutral-900);white-space:nowrap}
.legend{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:12px;font-weight:600;color:var(--color-neutral-600)}

figcaption{font-size:12px;font-weight:600;color:var(--color-neutral-500);margin-top:8px}
"""


def rail(active: str, role: str = "dokter") -> str:
    if role == "resepsionis":
        items = [
            ("Beranda", "home"),
            ("Jadwal", "calendar"),
            ("Pasien", "users"),
            ("Lainnya", "more"),
        ]
    else:
        items = [
            ("Beranda", "home"),
            ("Jadwal", "calendar"),
            ("Pasien", "users"),
            ("RM", "tooth"),
            ("Lainnya", "more"),
        ]
    btns = []
    for i, (lab, icon) in enumerate(items):
        on = " on" if lab == active else ""
        if i == len(items) - 1:
            btns.append('<span class="rspacer"></span>')
        btns.append(f'<button class="rbtn{on}" type="button">{ico(icon)}{lab}</button>')
    return f'<aside class="rail"><div class="logo">{ico("tooth")}</div>{"".join(btns)}</aside>'


def desk(
    body: str,
    title: str,
    crumb: str = "",
    active: str = "RM",
    user: str = "Nadia Putri",
    role: str = "dokter",
    height: int = 0,
    dock_html: str = "",
) -> str:
    prefix = "drg. " if role == "dokter" else ""
    mid = f'<div><h2>{title}</h2>{f"<div class=crumb>{crumb}</div>" if crumb else ""}</div>'
    return f"""
    <div class="desk" style="height:auto">
      {rail(active, role)}
      <div class="desk-col">
        <header class="top">{mid}
          <div class="who">{syn()}{av(user, "fd" if role == "resepsionis" else "")}
            <span>{prefix}{user}</span></div>
        </header>
        {body}
        {dock_html}
      </div>
    </div>"""


def bnav(active: str = "RM") -> str:
    items = [
        ("Beranda", "home"),
        ("Jadwal", "calendar"),
        ("Pasien", "users"),
        ("RM", "tooth"),
        ("Lainnya", "more"),
    ]
    out = []
    for lab, icon in items:
        on = " on" if lab == active else ""
        show = "Rekam Medis" if lab == "RM" else lab
        out.append(
            f'<button class="navi{on}" type="button">'
            f'{ico(icon)}<span>{show}</span></button>'
        )
    return f'<nav class="bnav">{"".join(out)}</nav>'


def phone(
    inner: str,
    title: str,
    height: int | None = None,
    nav: str = "RM",
    back: bool = True,
    mic: bool = False,
    pad_bottom: int | None = None,
    overlay: str = "",
    dock_html: str = "",
) -> str:
    left = (
        f'<button class="icon-btn" type="button" aria-label="Kembali">{ico("chevron-left")}</button>'
        if back
        else ""
    )
    mic_btn = (
        f'<button class="icon-btn" type="button" aria-label="Rekam">{ico("mic")}</button>'
        if mic
        else ""
    )
    hstyle = f"height:{height}px" if height else "height:auto"
    return f"""
    <div class="ph" style="{hstyle}">
      <div class="ph-bar">{syn()}<span class="ph-time">09.40</span></div>
      <header class="hd">{left}<h1 class="h-sm">{title}</h1>
        {mic_btn}<button class="icon-btn" type="button" aria-label="Lainnya">{ico("more")}</button></header>
      <div class="ph-body">{inner}</div>
      {dock_html}
      {bnav(nav)}
      {overlay}
    </div>"""


def ab(num: str, title: str, desc: str, body: str) -> str:
    return f"""
    <section class="ab" id="ab-{num}">
      <div class="ab-k"><span class="ab-n">{num}</span><span class="ab-t">{title}</span></div>
      <p class="ab-d">{desc}</p>
      {body}
    </section>"""


def odonto(active: str = "26") -> str:
    upper = ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"]
    lower = ["48", "47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37", "38"]

    def row(nums: list[str]) -> str:
        cells = []
        for n in nums:
            on = " on" if n == active else ""
            cells.append(f'<div class="od-t{on}"><span class="sq"></span>{n}</div>')
        return f'<div class="od-row">{"".join(cells)}</div>'

    return f"""
    <div class="od-grid">
      <div class="od-lab">RAHANG ATAS</div>{row(upper)}
      <div class="od-lab">RAHANG BAWAH</div>{row(lower)}
    </div>"""


def hl(text: str) -> str:
    return f'<mark class="hl">{text}</mark>'


def cite_btn(label: str, on: bool = False) -> str:
    cls = "cite on" if on else "cite"
    return (
        f'<button class="{cls}" type="button" aria-label="Sitasi {label}">'
        f'{ico("quote", "ic-sm")}{label}</button>'
    )


def ai_item(
    title: str,
    subtitle: str,
    status: str,
    cite: str | None = None,
    cite_on: bool = False,
    popover: str = "",
    kind: str = "",
    compact: bool = False,
) -> str:
    lab, kind_st = {
        "draf": ("Draf", "draf"),
        "ok": ("Disetujui", "ok"),
        "tolak": ("Ditolak", "tolak"),
    }[status]
    acts = ""
    if status == "draf" and not compact:
        acts = f'<div class="iacts">{btn("Tolak", "danger-soft")}{btn("Setujui", "sec", "check")}</div>'
    cite_h = cite_btn(cite, cite_on) if cite else ""
    pop = ""
    if popover:
        pop = (
            '<div class="pop" role="dialog" aria-label="Kalimat sumber">'
            '<div class="pop-hd"><span class="kicker">Sumber</span>'
            f'<button class="icon-btn" type="button" aria-label="Tutup">{ico("x")}</button></div>'
            f'<div class="src">{popover}</div></div>'
        )
    k = f' <span class="mu">{kind}</span>' if kind else ""
    sub = "" if compact else f'<div class="nm">{subtitle}</div>'
    cls = "aitem compact" if compact else "aitem"
    return f"""
    <div class="{cls} st-{kind_st}">
      <div class="aitem-top">
        <div class="code grow">{title}{k}</div>
        {chip(lab, kind_st)}
        {cite_h}
      </div>
      {sub}
      {acts}
      {pop}
    </div>"""


def soap_block(highlight: str | None = "P") -> str:
    s = "Nyeri gigit di rahang kiri atas sejak 3 hari. Tidak ada pembengkakan. Tidak alergi obat."
    o = "Gigi 26 karies dentin permukaan O dan M. Gingiva sekitar sedikit meradang. Uji perkusi positif ringan."
    a = "Karies dentin 26. Gingivitis ringan setempat."
    p = "Restorasi komposit 26. Edukasi kebersihan. Kontrol 7 hari."
    if highlight == "A":
        a = a.replace("Karies dentin 26.", hl("Karies dentin 26."))
    elif highlight == "O":
        o = o.replace(
            "Gigi 26 karies dentin permukaan O dan M.",
            hl("Gigi 26 karies dentin permukaan O dan M."),
        )
    elif highlight == "P":
        p = p.replace("Restorasi komposit 26.", hl("Restorasi komposit 26."))
    return f"""
    <article class="card">
      <h3>SOAP hari ini</h3>
      <div class="field"><span class="lab">S</span>
        <div class="note">{s}</div></div>
      <div class="field"><span class="lab">O</span>
        <div class="note">{o}</div></div>
      <div class="field"><span class="lab">A</span>
        <div class="note">{a}</div></div>
      <div class="field"><span class="lab">P</span>
        <div class="note">{p}</div></div>
    </article>"""


# ---------- artboards ----------

def ab01() -> str:
    pending = ai_item(
        "23.2",
        "Restorasi gigi",
        "draf",
        cite="P",
        cite_on=True,
        kind="ICD-9-CM",
        popover=f'{hl("Restorasi komposit 26.")} Edukasi kebersihan. Kontrol 7 hari.',
    )
    reviewed = (
        ai_item("K02.1", "Karies dentin", "ok", cite="A", kind="ICD-10", compact=True)
        + ai_item("K05.10", "Gingivitis kronis", "tolak", cite="O", kind="ICD-10", compact=True)
    )
    body = f"""
    <div class="desk-body col">
      {sum_row(chip("1 draf", "draf"), chip("1 disetujui", "ok"), chip("1 ditolak", "tolak"))}
      <div class="sum-row">{seg([("Semua", False), ("Draf", True), ("Diulas", False)])}
        <span class="mu">Draf tidak ke SATUSEHAT atau klaim.</span></div>
      {fold("Catatan SOAP", soap_block("P"), hint="Sumber: Restorasi komposit 26.")}
      {pending}
      {fold("2 sudah diulas", reviewed)}
    </div>"""
    frame = desk(
        body,
        "Saran ICD",
        "Budi Santoso · Gigi 26 · 15 Nov 2026",
        "RM",
        "Nadia Putri",
        "dokter",
        dock_html=dock(btn("Setujui semua", "pri", "check")),
    )
    return ab(
        "01",
        "AI saran ICD dari catatan",
        "Ringkasan dan filter Draf di atas. Item yang sudah diulas dilipat. Sitasi membuka kalimat sumber. Setujui semua menempel di bawah.",
        frame,
    )


def ab02() -> str:
    pending = ai_item("A", "Karies dentin 26.", "draf", cite="Ucapan")
    reviewed = (
        ai_item("S", "Nyeri gigit rahang kiri atas sejak 3 hari. Tidak alergi obat.", "ok", cite="Ucapan", compact=True)
        + ai_item("O", "Gigi 26 karies dentin. Perkusi ringan positif.", "ok", cite="Ucapan", compact=True)
        + ai_item("P", "Restorasi komposit 26. Kontrol 7 hari.", "tolak", cite="Ucapan", compact=True)
    )
    ucapan = '<p class="note">Nyeri gigit kiri atas tiga hari, gigi 26 karies dentin, tambal komposit, kontrol tujuh hari, tidak alergi.</p>'
    review_inner = f"""
      {sum_row(chip("1 draf", "draf"), chip("2 disetujui", "ok"), chip("1 ditolak", "tolak"))}
      {fold("Ucapan", ucapan, hint="Audio dihapus setelah Selesai.")}
      {pending}
      {fold("3 sudah diulas", reviewed)}
    """
    review = phone(
        review_inner,
        "Draf SOAP",
        None,
        "RM",
        mic=True,
        dock_html=dock(btn("Setujui semua", "pri", "check")),
    )
    empty_inner = f"""
      <div class="empty">
        {empty_scribe_img()}
        <p class="note">Rekam ucapan untuk buat draf SOAP.</p>
        <p class="mu">AI hanya merapikan yang diucapkan.</p>
      </div>
    """
    empty = phone(
        empty_inner,
        "SOAP",
        None,
        "RM",
        mic=False,
        dock_html=dock(btn("Rekam", "pri", "mic")),
    )
    return ab(
        "02",
        "AI draf SOAP dari suara",
        "Kiri: mulai rekam, satu ketuk. Kanan: hanya draf yang terbuka; S, O, dan P dilipat. Setujui semua menempel di atas navigasi. Mikrofon selalu siap.",
        f'<div class="row">{empty}{review}</div>',
    )


def ab03() -> str:
    pending = ai_item("Kontrol", "7 hari", "draf", cite="P", kind="Jadwal")
    reviewed = (
        ai_item("Restorasi komposit", "Gigi 26 · permukaan O, M", "ok", cite="26", kind="Tindakan", compact=True)
        + ai_item("Foto bitewing", "Rahang kiri atas", "tolak", cite="26", kind="Tindakan", compact=True)
    )
    od_body = f'{odonto("26")}<p class="mu">Perkusi ringan.</p>'
    body = f"""
    <div class="desk-body col">
      {sum_row(chip("1 draf", "draf"), chip("1 disetujui", "ok"), chip("1 ditolak", "tolak"))}
      <div class="sum-row">{seg([("Semua", False), ("Draf", True), ("Diulas", False)])}
        <span class="mu">Hanya dari temuan di chart.</span></div>
      {fold("Odontogram 26", od_body, hint=hl("26 karies O, M"))}
      {pending}
      {fold("2 sudah diulas", reviewed)}
    </div>"""
    frame = desk(
        body,
        "Saran tindakan",
        "Budi Santoso · Gigi 26",
        "RM",
        "Nadia Putri",
        "dokter",
        dock_html=dock(btn("Setujui semua", "pri", "check")),
    )
    return ab(
        "03",
        "AI saran tindakan dari odontogram",
        "Saran tetap draf sampai Setujui. Chart dilipat; temuan sumber tetap terlihat. Setujui semua menempel di bawah.",
        frame,
    )


def ab11() -> str:
    desk_item = ai_item(
        "23.2",
        "Restorasi gigi",
        "draf",
        cite="P",
        cite_on=True,
        kind="ICD-9-CM",
        popover=f'{hl("Restorasi komposit 26.")} Edukasi kebersihan. Kontrol 7 hari.',
    )
    legend = (
        chip("Draf", "draf")
        + chip("Disetujui", "ok")
        + chip("Ditolak", "tolak")
        + chip("Perlu konfirmasi", "konfirm")
        + chip("Menunggu", "tunggu")
        + chip("Sedang dirawat", "rawat")
        + chip("Belum bayar", "bayar")
        + chip("Selesai", "ok")
        + chip("Peringatan medis", "med")
    )
    body = f"""
    <div class="desk-body col">
      <div class="legend">{legend}</div>
      {fold("Catatan SOAP", soap_block("P"), open_=True, hint="Kalimat sumber ditandai.")}
      {desk_item}
    </div>"""
    frame = desk(
        body,
        "Sitasi",
        "Budi Santoso · Gigi 26",
        "RM",
        "Nadia Putri",
        "dokter",
        dock_html=dock(btn("Setujui", "pri", "check")),
    )
    sheet = f"""
    <div class="sheet" role="dialog" aria-label="Kalimat sumber">
      <div class="grab" aria-hidden="true"></div>
      <div class="sheet-hd">
        <h3>Sumber · Ucapan</h3>
        <button class="icon-btn" type="button" aria-label="Tutup">{ico("x")}</button>
      </div>
      <div class="src">Nyeri gigit kiri atas tiga hari, {hl("gigi 26 karies dentin")}, tambal komposit, kontrol tujuh hari, tidak alergi.</div>
      <div class="sheet-ft">{btn("Tutup", "ghost")}</div>
    </div>"""
    inner = f"""
      {sum_row(chip("2 draf", "draf"))}
      {ai_item("A", "Karies dentin 26.", "draf", cite="Ucapan", cite_on=True)}
      {fold("1 item lain", ai_item("P", "Restorasi komposit 26. Kontrol 7 hari.", "draf", cite="Ucapan", compact=True))}
    """
    ph = phone(inner, "Draf SOAP", None, "RM", mic=True, overlay=sheet)
    return ab(
        "11",
        "Status dan sitasi",
        "Chip status punya label dan ikon. Desktop: popover dengan anak panah. HP: laci dari bawah, pegangan, tutup, dan kalimat yang ditandai.",
        f'<div class="row">{frame}{ph}</div>',
    )


def ab04() -> str:
    ktp = """
          <div class="ktp">
            <div class="idlab">KTP · DATA SINTETIS</div>
            <div>
              <div class="who">BUDI SANTOSO</div>
              <div class="meta">Tebet, Jakarta Selatan<br/>NIK berakhir 4281</div>
            </div>
            <div class="photo" aria-hidden="true"></div>
          </div>"""
    lampiran = f"""
        <div class="kicker">Setelah daftar · RM BT-000214</div>
        <div class="attach">
          <span>{ico("id-card")}</span>
          <div class="grow">
            <div class="nm">KTP</div>
            <div class="ds">15 Nov 2026 · hanya peran berizin · NIK ···· 4281</div>
          </div>
          {chip("Terenkripsi", "isi")}
          {btn("Buka", "sec")}
        </div>
        <p class="mu">Peran tanpa izin tidak melihat lampiran ini.</p>"""
    body = f"""
    <div class="desk-body col">
      {seg([("Daftar", True), ("Profil", False)])}
      <div class="split">
        <article class="card">
          <h3>{ico("camera", "ic-sm")} Hasil pindai</h3>
          {ktp}
          {lampiran}
        </article>
        <article class="card">
          <h3>Apakah data sudah sesuai KTP fisik?</h3>
          <div class="field"><span class="lab">Nama</span><div class="inp">Budi Santoso</div></div>
          <div class="split" style="gap:10px">
            <div class="field"><span class="lab">Lahir</span><div class="inp">12 Mar 1988</div></div>
            <div class="field"><span class="lab">Kelamin</span><div class="inp">Laki-laki</div></div>
          </div>
          <div class="field"><span class="lab">Alamat</span><div class="inp">Tebet, Jakarta Selatan</div></div>
          <div class="field"><span class="lab">NIK</span><div class="inp">{ico("lock", "ic-sm")} ···· 4281</div></div>
        </article>
      </div>
    </div>"""
    frame = desk(
        body,
        "Pasien baru · pindai KTP",
        "Klinik Gigi Senyum Sehat · Tebet",
        "Pasien",
        "Sari Front Desk",
        "resepsionis",
        dock_html=dock(btn("Batal", "ghost"), btn("Verifikasi dan daftar", "pri", "check")),
    )
    return ab(
        "04",
        "Pindai KTP dan lampiran profil",
        "Satu layar: pindai, cek data, lalu Verifikasi dan daftar di bilah bawah. Setelah daftar, foto KTP jadi lampiran terenkripsi. Hanya peran berizin yang melihat. NIK tetap mask.",
        frame,
    )


def ab05() -> str:
    phrases = [
        ("Nyeri gigit", True),
        ("Tidak alergi obat", True),
        ("Gusi berdarah", False),
        ("Kontrol 7 hari", True),
        ("Edukasi sikat gigi", False),
        ("Rujuk sp. konservasi", False),
    ]
    chips = "".join(f'<span class="phrase{" on" if on else ""}">{lab}</span>' for lab, on in phrases)
    desk_body = f"""
    <div class="desk-body col">
      <article class="card">
        <h3>Frasa cepat</h3>
        <div class="phrases">{chips}</div>
        <p class="mu">Satu ketuk mengisi kolom SOAP. Boleh diubah setelahnya.</p>
      </article>
      <div class="split">
        <article class="card">
          <div class="field"><span class="lab">S</span>
            <div class="inp area">Nyeri gigit di rahang kiri atas. Tidak alergi obat.</div></div>
          <div class="field"><span class="lab">O</span>
            <div class="inp area">Gigi 26 karies dentin O, M.</div></div>
        </article>
        <article class="card">
          <div class="field"><span class="lab">A</span>
            <div class="inp area">Karies dentin 26.</div></div>
          <div class="field"><span class="lab">P</span>
            <div class="inp area">Restorasi komposit 26. Kontrol 7 hari.</div></div>
        </article>
      </div>
    </div>"""
    frame_d = desk(
        desk_body,
        "SOAP · frasa cepat",
        "Budi Santoso",
        "RM",
        "Nadia Putri",
        "dokter",
        dock_html=dock(btn("Simpan", "pri", "check")),
    )
    ph_inner = f"""
      <div class="phrases">{chips}</div>
      {fold("S dan O", "<div class=\"field\"><span class=\"lab\">S</span><div class=\"inp area\">Nyeri gigit di rahang kiri atas. Tidak alergi obat.</div></div><div class=\"field\"><span class=\"lab\">O</span><div class=\"inp area\">Gigi 26 karies dentin O, M.</div></div>", hint="Terisi dari frasa.")}
      <article class="card">
        <div class="field"><span class="lab">A</span><div class="inp area">Karies dentin 26.</div></div>
        <div class="field"><span class="lab">P</span><div class="inp area">Restorasi komposit 26. Kontrol 7 hari.</div></div>
      </article>
    """
    ph = phone(ph_inner, "SOAP", None, "RM", dock_html=dock(btn("Simpan", "pri")))
    return ab(
        "05",
        "Frasa cepat SOAP",
        "Satu ketuk mengisi kolom. Di HP, S dan O dilipat supaya A dan P serta Simpan terlihat dulu.",
        f'<div class="row">{frame_d}{ph}</div>',
    )


def ab06() -> str:
    surfs = [("M", True), ("O", True), ("D", False), ("B", False), ("L", False)]
    surf = "".join(f'<b class="{"on" if on else ""}">{lab}</b>' for lab, on in surfs)
    conds = [
        ("Karies", True),
        ("Tumpatan", False),
        ("Hilang", False),
        ("Goyah", False),
        ("Sisa akar", False),
        ("Mahkota", False),
    ]
    cond = "".join(f'<span class="phrase{" on" if on else ""}">{lab}</span>' for lab, on in conds)
    body = f"""
    <div class="desk-body">
      <div class="split-5" style="flex:1">
        <article class="card">
          <h3>Pilih gigi</h3>
          {odonto("26")}
        </article>
        <article class="card">
          <h3>Gigi 26 {chip("Karies", "karies")}</h3>
          <div class="lab">Permukaan</div>
          <div class="surf">{surf}</div>
          <div class="lab">Kondisi</div>
          <div class="phrases">{cond}</div>
        </article>
      </div>
    </div>"""
    frame = desk(
        body,
        "Odontogram cepat",
        "Budi Santoso",
        "RM",
        "Nadia Putri",
        "dokter",
        dock_html=dock(btn("Batal", "ghost"), btn("Simpan 26", "pri", "check")),
    )
    return ab(
        "06",
        "Input odontogram cepat",
        "Ketuk gigi, permukaan, dan kondisi. Simpan 26 menempel di bawah. Tanpa ketik panjang.",
        frame,
    )


def ab07() -> str:
    def item(n, d, draf=True):
        return f"""
      <div class="rx">
        <div><div class="nm">{n}</div><div class="ds">{d}</div></div>
        {chip("Draf", "draf") if draf else chip("Disetujui", "ok")}
      </div>"""
    inner = f"""
      <div class="banner warn">{ico("alert", "ic-sm")} AI tidak meresepkan. Pilih template, lalu Setujui.</div>
      <article class="card">
        <h3>Template cepat</h3>
        <div class="phrases">
          <span class="phrase on">Amoksisilin</span>
          <span class="phrase on">Ibuprofen</span>
          <span class="phrase">Obat kumur</span>
        </div>
      </article>
      <article class="card">
        <h3>Resep {chip("Draf", "draf")}</h3>
        {item("Amoksisilin 500 mg", "3x1, 5 hari, sesudah makan")}
        {item("Ibuprofen 400 mg", "3x1, bila nyeri")}
        <p class="mu">Cetak ada di Lainnya. Selesai setelah Setujui.</p>
      </article>
    """
    ph = phone(inner, "Resep", None, "RM", dock_html=dock(btn("Setujui", "pri", "check")))
    return ab(
        "07",
        "e-resep cepat",
        "Template obat gigi, draf sampai Setujui. AI tidak mengisi resep. Satu aksi utama di bilah bawah.",
        ph,
    )


def ab08() -> str:
    sig = """
      <div class="sig" aria-label="Tanda tangan sintetis">
        <svg viewBox="0 0 180 70" aria-hidden="true">
          <path d="M8 48 C28 12, 40 60, 62 36 C80 16, 90 50, 120 28 C140 14, 150 40, 172 32"/>
        </svg>
      </div>"""
    body = f"""
    <div class="desk-body">
      <div class="split-5" style="flex:1">
        <article class="card">
          <h3>Persetujuan tindakan</h3>
          <div class="field"><span class="lab">Tindakan</span><div class="inp">Pencabutan gigi 38</div></div>
          <div class="field"><span class="lab">Dokter</span><div class="inp">drg. Nadia Putri</div></div>
          <div class="note">Risiko yang dijelaskan: nyeri, pembengkakan, perdarahan, dan kemungkinan perawatan lanjutan. Alternatif: observasi atau rujuk bedah mulut.</div>
        </article>
        <article class="card">
          <h3>Tanda tangan pasien</h3>
          <div class="field"><span class="lab">Penandatangan</span><div class="inp">Budi Santoso · pasien</div></div>
          {sig}
          <p class="mu">Hash dokumen akan disimpan. Bukan TTE tersertifikasi. Ulangi ada di Lainnya.</p>
        </article>
      </div>
    </div>"""
    frame = desk(
        body,
        "Informed consent",
        "Budi Santoso · gigi 38",
        "RM",
        "Nadia Putri",
        "dokter",
        dock_html=dock(btn("Setujui dan simpan", "pri", "stamp")),
    )
    return ab(
        "08",
        "Informed consent digital",
        "Satu aksi utama di bilah bawah. Wali wajib jika pasien anak. Fitur tanpa izin disembunyikan.",
        frame,
    )


def ab09() -> str:
    body = f"""
    <div class="desk-body">
      <div class="split-5" style="flex:1">
        <article class="card">
          <h3>Gigi 26</h3>
          {odonto("26")}
          <p class="mu">Foto menempel pada nomor gigi dan kunjungan, bukan galeri wajah.</p>
        </article>
        <article class="card">
          <h3>Sebelum dan sesudah {chip("26", "isi")}</h3>
          <div class="ba">
            <div class="well has">{ico("image", "ic-lg")}<span>Sebelum · 15 Nov 2026</span><span class="mu">Karies O, M</span></div>
            <div class="well">{ico("camera", "ic-lg")}<span>Sesudah</span><span class="mu">Ambil setelah restorasi</span></div>
          </div>
        </article>
      </div>
    </div>"""
    frame = desk(
        body,
        "Foto per gigi",
        "Budi Santoso · kunjungan hari ini",
        "RM",
        "Nadia Putri",
        "dokter",
        dock_html=dock(btn("Ambil foto sesudah", "pri", "camera")),
    )
    return ab(
        "09",
        "Foto before-after per gigi",
        "Foto di nomor gigi. Ambil foto sesudah menempel di bawah.",
        frame,
    )


def ab10() -> str:
    data = [
        ("Scribe suara ke SOAP", "Belum", "belum", "Sebagian", "sebagian",
         "Draf dari ucapan, tanpa izin rekam pasien. Audio dihapus setelah Selesai."),
        ("AI ICD dari catatan", "Sebagian", "sebagian", "Belum", "belum",
         "Saran draf, sitasi sumber, Setujui per item lalu Selesai."),
        ("AI saran tindakan", "Belum", "belum", "Belum", "belum",
         "Dari odontogram, tetap draf sampai Setujui."),
        ("Pindai KTP", "Ada", "ada", "Sebagian", "sebagian",
         "Foto tersimpan terenkripsi, akses terbatas, NIK mask."),
        ("Frasa cepat SOAP", "Belum", "belum", "Belum", "belum",
         "Satu ketuk mengisi kolom, dokter bisa ubah."),
        ("Odontogram cepat", "Ada", "ada", "Sebagian", "sebagian",
         "Ketuk gigi, permukaan, kondisi."),
        ("e-resep template", "Sebagian", "sebagian", "Sebagian", "sebagian",
         "Template obat, Draf sampai Setujui. AI tidak meresepkan."),
        ("Consent tanda tangan", "Ada", "ada", "Sebagian", "sebagian",
         "Pad tablet, hash dokumen, wali jika anak."),
        ("Foto before-after per gigi", "Sebagian", "sebagian", "Belum", "belum",
         "Foto menempel di nomor gigi."),
    ]
    rows = []
    for feat, km, kms, bt, bts, use in data:
        rows.append(
            "<tr><td class='ft'>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>".format(
                feat, chip(km, kms), chip(bt, bts), use
            )
        )
    table = """
    <div class="desk" style="height:auto;width:1280px;display:block;padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:12px">
        <div><h2 style="margin:0;font-size:16px">Ringkasan gap · klinik gigi</h2>
          <div class="crumb">Sumber publik KlinikMe, 15 Nov 2026, WIB. Bittodent dari repo dan papan.</div></div>
        {syn}
      </div>
      <div class="legend" style="margin-bottom:12px">{leg}</div>
      <table class="gap">
        <thead><tr><th>Fitur</th><th>KlinikMe</th><th>Bittodent</th><th>Usulan</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>""".format(
        syn=syn(),
        leg=" ".join([chip("Ada", "ada"), chip("Sebagian", "sebagian"), chip("Belum", "belum")]),
        rows="".join(rows),
    )
    return ab(
        "10",
        "Ringkasan gap",
        "Fokus AI dan kemudahan input. Fitur non-gigi diabaikan.",
        table,
    )


def build() -> str:
    parts = [
        ab01(),
        ab02(),
        ab03(),
        ab04(),
        ab05(),
        ab06(),
        ab07(),
        ab08(),
        ab09(),
        ab10(),
        ab11(),
    ]
    return f"""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Bittodent · KlinikMe gigi · AI dan input cepat</title>
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
  <h1 class="page">AI dan input cepat untuk klinik gigi</h1>
  <p class="lede">Papan usulan Bittodent, dibanding fitur publik KlinikMe. Semua layar memakai data sintetis. Keluaran AI selalu Draf sampai dokter Setujui, lalu Selesai. NIK dienkripsi dan tidak ditampil penuh. Fitur tanpa izin disembunyikan.</p>
  {''.join(parts)}
</div>
</body>
</html>
"""


def main() -> None:
    html = build()
    OUT.write_text(html)
    ART.parent.mkdir(parents=True, exist_ok=True)
    ART.write_text(html)
    print(f"wrote {OUT}")
    print(f"wrote {ART}")


if __name__ == "__main__":
    main()
