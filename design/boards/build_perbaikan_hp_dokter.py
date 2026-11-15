#!/usr/bin/env python3
"""Papan desain perbaikan audit HP dokter.

Sumber temuan: /workspace/audit/mobile-dokter/audit.md
Hasil: design/boards/perbaikan-hp-dokter.html
dan /workspace/artifacts/bittodent-board-perbaikan-hp-dokter.html
Data sintetis. Tanpa JavaScript. Tidak mengubah kode app.
"""
from __future__ import annotations

import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "design/boards/perbaikan-hp-dokter.html"
ART = Path("/workspace/artifacts/bittodent-board-perbaikan-hp-dokter.html")
TOKENS = (ROOT / "design/tokens.css").read_text()
SEB = Path("/workspace/audit/perbaikan-hp-dokter/sebelum")

ICONS: dict[str, str] = {
    "calendar": (
        '<rect x="3" y="4" width="18" height="18" rx="2"/>'
        '<path d="M16 2v4M8 2v4M3 10h18"/>'
    ),
    "calendar-plus": (
        '<rect x="3" y="4" width="18" height="18" rx="2"/>'
        '<path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/>'
    ),
    "calendar-clock": (
        '<path d="M16 2v4M8 2v4M21 10.5V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/>'
        '<path d="M3 10h11"/>'
        '<circle cx="18" cy="18" r="4"/>'
        '<path d="M18 16.5V18l1 1"/>'
    ),
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "x": '<path d="M18 6 6 18M6 6l12 12"/>',
    "x-circle": (
        '<circle cx="12" cy="12" r="10"/>'
        '<path d="M15 9l-6 6M9 9l6 6"/>'
    ),
    "chevron-down": '<path d="M6 9l6 6 6-6"/>',
    "chevron-up": '<path d="M18 15l-6-6-6 6"/>',
    "chevron-right": '<path d="M9 18l6-6-6-6"/>',
    "chevron-left": '<path d="M15 18l-6-6 6-6"/>',
    "phone": (
        '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 '
        '19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 '
        '0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 '
        '6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>'
    ),
    "message-circle": '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>',
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
    "user-x": (
        '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>'
        '<circle cx="9" cy="7" r="4"/>'
        '<path d="M17 8l5 5M22 8l-5 5"/>'
    ),
    "home": (
        '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>'
    ),
    "wallet": (
        '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>'
        '<path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>'
        '<path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>'
    ),
    "banknote": (
        '<rect x="2" y="6" width="20" height="12" rx="2"/>'
        '<circle cx="12" cy="12" r="2"/>'
        '<path d="M6 12h.01M18 12h.01"/>'
    ),
    "clock": (
        '<circle cx="12" cy="12" r="10"/>'
        '<path d="M12 6v6l4 2"/>'
    ),
    "chair": (
        '<path d="M6 10V7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3"/>'
        '<path d="M4 11h16v2a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z"/>'
        '<path d="M6 16v3M18 16v3M8 19h8"/>'
    ),
    "play": (
        '<circle cx="12" cy="12" r="10"/>'
        '<path d="M10 8.5v7l6-3.5z"/>'
    ),
    "layout-list": (
        '<rect x="3" y="3" width="7" height="7" rx="1"/>'
        '<rect x="3" y="14" width="7" height="7" rx="1"/>'
        '<path d="M14 4h7M14 9h7M14 15h7M14 20h7"/>'
    ),
    "layout-grid": (
        '<rect x="3" y="3" width="7" height="7" rx="1"/>'
        '<rect x="14" y="3" width="7" height="7" rx="1"/>'
        '<rect x="14" y="14" width="7" height="7" rx="1"/>'
        '<rect x="3" y="14" width="7" height="7" rx="1"/>'
    ),
    "refresh": (
        '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>'
        '<path d="M21 3v5h-5"/>'
        '<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>'
        '<path d="M8 16H3v5"/>'
    ),
    "cloud-off": (
        '<path d="M2 2l20 20"/>'
        '<path d="M10 5a5 5 0 0 1 8.9 2.3A4.5 4.5 0 0 1 20.5 16"/>'
        '<path d="M7 7a5.1 5.1 0 0 0-3.1 8.3A4 4 0 0 0 6 20h11"/>'
    ),
    "inbox": (
        '<path d="M22 12h-6l-2 3h-4l-2-3H2"/>'
        '<path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'
    ),
    "more": (
        '<circle cx="6" cy="12" r="1.15" fill="currentColor" stroke="none"/>'
        '<circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"/>'
        '<circle cx="18" cy="12" r="1.15" fill="currentColor" stroke="none"/>'
    ),
    "alert": (
        '<circle cx="12" cy="12" r="10"/>'
        '<path d="M12 8v4M12 16h.01"/>'
    ),
    "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',

    "search": '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    "bell": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.22 21a2 2 0 0 0 3.56 0"/>',
    "pill": '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
    "spark": '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
    "settings": (
        '<circle cx="12" cy="12" r="3"/>'
        '<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>'
    ),
    "tooth": '<path d="M8 4.5C8 3.1 9.6 2 12 2s4 1.1 4 2.5c0 .7-.2 1.4-.5 2 1.7.3 3 1.6 3.2 3.6.4 3.2-1 7.2-2.8 9.2-.6.7-1.7.3-1.7-.6 0-1.8-.3-3.2-.7-4.1-.3-.6-.9-.8-1.5-.4-.4.2-.8.2-1.2 0-.6-.4-1.2-.2-1.5.4-.4.9-.7 2.3-.7 4.1 0 .9-1.1 1.3-1.7.6-1.8-2-3.2-6-2.8-9.2.2-2 1.5-3.3 3.2-3.6-.3-.6-.5-1.3-.5-2z"/>',
}


def ico(name: str, cls: str = "ic") -> str:
    return (
        f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        f'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" '
        f'aria-hidden="true">{ICONS[name]}</svg>'
    )


def data_uri(path: Path) -> str:
    raw = path.read_bytes()
    return "data:image/jpeg;base64," + base64.b64encode(raw).decode()


def before(name: str, cap: str = "Sekarang · 360") -> str:
    uri = data_uri(SEB / f"{name}.jpg")
    return (
        f'<figure class="before"><img src="{uri}" alt="{cap}"/>'
        f"<figcaption>{cap}</figcaption></figure>"
    )


def initials(name: str) -> str:
    parts = [p for p in name.replace("drg.", "").split() if p]
    return "".join(p[0] for p in parts[:2]).upper()


def av(name: str, tone: str = "") -> str:
    cls = f" av-{tone}" if tone else ""
    return f'<span class="av{cls}" aria-hidden="true">{initials(name)}</span>'


def chip(label: str, kind: str) -> str:
    return f'<span class="chip st-{kind}">{label}</span>'


