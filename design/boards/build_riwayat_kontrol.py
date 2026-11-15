#!/usr/bin/env python3
"""Papan desain riwayat tindakan, entri klinik lain, dan kontrol tagihan.

Hasil: design/boards/riwayat-kontrol.html
dan /workspace/artifacts/bittodent-board-riwayat-kontrol.html
Data sintetis. Tanpa JavaScript. Tidak mengubah kode app.
"""
from __future__ import annotations

import base64
import io
import re
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'design/boards/riwayat-kontrol.html'
ART = Path('/workspace/artifacts/bittodent-board-riwayat-kontrol.html')
KASIR = ROOT / 'design/boards/kasir.html'

src = KASIR.read_text()
CSS = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
SPRITE = re.search(r'<svg width="0".*?</svg>', src, re.S).group(0)

EXTRA_ICONS = '''<symbol id="tooth" viewBox="0 0 24 24"><path d="M8 4.5c0-1.4 1.6-2.5 4-2.5s4 1.1 4 2.5c0 .7-.2 1.4-.5 2 1.7.3 3 1.6 3.2 3.6.4 3.2-1 7.2-2.8 9.2-.6.7-1.7.3-1.7-.6 0-1.8-.3-3.2-.7-4.1-.3-.6-.9-.8-1.5-.4-.4.2-.8.2-1.2 0-.6-.4-1.2-.2-1.5.4-.4.9-.7 2.3-.7 4.1 0 .9-1.1 1.3-1.7.6-1.8-2-3.2-6-2.8-9.2.2-2 1.5-3.3 3.2-3.6-.3-.6-.5-1.3-.5-2z"/></symbol><symbol id="dots" viewBox="0 0 24 24"><circle cx="12" cy="6" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="18" r="1"/></symbol><symbol id="pill" viewBox="0 0 24 24"><rect x="8.5" y="2" width="7" height="20" rx="3.5" transform="rotate(45 12 12)"/><path d="M7.2 11.2l5.6 5.6"/></symbol>'''
SPRITE = SPRITE.replace('</svg>', EXTRA_ICONS + '</svg>')


def ico(name, size=20, cls=''):
    cls_s = f' i{size}' if size != 20 else ''
    if cls:
        cls_s += f' {cls}'
    return f'<svg class="i{cls_s}" aria-hidden="true"><use href="#{name}"/></svg>'


def webp_bytes(path: Path, q=74, max_w=800) -> tuple[bytes, int, int]:
    im = Image.open(path).convert('RGBA')
    rgb = im.convert('RGB')
    bg = Image.new('RGB', rgb.size, (250, 250, 250))
    bbox = ImageChops.difference(rgb, bg).getbbox()
    if bbox:
        l, t, r, b = bbox
        im = im.crop((max(0, l - 8), max(0, t - 8), min(im.width, r + 8), min(im.height, b + 8)))
    w, h = im.size
    if max_w and w > max_w:
        h = int(h * max_w / w)
        w = max_w
        im = im.resize((w, h), Image.Resampling.LANCZOS)
    canvas = Image.new('RGB', im.size, (255, 255, 255))
    canvas.paste(im, mask=im.split()[-1] if im.mode == 'RGBA' else None)
    buf = io.BytesIO()
    canvas.save(buf, 'WEBP', quality=q, method=6)
    data = buf.getvalue()
    ww, hh = Image.open(io.BytesIO(data)).size
    return data, ww, hh


AUDIT3D = Path('/workspace/audit/after-3d/04b-odo3d-dewasa-v2.png')
PREV = ROOT / 'design/odontogram/preview/odontogram-3d-blender-full.png'
src_img = AUDIT3D if AUDIT3D.exists() else PREV
img_data, img_w, img_h = webp_bytes(src_img, q=74, max_w=800)
IMG_URL = 'url(data:image/webp;base64,' + base64.b64encode(img_data).decode() + ')'
print(f'odontogram {img_w}x{img_h} {len(img_data)/1024:.1f} KB')

EXTRA_CSS = f'''
.d12{{width:1280px;height:900px}}
.fl{{width:420px;height:640px;flex-direction:column;background:var(--cv)}}
.top .pt{{display:flex;align-items:center;gap:8px;font-size:18px;line-height:24px;font-weight:700;color:var(--tx);flex:none;margin-right:8px}}
.top .srch{{width:auto;flex:1;max-width:360px}}
.ptn{{display:flex;align-items:center;gap:16px;padding:16px 28px 8px;background:#fff}}
.itab{{display:flex;gap:4px;padding:0 28px;background:#fff;border-bottom:1px solid var(--bd);flex:none}}
.itab span{{height:44px;display:inline-flex;align-items:center;padding:0 12px;font-weight:600;color:var(--mu);border-bottom:2px solid transparent;white-space:nowrap}}
.itab .on{{color:var(--tx);border-bottom-color:var(--b)}}
.add{{width:44px;height:44px;border-radius:50%;background:var(--b);color:#fff;display:flex;align-items:center;justify-content:center;flex:none;border:0}}
.more{{width:44px;height:44px;border-radius:10px;border:1px solid var(--n200);background:#fff;display:flex;align-items:center;justify-content:center;color:var(--n700);flex:none}}
.nav{{min-height:44px;height:auto}}
.clinic .syn{{margin-top:6px;align-self:flex-start}}
.g-odo{{background-image:{IMG_URL};background-size:contain;background-repeat:no-repeat;background-position:center;background-color:#fff}}
.seg.cat{{width:100%}}
.seg.cat div{{height:44px}}
.seg.cat .on{{color:var(--tx);font-weight:700}}
.seg .off{{opacity:.4;pointer-events:none}}
.loc-luar .on{{background:var(--lbg);color:var(--lfg)}}
.bdg.luar{{background:var(--lbg);border-color:var(--lbd);color:var(--lfg)}}
.fdi{{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}}
.fdi i{{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:6px;border:1px solid var(--n200);background:#fff;font-size:11px;font-weight:700;font-style:normal;color:var(--mu)}}
.fdi i.here{{background:var(--ibg);border-color:var(--ifg);color:var(--ifg)}}
.fdi i.luar{{background:var(--lbg);border-color:var(--n600);color:var(--n700)}}
.fdi i.gone{{background:var(--sm);color:var(--n400);text-decoration:line-through;border-style:dashed}}
.tl{{display:flex;flex-direction:column;gap:0;padding-left:8px}}
.tl .ev{{display:flex;gap:12px;min-height:44px;padding:8px 0;position:relative}}
.tl .ev:before{{content:"";position:absolute;left:5px;top:0;bottom:0;width:2px;background:var(--bd)}}
.tl .ev:last-child:before{{bottom:auto;height:22px}}
.tl .dot{{width:12px;height:12px;border-radius:50%;margin:6px 0 0;flex:none;z-index:1;background:var(--n300)}}
.tl .ev.here .dot{{background:var(--ifg)}}
.tl .ev.luar .dot{{background:var(--n700)}}
.tl .ev.fix .dot{{background:var(--wfg)}}
.slide{{display:flex;flex-direction:column;gap:8px}}
.slide .track{{position:relative;height:44px;display:flex;align-items:center}}
.slide .bar{{position:absolute;left:0;right:0;height:4px;background:var(--n200);border-radius:2px}}
.slide .fill{{position:absolute;left:0;height:4px;background:var(--n600);border-radius:2px}}
.slide .kn{{position:absolute;width:20px;height:20px;border-radius:50%;background:var(--tx);border:3px solid #fff;box-shadow:0 0 0 1px var(--n200);transform:translateX(-10px)}}
.slide .ticks{{display:flex;justify-content:space-between;font-size:11px;line-height:14px;font-weight:600;color:var(--mu)}}
.row44{{display:flex;align-items:center;gap:12px;min-height:44px}}
.pm4{{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}}
.pm4>div{{min-height:72px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:1px solid var(--n200);border-radius:10px;background:#fff;font-weight:600;text-align:center;padding:8px}}
.pm4>div.on{{border-color:var(--b);box-shadow:inset 0 0 0 1px var(--b);background:var(--b0);color:var(--b)}}
.warn{{background:var(--wbg);border:1px solid var(--wbd);color:var(--wfg)}}
.kpi{{padding:16px;display:flex;flex-direction:column;gap:6px}}
.kpi .t32{{font-variant-numeric:tabular-nums}}
.log td,.log th{{padding:10px 12px}}
'''

