#!/usr/bin/env python3
"""Papan desain Jadwal versi HP (<=720px) untuk Bittodent.

Hasil: design/boards/jadwal-mobile.html
dan /workspace/artifacts/bittodent-board-jadwal-mobile.html
Data sintetis. Tanpa JavaScript. Tidak mengubah kode app.
Gaya mengikuti Zendenta by Fikri Studio; merek tetap #0B6B62.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "design/boards/jadwal-mobile.html"
ART = Path("/workspace/artifacts/bittodent-board-jadwal-mobile.html")
TOKENS = (ROOT / "design/tokens.css").read_text()

# Lucide-like line icons (ISC). Stroke set in CSS. ViewBox 24.
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
    cls = f' av-{tone}' if tone else ""
    return f'<span class="av{cls}" aria-hidden="true">{initials(name)}</span>'


def chip(label: str, kind: str) -> str:
    return f'<span class="chip st-{kind}">{label}</span>'


def btn(label: str, kind: str = "pri", icon: str | None = None) -> str:
    ic = ico(icon, "ic-btn") if icon else ""
    return f'<button class="btn {kind}" type="button">{ic}{label}</button>'


def card(
    time: str,
    name: str,
    meta: str,
    status: str,
    kind: str,
    action: str | None = None,
    action_kind: str = "pri",
    action_icon: str | None = None,
    more: bool = True,
) -> str:
    act = btn(action, action_kind, action_icon) if action else ""
    more_btn = (
        f'<button class="icon-btn more" type="button" aria-label="Lainnya">{ico("more")}</button>'
        if more
        else ""
    )
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
      <div class="card-act">{act}{more_btn if not action else ""}</div>
    </article>"""


def week(selected: str = "15", densities: dict[str, int] | None = None) -> str:
    days = [
        ("9", "Sen"),
        ("10", "Sel"),
        ("11", "Rab"),
        ("12", "Kam"),
        ("13", "Jum"),
        ("14", "Sab"),
        ("15", "Min"),
    ]
    dens = densities or {"9": 1, "10": 2, "11": 3, "12": 2, "13": 3, "14": 1, "15": 3}
    cells = []
    for num, lab in days:
        on = " on" if num == selected else ""
        today = " today" if num == "15" and selected != "15" else ""
        n = dens.get(num, 0)
        dots = "".join('<span class="dot"></span>' for _ in range(n)) or '<span class="dot empty"></span>'
        cells.append(
            f'<button class="day{on}{today}" type="button">'
            f'<span class="dow">{lab}</span>'
            f'<span class="dom">{num}</span>'
            f'<span class="dots" aria-hidden="true">{dots}</span>'
            f"</button>"
        )
    return f'<div class="week" role="tablist">{"".join(cells)}</div>'


def chips_kursi(active: str = "Semua") -> str:
    items = ["Semua", "Kursi 1", "Kursi 2"]
    out = []
    for it in items:
        on = " on" if it == active else ""
        out.append(f'<button class="filt{on}" type="button">{it}</button>')
    return f'<div class="filts">{"".join(out)}</div>'


def seg(left: str, right: str, active: str) -> str:
    def one(lab: str) -> str:
        on = " on" if lab == active else ""
        return f'<button class="seg{on}" type="button">{lab}</button>'
    return f'<div class="segs" role="tablist">{one(left)}{one(right)}</div>'


def sect(title: str, count: int | None = None, folded: bool = False, body: str = "") -> str:
    cnt = f" · {count}" if count is not None else ""
    chev = ico("chevron-down" if folded else "chevron-up", "ic-sec")
    hid = " folded" if folded else ""
    inner = f'<div class="sect-body">{body}</div>' if body and not folded else ""
    return (
        f'<section class="sect{hid}">'
        f'<header class="sect-h"><span>{title}{cnt}</span>{chev}</header>'
        f"{inner}</section>"
    )


def now_line(label: str = "Sekarang") -> str:
    return f'<div class="now" role="separator"><span>{label}</span></div>'


def fab() -> str:
    return (
        f'<button class="fab" type="button" aria-label="Buat janji">{ico("plus", "ic-fab")}</button>'
    )


def bnav(active: str = "Jadwal", badge: int | None = 3) -> str:
    items = [
        ("Beranda", "home"),
        ("Jadwal", "calendar"),
        ("Pasien", "users"),
        ("Kasir", "wallet"),
    ]
    out = []
    for lab, icon in items:
        on = " on" if lab == active else ""
        b = ""
        if lab == "Jadwal" and badge:
            b = f'<span class="nbadge">{badge}</span>'
        out.append(
            f'<button class="navi{on}" type="button">'
            f'<span class="navi-ic">{ico(icon)}{b}</span>'
            f"<span>{lab}</span></button>"
        )
    return f'<nav class="bnav">{"".join(out)}</nav>'


def phone_head(
    title: str,
    toggle: tuple[str, str, str] | None = None,
    view: tuple[str, str, str] | None = None,
    user: str = "Sari Front Desk",
    week_html: str | None = None,
) -> str:
    if week_html is None:
        week_html = week()
    tog = seg(*toggle) if toggle else ""
    vw = ""
    if view:
        a, b, on = view
        def vbtn(name: str, icon: str) -> str:
            cls = " on" if name == on else ""
            return (
                f'<button class="vseg{cls}" type="button" aria-label="{name}">'
                f"{ico(icon)}</button>"
            )
        vw = f'<div class="vsegs">{vbtn(a, "layout-list")}{vbtn(b, "layout-grid")}</div>'
    return f"""
    <header class="hd">
      <div class="hd-row">
        <h1>{title}</h1>
        <div class="hd-right">
          {vw}
          {av(user, "me")}
        </div>
      </div>
      {tog}
      {week_html}
    </header>"""