def btn(label: str, kind: str = "pri", icon: str | None = None, disabled: bool = False, wide: bool = False) -> str:
    ic = ico(icon, "ic-btn") if icon else ""
    cls = f"btn {kind}"
    if disabled:
        cls += " dis"
    if wide:
        cls += " wide"
    aria = ' aria-disabled="true"' if disabled else ""
    typ = ' type="button"'
    return f'<button class="{cls}"{typ}{aria}>{ic}{label}</button>'


def syn() -> str:
    return '<span class="syn">DATA SINTETIS</span>'


def bnav(active: str = "Beranda") -> str:
    items = [
        ("Beranda", "home"),
        ("Jadwal", "calendar"),
        ("Pasien", "users"),
        ("RM", "tooth"),
        ("Lainnya", "more"),
    ]
    out = []
    for lab, icon in items:
        on = " on" if lab == active or (lab == "RM" and active == "Rekam Medis") else ""
        # show "Rekam Medis" as label for RM to match product, but short in 360? Audit uses full "Rekam Medis". Use short RM? The current app uses "Rekam Medis". I'll use "RM" for 5-item fit or "Rekam Medis" smaller font.
        show = "Rekam Medis" if lab == "RM" else lab
        out.append(
            f'<button class="navi{on}" type="button">'
            f'<span class="navi-ic">{ico(icon)}</span><span>{show}</span></button>'
        )
    return f'<nav class="bnav">{"".join(out)}</nav>'


def phone(
    inner: str,
    height: int = 800,
    nav: str = "Beranda",
    fab: bool = False,
    overlay: str = "",
) -> str:
    fab_html = (
        f'<button class="fab" type="button" aria-label="Buat">{ico("plus", "ic-fab")}</button>'
        if fab
        else ""
    )
    return f"""
    <div class="ph" style="height:{height}px">
      <div class="ph-bar">{syn()}<span class="ph-time">20.08</span></div>
      {inner}
      {fab_html}
      {bnav(nav)}
      {overlay}
    </div>"""


def after_col(inner: str, cap: str = "Usulan · 360") -> str:
    return f'<figure class="after">{inner}<figcaption>{cap}</figcaption></figure>'


def topbar(title: str = "", back: bool = False, search: bool = False, plus: bool = False, user: str = "Arif Hidayat") -> str:
    left = ""
    if back:
        left = f'<button class="icon-btn" type="button" aria-label="Kembali">{ico("chevron-left")}</button>'
        mid = f'<h1 class="h-sm">{title}</h1>' if title else ""
    else:
        mid = (
            f'<div class="brand-mini"><span class="logo" aria-hidden="true">{ico("tooth", "ic")}</span>'
            f"<span>Senyum Sehat</span></div>"
        )
    right = '<div class="hd-right">'
    if search:
        right += f'<button class="icon-btn" type="button" aria-label="Cari pasien">{ico("search")}</button>'
    if plus:
        right += f'<button class="icon-btn plus-btn" type="button" aria-label="Buat">{ico("plus")}</button>'
    right += av(user, "me") + "</div>"
    return f'<header class="hd">{left}{mid}{right}</header>'


def rm_head(name: str = "Budi Santoso", meta: str = "66 th · Perempuan · BT-000001", compact: bool = True) -> str:
    # compact: name + meta one block, ⋯ does not overlap RM number
    return f"""
    <header class="rm-hd">
      <div class="rm-hd-row">
        <button class="icon-btn" type="button" aria-label="Kembali">{ico("chevron-left")}</button>
        <div class="rm-id">
          <div class="card-name">{name}</div>
          <div class="card-meta">{meta}</div>
        </div>
        <button class="icon-btn" type="button" aria-label="Lainnya">{ico("more")}</button>
      </div>
    </header>"""


def tabs(items: list[tuple[str, bool]]) -> str:
    bits = []
    for lab, on in items:
        cls = " tab on" if on else " tab"
        bits.append(f'<button class="{cls}" type="button">{lab}</button>')
    return f'<div class="tabs">{"".join(bits)}</div>'


# Doctor RM tabs: Billing hidden
TABS_ODO = tabs([("Odontogram", True), ("Catatan", False), ("Rencana", False), ("Resep", False)])
TABS_CAT = tabs([("Odontogram", False), ("Catatan", True), ("Rencana", False), ("Resep", False)])
TABS_REN = tabs([("Odontogram", False), ("Catatan", False), ("Rencana", True), ("Resep", False)])
TABS_RES = tabs([("Odontogram", False), ("Catatan", False), ("Rencana", False), ("Resep", True)])


def alert_chips() -> str:
    return (
        '<div class="alerts">'
        + chip("Premedikasi", "warn")
        + chip("Alergi · Penisilin", "danger")
        + chip("Alergi · Lateks", "danger")
        + chip("Warfarin", "warn")
        + chip("Katup jantung", "info")
        + "</div>"
    )


def visit_pill() -> str:
    return '<div class="visit-pill">' + chip("Merawat · 17.52", "merawat") + "</div>"