NAV = [
    ('KLINIK', None),
    ('Beranda', 'home'),
    ('Jadwal', 'cal'),
    ('Antrean', 'menu'),
    ('Pasien', 'users'),
    ('KLINIS', None),
    ('Rekam Medis', 'tooth'),
    ('Resep', 'pill'),
    ('KEUANGAN', None),
    ('Kasir', 'wallet'),
    ('Laporan', 'chart'),
    ('PENGATURAN', None),
    ('Tindakan', 'file'),
    ('Dokter', 'user'),
    ('Tarif', 'cog'),
]


def sidebar(active, compact=False):
    clinic = ''
    if not compact:
        clinic = (
            '<div class="clinic"><b>Klinik Gigi Senyum Sehat</b>'
            '<span class="t12 mu">Tebet, Jakarta Selatan</span>'
            '<span class="syn">DATA SINTETIS</span></div>'
        )
    out = (
        f'<aside class="side{" cp" if compact else ""}">'
        f'<div class="logo"><span class="lg">B</span>{"" if compact else "Bittodent"}</div>'
        f'{clinic}'
    )
    for name, ic in NAV:
        if ic is None:
            if not compact:
                out += f'<div class="nlab">{name}</div>'
            continue
        on = ' on' if name == active else ''
        label = '' if compact else name
        out += f'<div class="nav{on}" title="{name}">{ico(ic)}{label}</div>'
    return out + '</aside>'


def topbar(title, icon, who='drg. Nadia Putri', role='Dokter gigi', ini='NP', syn=False, search='Cari pasien atau No. RM'):
    badge = '<span class="syn">DATA SINTETIS</span>' if syn else ''
    return (
        f'<header class="top">{ico(icon, 24)}<div class="pt">{title}</div>'
        f'<div class="srch">{ico("search", 16)}{search}</div>'
        f'{badge}'
        f'<span class="add ma">{ico("plus")}</span>'
        f'<span class="ib">{ico("bell")}</span>'
        f'<span class="av">{ini}</span>'
        f'<div class="fc"><b class="t14">{who}</b><span class="t12 mu">{role}</span></div>'
        f'</header>'
    )


def patient_head():
    return (
        '<div class="ptn">'
        '<span class="av l">BS</span>'
        '<div class="fc w1"><div class="crumb">Daftar Pasien ' + ico('chev', 16) + ' Budi Santoso</div>'
        '<h1 class="t28">Budi Santoso</h1>'
        '<span class="mu">36 th, laki-laki. Penjamin Umum.</span></div>'
        '<button class="btn sec">Buat janji</button>'
        f'<span class="more">{ico("dots")}</span>'
        '</div>'
    )


def itabs(active='Odontogram'):
    names = ['Odontogram', 'Catatan Klinis', 'Rencana Perawatan', 'Resep', 'Billing']
    spans = ''.join(f'<span class="{"on" if n==active else ""}">{n}</span>' for n in names)
    return f'<div class="itab">{spans}</div>'


def shell(active, title, icon, inner, size='d12', compact=False, who='drg. Nadia Putri', role='Dokter gigi', ini='NP', syn=False, search='Cari pasien atau No. RM'):
    return (
        f'<div class="scr {size}">'
        f'{sidebar(active, compact)}'
        f'<div class="app">{topbar(title, icon, who, role, ini, syn=syn, search=search)}{inner}</div>'
        f'</div>'
    )


def rm_shell(inner, compact=False, syn=False):
    body = patient_head() + itabs() + f'<main class="cnt">{inner}</main>'
    return shell('Rekam Medis', 'Rekam Medis', 'tooth', body, 't' if compact else 'd12', compact, syn=syn)


def ab(num, title, size, inner):
    return f'<div class="ab"><div class="cap">{num} {title}<span>{size}</span></div>{inner}</div>'


def arw(label):
    return (
        '<div class="arw" style="align-self:center">'
        '<svg viewBox="0 0 40 16"><path d="M0 8h37M31 2l6 6-6 6"/></svg>'
        f'{label}</div>'
    )


def section(title, sub, *rows):
    inner = ''.join(f'<div class="br-row">{"".join(row)}</div>' if isinstance(row, (list, tuple)) else row for row in rows)
    return f'<section class="bs"><h2>{title}<span>{sub}</span></h2>{inner}</section>'


def modal(title, body, actions):
    return (
        '<div class="scrim">'
        f'<div class="modal" style="width:440px">'
        f'<h2 class="t20">{title}</h2>'
        f'{body}'
        f'<div class="f g8" style="justify-content:flex-end">{actions}</div>'
        f'</div></div>'
    )


def with_overlay(screen, overlay):
    assert screen.endswith('</div></div>')
    return screen[:-12] + overlay + '</div></div>'


def flow_frame(inner):
    return f'<div class="scr fl"><div class="fc" style="flex:1;min-height:0;padding:16px">{inner}</div></div>'


def loc_seg(which, disabled_luar=False):
    here = 'on' if which == 'here' else ''
    luar = 'on' if which == 'luar' else ''
    luar_cls = luar + (' off' if disabled_luar else '')
    wrap = ' loc-luar' if which == 'luar' else ''
    return (
        f'<div class="seg cat{wrap}">'
        f'<div class="{here}">Di sini</div>'
        f'<div class="{luar_cls}">Klinik lain</div>'
        '</div>'
    )


