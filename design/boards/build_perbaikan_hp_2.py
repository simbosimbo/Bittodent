#!/usr/bin/env python3
"""Papan perbaikan HP 2: Pasien, Beranda, sheet gigi (before/after).

Hasil: design/boards/perbaikan-hp-2.html
dan /workspace/artifacts/bittodent-board-perbaikan-hp-2.html
Data sintetis. Tanpa JavaScript. Tidak mengubah kode app.
Gaya HeroUI v3 seperti papan odontogram v2. Teal #0B6B62 hanya tombol primer.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "design/boards/perbaikan-hp-2.html"
ART = Path("/workspace/artifacts/bittodent-board-perbaikan-hp-2.html")
TOKENS = (ROOT / "design/tokens.css").read_text()

# Before crops (synthetic staging). Paths relative to this board HTML.
BEFORE = {
    "pasien": "assets/perbaikan-hp-2/pasien-crop.jpg",
    "beranda": "assets/perbaikan-hp-2/beranda-crop.jpg",
    "sheet": "assets/perbaikan-hp-2/sheet-gigi-crop.jpg",
}

ICONS: dict[str, str] = {
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "x": '<path d="M18 6 6 18M6 6l12 12"/>',
    "chevron-left": '<path d="M15 18l-6-6 6-6"/>',
    "chevron-right": '<path d="M9 18l6-6-6-6"/>',
    "chevron-down": '<path d="M6 9l6 6 6-6"/>',
    "search": '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    "more": (
        '<circle cx="6" cy="12" r="1.15" fill="currentColor" stroke="none"/>'
        '<circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"/>'
        '<circle cx="18" cy="12" r="1.15" fill="currentColor" stroke="none"/>'
    ),
    "tooth": (
        '<path d="M8 4.5C8 3.1 9.6 2 12 2s4 1.1 4 2.5c0 .7-.2 1.4-.5 2 '
        "1.7.3 3 1.6 3.2 3.6.4 3.2-1 7.2-2.8 9.2-.6.7-1.7.3-1.7-.6 0-1.8"
        "-.3-3.2-.7-4.1-.3-.6-.9-.8-1.5-.4-.4.2-.8.2-1.2 0-.6-.4-1.2-.2"
        "-1.5.4-.4.9-.7 2.3-.7 4.1 0 .9-1.1 1.3-1.7.6-1.8-2-3.2-6-2.8-9.2"
        '.2-2 1.5-3.3 3.2-3.6-.3-.6-.5-1.3-.5-2z"/>'
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
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "bell": (
        '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>'
        '<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'
    ),
    "sliders": (
        '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/>'
        '<path d="M1 14h6M9 8h6M17 16h6"/>'
    ),
}


def ico(name: str, cls: str = "ic") -> str:
    return (
        f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        f'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" '
        f'aria-hidden="true">{ICONS[name]}</svg>'
    )


def _v2_css() -> str:
    src = Path(__file__).with_name("build_odontogram_v2.py").read_text()
    start = src.index('CSS = r"""') + len('CSS = r"""')
    end = src.index('"""', start)
    return src[start:end]