CSS = r"""
*{box-sizing:border-box}
html,body{margin:0;background:#E8EEF0;color:var(--color-neutral-800);
  font-family:var(--font-family-sans);-webkit-font-smoothing:antialiased}
body{padding:48px 40px 80px}
.wrap{max-width:1280px;margin:0 auto}
h1.page{font-size:28px;font-weight:700;letter-spacing:-.02em;margin:0 0 4px;color:var(--color-neutral-900)}
.lede{margin:0 0 36px;color:var(--color-neutral-600);font-size:14px;font-weight:500}
.ab{margin:0 0 64px;width:max-content;max-width:100%}
.ab-k{display:flex;align-items:baseline;gap:12px;margin:0 0 8px}
.ab-n{font-size:12px;font-weight:700;letter-spacing:.08em;color:var(--color-primary-700);text-transform:uppercase}
.ab-t{font-size:16px;font-weight:650;color:var(--color-neutral-800)}
.ab-d{font-size:12px;font-weight:500;color:var(--color-neutral-500);margin:0 0 14px;max-width:720px}
.row{display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap}
.before,.after{margin:0;display:flex;flex-direction:column;gap:8px}
.before img{width:180px;height:auto;border-radius:16px;border:1px solid var(--color-neutral-200);
  display:block;background:#fff}
figcaption{font-size:12px;font-weight:600;color:var(--color-neutral-500)}
.pair{display:flex;flex-direction:column;gap:16px}

.ph{width:360px;background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);
  border-radius:24px;overflow:hidden;position:relative;display:flex;flex-direction:column;flex:none}
.ph-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 16px 0;min-height:28px;
  background:var(--color-neutral-0)}
.ph-time{font-size:12px;font-weight:600;color:var(--color-neutral-700)}
.syn{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;
  background:#FFFAEB;color:#B54708;border:1px solid #F5C14A;font-size:10px;font-weight:700;letter-spacing:.04em}
.hd{background:var(--color-neutral-0);padding:0 8px 8px 8px;display:flex;align-items:center;
  justify-content:space-between;min-height:44px;gap:8px}
.brand-mini{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:var(--color-neutral-800);padding-left:8px}
.brand-mini .logo{width:28px;height:28px;border-radius:8px;background:var(--color-primary-700);color:#fff;
  display:grid;place-items:center}
.brand-mini .logo .ic{width:16px;height:16px}
.h-sm{margin:0;font-size:16px;font-weight:700;flex:1}
.hd-right{display:flex;align-items:center;gap:2px}
.ph-body{flex:1;background:var(--color-canvas);padding:8px 16px 88px;display:flex;flex-direction:column;gap:8px}
.ph-body.tight{padding-top:4px}
.page-h{margin:0;font-size:20px;font-weight:700;letter-spacing:-.02em;color:var(--color-neutral-900)}
.sub{font-size:12px;font-weight:600;color:var(--color-neutral-500)}
.sum{display:flex;align-items:center;gap:8px;height:36px;max-height:40px;font-size:13px;font-weight:600;
  color:var(--color-neutral-700)}
.sum b{font-weight:700;color:var(--color-neutral-900)}

.card{display:flex;align-items:stretch;gap:8px;min-height:72px;background:var(--color-neutral-0);
  border:1px solid var(--color-neutral-200);border-radius:16px;padding:10px 10px 10px 12px}
.card-time{flex:0 0 42px;font-size:13px;font-weight:700;color:var(--color-neutral-800);padding-top:4px}
.card-body{flex:1;min-width:0}
.card-top{display:flex;align-items:flex-start;gap:8px}
.card-txt{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:2px}
.card-name{font-size:14px;font-weight:700;color:var(--color-neutral-900);line-height:1.25}
.card-meta{font-size:12px;font-weight:500;color:var(--color-neutral-500);line-height:1.3}
.card-act{display:flex;align-items:center}
.av{width:32px;height:32px;border-radius:99px;display:grid;place-items:center;flex:0 0 32px;
  background:var(--color-primary-100);color:var(--color-primary-800);font-size:11px;font-weight:700}
.av-me{background:var(--color-neutral-100);color:var(--color-neutral-700);width:36px;height:36px;
  flex-basis:36px;font-size:12px}
.av-off{background:var(--color-neutral-100);color:var(--color-neutral-500)}
.chip{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:999px;
  font-size:11px;font-weight:700;white-space:nowrap}
.st-warn{background:var(--color-warning-bg);color:var(--color-warning-fg)}
.st-danger{background:var(--color-danger-bg);color:var(--color-danger-fg)}
.st-info{background:var(--color-info-bg);color:var(--color-info-fg)}
.st-pay{background:var(--color-warning-bg);color:var(--color-warning-fg)}
.st-terjadwal{background:var(--color-appointment-terjadwal-bg);color:var(--color-appointment-terjadwal-fg)}
.st-checkin{background:var(--color-appointment-checkin-bg);color:var(--color-appointment-checkin-fg)}
.st-merawat{background:var(--color-appointment-merawat-bg);color:var(--color-appointment-merawat-fg)}
.st-selesai{background:var(--color-appointment-selesai-bg);color:var(--color-appointment-selesai-fg)}
.st-draf{background:#FFF6E5;color:#9A6700}
.st-ai{background:var(--color-appointment-checkin-bg);color:var(--color-appointment-checkin-fg)}
.btn{height:44px;padding:0 12px;border-radius:12px;border:0;font:inherit;font-size:12px;font-weight:700;
  display:inline-flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap;min-width:44px}
.btn.pri{background:var(--color-primary-700);color:#fff}
.btn.sec{background:var(--color-neutral-0);color:var(--color-primary-800);border:1px solid var(--color-primary-200)}
.btn.ghost{background:var(--color-neutral-50);color:var(--color-neutral-700);border:1px solid var(--color-neutral-200)}
.btn.dis{background:var(--color-neutral-100);color:var(--color-neutral-400);border:1px solid var(--color-neutral-200)}
.btn.wide{width:100%}
.ic-btn{width:16px;height:16px}
.icon-btn{width:44px;height:44px;border:0;background:transparent;color:var(--color-neutral-600);
  display:grid;place-items:center;border-radius:12px;padding:0}
.icon-btn .ic{width:20px;height:20px}
.plus-btn{background:var(--color-primary-700);color:#fff;width:36px;height:36px;border-radius:99px;margin:0 4px}
.plus-btn .ic{width:18px;height:18px}

.rm-hd{background:var(--color-neutral-0);padding:0 8px 8px}
.rm-hd-row{display:flex;align-items:center;gap:4px;min-height:52px}
.rm-id{flex:1;min-width:0}
.alerts{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px}
.alert-row{display:flex;align-items:center;gap:8px;padding:0 16px 8px}
.visit-pill{padding:0 16px 8px}

.tabs{display:flex;gap:0;background:var(--color-neutral-0);border-bottom:1px solid var(--color-neutral-100);
  padding:0 8px;overflow:hidden}
.tab{height:44px;padding:0 12px;border:0;background:transparent;font:inherit;font-size:13px;font-weight:600;
  color:var(--color-neutral-500);border-bottom:2px solid transparent;white-space:nowrap}
.tab.on{color:var(--color-primary-700);border-bottom-color:var(--color-primary-700)}

.fab{position:absolute;right:16px;bottom:80px;width:56px;height:56px;border-radius:99px;border:0;
  background:var(--color-primary-700);color:#fff;display:grid;place-items:center;
  box-shadow:0 8px 20px rgba(11,107,98,.28)}
.ic-fab{width:24px;height:24px}
.bnav{position:absolute;left:0;right:0;bottom:0;height:64px;background:var(--color-neutral-0);
  border-top:1px solid var(--color-neutral-200);display:grid;grid-template-columns:repeat(5,1fr);padding:0 2px}
.navi{border:0;background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:2px;font:inherit;font-size:9px;font-weight:600;color:var(--color-neutral-500);min-height:44px;padding:0 1px}
.navi .ic{width:20px;height:20px}
.navi.on{color:var(--color-primary-700)}
.navi-ic{display:grid;place-items:center}

.scrim{position:absolute;inset:0;background:rgba(22,33,43,.4);z-index:3}
.sheet{position:absolute;left:0;right:0;bottom:0;background:var(--color-neutral-0);
  border-radius:20px 20px 0 0;z-index:4;padding:10px 16px 24px;max-height:78%;
  box-shadow:0 -8px 24px rgba(22,33,43,.08)}
.sheet-handle{width:36px;height:4px;border-radius:99px;background:var(--color-neutral-200);margin:4px auto 12px}
.sheet h2{margin:0 0 8px;font-size:16px;font-weight:700}
.sheet p{margin:0 0 8px;font-size:13px;font-weight:500;color:var(--color-neutral-700);line-height:1.45}
.sheet-pad{padding-bottom:16px}

.sticky-act{position:absolute;left:0;right:0;bottom:64px;background:var(--color-neutral-0);
  border-top:1px solid var(--color-neutral-200);padding:8px 16px;display:flex;gap:8px;z-index:2}
.sticky-act .btn{flex:1}

.field{display:flex;flex-direction:column;gap:4px;margin:0 0 8px}
.field label{font-size:12px;font-weight:600;color:var(--color-neutral-600)}
.inp{height:44px;border:1px solid var(--color-neutral-200);border-radius:12px;padding:0 12px;
  font:inherit;font-size:14px;background:#fff;color:var(--color-neutral-800);display:flex;align-items:center;gap:8px}
.inp .ic{width:16px;height:16px;color:var(--color-neutral-400)}
.inp.num{font-variant-numeric:tabular-nums;letter-spacing:.02em}
.filts{display:flex;gap:8px;flex-wrap:wrap}
.filt{height:44px;padding:0 14px;border-radius:999px;border:1px solid var(--color-neutral-200);
  background:var(--color-neutral-0);font:inherit;font-size:13px;font-weight:600;color:var(--color-neutral-700);min-width:44px}
.filt.on{background:var(--color-primary-700);color:#fff;border-color:var(--color-primary-700)}

.odo{background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);border-radius:16px;padding:10px}
.odo-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.odo-sum{font-size:12px;font-weight:700;color:var(--color-neutral-700)}
.odo-chrome{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--color-neutral-500);
  margin-bottom:8px}
.odo-chrome span.sep{color:var(--color-neutral-300)}
.arch{display:flex;flex-direction:column;gap:4px;margin:4px 0}
.arch-lab{font-size:10px;font-weight:700;letter-spacing:.04em;color:var(--color-neutral-400);text-align:center}
.teeth{display:flex;justify-content:center;gap:2px}
.teeth .gap{width:6px;flex:0 0 6px}
.tooth-n{width:18px;height:26px;border-radius:5px;border:1px solid var(--color-neutral-200);
  background:var(--color-neutral-25);display:flex;flex-direction:column;align-items:center;justify-content:center;
  font-size:8px;font-weight:700;color:var(--color-neutral-600);position:relative}
.tooth-n.karies{background:var(--color-warning-bg);border-color:#F5C14A;color:var(--color-warning-fg)}
.tooth-n.cabut{background:var(--color-danger-bg);border-color:#FDA29B;color:var(--color-danger-fg)}
.tooth-n.draf{background:var(--color-appointment-checkin-bg);border-color:#9A6BD6;color:var(--color-appointment-checkin-fg)}
.prob{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.prob-row{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 10px;border-radius:12px;
  background:var(--color-neutral-25);border:1px solid var(--color-neutral-100);font-size:13px;font-weight:600}
.prob-row b{font-variant-numeric:tabular-nums}

.surf{display:grid;grid-template-columns:44px 44px 44px;grid-template-rows:44px 44px 44px;gap:6px;
  width:150px;margin:12px auto}
.surf button{width:44px;height:44px;border-radius:10px;border:1px solid var(--color-neutral-200);
  background:#fff;font:inherit;font-size:12px;font-weight:700;color:var(--color-neutral-700)}
.surf button.on{background:var(--color-primary-700);color:#fff;border-color:var(--color-primary-700)}
.surf .s-p{grid-column:2;grid-row:1}
.surf .s-m{grid-column:1;grid-row:2}
.surf .s-o{grid-column:2;grid-row:2}
.surf .s-d{grid-column:3;grid-row:2}
.surf .s-l{grid-column:2;grid-row:3}

.soap{display:flex;flex-direction:column;gap:8px}
.soap-b{background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);border-radius:12px;padding:10px 12px}
.soap-b h3{margin:0 0 4px;font-size:12px;font-weight:700;color:var(--color-neutral-500);letter-spacing:.04em}
.soap-b p{margin:0;font-size:14px;font-weight:500;color:var(--color-neutral-800);line-height:1.4}
.fold{display:flex;align-items:center;justify-content:space-between;min-height:44px;padding:0 12px;
  background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);border-radius:12px;
  font-size:13px;font-weight:600;color:var(--color-neutral-600)}

.rx-item,.plan-item{background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);
  border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:4px}
.rx-item h3,.plan-item h3{margin:0;font-size:14px;font-weight:700}
.plan-phase{font-size:12px;font-weight:700;color:var(--color-neutral-500);margin:8px 0 0}
.total{display:flex;justify-content:space-between;align-items:center;padding:12px;
  background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);border-radius:16px;
  font-size:16px;font-weight:700}

.hit{background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);border-radius:16px;
  padding:12px;display:flex;gap:10px;align-items:flex-start;min-height:72px}
.hit .meta2{font-size:12px;font-weight:500;color:var(--color-neutral-500);line-height:1.35}
.note{font-size:12px;font-weight:500;color:var(--color-neutral-600);max-width:200px;margin:0}

table.sumt{border-collapse:separate;border-spacing:0;background:#fff;border:1px solid var(--color-neutral-200);
  border-radius:16px;overflow:hidden;font-size:13px;min-width:720px}
.sumt th{text-align:left;font-size:11px;font-weight:700;color:var(--color-neutral-500);letter-spacing:.04em;
  text-transform:uppercase;padding:10px 12px;border-bottom:1px solid var(--color-neutral-200);background:var(--color-neutral-25)}
.sumt td{padding:9px 12px;border-bottom:1px solid var(--color-neutral-100);vertical-align:top}
.sumt tr:last-child td{border-bottom:0}
.lv{display:inline-flex;align-items:center;height:20px;padding:0 6px;border-radius:6px;font-size:11px;font-weight:700}
.lv-p0{background:var(--color-danger-bg);color:var(--color-danger-fg)}
.lv-p1{background:var(--color-warning-bg);color:var(--color-warning-fg)}
.lv-p2{background:var(--color-neutral-100);color:var(--color-neutral-600)}
.lv-ok{background:var(--color-success-bg);color:var(--color-success-fg)}

.ic{width:20px;height:20px;display:block}
.search-pop{padding:8px 16px 16px;background:var(--color-neutral-0);border-bottom:1px solid var(--color-neutral-100)}
"""