def fdi_map(show=('51', '31'), faded=()):
    # Compact anterior + the two example teeth. 51 is sulung (flagged for Yohanes).
    upper_p = ['55', '54', '53', '52', '51', '61', '62', '63', '64', '65']
    upper = ['15', '14', '13', '12', '11', '21', '22', '23', '24', '25']
    lower = ['45', '44', '43', '42', '41', '31', '32', '33', '34', '35']

    def cell(n):
        cls = ''
        if n in faded:
            cls = ' gone'
        elif n == '51' and '51' in show:
            cls = ' here'
        elif n == '31' and '31' in show:
            cls = ' luar'
        return f'<i class="{cls.strip()}">{n}</i>'

    return (
        '<div class="fc g8">'
        '<div class="fdi">' + ''.join(cell(n) for n in upper_p) + '</div>'
        '<div class="fdi">' + ''.join(cell(n) for n in upper) + '</div>'
        '<div class="fdi">' + ''.join(cell(n) for n in lower) + '</div>'
        '</div>'
    )


def legend_row():
    return (
        '<div class="f ac g12 wr t12">'
        '<span class="f ac g8"><i class="fdi"><i class="here">51</i></i> Di sini, ditandatangani</span>'
        '<span class="f ac g8"><i class="fdi"><i class="luar">31</i></i> Klinik lain, penanda Luar</span>'
        '<span class="f ac g8"><i class="fdi"><i class="gone"></i></i> Digantikan</span>'
        '</div>'
    )


def chart_block(show=('51', '31'), faded=(), date_label=None, slider=None):
    head = ''
    if date_label:
        head = f'<div class="f jb ac"><span class="t14 b6">Odontogram</span><span class="mu t12">{date_label}</span></div>'
    sl = slider or ''
    # When a slider is present, size the card to its content so the slider stays inside.
    if sl:
        wrap = 'padding:16px'
        odo = 'height:200px;flex:none;border-radius:12px'
    else:
        wrap = 'flex:1;min-height:0;padding:16px'
        odo = 'flex:1;min-height:220px;border-radius:12px'
    return (
        f'<div class="card fc g12" style="{wrap}">'
        + head
        + f'<div class="g-odo" style="{odo}"></div>'
        + fdi_map(show, faded)
        + legend_row()
        + sl
        + '</div>'
    )


def slider(pos='now'):
    # pos: past (Jun 2025, 20%), mid (13 Nov, 70%), now (14 Nov, 100%)
    left, label = {'past': ('0%', 'Juni 2025'), 'mid': ('50%', '13 Nov 2026'), 'now': ('100%', '14 Nov 2026, hari ini')}[pos]
    return (
        '<div class="slide">'
        f'<span class="t14 b6">{label}</span>'
        '<div class="track"><span class="bar"></span>'
        f'<span class="fill" style="width:{left}"></span>'
        f'<span class="kn" style="left:{left}"></span></div>'
        '<div class="ticks"><span>Jun 2025</span><span>13 Nov</span><span>Hari ini</span></div>'
        '</div>'
    )


def proc_list(items, title='Tindakan tercatat'):
    rows = ''
    for it in items:
        rows += (
            f'<div class="row44" style="border-top:1px solid var(--bd)">'
            f'<div class="fc w1"><b class="t14">{it["name"]}</b><span class="mu t12">{it["meta"]}</span></div>'
            f'{it["badge"]}'
            f'<span class="t14 b6">{it["amt"]}</span>'
            '</div>'
        )
    return (
        f'<div class="card p16 fc g4"><div class="f jb ac"><span class="t16 b6">{title}</span></div>'
        + (rows or '<span class="mu">Belum ada tindakan.</span>')
        + '</div>'
    )


ITEM_51 = {
    'name': 'Tambal gigi, 51',
    'meta': 'Kemarin, 13 Nov 2026. Di sini.',
    'badge': '<span class="bdg ok">Ditandatangani</span>',
    'amt': 'Rp 450.000',
}
ITEM_31 = {
    'name': 'Gigi tiruan, 31',
    'meta': 'Klinik Gigi Melati. Sekitar Jun 2025.',
    'badge': '<span class="bdg luar">Luar</span>',
    'amt': 'Tidak ditagih',
}
ITEM_31_WAIT = {
    'name': 'Gigi tiruan, 31',
    'meta': 'Klinik Gigi Melati. Sekitar Jun 2025.',
    'badge': '<span class="bdg wt">Menunggu konfirmasi</span>',
    'amt': 'Tidak ditagih',
}


def form_tindakan(loc='luar', disabled_luar=False, filled=True, hint=None, cta='Simpan', name=None, code=None, tooth=None):
    name = name or ('Gigi tiruan lepasan' if loc == 'luar' else 'Tambal gigi')
    code = code or ('23.41' if loc == 'luar' else '23.2')
    tooth = tooth or ('31' if loc == 'luar' else '51')
    clinic = 'Klinik Gigi Melati, Menteng' if filled and loc == 'luar' else ''
    when = 'Juni 2025' if filled and loc == 'luar' else ('13 Nov 2026' if filled else '')
    clinic_fld = date_fld = ''
    if loc == 'luar':
        clinic_ph = clinic or 'Wajib'
        date_ph = when or 'Wajib, perkiraan'
        clinic_fld = (
            f'<div class="fld"><span class="lab">Nama klinik</span>'
            f'<div class="inp">{clinic_ph}</div></div>'
        )
        date_fld = (
            f'<div class="fld"><span class="lab">Perkiraan tanggal</span>'
            f'<div class="inp">{date_ph}</div></div>'
        )
    helper = hint or (
        'Tidak masuk tagihan.' if loc == 'luar' else
        'Masuk tagihan setelah ditandatangani.' if loc == 'here' else ''
    )
    if disabled_luar:
        helper = hint or 'Klinik lain hanya di pemeriksaan awal atau riwayat.'
    btn = f'<button class="btn pri wf">{cta}</button>' if cta else ''
    if disabled_luar and loc != 'here':
        btn = '<button class="btn pri wf is-d">Simpan</button>'
    return (
        '<div class="card fc g12" style="flex:1;min-height:0">'
        '<h2 class="t20">Catat tindakan</h2>'
        + loc_seg('luar' if loc == 'luar' else 'here', disabled_luar)
        + f'<span class="mu t12">{helper}</span>'
        + f'<div class="fld"><span class="lab">Tindakan</span><div class="inp">{name if code==tooth else name + ", " + code}</div></div>'
        + f'<div class="fld"><span class="lab">Gigi</span><div class="inp">{tooth}</div></div>'
        + clinic_fld
        + date_fld
        + btn
        + '</div>'
    )