EXTRA = r"""
.tabs--scroll{overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none}
.tabs--scroll::-webkit-scrollbar{display:none}
.tabs--scroll .tab{flex:0 0 auto;white-space:nowrap;padding:0 12px;min-width:max-content}

.ph-body--flush{padding:0;gap:0;background:var(--color-canvas)}
.ph-body--sheet{padding:8px 16px 0;overflow:hidden}

.hd-title{display:flex;align-items:baseline;gap:8px;flex:1;min-width:0;padding-left:8px}
.hd-title h1{margin:0;font-size:18px;font-weight:700;color:var(--color-neutral-900)}
.hd-count{font-size:13px;font-weight:600;color:var(--color-neutral-500)}

.hd-clinic{gap:8px;padding:0 8px 0 12px}
.logo-sq{width:40px;height:40px;border-radius:12px;background:var(--color-primary-700);color:#fff;
  display:grid;place-items:center;flex:none}
.logo-sq .ic{width:20px;height:20px}
.clinic-nm{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;line-height:1.15}
.clinic-nm b{font-size:13px;font-weight:700;color:var(--color-neutral-900)}
.clinic-nm span{font-size:12px;font-weight:600;color:var(--color-neutral-600)}
.av{width:48px;height:48px;border-radius:999px;border:0;background:var(--color-primary-50);
  color:var(--color-primary-800);font-size:13px;font-weight:700;display:grid;place-items:center;flex:none}

.filt-row{display:flex;align-items:center;gap:8px;padding:8px 16px 0}
.filt-row .search{flex:1;min-width:0}
.doc-chip{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:4px;
  min-height:48px;padding:0 12px;border-radius:14px;border:1px solid var(--color-neutral-200);
  background:#fff;font-size:13px;font-weight:600;color:var(--color-neutral-800);white-space:nowrap}
.doc-chip .ic{width:16px;height:16px;color:var(--color-neutral-500)}

.tab-wrap{padding:8px 16px 8px}

.plist{flex:1;min-height:0;background:#fff;border-top:1px solid var(--color-neutral-100);display:flex;flex-direction:column}
.prow{display:flex;align-items:center;gap:12px;min-height:64px;width:100%;padding:8px 16px;
  border:0;border-bottom:1px solid var(--color-neutral-100);background:#fff;text-align:left;border-radius:0}
.prow:active{transform:none;background:var(--color-neutral-50)}
.av-sm{width:40px;height:40px;border-radius:999px;background:var(--color-neutral-100);
  color:var(--color-neutral-700);font-size:12px;font-weight:700;display:grid;place-items:center;flex:none}
.prow .who{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;justify-content:center}
.prow .nm{font-size:14px;font-weight:700;color:var(--color-neutral-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prow .meta{font-size:12px;font-weight:500;color:var(--color-neutral-500);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chip-st{display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:999px;
  font-size:11px;font-weight:700;flex:none;white-space:nowrap}
.chip-st.dirawat{background:#ECFDF3;color:#0B7A45}
.chip-st.kontrol{background:#FFFAEB;color:#B54708}

.fab{position:absolute;right:16px;bottom:96px;z-index:3;width:56px;height:56px;border:0;
  border-radius:999px;background:var(--color-primary-700);color:#fff;display:grid;place-items:center;
  box-shadow:0 8px 20px rgba(11,107,98,.28)}
.fab:active{transform:scale(.97)}
.fab .ic{width:24px;height:24px}
.fab-space{height:64px;flex:none}

.pg-row{display:flex;align-items:center;justify-content:space-between;padding:8px 16px 0;gap:8px}
.pg-row h2{margin:0;font-size:16px;font-weight:700;color:var(--color-neutral-900)}
.mode{display:flex;gap:4px;padding:4px;background:var(--color-neutral-100);border-radius:14px;flex:none}
.mode .tab{flex:none;min-height:48px;padding:0 12px;font-size:12px}
.button--compact{padding:0 12px}

.date-row{display:flex;align-items:center;gap:8px;padding:8px 16px;min-height:56px}
.date-row .when{flex:1;text-align:center;font-size:14px;font-weight:700;color:var(--color-neutral-900);min-width:0}

.sec{padding:8px 16px 0;display:flex;align-items:center;justify-content:space-between}
.sec h3{margin:0;font-size:13px;font-weight:700;color:var(--color-neutral-700)}
.sec .n{color:var(--color-neutral-500);font-weight:600}

.tlist{display:flex;flex-direction:column;padding:0 16px 8px;gap:8px}
.trow{display:flex;align-items:center;gap:12px;min-height:72px;padding:8px 12px;background:#fff;
  border:1px solid var(--color-neutral-200);border-radius:16px}
.trow .tm{width:44px;flex:none;font-size:13px;font-weight:700;color:var(--color-neutral-800);font-variant-numeric:tabular-nums}
.trow .who{flex:1;min-width:0}
.trow .nm{font-size:14px;font-weight:700;color:var(--color-neutral-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.trow .svc{font-size:12px;font-weight:500;color:var(--color-neutral-600);display:-webkit-box;-webkit-line-clamp:2;
  -webkit-box-orient:vertical;overflow:hidden;line-height:1.35;white-space:normal}
.trow .side{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:none}

.fold{display:flex;align-items:center;justify-content:space-between;margin:0 16px 8px;min-height:48px;
  padding:0 12px;background:#fff;border:1px solid var(--color-neutral-200);border-radius:16px;
  font-size:13px;font-weight:700;color:var(--color-neutral-700)}

.scrim{position:absolute;inset:0;z-index:4;background:rgba(22,33,43,.4)}
.drawer--profil{max-height:72%;z-index:5}
.who-block{display:flex;align-items:center;gap:12px;padding:4px 0 8px}
.who-block .av{width:56px;height:56px;font-size:16px}
.who-block .nm{font-size:16px;font-weight:700;color:var(--color-neutral-900)}
.who-block .role{font-size:13px;font-weight:500;color:var(--color-neutral-500)}
.blist{display:flex;flex-direction:column;gap:4px}
.brow{display:flex;align-items:center;gap:12px;min-height:48px;padding:0 12px;border-radius:10px;
  border:1px solid var(--color-neutral-200);background:#fff;width:100%;text-align:left;
  font-size:14px;font-weight:600;color:var(--color-neutral-800)}
.brow.on{border-color:var(--color-primary-300);background:var(--color-primary-50);color:var(--color-primary-900)}
.brow .ic{margin-left:auto;color:var(--color-primary-700)}

.pt-strip{display:flex;align-items:baseline;gap:8px;padding:8px 16px;background:#fff;
  border-bottom:1px solid var(--color-neutral-100);min-height:40px}
.pt-strip b{font-size:14px;font-weight:700;color:var(--color-neutral-900)}
.pt-strip span{font-size:12px;font-weight:500;color:var(--color-neutral-500);white-space:nowrap}

.cond-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cond{display:flex;align-items:center;gap:8px;min-height:48px;padding:0 12px;border-radius:14px;
  border:1px solid var(--color-neutral-200);background:#fff;font-size:13px;font-weight:600;
  color:var(--color-neutral-800);text-align:left}
.cond .dot{width:10px;height:10px;border-radius:99px;flex:none}
.cond.on{border-color:var(--color-primary-300);background:var(--color-primary-50);color:var(--color-primary-900)}

.od--tight{padding:6px 8px}
.od--tight .od-hd{margin-bottom:4px}
.od--tight .tth{width:16px;height:26px;font-size:6px}

.before{width:360px;background:#fff;border:1px solid var(--color-neutral-200);
  border-radius:28px;overflow:hidden;flex:none;box-shadow:0 8px 24px rgba(22,33,43,.06)}
.before img{display:block;width:360px;height:auto}
.compare{display:flex;gap:24px;align-items:flex-start}

@media (prefers-reduced-motion:reduce){
  .drawer,.fab,.button{animation:none;transition:none}
}
"""