def syn() -> str:
    return '<span class="syn">DATA SINTETIS</span>'


def phone(inner_top: str, body: str, height: int, badge: int | None = 3, show_fab: bool = True, nav_active: str = "Jadwal") -> str:
    fab_html = fab() if show_fab else ""
    return f"""
    <div class="ph" style="height:{height}px">
      <div class="ph-bar">{syn()}<span class="ph-time">11.10</span></div>
      {inner_top}
      <div class="ph-body">{body}</div>
      {fab_html}
      {bnav(nav_active, badge)}
    </div>"""


# --- appointment data ---
C_KONF = [
    card("10.00", "Lina Hartono", "Scaling · Kursi 1", "Perlu konfirmasi", "warn", "Konfirmasi"),
    card("11.30", "Fajar Nugroho", "Tambalan · Kursi 2", "Perlu konfirmasi", "warn", "Konfirmasi"),
    card("15.00", "Ratna Widi", "Kontrol · Kursi 1", "Perlu konfirmasi", "warn", "Konfirmasi"),
]
C_BAYAR = [
    card("09.00", "Siti Rahma", "Scaling · Kursi 1", "Belum bayar", "pay", "Bayar"),
]
C_NEXT_FRONT = [
    card("10.30", "Andi Wijaya", "Cabut · Kursi 2", "Check-in", "checkin", None),
    now_line(),
    card("11.00", "Budi Santoso", "Kontrol 15 · Kursi 1", "Merawat", "merawat", None),
    card("13.00", "Dewi Kartika", "Bleaching · Kursi 2", "Terjadwal", "terjadwal", "Check-in"),
    card("16.30", "Agus Pratama", "Tambalan · Kursi 1", "Terjadwal", "terjadwal", "Check-in"),
]
C_DOKTER = {
    "rawat": [
        card("11.00", "Budi Santoso", "Kontrol 15 · Kursi 1", "Merawat", "merawat", "Buka RM", "sec", "file-text"),
    ],
    "next": [
        now_line(),
        card("13.00", "Dewi Kartika", "Bleaching · Kursi 2", "Terjadwal", "terjadwal", None),
        card("14.30", "Andi Wijaya", "Cabut · Kursi 2", "Check-in", "checkin", "Mulai kunjungan", "pri", "play"),
    ],
}


def summary_row() -> str:
    return """
    <div class="sum">
      <div><b>9</b><span>Janji</span></div>
      <div><b>4</b><span>Hadir</span></div>
      <div><b>Rp 1,25 jt</b><span>Terbayar</span></div>
    </div>"""


def front_body(extra: str = "", kursi: str = "Semua") -> str:
    return (
        extra
        + chips_kursi(kursi)
        + sect("Perlu konfirmasi", 3, body="".join(C_KONF))
        + sect("Belum bayar", 1, body="".join(C_BAYAR))
        + sect("Berikutnya", 4, body="".join(C_NEXT_FRONT))
        + sect("Selesai", 2, folded=True)
    )