# ---------- 1-4 flow frames ----------
flow_here = flow_frame(
    '<div class="card fc g16" style="height:100%">'
    '<h2 class="t20">Tambal 51, di sini</h2>'
    '<span class="mu">Kemarin, 13 Nov 2026.</span>'
    + loc_seg('here')
    + '<span class="mu t12">Masuk tagihan setelah ditandatangani.</span>'
    + '<div class="f jb ac"><span>Tambal gigi, 23.2</span><b>Rp 450.000</b></div>'
    + '<span class="bdg ok" style="align-self:flex-start">Ditandatangani</span>'
    + '</div>'
)
flow_luar = flow_frame(
    '<div class="card fc g16" style="height:100%">'
    '<h2 class="t20">Gigi tiruan 31, klinik lain</h2>'
    + loc_seg('luar')
    + '<div class="fld"><span class="lab">Nama klinik</span><div class="inp">Klinik Gigi Melati, Menteng</div></div>'
    + '<div class="fld"><span class="lab">Perkiraan tanggal</span><div class="inp">Juni 2025</div></div>'
    + '<span class="mu t12">Tidak masuk tagihan. Menunggu konfirmasi resepsionis.</span>'
    + '<span class="bdg wt" style="align-self:flex-start">Menunggu konfirmasi</span>'
    + '</div>'
)
flow_off = flow_frame(
    '<div class="card fc g16" style="height:100%">'
    '<h2 class="t20">Kunjungan hari ini</h2>'
    '<span class="mu">Ada tindakan di kursi. Klinik lain dimatikan.</span>'
    + loc_seg('here', disabled_luar=True)
    + '<span class="mu t12">Klinik lain hanya di pemeriksaan awal atau riwayat.</span>'
    + '<div class="fld"><span class="lab">Tindakan</span><div class="inp">Kontrol tambalan, 51</div></div>'
    + '</div>'
)
flow_conf = flow_frame(
    '<div class="card fc g16" style="height:100%">'
    '<h2 class="t20">Konfirmasi tindakan luar</h2>'
    '<span class="mu">Sari Front Desk. Resepsionis.</span>'
    + '<div class="fc g8"><b>Gigi tiruan, 31</b>'
    '<span class="mu">Budi Santoso. Klinik Gigi Melati, Menteng. Sekitar Jun 2025.</span></div>'
    + '<span class="mu t12">Dicatat drg. Nadia Putri saat pemeriksaan awal. Tidak masuk tagihan.</span>'
    + '<div class="f g8"><button class="btn sec w1">Tolak</button><button class="btn pri w1">Konfirmasi</button></div>'
    + '</div>'
)

# ---------- RM screens ----------
rm_awal = rm_shell(
    '<div class="f g20" style="flex:1;min-height:0">'
    '<div class="fc g16 w1" style="min-height:0">'
    + chart_block()
    + proc_list([ITEM_51, ITEM_31_WAIT], 'Pemeriksaan awal, 13 Nov 2026')
    + '</div>'
    '<div class="fc" style="width:360px;flex:none">'
    + form_tindakan('luar', filled=True, cta='Kirim konfirmasi')
    + '</div></div>'
)

rm_today = rm_shell(
    '<div class="f g20" style="flex:1;min-height:0">'
    '<div class="fc g16 w1" style="min-height:0">'
    + chart_block()
    + proc_list([ITEM_51, ITEM_31], 'Riwayat, plus tindakan hari ini')
    + '</div>'
    '<div class="fc" style="width:360px;flex:none">'
    + form_tindakan('here', disabled_luar=True, filled=True, cta='Simpan', name='Kontrol tambalan', code='51', tooth='51')
    + '</div></div>'
)

# close-up legend / color artboard uses same RM but tighter copy in a dedicated board
rm_warna = rm_shell(
    '<div class="f g20" style="flex:1;min-height:0">'
    '<div class="fc g16 w1" style="min-height:0">'
    + chart_block()
    + '</div>'
    '<div class="card fc g16" style="width:360px;flex:none">'
    '<h2 class="t20">Warna dan penanda</h2>'
    '<div class="row44"><i class="fdi"><i class="here">51</i></i><div class="fc"><b>Di sini</b><span class="mu t12">Biru info. Sudah ditandatangani, masuk tagihan.</span></div></div>'
    '<div class="row44"><i class="fdi"><i class="luar">31</i></i><div class="fc"><b>Klinik lain</b><span class="mu t12">Slate, plus penanda Luar. Kode tindakan sama, tidak ditagih.</span></div></div>'
    '<div class="row44"><i class="fdi"><i class="gone"></i></i><div class="fc"><b>Digantikan</b><span class="mu t12">Restorasi lama tetap tercatat, status diganti.</span></div></div>'
    '<span class="mu t12">Warna gigi membedakan lokasi, bukan tombol utama.</span>'
    '</div></div>'
)

# Kasir: only 51 billed
kasir_inner = (
    '<main class="cnt fc g20">'
    '<div class="f jb ac"><div class="fc g4"><h2 class="t20">Tagihan</h2>'
    '<span class="mu">Budi Santoso. Kasir Sari Front Desk. 13 Nov 2026.</span></div>'
    '<span class="bdg ok">Lunas</span></div>'
    '<div class="f g20" style="flex:1;min-height:0">'
    '<div class="card p16 fc g8 w1">'
    '<div class="row44"><div class="fc w1"><b>Tambal gigi, 51</b><span class="mu t12">drg. Nadia Putri. Ditandatangani.</span></div><b>Rp 450.000</b></div>'
    '<div class="row44" style="background:var(--sm);border-radius:10px;padding:0 12px">'
    '<div class="fc w1"><b>Gigi tiruan, 31</b><span class="mu t12">Klinik Gigi Melati. Status Luar.</span></div>'
    '<span class="bdg luar">Tidak ditagih</span></div>'
    '<div class="hr"></div>'
    '<div class="kv"><span class="mu">Subtotal</span><b>Rp 450.000</b></div>'
    '<div class="kv"><span class="mu">Dibayar, QRIS klinik</span><b>Rp 450.000</b></div>'
    '</div></div></main>'
)
kasir_board = shell('Kasir', 'Kasir', 'wallet', kasir_inner, who='Sari Front Desk', role='Resepsionis', ini='SF')