def css() -> str:
    return _v2_css() + EXTRA


def syn() -> str:
    return '<span class="syn">DATA SINTETIS</span>'


def button(
    label: str,
    variant: str = "primary",
    size: str = "lg",
    icon: str | None = None,
    icon_only: bool = False,
    aria: str = "",
) -> str:
    ic = ico(icon, "ic-btn") if icon else ""
    cls = f"button button--{variant} button--{size}"
    if icon_only:
        cls += " button--icon"
        aria = aria or label
        return f'<button class="{cls}" type="button" aria-label="{aria}">{ic}</button>'
    return f'<button class="{cls}" type="button">{ic}{label}</button>'


def chip(label: str, kind: str = "bordered", on: bool = False) -> str:
    cls = f"chip chip--{kind}"
    if on:
        cls += " on"
    return f'<span class="{cls}">{label}</span>'


def tabs(items: list[tuple[str, bool]], scroll: bool = False) -> str:
    bits = []
    for lab, on in items:
        cls = "tab on" if on else "tab"
        bits.append(f'<button class="{cls}" type="button">{lab}</button>')
    cls = "tabs tabs--scroll" if scroll else "tabs"
    return f'<div class="{cls}" role="tablist">{"".join(bits)}</div>'


def toggle_2d(is_2d: bool) -> str:
    a = "tab on" if is_2d else "tab"
    b = "tab on" if not is_2d else "tab"
    return (
        '<div class="toggle" role="tablist" aria-label="Tampilan bagan">'
        f'<button class="{a}" type="button">2D</button>'
        f'<button class="{b}" type="button">3D</button></div>'
    )