def odontogram() -> str:
    upper = list(range(18, 10, -1)) + list(range(21, 29))
    lower = list(range(48, 40, -1)) + list(range(31, 39))
    marks = {16: "karies", 26: "karies", 38: "cabut", 11: "draf"}

    def row(nums: list[int]) -> str:
        cells = []
        for i, n in enumerate(nums):
            if i == 8:
                cells.append('<span class="gap"></span>')
            kind = marks.get(n, "")
            cls = f" tooth-n {kind}" if kind else " tooth-n"
            cells.append(f'<span class="{cls}">{n}</span>')
        return f'<div class="teeth">{"".join(cells)}</div>'

    probs = [
        ("16", "Karies", "warn"),
        ("26", "Karies", "warn"),
        ("38", "Perlu dicabut", "danger"),
        ("11", "Draf AI", "ai"),
    ]
    rows = "".join(
        f'<button class="prob-row" type="button"><b>{n}</b><span>{lab}</span>{chip(lab if lab!="Draf AI" else "Draf AI", k)}</button>'
        for n, lab, k in probs
    )
    # chip duplicates label - simplify
    rows = "".join(
        f'<button class="prob-row" type="button"><b>{n}</b><span style="flex:1">{lab}</span>{ico("chevron-right","ic-btn")}</button>'
        for n, lab, k in probs
    )
    return f"""
    <div class="odo">
      <div class="odo-head">
        <div class="odo-sum">2 karies · 1 perlu dicabut</div>
        <div>{chip("Draf", "draf")}{chip("Draf AI", "ai")}</div>
      </div>
      <div class="odo-chrome"><span>Hari ini</span><span class="sep">·</span><span>Tetap</span>
        <span class="sep">·</span><span>2D</span></div>
      <div class="arch"><div class="arch-lab">RAHANG ATAS</div>{row(upper)}</div>
      <div class="arch"><div class="arch-lab">RAHANG BAWAH</div>{row(lower)}</div>
      <div class="prob">{rows}</div>
    </div>"""


