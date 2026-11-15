#!/usr/bin/env python3
"""Papan desain Bittodent: AI dan input cepat klinik gigi, gap vs KlinikMe.

Hasil: design/boards/klinikme-gigi.html
dan /workspace/artifacts/bittodent-board-klinikme-gigi.html
Data sintetis. Tanpa JavaScript. Tidak mengubah kode app.
Gaya Zendenta; merek tetap #0B6B62.
"""
from __future__ import annotations

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


def chip(label: str, kind: str) -> str:
    return f'<span class="chip st-{kind}">{label}</span>'


def btn(label: str, kind: str = "pri", icon: str | None = None, disabled: bool = False) -> str:
    ic = ico(icon, "ic-btn") if icon else ""
    cls = f"btn {kind}"
    if disabled:
        cls += " dis"
    aria = ' aria-disabled="true"' if disabled else ""
    return f'<button class="{cls}" type="button"{aria}>{ic}{label}</button>'


def syn() -> str:
    return '<span class="syn">DATA SINTETIS</span>'


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
.chip{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:999px;
  font-size:11px;font-weight:700;letter-spacing:.01em;white-space:nowrap}
.st-draf{background:#FFF6E5;color:#7A5200}
.st-ai{background:var(--color-appointment-checkin-bg);color:var(--color-appointment-checkin-fg)}
.st-ok{background:var(--color-appointment-selesai-bg);color:var(--color-appointment-selesai-fg)}
.st-tolak{background:var(--color-danger-bg);color:var(--color-danger-fg)}
.st-warn{background:var(--color-warning-bg);color:var(--color-warning-fg)}
.st-info{background:var(--color-info-bg);color:var(--color-info-fg)}
.st-mute{background:var(--color-neutral-100);color:var(--color-neutral-600)}
.st-ada{background:var(--color-appointment-selesai-bg);color:var(--color-appointment-selesai-fg)}
.st-sebagian{background:#FFF6E5;color:#9A6700}
.st-belum{background:var(--color-neutral-100);color:var(--color-neutral-600)}
.st-karies{background:#FDECEC;color:#B42318}
.st-isi{background:var(--color-primary-50);color:var(--color-primary-800)}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:0 16px;
  border-radius:12px;font-size:13px;font-weight:700;border:0;background:transparent;color:var(--color-neutral-800);cursor:default}
.btn.pri{background:var(--color-primary-700);color:#fff}
.btn.sec{background:var(--color-neutral-0);color:var(--color-primary-800);border:1px solid var(--color-primary-200)}
.btn.ghost{background:var(--color-neutral-0);color:var(--color-neutral-700);border:1px solid var(--color-neutral-200)}
.btn.dis{opacity:.45}
.icon-btn{width:44px;height:44px;display:grid;place-items:center;border:0;background:transparent;
  border-radius:12px;color:var(--color-neutral-700);flex:none;padding:0}

.av{width:32px;height:32px;border-radius:10px;background:var(--color-primary-100);color:var(--color-primary-800);
  display:grid;place-items:center;font-size:11px;font-weight:800;flex:none}
.av-fd{background:#E8F0FE;color:#1D4ED8}

.desk{width:1280px;background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);
  border-radius:20px;overflow:hidden;display:flex;flex:none;box-shadow:0 8px 28px rgba(22,33,43,.06)}
.rail{width:72px;background:#F4F7F7;border-right:1px solid var(--color-neutral-200);display:flex;flex-direction:column;
  align-items:center;padding:16px 8px 12px;gap:4px;flex:none}
.rail .logo{width:40px;height:40px;border-radius:12px;background:var(--color-primary-700);color:#fff;
  display:grid;place-items:center;margin-bottom:8px}
.rail .logo .ic{width:20px;height:20px}
.rspacer{flex:1}
.rbtn{width:48px;height:48px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;
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

.ph{width:360px;background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);
  border-radius:24px;overflow:hidden;position:relative;display:flex;flex-direction:column;flex:none}
.ph-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 16px 0;min-height:28px;
  background:var(--color-neutral-0)}
.ph-time{font-size:12px;font-weight:600;color:var(--color-neutral-700)}
.hd{background:var(--color-neutral-0);padding:0 8px 8px;display:flex;align-items:center;justify-content:space-between;
  min-height:44px;gap:8px;border-bottom:1px solid var(--color-neutral-100)}
.h-sm{margin:0;font-size:16px;font-weight:700;flex:1}
.ph-body{flex:1;background:var(--color-canvas);padding:8px 16px 120px;display:flex;flex-direction:column;gap:8px}
.bnav{position:absolute;left:0;right:0;bottom:0;height:72px;background:var(--color-neutral-0);
  border-top:1px solid var(--color-neutral-200);display:flex;padding:0 4px 8px}
.navi{flex:1;border:0;background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:2px;font-size:10px;font-weight:700;color:var(--color-neutral-500);min-height:44px}
.navi .ic{width:20px;height:20px}
.navi.on{color:var(--color-primary-700)}

.card{background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);border-radius:16px;padding:14px 16px}
.card h3{margin:0 0 8px;font-size:13px;font-weight:700;color:var(--color-neutral-800);display:flex;align-items:center;gap:8px}
.note{font-size:13px;line-height:1.45;color:var(--color-neutral-700)}
.note b{font-weight:700;color:var(--color-neutral-900)}
.mu{font-size:12px;font-weight:500;color:var(--color-neutral-500)}
.kicker{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--color-neutral-500)}
.banner{display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border-radius:12px;font-size:12px;font-weight:600;line-height:1.4}
.banner.warn{background:var(--color-warning-bg);color:var(--color-warning-fg);border:1px solid var(--color-warning-border)}
.banner.info{background:var(--color-info-bg);color:var(--color-info-fg);border:1px solid var(--color-info-border)}
.banner.ok{background:var(--color-success-bg);color:var(--color-success-fg);border:1px solid var(--color-success-border)}
.banner .ic{margin-top:1px}
.field{display:flex;flex-direction:column;gap:4px;margin:0 0 10px}
.lab{font-size:11px;font-weight:700;color:var(--color-neutral-500);letter-spacing:.04em;text-transform:uppercase}
.inp{min-height:44px;border:1px solid var(--color-neutral-200);border-radius:12px;background:var(--color-neutral-0);
  padding:10px 12px;font-size:14px;font-weight:600;color:var(--color-neutral-800);display:flex;align-items:center}