def surfaces(on: tuple[str, ...] = ()) -> str:
    pads = "".join(
        f'<b class="{"on" if n in on else ""}">{n}</b>' for n in ("M", "O", "D", "B", "L")
    )
    return f'<div class="surf">{pads}</div>'


def radios(selected: str) -> str:
    opts = [
        ("ada", "Ada sebelumnya"),
        ("lain", "Klinik lain"),
        ("rencana", "Rencana"),
        ("selesai", "Selesai hari ini"),
    ]
    bits = []
    for key, lab in opts:
        on = " on" if key == selected else ""
        bits.append(
            f'<button class="radio{on}" type="button">'
            f'<span class="dot" aria-hidden="true"><i></i></span>{lab}</button>'
        )
    return f'<div class="radios" role="radiogroup" aria-label="Status kondisi">{"".join(bits)}</div>'


def bnav(active: str) -> str:
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
            f'<button class="navi{on}" type="button">{ico(icon)}<span>{show}</span></button>'
        )
    return f'<nav class="bnav">{"".join(out)}</nav>'


def phone(
    inner: str,
    header: str,
    nav: str = "",
    overlay: str = "",
    body_cls: str = "",
    height: int = 800,
) -> str:
    bc = f"ph-body {body_cls}".strip()
    return f"""
    <div class="ph" style="height:{height}px">
      <div class="ph-bar">{syn()}<span class="ph-time">22.39</span></div>
      {header}
      <div class="{bc}">{inner}</div>
      {nav}
      {overlay}
    </div>"""


def ab(num: str, title: str, desc: str, body: str) -> str:
    return f"""
    <section class="ab" id="ab-{num}">
      <div class="ab-k"><span class="ab-n">{num}</span><span class="ab-t">{title}</span></div>
      <p class="ab-d">{desc}</p>
      {body}
    </section>"""


def ph_col(ph: str, cap: str) -> str:
    return f'<div class="ph-col">{ph}<p class="ph-cap">{cap}</p></div>'


def before_ph(key: str, alt: str) -> str:
    return f'<div class="before"><img src="{BEFORE[key]}" alt="{alt}" width="360" height="auto"></div>'


UPPER = ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"]
LOWER = ["48", "47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37", "38"]


def odonto(active: list[str] | None = None, tight: bool = False) -> str:
    active = active or []

    def cell(n: str) -> str:
        cls = "tth on" if n in active else "tth"
        return f'<button class="{cls}" type="button" aria-label="Gigi {n}"><span class="face"></span>{n}</button>'

    def row(nums: list[str]) -> str:
        return f'<div class="od-row">{"".join(cell(n) for n in nums)}</div>'

    cls = "od od--tight" if tight else "od"
    return f"""
    <div class="{cls}">
      <div class="od-hd"><h3>Odontogram</h3>{toggle_2d(True)}</div>
      <div class="od-lab">RAHANG ATAS</div>{row(UPPER)}
      <div class="od-lab">RAHANG BAWAH</div>{row(LOWER)}
    </div>"""