# FO confirm full screen (antrean-like)
fo_inner = (
    '<main class="cnt fc g20">'
    '<div class="fc g4"><h2 class="t20">Konfirmasi tindakan luar</h2>'
    '<span class="mu">Antrean konfirmasi. Hanya resepsionis atau asisten.</span></div>'
    '<div class="card p16 fc g16" style="max-width:720px">'
    '<div class="f ac g12"><span class="av l">BS</span><div class="fc w1"><b>Budi Santoso</b>'
    '<span class="mu">Pemeriksaan awal, 13 Nov 2026, 09.10 WIB.</span></div>'
    '<span class="bdg wt">Menunggu</span></div>'
    '<div class="kv"><span class="mu">Tindakan</span><span>Gigi tiruan, 31</span></div>'
    '<div class="kv"><span class="mu">Kode</span><span>23.41, sama dengan katalog</span></div>'
    '<div class="kv"><span class="mu">Klinik</span><span>Klinik Gigi Melati, Menteng</span></div>'
    '<div class="kv"><span class="mu">Perkiraan tanggal</span><span>Juni 2025</span></div>'
    '<div class="kv"><span class="mu">Dicatat</span><span>drg. Nadia Putri, 09.18</span></div>'
    '<span class="mu t12">Tidak masuk tagihan setelah dikonfirmasi.</span>'
    '<div class="f g8"><button class="btn sec">Tolak</button><button class="btn pri">Konfirmasi</button></div>'
    '</div></main>'
)
fo_board = shell('Antrean', 'Antrean', 'menu', fo_inner, who='Sari Front Desk', role='Resepsionis', ini='SF')

# ---------- History ----------
def history_panel(tooth, events, status_line):
    evs = ''
    for e in events:
        evs += (
            f'<div class="ev {e["cls"]}"><span class="dot"></span>'
            f'<div class="fc w1"><b class="t14">{e["title"]}</b>'
            f'<span class="mu t12">{e["meta"]}</span>{e.get("extra","")}</div>'
            f'{e.get("badge","")}</div>'
        )
    return (
        f'<div class="card fc g12" style="width:360px;flex:none;min-height:0">'
        f'<h2 class="t20">Riwayat gigi {tooth}</h2>'
        f'<span class="mu t12">{status_line}</span>'
        f'<div class="tl">{evs}</div>'
        '</div>'
    )


ev_31 = [
    {'cls': '', 'title': 'Kondisi awal', 'meta': 'Gigi hilang, dicatat pemeriksaan awal 13 Nov 2026.', 'badge': ''},
    {'cls': 'luar', 'title': 'Gigi tiruan (luar)', 'meta': 'Klinik Gigi Melati, Menteng. Sekitar Jun 2025. Dikonfirmasi Sari 13 Nov 09.22.', 'badge': '<span class="bdg luar">Luar</span>'},
]
ev_51 = [
    {'cls': '', 'title': 'Kondisi awal', 'meta': 'Karies oklusal, 13 Nov 2026, 09.12.', 'badge': ''},
    {'cls': 'here', 'title': 'Tambal gigi komposit', 'meta': 'Di sini, 13 Nov 2026, 09.40. drg. Nadia Putri.', 'badge': '<span class="bdg ok">Ditandatangani</span>'},
]
ev_51_fix = ev_51 + [
    {'cls': 'fix', 'title': 'Koreksi bahan', 'meta': '14 Nov 2026, 08.50. Merujuk catatan 13 Nov 09.40.', 'badge': '<span class="bdg wt">Koreksi</span>',
     'extra': '<span class="mu t12">Alasan: salah catat bahan, komposit A3 bukan A2. Catatan lama tetap ada.</span>'},
]

# replaced restoration example on 31 - old temp then current denture
ev_31_rep = [
    {'cls': '', 'title': 'Kondisi awal', 'meta': 'Gigi hilang, dicatat 13 Nov 2026.', 'badge': ''},
    {'cls': '', 'title': 'Gigi tiruan sementara (luar)', 'meta': 'Klinik Gigi Melati, 2023. Dicatat dari riwayat pasien.', 'badge': '<span class="bdg sg">Digantikan</span>'},
    {'cls': 'luar', 'title': 'Gigi tiruan (luar)', 'meta': 'Klinik Gigi Melati. Sekitar Jun 2025. Menggantikan tiruan 2023.', 'badge': '<span class="bdg luar">Luar</span>'},
]

hist_31 = rm_shell(
    '<div class="f g20" style="flex:1;min-height:0">'
    '<div class="fc g16 w1" style="min-height:0">'
    + chart_block(show=('31',))
    + '</div>'
    + history_panel('31', ev_31, 'Klik gigi untuk membuka riwayat. Catatan lama tidak dihapus.')
    + '</div>'
)
hist_51 = rm_shell(
    '<div class="f g20" style="flex:1;min-height:0">'
    '<div class="fc g16 w1" style="min-height:0">'
    + chart_block(show=('51', '31'))
    + '</div>'
    + history_panel('51', ev_51, 'Tambalan kemarin berstatus Ditandatangani.')
    + '</div>'
)
hist_koreksi = rm_shell(
    '<div class="f g20" style="flex:1;min-height:0">'
    '<div class="fc g16 w1" style="min-height:0">'
    + chart_block()
    + '</div>'
    + history_panel('51', ev_51_fix, 'Koreksi adalah catatan baru, dengan rujukan dan alasan.')
    + '</div>'
)
hist_ganti = rm_shell(
    '<div class="f g20" style="flex:1;min-height:0">'
    '<div class="fc g16 w1" style="min-height:0">'
    + chart_block(show=('31',), faded=('x',))
    + '</div>'
    + history_panel('31', ev_31_rep, 'Restorasi yang sudah diganti tetap tampil, status Digantikan.')
    + '</div>'
)

# date slider states
slide_past = rm_shell(
    '<div class="f g20" style="flex:1;min-height:0">'
    '<div class="fc g16 w1" style="min-height:0">'
    + chart_block(show=('31',), date_label='Tampilan pada Juni 2025', slider=slider('past'))
    + proc_list([ITEM_31], 'Pada tanggal ini')
    + '</div>'
    + history_panel('31', ev_31, 'Slider mengubah odontogram ke kondisi pada tanggal itu.')
    + '</div>'
)
slide_mid = rm_shell(
    '<div class="f g20" style="flex:1;min-height:0">'
    '<div class="fc g16 w1" style="min-height:0">'
    + chart_block(show=('51', '31'), date_label='Tampilan pada 13 Nov 2026', slider=slider('mid'))
    + '</div>'
    '<div class="card fc g12" style="width:360px;flex:none">'
    '<h2 class="t20">Linimasa kunjungan</h2>'
    '<div class="tl">'
    '<div class="ev luar"><span class="dot"></span><div class="fc w1"><b class="t14">Juni 2025, perkiraan</b>'
    '<span class="mu t12">Gigi tiruan 31 di Klinik Gigi Melati. Dicatat belakangan.</span></div></div>'
    '<div class="ev here"><span class="dot"></span><div class="fc w1"><b class="t14">Jumat 13 Nov 2026</b>'
    '<span class="mu t12">Pemeriksaan awal. Tambal 51 ditandatangani dan lunas. Entri luar 31 dikonfirmasi.</span></div></div>'
    '<div class="ev"><span class="dot"></span><div class="fc w1"><b class="t14">Sabtu 14 Nov 2026</b>'
    '<span class="mu t12">Kontrol. Belum ada tindakan baru di kursi.</span></div></div>'
    '</div></div></div>'
)