def appt_card(time: str, name: str, meta: str, status: str, kind: str, action: str | None, akind: str = "sec", aicon: str | None = None) -> str:
    act = btn(action, akind, aicon) if action else ""
    return f"""
    <article class="card">
      <div class="card-time">{time}</div>
      <div class="card-body">
        <div class="card-top">
          {av(name)}
          <div class="card-txt">
            <div class="card-name">{name}</div>
            <div class="card-meta">{meta}</div>
            {chip(status, kind)}
          </div>
        </div>
      </div>
      <div class="card-act">{act}</div>
    </article>"""


def ab(num: str, title: str, desc: str, body: str) -> str:
    return f"""
    <section class="ab" id="ab-{num}">
      <div class="ab-k"><span class="ab-n">{num}</span><span class="ab-t">{title}</span></div>
      <p class="ab-d">{desc}</p>
      {body}
    </section>"""


# ---------- artboards ----------

# 01 Beranda
patients = [
    appt_card("09.00", "Budi Santoso", "Kontrol 15 · Kursi 1", "Check-in", "checkin", "Mulai kunjungan", "pri", "play"),
    appt_card("10.40", "Joko Wijaya", "Kontrol · Kursi 2", "Terjadwal", "terjadwal", "Buka RM", "sec", "file-text"),
    appt_card("12.20", "Hendra Hidayat", "Kontrol · Kursi 3", "Terjadwal", "terjadwal", "Buka RM", "sec", "file-text"),
    appt_card("13.10", "Dewi Kusuma", "Scaling · Kursi 1", "Terjadwal", "terjadwal", "Buka RM", "sec", "file-text"),
]
body01 = (
    topbar(search=True, plus=True)
    + '<div class="ph-body">'
    + '<h1 class="page-h">Pasien saya hari ini</h1>'
    + '<div class="sub">Minggu, 15 Nov</div>'
    + '<div class="sum"><b>4</b> janji<span>·</span><b>1</b> hadir</div>'
    + "".join(patients)
    + "</div>"
)
ph01 = phone(body01, height=800, nav="Beranda", fab=False)
# plus is in topbar already

ab01 = ab(
    "01",
    "Beranda dokter",
    "Lipatan pertama: Pasien saya hari ini, jam, kursi, status, dan aksi. KPI pendapatan disembunyikan. Antrean kosong disembunyikan. Daftarkan / Buat janji di tombol +.",
    '<div class="row">'
    + before("beranda")
    + after_col(ph01)
    + "</div>",
)

# 02 Pita
ribbon = (
    rm_head()
    + '<div style="background:#fff;padding-bottom:4px">'
    + alert_chips()
    + '<div class="alert-row">'
    + btn("Selengkapnya", "ghost")
    + "</div>"
    + visit_pill()
    + "</div>"
    + TABS_ODO
    + '<div class="ph-body tight">'
    + odontogram()
    + "</div>"
)
ph02a = phone(ribbon, height=800, nav="Rekam Medis")

sheet02 = f"""
    <div class="scrim"></div>
    <div class="sheet" role="dialog" aria-label="Peringatan pasien">
      <div class="sheet-handle"></div>
      <h2>Peringatan</h2>
      {chip("Premedikasi", "warn")}
      <p style="margin-top:10px"><b>Konsultasi dokter jantung sebelum tindakan invasif</b> (contoh sintetis).</p>
      <p>Alergi: Penisilin, Lateks.</p>
      <p>Obat rutin: Warfarin (contoh sintetis).</p>
      <p>Kondisi: Katup jantung buatan (contoh sintetis).</p>
    </div>"""
ph02b = phone(ribbon, height=800, nav="Rekam Medis", overlay=sheet02)

ab02 = ab(
    "02",
    "Pita peringatan",
    "Chip alergi dan Warfarin tampil utuh. Pesan tidak terpotong. Selengkapnya 44px membuka sheet, bagan gigi tetap di lipatan.",
    '<div class="row">'
    + '<div class="pair">'
    + before("rm-pita", "Sekarang · pita terpotong")
    + before("rm-pita-buka", "Sekarang · pita dibuka, bagan terdorong")
    + "</div>"
    + after_col(ph02a, "Usulan · pita ringkas")
    + after_col(ph02b, "Usulan · detail di sheet")
    + "</div>",
)

# 03 RM 360 first fold: already have odontogram in 02; emphasize header + marked teeth
# 02 already shows odontogram in fold. 03 focuses on condensed header, problem teeth, tabs without Billing, 412 not required if 360 works.
# Keep 03 as the RM first-fold composition with slightly tighter header and problem teeth called out.
# Reuse same phone is OK but I want header showing full RM number (already) and no Billing tab.

ab03 = ab(
    "03",
    "RM 360, odontogram di lipatan",
    "Header diringkas, No. RM utuh, tab Billing disembunyikan. Chrome (legenda, dentisi, 2D/3D) jadi satu baris. Gigi bermasalah ditandai di bagan dan daftar 44px.",
    '<div class="row">'
    + before("rm-pita", "Sekarang · bagan di bawah lipatan")
    + after_col(ph02a, "Usulan · 360")
    + "</div>",
)