def drawer(title: str, body: str, save: str = "Simpan", extra_cls: str = "") -> str:
    cls = f"drawer {extra_cls}".strip()
    return f"""
    <div class="{cls}" role="dialog" aria-label="{title}">
      <div class="drawer-handle" aria-hidden="true"></div>
      <div class="drawer-hd"><h3>{title}</h3>
        {button("", "ghost", "lg", "x", icon_only=True, aria="Tutup")}</div>
      <div class="drawer-bd">{body}</div>
      <div class="drawer-ft">{button(save, "primary", "lg")}</div>
    </div>"""


def initials(name: str) -> str:
    parts = [p for p in name.split() if p[0].isupper()]
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return name[:2].upper()


# ---------------------------------------------------------------------------
# Artboards
# ---------------------------------------------------------------------------

PATIENTS = [
    ("Nadia Anak Contoh", "BT-000041 · 9 th", "Dirawat", "dirawat"),
    ("Sari Nugroho", "BT-000040 · 13 th", "Dirawat", "dirawat"),
    ("Hendra Hidayat", "BT-000009 · 65 th", "Dirawat", "dirawat"),
    ("Fajar Halim", "BT-000022 · 31 th", "Kontrol", "kontrol"),
    ("Budi Santoso", "BT-000017 · 42 th", "Kontrol", "kontrol"),
]


def prow(name: str, meta: str, st: str, kind: str) -> str:
    return (
        f'<button class="prow" type="button">'
        f'<span class="av-sm" aria-hidden="true">{initials(name)}</span>'
        f'<span class="who"><span class="nm">{name}</span>'
        f'<span class="meta">{meta}</span></span>'
        f'<span class="chip-st {kind}">{st}</span>'
        f"</button>"
    )


def ab01() -> str:
    hd = (
        '<header class="hd">'
        '<div class="hd-title"><h1>Pasien</h1><span class="hd-count">25</span></div>'
        "</header>"
    )
    filt = (
        f'<div class="filt-row"><div class="search">{ico("search")}'
        '<div class="fake">Cari nama atau No. RM</div></div>'
        f'<button class="doc-chip" type="button" aria-label="Filter dokter">'
        f'{ico("sliders")}Semua</button></div>'
    )
    tab = (
        '<div class="tab-wrap">'
        + tabs([("Semua", True), ("Dalam perawatan", False), ("Perlu kontrol", False)], scroll=True)
        + "</div>"
    )
    rows = "".join(prow(*p) for p in PATIENTS)
    inner = f'{filt}{tab}<div class="plist">{rows}<div class="fab-space"></div></div>'
    fab = (
        f'<button class="fab" type="button" aria-label="Tambah pasien">{ico("plus")}</button>'
    )
    after = phone(inner, hd, bnav("Pasien"), overlay=fab, body_cls="ph-body--flush")
    body = (
        '<div class="compare">'
        + ph_col(before_ph("pasien", "Pasien staging, sebelum perbaikan"), "Sebelum, staging 360")
        + ph_col(after, "Sesudah. Lima baris terlihat. Satu ketukan per baris.")
        + "</div>"
    )
    return ab(
        "01",
        "Pasien, daftar ringkas",
        "Label Cari dan Dokter dihapus. Filter satu baris, bukan kartu besar. "
        "Hitungan 25 di judul. Tab HeroUI bisa digeser, Perlu kontrol utuh. "
        "Seluruh baris satu target. Tanpa tautan Rekam Medis dan tanpa chevron. "
        "Nama dokter tidak menggulung di baris. FAB tidak menutupi daftar.",
        body,
    )


def trow(time: str, name: str, svc: str, st: str, kind: str) -> str:
    return (
        f'<div class="trow">'
        f'<span class="tm">{time}</span>'
        f'<span class="who"><span class="nm">{name}</span>'
        f'<span class="svc">{svc}</span></span>'
        f'<span class="side"><span class="chip-st {kind}">{st}</span>'
        f'{button("Buka RM", "outline", "lg").replace("button--lg","button--lg button--compact")}</span>'
        f"</div>"
    )


