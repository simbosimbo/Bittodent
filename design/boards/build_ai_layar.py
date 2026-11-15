#!/usr/bin/env python3
"""Papan layar AI: A4 pindai KTP, A1 Saran ICD, A2 Saran tindakan, Ringkasan medis, peran.

Hasil: design/boards/ai-layar.html dan /workspace/artifacts/ai-layar.html
Data sintetis. Tanpa JavaScript. Tidak mengubah kode app.
Dasar shell: feat/jadwal-mobile 0a5ba9e (top bar ramping, bottom nav 5 kolom, sheet ber-handle).
Komponen bersama papan menu-pengaturan-mode, simbol dan taksonomi odontogram-v2 (11e6432).
Teal #0B6B62 hanya tombol primer. Kontrol terpilih primary-800. Grid 8pt.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_menu_pengaturan_mode as M  # noqa: E402
import build_odontogram_v2 as O  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "design/boards/ai-layar.html"
ART = Path("/workspace/artifacts/ai-layar.html")

M.ICONS.update({
    "camera": '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    "image": '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    "pen": '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    "quote": '<path d="M7 7h4v4c0 3-2 5-4 6M15 7h4v4c0 3-2 5-4 6"/>',
    "info": '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    "eye": '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    "undo": '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    "pill": '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="M9.5 8.5l5 7"/>',
    "heart": '<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z"/>',
    "history": '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    "list": '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    "dots": '<circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none"/>',
})
ico = M.ico
btn = M.btn
syn = M.syn

CSS = r"""
:root{--sel:var(--color-primary-800);--sel-bg:var(--color-primary-50);--r-sheet:16px}
.ab-row{display:flex;gap:24px;align-items:flex-start}
.ab-col{display:flex;flex-direction:column;gap:24px}
/* Top bar, jadwal-mobile 0a5ba9e: back + title + synthetic badge, 56px */
.hd .ttl{flex:1;min-width:0;font-size:17px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pbar{display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 16px;background:#fff;border-bottom:1px solid var(--color-neutral-100)}
.pbar .av{width:40px;height:40px;font-size:14px}
.pbar .pt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font-size:15px;font-weight:700}
.pbar .pt small{font-size:12px;font-weight:500;color:var(--color-neutral-500)}
/* Segmented tabs: track neutral-100, selected pill white + primary-800 */
.seg{display:flex;background:var(--color-neutral-100);border-radius:12px;padding:4px;gap:4px}
.seg span{flex:1;min-height:40px;display:flex;align-items:center;justify-content:center;gap:6px;border-radius:8px;font-size:14px;font-weight:600;color:var(--color-neutral-600)}
.seg span.on{background:#fff;color:var(--sel);box-shadow:0 1px 2px rgba(16,24,40,.08)}
.seg span i{font-style:normal;font-size:12px;font-weight:700;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:var(--color-neutral-100);display:inline-grid;place-items:center}
.seg span.on i{background:var(--sel-bg)}
.seg-hit{padding:0;margin:-4px 0}
/* Chips 28, icon + label */
.chip svg{width:16px;height:16px}
.chip.draf{background:var(--color-draft-bg);color:var(--color-draft-fg)}
.chip.no{background:var(--color-danger-bg);color:var(--color-danger-fg)}
.chip.enc{background:var(--color-neutral-100);color:var(--color-neutral-700)}
.chip.line{background:#fff;box-shadow:inset 0 0 0 1px var(--color-neutral-200);color:var(--color-neutral-700)}
/* AI card */
.aic{background:#fff;border:1px solid var(--color-neutral-200);border-left-width:4px;border-radius:16px;padding:12px 16px 16px;display:flex;flex-direction:column;gap:8px}
.aic.draf{border-left-color:var(--color-draft-border)}
.aic.ok{border-left-color:var(--color-success-border)}
.aic.no{border-left-color:var(--color-danger-border);background:var(--color-neutral-50)}
.aic .top{display:flex;align-items:center;gap:8px;min-height:28px}
.aic .top .chip{margin-left:auto}
.sys{display:inline-flex;align-items:center;height:20px;padding:0 6px;border-radius:6px;background:var(--color-neutral-100);color:var(--color-neutral-700);font-size:11px;font-weight:700}
.code{font-size:16px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:0}
.dsp{font-size:14px;font-weight:500;color:var(--color-neutral-800);line-height:1.4}
.cite{align-self:flex-start;display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:0 12px;border-radius:12px;border:1px solid var(--color-neutral-200);background:#fff;
  font-size:13px;font-weight:600;color:var(--color-neutral-800)}
.cite svg{width:16px;height:16px;color:var(--color-neutral-500)}
.cite.on{border:2px solid var(--sel);background:var(--sel-bg);color:var(--sel);padding:0 11px}
.cite .sym{width:24px;height:24px}
.acts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.acts.three{grid-template-columns:1fr 48px 1fr}
.acts .button{border-radius:14px;padding:0 16px}
.button--icon.sq{border-radius:14px;width:48px}
.ghosttxt{font-size:13px;font-weight:600;color:var(--color-neutral-500)}
.sum{display:flex;align-items:center;gap:8px;min-height:48px;padding:0 16px;border:1px solid var(--color-neutral-200);border-radius:14px;background:#fff;font-size:14px;font-weight:600;color:var(--color-neutral-700)}
.sum .ic:last-child{margin-left:auto;color:var(--color-neutral-400)}
.rowh{display:flex;align-items:center;gap:8px;min-height:48px}
.rowh h3{margin:0;font-size:16px;font-weight:700;flex:1}
/* Toast global, above bottom nav */
.toast{bottom:104px}
.toast.nonav{bottom:24px}
.toast .ring{width:24px;height:24px;flex:none}
.toast .button{min-height:48px;color:var(--color-primary-200);font-weight:700}
/* Sheet 16 */
.sheet{border-radius:var(--r-sheet) var(--r-sheet) 0 0;gap:8px;padding-bottom:0}
.sheet h2{margin:0 0 8px}
.opt{display:flex;align-items:center;gap:16px;min-height:48px;padding:0 16px;border:1px solid var(--color-neutral-200);border-radius:14px;font-size:15px;font-weight:600;background:#fff}
.opt .ic{color:var(--color-neutral-500)}
/* Form */
.fld{display:flex;flex-direction:column;gap:8px}
.fld .lr{display:flex;align-items:center;gap:8px;min-height:28px;font-size:13px;font-weight:600;color:var(--color-neutral-700)}
.fld .lr .chip{margin-left:auto}
.inp{font-weight:500;color:var(--color-neutral-900);background:#fff}
.inp.plh{color:var(--color-neutral-400)}
.inp span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.body > *,.dpanel > *,.dmain > *{flex:none}
.drow{display:flex;gap:24px;align-items:flex-start}
.drow > .dcard{flex:1;min-width:0}
.banner .button--primary{min-height:40px;padding:0 16px}
.inp.draft{border-color:var(--color-draft-border);background:var(--color-draft-bg)}
.inp.warn{border:2px solid var(--color-warning-border);padding:0 15px}
.inp .ic{color:var(--color-neutral-500)}
.inp .ib{width:48px;height:48px;margin-right:-16px;display:grid;place-items:center;color:var(--color-neutral-600)}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.02em}
.hint{font-size:12px;font-weight:600;color:var(--color-warning-fg);margin:-4px 0 0}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.sect{font-size:15px;font-weight:700;margin:8px 0 -8px;color:var(--color-neutral-900)}
.dock{position:absolute;left:0;right:0;bottom:0;background:#fff;border-top:1px solid var(--color-neutral-200);padding:16px 16px 0;display:flex;flex-direction:column;gap:0}
.dock .r{display:flex;gap:8px;align-items:center}
.dock .r .button--primary{flex:1}
.ktpc{position:relative;border-radius:14px;overflow:hidden;border:1px solid var(--color-neutral-200);background:#fff}
.ktpc svg.card{display:block;width:100%;height:auto}
.ktpc .meta{display:flex;align-items:center;gap:8px;padding:8px 8px 8px 16px;border-top:1px solid var(--color-neutral-100);min-height:56px}
.ktpc .meta .lt{flex:1;font-size:13px;font-weight:600;color:var(--color-neutral-700)}
/* Camera */
.cam{flex:1;background:#0B1116;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#fff}
.cam .frame{width:312px;height:197px;border-radius:16px;border:2px solid rgba(255,255,255,.9);box-shadow:0 0 0 999px rgba(0,0,0,.45);position:relative}
.cam .frame i{position:absolute;width:28px;height:28px;border:4px solid #fff}
.cam .tip{font-size:14px;font-weight:600;color:rgba(255,255,255,.9);position:relative}
.cam .bar{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:space-around;padding:24px 16px 40px}
.cam .shut{width:72px;height:72px;border-radius:999px;background:#fff;box-shadow:0 0 0 4px rgba(255,255,255,.35);border:0}
.cam .button--icon{color:#fff;background:rgba(255,255,255,.12)}
.cam .top{position:absolute;top:8px;left:8px;right:16px;display:flex;align-items:center;justify-content:space-between}
/* Odontogram strip */
.odo{background:#fff;border:1px solid var(--color-neutral-200);border-radius:16px;padding:8px;display:flex;flex-direction:column;gap:0;overflow:hidden}
.odo .jr{display:flex;gap:4px;justify-content:center}
.odo .mid{height:1px;background:var(--color-neutral-200);margin:4px 0}
.tc{width:48px;height:64px;border:1px solid transparent;border-radius:10px;background:#fff;padding:0;display:block;position:relative;flex:none}
.tc svg{display:block;overflow:visible}
.tc.on{border:2px solid var(--sel);background:var(--sel-bg)}
.tc.cited{border:2px dashed var(--color-draft-border);background:var(--color-draft-bg)}
.sym{width:28px;height:28px;flex:none;display:block}
.sug{display:flex;align-items:center;gap:12px}
.sug .sym{width:28px;height:28px}
.sug .tx{flex:1;display:flex;flex-direction:column;gap:2px;font-size:15px;font-weight:700}
.sug .tx small{font-size:12px;font-weight:500;color:var(--color-neutral-500)}
.arrow{color:var(--color-neutral-400);width:16px;height:16px}
/* Summary */
.sc{background:#fff;border:1px solid var(--color-neutral-200);border-radius:16px;overflow:hidden}
.sc .sh{display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 16px}
.sc .sh .lead{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:var(--color-neutral-100);color:var(--color-neutral-700);flex:none}
.sc .sh .lead svg{width:18px;height:18px}
.sc .sh b{flex:1;font-size:15px}
.sc .sh .n{font-size:12px;font-weight:700;color:var(--color-neutral-500)}
.sc .sh .ic:last-child{color:var(--color-neutral-400)}
.sc.alert{border-color:var(--color-danger-border)}
.sc.alert .sh .lead{background:var(--color-danger-bg);color:var(--color-danger-fg)}
.si{display:flex;align-items:center;gap:8px;min-height:48px;padding:0 8px 0 16px;border-top:1px solid var(--color-neutral-100);font-size:14px;font-weight:600}
.si .t{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.si .t small{font-size:12px;font-weight:500;color:var(--color-neutral-500)}
.si .src{width:48px;height:48px;display:grid;place-items:center;color:var(--color-neutral-500);flex:none}
.si .src svg{width:16px;height:16px}
.si.more{color:var(--color-neutral-600);font-size:13px}
.banner{display:flex;align-items:center;gap:8px;min-height:48px;padding:8px 8px 8px 16px;border-radius:14px;background:var(--color-draft-bg);color:var(--color-draft-fg);font-size:13px;font-weight:600}
.banner.ok{background:var(--color-success-bg);color:var(--color-success-fg)}
.banner .tx{flex:1}
/* Desktop */
.desk{height:800px}
.dbody{flex:1;display:flex;gap:24px;padding:24px;min-height:0;overflow:hidden}
.dmain{flex:1;min-width:0;display:flex;flex-direction:column;gap:16px}
.dpanel{width:360px;flex:none;display:flex;flex-direction:column;gap:8px}
.dcard{background:#fff;border:1px solid var(--color-neutral-200);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:16px}
.dcard h3{margin:0;font-size:16px;font-weight:700}
.soap{display:flex;flex-direction:column;gap:8px;font-size:14px;font-weight:500;color:var(--color-neutral-700)}
.soap p{margin:0;line-height:1.45}
.soap b{display:inline-block;width:24px;color:var(--color-neutral-900)}
.soap .cd{display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:6px;background:var(--color-draft-bg);color:var(--color-draft-fg);font-size:12px;font-weight:700;margin-left:4px}
.dfoot{display:flex;justify-content:flex-end;gap:8px}
/* Spec, matrix */
.spec{width:auto;grid-template-columns:repeat(4,360px)}
.matrix{border-collapse:collapse;background:#fff;border:1px solid var(--color-neutral-200);border-radius:16px;overflow:hidden;font-size:13px}
.matrix th,.matrix td{padding:0 16px;height:48px;text-align:left;border-bottom:1px solid var(--color-neutral-100);font-weight:600}
.matrix th{background:var(--color-neutral-50);font-size:12px;color:var(--color-neutral-600)}
.matrix td.y{color:var(--color-success-fg)}
.matrix td.n{color:var(--color-neutral-400)}
.legend{display:flex;flex-wrap:wrap;gap:8px;align-items:center;width:1100px}
.legend .ttl{width:100%;font-size:12px;font-weight:700;color:var(--color-neutral-500)}
.capk{font-size:11px;font-weight:700;color:var(--color-primary-800);letter-spacing:.06em}
"""


# ---------------- small parts ----------------
def chip(label: str, kind: str = "", icon: str = "") -> str:
    i = ico(icon, "ic-sm") if icon else ""
    return f'<span class="chip {kind}">{i}{label}</span>'


DRAF = lambda: chip("Draf AI", "draf", "pen")  # noqa: E731
DRAFT_SCAN = lambda: chip("Dari pindai", "draf", "pen")  # noqa: E731


def hd(title: str, right: str = "") -> str:
    return f'<header class="hd back">{M.icon_btn("chev-l", "Kembali")}<span class="ttl">{title}</span>{right or syn()}</header>'


def pbar(name: str = "Agus Permata", sub: str = "RM-000213 · 52 th · Umum", right: str = "") -> str:
    ini = "".join(w[0] for w in name.split()[:2])
    return f'<div class="pbar"><span class="av">{ini}</span><span class="pt">{name}<small>{sub}</small></span>{right}</div>'


def seg(items: list[tuple[str, str, bool]]) -> str:
    s = "".join(f'<span class="{"on" if on else ""}" role="radio" aria-checked="{"true" if on else "false"}">{t}{f"<i>{n}</i>" if n else ""}</span>' for t, n, on in items)
    return f'<div class="seg" role="radiogroup">{s}</div>'


def ring(frac: float = .7) -> str:
    c = 2 * 3.14159 * 9
    return (f'<svg class="ring" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="2.5"/>'
            f'<circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="{c*frac:.1f} {c:.1f}" transform="rotate(-90 12 12)" stroke-linecap="round"/>'
            f'<text x="12" y="16" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">4</text></svg>')


def toast(text: str, action: str = "Urungkan", nonav: bool = False, timer: bool = True) -> str:
    r = ring() if timer else ico("check")
    a = f'<button class="button" type="button">{action}</button>' if action else ""
    return f'<div class="toast{" nonav" if nonav else ""}" role="status">{r}<span class="tx">{text}</span>{a}</div>'


def phone(header: str, body: str, nav: str = "", overlay: str = "", white: bool = False, pad_bottom: int = 0) -> str:
    st = f' style="padding-bottom:{pad_bottom}px"' if pad_bottom else ""
    cls = "body white" if white else "body"
    return (f'<div class="ph"><div class="ph-bar"><span>09.40</span><span></span></div>{header}'
            f'<div class="{cls}"{st}>{body}</div>{nav}{overlay}</div>')


def col(ph: str, cap: str) -> str:
    return M.ph_col(ph, cap)


def ab(num: str, title: str, desc: str, body: str) -> str:
    return (f'<section class="ab" id="ab-{num}"><div class="ab-k"><span class="ab-n">{num}</span><span class="ab-t">{title}</span></div>'
            f'<p class="ab-d">{desc}</p>{body}</section>')


def side(active: str, role: str = "Dokter") -> str:
    items = {"Dokter": [("Beranda", "home"), ("Jadwal", "calendar"), ("Pasien", "users"), ("Rekam Medis", "tooth")],
             "Meja depan": [("Beranda", "home"), ("Jadwal", "calendar"), ("Pasien", "users"), ("Kasir", "card")]}[role]
    links = "".join(f'<a class="{"on" if l == active else ""}">{ico(i)}{l}</a>' for l, i in items)
    return (f'<aside class="side"><div class="brand"><i>{ico("tooth", "ic-sm")}</i>Bittodent</div>'
            f'<div style="padding:0 8px 8px">{syn()}</div><span class="cap">KLINIK</span>{links}</aside>')


def desk(active: str, title: str, body: str, role: str = "Dokter", who: str = "drg. Andi Contoh", overlay: str = "", h: int = 800) -> str:
    return (f'<div class="desk" style="position:relative;height:{h}px">{side(active, role)}<div class="dcol"><div class="dtop"><h2>{title}</h2>'
            f'<span class="who"><span class="av sm">AC</span><span>{who}<small>{role}</small></span></span></div>'
            f'<div class="dbody">{body}</div></div>{overlay}</div>')


# ---------------- A4 KTP ----------------
def ktp_svg(masked: bool = True, doubt: bool = False) -> str:
    band = ('<rect x="106" y="31" width="84" height="18" rx="4" fill="#1A1A1A"/>'
            '<text x="148" y="44" text-anchor="middle" font-size="10" font-weight="700" fill="#fff" font-family="ui-monospace,monospace">ditutup</text>')
    dmark = '<rect x="76" y="29" width="21" height="22" rx="4" fill="none" stroke="#F5C14A" stroke-width="2.5"/>' if doubt else ""
    return ('<svg class="card" viewBox="0 0 312 196" aria-label="Pratinjau KTP sintetis, NIK ditutup">'
            '<defs><linearGradient id="kt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#CFE6F5"/><stop offset="1" stop-color="#E9F3F9"/></linearGradient></defs>'
            '<rect width="312" height="196" fill="url(#kt)"/>'
            '<text x="156" y="18" text-anchor="middle" font-size="10" font-weight="700" fill="#1F3A4D">PROVINSI JAWA BARAT · KAB. BOGOR</text>'
            '<text x="16" y="44" font-size="13" font-weight="800" fill="#1F3A4D" font-family="ui-monospace,monospace">NIK 320101</text>'
            '<text x="194" y="44" font-size="13" font-weight="800" fill="#1F3A4D" font-family="ui-monospace,monospace">0001</text>'
            f'{band}{dmark}'
            '<g font-size="9" font-weight="600" fill="#33505F"><text x="16" y="70">Nama</text><text x="16" y="86">Tempat/Tgl Lahir</text><text x="16" y="102">Jenis Kelamin</text><text x="16" y="118">Alamat</text></g>'
            '<g font-size="9" font-weight="700" fill="#1F3A4D"><text x="96" y="70">: BUDI UJI KTP</text><text x="96" y="86">: BOGOR, 15-01-1990</text><text x="96" y="102">: LAKI-LAKI</text><text x="96" y="118">: JL SUKA MAJU NO 1</text></g>'
            '<rect x="232" y="56" width="64" height="80" rx="4" fill="#B9C9D4"/><circle cx="264" cy="84" r="14" fill="#9DB0BD"/><path d="M240 130c4-16 44-16 48 0" fill="#9DB0BD"/>'
            '<text x="156" y="184" text-anchor="middle" font-size="9" font-weight="700" fill="#B54708">CONTOH SINTETIS</text></svg>')


def fld(label: str, value: str, chip_html: str = "", cls: str = "", trail: str = "", hint: str = "") -> str:
    v = value or "&nbsp;"
    ph = " plh" if value in ("08xx", "Pilih") else ""
    h = f'<p class="hint">{hint}</p>' if hint else ""
    return f'<div class="fld"><div class="lr">{label}{chip_html}</div><div class="inp {cls}{ph}"><span>{v}</span>{trail}</div>{h}</div>'


def a4_camera() -> str:
    corners = ('<i style="left:-2px;top:-2px;border-right:0;border-bottom:0;border-radius:16px 0 0 0"></i>'
               '<i style="right:-2px;top:-2px;border-left:0;border-bottom:0;border-radius:0 16px 0 0"></i>'
               '<i style="left:-2px;bottom:-2px;border-right:0;border-top:0;border-radius:0 0 0 16px"></i>'
               '<i style="right:-2px;bottom:-2px;border-left:0;border-top:0;border-radius:0 0 16px 0"></i>')
    body = (f'<div class="cam"><div class="top">{M.icon_btn("x", "Tutup")}{syn()}</div>'
            f'<div class="frame">{corners}</div><p class="tip">Sisi depan, dalam bingkai</p>'
            f'<div class="bar">{M.icon_btn("image", "Pilih dari galeri")}<button class="shut" type="button" aria-label="Ambil foto"></button>'
            f'<span style="width:48px"></span></div></div>')
    return ('<div class="ph" style="background:#0B1116"><div class="ph-bar" style="color:#fff"><span>09.40</span><span></span></div>'
            f'{body}</div>')


def a4_draft() -> str:
    eye = f'<span class="ib">{ico("eye")}</span>'
    body = (f'<div class="ktpc">{ktp_svg(True, True)}<div class="meta"><span class="lt">Foto KTP</span>{btn("Ulang", "ghost", "camera", "button--sm")}</div></div>'
            f'<div class="banner"><span class="tx">8 isian dari pindai</span>{btn("Konfirmasi semua", "ghost", "", "button--sm")}</div>'
            + fld("Nama lengkap", "BUDI UJI KTP", DRAFT_SCAN(), "draft")
            + fld("NIK", '<span class="mono">3201 01•• •••• 0001</span>', chip("Periksa", "warn", "alert"), "warn", eye, "Digit 5-6 ragu"))
    dock = f'<div class="dock"><div class="r">{btn("Cek 8 isian", "primary")}</div><div class="safe"><i></i></div></div>'
    return phone(hd("Pasien baru"), body, overlay=dock, white=True)


def a4_confirmed() -> str:
    body = ('<div class="sect" style="margin-top:0">Identitas</div>'
            + fld("Nama lengkap", "BUDI UJI KTP", chip("Dicek", "ok", "check"))
            + fld("No. HP", "0812 0000 0101")
            + fld("NIK", '<span class="mono">3201 0115 0190 0001</span>', chip("Dicek", "ok", "check"), "", f'<span class="ib">{ico("eye")}</span>')
            + '<div class="g2">' + fld("Tanggal lahir", "15/01/1990") + fld("Jenis kelamin", "Laki-laki") + '</div>')
    dock = f'<div class="dock"><div class="r">{btn("Verifikasi dan daftar", "primary")}</div><div class="safe"><i></i></div></div>'
    return phone(hd("Pasien baru"), body, overlay=dock, white=True)


def a4_saved() -> str:
    body = (pbar("Budi Uji KTP", "RM-000488 · 36 th · Umum").replace('class="pbar"', 'class="pbar" style="margin:-16px -16px 0"')
            + seg([("Profil", "", True), ("Riwayat", "", False), ("Ringkasan", "", False)])
            + '<div class="sc"><div class="sh"><span class="lead">' + ico("card") + '</span><b>KTP</b>' + chip("Terenkripsi", "enc", "lock") + '</div>'
            '<div class="si"><span class="t">NIK<small class="mono">3201 •••• •••• 0001</small></span><span class="src">' + ico("eye") + '</span></div>'
            '<div class="si"><span class="t">Foto KTP<small>Tersimpan 15 Nov 2026</small></span>' + btn("Buka", "ghost", "", "button--sm") + '</div></div>'
            '<div class="sc"><div class="sh"><span class="lead">' + ico("user") + '</span><b>Identitas</b></div>'
            '<div class="si"><span class="t">Tanggal lahir<small>15/01/1990 · Laki-laki</small></span></div>'
            '<div class="si"><span class="t">Alamat<small>Jl Suka Maju No 1, Kab. Bogor</small></span></div></div>')
    return phone(hd("Pasien"), body, M.bnav("Meja depan", "Pasien"), toast("Pasien terdaftar", "", timer=False))


def a4_desktop() -> str:
    left = (f'<div class="dpanel" style="width:344px"><div class="ktpc">{ktp_svg(True, True)}<div class="meta"><span class="lt">Foto KTP</span>'
            f'{btn("Ambil", "secondary", "camera", "button--sm")}{btn("Pilih", "secondary", "image", "button--sm")}</div></div>'
            f'<div class="banner"><span class="tx">8 isian dari pindai</span>{btn("Konfirmasi semua", "ghost", "", "button--sm")}</div></div>')
    eye = f'<span class="ib">{ico("eye")}</span>'
    form = ('<div class="dmain"><div class="dcard" style="flex:1"><h3>Identitas</h3><div class="g2">'
            + fld("Nama lengkap", "BUDI UJI KTP", DRAFT_SCAN(), "draft") + fld("No. HP", "08xx")
            + fld("NIK", '<span class="mono">3201 01•• •••• 0001</span>', chip("Periksa", "warn", "alert"), "warn", eye, "Digit 5-6 ragu")
            + fld("Tanggal lahir", "15/01/1990", DRAFT_SCAN(), "draft")
            + fld("Jenis kelamin", "Laki-laki", DRAFT_SCAN(), "draft") + fld("Alamat", "JL SUKA MAJU NO 1", DRAFT_SCAN(), "draft")
            + '</div><div class="g3">' + fld("Prov", "32", DRAFT_SCAN(), "draft") + fld("Kab/Kota", "01", DRAFT_SCAN(), "draft") + fld("Kec", "01", DRAFT_SCAN(), "draft")
            + '</div><div style="flex:1"></div><div class="dfoot">' + btn("Batal", "ghost") + btn("Cek 8 isian", "primary") + '</div></div></div>')
    return desk("Pasien", "Pasien baru", left + form, "Meja depan", "Rina Contoh")


def ab01() -> str:
    row = ('<div class="ab-row">'
           + col(a4_camera(), "<b>1 Kamera.</b> Bingkai ID-1, satu tombol rana. Galeri sebagai cadangan. OCR di perangkat.")
           + col(a4_draft(), "<b>2 Hasil = draf.</b> Isian berlatar draf + chip Dari pindai. NIK ragu: Periksa (garis kuning). Pratinjau: NIK selalu ditutup. Primer menghitung isian yang belum dicek.")
           + col(a4_confirmed(), "<b>3 Semua dicek.</b> Draf hilang setelah diketik, diketuk, atau Konfirmasi semua. Primer berubah jadi Verifikasi dan daftar. Dock tidak menutupi isian.")
           + col(a4_saved(), "<b>4 Tersimpan.</b> Chip Terenkripsi baru muncul di sini. Buka dan mata hanya untuk peran ktp.view.")
           + '</div><div style="height:24px"></div>' + a4_desktop())
    return ab("01", "A4 Pasien baru dan pindai KTP",
              "HP 360 dan desktop 1280. Hasil OCR tidak pernah langsung resmi. Tanpa chip Terenkripsi sebelum simpan. Satu primer per layar.", row)


# ---------------- A1 ICD ----------------
def icd_card(sys_: str, code: str, disp: str, cite: str, state: str = "draf", cite_on: bool = False, extra: str = "") -> str:
    st = {"draf": DRAF(), "ok": chip("Disetujui", "ok", "check"), "no": chip("Ditolak", "no", "x")}[state]
    acts = ""
    if state == "draf":
        acts = (f'<div class="acts three">{btn("Tolak", "danger-soft")}'
                f'<button class="button button--secondary button--icon sq" type="button" aria-label="Alasan tolak">{ico("chev-d")}</button>'
                f'{btn("Setujui", "secondary", "check")}</div>')
    c = f'<span class="cite{" on" if cite_on else ""}">{ico("quote")}{cite}</span>'
    return (f'<div class="aic {state}"><div class="top"><span class="sys">{sys_}</span><span class="code">{code}</span>{st}</div>'
            f'<div class="dsp">{disp}</div>{c}{extra}{acts}</div>')


def icd_head(counts=("4", "1"), on: str = "Semua") -> str:
    return (f'<div class="rowh"><h3>Saran ICD</h3>{M.icon_btn("info", "Tentang saran")}</div>'
            + seg([("Semua", "", on == "Semua"), ("Draf", counts[0], on == "Draf"), ("Diulas", counts[1], on == "Diulas")]))


def a1_list() -> str:
    body = (icd_head()
            + icd_card("ICD-10", "K02.1", "Karies dentin", "F1 · gigi 36 O", cite_on=True)
            + icd_card("ICD-10", "K08.3", "Sisa akar", "F2 · gigi 46")
            + f'<div class="sum">{ico("check")}1 sudah diulas{ico("chev-d")}</div>')
    return phone(hd("Rekam Medis"), body, M.bnav("Dokter", "RM")).replace('<div class="body">', pbar() + '<div class="body">')


def a1_undo() -> str:
    body = (icd_head(("3", "2"))
            + icd_card("ICD-10", "K02.1", "Karies dentin", "F1 · gigi 36 O", "no",
                       extra='<span class="ghosttxt">Dikirim dalam 4 dtk</span>')
            + icd_card("ICD-10", "K08.3", "Sisa akar", "F2 · gigi 46"))
    ph = phone(hd("Rekam Medis"), body, M.bnav("Dokter", "RM"), toast("K02.1 ditolak"))
    return ph.replace('<div class="body">', pbar() + '<div class="body">')


def a1_sheet() -> str:
    reasons = ["Tidak sesuai", "Sudah dicatat", "Terlalu umum", "Kode lain", "Lainnya"]
    opts = "".join(f'<div class="opt">{r}</div>' for r in reasons)
    sheet = ('<div class="scrim"></div><div class="sheet" role="dialog" aria-label="Alasan tolak">'
             '<div class="handle-hit"><span class="handle"></span></div>'
             f'<h2>Tolak K08.3</h2>{opts}<div class="safe"><i></i></div></div>')
    body = icd_head() + icd_card("ICD-10", "K02.1", "Karies dentin", "F1 · gigi 36 O") + icd_card("ICD-10", "K08.3", "Sisa akar", "F2 · gigi 46")
    ph = phone(hd("Rekam Medis"), body, M.bnav("Dokter", "RM"), sheet)
    return ph.replace('<div class="body">', pbar() + '<div class="body">')


MINI_UP = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
MINI_LO = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
AGUS = {36: ([("car", "O")], "ada"), 46: ([("rrx", "")], "ada"), 47: ([("car", "O")], "ada"), 16: ([("cof", "O")], "ada"), 26: ([("fmc", "")], "lain")}


def cellx(t: int, data: dict, cited: set, plan: dict | None = None, on: int | None = None) -> str:
    plan = plan or {}
    if t in plan:
        marks, st = plan[t], "rencana"
    else:
        marks, st = data.get(t, ([], "ada"))
    html = O.cell(t, marks, st, on=(t == on))
    if t in cited:
        html = html.replace('class="tc', 'class="tc cited', 1)
    return html


def odo(teeth_up, teeth_lo, data, cited=(), plan=None, on=None) -> str:
    up = "".join(cellx(t, data, set(cited), plan, on) for t in teeth_up)
    lo = "".join(cellx(t, data, set(cited), plan, on) for t in teeth_lo)
    return f'<div class="odo"><div class="jr">{up}</div><div class="mid"></div><div class="jr">{lo}</div></div>'


def a1_desktop() -> str:
    od = ('<div class="dcard"><div class="rowh"><h3>Odontogram</h3>' + chip("Ditandatangani", "line", "check") + '</div>'
          + odo(MINI_UP, MINI_LO, AGUS, cited=(36,)) + '</div>')
    soap = ('<div class="dcard"><div class="rowh"><h3>SOAP</h3>' + chip("Draf", "draf", "pen") + '</div><div class="soap">'
            '<p><b>S</b>Ngilu minum dingin, gigi kiri bawah.</p><p><b>O</b>36 car O, sondasi (+). 46 rrx.</p>'
            '<p><b>A</b>Karies dentin 36<span class="cd">K02.1</span></p><p><b>P</b>Tambalan komposit 36 O. Ekstraksi 46.</p></div>'
            '<div class="dfoot">' + btn("Tanda Tangani", "primary") + '</div></div>')
    panel = ('<div class="dpanel">' + icd_head() + icd_card("ICD-10", "K02.1", "Karies dentin", "F1 · gigi 36 O", "ok", cite_on=True)
             + icd_card("ICD-10", "K08.3", "Sisa akar", "F2 · gigi 46") + '</div>')
    return desk("Rekam Medis", "Rekam Medis · Agus Permata", '<div class="dmain">' + od + '<div class="drow">' + soap + panel + '</div></div>', h=880)


def ab02() -> str:
    row = ('<div class="ab-row">'
           + col(a1_list(), "<b>1 Daftar.</b> Tab Semua / Draf / Diulas dengan hitungan. Sitasi menyorot gigi. Setujui = kode masuk A atau P di SOAP draf.")
           + col(a1_undo(), "<b>2 Tolak sekali ketuk.</b> Kartu tetap di tempat, status Ditolak. Toast global di atas nav, Urungkan 48, cincin 5 dtk. Kirim setelah 5 dtk atau saat keluar halaman.")
           + col(a1_sheet(), "<b>3 Alasan.</b> Chevron membuka sheet 16 dengan handle. Lima opsi 48 muat di 360 tanpa gulir. Ketuk opsi = Tolak + toast yang sama.")
           + '</div><div style="height:24px"></div>' + a1_desktop())
    return ab("02", "A1 Saran ICD", "Saran tetap draf sampai Setujui, dan kode baru resmi setelah SOAP ditandatangani. Satu primer: Tanda Tangani.", row)


# ---------------- A2 treatment ----------------
def sug_card(code_from: str, tooth: str, surf: str, to_code: str, to_label: str, state: str = "draf", src: str = "F1") -> str:
    st = {"draf": DRAF(), "ok": chip("Rencana", "line", "check"), "no": chip("Ditolak", "no", "x")}[state]
    lead = (f'<div class="sug">{O.sym(code_from)}{ico("chev-r", "arrow")}{O.sym(to_code)}'
            f'<span class="tx">{to_label}<small>{tooth} {surf} · {code_from} → {to_code}</small></span></div>')
    acts = ""
    if state == "draf":
        acts = f'<div class="acts">{btn("Tolak", "danger-soft")}{btn("Setujui", "secondary", "check")}</div>'
    return f'<div class="aic {state}"><div class="top"><span class="sys">{src}</span>{st}</div>{lead}{acts}</div>'


A2_UP = [16, 15, 14, 13, 12, 11]
A2_LO = [46, 45, 44, 43, 42, 41]
A2_LO_R = [31, 32, 33, 34, 35, 36, 37]


def a2_list() -> str:
    o = odo([17, 16, 15, 14, 13, 12], [47, 46, 45, 44, 43, 42], AGUS, cited=(46, 47))
    body = (f'<div class="rowh"><h3>Saran tindakan</h3>{btn("Setujui semua", "secondary", "", "button--sm")}</div>'
            + o
            + sug_card("car", "47", "O", "cof", "Tambalan komposit", src="F3")
            + sug_card("rrx", "46", "", "mis", "Ekstraksi", src="F2"))
    ph = phone(hd("Rekam Medis"), body, M.bnav("Dokter", "RM"))
    return ph.replace('<div class="body">', pbar() + '<div class="body">')


def a2_done() -> str:
    plan = {47: [("cof", "O")], 46: [("mis", "")]}
    o = odo([17, 16, 15, 14, 13, 12], [47, 46, 45, 44, 43, 42], AGUS, plan=plan)
    body = (f'<div class="rowh"><h3>Saran tindakan</h3></div>' + o
            + sug_card("car", "47", "O", "cof", "Tambalan komposit", "ok", "F3")
            + sug_card("rrx", "46", "", "mis", "Ekstraksi", "ok", "F2")
            + f'<div class="banner"><span class="tx">2 rencana, garis putus. Resmi setelah tanda tangan.</span></div>')
    dock = f'<div class="dock" style="bottom:88px"><div class="r">{btn("Tanda Tangani", "primary")}</div><div style="height:16px"></div></div>'
    ph = phone(hd("Rekam Medis"), body, M.bnav("Dokter", "RM"), dock)
    return ph.replace('<div class="body">', pbar() + '<div class="body">')


def a2_desktop() -> str:
    od = ('<div class="dcard"><div class="rowh"><h3>Odontogram</h3>' + chip("Mode Perawatan", "line") + '</div>'
          + odo(MINI_UP, MINI_LO, AGUS, cited=(36, 46), plan={47: [("cof", "O")]})
          + '<div class="legend" style="width:auto">' + chip("Rencana: garis putus", "line") + chip("Dikutip saran", "draf") + '</div></div>')
    soap = ('<div class="dcard"><div class="rowh"><h3>SOAP</h3>' + chip("Draf", "draf", "pen") + '</div><div class="soap">'
            '<p><b>P</b>Tambalan komposit 47 O<span class="cd">rencana</span></p></div><div class="dfoot">' + btn("Tanda Tangani", "primary") + '</div></div>')
    panel = ('<div class="dpanel"><div class="rowh"><h3>Saran tindakan</h3>' + btn("Setujui semua", "secondary", "", "button--sm") + '</div>'
             + seg([("Semua", "", True), ("Draf", "2", False), ("Diulas", "1", False)])
             + sug_card("car", "36", "O", "cof", "Tambalan komposit", src="F1")
             + sug_card("rrx", "46", "", "mis", "Ekstraksi", src="F2")
             + sug_card("car", "47", "O", "cof", "Tambalan komposit", "ok", "F3") + '</div>')
    return desk("Rekam Medis", "Rekam Medis · Agus Permata", '<div class="dmain">' + od + '<div class="drow">' + soap + panel + '</div></div>', h=1000)


def ab03() -> str:
    row = ('<div class="ab-row">'
           + col(a2_list(), "<b>1 Saran dari temuan.</b> Simbol resmi 28 (temuan → tindakan), kode huruf kecil. Gigi yang dikutip disorot garis putus kuning. Semua Draf AI.")
           + col(a2_done(), "<b>2 Disetujui.</b> Saran jadi Rencana di odontogram (garis putus, konvensi v2), bukan Selesai. Tanda Tangani satu-satunya primer.")
           + '</div><div style="height:24px"></div>' + a2_desktop())
    return ab("03", "A2 Saran tindakan dari odontogram",
              "Taksonomi dan simbol odontogram v2 (11e6432): car, cof, rrx, mis, permukaan MODVL dengan V. Tolak memakai pola A1 (5 dtk + Urungkan).", row)


# ---------------- Ringkasan medis ----------------
def sitem(title: str, sub: str, src: bool = True) -> str:
    s = f'<span class="src" aria-label="Sumber">{ico("quote")}</span>' if src else ""
    return f'<div class="si"><span class="t">{title}<small>{sub}</small></span>{s}</div>'


def scard(icon: str, title: str, items: str, n: str = "", alert: bool = False, open_: bool = True) -> str:
    ch = ico("chev-d") if not open_ else ico("chev-d").replace('class="ic"', 'class="ic" style="transform:rotate(180deg)"')
    return (f'<div class="sc{" alert" if alert else ""}"><div class="sh"><span class="lead">{ico(icon)}</span><b>{title}</b>'
            f'<span class="n">{n}</span>{ch}</div>{items if open_ else ""}</div>')


def summary_cards(compact: bool = False) -> str:
    return (scard("alert", "Peringatan", sitem("Alergi penisilin", "Anamnesis 3 Mar 2025"), "1", alert=True)
            + scard("heart", "Kondisi medis", sitem("Hipertensi, terkontrol", "Anamnesis 15 Nov 2026"), "1")
            + scard("pill", "Obat rutin", sitem("Amlodipin 5 mg, 1×/hari", "Anamnesis 15 Nov 2026"), "1", open_=not compact)
            + scard("tooth", "Gigi", sitem("36 car O · 47 car O", "Odontogram 15 Nov 2026") + sitem("46 rrx", "Odontogram 15 Nov 2026")
                    + '<div class="si more"><span class="t">+2 lainnya</span></div>', "4")
            + scard("list", "Rencana terbuka", sitem("Tambalan komposit 47 O", "Rencana 15 Nov 2026"), "2", open_=False)
            + scard("history", "Kunjungan terakhir", sitem("15 Nov 2026 · drg. Andi Contoh", "Kontrol, tambal 16 O"), "", open_=False))


def rs_draft() -> str:
    body = (seg([("Profil", "", False), ("Riwayat", "", False), ("Ringkasan", "", True)])
            + f'<div class="banner"><span class="tx">Draf AI · 15 Nov 23.40</span>{M.icon_btn("info", "Tentang ringkasan")}</div>'
            + summary_cards(True))
    dock = f'<div class="dock" style="bottom:88px"><div class="r">{btn("Setujui ringkasan", "primary")}</div><div style="height:16px"></div></div>'
    ph = phone(hd("Pasien"), body, M.bnav("Dokter", "Pasien"), dock)
    return ph.replace('<div class="body">', pbar() + '<div class="body">')


def rs_source() -> str:
    sheet = ('<div class="scrim"></div><div class="sheet" role="dialog" aria-label="Sumber">'
             '<div class="handle-hit"><span class="handle"></span></div><h2>Alergi penisilin</h2>'
             '<div class="ingrp">' + M.li("Anamnesis", "file", "3 Mar 2025 · drg. Andi Contoh") + M.li("SOAP S", "file", "15 Nov 2026 · \"alergi penisilin\"") + '</div>'
             '<div class="acts">' + btn("Hapus dari draf", "danger-soft") + btn("Ubah", "secondary", "pen") + '</div>'
             '<div class="safe"><i></i></div></div>')
    body = (seg([("Profil", "", False), ("Riwayat", "", False), ("Ringkasan", "", True)])
            + f'<div class="banner"><span class="tx">Draf AI · 15 Nov 23.40</span></div>' + summary_cards(True))
    ph = phone(hd("Pasien"), body, M.bnav("Dokter", "Pasien"), sheet)
    return ph.replace('<div class="body">', pbar() + '<div class="body">')


def rs_ok() -> str:
    body = (seg([("Profil", "", False), ("Riwayat", "", False), ("Ringkasan", "", True)])
            + f'<div class="banner ok">{ico("check")}<span class="tx">Disetujui drg. Andi Contoh · 15 Nov 23.42</span></div>'
            + summary_cards(True))
    ph = phone(hd("Pasien"), body, M.bnav("Dokter", "Pasien"), toast("Ringkasan disetujui", "", timer=False))
    return ph.replace('<div class="body">', pbar() + '<div class="body">')


def rs_desktop() -> str:
    panel = ('<div class="dpanel"><div class="rowh"><h3>Ringkasan klinis</h3>' + M.icon_btn("info", "Tentang ringkasan") + '</div>'
             + f'<div class="banner"><span class="tx">Draf AI · 15 Nov 23.40</span>{btn("Setujui", "primary")}</div>' + summary_cards(False)
             + '</div>')
    main = ('<div class="dmain"><div class="dcard"><div class="rowh"><h3>Agus Permata</h3>' + chip("Umum", "line") + '</div>'
            '<div class="soap"><p>RM-000213 · 52 th · Laki-laki · 0812 0000 0213</p></div></div>'
            '<div class="dcard" style="flex:1"><div class="rowh"><h3>Riwayat</h3></div>'
            + M.li("15 Nov 2026 · Kontrol", "file", "drg. Andi Contoh · tambal 16 O") + M.li("3 Mar 2025 · Konsultasi", "file", "drg. Andi Contoh · anamnesis")
            + '</div></div>')
    return desk("Pasien", "Pasien · Agus Permata", panel + main, h=1000)


def ab04() -> str:
    row = ('<div class="ab-row">'
           + col(rs_draft(), "<b>1 Draf AI.</b> Gaya Clinical Summary: kartu per bagian, Peringatan selalu di atas dan terbuka. Bagian lain ringkas, sisanya +N. Setiap baris punya sumber.")
           + col(rs_source(), "<b>2 Sumber.</b> Ketuk kutip: sheet 16 dengan catatan asal. Dokter bisa hapus atau ubah baris sebelum menyetujui.")
           + col(rs_ok(), "<b>3 Disetujui.</b> Banner hijau dengan nama dan waktu. Data baru membuat draf baru, tidak menimpa yang disetujui.")
           + '</div><div style="height:24px"></div>' + rs_desktop())
    return ab("04", "Ringkasan medis pasien", "Backend #55 sudah ada, UI belum. Hanya baca: tidak ada tindakan klinis dari ringkasan. Hanya peran ai_draft.review yang melihat draf.", row)


# ---------------- Peran ----------------
def ab05() -> str:
    roles = ["Dokter", "Asisten", "Resepsionis", "Kasir", "Pemilik"]
    rows = [("Saran ICD (A1)", "ai_draft.review", [1, 0, 0, 0, 0]),
            ("Saran tindakan (A2)", "ai_draft.review", [1, 0, 0, 0, 0]),
            ("Ringkasan, draf", "ai_draft.review", [1, 0, 0, 0, 0]),
            ("Ringkasan, disetujui", "clinical.view", [1, 1, 0, 0, 1]),
            ("Pindai KTP (A4)", "patient.create", [1, 0, 1, 0, 1]),
            ("NIK mata, Buka foto", "patient.ktp.view", [1, 0, 0, 0, 1])]
    th = "".join(f"<th>{r}</th>" for r in roles)
    tr = "".join(f'<tr><td>{n}<br><span class="ghosttxt">{p}</span></td>' + "".join(f'<td class="{"y" if v else "n"}">{"Tampil" if v else "Tidak dirender"}</td>' for v in vs) + "</tr>" for n, p, vs in rows)
    matrix = f'<table class="matrix"><tr><th>Komponen</th>{th}</tr>{tr}</table>'
    asisten = phone(hd("Rekam Medis"), odo([17, 16, 15, 14, 13, 12], [47, 46, 45, 44, 43, 42], AGUS)
                    + '<div class="dcard"><div class="rowh"><h3>SOAP</h3>' + chip("Draf", "draf", "pen") + '</div><div class="soap"><p><b>S</b>Ngilu minum dingin.</p></div></div>',
                    M.bnav("Asisten", "RM")).replace('<div class="body">', pbar() + '<div class="body">')
    depan = phone(hd("Pasien baru"), f'<div class="ktpc">{ktp_svg(True)}<div class="meta"><span class="lt">Foto KTP</span>{btn("Ulang", "ghost", "camera", "button--sm")}</div></div>'
                  + fld("NIK", '<span class="mono">3201 01•• •••• 0001</span>', DRAFT_SCAN(), "draft") + fld("Nama lengkap", "BUDI UJI KTP", DRAFT_SCAN(), "draft"),
                  overlay=f'<div class="dock"><div class="r">{btn("Cek 8 isian", "primary")}</div><div class="safe"><i></i></div></div>', white=True)
    legend = ('<div class="legend"><span class="ttl">Status dan chip (28px, ikon + label, bukan warna saja)</span>'
              + DRAF() + DRAFT_SCAN() + chip("Periksa", "warn", "alert") + chip("Tidak cocok", "no", "x") + chip("Disetujui", "ok", "check")
              + chip("Ditolak", "no", "x") + chip("Rencana", "line", "check") + chip("Terenkripsi", "enc", "lock") + '</div>')
    body = ('<div class="ab-row">' + col(asisten, "<b>Asisten.</b> RM tanpa panel Saran ICD, Saran tindakan, dan draf ringkasan. Tidak ada gembok atau ruang kosong.")
            + col(depan, "<b>Resepsionis.</b> Pindai boleh. Tanpa tombol mata NIK dan tanpa Buka foto setelah simpan.")
            + '<div class="ab-col">' + matrix + legend + '</div></div>')
    return ab("05", "Peran dan status", "Tanpa izin: komponen tidak dirender (bukan dikunci). Izin tetap diperiksa server.", body)


def build() -> str:
    parts = [ab01(), ab02(), ab03(), ab04(), ab05()]
    tokens = M.TOKENS
    return f"""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Bittodent · Layar AI</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
{tokens}
{M.CSS}
{CSS}
</style>
</head>
<body>
{O.GLOBAL_DEFS}
<div class="wrap">
  <h1 class="page">Layar AI</h1>
  <p class="lede">A4 pindai KTP, A1 Saran ICD, A2 Saran tindakan, Ringkasan medis. Output AI selalu draf sampai dokter menyetujui dan menandatangani. Shell feat/jadwal-mobile 0a5ba9e, simbol odontogram v2. {syn()}</p>
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