CSS_BOARD = r"""
*{box-sizing:border-box}
html,body{margin:0;background:#E8EEF0;color:var(--color-neutral-800);
  font-family:var(--font-family-sans);-webkit-font-smoothing:antialiased}
body{padding:48px 40px 80px}
.wrap{max-width:1280px;margin:0 auto}
h1.page{font-size:28px;font-weight:700;letter-spacing:-.02em;margin:0 0 4px;color:var(--color-neutral-900)}
.lede{margin:0 0 36px;color:var(--color-neutral-600);font-size:14px;font-weight:500}
.ab{margin:0 0 56px;width:max-content;max-width:100%}
.ab-k{display:flex;align-items:baseline;gap:12px;margin:0 0 14px}
.ab-n{font-size:12px;font-weight:700;letter-spacing:.08em;color:var(--color-primary-700);text-transform:uppercase}
.ab-t{font-size:16px;font-weight:650;color:var(--color-neutral-800)}
.row{display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap}
.note{font-size:12px;color:var(--color-neutral-500);margin:10px 0 0;font-weight:500}

/* phone */
.ph{width:390px;background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);
  border-radius:24px;overflow:hidden;position:relative;display:flex;flex-direction:column;
  flex:0 0 390px}
.ph-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 16px 0;min-height:28px;
  background:var(--color-neutral-0)}
.ph-time{font-size:12px;font-weight:600;color:var(--color-neutral-700)}
.syn{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;
  background:#FFFAEB;color:#B54708;border:1px solid #F5C14A;font-size:10px;font-weight:700;
  letter-spacing:.04em}
.hd{background:var(--color-neutral-0);padding:4px 16px 0;display:flex;flex-direction:column;gap:8px}
.hd-row{display:flex;align-items:center;justify-content:space-between;min-height:44px;gap:8px}
.hd h1{margin:0;font-size:22px;font-weight:700;letter-spacing:-.02em;color:var(--color-neutral-900)}
.hd-right{display:flex;align-items:center;gap:8px}
.ph-body{flex:1;background:var(--color-canvas);padding:12px 16px 96px;display:flex;flex-direction:column;gap:8px}

/* segments */
.segs{display:flex;background:var(--color-neutral-50);border:1px solid var(--color-neutral-100);
  border-radius:12px;padding:3px;gap:0;height:44px}
.seg{flex:1;border:0;background:transparent;border-radius:9px;font:inherit;font-size:13px;
  font-weight:600;color:var(--color-neutral-600);cursor:default;min-height:38px}
.seg.on{background:var(--color-primary-700);color:#fff}
.vsegs{display:flex;background:var(--color-neutral-50);border:1px solid var(--color-neutral-100);
  border-radius:12px;padding:2px;height:44px}
.vseg{width:44px;height:40px;border:0;background:transparent;border-radius:10px;color:var(--color-neutral-500);
  display:grid;place-items:center;padding:0}
.vseg.on{background:var(--color-primary-700);color:#fff}
.vseg .ic{width:16px;height:16px}

/* week */
.week{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;background:var(--color-neutral-0);
  margin:0 -16px;padding:4px 12px 10px;border-bottom:1px solid var(--color-neutral-100)}
.day{display:flex;flex-direction:column;align-items:center;gap:2px;border:0;background:transparent;
  border-radius:12px;padding:6px 0 4px;min-height:64px;font:inherit;color:var(--color-neutral-700)}
.day .dow{font-size:11px;font-weight:600;color:var(--color-neutral-500)}
.day .dom{font-size:15px;font-weight:700;line-height:1.2}
.day.on{background:var(--color-primary-700);color:#fff}
.day.on .dow{color:#D3F0EC}
.day.today{box-shadow:inset 0 0 0 1.5px var(--color-primary-700)}
.dots{display:flex;gap:3px;height:8px;align-items:center;margin-top:2px}
.dot{width:5px;height:5px;border-radius:99px;background:var(--color-neutral-400)}
.day.on .dot{background:#A8E0D9}
.dot.empty{background:transparent}

/* filters + summary */
.filts{display:flex;gap:8px;flex-wrap:wrap}
.filt{height:44px;padding:0 14px;border-radius:999px;border:1px solid var(--color-neutral-200);
  background:var(--color-neutral-0);font:inherit;font-size:13px;font-weight:600;
  color:var(--color-neutral-700);min-width:44px}
.filt.on{background:var(--color-primary-700);color:#fff;border-color:var(--color-primary-700)}
.sum{display:grid;grid-template-columns:1fr 1fr 1.3fr;height:52px;max-height:56px;
  background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);border-radius:12px;
  overflow:hidden}
.sum>div{display:flex;flex-direction:column;justify-content:center;padding:0 12px;gap:0;
  border-right:1px solid var(--color-neutral-100)}
.sum>div:last-child{border-right:0}
.sum b{font-size:14px;font-weight:700;color:var(--color-neutral-900);line-height:1.2}
.sum span{font-size:11px;font-weight:600;color:var(--color-neutral-500)}

/* sections + cards */
.sect{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.sect-h{display:flex;align-items:center;justify-content:space-between;min-height:28px;
  font-size:13px;font-weight:700;color:var(--color-neutral-700)}
.ic-sec{width:16px;height:16px;color:var(--color-neutral-400)}
.sect-body{display:flex;flex-direction:column;gap:8px}
.card{display:flex;align-items:stretch;gap:8px;min-height:72px;background:var(--color-neutral-0);
  border:1px solid var(--color-neutral-200);border-radius:16px;padding:10px 10px 10px 12px}
.card-time{flex:0 0 42px;font-size:13px;font-weight:700;color:var(--color-neutral-800);
  padding-top:4px;letter-spacing:-.01em}
.card-body{flex:1;min-width:0}
.card-top{display:flex;align-items:flex-start;gap:8px}
.card-txt{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:2px}
.card-name{font-size:14px;font-weight:700;color:var(--color-neutral-900);line-height:1.25}
.card-meta{font-size:12px;font-weight:500;color:var(--color-neutral-500);line-height:1.3}
.card-act{display:flex;align-items:center;flex:0 0 auto}
.av{width:32px;height:32px;border-radius:99px;display:grid;place-items:center;flex:0 0 32px;
  background:var(--color-primary-100);color:var(--color-primary-800);font-size:11px;font-weight:700}
.av-me{background:var(--color-neutral-100);color:var(--color-neutral-700);width:36px;height:36px;
  flex-basis:36px;font-size:12px}
.chip{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:999px;
  font-size:11px;font-weight:700;white-space:nowrap;flex:0 0 auto}
.st-warn{background:var(--color-warning-bg);color:var(--color-warning-fg)}
.st-pay{background:var(--color-warning-bg);color:var(--color-warning-fg)}
.st-terjadwal{background:var(--color-appointment-terjadwal-bg);color:var(--color-appointment-terjadwal-fg)}
.st-checkin{background:var(--color-appointment-checkin-bg);color:var(--color-appointment-checkin-fg)}
.st-merawat{background:var(--color-appointment-merawat-bg);color:var(--color-appointment-merawat-fg)}
.st-selesai{background:var(--color-appointment-selesai-bg);color:var(--color-appointment-selesai-fg)}
.st-batal{background:var(--color-appointment-batal-bg);color:var(--color-appointment-batal-fg)}
.btn{height:44px;padding:0 12px;border-radius:12px;border:0;font:inherit;font-size:12px;
  font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:4px;
  white-space:nowrap;min-width:44px;cursor:default}
.btn.pri{background:var(--color-primary-700);color:#fff}
.btn.sec{background:var(--color-neutral-0);color:var(--color-primary-800);
  border:1px solid var(--color-primary-200)}
.btn.ghost{background:var(--color-neutral-50);color:var(--color-neutral-700);
  border:1px solid var(--color-neutral-200)}
.btn.danger{background:var(--color-danger-bg);color:var(--color-danger-fg);
  border:1px solid var(--color-danger-border)}
.ic-btn{width:16px;height:16px}
.icon-btn{width:44px;height:44px;border:0;background:transparent;color:var(--color-neutral-500);
  display:grid;place-items:center;border-radius:12px;padding:0}
.icon-btn .ic{width:20px;height:20px}

/* now line */
.now{position:relative;height:20px;display:flex;align-items:center;margin:2px 0}
.now::before{content:"";position:absolute;left:0;right:0;height:1.5px;background:#D92D20}
.now span{position:relative;background:var(--color-canvas);padding:0 8px 0 0;color:#D92D20;
  font-size:11px;font-weight:700;letter-spacing:.02em}

/* fab + nav */
.fab{position:absolute;right:16px;bottom:80px;width:56px;height:56px;border-radius:99px;
  border:0;background:var(--color-primary-700);color:#fff;display:grid;place-items:center;
  box-shadow:0 8px 20px rgba(11,107,98,.28)}
.ic-fab{width:24px;height:24px}
.bnav{position:absolute;left:0;right:0;bottom:0;height:64px;background:var(--color-neutral-0);
  border-top:1px solid var(--color-neutral-200);display:grid;grid-template-columns:repeat(4,1fr);
  padding:0 4px}
.navi{border:0;background:transparent;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:2px;font:inherit;font-size:10px;font-weight:600;
  color:var(--color-neutral-500);min-height:44px}
.navi .ic{width:22px;height:22px}
.navi.on{color:var(--color-primary-700)}
.navi-ic{position:relative;display:grid;place-items:center;width:28px;height:24px}
.nbadge{position:absolute;top:-4px;right:-8px;min-width:16px;height:16px;padding:0 4px;
  border-radius:99px;background:var(--color-danger-solid);color:#fff;font-size:10px;
  font-weight:700;display:grid;place-items:center;line-height:16px}

/* sheet + toast */
.scrim{position:absolute;inset:0;background:rgba(22,33,43,.4);z-index:3}
.sheet{position:absolute;left:0;right:0;bottom:0;background:var(--color-neutral-0);
  border-radius:20px 20px 0 0;z-index:4;padding:10px 16px 24px;
  box-shadow:0 -8px 24px rgba(22,33,43,.08)}
.sheet-handle{width:36px;height:4px;border-radius:99px;background:var(--color-neutral-200);
  margin:4px auto 12px}
.sheet h2{margin:0 16px 8px;font-size:16px;font-weight:700}
.sheet-act{display:flex;align-items:center;gap:12px;width:100%;min-height:48px;padding:0 8px;
  border:0;background:transparent;border-radius:12px;font:inherit;font-size:15px;font-weight:600;
  color:var(--color-neutral-800);text-align:left}
.sheet-act .ic{width:20px;height:20px;color:var(--color-neutral-600)}
.sheet-act.danger{color:var(--color-danger-fg)}
.sheet-act.danger .ic{color:var(--color-danger-fg)}
.sheet-foot{display:flex;gap:8px;padding:8px 8px 8px}
.sheet-foot .btn{flex:1}
.toast{position:absolute;left:16px;right:16px;bottom:80px;min-height:44px;padding:10px 14px;
  background:var(--color-neutral-900);color:#fff;border-radius:12px;z-index:5;
  display:flex;align-items:center;justify-content:flex-start;gap:6px;
  font-size:13px;font-weight:600;box-shadow:0 8px 20px rgba(22,33,43,.2)}
.toast button{border:0;background:transparent;color:#A8E0D9;font:inherit;font-size:13px;
  font-weight:700;min-height:44px;padding:0 4px}

/* grid */
.grid-wrap{margin:0 -16px;padding:0 0 8px;flex:1}
.grid{display:grid;grid-template-columns:52px 1fr 1fr;min-width:0}
.gh{position:sticky;top:0;background:var(--color-canvas);font-size:11px;font-weight:700;
  color:var(--color-neutral-500);padding:0 8px;height:28px;line-height:28px;text-align:center}
.gh:first-child{text-align:right;padding-right:8px}
.gslot{min-height:56px;border-top:1px solid var(--color-neutral-100);position:relative}
.gtime{font-size:11px;font-weight:600;color:var(--color-neutral-400);text-align:right;
  padding:4px 8px 0 0}
.gcell{border-top:1px solid var(--color-neutral-100);border-left:1px solid var(--color-neutral-100);
  min-height:56px;position:relative}
.gempty{position:absolute;inset:4px;border:1px dashed var(--color-neutral-200);border-radius:10px;
  display:grid;place-items:center;color:var(--color-neutral-300)}
.gempty .ic{width:14px;height:14px}
.gblk{position:absolute;left:4px;right:4px;top:2px;border-radius:10px;padding:6px 8px;
  font-size:11px;font-weight:700;overflow:hidden;z-index:2;box-sizing:border-box}
.gblk b{display:block;font-size:12px}
.gblk span{display:block;font-weight:500;opacity:.85}
.gnow{position:relative;grid-column:1/-1;height:0;z-index:2}
.gnow i{position:absolute;left:52px;right:0;height:2px;background:#D92D20;top:-1px}
.gnow i::before{content:"";position:absolute;left:-5px;top:-4px;width:8px;height:8px;
  border-radius:99px;background:#D92D20}
.gnow em{position:absolute;left:0;top:-8px;font-size:10px;font-weight:700;color:#D92D20;
  font-style:normal;width:52px;text-align:right;padding-right:6px}

/* empty */
.empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;gap:12px;padding:32px 16px 48px;min-height:280px;color:var(--color-neutral-700)}
.empty .ic-lg{width:40px;height:40px;color:var(--color-neutral-400)}
.empty p{margin:0;font-size:16px;font-weight:700;color:var(--color-neutral-800)}

/* anatomy */
.anatomy{background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);
  border-radius:20px;padding:28px;width:720px}
.anatomy h3{margin:0 0 16px;font-size:14px;font-weight:700}
.call{position:relative;margin:28px 0 8px}
.call .tag{position:absolute;font-size:11px;font-weight:700;color:var(--color-primary-800);
  background:var(--color-primary-50);border:1px solid var(--color-primary-200);
  border-radius:6px;padding:2px 6px;white-space:nowrap}
.btn-table{width:100%;border-collapse:separate;border-spacing:0;margin-top:20px;font-size:13px}
.btn-table th{text-align:left;font-size:11px;font-weight:700;color:var(--color-neutral-500);
  letter-spacing:.04em;text-transform:uppercase;padding:8px 10px;border-bottom:1px solid var(--color-neutral-200)}
.btn-table td{padding:10px;border-bottom:1px solid var(--color-neutral-100);vertical-align:middle}
.btn-table td.muted{color:var(--color-neutral-500);font-weight:500}
.tiny{display:flex;align-items:center;gap:8px}

/* icons board */
.iset{background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);
  border-radius:20px;padding:28px;width:800px}
.iset-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
.iset-cell{display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 8px;
  border-radius:16px;background:var(--color-neutral-25);border:1px solid var(--color-neutral-100)}
.iset-ic{width:48px;height:48px;border-radius:14px;background:var(--color-neutral-0);
  border:1px solid var(--color-neutral-200);display:grid;place-items:center;color:var(--color-neutral-600)}
.iset-ic .ic{width:22px;height:22px}
.iset-cell span{font-size:11px;font-weight:600;color:var(--color-neutral-700);text-align:center}

.var-mini{width:280px}
.var-mini .ph{width:280px;flex-basis:280px;transform-origin:top left}
.caption-mini{font-size:12px;font-weight:600;color:var(--color-neutral-500);margin:0 0 8px}

.bill{background:var(--color-neutral-0);border:1px solid var(--color-neutral-200);
  border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px}
.bill h3{margin:0;font-size:16px;font-weight:700}
.bill .row-kv{display:flex;justify-content:space-between;font-size:13px;font-weight:500;
  color:var(--color-neutral-600)}
.bill .row-kv b{color:var(--color-neutral-900);font-weight:700}
.bill .total{font-size:18px;font-weight:700;color:var(--color-neutral-900);
  display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--color-neutral-100)}
.paym{display:flex;gap:8px}
.paym .filt{flex:1;height:44px}

.ic{width:20px;height:20px;display:block}
"""