.inp.area{min-height:52px;align-items:flex-start;font-weight:500;line-height:1.4}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.split{display:grid;grid-template-columns:1fr 1fr;gap:16px;flex:1;min-height:0}
.split-5{display:grid;grid-template-columns:1.15fr .85fr;gap:16px;flex:1;min-height:0}
.scroll-col{display:flex;flex-direction:column;gap:10px;min-width:0}

.icode{display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid var(--color-neutral-200);
  border-radius:14px;background:var(--color-neutral-0)}
.icode.on{border-color:var(--color-primary-300);background:var(--color-primary-50);box-shadow:0 0 0 2px var(--color-primary-100)}
.icode .code,.aitem .code{font-size:14px;font-weight:800;color:var(--color-neutral-900);font-variant-numeric:tabular-nums}
.icode .nm,.aitem .nm{font-size:13px;font-weight:600;color:var(--color-neutral-800)}
.checkb{width:20px;height:20px;border-radius:6px;border:1.5px solid var(--color-neutral-300);flex:none;margin-top:2px;
  display:grid;place-items:center;color:#fff}
.icode.on .checkb{background:var(--color-primary-700);border-color:var(--color-primary-700)}

.aitem{border:1px solid var(--color-neutral-200);border-radius:14px;padding:12px;background:var(--color-neutral-0);
  display:flex;flex-direction:column;gap:8px;border-left-width:4px;border-left-color:var(--color-neutral-300)}
.aitem.st-draf{border-left-color:#7A5200}
.aitem.st-ok{border-left-color:var(--color-appointment-selesai-fg)}
.aitem.st-tolak{border-left-color:var(--color-danger-fg)}
.aitem-top{display:flex;align-items:flex-start;gap:8px}
.aitem-top .grow{flex:1;min-width:0}
.iacts{display:flex;gap:8px}
.iacts .btn{flex:1;padding:0 12px}
.cite{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:44px;min-width:44px;
  padding:0 10px;border-radius:999px;border:1px solid var(--color-primary-200);background:var(--color-neutral-0);
  color:var(--color-primary-800);font-size:12px;font-weight:700;flex:none}
.cite.on{background:var(--color-primary-50);border-color:var(--color-primary-400);
  box-shadow:0 0 0 2px var(--color-primary-100)}
.cite .ic-sm{width:14px;height:14px}
.pop{background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);border-radius:16px;
  box-shadow:0 8px 24px rgba(22,33,43,.12);padding:12px 14px}
.pop .src{font-size:13px;font-weight:500;line-height:1.5;color:var(--color-neutral-700)}
.hl{background:var(--color-primary-100);color:var(--color-primary-900);font-weight:700;padding:0 3px;border-radius:4px}
.note .hl{font-weight:700}
.sheet{position:absolute;left:0;right:0;bottom:0;z-index:4;background:var(--color-neutral-0);
  border-top:1px solid var(--color-neutral-200);border-radius:20px 20px 0 0;
  box-shadow:0 -8px 24px rgba(22,33,43,.12);padding:8px 16px 20px}
.sheet .grab{width:36px;height:4px;border-radius:999px;background:var(--color-neutral-300);margin:4px auto 12px}
.sheet h3{margin:0 0 8px;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:space-between;gap:8px}
.sheet .src{font-size:13px;font-weight:500;line-height:1.5;color:var(--color-neutral-700)}

.phrase{display:inline-flex;align-items:center;min-height:44px;padding:0 12px;border-radius:999px;
  border:1px solid var(--color-primary-200);background:var(--color-neutral-0);color:var(--color-primary-800);
  font-size:12px;font-weight:700}
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
.surf b{min-height:44px;border-radius:10px;border:1px solid var(--color-neutral-200);background:#fff;
  display:grid;place-items:center;font-size:12px;font-weight:800;color:var(--color-neutral-600)}
.surf b.on{background:var(--color-primary-700);color:#fff;border-color:var(--color-primary-700)}

.ktp{width:100%;aspect-ratio:1.6;border-radius:16px;background:linear-gradient(180deg,#1F4E79,#163A5F);
  color:#fff;padding:16px;display:flex;flex-direction:column;justify-content:space-between;position:relative}
.ktp .idlab{font-size:10px;font-weight:800;letter-spacing:.12em}
.ktp .who{font-size:16px;font-weight:800}
.ktp .meta{font-size:11px;font-weight:600;opacity:.85;line-height:1.5}
.ktp .photo{position:absolute;right:16px;top:40px;width:72px;height:88px;border-radius:8px;background:#C5D4E3}

.sig{height:120px;border:1.5px dashed var(--color-neutral-300);border-radius:14px;background:var(--color-neutral-25);
  display:flex;align-items:flex-end;padding:8px 16px;color:var(--color-neutral-400)}
.sig svg{width:180px;height:70px;stroke:var(--color-neutral-800);fill:none;stroke-width:2;stroke-linecap:round}

.ba{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.well{min-height:180px;border:1.5px dashed var(--color-neutral-300);border-radius:14px;background:var(--color-neutral-25);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--color-neutral-500);
  font-size:12px;font-weight:700;text-align:center;padding:16px}
.well.has{border-style:solid;background:#E8F0E9;color:var(--color-primary-900);border-color:var(--color-primary-200)}
.well .ic{width:28px;height:28px}

.rx,.attach{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;
  border:1px solid var(--color-neutral-200);border-radius:14px;background:#fff}
.attach{gap:10px}
.attach .grow{flex:1;min-width:0}
.attach .nm{font-size:13px;font-weight:700}
.attach .ds{font-size:12px;font-weight:500;color:var(--color-neutral-500)}
.rx .nm{font-size:13px;font-weight:700}
.rx .ds{font-size:12px;font-weight:500;color:var(--color-neutral-500)}

table.gap{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid var(--color-neutral-200);
  border-radius:16px;overflow:hidden;font-size:13px}
table.gap th,table.gap td{padding:10px 12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--color-neutral-100);
  line-height:1.4}
table.gap th{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--color-neutral-500);
  background:var(--color-neutral-50)}
table.gap tr:last-child td{border-bottom:0}
table.gap td.ft{font-weight:700;color:var(--color-neutral-900);white-space:nowrap}
.legend{display:flex;gap:12px;align-items:center;margin:0 0 12px;font-size:12px;font-weight:600;color:var(--color-neutral-600)}

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
) -> str:
    role_lab = "Dokter" if role == "dokter" else "Resepsionis"
    mid = f'<div><h2>{title}</h2>{f"<div class=crumb>{crumb}</div>" if crumb else ""}</div>'
    return f"""
    <div class="desk" style="height:auto">
      {rail(active, role)}
      <div class="desk-col">
        <header class="top">{mid}
          <div class="who">{syn()}{av(user, "fd" if role == "resepsionis" else "")}
            <span>drg. {user}</span></div>
        </header>
        {body}
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
    height: int = 800,
    nav: str = "RM",
    back: bool = True,
    mic: bool = False,
    pad_bottom: int | None = None,
    overlay: str = "",
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
    # Nav tinggi 72px. Padding bawah default 120 (>= nav + ruang aman).
    pb = 120 if pad_bottom is None else pad_bottom
    return f"""
    <div class="ph" style="height:{height}px">
      <div class="ph-bar">{syn()}<span class="ph-time">09.40</span></div>
      <header class="hd">{left}<h1 class="h-sm">{title}</h1>
        {mic_btn}<button class="icon-btn" type="button" aria-label="Lainnya">{ico("more")}</button></header>
      <div class="ph-body" style="padding-bottom:{pb}px">{inner}</div>
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
) -> str:
    lab, kind_st = {
        "draf": ("Draf", "draf"),
        "ok": ("Disetujui", "ok"),
        "tolak": ("Ditolak", "tolak"),
    }[status]
    acts = ""
    if status == "draf":
        acts = f'<div class="iacts">{btn("Tolak", "ghost")}{btn("Setujui", "pri", "check")}</div>'
    cite_h = cite_btn(cite, cite_on) if cite else ""
    pop = ""
    if popover:
        pop = (
            '<div class="pop" role="dialog" aria-label="Kalimat sumber">'
            f'<div class="kicker">Sumber</div><div class="src">{popover}</div></div>'
        )
    k = f' <span class="mu">{kind}</span>' if kind else ""
    return f"""
    <div class="aitem st-{kind_st}">
      <div class="aitem-top">
        <div class="code grow">{title}{k}</div>
        {chip(lab, kind_st)}
        {cite_h}
      </div>
      <div class="nm">{subtitle}</div>
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
    items = (
        ai_item("K02.1", "Karies dentin", "ok", cite="A", kind="ICD-10")
        + ai_item("K05.10", "Gingivitis kronis", "tolak", cite="O", kind="ICD-10")
        + ai_item(
            "23.2",
            "Restorasi gigi",
            "draf",
            cite="P",
            cite_on=True,
            kind="ICD-9-CM",
            popover=f'{hl("Restorasi komposit 26.")} Edukasi kebersihan. Kontrol 7 hari.',
        )
    )
    body = f"""
    <div class="desk-body">
      <div class="split-5" style="flex:1">
        <div class="scroll-col">
          <div class="kicker">Catatan disetujui</div>
          {soap_block("P")}
        </div>
        <div class="scroll-col">
          <article class="card">
            <h3>{ico("spark", "ic-sm")} Saran kode</h3>
            <div class="banner warn">{ico("alert", "ic-sm")}
              Draf tidak ke SATUSEHAT atau klaim.</div>
            {items}
            <div class="actions">
              {btn("Setujui semua", "pri", "check")}
            </div>
            <p class="mu" style="margin:10px 0 0">Selesai (tanda tangan) aktif setelah tidak ada draf.</p>
          </article>
        </div>
      </div>
    </div>"""
    frame = desk(
        body,
        "Saran ICD",
        "Budi Santoso · Gigi 26 · 15 Nov 2026",
        "RM",
        "Nadia Putri",
        "dokter")
    return ab(
        "01",
        "AI saran ICD dari catatan",
        "Tiap kode punya status Draf, Disetujui, atau Ditolak. Setujui atau Tolak per item, atau Setujui semua. Ketuk sitasi untuk melihat kalimat sumber.",
        frame,
    )


def ab02() -> str:
    items = (
        ai_item("S", "Nyeri gigit rahang kiri atas sejak 3 hari. Tidak alergi obat.", "ok", cite="Ucapan")
        + ai_item("O", "Gigi 26 karies dentin. Perkusi ringan positif.", "ok", cite="Ucapan")
        + ai_item("A", "Karies dentin 26.", "draf", cite="Ucapan")
        + ai_item("P", "Restorasi komposit 26. Kontrol 7 hari.", "tolak", cite="Ucapan")
    )
    inner = f"""
      <article class="card">
        <h3>{ico("mic", "ic-sm")} Ucapan</h3>
        <p class="note">Nyeri gigit kiri atas tiga hari, gigi 26 karies dentin, tambal komposit, kontrol tujuh hari, tidak alergi.</p>
      </article>
      {items}
      <div class="actions">
        {btn("Setujui semua", "pri", "check")}
      </div>
      <p class="mu">AI hanya merapikan yang diucapkan. Audio dihapus setelah Selesai.</p>
    """
    ph = phone(inner, "Draf SOAP", 1020, "RM", mic=True, pad_bottom=120)
    return ab(
        "02",
        "AI draf SOAP dari suara",
        "Setiap kolom SOAP adalah item draf. Setujui atau Tolak per item, atau Setujui semua. Sitasi membuka kalimat di transkrip (lihat artboard 11 untuk sheet).",
        ph,
    )


def ab03() -> str:
    items = (
        ai_item(
            "Restorasi komposit",
            "Gigi 26 · permukaan O, M",
            "ok",
            cite="26",
            kind="Tindakan",
        )
        + ai_item("Foto bitewing", "Rahang kiri atas", "tolak", cite="26", kind="Tindakan")
        + ai_item("Kontrol", "7 hari", "draf", cite="P", kind="Jadwal")
    )
    body = f"""
    <div class="desk-body">
      <div class="split-5" style="flex:1">
        <article class="card">
          <h3>Odontogram {chip("26 karies", "karies")}</h3>
          {odonto("26")}
          <p class="mu" style="margin:10px 0 0">Temuan tercatat: {hl("26 karies O, M")}. Perkusi ringan.</p>
        </article>
        <article class="card">
          <h3>{ico("spark", "ic-sm")} Saran tindakan</h3>
          <div class="banner info">{ico("alert", "ic-sm")}
            Hanya dari temuan di chart.</div>
          {items}
          <div class="actions">
            {btn("Setujui semua", "pri", "check")}
          </div>
          <p class="mu" style="margin:10px 0 0">Selesai aktif setelah tidak ada draf.</p>
        </article>
      </div>
    </div>"""
    frame = desk(body, "Saran tindakan", "Budi Santoso · Gigi 26", "RM", "Nadia Putri", "dokter")
    return ab(
        "03",
        "AI saran tindakan dari odontogram",
        "Status per saran: Draf, Disetujui, atau Ditolak. Setujui atau Tolak per item, atau Setujui semua. Sitasi merujuk temuan di chart atau catatan.",
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
    body = f"""
    <div class="desk-body">
      <div class="split-5" style="flex:1">
        <div class="scroll-col">
          <div class="kicker">Catatan · kalimat sumber</div>
          {soap_block("P")}
        </div>
        <div class="scroll-col">
          <article class="card">
            <h3>Status dan sitasi</h3>
            <div class="legend">{chip("Draf", "draf")} {chip("Disetujui", "ok")} {chip("Ditolak", "tolak")}</div>
            {desk_item}
            <p class="mu" style="margin:10px 0 0">Ketuk chip sitasi. Popover menampilkan kalimat yang ditandai di catatan.</p>
          </article>
        </div>
      </div>
    </div>"""
    frame = desk(
        body,
        "Sitasi",
        "Budi Santoso · Gigi 26",
        "RM",
        "Nadia Putri",
        "dokter",
    )
    sheet = f"""
    <div class="sheet" role="dialog" aria-label="Kalimat sumber">
      <div class="grab" aria-hidden="true"></div>
      <h3>Sumber · Ucapan <button class="icon-btn" type="button" aria-label="Tutup">{ico("x")}</button></h3>
      <div class="src">Nyeri gigit kiri atas tiga hari, {hl("gigi 26 karies dentin")}, tambal komposit, kontrol tujuh hari, tidak alergi.</div>
    </div>"""
    inner = f"""
      <article class="card">
        <h3>{ico("mic", "ic-sm")} Ucapan</h3>
        <p class="note">Nyeri gigit kiri atas tiga hari, gigi 26 karies dentin, tambal komposit, kontrol tujuh hari, tidak alergi.</p>
      </article>
      {ai_item("A", "Karies dentin 26.", "draf", cite="Ucapan", cite_on=True)}
      {ai_item("P", "Restorasi komposit 26. Kontrol 7 hari.", "draf", cite="Ucapan")}
    """
    ph = phone(inner, "Draf SOAP", 760, "RM", mic=True, pad_bottom=200, overlay=sheet)
    return ab(
        "11",
        "Status dan sitasi",
        "Desktop: popover menampilkan kalimat sumber yang ditandai. HP: sheet dari bawah, kalimat yang sama ditandai di transkrip.",
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
    body_scan = f"""
    <div class="desk-body">
      <div class="split" style="flex:1">
        <article class="card">
          <h3>{ico("camera", "ic-sm")} Hasil pindai</h3>
          {ktp}
          <p class="mu" style="margin:10px 0 0">Foto disimpan terenkripsi di profil setelah daftar. NIK tidak tampil penuh.</p>
        </article>
        <article class="card">
          <h3>Draf pasien baru</h3>
          <div class="banner warn">{ico("lock", "ic-sm")}
            NIK dienkripsi. Periksa kesesuaian dengan KTP fisik sebelum daftar.</div>
          <div class="field"><span class="lab">Nama</span><div class="inp">Budi Santoso</div></div>
          <div class="split" style="gap:10px">
            <div class="field"><span class="lab">Lahir</span><div class="inp">12 Mar 1988</div></div>
            <div class="field"><span class="lab">Kelamin</span><div class="inp">Laki-laki</div></div>
          </div>
          <div class="field"><span class="lab">Alamat</span><div class="inp">Tebet, Jakarta Selatan</div></div>
          <div class="field"><span class="lab">NIK</span><div class="inp">{ico("lock", "ic-sm")} ···· 4281</div></div>
          <div class="actions">
            {btn("Batal", "ghost")}
            {btn("Simpan draf", "sec")}
            {btn("Verifikasi dan daftar", "pri", "check")}
          </div>
        </article>
      </div>
    </div>"""
    scan = f"""
    <div class="desk" style="height:auto">
      {rail("Pasien", "resepsionis")}
      <div class="desk-col">
        <header class="top"><div><h2>Pasien baru · pindai KTP</h2>
          <div class="crumb">Klinik Gigi Senyum Sehat · Tebet</div></div>
          <div class="who">{syn()}{av("Sari Front", "fd")}<span>Sari Front Desk</span></div>
        </header>
        {body_scan}
      </div>
    </div>"""
    body_prof = f"""
    <div class="desk-body">
      <div class="split" style="flex:1">
        <article class="card">
          <h3>Identitas</h3>
          <div class="field"><span class="lab">Nama</span><div class="inp">Budi Santoso</div></div>
          <div class="split" style="gap:10px">
            <div class="field"><span class="lab">Lahir</span><div class="inp">12 Mar 1988</div></div>
            <div class="field"><span class="lab">Kelamin</span><div class="inp">Laki-laki</div></div>
          </div>
          <div class="field"><span class="lab">Alamat</span><div class="inp">Tebet, Jakarta Selatan</div></div>
          <div class="field"><span class="lab">NIK</span><div class="inp">{ico("lock", "ic-sm")} ···· 4281</div></div>
        </article>
        <article class="card">
          <h3>Lampiran {chip("Terenkripsi", "isi")}</h3>
          <div class="attach">
            <span>{ico("id-card")}</span>
            <div class="grow">
              <div class="nm">KTP</div>
              <div class="ds">15 Nov 2026 · hanya peran berizin</div>
            </div>
            {chip("Terenkripsi", "isi")}
            {btn("Buka", "pri")}
          </div>
          <p class="kicker" style="margin:14px 0 8px">Pratinjau · NIK tetap mask</p>
          {ktp}
          <p class="mu" style="margin:10px 0 0">Peran tanpa izin tidak melihat lampiran ini.</p>
        </article>
      </div>
    </div>"""
    prof = f"""
    <div class="desk" style="height:auto;margin-top:16px">
      {rail("Pasien", "resepsionis")}
      <div class="desk-col">
        <header class="top"><div><h2>Profil pasien</h2>
          <div class="crumb">Budi Santoso · RM BT-000214</div></div>
          <div class="who">{syn()}{av("Sari Front", "fd")}<span>Sari Front Desk</span></div>
        </header>
        {body_prof}
      </div>
    </div>"""
    return ab(
        "04",
        "Pindai KTP dan lampiran profil",
        "Identitas terisi otomatis sebagai draf. Setelah verifikasi, foto KTP disimpan terenkripsi di profil. Hanya peran berizin yang dapat membuka. Peran lain tidak melihat lampiran. NIK tetap mask, termasuk di pratinjau.",
        f'<div class="pair">{scan}{prof}</div>',
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
        <p class="mu" style="margin:10px 0 0">Satu ketuk mengisi atau menambah kolom SOAP. Boleh diubah setelahnya.</p>
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
    frame_d = desk(desk_body, "SOAP · frasa cepat", "Budi Santoso", "RM", "Nadia Putri", "dokter")
    ph_inner = f"""
      <div class="phrases">{chips}</div>
      <article class="card">
        <div class="field"><span class="lab">S</span><div class="inp area">Nyeri gigit di rahang kiri atas. Tidak alergi obat.</div></div>
        <div class="field"><span class="lab">O</span><div class="inp area">Gigi 26 karies dentin O, M.</div></div>
        <div class="field"><span class="lab">A</span><div class="inp area">Karies dentin 26.</div></div>
        <div class="field"><span class="lab">P</span><div class="inp area">Restorasi komposit 26. Kontrol 7 hari.</div></div>
      </article>
      {btn("Simpan", "pri")}
    """
    ph = phone(ph_inner, "SOAP", 800, "RM")
    body = f'<div class="row">{frame_d}{ph}</div>'
    return ab(
        "05",
        "Frasa cepat SOAP",
        "KlinikMe punya SOAP dan CPPT, frasa cepat tidak terverifikasi. Bittodent belum punya makro. Satu ketuk mengisi kolom, dokter tetap bisa mengubah.",
        body,
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
          <div class="lab" style="margin-bottom:6px">Permukaan</div>
          <div class="surf">{surf}</div>
          <div class="lab" style="margin:12px 0 6px">Kondisi</div>
          <div class="phrases">{cond}</div>
          <div class="actions">
            {btn("Batal", "ghost")}
            {btn("Simpan 26", "pri", "check")}
          </div>
        </article>
      </div>
    </div>"""
    frame = desk(body, "Odontogram cepat", "Budi Santoso", "RM", "Nadia Putri", "dokter")
    return ab(
        "06",
        "Input odontogram cepat",
        "KlinikMe sudah memasarkan odontogram interaktif. Bittodent punya 2D dan 3D; alur ketuk cepat (gigi, permukaan, kondisi) masih perlu diperketat agar setara dalam kecepatan catat.",
        frame,
    )


def ab07() -> str:
    item = lambda n, d, draf=True: f"""
      <div class="rx">
        <div><div class="nm">{n}</div><div class="ds">{d}</div></div>
        {chip("Draf", "draf") if draf else chip("Disetujui", "ok")}
      </div>"""
    inner = f"""
      <div class="banner warn">{ico("alert", "ic-sm")} AI tidak meresepkan. Dokter memilih template, lalu Setujui dan Selesai.</div>
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
        <div class="actions">
          {btn("Cetak", "ghost", "printer")}
          {btn("Setujui", "pri", "check")}
        </div>
        <p class="mu" style="margin:10px 0 0">Selesai (tanda tangan) setelah Setujui. MVP tetap bisa cetak kertas.</p>
      </article>
    """
    ph = phone(inner, "Resep", 760, "RM")
    return ab(
        "07",
        "e-resep cepat",
        "KlinikMe menyebut e-resep di FAQ; kedalaman UX tidak terverifikasi. Bittodent masih kerangka, MVP resep kertas (D-036). Template obat gigi, draf sampai Setujui. AI tidak mengisi resep.",
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
          <div class="mu" style="margin:8px 0">Hash dokumen akan disimpan. Bukan TTE tersertifikasi.</div>
          <div class="actions">
            {btn("Ulangi", "ghost")}
            {btn("Setujui dan simpan", "pri", "stamp")}
          </div>
        </article>
      </div>
    </div>"""
    frame = desk(body, "Informed consent", "Budi Santoso · gigi 38", "RM", "Nadia Putri", "dokter")
    return ab(
        "08",
        "Informed consent digital",
        "KlinikMe sudah menandatangani formulir secara digital. Bittodent punya rekam consent (D-012), alur pad tanda tangan belum. Wali wajib jika pasien anak. Fitur tanpa izin disembunyikan.",
        frame,
    )


def ab09() -> str:
    body = f"""
    <div class="desk-body">
      <div class="split-5" style="flex:1">
        <article class="card">
          <h3>Gigi 26</h3>
          {odonto("26")}
          <p class="mu" style="margin:10px 0 0">Foto menempel pada nomor gigi dan kunjungan, bukan galeri wajah.</p>
        </article>
        <article class="card">
          <h3>Sebelum dan sesudah {chip("26", "isi")}</h3>
          <div class="ba">
            <div class="well has">{ico("image", "ic-lg")}<span>Sebelum · 15 Nov 2026</span><span class="mu">Karies O, M</span></div>
            <div class="well">{ico("camera", "ic-lg")}<span>Sesudah</span><span class="mu">Ambil atau unggah setelah restorasi</span></div>
          </div>
          <div class="actions">
            {btn("Ambil foto sesudah", "pri", "camera")}
          </div>
        </article>
      </div>
    </div>"""
    frame = desk(body, "Foto per gigi", "Budi Santoso · kunjungan hari ini", "RM", "Nadia Putri", "dokter")
    return ab(
        "09",
        "Foto before-after per gigi",
        "KlinikMe punya Preview Before-After; visual pemasaran di /produk berupa wajah, dan teks pendukung juga membingkai klinik kecantikan. Per gigi tidak terverifikasi. Bittodent belum punya. Usulan: foto di nomor gigi.",
        frame,
    )


def ab10() -> str:
    data = [
        ("Scan KTP", "Ada", "ada", "Sebagian", "sebagian",
         "Pindai ke draf, NIK mask, verifikasi resepsionis. Foto KTP disimpan terenkripsi di profil, hanya peran berizin yang dapat membuka."),
        ("Saran ICD dari catatan", "Sebagian", "sebagian", "Sebagian", "sebagian",
         "Saran Draf dari catatan, Setujui, lalu Selesai. KlinikMe: pencarian dan standarisasi; saran dari SOAP tidak terverifikasi."),
        ("Draf SOAP dari suara", "Belum", "belum", "Sebagian", "sebagian",
         "Scribe merapikan ucapan. Mikrofon selalu ada untuk dokter. Audio hapus setelah Selesai."),
        ("Saran tindakan dari odontogram", "Belum", "belum", "Belum", "belum",
         "Saran dari temuan di chart, Draf sampai Setujui, lalu Selesai."),
        ("Frasa cepat SOAP", "Belum", "belum", "Belum", "belum",
         "Satu ketuk mengisi kolom SOAP."),
        ("Odontogram cepat", "Ada", "ada", "Sebagian", "sebagian",
         "Ketuk gigi, permukaan, kondisi. 2D dan 3D Bittodent sudah ada."),
        ("e-resep cepat", "Sebagian", "sebagian", "Sebagian", "sebagian",
         "Template obat, Draf sampai Setujui. AI tidak meresepkan. KlinikMe hanya disebut di FAQ."),
        ("Consent tanda tangan", "Ada", "ada", "Sebagian", "sebagian",
         "Pad tablet, hash dokumen, wali jika anak."),
        ("Foto before-after per gigi", "Sebagian", "sebagian", "Belum", "belum",
         "KlinikMe: galeri umum, per gigi tidak terverifikasi. Usulan: foto di nomor gigi."),
    ]
    rows = []
    for feat, km, kms, bt, bts, use in data:
        rows.append(
            "<tr><td class='ft'>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>".format(
                feat, chip(km, kms), chip(bt, bts), use
            )
        )
    table = """
    <div class="desk" style="height:auto;min-height:720px;width:1280px;display:block;padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div><h2 style="margin:0;font-size:16px">Ringkasan gap · klinik gigi</h2>
          <div class="crumb">Sumber publik KlinikMe, 15 Nov 2026, WIB. Bittodent dari repo dan papan.</div></div>
        {syn}
      </div>
      <div class="legend">{leg}
        <span>Yang tidak terverifikasi dari halaman publik dicatat di usulan.</span>
      </div>
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