def beranda_chrome() -> str:
    return (
        '<header class="hd hd-clinic">'
        f'<div class="logo-sq" aria-hidden="true">{ico("tooth")}</div>'
        '<div class="clinic-nm"><b>Klinik Gigi</b><span>Senyum Sehat</span></div>'
        + button("", "ghost", "lg", "bell", icon_only=True, aria="Notifikasi")
        + '<button class="av" type="button" aria-label="Profil">PS</button>'
        "</header>"
    )


def beranda_body() -> str:
    top = (
        '<div class="pg-row"><h2>Pasien saya</h2>'
        '<div class="mode" role="tablist" aria-label="Mode">'
        '<button class="tab" type="button">Meja depan</button>'
        '<button class="tab on" type="button">Saya</button></div></div>'
    )
    date = (
        '<div class="date-row">'
        + button("", "ghost", "lg", "chevron-left", icon_only=True, aria="Hari sebelumnya")
        + '<span class="when">15 Nov 2026</span>'
        + button("", "ghost", "lg", "chevron-right", icon_only=True, aria="Hari berikutnya")
        + button("", "ghost", "lg", "calendar", icon_only=True, aria="Pilih tanggal")
        + "</div>"
    )
    rows = (
        '<div class="sec"><h3>Sedang dirawat <span class="n">· 2</span></h3></div>'
        '<div class="tlist">'
        + trow("12.20", "Hendra Hidayat", "Kontrol rutin", "Merawat", "dirawat")
        + trow("19.30", "Fajar Halim", "Pembersihan karang", "Merawat", "dirawat")
        + "</div>"
        '<button class="fold" type="button">Selesai · 12'
        f'{ico("chevron-down")}</button>'
    )
    return top + date + rows


def ab02() -> str:
    after = phone(beranda_body(), beranda_chrome(), bnav("Beranda"), body_cls="ph-body--flush")
    # Profile sheet: branch picker lives here, not in a clipped popover.
    sheet_bd = (
        '<div class="who-block"><span class="av" aria-hidden="true">PS</span>'
        '<div><div class="nm">Pemilik Senyum</div>'
        '<div class="role">Pemilik, dokter gigi</div></div></div>'
        '<p class="kicker">Cabang aktif</p>'
        '<div class="blist">'
        f'<button class="brow on" type="button">Senyum Sehat Kemang{ico("check")}</button>'
        "</div>"
    )
    # No primary teal in this sheet: choosing the branch is the action.
    profil = f"""
    <div class="drawer drawer--profil" role="dialog" aria-label="Profil">
      <div class="drawer-handle" aria-hidden="true"></div>
      <div class="drawer-hd"><h3>Profil</h3>
        {button("", "ghost", "lg", "x", icon_only=True, aria="Tutup")}</div>
      <div class="drawer-bd">{sheet_bd}</div>
    </div>"""
    after_sheet = phone(
        beranda_body(),
        beranda_chrome(),
        bnav("Beranda"),
        overlay=f'<div class="scrim" aria-hidden="true"></div>{profil}',
        body_cls="ph-body--flush",
    )
    body = (
        '<div class="compare">'
        + ph_col(before_ph("beranda", "Beranda staging, sebelum perbaikan"), "Sebelum, staging 360")
        + ph_col(after, "Sesudah. Header ringkas, tanpa tombol tambah. Tanggal muat.")
        + ph_col(after_sheet, "Profil dan cabang di lembar bawah. Nama cabang utuh.")
        + "</div>"
    )
    return ab(
        "02",
        "Beranda dokter, header dan tanggal",
        "Tanpa tombol + di header. Judul Pasien saya dan layanan tampil utuh, layanan boleh dua baris. "
        "Satu baris tanggal muat di 360. Pemilih cabang pindah ke lembar profil, bukan popover yang menimpa judul.",
        body,
    )


