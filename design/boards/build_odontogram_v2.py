#!/usr/bin/env python3
"""Papan odontogram v2: taksonomi kondisi, sheet HeroUI, toggle 2D|3D.

Hasil: design/boards/odontogram-v2.html
dan /workspace/artifacts/bittodent-board-odontogram-v2.html
Data sintetis. Tanpa JavaScript. Tidak mengubah kode app.
Gaya setia HeroUI v3, token Bittodent. Teal #0B6B62 hanya tombol primer.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "design/boards/odontogram-v2.html"
ART = Path("/workspace/artifacts/bittodent-board-odontogram-v2.html")
TOKENS = (ROOT / "design/tokens.css").read_text()

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


CSS = r"""
:root{
  --motion-fast:120ms;--motion-std:200ms;--motion-slow:280ms;
  --motion-ease-standard:cubic-bezier(0.2, 0, 0, 1);
  --focus:2px solid var(--color-primary-700);
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
.ab-d{font-size:12px;font-weight:500;color:var(--color-neutral-500);margin:0 0 16px;max-width:860px;line-height:1.45}
.row{display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap}
.ph-col{display:flex;flex-direction:column;gap:8px;flex:none}
.ph-cap{margin:0;font-size:12px;font-weight:600;color:var(--color-neutral-600);max-width:360px;line-height:1.4}

.ic{width:20px;height:20px;flex:none}
.ic-sm{width:16px;height:16px}
.ic-btn{width:18px;height:18px}

.syn{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;
  background:#FFFAEB;color:#B54708;border:1px solid #F5C14A;font-size:10px;font-weight:700;letter-spacing:.04em}

/* HeroUI v3 button: sm 40, md 44, lg 48. Radius full. Press scale 0.97. */
.button{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-height:48px;padding:0 24px;border-radius:999px;border:0;font-size:14px;font-weight:600;
  background:transparent;color:var(--color-neutral-800);cursor:default;
  transition:transform var(--motion-fast) var(--motion-ease-standard),background var(--motion-fast) var(--motion-ease-standard)}
.button--sm{min-height:40px;padding:0 16px;font-size:13px}
.button--md{min-height:44px;padding:0 20px;font-size:14px}
.button--lg{min-height:48px;padding:0 24px}
.button--primary{background:var(--color-primary-700);color:#fff}
.button--primary:hover{background:var(--color-primary-800)}
.button--secondary{background:var(--color-primary-50);color:var(--color-primary-800)}
.button--outline{background:#fff;color:var(--color-primary-800);border:1px solid var(--color-primary-200)}
.button--ghost{background:transparent;color:var(--color-neutral-700)}
.button--danger-soft{background:var(--color-danger-bg);color:var(--color-danger-fg)}
.button--icon{width:48px;height:48px;padding:0;border-radius:14px;min-height:48px}
.button:active{transform:scale(.97)}
.button:focus-visible,.chip:focus-visible,.tab:focus-visible,.litem:focus-visible,.radio:focus-visible,.surf b:focus-visible,.tth:focus-visible{
  outline:var(--focus);outline-offset:2px}

/* Chip: HeroUI sm/md/lg, radius full, variants solid/bordered/flat/dot */
.chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;
  font-size:12px;font-weight:600;border:1px solid transparent;background:var(--color-neutral-100);color:var(--color-neutral-700)}
.chip--lg{height:32px;padding:0 12px}
.chip--solid{background:var(--color-primary-700);color:#fff}
.chip--bordered{background:#fff;border-color:var(--color-neutral-200)}
.chip--flat{background:var(--color-primary-50);color:var(--color-primary-800)}
.chip--dot::before{content:"";width:8px;height:8px;border-radius:99px;background:currentColor;flex:none}
.chip.on{background:var(--color-primary-50);color:var(--color-primary-800);border-color:var(--color-primary-200)}

.st-ada{background:#EEF0F4;color:#344054}
.st-lain{background:#E8F0FE;color:#1D4ED8}
.st-rencana{background:#FFFAEB;color:#B54708}
.st-selesai{background:#ECFDF3;color:#0B7A45}

.ph{width:360px;background:#fff;border:1px solid var(--color-neutral-200);
  border-radius:28px;overflow:hidden;position:relative;display:flex;flex-direction:column;flex:none;
  box-shadow:0 8px 24px rgba(22,33,43,.06)}
.ph-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 16px 0;min-height:28px}
.ph-time{font-size:12px;font-weight:600}
.hd{background:#fff;padding:0 8px;display:flex;align-items:center;gap:8px;min-height:56px;
  border-bottom:1px solid var(--color-neutral-100)}
.h-sm{margin:0;font-size:16px;font-weight:700;flex:1}
.ph-body{flex:1;background:var(--color-canvas);padding:12px 16px;display:flex;flex-direction:column;gap:12px;min-height:0;overflow:hidden}
.bnav{flex:none;min-height:80px;background:#fff;border-top:1px solid var(--color-neutral-200);display:flex;padding:4px 4px 12px}
.navi{flex:1;border:0;background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:2px;font-size:10px;font-weight:700;color:var(--color-neutral-500);min-height:48px;border-radius:14px}
.navi.on{color:var(--color-primary-700)}
.mu{font-size:12px;font-weight:500;color:var(--color-neutral-500)}
.kicker{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--color-neutral-500)}

.desk{width:1280px;background:#fff;border:1px solid var(--color-neutral-200);
  border-radius:16px;overflow:hidden;display:flex;flex:none;box-shadow:0 8px 24px rgba(22,33,43,.06)}
.rail{width:72px;background:#F4F7F7;border-right:1px solid var(--color-neutral-200);display:flex;flex-direction:column;
  align-items:center;padding:16px 8px 12px;gap:4px;flex:none}
.rail .logo{width:40px;height:40px;border-radius:14px;background:var(--color-primary-700);color:#fff;display:grid;place-items:center;margin-bottom:8px}
.rbtn{width:48px;height:48px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:2px;color:var(--color-neutral-500);font-size:9px;font-weight:700;border:0;background:transparent}
.rbtn.on{background:var(--color-primary-700);color:#fff}
.desk-col{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--color-canvas)}
.top{display:flex;align-items:center;justify-content:space-between;min-height:56px;padding:0 16px 0 20px;
  background:#fff;border-bottom:1px solid var(--color-neutral-200);gap:12px}
.top h2{margin:0;font-size:16px;font-weight:700}
.crumb{font-size:12px;font-weight:600;color:var(--color-neutral-500)}
.desk-body{flex:1;padding:16px;display:flex;flex-direction:column;gap:16px;min-height:0}

/* HeroUI tabs: muted track, selected pill */
.tabs{display:flex;gap:4px;padding:4px;background:var(--color-neutral-100);border-radius:14px}
.tab{flex:1;min-height:48px;border:0;border-radius:10px;background:transparent;color:var(--color-neutral-600);
  font-size:13px;font-weight:600;display:grid;place-items:center;padding:0 8px}
.tab.on{background:#fff;color:var(--color-neutral-900);box-shadow:0 1px 2px rgba(22,33,43,.08)}

/* SearchField */
.search{position:relative}
.search .ic{position:absolute;left:12px;top:14px;color:var(--color-neutral-400)}
.search input,.search .fake{width:100%;min-height:48px;padding:0 12px 0 40px;border-radius:14px;
  border:1px solid var(--color-neutral-200);background:#fff;font-size:14px;font-weight:500;color:var(--color-neutral-800)}
.search .fake{display:flex;align-items:center;color:var(--color-neutral-400)}
.search .fake.has{color:var(--color-neutral-800)}

.favs{display:flex;flex-wrap:wrap;gap:8px}

/* Listbox */
.litem{display:flex;align-items:center;gap:12px;min-height:48px;padding:0 12px;border-radius:10px;
  background:transparent;border:0;width:100%;text-align:left;font-size:14px;font-weight:600;color:var(--color-neutral-800)}
.litem .sub{margin-left:auto;font-size:11px;font-weight:700;letter-spacing:.04em;color:var(--color-neutral-500);text-transform:uppercase}
.litem.on{background:var(--color-primary-50);color:var(--color-primary-900)}
.litem:hover{background:var(--color-neutral-50)}
.list{display:flex;flex-direction:column;gap:4px}

/* RadioGroup status */
.radios{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.radio{display:flex;align-items:center;gap:8px;min-height:48px;padding:0 12px;border-radius:14px;
  border:1px solid var(--color-neutral-200);background:#fff;font-size:12px;font-weight:600;color:var(--color-neutral-800)}
.radio .dot{width:16px;height:16px;border-radius:99px;border:1.5px solid var(--color-neutral-300);flex:none;display:grid;place-items:center;background:#fff}
.radio .dot i{width:8px;height:8px;border-radius:99px;background:transparent;display:block}
.radio.on{border-color:var(--color-primary-300);background:var(--color-primary-50)}
.radio.on .dot{border-color:var(--color-primary-700)}
.radio.on .dot i{background:var(--color-primary-700)}

/* Drawer / bottom sheet, HeroUI placement bottom */
.drawer{position:absolute;left:0;right:0;bottom:0;z-index:4;background:#fff;
  border-radius:16px 16px 0 0;box-shadow:0 -8px 32px rgba(22,33,43,.14);
  display:flex;flex-direction:column;max-height:62%;
  animation:drawer-in var(--motion-slow) var(--motion-ease-standard)}
@keyframes drawer-in{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}
.drawer-handle{width:48px;height:4px;border-radius:999px;background:var(--color-neutral-300);margin:8px auto 0;flex:none}
.drawer-hd{display:flex;align-items:center;gap:8px;min-height:48px;padding:0 8px 0 16px}
.drawer-hd h3{margin:0;font-size:16px;font-weight:700;flex:1}
.drawer-bd{padding:0 16px 8px;display:flex;flex-direction:column;gap:8px;overflow:auto;min-height:0}
.drawer-ft{flex:none;padding:8px 16px 12px;border-top:1px solid var(--color-neutral-100);
  display:flex;justify-content:stretch}
.drawer-ft .button--primary{flex:1}

.surf{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.surf b{min-height:56px;min-width:48px;border-radius:14px;border:1px solid var(--color-neutral-200);background:#fff;
  display:grid;place-items:center;font-size:13px;font-weight:700;color:var(--color-neutral-600)}
.surf b.on{background:var(--color-primary-700);color:#fff;border-color:var(--color-primary-700)}

/* 2D odontogram */
.od{background:#fff;border:1px solid var(--color-neutral-200);border-radius:16px;padding:8px}
.od-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.od-hd h3{margin:0;font-size:14px;font-weight:700}
.toggle{display:flex;gap:4px;padding:4px;background:var(--color-neutral-100);border-radius:14px}
.toggle .tab{flex:none;min-width:48px;padding:0 14px;min-height:40px}
.od-lab{text-align:center;font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--color-neutral-500);margin:4px 0}
.od-row{display:flex;gap:3px;justify-content:center}
.tth{width:18px;height:28px;border-radius:6px;border:1px solid var(--color-neutral-200);background:#fff;
  display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:0 0 2px;
  font-size:7px;font-weight:800;color:var(--color-neutral-600);position:relative}
.tth .face{width:12px;height:12px;border-radius:2px;border:1px solid var(--color-neutral-300);background:#fff;margin-bottom:1px}
.tth.on{border-color:var(--color-primary-700);background:var(--color-primary-50);color:var(--color-primary-800)}
.tth.on .face{background:#FDECEC;border-color:#BE123C}
.tth.abu{border-color:#6D28D9;background:#F5F3FF;color:#6D28D9}
.tth.abu .face{background:#EDE9FE;border-color:#6D28D9}
.tth.pon{border-color:#344054;background:#EEF0F4;color:#344054}
.tth.pon .face{background:#D4DBE1;border-color:#344054}
.tth.span{box-shadow:0 0 0 2px rgba(109,40,217,.35)}
.bridge-bar{height:4px;background:#6D28D9;border-radius:99px;margin:4px auto 0;width:58px}

.note-ro{display:flex;align-items:center;gap:8px;min-height:40px;padding:0 12px;border-radius:14px;
  background:#E8F0FE;color:#1D4ED8;font-size:12px;font-weight:600}

/* Legend */
.leg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.leg-card{background:#fff;border:1px solid var(--color-neutral-200);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:8px}
.leg-card h3{margin:0;font-size:14px;font-weight:700}
.leg-item{display:flex;align-items:center;gap:10px;min-height:32px;font-size:13px;font-weight:600}
.sym{width:28px;height:28px;border-radius:8px;border:1px solid var(--color-neutral-200);background:#fff;
  display:grid;place-items:center;flex:none;position:relative}
.sym svg{width:18px;height:18px}
.sym-lab{font-size:11px;font-weight:700;color:var(--color-neutral-500);margin-left:auto}

.view-3d{width:100%;border-radius:16px;border:1px solid var(--color-neutral-200);background:#fff;object-fit:contain;max-height:420px}
.view-3d.hp{max-height:280px}

@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation:none !important;transition:none !important}
}
"""


def syn() -> str:
    return '<span class="syn">DATA SINTETIS</span>'


def button(label: str, variant: str = "primary", size: str = "lg", icon: str | None = None, icon_only: bool = False, aria: str = "") -> str:
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


def tabs(items: list[tuple[str, bool]]) -> str:
    bits = []
    for lab, on in items:
        cls = "tab on" if on else "tab"
        bits.append(f'<button class="{cls}" type="button">{lab}</button>')
    return f'<div class="tabs" role="tablist">{"".join(bits)}</div>'


def toggle_2d(is_2d: bool, size_sm: bool = False) -> str:
    a = "tab on" if is_2d else "tab"
    b = "tab on" if not is_2d else "tab"
    sm = " toggle" if True else ""
    return (
        f'<div class="toggle{"" if size_sm else ""}" role="tablist" aria-label="Tampilan bagan">'
        f'<button class="{a}" type="button">2D</button>'
        f'<button class="{b}" type="button">3D</button></div>'
    )


def search(value: str = "") -> str:
    if value:
        inner = f'<div class="fake has">{value}</div>'
    else:
        inner = '<div class="fake">Cari kondisi</div>'
    return f'<div class="search">{ico("search")}<span class="visually-hidden"></span>{inner}</div>'


def litem(label: str, code: str, on: bool = False, mark: str = "") -> str:
    cls = "litem on" if on else "litem"
    glyph = mark or f'<span class="sym" aria-hidden="true"></span>'
    return f'<button class="{cls}" type="button">{glyph}<span>{label}</span><span class="sub">{code}</span></button>'


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
            f'<button class="radio{on}" type="button"><span class="dot" aria-hidden="true"><i></i></span>{lab}</button>'
        )
    return f'<div class="radios" role="radiogroup" aria-label="Status kondisi">{"".join(bits)}</div>'


def surfaces(on: tuple[str, ...] = ()) -> str:
    pads = "".join(
        f'<b class="{"on" if n in on else ""}">{n}</b>' for n in ("M", "O", "D", "B", "L")
    )
    return f'<div class="surf">{pads}</div>'


def bnav(active: str = "RM") -> str:
    items = [("Beranda", "home"), ("Jadwal", "calendar"), ("Pasien", "users"), ("RM", "tooth"), ("Lainnya", "more")]
    out = []
    for lab, icon in items:
        on = " on" if lab == active else ""
        show = "Rekam Medis" if lab == "RM" else lab
        out.append(f'<button class="navi{on}" type="button">{ico(icon)}<span>{show}</span></button>')
    return f'<nav class="bnav">{"".join(out)}</nav>'


def phone(inner: str, title: str, overlay: str = "", back: bool = True, height: int = 800) -> str:
    left = button("", "ghost", "lg", "chevron-left", icon_only=True, aria="Kembali") if back else ""
    return f"""
    <div class="ph" style="height:{height}px">
      <div class="ph-bar">{syn()}<span class="ph-time">09.40</span></div>
      <header class="hd">{left}<h1 class="h-sm">{title}</h1>
        {button("", "ghost", "lg", "more", icon_only=True, aria="Lainnya")}</header>
      <div class="ph-body">{inner}</div>
      {bnav()}
      {overlay}
    </div>"""


def rail(active: str = "RM") -> str:
    items = [("Beranda", "home"), ("Jadwal", "calendar"), ("Pasien", "users"), ("RM", "tooth")]
    bits = [f'<div class="logo">{ico("tooth")}</div>']
    for lab, icon in items:
        on = " on" if lab == active else ""
        bits.append(f'<button class="rbtn{on}" type="button">{ico(icon)}<span>{lab}</span></button>')
    bits.append('<div style="flex:1"></div>')
    bits.append(f'<button class="rbtn" type="button">{ico("more")}<span>Lainnya</span></button>')
    return f'<aside class="rail">{"".join(bits)}</aside>'


def desk(body: str, title: str, crumb: str, height: int = 720) -> str:
    return f"""
    <div class="desk" style="height:{height}px">
      {rail()}
      <div class="desk-col">
        <div class="top">
          <div><h2>{title}</h2><div class="crumb">{crumb}</div></div>
          <div style="display:flex;align-items:center;gap:8px">{syn()}<span class="mu">drg. Andi Contoh</span></div>
        </div>
        <div class="desk-body">{body}</div>
      </div>
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


UPPER = ["18","17","16","15","14","13","12","11","21","22","23","24","25","26","27","28"]
LOWER = ["48","47","46","45","44","43","42","41","31","32","33","34","35","36","37","38"]


def odonto(active: list[str] | None = None, roles: dict[str, str] | None = None, is_2d: bool = True) -> str:
    active = active or []
    roles = roles or {}

    def cell(n: str) -> str:
        cls = "tth"
        if n in roles:
            cls += " " + roles[n]
            if roles[n] in ("abu", "pon"):
                cls += " span"
        elif n in active:
            cls += " on"
        return f'<button class="{cls}" type="button" aria-label="Gigi {n}"><span class="face"></span>{n}</button>'

    def row(nums: list[str]) -> str:
        return f'<div class="od-row">{"".join(cell(n) for n in nums)}</div>'

    bar = ""
    if any(r in roles for r in ("abu", "pon")):
        bar = '<div class="bridge-bar" aria-hidden="true"></div>'
    tog = toggle_2d(is_2d, True)
    return f"""
    <div class="od">
      <div class="od-hd"><h3>Odontogram</h3>{tog}</div>
      <div class="od-lab">RAHANG ATAS</div>{row(UPPER)}
      <div class="od-lab">RAHANG BAWAH</div>{row(LOWER)}
      {bar}
    </div>"""


def drawer(title: str, body: str, save: str = "Simpan") -> str:
    return f"""
    <div class="drawer" role="dialog" aria-label="{title}">
      <div class="drawer-handle" aria-hidden="true"></div>
      <div class="drawer-hd"><h3>{title}</h3>
        {button("", "ghost", "lg", "x", icon_only=True, aria="Tutup")}</div>
      <div class="drawer-bd">{body}</div>
      <div class="drawer-ft">{button(save, "primary", "lg")}</div>
    </div>"""


def mark(kind: str, color: str) -> str:
    # compact SVG glyphs for list and legend
    paths = {
        "dots": f'<circle cx="9" cy="12" r="2" fill="{color}"/><circle cx="15" cy="12" r="2" fill="{color}"/><circle cx="12" cy="8" r="2" fill="{color}"/>',
        "solid": f'<rect x="6" y="6" width="12" height="12" rx="2" fill="{color}"/>',
        "s": f'<text x="12" y="16" text-anchor="middle" font-size="11" font-weight="800" fill="{color}">S</text>',
        "hatch": f'<path d="M7 17 17 7" stroke="{color}" stroke-width="2"/><path d="M9 17 17 9" stroke="{color}" stroke-width="2"/>',
        "flat": f'<path d="M6 14h12M6 16h12" stroke="{color}" stroke-width="2"/>',
        "zag": f'<path d="M6 16 10 8 14 16 18 8" stroke="{color}" stroke-width="2" fill="none"/>',
        "ring": f'<circle cx="12" cy="12" r="7" fill="none" stroke="{color}" stroke-width="2.5"/>',
        "rings": f'<circle cx="12" cy="12" r="7" fill="none" stroke="{color}" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="{color}" stroke-width="1.5"/>',
        "band": f'<rect x="5" y="9" width="14" height="6" rx="1" fill="{color}"/>',
        "box": f'<rect x="7" y="7" width="10" height="10" fill="none" stroke="{color}" stroke-width="2"/>',
        "boxedge": f'<rect x="6" y="8" width="12" height="8" fill="none" stroke="{color}" stroke-width="2"/><path d="M6 8h12" stroke="{color}" stroke-width="3"/>',
        "root": f'<path d="M12 5v6M8 19 12 11 16 19" stroke="{color}" stroke-width="2" fill="none"/>',
        "xmark": f'<path d="M7 7l10 10M17 7 7 17" stroke="{color}" stroke-width="2.4"/>',
        "slash": f'<path d="M8 18 16 6" stroke="{color}" stroke-width="2.4"/>',
        "mob": f'<text x="12" y="16" text-anchor="middle" font-size="9" font-weight="800" fill="{color}">II</text>',
        "arrow": f'<path d="M8 16 16 8M16 8h-5M16 8v5" stroke="{color}" stroke-width="2" fill="none"/>',
        "ghost": f'<rect x="6" y="5" width="12" height="14" rx="2" fill="none" stroke="{color}" stroke-width="1.5" stroke-dasharray="2 2"/>',
        "half": f'<path d="M12 5v14M12 5a7 7 0 0 1 0 14" fill="none" stroke="{color}" stroke-width="2"/>',
        "key": f'<path d="M8 14h8M12 8v8" stroke="{color}" stroke-width="2"/>',
        "gap": f'<path d="M8 6v12M16 6v12" stroke="{color}" stroke-width="2"/>',
        "spin": f'<path d="M12 5v4M16 8l2-3M8 8 6 5" stroke="{color}" stroke-width="2"/>',
        "pontic": f'<rect x="6" y="8" width="12" height="8" fill="{color}"/><path d="M4 6h16" stroke="{color}" stroke-width="2"/>',
        "abut": f'<circle cx="12" cy="12" r="6" fill="none" stroke="{color}" stroke-width="2"/><path d="M4 6h16" stroke="{color}" stroke-width="2"/>',
        "bar": f'<path d="M5 12h14M5 9v6M19 9v6" stroke="{color}" stroke-width="2"/>',
        "brace": f'<path d="M7 6v12M7 6h5M7 18h5M17 6v12" stroke="{color}" stroke-width="2"/>',
        "full": f'<path d="M5 8h14v8H5z" fill="none" stroke="{color}" stroke-width="2"/>',
        "brk": f'<rect x="7" y="8" width="10" height="8" rx="1" fill="none" stroke="{color}" stroke-width="2"/>',
        "screw": f'<path d="M12 4v16M9 8h6M9 12h6M10 20h4" stroke="{color}" stroke-width="2"/>',
        "check": f'<path d="M6 12l4 4 8-8" stroke="{color}" stroke-width="2.4" fill="none"/>',
        "sq": f'<rect x="7" y="7" width="10" height="10" fill="{color}"/>',
        "sqo": f'<rect x="7" y="7" width="10" height="10" fill="none" stroke="{color}" stroke-width="2"/>',
        "tri": f'<path d="M12 6 18 18H6z" fill="none" stroke="{color}" stroke-width="2" stroke-dasharray="2 2"/>',
    }
    g = paths.get(kind, paths["solid"])
    return f'<span class="sym" aria-hidden="true"><svg viewBox="0 0 24 24">{g}</svg></span>'


# Condition lists for listboxes and legend
PERM = [
    ("Karies", "car", "dots", "#BE123C"),
    ("Tambalan amalgam", "amf", "solid", "#1A1A1A"),
    ("Tambalan komposit", "cof", "solid", "#0B7A45"),
    ("Tambalan GIC", "gif", "solid", "#0E7490"),
    ("Sealant", "fis", "s", "#9D174D"),
    ("Abrasi", "abr", "hatch", "#92400E"),
    ("Erosi", "ero", "hatch", "#B45309"),
    ("Atrisi", "at", "flat", "#7A5C00"),
    ("Fraktur", "cfr", "zag", "#9F1239"),
]
WHOLE = [
    ("Mahkota logam", "fmc", "ring", "#6B7280"),
    ("Mahkota porselen", "poc", "ring", "#6D28D9"),
    ("Mahkota metal porselen", "mpc", "rings", "#6D28D9"),
    ("Veneer", "ven", "band", "#7C3AED"),
    ("Inlay", "inl", "box", "#1E40AF"),
    ("Onlay", "onl", "boxedge", "#1E40AF"),
    ("Perawatan saluran akar", "rct", "root", "#1E40AF"),
    ("Sisa akar", "rrx", "root", "#9A3412"),
    ("Hilang", "mis", "xmark", "#3F3F46"),
    ("Perlu dicabut", "ext", "slash", "#A15C00"),
    ("Goyang", "mob", "mob", "#B54708"),
    ("Impaksi", "imv", "arrow", "#0F5F63"),
    ("Belum erupsi", "une", "ghost", "#5F6C77"),
    ("Erupsi sebagian", "pre", "half", "#5F6C77"),
    ("Gigi sulung persisten", "per", "key", "#0E7490"),
    ("Diastema", "dia", "gap", "#344054"),
    ("Rotasi / malposisi", "mal", "spin", "#6D28D9"),
]
SPAN = [
    ("Bridge, pontic", "pon", "pontic", "#344054"),
    ("Bridge, abutment", "abu", "abut", "#6D28D9"),
    ("Splint", "spl", "bar", "#344054"),
    ("Gigi tiruan sebagian", "prd", "brace", "#344054"),
    ("Gigi tiruan penuh", "fld", "full", "#344054"),
    ("Orto, bracket", "brk", "brk", "#0E7490"),
]
IMPL = [("Implan", "imp", "screw", "#0F5F63")]


def listbox(rows: list[tuple], selected: str = "", limit: int | None = None) -> str:
    items = rows if limit is None else rows[:limit]
    bits = []
    for lab, code, kind, color in items:
        bits.append(litem(lab, code, on=(lab == selected), mark=mark(kind, color)))
    return f'<div class="list" role="listbox">{"".join(bits)}</div>'


def ab01() -> str:
    body = (
        tabs([("Permukaan", True), ("Seluruh gigi", False), ("Rentang", False)])
        + search("")
        + f'<div class="favs">{chip("Favorit", "bordered")}{chip("Karies", "flat", True)}{chip("Komposit", "bordered")}{chip("Fraktur", "bordered")}</div>'
        + surfaces(("M", "O"))
        + listbox(PERM, "Karies", limit=1)
        + radios("rencana")
    )
    ov = drawer("Gigi 26", body)
    inner = (
        '<p class="mu" style="margin:0">Budi Santoso · kunjungan hari ini</p>'
        + odonto(active=["26"])
    )
    return ab(
        "01",
        "Sheet permukaan, karies",
        "Drawer bawah setia HeroUI: handle 48px, header, tab Permukaan, pencarian, Favorit dan terakhir di atas listbox, pad 56px, radio status, satu tombol Simpan. Karies pada M dan O, status Rencana.",
        phone(inner, "Rekam Medis", overlay=ov),
    )


def ab02() -> str:
    body = (
        tabs([("Permukaan", False), ("Seluruh gigi", True), ("Rentang", False)])
        + f'<div class="favs">{chip("Favorit", "bordered")}{chip("Mahkota porselen", "flat", True)}{chip("PSA", "bordered")}{chip("Veneer", "bordered")}</div>'
        + listbox(WHOLE, "Mahkota porselen", limit=3)
        + radios("ada")
        + '<p class="mu" style="margin:0">ICD-10 Z97.2 · ICD-9-CM 23.41 (contoh).</p>'
    )
    ov = drawer("Gigi 26", body)
    inner = (
        '<p class="mu" style="margin:0">Budi Santoso · kunjungan hari ini</p>'
        + odonto(active=["26"])
    )
    return ab(
        "02",
        "Seluruh gigi, mahkota",
        "Tab Seluruh gigi. Mahkota porselen (poc) dipilih, status Ada sebelumnya. Tidak ada pad permukaan. Kode ICD contoh tampil sebagai teks ringkas, bukan stepper.",
        phone(inner, "Rekam Medis", overlay=ov),
    )


def ab03() -> str:
    roles = {"34": "abu", "35": "pon", "36": "abu"}
    body = (
        tabs([("Permukaan", False), ("Seluruh gigi", False), ("Rentang", True)])
        + search("bridge")
        + '<p class="mu" style="margin:0">34 dan 36 abutment, 35 pontic. Ketuk gigi di bagan untuk ganti peran.</p>'
        + listbox(SPAN, "Bridge, pontic", limit=2)
        + radios("rencana")
    )
    ov = drawer("Bridge 34-36", body)
    inner = (
        '<p class="mu" style="margin:0">Sari Nugroho · kunjungan hari ini</p>'
        + odonto(roles=roles)
    )
    return ab(
        "03",
        "Rentang, bridge 34-36",
        "Tab Rentang. Ketuk gigi di odontogram 2D untuk menandai abutment dan pontic. Rentang 34-36 tersorot, batang penghubung tampak. Status Rencana. Satu aksi Simpan.",
        phone(inner, "Rekam Medis", overlay=ov),
    )


def _leg_group(title: str, rows: list[tuple], extra: str = "") -> str:
    items = "".join(
        f'<div class="leg-item">{mark(k, c)}<span>{lab}</span><span class="sym-lab">{code}</span></div>'
        for lab, code, k, c in rows
    )
    return f'<article class="leg-card"><h3>{title}{extra}</h3>{items}</article>'


def ab04() -> str:
    st = (
        '<article class="leg-card"><h3>Status (warna + ikon, AA)</h3>'
        f'<div class="leg-item">{mark("sq", "#344054")}<span>Ada sebelumnya</span><span class="chip st-ada">ada</span></div>'
        f'<div class="leg-item">{mark("sqo", "#1D4ED8")}<span>Dikerjakan klinik lain</span><span class="chip st-lain">lain</span></div>'
        f'<div class="leg-item">{mark("tri", "#B54708")}<span>Rencana</span><span class="chip st-rencana">rencana</span></div>'
        f'<div class="leg-item">{mark("check", "#0B7A45")}<span>Selesai hari ini</span><span class="chip st-selesai">selesai</span></div>'
        '<p class="mu" style="margin:0">Teal merek tidak dipakai sebagai warna status. Permukaan: M O/I D B L.</p>'
        "</article>"
    )
    sehat = (
        '<article class="leg-card"><h3>Baseline</h3>'
        f'<div class="leg-item">{mark("check", "#0B7A45")}<span>Sehat</span><span class="sym-lab">sou</span></div>'
        '<p class="mu" style="margin:0">Bukan kondisi terawat. Tidak masuk hitungan 33.</p>'
        "</article>"
    )
    body = (
        '<p class="mu" style="margin:0">33 kondisi + sehat. Tanda = warna dan bentuk, kontras non-teks minimal 3:1. Bukan formulir resmi PDGI. Permukaan: M O/I D B L.</p>'
        + '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">'
        + f'{mark("check", "#0B7A45")}<span class="mu">Sehat (sou)</span>'
        + '<span class="chip st-ada">Ada sebelumnya</span>'
        + '<span class="chip st-lain">Klinik lain</span>'
        + '<span class="chip st-rencana">Rencana</span>'
        + '<span class="chip st-selesai">Selesai hari ini</span></div>'
        + '<div class="leg-grid">'
        + _leg_group("Permukaan, 9", PERM)
        + _leg_group("Seluruh gigi, 17", WHOLE)
        + _leg_group("Rentang, 6 + implan, 1", SPAN + IMPL)
        + "</div>"
    )
    return ab(
        "04",
        "Legenda simbol 2D",
        "Semua kondisi per kelompok, plus baseline sehat dan empat status. Singkatan lazim (car, amf, poc, pon, dan seterusnya) sebagai kode tampilan. Desktop 1280.",
        desk(body, "Odontogram", "15 Nov 2026 · Senyum Sehat Kemang · Budi Santoso", 940),
    )


def ab05() -> str:
    img3d_hp = '<img class="view-3d hp" src="../odontogram/preview/odontogram-3d-blender-full.png" alt="Pratinjau odontogram 3D, hanya baca">'
    img3d_desk = '<img class="view-3d" src="../odontogram/preview/odontogram-3d-full.png" alt="Pratinjau odontogram 3D, hanya baca">'
    ph_2d = phone(
        '<p class="mu" style="margin:0">Budi Santoso · ketuk gigi untuk mencatat.</p>'
        + odonto(active=["26"], is_2d=True)
        + '<p class="mu" style="margin:0">Mode Dokter: input hanya di 2D. Target gigi cukup besar untuk ketuk bersarung.</p>',
        "Rekam Medis",
    )
    ph_3d = phone(
        '<p class="mu" style="margin:0">Budi Santoso · tampilan baca.</p>'
        + f'<div class="od"><div class="od-hd"><h3>Odontogram</h3>{toggle_2d(False)}</div>{img3d_hp}</div>'
        + '<div class="note-ro">3D untuk edukasi dan ringkasan. Ubah kondisi di tampilan 2D.</div>',
        "Rekam Medis",
    )
    desk_3d = desk(
        f'<div class="od"><div class="od-hd"><h3>Odontogram</h3>{toggle_2d(False)}</div>'
        f'<div class="note-ro">Tampilan 3D, hanya baca. Untuk mencatat karies, mahkota, atau bridge, kembali ke 2D.</div>'
        f"{img3d_desk}</div>",
        "Rekam Medis",
        "15 Nov 2026 · Senyum Sehat Kemang · Budi Santoso",
        760,
    )
    body = (
        '<div class="row">'
        + ph_col(ph_2d, "HP, toggle 2D. Input ketuk gigi, 48-56px.")
        + ph_col(ph_3d, "HP, toggle 3D. Hanya baca, aset 3D yang sudah ada. Lazy, bukan input.")
        + "</div>"
        + '<div class="row" style="margin-top:24px">'
        + desk_3d
        + "</div>"
    )
    return ab(
        "05",
        "Toggle 2D atau 3D",
        "2D tetap input utama di HP dan desktop. 3D memakai aset port yang sudah ada, untuk baca dan edukasi pasien. Jika gerakan dikurangi atau 3D gagal muat, bagan tetap 2D.",
        body,
    )


def build() -> str:
    parts = [ab01(), ab02(), ab03(), ab04(), ab05()]
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
<div class="wrap">
  <h1 class="page">Odontogram v2: kondisi lengkap, 2D untuk input, 3D untuk baca</h1>
  <p class="lede">Sheet gigi memakai pola HeroUI v3 (drawer, tabs, chip, listbox, radio, tombol lg 48px, radius penuh, fokus 2px). Token Bittodent, teal hanya pada tombol primer. 33 kondisi dalam empat kelompok. Data sintetis. Lihat juga design/odontogram-kondisi.md.</p>
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