# Dedicated timeline board (full width list)
linimasa_inner = (
    '<main class="cnt fc g16">'
    '<div class="fc g4"><h2 class="t20">Linimasa kunjungan</h2>'
    '<span class="mu">Budi Santoso. Catatan lama tidak dihapus.</span></div>'
    '<div class="card p16">'
    '<div class="tl">'
    '<div class="ev luar"><span class="dot"></span><div class="fc w1">'
    '<b class="t16">Juni 2025, perkiraan</b>'
    '<span class="mu">Gigi tiruan 31, Klinik Gigi Melati, Menteng. Status Luar. Tidak ditagih.</span>'
    '<span class="mu t12">Dicatat 13 Nov 2026, 09.18. Dikonfirmasi Sari 09.22.</span></div>'
    '<span class="bdg luar">Luar</span></div>'
    '<div class="ev here"><span class="dot"></span><div class="fc w1">'
    '<b class="t16">Jumat 13 Nov 2026, 09.00</b>'
    '<span class="mu">Pemeriksaan awal, drg. Nadia Putri. Tambal 51, Rp 450.000, lunas QRIS klinik.</span>'
    '<span class="mu t12">Ditandatangani 09.48. Struk WhatsApp dibaca 10.02.</span></div>'
    '<span class="bdg ok">Ditandatangani</span></div>'
    '<div class="ev"><span class="dot"></span><div class="fc w1">'
    '<b class="t16">Sabtu 14 Nov 2026, 08.40</b>'
    '<span class="mu">Kontrol tambalan 51. Belum ada tindakan baru. Koreksi bahan dicatat 08.50.</span></div>'
    '<span class="bdg sg">Berjalan</span></div>'
    '</div></div></main>'
)
linimasa_board = shell('Rekam Medis', 'Rekam Medis', 'tooth', patient_head() + itabs('Catatan Klinis') + linimasa_inner)

# ---------- C. Undertable ----------
block_modal = modal(
    'Tagihan belum dibuat',
    '<span class="mu">Kunjungan ini punya tindakan. Tutup kunjungan hanya setelah ada tagihan.</span>'
    '<div class="card p16 fc g8" style="border:1px solid var(--bd)">'
    '<div class="f jb"><span>Scaling seluruh mulut</span><b>Rp 400.000</b></div>'
    '<span class="mu t12">Belum ada tagihan untuk kunjungan 14 Nov 2026.</span>'
    '</div>',
    '<button class="btn sec">Batal</button><button class="btn pri">Buat tagihan</button>',
)
# Use a visit-close context: Antrean selesai
antrean_close = (
    '<main class="cnt fc g16">'
    '<div class="fc g4"><h2 class="t20">Antrean</h2><span class="mu">Sabtu 14 Nov 2026.</span></div>'
    '<div class="card p16 fc g8">'
    '<div class="row44"><span class="av">RD</span><div class="fc w1"><b>Ratna Dewi Anggraini</b>'
    '<span class="mu t12">Scaling, drg. Arif Hidayat</span></div><span class="bdg wt">Selesai, tanpa tagihan</span>'
    '<button class="btn pri">Tutup kunjungan</button></div>'
    '</div></main>'
)
blok_board = with_overlay(
    shell('Antrean', 'Antrean', 'menu', antrean_close, who='Sari Front Desk', role='Resepsionis', ini='SF'),
    block_modal,
)

# For a clearer "visit with today's procedure can't close" - the modal is the point.
# Owner approval for Rp0 / 100% discount
approve_modal = modal(
    'Persetujuan pemilik',
    '<span class="mu">Diskon 100% atau tarif Rp 0 perlu alasan dan persetujuan pemilik.</span>'
    '<div class="kv"><span class="mu">Pasien</span><span>Alya Rahmawati, 6 th</span></div>'
    '<div class="kv"><span class="mu">Tindakan</span><span>Tambal gigi susu 74, drg. Clara Wijaya</span></div>'
    '<div class="kv"><span class="mu">Tarif</span><span>Rp 300.000, diskon 100%</span></div>'
    '<div class="kv"><span class="mu">Alasan</span><span>Program subsidi anak karyawan.</span></div>'
    '<div class="kv"><span class="mu">Diajukan</span><span>Sari Front Desk, 14 Nov 11.05</span></div>',
    '<button class="btn sec">Tolak</button><button class="btn pri">Setujui</button>',
)
approve_bg = (
    '<main class="cnt fc g16">'
    '<div class="f jb ac"><div class="fc g4"><h2 class="t20">Tagihan</h2>'
    '<span class="mu">Alya Rahmawati. Kasir Sari Front Desk.</span></div>'
    '<span class="bdg wt">Menunggu pemilik</span></div>'
    '<div class="card p16 fc g8" style="max-width:640px">'
    '<div class="row44"><div class="fc w1"><b>Tambal gigi susu, 74</b><span class="mu t12">drg. Clara Wijaya, Sp.KGA</span></div>'
    '<div class="fc ae"><span class="old">Rp 300.000</span><b>Rp 0</b></div></div>'
    '<div class="kv"><span class="mu">Diskon</span><span>100%</span></div>'
    '<div class="fld"><span class="lab">Alasan</span><div class="inp">Program subsidi anak karyawan.</div></div>'
    '<button class="btn pri is-d">Terima pembayaran</button>'
    '<span class="mu t12">Tombol bayar aktif setelah pemilik menyetujui.</span>'
    '</div></main>'
)
approve_board = with_overlay(
    shell('Kasir', 'Kasir', 'wallet', approve_bg, who='drg. Nadia Putri', role='Pemilik', ini='NP'),
    approve_modal,
)

# Payment methods clinic only
bayar_inner = (
    '<main class="cnt fc g16">'
    '<div class="fc g4"><h2 class="t20">Bayar</h2>'
    '<span class="mu">Budi Santoso. Tambal 51, Rp 450.000.</span></div>'
    '<div class="f g20" style="flex:1;min-height:0">'
    '<div class="card p16 fc g16 w1">'
    '<span class="lab">Metode bayar</span>'
    '<div class="pm4">'
    f'<div class="on">{ico("cash", 24)}Tunai</div>'
    f'<div>{ico("qr", 24)}QRIS klinik</div>'
    f'<div>{ico("card", 24)}EDC</div>'
    f'<div>{ico("xfer", 24)}Transfer rekening klinik</div>'
    '</div>'
    '<span class="mu t12">Transfer hanya ke rekening klinik.</span>'
    '<div class="fld"><span class="lab">Uang diterima</span><div class="inp">Rp 450.000</div></div>'
    '<button class="btn pri" style="align-self:flex-start">Terima pembayaran</button>'
    '</div></div></main>'
)
bayar_board = shell('Kasir', 'Kasir', 'wallet', bayar_inner, who='Sari Front Desk', role='Resepsionis', ini='SF')