def ab(num: str, title: str, body: str) -> str:
    return f"""
    <section class="ab" id="ab-{num}">
      <div class="ab-k"><span class="ab-n">0{num}</span><span class="ab-t">{title}</span></div>
      {body}
    </section>"""


# Artboard 01
ab01 = ab(
    "1",
    "Meja depan",
    phone(
        phone_head("Jadwal", toggle=("Meja depan", "Dokter", "Meja depan"), user="Sari Front Desk"),
        front_body(),
        height=1360,
        badge=3,
    ),
)

# Artboard 02
ab02 = ab(
    "2",
    "Pemilik",
    phone(
        phone_head("Jadwal", toggle=("Meja depan", "Dokter", "Meja depan"), user="Nadia Putri"),
        front_body(extra=summary_row()),
        height=1420,
        badge=3,
    ),
)

# Artboard 03 + mini variant
dok_body = (
    chips_kursi()
    + sect("Sedang dirawat", 1, body="".join(C_DOKTER["rawat"]))
    + sect("Berikutnya", 2, body="".join(C_DOKTER["next"]))
    + sect("Selesai", 1, folded=True)
)
mini_head = """
    <div class="var-mini">
      <p class="caption-mini">Satu peran, tanpa saklar</p>
      <div class="ph" style="height:200px">
        <div class="ph-bar"><span class="ph-time">11.10</span></div>
        """ + phone_head("Pasien saya", toggle=None, user="Arif Hidayat", week_html="") + """
        <div class="ph-body" style="padding-bottom:16px"><p style="margin:8px 0 0;font-size:13px;font-weight:600;color:var(--color-neutral-500)">Minggu, 15 Nov</p></div>
      </div>
    </div>"""
