#!/usr/bin/env python3
"""Papan desain: perbaikan temuan review-2 PR #52 dan catatan A2 PR #57.

Hasil: design/boards/perbaikan-staging.html
dan /workspace/artifacts/bittodent-board-perbaikan-staging.html
Data sintetis. Tanpa JavaScript. Tidak mengubah kode app.
Gaya HeroUI + token Bittodent. Merek tetap #0B6B62.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "design/boards/perbaikan-staging.html"
ART = Path("/workspace/artifacts/bittodent-board-perbaikan-staging.html")
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
    bits = [w[0] for w in name.replace("drg. ", "").split() if w[:1].isalpha()]
    return "".join(bits[:2]).upper() or "?"


def av(name: str, tone: str = "") -> str:
    cls = "av av-fd" if tone == "fd" else "av"
    return f'<span class="{cls}">{initials(name)}</span>'


def chip(label: str, kind: str, icon: str | None = None) -> str:
    if icon is None:
        icon = {
            "draf": "pen",
            "ok": "check",
            "tolak": "x",
            "warn": "alert",
            "bayar": "alert",
            "med": "alert",
            "karies": "alert",
            "isi": "lock",
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


def seg(items: list[tuple[str, bool]]) -> str:
    out = []
    for lab, on in items:
        cls = "seg-btn on" if on else "seg-btn"
        out.append(f'<button class="{cls}" type="button">{lab}</button>')
    return f'<div class="seg" role="tablist">{"".join(out)}</div>'


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


CSS = r"""
:root{
  --motion-fast:120ms;--motion-std:200ms;--motion-slow:280ms;
  --motion-ease-standard:cubic-bezier(0.2, 0, 0, 1);
  --motion-ease-enter:cubic-bezier(0.16, 1, 0.3, 1);
  --motion-ease-exit:cubic-bezier(0.4, 0, 1, 1);
  --motion-ease-spring:cubic-bezier(0.32, 0.72, 0, 1);
}
*{box-sizing:border-box}
html,body{margin:0;background:#E8EEF0;color:var(--color-neutral-800);
  font-family:var(--font-family-sans);-webkit-font-smoothing:antialiased}
body{padding:48px 40px 80px}
.wrap{max-width:1760px;margin:0 auto}
h1.page{font-size:28px;font-weight:700;letter-spacing:-.02em;margin:0 0 4px;color:var(--color-neutral-900)}
.lede{margin:0 0 36px;color:var(--color-neutral-600);font-size:14px;font-weight:500;max-width:860px;line-height:1.5}
.ab{margin:0 0 64px;width:max-content;max-width:none;padding:8px 8px 8px 16px}
.ab-k{display:flex;align-items:baseline;gap:12px;margin:0 0 8px}
.ab-n{font-size:12px;font-weight:700;letter-spacing:.08em;color:var(--color-primary-700);text-transform:uppercase}
.ab-t{font-size:16px;font-weight:650;color:var(--color-neutral-800)}
.ab-d{font-size:12px;font-weight:500;color:var(--color-neutral-500);margin:0 0 14px;max-width:860px;line-height:1.45}
.row{display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap}

.ic{width:20px;height:20px;flex:none}
.ic-btn{width:16px;height:16px}
.ic-sm{width:16px;height:16px}