# Materials
bahan_inner = (
    '<main class="cnt fc g16">'
    '<div class="fc g4"><h2 class="t20">Pemakaian bahan</h2>'
    '<span class="mu">Budi Santoso, 13 Nov 2026. Tercatat per tindakan.</span></div>'
    '<div class="card" style="overflow:hidden">'
    '<table class="tbl"><thead><tr>'
    '<th>Tindakan</th><th>Bahan</th><th class="r">Jumlah</th><th>Stok sisa</th>'
    '</tr></thead><tbody>'
    '<tr><td>Tambal gigi, 51</td><td>Resin komposit A2</td><td class="r">1 unit</td><td>14 unit</td></tr>'
    '<tr><td></td><td>Gel etsa</td><td class="r">1 aplikasi</td><td>20</td></tr>'
    '<tr><td>Gigi tiruan, 31 <span class="bdg luar">Luar</span></td><td colspan="3">Tidak memakai stok klinik</td></tr>'
    '</tbody></table></div>'
    '<span class="mu t12">Pemakaian stok tanpa tagihan akan muncul di peringatan pemilik.</span>'
    '</main>'
)
bahan_board = shell('Rekam Medis', 'Rekam Medis', 'tooth', patient_head() + itabs() + bahan_inner)

# ---------- D. Owner detection ----------
def kpi(label, value, sub, warn=False):
    cls = ' kpi warn' if warn else ' kpi'
    badge = '<span class="bdg wt">Di atas rata-rata</span>' if warn else ''
    return f'<div class="card{cls}"><span class="up">{label}</span><span class="t32">{value}</span><span class="t12 mu">{sub}</span>{badge}</div>'


lap_inner = (
    '<main class="cnt fc g16">'
    '<div class="f jb ac"><div class="fc g4"><h2 class="t20">Laporan per dokter</h2>'
    '<span class="mu">1 s.d. 14 Nov 2026. Dibanding rata-rata klinik.</span></div>'
    '</div>'
    '<div class="gd c4">'
    + kpi('Tindakan luar', '18', 'Seluruh dokter')
    + kpi('Tarif Rp 0', '4', 'Butuh persetujuan')
    + kpi('Diskon', '7', 'Termasuk 100%')
    + kpi('Tanpa tagihan', '3', 'Antrean selesai', True)
    + '</div>'
    '<div class="card" style="overflow:hidden">'
    '<table class="tbl log"><thead><tr>'
    '<th>Dokter</th><th class="r">Luar</th><th class="r">Rp 0</th><th class="r">Diskon</th><th class="r">Tanpa tagihan</th><th></th>'
    '</tr></thead><tbody>'
    '<tr><td>drg. Nadia Putri</td><td class="r">2</td><td class="r">0</td><td class="r">1</td><td class="r">0</td><td></td></tr>'
    '<tr><td>drg. Arif Hidayat</td><td class="r">9</td><td class="r">3</td><td class="r">4</td><td class="r">2</td>'
    '<td><span class="bdg wt">Di atas rata-rata</span></td></tr>'
    '<tr><td>drg. Rina Wijaya, Sp.KG</td><td class="r">3</td><td class="r">0</td><td class="r">1</td><td class="r">0</td><td></td></tr>'
    '<tr><td>drg. Clara Wijaya, Sp.KGA</td><td class="r">4</td><td class="r">1</td><td class="r">1</td><td class="r">1</td>'
    '<td><span class="bdg wt">Tanpa tagihan</span></td></tr>'
    '<tr><td class="mu">Rata-rata klinik</td><td class="r mu">2</td><td class="r mu">0,4</td><td class="r mu">1</td><td class="r mu">0,3</td><td></td></tr>'
    '</tbody></table></div></main>'
)
lap_board = shell('Laporan', 'Laporan', 'chart', lap_inner, who='drg. Nadia Putri', role='Pemilik', ini='NP')

warn_inner = (
    '<main class="cnt fc g16">'
    '<div class="fc g4"><h2 class="t20">Peringatan</h2>'
    '<span class="mu">Antrean yang perlu ditinjau pemilik. Sabtu 14 Nov 2026, 12.00 WIB.</span></div>'
    '<div class="card p16 fc g8">'
    '<div class="row44"><span class="bdg wt">Tanpa tagihan</span>'
    '<div class="fc w1"><b>Antrean selesai tanpa tagihan</b>'
    '<span class="mu t12">Ratna Dewi Anggraini, scaling, drg. Arif Hidayat. Selesai 11.20, belum ada tagihan.</span></div>'
    '<button class="btn sec">Buka antrean</button></div>'
    '<div class="row44"><span class="bdg wt">Luar setelah datang</span>'
    '<div class="fc w1"><b>Status Luar dicatat setelah pasien datang</b>'
    '<span class="mu t12">Joko Wijaya check-in 09.15. Tambal 26 ditandai Klinik lain 10.30, drg. Arif Hidayat.</span></div>'
    '<button class="btn sec">Buka rekam</button></div>'
    '<div class="row44"><span class="bdg dg">Stok tanpa tagihan</span>'
    '<div class="fc w1"><b>Stok terpakai tanpa tagihan</b>'
    '<span class="mu t12">Resin komposit A3, 1 unit, terpakai di kunjungan Clara Wijaya, Alya Rahmawati. Tagihan Rp 0 masih menunggu persetujuan.</span></div>'
    '<button class="btn sec">Buka bahan</button></div>'
    '</div></main>'
)
warn_board = shell('Laporan', 'Laporan', 'chart', warn_inner, who='drg. Nadia Putri', role='Pemilik', ini='NP')

wa_inner = (
    '<main class="cnt fc g16">'
    '<div class="fc g4"><h2 class="t20">Struk WhatsApp</h2>'
    '<span class="mu">Status kirim ke pasien.</span></div>'
    '<div class="card p16 fc g8">'
    '<div class="row44"><span class="av">BS</span><div class="fc w1"><b>Budi Santoso</b>'
    '<span class="mu t12">Tambal 51, Rp 450.000. Dikirim 13 Nov 09.52 ke 0812-0000-1111.</span></div>'
    '<span class="bdg ok">Dibaca 10.02</span></div>'
    '<div class="row44"><span class="av">JW</span><div class="fc w1"><b>Joko Wijaya</b>'
    '<span class="mu t12">Scaling, Rp 400.000. Dikirim 14 Nov 11.25 ke 0812-0000-2222.</span></div>'
    '<span class="bdg in">Terkirim</span></div>'
    '<div class="row44"><span class="av">RD</span><div class="fc w1"><b>Ratna Dewi Anggraini</b>'
    '<span class="mu t12">Belum ada tagihan, struk tidak dikirim.</span></div>'
    '<span class="bdg wt">Belum ada struk</span></div>'
    '<div class="row44"><span class="av">HG</span><div class="fc w1"><b>Hendra Gunawan</b>'
    '<span class="mu t12">Tambal, Rp 450.000. Gagal 14 Nov 08.10 ke 0812-0000-3333.</span></div>'
    '<span class="bdg dg">Gagal</span><button class="btn sec">Kirim ulang</button></div>'
    '</div></main>'
)
wa_board = shell('Kasir', 'Kasir', 'wallet', wa_inner, who='Sari Front Desk', role='Resepsionis', ini='SF')