ab03 = ab(
    "3",
    "Dokter",
    '<div class="row">'
    + phone(
        phone_head("Pasien saya", toggle=None, user="Arif Hidayat"),
        dok_body,
        height=980,
        badge=None,
    )
    + mini_head
    + "</div>",
)

# Artboard 04 anatomy + table
anno_card = card(
    "11.00",
    "Budi Santoso",
    "Kontrol 15 · Kursi 1 · drg. Nadia",
    "Merawat",
    "merawat",
    "Buka RM",
    "sec",
    "file-text",
)
# For anatomy we want the more button hidden since there's a primary action
rows_btn = [
    ("Perlu konfirmasi", "Meja depan", btn("Konfirmasi")),
    ("Terjadwal", "Meja depan", btn("Check-in")),
    ("Selesai, belum bayar", "Meja depan", btn("Bayar")),
    ("Check-in", "Dokter", btn("Mulai kunjungan", icon="play")),
    ("Merawat", "Dokter", btn("Buka RM", "sec", "file-text")),
    ("Check-in atau merawat", "Meja depan", '<span class="muted">Tanpa tombol</span>'),
    ("Terjadwal", "Dokter", '<span class="muted">Tanpa tombol</span>'),
]
trs = "".join(
    f"<tr><td>{st}</td><td>{role}</td><td>{act}</td></tr>" for st, role, act in rows_btn
)
ab04 = ab(
    "4",
    "Kartu",
    f"""
    <div class="anatomy">
      <h3>Anatomi</h3>
      <div class="call" style="padding:32px 0 36px">
        <span class="tag" style="left:8px;top:4px">Jam</span>
        <span class="tag" style="left:90px;top:4px">Nama</span>
        <span class="tag" style="left:90px;bottom:0">Tindakan · dokter · kursi</span>
        <span class="tag" style="left:280px;bottom:0">Chip status</span>
        <span class="tag" style="right:8px;top:4px">Tombol 44px</span>
        {anno_card}
      </div>
      <table class="btn-table">
        <thead><tr><th>Status</th><th>Peran</th><th>Tombol utama</th></tr></thead>
        <tbody>{trs}</tbody>
      </table>
    </div>""",
)