# 04 Input odontogram
sheet04 = f"""
    <div class="scrim"></div>
    <div class="sheet sheet-pad" role="dialog" aria-label="Gigi 16">
      <div class="sheet-handle"></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <h2>Gigi 16</h2>
          <div class="sub">Molar pertama kanan atas</div>
        </div>
        <button class="icon-btn" type="button" aria-label="Tutup">{ico("x")}</button>
      </div>
      <div class="sub" style="margin-top:8px">Dipilih: Bukal (B)</div>
      <div class="surf">
        <button class="s-p" type="button">P</button>
        <button class="s-m" type="button">M</button>
        <button class="s-o" type="button">O</button>
        <button class="s-d" type="button">D</button>
        <button class="s-l on" type="button">B</button>
      </div>
      <p class="sub" style="text-align:center;margin:0 0 8px">Tanpa kunjungan aktif</p>
      {btn("Mulai kunjungan", "pri", "play", wide=True)}
      <div style="height:8px"></div>
      {btn("Simpan ke kunjungan", "dis", disabled=True, wide=True)}
    </div>"""

# background RM faded
ph04a = phone(
    rm_head("Budi Santoso", "66 th · Perempuan · BT-000001") + TABS_ODO + '<div class="ph-body tight">' + odontogram() + "</div>",
    height=800,
    nav="Rekam Medis",
    overlay=sheet04,
)

# after visit started, same tooth, Simpan enabled
sheet04b = sheet04.replace(
    '<p class="sub" style="text-align:center;margin:0 0 8px">Tanpa kunjungan aktif</p>',
    '<p class="sub" style="text-align:center;margin:0 0 8px">Kunjungan aktif · tetap di gigi 16</p>',
).replace(
    btn("Mulai kunjungan", "pri", "play", wide=True),
    "",
).replace(
    btn("Simpan ke kunjungan", "dis", disabled=True, wide=True),
    btn("Simpan ke kunjungan", "pri", wide=True),
)
ph04b = phone(
    rm_head("Budi Santoso", "66 th · Perempuan · BT-000001") + TABS_ODO + '<div class="ph-body tight">' + odontogram() + "</div>",
    height=800,
    nav="Rekam Medis",
    overlay=sheet04b,
)

ab04 = ab(
    "04",
    "Input odontogram",
    "Setiap permukaan 44px. Tanpa kunjungan, Simpan abu-abu dan aria-disabled; satu CTA: Mulai kunjungan. Setelah mulai, tetap di gigi yang sama.",
    '<div class="row">'
    + before("rm-gigi", "Sekarang · Simpan tampak aktif")
    + after_col(ph04a, "Usulan · Simpan nonaktif")
    + after_col(ph04b, "Usulan · setelah Mulai")
    + "</div>",
)

# 05 SOAP
# A: no visit
empty_cat = (
    rm_head("Dewi Kusuma", "34 th · Perempuan · BT-000018")
    + TABS_CAT
    + '<div class="ph-body">'
    + '<div class="odo" style="text-align:center;padding:28px 16px">'
    + '<p class="page-h" style="font-size:16px;margin-bottom:8px">Belum ada kunjungan</p>'
    + btn("Mulai kunjungan", "pri", "play", wide=True)
    + "</div></div>"
)
ph05a = phone(empty_cat, height=800, nav="Rekam Medis")

soap_blocks = """
    <div class="soap">
      <div style="display:flex;align-items:center;gap:8px">{draf}{ai}</div>
      <div class="soap-b"><h3>S · Subjektif</h3><p>Gigi depan atas berlubang, nyeri saat mengunyah.</p></div>
      <div class="soap-b"><h3>O · Objektif</h3><p>Karies 16 dan 26. Gusi tenang.</p></div>
      <div class="soap-b"><h3>A · Asesmen</h3><p>Karies dentin 16, 26. Draf agen: 11.</p></div>
      <div class="soap-b"><h3>P · Rencana</h3><p>Tambalan komposit 16, 26. Cabut 38 pada fase 2.</p></div>
      <button class="fold" type="button">Tutup kunjungan {chev}</button>
    </div>
""".format(draf=chip("Draf", "draf"), ai=chip("Draf AI · perlu Setujui", "ai"), chev=ico("chevron-down", "ic-btn"))

sticky_setujui = (
    '<div class="sticky-act">'
    + btn("Simpan draf", "ghost")
    + btn("Setujui draf agen", "pri")
    + btn("Selesai", "dis", disabled=True)
    + "</div>"
)
ph05b = phone(
    rm_head() + TABS_CAT + f'<div class="ph-body tight" style="padding-bottom:148px">{soap_blocks}</div>',
    height=800,
    nav="Rekam Medis",
    overlay=sticky_setujui,
)

sticky_selesai = (
    '<div class="sticky-act">'
    + btn("Simpan draf", "ghost")
    + btn("Selesai", "pri")
    + "</div>"
)
soap_ok = soap_blocks.replace(chip("Draf", "draf") + chip("Draf AI · perlu Setujui", "ai"), chip("Disetujui", "selesai"))
ph05c = phone(
    rm_head() + TABS_CAT + f'<div class="ph-body tight" style="padding-bottom:148px">{soap_ok}</div>',
    height=800,
    nav="Rekam Medis",
    overlay=sticky_selesai,
)

ab05 = ab(
    "05",
    "SOAP dan aksi",
    "Tanpa kunjungan, Mulai kunjungan ada di tab Catatan. S/O/A/P ditumpuk satu gulir. Bar aksi menempel di atas nav. Setujui draf agen jadi primer; Selesai baru primer setelah disetujui. Tutup kunjungan terlipat.",
    '<div class="row">'
    + '<div class="pair">'
    + before("catatan-kosong", "Sekarang · Catatan tanpa Mulai")
    + before("soap-aksi", "Sekarang · Selesai tampak primer")
    + "</div>"
    + after_col(ph05a, "Usulan · Mulai di Catatan")
    + after_col(ph05b, "Usulan · Setujui primer")
    + after_col(ph05c, "Usulan · Selesai primer")
    + "</div>",
)

# 06 Resep
rx_form = f"""
    <div class="field"><label>Obat</label>
      <div class="inp">{ico("search")}<span>Amoxicillin</span></div></div>
    <div class="field"><label>Dosis</label>
      <div class="inp num">500&nbsp;&nbsp;<span class="sub">mg</span></div></div>
    <div class="field"><label>Frekuensi</label>
      <div class="filts">
        <button class="filt" type="button">1x</button>
        <button class="filt" type="button">2x</button>
        <button class="filt on" type="button">3x / hari</button>
        <button class="filt" type="button">4x</button>
      </div></div>
    <div class="field"><label>Durasi</label>
      <div class="filts">
        <button class="filt" type="button">3 hari</button>
        <button class="filt on" type="button">5 hari</button>
        <button class="filt" type="button">7 hari</button>
      </div></div>
    {btn("Tambah ke resep", "pri", wide=True)}
    <div class="rx-item" style="margin-top:8px">
      <h3>Amoxicillin 500 mg</h3>
      <div class="card-meta">3x / hari · 5 hari</div>
    </div>
    <div class="rx-item">
      <h3>Paracetamol 500 mg</h3>
      <div class="card-meta">3x / hari · 3 hari · bila nyeri</div>
    </div>
"""
ph06 = phone(
    rm_head() + TABS_RES + f'<div class="ph-body tight">{rx_form}</div>',
    height=800,
    nav="Rekam Medis",
)