.syn{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;
  background:#FFFAEB;color:#B54708;border:1px solid #F5C14A;font-size:10px;font-weight:700;letter-spacing:.04em}
.chip{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:16px;gap:4px;
  font-size:11px;font-weight:700;letter-spacing:.01em;white-space:nowrap}
.chip .ic-sm{width:12px;height:12px}
.st-draf{background:#FFF6E5;color:#7A5200}
.st-ok{background:var(--color-appointment-selesai-bg);color:var(--color-appointment-selesai-fg)}
.st-tolak{background:var(--color-danger-bg);color:var(--color-danger-fg)}
.st-warn{background:var(--color-warning-bg);color:var(--color-warning-fg)}
.st-bayar{background:var(--color-warning-bg);color:var(--color-warning-fg)}
.st-med{background:var(--color-danger-bg);color:var(--color-danger-fg)}
.st-rawat{background:var(--color-appointment-merawat-bg);color:var(--color-appointment-merawat-fg)}
.st-tunggu{background:var(--color-appointment-checkin-bg);color:var(--color-appointment-checkin-fg)}
.st-konfirm{background:var(--color-appointment-terjadwal-bg);color:var(--color-appointment-terjadwal-fg)}
.st-mute{background:var(--color-neutral-100);color:var(--color-neutral-600)}
.st-karies{background:#FDECEC;color:#B42318}
.st-isi{background:var(--color-primary-50);color:var(--color-primary-800)}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 16px;
  border-radius:24px;font-size:13px;font-weight:700;border:0;background:transparent;color:var(--color-neutral-800);
  cursor:default;transition:background var(--motion-fast) var(--motion-ease-standard),
    transform var(--motion-fast) var(--motion-ease-standard),border-color var(--motion-fast) var(--motion-ease-standard)}
.btn.pri{background:var(--color-primary-700);color:#fff}
.btn.pri:hover{background:#0A5650}
.btn.sec{background:#fff;color:var(--color-primary-800);border:1px solid var(--color-primary-200)}
.btn.sec:hover{background:var(--color-primary-50)}
.btn.ghost{background:#fff;color:var(--color-neutral-700);border:1px solid var(--color-neutral-200)}
.btn.ghost:hover{background:var(--color-neutral-50)}
.btn.danger-soft{background:var(--color-danger-bg);color:var(--color-danger-fg)}
.btn:active{transform:scale(.97)}
.btn:focus-visible,.icon-btn:focus-visible,.seg-btn:focus-visible,.filt:focus-visible,.check-row:focus-within,.surf b:focus-visible{
  outline:2px solid var(--color-primary-700);outline-offset:2px}
.btn.dis{opacity:.45}
.icon-btn{width:48px;height:48px;display:grid;place-items:center;border:0;background:transparent;
  border-radius:16px;color:var(--color-neutral-700);flex:none;padding:0}
.av{width:32px;height:32px;border-radius:999px;background:var(--color-primary-100);color:var(--color-primary-800);
  display:grid;place-items:center;font-size:11px;font-weight:800;flex:none}
.av-fd{background:#E8F0FE;color:#1D4ED8}

.desk{width:1280px;background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);
  border-radius:24px;overflow:hidden;display:flex;flex:none;box-shadow:0 8px 24px rgba(22,33,43,.06)}
.rail{width:72px;background:#F4F7F7;border-right:1px solid var(--color-neutral-200);display:flex;flex-direction:column;
  align-items:center;padding:16px 8px 12px;gap:4px;flex:none}
.rail .logo{width:40px;height:40px;border-radius:16px;background:var(--color-primary-700);color:#fff;
  display:grid;place-items:center;margin-bottom:8px}
.rbtn{width:48px;height:48px;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:2px;color:var(--color-neutral-500);font-size:9px;font-weight:700;border:0;background:transparent}
.rbtn.on{background:var(--color-primary-700);color:#fff}
.rspacer{flex:1}
.desk-col{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--color-canvas)}
.top{display:flex;align-items:center;justify-content:space-between;min-height:56px;padding:0 16px 0 20px;
  background:#fff;border-bottom:1px solid var(--color-neutral-200);gap:12px}
.top h2{margin:0;font-size:16px;font-weight:700}
.top .who{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--color-neutral-600)}
.crumb{font-size:12px;font-weight:600;color:var(--color-neutral-500)}
.desk-body{flex:1;padding:16px;display:flex;gap:16px;min-height:0}
.desk-body.col{flex-direction:column}
.dock{flex:none;display:flex;align-items:center;justify-content:flex-end;gap:8px;
  padding:12px 16px;background:#fff;border-top:1px solid var(--color-neutral-200);
  box-shadow:0 -8px 24px rgba(22,33,43,.05)}
.ph .dock{justify-content:stretch}
.ph .dock .btn.pri{flex:1}

.ph{width:360px;background:#fff;border:1px solid var(--color-neutral-200);
  border-radius:28px;overflow:hidden;position:relative;display:flex;flex-direction:column;flex:none;
  box-shadow:0 8px 24px rgba(22,33,43,.06)}
.ph.w390{width:390px}
.ph-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 16px 0;min-height:28px}
.ph-time{font-size:12px;font-weight:600}
.hd{background:#fff;padding:0 8px;display:flex;align-items:center;gap:8px;min-height:56px;
  border-bottom:1px solid var(--color-neutral-100)}
.h-sm{margin:0;font-size:16px;font-weight:700;flex:1}
.ph-body{flex:1;background:var(--color-canvas);padding:12px 16px;display:flex;flex-direction:column;gap:10px;min-height:0;overflow:hidden}
.bnav{flex:none;min-height:80px;background:#fff;border-top:1px solid var(--color-neutral-200);display:flex;padding:4px 4px 12px}
.navi{flex:1;border:0;background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:2px;font-size:10px;font-weight:700;color:var(--color-neutral-500);min-height:48px;border-radius:16px}
.navi.on{color:var(--color-primary-700)}

.card{background:#fff;border:1px solid var(--color-neutral-200);border-radius:24px;padding:16px;
  display:flex;flex-direction:column;gap:12px;box-shadow:0 8px 24px rgba(22,33,43,.04)}
.mu{font-size:12px;font-weight:500;color:var(--color-neutral-500)}
.kicker{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--color-neutral-500)}
.note{font-size:13px;line-height:1.45;color:var(--color-neutral-700)}

.seg{display:inline-flex;padding:4px;gap:4px;background:var(--color-neutral-100);border-radius:16px}
.seg-btn{min-height:48px;padding:0 14px;border:0;border-radius:12px;background:transparent;
  font-size:13px;font-weight:700;color:var(--color-neutral-600)}
.seg-btn.on{background:#fff;color:var(--color-primary-800);box-shadow:0 1px 3px rgba(22,33,43,.08)}
.seg.desk .seg-btn{min-height:40px}

.filt{display:inline-flex;align-items:center;min-height:48px;padding:0 14px;border-radius:16px;
  border:1px solid var(--color-neutral-200);background:#fff;font-size:12px;font-weight:700;color:var(--color-neutral-700);
  white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.filt.on{background:var(--color-primary-700);color:#fff;border-color:var(--color-primary-700)}
.filts{display:flex;flex-wrap:wrap;gap:8px}

.fold{border:1px solid var(--color-neutral-200);border-radius:16px;background:#fff;padding:0 12px}
.fold>summary{min-height:40px;display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;
  color:var(--color-neutral-800);cursor:default;list-style:none}
.fold>summary::-webkit-details-marker{display:none}
.fold>summary .chev{margin-left:auto}
.fold[open]>summary .chev{transform:rotate(180deg)}
.fold-body{padding:0 0 10px;display:flex;flex-direction:column;gap:6px}

.hour{font-size:11px;font-weight:800;letter-spacing:.04em;color:var(--color-neutral-500);padding:4px 2px 0}
.appt-row{display:flex;align-items:center;gap:8px;min-height:60px;padding:0 10px 0 12px;background:#fff;
  border:1px solid var(--color-neutral-200);border-radius:16px}
.appt-row.unpaid{box-shadow:inset 4px 0 0 var(--color-warning-fg)}
.appt-row .tm{width:40px;flex:none;font-size:13px;font-weight:800;font-variant-numeric:tabular-nums}
.appt-row .grow{flex:1;min-width:0}
.appt-row .nm{font-size:13px;font-weight:700;white-space:nowrap}
.appt-row .ds{font-size:11px;font-weight:500;color:var(--color-neutral-500)}
.appt-row .ds .pay{color:var(--color-warning-fg);font-weight:700}
.appt-row .btn{min-width:64px;padding:0 12px}

.fab{position:absolute;right:16px;bottom:92px;width:56px;height:56px;border-radius:16px;
  background:var(--color-primary-700);color:#fff;display:grid;place-items:center;
  box-shadow:0 8px 24px rgba(22,33,43,.16)}

.od-grid{display:flex;flex-direction:column;gap:6px}
.od-row{display:flex;gap:3px;justify-content:center}
.od-t{width:28px;height:36px;border-radius:8px;border:1px solid var(--color-neutral-200);background:#fff;
  display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:var(--color-neutral-600)}
.od-t .sq{width:12px;height:12px;border-radius:3px;border:1px solid var(--color-neutral-300);background:#fff;margin-bottom:2px}
.od-t.on{border-color:var(--color-primary-700);background:var(--color-primary-50);color:var(--color-primary-800)}
.od-t.on .sq{background:#FDECEC;border-color:#B42318}
.od-lab{text-align:center;font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--color-neutral-500)}

.sheet{position:absolute;left:0;right:0;bottom:0;z-index:4;background:#fff;
  border-radius:24px 24px 0 0;box-shadow:0 -8px 24px rgba(22,33,43,.12);
  padding:8px 16px 16px;display:flex;flex-direction:column;gap:10px;
  transform:translateY(0);transition:transform var(--motion-slow) var(--motion-ease-spring)}
.sheet .grab{width:36px;height:4px;border-radius:999px;background:var(--color-neutral-300);margin:4px auto 0}
.sheet-hd{display:flex;align-items:center;justify-content:space-between;min-height:48px}
.sheet-hd h3{margin:0;font-size:14px;font-weight:700}
.surf{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.surf b{min-height:56px;min-width:56px;border-radius:16px;border:1px solid var(--color-neutral-200);background:#fff;
  display:grid;place-items:center;font-size:13px;font-weight:800;color:var(--color-neutral-600)}
.surf b.on{background:var(--color-primary-700);color:#fff;border-color:var(--color-primary-700)}
.phrases{display:flex;flex-wrap:wrap;gap:8px}
.phrase{display:inline-flex;align-items:center;min-height:48px;padding:0 14px;border-radius:16px;
  border:1px solid var(--color-primary-200);background:#fff;color:var(--color-primary-800);font-size:12px;font-weight:700}
.phrase.on{background:var(--color-primary-700);color:#fff;border-color:var(--color-primary-700)}

.overlay{position:absolute;inset:0;background:rgba(16,32,40,.35);z-index:5;display:flex;align-items:flex-end;justify-content:center}
.dialog{width:calc(100% - 24px);background:#fff;border-radius:24px;padding:16px;margin:0 0 16px;
  box-shadow:0 8px 24px rgba(22,33,43,.16);display:flex;flex-direction:column;gap:12px}
.dialog h3{margin:0;font-size:16px;font-weight:700}
.check-row{display:flex;align-items:center;gap:12px;width:100%;min-height:48px;padding:8px 12px;border-radius:16px;
  border:1px solid var(--color-neutral-200);background:#fff;font-size:13px;font-weight:600;line-height:1.35;
  transition:background var(--motion-fast) var(--motion-ease-standard),border-color var(--motion-fast) var(--motion-ease-standard),transform var(--motion-fast)}
.check-row:active,.check-row[data-pressed]{transform:scale(.97);background:var(--color-neutral-50)}
.check-row.on{background:var(--color-primary-50);border-color:var(--color-primary-300);color:var(--color-primary-900)}
.box{width:24px;height:24px;border-radius:6px;border:1.5px solid var(--color-neutral-300);flex:none;display:grid;place-items:center;background:#fff;color:var(--color-primary-700)}
.check-row.on .box{background:var(--color-primary-700);border-color:var(--color-primary-700);color:#fff}

.grid-sched{display:grid;grid-template-columns:72px 1fr;gap:0;background:#fff;border:1px solid var(--color-neutral-200);border-radius:24px;overflow:hidden}
.grid-sched .axis{font-size:11px;font-weight:700;color:var(--color-neutral-500);padding:8px 10px 0 0;text-align:right;border-top:1px solid var(--color-neutral-100)}
.grid-sched .col{position:relative;min-height:280px;border-left:1px solid var(--color-neutral-100);padding:8px}
.grid-sched .slot{height:36px;border-top:1px dashed var(--color-neutral-100)}
.g-appt{position:absolute;left:8px;right:8px;border-radius:12px;padding:8px 10px;background:var(--color-appointment-terjadwal-bg);
  border-left:4px solid var(--color-appointment-terjadwal-border)}
.g-appt .nm{font-size:13px;font-weight:700}
.g-appt .ds{font-size:11px;color:var(--color-neutral-600)}
.col-head{padding:10px 12px;font-weight:700;font-size:13px;border-bottom:1px solid var(--color-neutral-100);background:#fff}

.toast{position:absolute;left:16px;right:auto;bottom:16px;z-index:6;min-height:48px;padding:8px 14px;border-radius:16px;
  background:#fff;border:1px solid var(--color-neutral-200);box-shadow:0 8px 24px rgba(22,33,43,.12);
  font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;
  animation:toast-in var(--motion-std) var(--motion-ease-enter)}
@keyframes toast-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

.aitem{border:1px solid var(--color-neutral-200);border-radius:20px;padding:12px;background:#fff;
  display:flex;flex-direction:column;gap:8px;border-left-width:4px;border-left-color:#7A5200}
.aitem-top{display:flex;align-items:center;gap:8px}
.aitem .code{font-size:14px;font-weight:800}
.aitem .nm{font-size:13px;font-weight:600;color:var(--color-neutral-700)}
.iacts{display:flex;gap:8px;justify-content:flex-end}
.iacts .btn{min-width:96px}
.cite{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:48px;min-width:48px;
  padding:0 10px;border-radius:16px;border:1px solid var(--color-primary-200);background:#fff;
  color:var(--color-primary-800);font-size:12px;font-weight:700}
.warn-line{display:flex;align-items:center;gap:8px;min-height:48px;padding:0 12px;border-radius:16px;
  background:var(--color-danger-bg);color:var(--color-danger-fg);font-size:13px;font-weight:700;border:1px solid var(--color-danger-border)}
.warn-line .mu{color:inherit;opacity:.8;font-weight:600;margin-left:auto}

.sk{border-radius:12px;background:var(--color-neutral-100);overflow:hidden;position:relative;min-height:16px}
.sk::after{content:"";position:absolute;inset:0;transform:translateX(-100%);
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent);
  animation:sk-shine 800ms var(--motion-ease-standard) infinite}
@keyframes sk-shine{to{transform:translateX(100%)}}
.sk-title{height:18px;width:42%}
.sk-line{height:14px;width:100%}
.sk-line.w2{width:70%}
.sk-block{min-height:120px}
.sk-row{display:flex;flex-direction:column;gap:10px}

.side{width:360px;flex:none;display:flex;flex-direction:column;gap:10px;position:sticky;top:16px;align-self:flex-start}
.split{display:grid;grid-template-columns:1fr 360px;gap:16px;flex:1;min-height:0}

@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation:none !important;transition:none !important}
  .sk::after{display:none}
}
"""


def rail(active: str) -> str:
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


def desk(body: str, title: str, crumb: str = "", active: str = "Jadwal", user: str = "Pemilik Senyum",
         role: str = "dokter", dock_html: str = "") -> str:
    prefix = "drg. " if role == "dokter" and not user.startswith("Pemilik") else ""
    mid = f'<div><h2>{title}</h2>{f"<div class=crumb>{crumb}</div>" if crumb else ""}</div>'
    return f"""
    <div class="desk" style="height:auto">
      {rail(active)}
      <div class="desk-col">
        <header class="top">{mid}
          <div class="who">{syn()}{av(user)}<span>{prefix}{user}</span></div>
        </header>
        {body}
        {dock_html}
      </div>
    </div>"""


def bnav(active: str = "Jadwal") -> str:
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
        out.append(f'<button class="navi{on}" type="button">{ico(icon)}<span>{show}</span></button>')
    return f'<nav class="bnav">{"".join(out)}</nav>'


def phone(inner: str, title: str, height: int = 800, nav: str = "Jadwal", back: bool = True,
          extra: str = "", dock_html: str = "", overlay: str = "", width: int = 360) -> str:
    left = f'<button class="icon-btn" type="button" aria-label="Kembali">{ico("chevron-left")}</button>' if back else ""
    wcls = " ph w390" if width == 390 else " ph"
    return f"""
    <div class="{wcls.strip()}" style="height:{height}px">
      <div class="ph-bar">{syn()}<span class="ph-time">09.40</span></div>
      <header class="hd">{left}<h1 class="h-sm">{title}</h1>{extra}
        <button class="icon-btn" type="button" aria-label="Lainnya">{ico("more")}</button></header>
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
    upper = ["18","17","16","15","14","13","12","11","21","22","23","24","25","26","27","28"]
    lower = ["48","47","46","45","44","43","42","41","31","32","33","34","35","36","37","38"]

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


def appt_row(time: str, name: str, meta: str, status: str, cta: str) -> str:
    unpaid = " unpaid" if status == "Belum bayar" else ""
    st = f' · <span class="pay">{status}</span>' if status else ""
    return f"""
    <div class="appt-row{unpaid}">
      <div class="tm">{time}</div>
      <div class="grow"><div class="nm">{name}</div><div class="ds">{meta}{st}</div></div>
      {btn(cta, "pri")}
    </div>"""


def ai_item(title: str, sub: str, cite: str, compact: bool = False) -> str:
    acts = "" if compact else f'<div class="iacts">{btn("Tolak", "danger-soft")}{btn("Setujui", "sec", "check")}</div>'
    cite_h = (
        f'<button class="cite" type="button">{ico("quote", "ic-sm")}{cite}</button>'
    )
    return f"""
    <div class="aitem">
      <div class="aitem-top">
        <div class="code grow">{title}</div>
        {chip("Draf", "draf")}
        {cite_h}
        {acts if compact else ""}
      </div>
      <div class="nm">{sub}</div>
      {"" if compact else acts}
    </div>"""


# ---------- artboards ----------

def ab01() -> str:
    rows = (
        appt_row("08.00", "Sari Nugroho", "Kursi 2 · Andi", "Belum bayar", "Bayar")
        + appt_row("11.00", "Fajar Halim", "Kursi 1 · Pemilik", "Belum bayar", "Bayar")
        + appt_row("16.00", "Sari Nugroho", "Kursi 1 · Andi", "Belum bayar", "Bayar")
    )
    inner = f"""
      {seg([("Meja depan", True), ("Dokter", False)])}
      {fold("15 Nov 2026 · 21 janji",
            '<div class="mu">Sen 9 sampai Min 15. Pilih hari, lalu lipat.</div>',
            hint="Week strip dilipat")}
      <p class="mu" style="margin:0">20 janji · 15 hadir · Rp 1,75jt</p>
      <div class="filts">
        <button class="filt on" type="button">Belum bayar · 3</button>
        <button class="filt" type="button">Semua · 21</button>
        <button class="filt" type="button">Andi · 9</button>
        <button class="filt" type="button">Pemilik · 12</button>
      </div>
      <div class="kicker">Belum bayar · 3</div>
      {rows}
      {fold("Berikutnya dan Selesai", '<p class="mu" style="margin:0">Blok lain dilipat. Buka bila perlu.</p>')}
      <div style="height:64px" aria-hidden="true"></div>
    """
    fab = f'<button class="fab" type="button" aria-label="Buat janji">{ico("plus")}</button>'
    ph = phone(inner, "Jadwal", 800, "Jadwal", back=False, overlay=fab)
    return ab(
        "01",
        "Jadwal Meja depan HP",
        "Sebelum ~3,5 layar di 360: week strip, KPI 3 kolom, chip dokter terpotong, kartu 163px. Sesudah: baris 60px, chip filter 48px, week dan KPI dilipat. Tiga Belum bayar muat di 360×800 (≤1,8 layar). Chip oranye, bukan teal.",
        ph,
    )


def ab02() -> str:
    pads = "".join(
        f'<b class="{"on" if n in ("M","O") else ""}">{n}</b>' for n in ("M", "O", "D", "B", "L")
    )
    conds = [("Karies", True), ("Tumpatan", False), ("Hilang", False), ("Goyah", False)]
    phrases = "".join(f'<span class="phrase{" on" if on else ""}">{lab}</span>' for lab, on in conds)
    sheet = f"""
    <div class="sheet" role="dialog" aria-label="Detail gigi 26">
      <div class="grab" aria-hidden="true"></div>
      <div class="sheet-hd"><h3>Gigi 26</h3>
        <button class="icon-btn" type="button" aria-label="Tutup">{ico("x")}</button></div>
      <p class="mu" style="margin:0">Sari Nugroho · ketuk seluruh gigi, bukan kotak 23px.</p>
      <div class="kicker">Permukaan</div>
      <div class="surf">{pads}</div>
      <div class="kicker">Kondisi</div>
      <div class="phrases">{phrases}</div>
      {dock(btn("Simpan 26", "pri", "check"))}
    </div>"""
    inner = f"""
      <p class="mu" style="margin:0">Ketuk gigi untuk buka lembar. Permukaan dipilih di pad 56px.</p>
      <article class="card">{odonto("26")}</article>
    """
    ph = phone(inner, "Rekam Medis", 800, "RM", overlay=sheet)
    return ab(
        "02",
        "Permukaan gigi di sheet",
        "Di HP, ketuk seluruh gigi (bukan poligon oklusal 23×24) membuka lembar. Pad M/O/D/B/L 56px, kondisi 48px, satu aksi Simpan. Sheet masuk 280 ms.",
        ph,
    )


def ab03() -> str:
    dialog = f"""
    <div class="overlay">
      <div class="dialog" role="dialog" aria-label="Selesai kunjungan">
        <h3>Selesai kunjungan</h3>
        <p class="note" style="margin:0">Yang dikunci: SOAP versi 1, gigi 26 O tumpatan (ICD-9-CM 23.2). Perubahan hanya lewat koreksi.</p>
        <div class="check-row on" data-pressed>
          <span class="box">{ico("check", "ic-sm")}</span>
          <span>Dengan menekan Selesai, saya menyatakan catatan ini benar.</span>
        </div>
        <div class="iacts">
          {btn("Batal", "ghost")}
          {btn("Selesai", "pri", "lock")}
        </div>
      </div>
    </div>"""
    inner = '<p class="mu" style="margin:0">Isi rekam medis di belakang dialog.</p>'
    ph = phone(inner, "Rekam Medis", 800, "RM", overlay=dialog)
    return ab(
        "03",
        "Checkbox Selesai 48px",
        "Bukan kotak 24px. Seluruh baris adalah target 48px, dengan state tekan (scale 0,97) dan terpilih (latar primary-50). Selesai solid setelah tercentang. Konflik 20px di styles.css dihapus.",
        ph,
    )


def ab04() -> str:
    # Andi column only
    slots = "".join(f'<div class="slot"></div>' for _ in range(7))
    axis = "".join(
        f'<div class="axis">{h}</div><div></div>'
        for h in ("08.00", "09.00", "10.00", "11.00", "12.00", "13.00", "14.00")
    )
    # simpler visual: header + a few blocks
    body = f"""
    <div class="desk-body col">
      <div class="sum-row" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between">
        {seg([("Semua · 21", False), ("Andi · 9", True), ("Bunga · 0", False), ("Pemilik · 12", False)])}
        {btn("Buat janji", "pri", "plus")}
      </div>
      <div class="grid-sched">
        <div class="col-head" style="grid-column:1">Jam</div>
        <div class="col-head">drg. Andi Contoh · 9</div>
        <div class="axis">08.00</div>
        <div class="col" style="min-height:72px">
          <div class="g-appt" style="top:8px;height:56px">
            <div class="nm">Sari Nugroho</div>
            <div class="ds">08.00 · Kursi 2 · {chip("Belum bayar", "bayar")}</div>
          </div>
        </div>
        <div class="axis">10.00</div>
        <div class="col" style="min-height:72px">
          <div class="g-appt" style="top:8px;height:56px;background:var(--color-appointment-merawat-bg);border-color:var(--color-appointment-merawat-border)">
            <div class="nm">Budi Santoso</div>
            <div class="ds">10.00 · Kursi 1 · {chip("Sedang dirawat", "rawat")}</div>
          </div>
        </div>
        <div class="axis">16.00</div>
        <div class="col" style="min-height:72px">
          <div class="g-appt" style="top:8px;height:56px">
            <div class="nm">Sari Nugroho</div>
            <div class="ds">16.00 · Kursi 1 · {chip("Belum bayar", "bayar")}</div>
          </div>
        </div>
      </div>
    </div>"""
    frame = desk(
        body,
        "Jadwal",
        "15 Nov 2026 · Senyum Sehat Kemang · 21 janji",
        "Jadwal",
        "Pemilik Senyum",
        "resepsionis",
    )
    return ab(
        "04",
        "Filter dokter di Jadwal 1280",
        "Chip di header: Semua, Andi, Bunga, Pemilik, dengan jumlah. Andi dipilih, kolom Bunga (0 janji) disembunyikan. Tanggal 15 Nov 2026, bukan 11/15/2026. Pilihan tersimpan per cabang.",
        frame,
    )


def ab05() -> str:
    inner = f"""
      <div class="card">
        <p class="note" style="margin:0">Selesai. Rekam medis terkunci. Ada sisa tagihan.</p>
      </div>
      <article class="card">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <strong>Catatan SOAP</strong>
          {chip("Selesai", "ok", "lock")}
        </div>
        <p class="note" style="margin:0">S · Nyeri gigit 26. O · Karies O, M. A · Karies dentin. P · Tumpatan 26.</p>
      </article>
    """
    ph = phone(
        inner,
        "Rekam Medis",
        800,
        "RM",
        dock_html=dock(btn("Kembali ke Jadwal", "sec"), btn("Lanjut ke tagihan", "pri")),
    )
    return ab(
        "05",
        "Setelah Selesai, lanjut tagihan",
        "Jika ada sisa, Lanjut ke tagihan solid, Kembali ke Jadwal sekunder. Tanpa izin billing.read, tombol tagihan disembunyikan dan Kembali menjadi primer.",
        ph,
    )


def ab06() -> str:
    pending = (
        ai_item("Tumpatan", "Gigi 26 · M · ICD-9-CM 23.2", "26")
        + ai_item("Tumpatan", "Gigi 37 · O, D · ICD-9-CM 23.2", "37")
    )
    reviewed = ai_item("Pencabutan", "Gigi 48 · ICD-9-CM 23.09", "48", compact=True)
    warn = (
        f'<button class="warn-line" type="button">{ico("alert", "ic-sm")}'
        f'3 peringatan medis<span class="mu">Buka</span>{ico("chevron-down", "ic-sm")}</button>'
    )
    inner = f"""
      <p class="note" style="margin:0">Budi Santoso · kunjungan hari ini</p>
      {warn}
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
        {chip("2 draf", "draf")}{chip("1 diulas", "ok")}
        {seg([("Semua", False), ("Draf", True), ("Diulas", False)])}
      </div>
      {pending}
      {fold("1 sudah diulas", reviewed)}
    """
    ph = phone(
        inner,
        "Saran tindakan",
        800,
        "RM",
        dock_html=dock(btn("Setujui semua (2)", "pri", "check")),
        width=390,
    )
    sk_inner = f"""
      <p class="note" style="margin:0">Budi Santoso · kunjungan hari ini</p>
      <div class="sk-row">
        <div class="sk" style="min-height:48px;border-radius:16px"></div>
        <div class="sk sk-title"></div>
        <div class="sk sk-block"></div>
        <div class="sk sk-block" style="min-height:88px"></div>
      </div>
    """
    sk = phone(
        sk_inner,
        "Rekam Medis",
        800,
        "RM",
        dock_html=dock('<div class="sk" style="flex:1;min-height:48px;border-radius:24px"></div>'),
        width=390,
    )
    return ab(
        "06",
        "A2 saran tindakan HP 390",
        "Tanpa rail, ada bottom nav. Header ringkas, chip peringatan 1 baris yang bisa dibuka. Dock Setujui semua di atas nav, target 48px, Setujui item sekunder. Kanan: skeleton cadangan tinggi, pengganti teks Memuat rekam medis.",
        f'<div class="row">{ph}{sk}</div>',
    )


def ab07() -> str:
    items = (
        ai_item("Tumpatan", "Gigi 26 · M · 23.2", "26", compact=True)
        + ai_item("Tumpatan", "Gigi 37 · O, D · 23.2", "37", compact=True)
    )
    # compact items should still show 48px actions on the right
    items = f"""
    <div class="aitem">
      <div class="aitem-top">
        <div class="grow"><div class="code">Tumpatan</div><div class="nm">Gigi 26 · M · 23.2</div></div>
        {chip("Draf", "draf")}
        <button class="cite" type="button">{ico("quote", "ic-sm")}26</button>
      </div>
      <div class="iacts">{btn("Tolak", "danger-soft")}{btn("Setujui", "sec", "check")}</div>
    </div>
    <div class="aitem">
      <div class="aitem-top">
        <div class="grow"><div class="code">Tumpatan</div><div class="nm">Gigi 37 · O, D · 23.2</div></div>
        {chip("Draf", "draf")}
        <button class="cite" type="button">{ico("quote", "ic-sm")}37</button>
      </div>
      <div class="iacts">{btn("Tolak", "danger-soft")}{btn("Setujui", "sec", "check")}</div>
    </div>"""
    body = f"""
    <div class="desk-body col" style="position:relative">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button class="warn-line" type="button" style="flex:0 1 auto">{ico("alert", "ic-sm")}
          3 peringatan medis<span class="mu">Buka</span></button>
        <span class="mu">Budi Santoso · 15 Nov 2026</span>
      </div>
      <div class="split">
        <article class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <strong>Odontogram</strong>
            {chip("3 temuan draf", "draf")}
          </div>
          {odonto("26")}
          {fold("Temuan tercatat", "<p class='mu' style='margin:0'>26 M karies. 37 O, D karies. 48 sisa akar.</p>")}
        </article>
        <aside class="side card" style="width:auto">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <strong>Saran tindakan</strong>
            {btn("Setujui semua (2)", "pri", "check")}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">{chip("2 draf", "draf")}{chip("1 diulas", "ok")}</div>
          {seg([("Semua", False), ("Draf", True), ("Diulas", False)])}
          {items}
          {fold("1 sudah diulas", ai_item("Pencabutan", "Gigi 48 · 23.09", "48", compact=True))}
        </aside>
      </div>
      <div class="toast" role="status">{ico("check", "ic-sm")} Pencabutan 48 masuk rencana.</div>
    </div>"""
    frame = desk(body, "Rekam Medis", "Budi Santoso · Senyum Sehat Kemang", "RM", "Andi Contoh", "dokter")
    return ab(
        "07",
        "A2 saran tindakan desktop 1280",
        "Panel kanan sticky di samping odontogram. Tolak dan Setujui 48px, rata kanan, ringkas. Toast mengganti banner. Tanpa teks bantuan berlebih. Peringatan 1 baris di header.",
        frame,
    )


def build() -> str:
    parts = [ab01(), ab02(), ab03(), ab04(), ab05(), ab06(), ab07()]
    return f"""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Bittodent · Perbaikan staging · review-2 dan A2</title>
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
  <h1 class="page">Perbaikan staging: review-2 dan A2</h1>
  <p class="lede">Usulan UI untuk temuan terbuka PR #52 (Jadwal Meja depan, permukaan gigi, checkbox Selesai, filter dokter, CTA setelah Selesai) dan catatan A2 PR #57 (saran tindakan HP dan desktop). Data sintetis. Keluaran AI tetap draf sampai Setujui. Teal #0B6B62 hanya pada tombol primer.</p>
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