# Artboard 05 action sheet
sheet_items = [
    ("calendar-clock", "Ubah jadwal", ""),
    ("message-circle", "Hubungi (WA)", ""),
    ("file-text", "Buka RM", ""),
    ("user-x", "No-show", ""),
    ("x-circle", "Batalkan", " danger"),
]
sheet_btns = "".join(
    f'<button class="sheet-act{cls}" type="button">{ico(ic)}{lab}</button>'
    for ic, lab, cls in sheet_items
)
ab05_phone = phone(
    phone_head("Jadwal", toggle=("Meja depan", "Dokter", "Meja depan"), user="Sari Front Desk"),
    chips_kursi() + sect("Berikutnya", 1, body="".join(C_NEXT_FRONT[:1])),
    height=844,
    badge=3,
    show_fab=False,
)
# inject sheet into the phone: after opening, we need overlay. Easier to wrap.
ab05_phone = ab05_phone.replace(
    "</div>\n    </div>" if False else "</nav>",
    f"""</nav>
      <div class="scrim"></div>
      <div class="sheet" role="dialog" aria-label="Aksi janji">
        <div class="sheet-handle"></div>
        <h2>Andi Wijaya</h2>
        {sheet_btns}
      </div>""",
    1,
)
ab05 = ab(
    "5",
    "Action sheet",
    '<div class="row">'
    + ab05_phone
    + '<p class="caption-mini" style="max-width:200px;margin-top:8px">Aksi tanpa izin disembunyikan, bukan dikunci.</p>'
    + "</div>",
)

# Artboard 06 confirm + toast
# show confirmed card (was Lina) as Terjadwal now, toast
c_after = card("10.00", "Lina Hartono", "Scaling · Kursi 1", "Terjadwal", "terjadwal", "Check-in")
ab06_phone = phone(
    phone_head("Jadwal", toggle=("Meja depan", "Dokter", "Meja depan"), user="Sari Front Desk"),
    chips_kursi()
    + sect("Perlu konfirmasi", 2, body="".join(C_KONF[1:]))
    + sect("Berikutnya", 1, body=c_after),
    height=900,
    badge=2,
    show_fab=True,
)
ab06_phone = ab06_phone.replace(
    "</nav>",
    """</nav>
      <div class="toast" role="status">Dikonfirmasi · <button type="button">Urungkan</button></div>""",
    1,
)
ab06 = ab("6", "Konfirmasi 1 ketuk", ab06_phone)

# Artboard 07 flow
# A: doctor mode + toast
body_a = (
    chips_kursi()
    + sect("Sedang dirawat", 1, body="".join(C_DOKTER["rawat"]))
    + sect("Berikutnya", 2, body="".join(C_DOKTER["next"][1:]))
)
ph_a = phone(
    phone_head("Pasien saya", toggle=("Meja depan", "Dokter", "Dokter"), user="Nadia Putri"),
    body_a,
    height=900,
    badge=None,
    show_fab=False,
).replace(
    "</nav>",
    """</nav>
      <div class="toast" role="status">Mode Dokter</div>""",
    1,
)

# B: selesai sheet
selesai_card = card("11.00", "Budi Santoso", "Kontrol 15 · Kursi 1", "Selesai", "selesai", None)
ph_b = phone(
    phone_head("Pasien saya", toggle=("Meja depan", "Dokter", "Dokter"), user="Nadia Putri"),
    chips_kursi()
    + sect("Selesai", 1, body=selesai_card),
    height=900,
    badge=None,
    show_fab=False,
).replace(
    "</nav>",
    f"""</nav>
      <div class="scrim"></div>
      <div class="sheet" role="dialog" aria-label="Lanjut ke Bayar">
        <div class="sheet-handle"></div>
        <h2>Lanjut ke Bayar?</h2>
        <div class="sheet-foot">
          {btn("Bayar")}
          {btn("Nanti", "ghost")}
        </div>
      </div>""",
    1,
)

# C: billing meja depan
bill = f"""
    <div class="bill">
      <div class="card-top">{av("Budi Santoso")}<div class="card-txt">
        <div class="card-name">Budi Santoso</div>
        <div class="card-meta">Kontrol 15 · Kursi 1 · drg. Nadia</div>
      </div></div>
      <div class="row-kv"><span>Tindakan</span><b>Kontrol 15</b></div>
      <div class="row-kv"><span>Status</span>{chip("Belum bayar", "pay")}</div>
      <div class="total"><span>Total</span><span>Rp 150.000</span></div>
      <div class="paym">
        <button class="filt on" type="button">Tunai</button>
        <button class="filt" type="button">QRIS</button>
        <button class="filt" type="button">Transfer</button>
      </div>
      {btn("Bayar")}
    </div>"""
# make the Bayar button full width
bill = bill.replace('{btn("Bayar")}', btn("Bayar")).replace(
    '<button class="btn pri" type="button">Bayar</button>',
    '<button class="btn pri" type="button" style="width:100%">Bayar</button>',
    1,
)
# Wait I already called btn() in the f-string so the replace for template is wrong.
# The bill already has the actual HTML from btn("Bayar"). Fix full width:
bill = bill.replace(
    '<button class="btn pri" type="button">Bayar</button>',
    '<button class="btn pri" type="button" style="width:100%">Bayar</button>',
    1,
)