def cond(label: str, color: str, on: bool = False) -> str:
    cls = "cond on" if on else "cond"
    return (
        f'<button class="{cls}" type="button">'
        f'<span class="dot" style="background:{color}" aria-hidden="true"></span>{label}</button>'
    )


def ab03() -> str:
    hd = (
        '<header class="hd">'
        + button("", "ghost", "lg", "chevron-left", icon_only=True, aria="Kembali")
        + '<h1 class="h-sm">Rekam Medis</h1>'
        + button("", "ghost", "lg", "more", icon_only=True, aria="Lainnya")
        + "</header>"
        '<div class="pt-strip"><b>Hendra Hidayat</b>'
        "<span>65 th · Perempuan · BT-000009</span></div>"
    )
    body_od = odonto(["26"], tight=True)
    grid = (
        '<div class="cond-grid">'
        + cond("Karies", "#B42318", True)
        + cond("Tambalan", "#344054")
        + cond("Sehat", "#0B7A45")
        + cond("Fraktur", "#B54708")
        + "</div>"
    )
    fav = f'<div class="favs">{chip("Karies", "flat", True)}{chip("Tambalan", "bordered")}</div>'
    sheet_inner = (
        surfaces(("M", "O"))
        + tabs([("Permukaan", True), ("Seluruh gigi", False), ("Rentang", False)])
        + fav
        + grid
        + radios("rencana")
    )
    overlay = drawer("Gigi 26", sheet_inner, "Simpan")
    after = phone(
        body_od,
        hd,
        bnav("RM"),
        overlay=overlay,
        body_cls="ph-body--sheet",
    )
    body = (
        '<div class="compare">'
        + ph_col(before_ph("sheet", "Sheet gigi staging, ToothSheet lama"), "Sebelum, ToothSheet lama")
        + ph_col(after, "Sesudah, mengikuti odontogram v2 artboard 01 dan papan 09.")
        + "</div>"
    )
    return ab(
        "03",
        "Sheet gigi, HeroUI v2",
        "Identitas pasien hanya di chrome Rekam Medis, tidak diulang di lembar. "
        "Lima bantalan permukaan 56px dalam kisi, termasuk B. Tanpa teks Belum ada temuan, "
        "tanpa tab Tambal, tanpa chip bergaris kiri. Kondisi kisi dua kolom dengan titik warna. "
        "Satu aksi primer: Simpan.",
        body,
    )


def build() -> str:
    fonts = (
        '<link rel="preconnect" href="https://fonts.googleapis.com">'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&display=swap" rel="stylesheet">'
    )
    return f"""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bittodent · Perbaikan HP 2</title>
{fonts}
<style>
{TOKENS}
{css()}
</style>
</head>
<body>
<div class="wrap">
  <h1 class="page">Perbaikan HP 2</h1>
  <p class="lede">Tiga layar staging 360: daftar pasien, beranda dokter, dan sheet gigi.
  Setiap artboard menampilkan cuplikan sebelum (data sintetis) di kiri, usulan HeroUI di kanan.
  Teal hanya pada aksi primer. Satu aksi primer per layar. Target sentuh 48px. Grid 8pt.</p>
  {ab01()}
  {ab02()}
  {ab03()}
</div>
</body>
</html>
"""


def main() -> None:
    html = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html)
    ART.parent.mkdir(parents=True, exist_ok=True)
    ART.write_text(html)
    # Guardrails
    body = html.replace(TOKENS, "")
    dashes = body.count("\u2014") + body.count("\u2013")
    syn_n = html.count("DATA SINTETIS")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
    print(f"wrote {ART} ({ART.stat().st_size} bytes)")
    print(f"em/en dashes={dashes} (tokens.css comment ignored)  DATA SINTETIS={syn_n}")
    if dashes:
        raise SystemExit("em or en dash found")


if __name__ == "__main__":
    main()