ab06 = ab(
    "06",
    "Resep di HP",
    "Tab Resep hidup: cari obat, dosis dengan input numerik, frekuensi dan durasi sebagai chip, daftar resep. Budi memakai Warfarin, analgetik yang dipilih Paracetamol.",
    '<div class="row">'
    + before("resep", "Sekarang · Belum tersedia")
    + after_col(ph06)
    + "</div>",
)

# 07 Rencana
plan = f"""
    <div class="plan-phase">Fase 1</div>
    <div class="plan-item">
      <h3>Tambalan komposit</h3>
      <div class="card-meta">Gigi 16 · Bukal</div>
    </div>
    <div class="plan-item">
      <h3>Tambalan komposit</h3>
      <div class="card-meta">Gigi 26</div>
    </div>
    <div class="plan-phase">Fase 2</div>
    <div class="plan-item">
      <h3>Pencabutan</h3>
      <div class="card-meta">Gigi 38</div>
    </div>
    {btn("Tambah dari odontogram", "sec", "tooth", wide=True)}
    <div class="total"><span>Total</span><span>Rp 2.150.000</span></div>
"""
ph07 = phone(
    rm_head() + TABS_REN + f'<div class="ph-body tight">{plan}</div>',
    height=800,
    nav="Rekam Medis",
)

ab07 = ab(
    "07",
    "Rencana perawatan di HP",
    "Daftar tindakan per gigi, urut fase, total, dan tambah dari odontogram. Tab Billing tetap disembunyikan untuk dokter.",
    '<div class="row">'
    + before("rencana", "Sekarang · Belum tersedia")
    + after_col(ph07)
    + "</div>",
)

# 08 Cari & daftar
# A: search from topbar / results distinguishing two Sari
search_body = f"""
    {topbar(search=True, plus=True)}
    <div class="search-pop">
      <div class="inp">{ico("search")}<span>Sari</span></div>
    </div>
    <div class="ph-body tight">
      <div class="hit">
        {av("Sari Nugroho")}
        <div class="card-txt">
          <div class="card-name">Sari Nugroho</div>
          <div class="meta2">43 th · Laki-laki · BT-000020<br>Kunjungan terakhir 12 Okt 2026</div>
          {chip("Dalam perawatan", "merawat")}
        </div>
      </div>
      <div class="hit">
        {av("Sari Nugroho", "off")}
        <div class="card-txt">
          <div class="card-name">Sari Nugroho</div>
          <div class="meta2">13 th · Laki-laki · BT-000040<br>Tidak ada kunjungan</div>
          {chip("Tidak aktif", "mute")}
        </div>
      </div>
    </div>
"""
# av() with tone off - I used av("Sari Nugroho", "off") -> av-off. Good.
# Wait I need to not use terjadwal for tidak aktif - use a muted chip. st-selesai no. I'll add no special - use ghost look. chip "Tidak aktif" with kind that exists... I used terjadwal which is blue. Better a muted class. I'll use a simple span or add st-batal? I have no batal in CSS as st-batal. Add in usage: chip with... I didn't add st-batal. Use a filter. Quick: use "info" no. I'll add style or st as warn no.

# Fix: add st-mute in CSS? Too late in this string. Use existing neutral via kind I'll add to CSS... CSS already written. I'll add .st-mute in a small extra later if needed. For now use a chip that's not confusing - "Tidak aktif" in neutral. I'll inject CSS .st-mute in CSS string before writing... CSS is already in the source. Let me add it.

ph08a = phone(search_body, height=800, nav="Pasien")

list_body = (
    topbar(search=True, plus=True)
    + '<div class="ph-body">'
    + '<h1 class="page-h">Pasien</h1>'
    + '<div class="inp">'
    + ico("search")
    + "<span>Cari nama atau No. RM</span></div>"
    + '<div class="filts">'
    + '<button class="filt on" type="button">Pasien saya</button>'
    + '<button class="filt" type="button">Semua dokter</button>'
    + "</div>"
    + '<div class="filts">'
    + '<button class="filt on" type="button">Semua</button>'
    + '<button class="filt" type="button">Dalam perawatan</button>'
    + '<button class="filt" type="button">Perlu kontrol</button>'
    + "</div>"
    + (
        f'<div class="hit">{av("Budi Santoso")}<div class="card-txt">'
        f'<div class="card-name">Budi Santoso</div>'
        f'<div class="meta2">66 th · BT-000001 · 15 Nov 2026</div>'
        f'{chip("Dalam perawatan", "merawat")}'
        f'</div></div>'
        f'<div class="hit">{av("Dewi Kusuma")}<div class="card-txt">'
        f'<div class="card-name">Dewi Kusuma</div>'
        f'<div class="meta2">34 th · BT-000018 · 2 Nov 2026</div>'
        f'{chip("Perlu kontrol", "warn")}'
        f'</div></div>'
    )
    + "</div>"
)
ph08b = phone(list_body, height=800, nav="Pasien")

ab08 = ab(
    "08",
    "Cari dan daftar pasien",
    "Ikon cari di topbar (1-2 ketuk). Default saring «Pasien saya». Chip status utuh. Homonim dibedakan usia, No. RM, kunjungan terakhir, dan status; yang dalam perawatan di atas.",
    '<div class="row">'
    + '<div class="pair">'
    + before("pasien", "Sekarang · Semua dokter, chip terpotong")
    + before("pasien-cari", "Sekarang · dua Sari Nugroho")
    + "</div>"
    + after_col(ph08b, "Usulan · daftar")
    + after_col(ph08a, "Usulan · hasil cari")
    + "</div>",
)

# 09 other P1/P2
# Buat janji sheet with Keperluan visible
buat = f"""
    <div class="scrim"></div>
    <div class="sheet" role="dialog" aria-label="Buat janji">
      <div class="sheet-handle"></div>
      <h2>Buat janji</h2>
      <div class="field"><label>Pasien</label><div class="inp">Dewi Kusuma</div></div>
      <div class="field"><label>Kursi</label><div class="inp">Kursi 1</div></div>
      <div class="field"><label>Jam</label><div class="inp">13.10 · 30 menit</div></div>
      <div class="field"><label>Keperluan</label><div class="inp">Scaling</div></div>
      <div class="sticky-act" style="position:relative;bottom:0;padding:8px 0 0;border:0">
        {btn("Batal", "ghost")}{btn("Simpan janji", "pri")}
      </div>
    </div>"""
ph09a = phone(
    topbar(search=True, plus=True) + '<div class="ph-body"><h1 class="page-h">Pasien saya hari ini</h1></div>',
    height=800,
    nav="Jadwal",
    overlay=buat,
)