ph_c = phone(
    phone_head("Jadwal", toggle=("Meja depan", "Dokter", "Meja depan"), user="Nadia Putri", week_html=""),
    bill,
    height=900,
    badge=3,
    show_fab=False,
    nav_active="Kasir",
)

ab07 = ab(
    "7",
    "Alur rangkap peran",
    '<div class="row">'
    + '<div><p class="caption-mini">Mulai kunjungan</p>'
    + ph_a
    + "</div>"
    + '<div><p class="caption-mini">Selesai</p>'
    + ph_b
    + "</div>"
    + '<div><p class="caption-mini">Bayar</p>'
    + ph_c
    + "</div></div>",
)

# Artboard 08 grid
hours = list(range(8, 18))
# appointments on grid:
# Kursi 1: 09 Siti (done/unpaid) 09-10, 11 Budi merawat 11-12, 15 Ratna confirm 15-16, 16.30 Agus 16.30-17.30
# Kursi 2: 10.30 Andi checkin 10.30-11.30, 11.30 Fajar confirm 11.30-12.30, 13 Dewi 13-14
# Now 11.10

def gblk(name: str, meta: str, kind: str, top: int, h: int) -> str:
    # top/h in px within the cell? Better use absolute in the column spanning hours.
    # We'll place blocks inside the first cell of that column with absolute offsets later.
    return (
        f'<div class="gblk st-{kind}" style="top:{top}px;height:{h}px">'
        f"<b>{name}</b><span>{meta}</span></div>"
    )


# Build hour rows. Each hour = 56px so 8-17 = 9*56 = 504. Now at 11.10 = 3 hours + 10/60*56 = 168+9 = 177 from 8:00
SLOT = 56
rows_g = []
# header
grid_html = ['<div class="grid"><div class="gh"></div><div class="gh">Kursi 1</div><div class="gh">Kursi 2</div>']
# Now line inserted after header, absolutely positioned over the grid body
# We'll wrap body
grid_html.append('<div class="grid-body" style="display:contents">')
for h in hours:
    lab = f"{h:02d}.00"
    empty1 = ""
    empty2 = ""
    # empty slots that are free get dashed plus
    # occupied ranges:
    # k1: 9-10, 11-12, 15-16, 16.5-17.5
    # k2: 10.5-11.5, 11.5-12.5, 13-14
    k1_busy = h in (9, 11, 15, 16, 17)
    k2_busy = h in (10, 11, 12, 13)
    # For 10 kursi 1 empty, 8 empty both, 12 both empty, 14 both empty
    def empty_cell(busy: bool) -> str:
        if busy:
            return '<div class="gcell"></div>'
        return f'<div class="gcell"><button class="gempty" type="button" aria-label="Buat janji">{ico("plus")}</button></div>'

    grid_html.append(f'<div class="gtime gslot">{lab}</div>')
    grid_html.append(empty_cell(k1_busy))
    grid_html.append(empty_cell(k2_busy))

grid_html.append("</div></div>")
# Overlay blocks: position relative wrapper
# We'll add a relative overlay spanning the two columns. Easier: put blocks in the first hour cell of each column
# with absolute top relative to grid-body. Use a wrapper.

# Recreate with a positioned overlay.
blocks = [
    # col 1 (Kursi 1): left
    ("k1", 9, 1, "Siti Rahma", "Scaling · Belum bayar", "pay"),
    ("k1", 11, 1, "Budi Santoso", "Kontrol 15 · Merawat", "merawat"),
    ("k1", 15, 1, "Ratna Widi", "Kontrol · Konfirmasi", "warn"),
    ("k1", 16.5, 1, "Agus Pratama", "Tambalan · Terjadwal", "terjadwal"),
    ("k2", 10.5, 1, "Andi Wijaya", "Cabut · Check-in", "checkin"),
    ("k2", 11.5, 1, "Fajar Nugroho", "Tambalan · Konfirmasi", "warn"),
    ("k2", 13, 1, "Dewi Kartika", "Bleaching · Terjadwal", "terjadwal"),
]
# 11.10 now: from 08.00 = 3*56 + 10/60*56 = 168+9.3 = 177
HEAD = 28
now_off = int((11 + 10 / 60 - 8) * SLOT) + HEAD

overlay_blks = []
for col, start, dur, name, meta, kind in blocks:
    top = (start - 8) * SLOT + 2 + HEAD
    height = dur * SLOT - 4
    left = "52px" if col == "k1" else "calc(52px + (100% - 52px)/2)"
    width = "calc((100% - 52px)/2 - 8px)"
    overlay_blks.append(
        f'<div class="gblk st-{kind}" style="position:absolute;left:{left};width:{width};top:{int(top)}px;height:{int(height)}px">'
        f"<b>{name}</b><span>{meta}</span></div>"
    )

now_html = (
    f'<div class="gnow-abs" style="position:absolute;left:0;right:0;top:{now_off}px;z-index:3;pointer-events:none">'
    f'<em style="position:absolute;left:0;top:-7px;width:52px;text-align:right;padding-right:6px;'
    f'font-size:10px;font-weight:700;color:#D92D20;font-style:normal">11.10</em>'
    f'<i style="position:absolute;left:52px;right:0;height:2px;background:#D92D20;top:0;'
    f'display:block"></i></div>'
)