audit_inner = (
    '<main class="cnt fc g16">'
    '<div class="f jb ac"><div class="fc g4"><h2 class="t20">Audit log</h2>'
    '<span class="mu">Tidak dapat dihapus atau diubah. 8 catatan tampil.</span></div></div>'
    '<div class="card" style="overflow:hidden">'
    '<table class="tbl log"><thead><tr>'
    '<th>Waktu, WIB</th><th>Pengguna</th><th>Aksi</th><th>Objek</th>'
    '</tr></thead><tbody>'
    '<tr><td>13 Nov 09.18</td><td>drg. Nadia Putri</td><td>Catat tindakan luar</td><td>Gigi tiruan 31, Budi Santoso</td></tr>'
    '<tr><td>13 Nov 09.22</td><td>Sari Front Desk</td><td>Konfirmasi tindakan luar</td><td>Gigi tiruan 31</td></tr>'
    '<tr><td>13 Nov 09.48</td><td>drg. Nadia Putri</td><td>Tanda tangan tindakan</td><td>Tambal 51</td></tr>'
    '<tr><td>13 Nov 09.50</td><td>Sari Front Desk</td><td>Buat tagihan</td><td>TG-2026-11013-001, Rp 450.000</td></tr>'
    '<tr><td>13 Nov 09.52</td><td>Sistem</td><td>Kirim struk WhatsApp</td><td>Budi Santoso, dibaca 10.02</td></tr>'
    '<tr><td>14 Nov 08.50</td><td>drg. Nadia Putri</td><td>Koreksi catatan</td><td>Tambal 51, alasan salah bahan</td></tr>'
    '<tr><td>14 Nov 11.05</td><td>Sari Front Desk</td><td>Ajukan diskon 100%</td><td>Alya Rahmawati, tambal 74</td></tr>'
    '<tr><td>14 Nov 11.20</td><td>Sistem</td><td>Peringatan tanpa tagihan</td><td>Ratna Dewi Anggraini</td></tr>'
    '</tbody></table></div>'
    '<span class="mu t12">Tidak ada tombol hapus. Koreksi tercatat sebagai baris baru.</span>'
    '</main>'
)
audit_board = shell('Laporan', 'Laporan', 'chart', audit_inner, who='drg. Nadia Putri', role='Pemilik', ini='NP')


# ---------- document ----------
sec_flow = section(
    'Alur singkat',
    'Pemeriksaan awal boleh mencatat pekerjaan klinik lain. Kunjungan dengan tindakan hari ini tidak.',
    [ab('1', 'Di sini, ditagih', '420×640', flow_here),
     arw('Sama kode'),
     ab('2', 'Klinik lain, tidak ditagih', '420×640', flow_luar),
     arw('Perlu konfirmasi'),
     ab('3', 'Konfirmasi resepsionis', '420×640', flow_conf)],
    [ab('4', 'Hari ini, klinik lain mati', '420×640', flow_off)],
)

sec_input = section(
    'Mencatat tindakan luar',
    'Kode sama dengan katalog. Warna bukan teal. Wajib nama klinik dan perkiraan tanggal.',
    [ab('5', 'Pemeriksaan awal', '1280×900', rm_awal),
     ab('6', 'Konfirmasi di antrean', '1280×900', fo_board)],
    [ab('7', 'Kunjungan hari ini', '1280×900', rm_today),
     ab('8', 'Warna odontogram', '1280×900', rm_warna)],
    [ab('9', 'Tagihan, luar tidak masuk', '1280×900', kasir_board)],
)

sec_hist = section(
    'Riwayat dan histori',
    'Panel per gigi, slider tanggal, linimasa. Catatan lama tidak dihapus.',
    [ab('10', 'Riwayat gigi 31', '1280×900', hist_31),
     ab('11', 'Riwayat gigi 51', '1280×900', hist_51)],
    [ab('12', 'Slider, Juni 2025', '1280×900', slide_past),
     ab('13', 'Slider dan linimasa, 13 Nov', '1280×900', slide_mid)],
    [ab('14', 'Linimasa kunjungan', '1280×900', linimasa_board)],
    [ab('15', 'Koreksi catatan', '1280×900', hist_koreksi),
     ab('16', 'Restorasi digantikan', '1280×900', hist_ganti)],
)

sec_bill = section(
    'Pencegahan tanpa tagihan',
    'Kunjungan ber-tindakan tidak bisa ditutup tanpa tagihan. Rp 0 perlu pemilik. Metode hanya milik klinik.',
    [ab('17', 'Blok tutup tanpa tagihan', '1280×900', blok_board),
     ab('18', 'Persetujuan diskon 100%', '1280×900', approve_board)],
    [ab('19', 'Metode bayar klinik', '1280×900', bayar_board),
     ab('20', 'Pemakaian bahan', '1280×900', bahan_board)],
)

sec_owner = section(
    'Deteksi untuk pemilik',
    'Laporan dibanding rata-rata, antrean peringatan, status struk, audit yang tidak bisa dihapus.',
    [ab('21', 'Laporan per dokter', '1280×900', lap_board),
     ab('22', 'Daftar peringatan', '1280×900', warn_board)],
    [ab('23', 'Struk WhatsApp', '1280×900', wa_board),
     ab('24', 'Audit log', '1280×900', audit_board)],
)

html = (
    '<!doctype html><html lang="id"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1">'
    '<title>Bittodent / Riwayat dan kontrol tindakan</title>'
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">'
    f'<style>{CSS}\n{EXTRA_CSS}</style></head><body>'
    f'{SPRITE}'
    '<header class="bh"><h1>Bittodent / Riwayat dan kontrol tindakan</h1>'
    '<span class="mu b6">Board statis. Klinik Gigi Senyum Sehat, Sabtu 14 Nov 2026.</span></header>'
    f'{sec_flow}{sec_input}{sec_hist}{sec_bill}{sec_owner}'
    '</body></html>'
)

OUT.write_text(html)
ART.parent.mkdir(parents=True, exist_ok=True)
ART.write_text(html)
raw = len(html.encode())
print(f'HTML {raw/1024:.1f} KB ({raw} B)')
print('wrote', OUT)
print('wrote', ART)