# Lainnya: only available items, no Kasir, no broken Antrean/Resep
lain = (
    topbar()
    + '<div class="ph-body">'
    + '<h1 class="page-h">Lainnya</h1>'
    + f'<div class="hit">{ico("settings")}<div class="card-txt"><div class="card-name">Pengaturan RM</div><div class="meta2">PIN Selesai saya</div></div></div>'
    + '<p class="sub" style="margin-top:12px">Antrean, Resep terpisah, Kasir, Laporan, dan Billing disembunyikan untuk peran dokter.</p>'
    + "</div>"
)
ph09b = phone(lain, height=720, nav="Lainnya")

# Profil tabs
profil = (
    rm_head("Budi Santoso", "66 th · Perempuan")
    + tabs([("Profil", True), ("Keluarga", False), ("Riwayat", False)])
    + '<div class="ph-body tight">'
    + '<div class="odo">'
    + '<div class="card-name">Budi Santoso</div>'
    + '<div class="card-meta" style="margin-top:8px">No. RM BT-000001</div>'
    + '<div class="card-meta">HP 0812 3456 7890</div>'
    + "</div></div>"
)
ph09c = phone(profil, height=720, nav="Pasien")

ab09 = ab(
    "09",
    "Lain-lain P1 dan P2",
    "Sheet Buat janji: field Keperluan di atas footer. Lainnya hanya item yang hidup; Billing, Kasir, Laporan, Antrean, dan Resep terpisah disembunyikan untuk dokter. Profil memakai tab horizontal. Nama klinik singkat. Umur sekali, no. HP berjarak.",
    '<div class="row">'
    + '<div class="pair">'
    + before("buat-janji", "Sekarang · Keperluan tertutup footer")
    + before("lainnya", "Sekarang · Lainnya")
    + "</div>"
    + after_col(ph09a, "Usulan · Keperluan terlihat")
    + after_col(ph09b, "Usulan · Lainnya")
    + after_col(ph09c, "Usulan · tab profil")
    + "</div>",
)

# 10 summary table
rows = [
    ("P0", "Beranda: lipatan pertama KPI, antrean kosong, daftar terpotong", "01"),
    ("P0", "Pita memotong peringatan dan Warfarin; Selengkapnya 24px", "02"),
    ("P0", "Pita dibuka mendorong bagan gigi keluar lipatan", "02, 03"),
    ("P0", "Tab Resep, Rencana, Billing «Belum tersedia»", "06, 07, 09"),
    ("P1", "Bukan mode Pasien saya; jalur kosong masih tampil", "01"),
    ("P1", "Kartu Pendapatan terkunci (bukan disembunyikan)", "01"),
    ("P1", "Buka RM butuh gulir; aksi tidak sesuai status di baris terlihat", "01"),
    ("P1", "Dialog Buat janji: Keperluan tertutup footer", "09"),
    ("P1", "Filter pasien default Semua dokter", "08"),
    ("P1", "Tidak ada cari di topbar; 3+ ketuk ke RM", "08"),
    ("P1", "Chip status terpotong", "08"),
    ("P1", "Dua Sari Nugroho tidak dibedakan; yang tidak aktif di atas", "08"),
    ("P1", "Di 360px bagan gigi di bawah lipatan; chrome terlalu tinggi", "03"),
    ("P1", "Tab RM terpotong; Resep dan Billing di luar layar", "03, 09"),
    ("P1", "Nama dan No. RM terpotong tombol ⋯", "03"),
    ("P1", "Target permukaan 11-40px", "04"),
    ("P1", "Simpan tampak aktif padahal nonaktif", "04"),
    ("P1", "Alur input 5-7 ketuk; tidak tetap di gigi setelah Mulai", "04"),
    ("P1", "Tab Catatan tanpa kunjungan tidak punya Mulai kunjungan", "05"),
    ("P1", "SOAP 4 sub-tab; Setujui/Selesai di luar lipatan", "05"),
    ("P1", "Selesai nonaktif tampak primer; Setujui sekunder", "05"),
    ("P2", "Timeline beranda di HP; nama terpotong", "01"),
    ("P2", "Jadwal masih kisi, bukan agenda", "Papan Jadwal HP, tidak diulang"),
    ("P2", "Slot kosong Jadwalkan jauh dari jam", "Papan Jadwal HP"),
    ("P2", "Keluarga dan Riwayat hanya lewat ⋯", "09"),
    ("P2", "Umur dua kali; no. HP tanpa spasi", "09"),
    ("P2", "Tutup kunjungan mudah tertukar dengan Selesai", "05"),
    ("P2", "Keyboard dapat menutup field SOAP (uji HP fisik)", "05, uji perangkat"),
    ("P2", "Antrean dan Resep di Lainnya belum jalan, tidak ditandai", "09"),
    ("P2", "Nama klinik terpotong di 360px", "01, 09"),
    ("P2", "Kasir/Laporan sudah disembunyikan; toast bila URL dibuka", "09, tetap sembunyi"),
]
trs = []
for lv, tem, art in rows:
    cls = {"P0": "lv-p0", "P1": "lv-p1", "P2": "lv-p2"}[lv]
    trs.append(f'<tr><td><span class="lv {cls}">{lv}</span></td><td>{tem}</td><td>{art}</td></tr>')

ab10 = ab(
    "10",
    "Ringkasan temuan",
    "22 temuan dari audit (3 P0, 11 P1, 8 P2) dipetakan ke artboard. Yang sudah baik di fix/mobile-ui tidak dibuka ulang. Agenda Jadwal merujuk papan Jadwal HP.",
    f"""
    <table class="sumt">
      <thead><tr><th>Tingkat</th><th>Temuan</th><th>Artboard</th></tr></thead>
      <tbody>{''.join(trs)}</tbody>
    </table>""",
)

html = f"""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Bittodent · Perbaikan HP dokter</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
{TOKENS}
{CSS}
.st-mute{{background:var(--color-neutral-100);color:var(--color-neutral-600)}}
</style>
</head>
<body>
<div class="wrap">
  <h1 class="page">Perbaikan HP dokter</h1>
  <p class="lede">Audit 15 Nov 2026 · viewport 360px · Klinik Gigi Senyum Sehat · peran dokter saja</p>
  {ab01}
  {ab02}
  {ab03}
  {ab04}
  {ab05}
  {ab06}
  {ab07}
  {ab08}
  {ab09}
  {ab10}
</div>
</body>
</html>
"""

body = html.split("</style>", 1)[-1]
if "\u2014" in body or "\u2013" in body:
    raise SystemExit("em/en dash found in board copy")

OUT.write_text(html)
ART.parent.mkdir(parents=True, exist_ok=True)
ART.write_text(html)
print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
print(f"wrote {ART} ({ART.stat().st_size} bytes)")