grid_panel = (
    '<div class="grid-wrap"><div style="position:relative">'
    + "".join(
        [
            '<div class="grid"><div class="gh"></div><div class="gh">Kursi 1</div><div class="gh">Kursi 2</div>'
        ]
    )
)
# redo simple grid rows without contents overlay issue
cells = ['<div class="grid"><div class="gh"></div><div class="gh">Kursi 1</div><div class="gh">Kursi 2</div>']
for h in hours:
    lab = "" if h == 11 else f"{h:02d}.00"
    k1_busy = h in (9, 11, 15, 16, 17)
    k2_busy = h in (10, 11, 12, 13)
    def empty_cell(busy: bool) -> str:
        if busy:
            return '<div class="gcell"></div>'
        return f'<div class="gcell"><button class="gempty" type="button" aria-label="Buat janji">{ico("plus")}</button></div>'
    cells.append(f'<div class="gtime gslot">{lab}</div>')
    cells.append(empty_cell(k1_busy))
    cells.append(empty_cell(k2_busy))
cells.append("</div>")
grid_panel = (
    '<div class="grid-wrap"><div style="position:relative;padding-top:0">'
    + now_html
    + "".join(overlay_blks)
    + "".join(cells)
    + "</div></div>"
)

ab08 = ab(
    "8",
    "Kisi waktu",
    phone(
        phone_head(
            "Jadwal",
            toggle=("Meja depan", "Dokter", "Meja depan"),
            view=("Agenda", "Grid", "Grid"),
            user="Sari Front Desk",
        ),
        chips_kursi() + grid_panel,
        height=1240,
        badge=3,
    ),
)

# Artboard 09 empties
def empty_ph(title: str, icon: str, text: str, action: str | None = None, action_icon: str | None = None, toggle=None, user="Sari Front Desk", extra="") -> str:
    act = btn(action, "sec", action_icon) if action else ""
    body = extra + f'<div class="empty">{ico(icon, "ic-lg")}<p>{text}</p>{act}</div>'
    return phone(
        phone_head(title, toggle=toggle, user=user),
        body,
        height=760,
        badge=None if "pasien" in text.lower() else (None if "Kursi" in text or "Gagal" in text or "Belum" in text else 3),
        show_fab=True,
    )

# badges: empty confirm = no badge
e1 = empty_ph("Jadwal", "inbox", "Belum ada janji.", toggle=("Meja depan", "Dokter", "Meja depan"))
e2 = empty_ph("Pasien saya", "users", "Tidak ada pasien hari ini.", "Hari berikutnya", "arrow-right", toggle=None, user="Arif Hidayat")
e3 = empty_ph("Jadwal", "chair", "Kursi 2 kosong hari ini.", toggle=("Meja depan", "Dokter", "Meja depan"), extra=chips_kursi("Kursi 2"))
e4 = empty_ph("Jadwal", "cloud-off", "Gagal memuat.", "Coba lagi", "refresh", toggle=("Meja depan", "Dokter", "Meja depan"))

# shrink 09 phones? 4 phones is wide. 2x2
ab09 = ab(
    "9",
    "Keadaan kosong",
    '<div class="row" style="gap:20px">'
    + "<div>"
    + e1
    + "</div><div>"
    + e2
    + "</div></div>"
    + '<div class="row" style="gap:20px;margin-top:20px"><div>'
    + e3
    + "</div><div>"
    + e4
    + "</div></div>",
)

# Artboard 10 icons
icon_labels = [
    ("calendar", "Kalender"),
    ("calendar-plus", "Buat janji"),
    ("calendar-clock", "Ubah jadwal"),
    ("plus", "Tambah"),
    ("check", "Centang"),
    ("x", "Tutup"),
    ("x-circle", "Batalkan"),
    ("chevron-down", "Turun"),
    ("chevron-up", "Naik"),
    ("chevron-right", "Lanjut"),
    ("chevron-left", "Kembali"),
    ("phone", "Telepon"),
    ("message-circle", "WhatsApp"),
    ("file-text", "Rekam medis"),
    ("user", "Pasien"),
    ("users", "Orang"),
    ("user-x", "No-show"),
    ("home", "Beranda"),
    ("wallet", "Kasir"),
    ("banknote", "Bayar"),
    ("clock", "Jam"),
    ("chair", "Kursi"),
    ("play", "Mulai kunjungan"),
    ("layout-list", "Agenda"),
    ("layout-grid", "Kisi"),
    ("refresh", "Muat ulang"),
    ("cloud-off", "Gagal memuat"),
    ("inbox", "Kosong"),
    ("more", "Lainnya"),
    ("alert", "Perhatian"),
    ("arrow-right", "Hari berikutnya"),
]
cells_ic = "".join(
    f'<div class="iset-cell"><div class="iset-ic">{ico(n)}</div><span>{lab}</span></div>'
    for n, lab in icon_labels
)
ab10 = ab("10", "Set ikon", f'<div class="iset"><div class="iset-grid">{cells_ic}</div></div>')

html = f"""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Bittodent · Jadwal HP</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
{TOKENS}
{CSS_BOARD}
</style>
</head>
<body>
<div class="wrap">
  <h1 class="page">Jadwal HP</h1>
  <p class="lede">Klinik Gigi Senyum Sehat · 15 Nov 2026 · bingkai 390px</p>
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

# unslop: no em/en dashes in board copy (tokens.css comment may contain one)
body = html.split("</style>", 1)[-1]
if "\u2014" in body or "\u2013" in body:
    raise SystemExit("em/en dash found in board copy")

OUT.write_text(html)
ART.parent.mkdir(parents=True, exist_ok=True)
ART.write_text(html)
print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
print(f"wrote {ART} ({ART.stat().st_size} bytes)")
