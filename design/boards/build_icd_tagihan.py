#!/usr/bin/env python3
"""Papan desain alur EHR ke tagihan dan ICD otomatis.

Hasil: design/boards/icd-tagihan.html dan /workspace/artifacts/bittodent-board-icd-tagihan.html
Data sintetis. Tanpa JavaScript. Tidak mengubah kode app.
"""
from __future__ import annotations

import base64
import io
import re
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'design/boards/icd-tagihan.html'
ART = Path('/workspace/artifacts/bittodent-board-icd-tagihan.html')
KASIR = ROOT / 'design/boards/kasir.html'

src = KASIR.read_text()
CSS = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
SPRITE = re.search(r'<svg width="0".*?</svg>', src, re.S).group(0)

# Extra icons used in chrome sketch
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
.icd{{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border-radius:999px;border:1px solid var(--n200);background:#fff;font-weight:600;white-space:nowrap}}
.icd.on{{background:var(--b0);border-color:var(--b);color:var(--bh)}}
.icd .cd{{font-variant-numeric:tabular-nums}}
.src{{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ifg)}}
.rs{{display:flex;align-items:center;gap:12px;min-height:44px;padding:0 12px;border-radius:10px}}
.rs.on{{background:var(--b0)}}
.rs .cd{{font-weight:700;font-variant-numeric:tabular-nums;width:56px;flex:none}}
.cond{{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 14px;border-radius:999px;border:1px solid var(--n200);background:#fff;font-weight:600}}
.cond.on{{background:var(--dbg);border-color:var(--dfg);color:var(--dfg)}}
.lockrow{{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 12px;border-radius:10px;background:var(--lbg);border:1px solid var(--lbd);color:var(--lfg);font-weight:600}}
.pop{{position:absolute;left:16px;right:16px;top:56px;background:#fff;border:1px solid var(--bd);border-radius:12px;box-shadow:0 16px 40px rgba(36,48,68,.08);padding:8px;z-index:2}}
.side.cp .clinic,.side.cp .nlab{{display:none}}
.tbl td:first-child,.tbl th:first-child{{white-space:nowrap;width:1%}}
.trw{{display:flex;align-items:center;gap:12px;min-height:44px;padding:8px 14px;border:1px solid var(--bd);border-radius:10px;background:#fff}}
.trw.on{{background:var(--sm);border-color:var(--n200)}}
.trw .amt{{margin-left:auto;font-weight:700;font-variant-numeric:tabular-nums}}
.eq{{color:var(--mu);font-weight:600}}
.seg.cat{{width:100%;max-width:280px}}
.seg.cat div{{height:44px}}
.seg.cat .on{{color:var(--tx)}}
.dlist{{display:flex;flex-direction:column;gap:4px}}
.dlist .row{{display:flex;align-items:center;gap:12px;min-height:44px;padding:0 12px;border-radius:10px}}
.dlist .row.on{{background:var(--b0)}}

'''

# ---------- chrome ----------
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
        '<button class="btn pri">Buat janji</button>'
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


# ---------- pieces ----------

def doc_badge(cat):
    if cat == 'Spesialis':
        return '<span class="bdg in">Spesialis</span>'
    return '<span class="bdg sg">Umum</span>'


def doc_cell(name, cat):
    return f'<div class="f ac g8">{name}{doc_badge(cat)}</div>'


def chips(selected='K08.3', locked=False, extra=None):
    items = extra or [
        ('K08.3', 'Sisa akar gigi'),
    ]
    if locked:
        rows = ''.join(
            f'<div class="lockrow">{ico("lock", 16)}<span class="cd">{c}</span> {n}</div>'
            for c, n in items
        )
        return f'<div class="fc g8"><span class="src">SATUSEHAT</span>{rows}</div>'
    out = []
    for c, n in items:
        on = ' on' if c == selected else ''
        saran = '<span class="bdg in">Saran</span>' if c == selected else ''
        out.append(f'<div class="icd{on}"><span class="cd">{c}</span> {n}{saran}</div>')
    return f'<div class="fc g8"><span class="src">SATUSEHAT</span><div class="f wr g8">{"".join(out)}</div></div>'


def tooth_block(cond='Sisa akar'):
    return (
        '<div class="fc g8">'
        '<div class="f jb ac"><h2 class="t20">Gigi 36</h2><span class="mu">Geraham bawah kiri</span></div>'
        f'<div class="f wr g8"><span class="cond on">{cond}</span></div>'
        '</div>'
    )


def tindakan_block(locked=False, code='23.11', name='Pengambilan sisa akar'):
    if locked:
        return (
            '<div class="fc g8"><span class="lab">Tindakan</span>'
            f'<div class="lockrow">{ico("lock", 16)}{name}<span class="ma t12">{code}</span></div>'
            '</div>'
        )
    return (
        '<div class="fc g8"><span class="lab">Tindakan</span>'
        f'<div class="inp">{ico("search", 16)}{name}</div>'
        f'<div class="f ac g8"><span class="lab">ICD-9-CM</span><span class="bdg sg">{code}</span><span class="mu t12">Dari katalog</span></div>'
        '</div>'
    )


def panel(selected='K08.3', locked=False, search=None, cta='Tanda tangan', status='Draft', st_cls='wt', extra=None, tindakan=None, cond='Sisa akar'):
    body = tooth_block(cond)
    body += chips(selected, locked=locked, extra=extra)
    if search is not None:
        q, results, cur = search
        rows = ''
        for c, n in results:
            on = ' on' if c == cur else ''
            rows += f'<div class="rs{on}"><span class="cd">{c}</span><span>{n}</span></div>'
        body += (
            f'<div class="fc g8" style="position:relative"><span class="lab">Ganti kode</span>'
            f'<div class="inp is-f">{ico("search", 16)}{q}</div>'
            f'<div class="pop">{rows}</div></div>'
        )
    tn, tc = (tindakan or ('Pengambilan sisa akar', '23.11'))
    body += tindakan_block(locked=locked, code=tc, name=tn)
    body += f'<div class="f ac g8"><span class="bdg {st_cls}" style="align-self:flex-start">{status}</span></div>'
    if cta:
        body += f'<button class="btn pri wf">{cta}</button>'
    return f'<div class="card fc g16" style="flex:1;min-height:0">{body}</div>'


def chart():
    return '<div class="card g-odo" style="flex:1;min-height:0;padding:0"></div>'


def rm_body(panel_html, today=None):
    today = today or (
        '<div class="card p16 fc g8">'
        '<div class="f jb ac"><span class="t16 b6">Tindakan hari ini</span>'
        '<span class="bdg wt">Draft</span></div>'
        '<div class="f jb ac"><span>Pengambilan sisa akar, gigi 36</span>'
        '<span class="bdg in">K08.3</span><span class="bdg sg">23.11</span></div>'
        '</div>'
    )
    return (
        f'<div class="f g20" style="flex:1;min-height:0">'
        f'<div class="fc g16 w1" style="min-height:0">{chart()}{today}</div>'
        f'<div class="fc" style="width:360px;flex:none">{panel_html}</div>'
        f'</div>'
    )


def modal(title, body, actions, tone='dg'):
    return (
        '<div class="scrim">'
        f'<div class="modal" style="width:440px">'
        f'<h2 class="t20">{title}</h2>'
        f'{body}'
        f'<div class="f g8" style="justify-content:flex-end">{actions}</div>'
        f'</div></div>'
    )


def flow_frame(inner):
    return f'<div class="scr fl"><div class="fc" style="flex:1;min-height:0;padding:16px">{inner}</div></div>'


# ---------- artboards ----------
# 1-6 flow
flow1 = flow_frame(
    '<div class="card fc g16" style="height:100%">'
    + tooth_block()
    + '<div class="g-odo" style="flex:1;min-height:180px;border:1px solid var(--bd);border-radius:16px"></div>'
    + '<span class="bdg wt" style="align-self:flex-start">Draft</span>'
    + '</div>'
)
flow2 = flow_frame(
    '<div class="card fc g16" style="height:100%">'
    + tooth_block()
    + chips('K08.3')
        + '</div>'
)
flow3 = flow_frame(
    '<div class="card fc g16" style="height:100%">'
    + tooth_block()
    + chips('K08.3')
    + tindakan_block()
    + '<span class="bdg wt" style="align-self:flex-start">Draft</span>'
    + '</div>'
)
flow_tarif = flow_frame(
    '<div class="card fc g16" style="height:100%">'
    '<div class="fc g4"><h2 class="t20">Pilih tarif</h2>'
    '<span class="mu">Pengambilan sisa akar, gigi 36.</span></div>'
    '<div class="f ac g8">drg. Nadia Putri ' + doc_badge('Umum') + '</div>'
    '<div class="fc g8">'
    '<div class="trw"><span>Tarif khusus dokter</span><span class="amt mu">Tidak ada</span></div>'
    '<div class="trw on"><span>Tarif kategori, Umum</span><span class="bdg sg">Dipakai</span><span class="amt">150.000</span></div>'
    '<div class="trw"><span>Tarif Umum</span><span class="amt">150.000</span></div>'
    '</div>'
    '<span class="mu t12">Disimpan saat tanda tangan.</span>'
    '</div>'
)
sign_card = (
    '<div class="card fc g16" style="height:100%">'
    '<h2 class="t20">Tanda tangan</h2>'
    '<div class="fc g8"><span class="lab">A, diagnosis</span>'
    '<div class="f wr g8"><span class="bdg in">K08.3 Sisa akar gigi</span></div></div>'
    '<div class="fc g8"><span class="lab">P, tindakan</span>'
    '<div class="f wr g8"><span class="bdg sg">23.11 Pengambilan sisa akar</span></div></div>'
    '<div class="lockrow">' + ico('lock', 16) + 'Rp 150.000, tarif Umum</div>'
    '<span class="mu t12">Harga disimpan saat tanda tangan.</span>'
    '<button class="btn pri wf ma" style="margin-top:auto">Tanda tangan</button>'
    '</div>'
)
flow4 = flow_tarif
flow4b = flow_frame(sign_card)
flow5 = flow_frame(
    '<div class="card fc g16" style="height:100%">'
    '<div class="fc g4"><h2 class="t20">Tagihan</h2><span class="mu">Budi Santoso. Kasir Sari Front Desk.</span></div>'
    '<div class="fc g12">'
    '<div class="f jb ae g12"><div class="fc g4"><b>Cabut gigi, geraham bawah kiri</b>'
    + doc_cell('drg. Nadia Putri', 'Umum') +
    '</div><b class="t16">150.000</b></div>'
    '<div class="hr"></div>'
    '<div class="kv"><span class="b6">Total</span><b>150.000</b></div>'
    '</div>'
    '<span class="bdg ok" style="align-self:flex-start">Siap dibayar</span>'
    '</div>'
)
flow6 = flow_frame(
    '<div class="card fc ac g12" style="height:100%;background:var(--n50)">'
    '<div class="paper fc g8" style="width:280px;padding:16px 14px;border-radius:8px">'
    '<div class="c"><b class="t14">Klinik Gigi Senyum Sehat</b>'
    '<div>Jl. Tebet Raya No. 21, Jakarta Selatan</div></div>'
    '<div class="c b7" style="letter-spacing:.16em">KUITANSI</div>'
    '<div class="hd"></div>'
    '<div class="kv"><span>No.</span><span>TG-2026-11014-001</span></div>'
    '<div class="kv"><span>Tanggal</span><span>14/11/2026 20.28</span></div>'
    '<div class="kv"><span>Kasir</span><span>Sari Front Desk</span></div>'
    '<div class="kv"><span>Pasien</span><span>Budi Santoso</span></div>'
    '<div class="kv"><span>Dokter</span><span>drg. Nadia Putri</span></div>'
    '<div class="kv"><span>Penjamin</span><span>Umum</span></div>'
    '<div class="hd"></div>'
    '<div>Cabut gigi geraham bawah kiri</div>'
    '<div class="kv"><span>1 × 150.000</span><span>150.000</span></div>'
    '<div class="hd"></div>'
    '<div class="kv"><span>Total</span><b>150.000</b></div>'
    '<div class="c t12 mu">Umum, tunai</div>'
    '</div></div>'
)

sec_flow = section(
    'Alur cabut gigi 36',
    'Temuan sampai struk. Data sintetis.',
    [
        ab('1', 'Temuan', '420×640', flow1),
        arw('Saran'),
        ab('2', 'Saran ICD-10', '420×640', flow2),
        arw('Tindakan'),
        ab('3', 'Tindakan', '420×640', flow3),
        arw('Tarif'),
        ab('4', 'Pilih tarif', '420×640', flow4),
        arw('Tanda tangan'),
        ab('5', 'Tanda tangan', '420×640', flow4b),
        arw('Tagihan'),
        ab('6', 'Tagihan', '420×640', flow5),
        arw('Struk'),
        ab('7', 'Struk', '420×640', flow6),
    ],
)

# 7 RM + chips
sec_rm = section(
    'Rekam medis, saran ICD',
    'Desktop 1280×900. Tanpa tab luar Profil atau Keluarga.',
    [
        ab('8', 'Rekam medis, saran ICD', '1280×900', rm_shell(rm_body(panel()))),
        ab('9', 'Ganti kode', '1280×900', rm_shell(rm_body(panel(
            selected=None,
            search=('sisa', [
                ('K08.3', 'Sisa akar gigi'),
                ('K08.1', 'Kehilangan gigi'),
                ('K04.5', 'Periodontitis apikal kronis'),
            ], 'K08.3'),
            cta='Simpan kode',
        )))),
    ],
)

# 9-11 validation
today_empty = '<div></div>'
blok_hilang = modal(
    'Tidak bisa menandatangani',
    '<div class="ban dg">' + ico('alert') + '<div class="fc g4"><b>Gigi 36 sudah berstatus hilang.</b>'
    '<span>Tindakan pada gigi yang hilang diblok.</span></div></div>',
    '<button class="btn sec">Tutup</button>',
)
blok_sulung = modal(
    'Kode tidak sesuai',
    '<div class="ban dg">' + ico('alert') + '<div class="fc g4"><b>23.01 hanya untuk gigi sulung.</b>'
    '<span>Gigi 36 adalah gigi permanen.</span></div></div>',
    '<button class="btn sec">Batal</button><button class="btn pri">Ganti ke 23.09</button>',
)
warn_diag = modal(
    'Diagnosis tidak sejalan',
    '<div class="ban wt">' + ico('alert') + '<div class="fc g4"><b>K02.0 karies email tidak sejalan dengan perawatan saluran akar.</b>'
    '<span>Isi alasan untuk tetap menandatangani.</span></div></div>'
    '<div class="fld"><span class="lab">Alasan</span><div class="inp"><span class="ph">Wajib diisi</span></div></div>',
    '<button class="btn sec">Batal</button><button class="btn pri is-d">Tanda tangan</button>',
)

# wrap modal over RM
def rm_modal(modal_html, pan=None):
    inner = rm_body(pan or panel())
    # shell already includes scr, so inject modal into the screen by appending after shell open... 
    # easier: build shell then insert modal before last close of .scr
    html = rm_shell(inner)
    return html[:-6] + modal_html + '</div>'  # closes .scr? wait rm_shell ends with </div></div> for scr and? 
    # shell = <div class="scr d12"> sidebar <div class="app">...</div></div>
    # so last 6 chars '</div>' closes scr if we only have two closing. Actually ends with </div> of scr.
    # html[:-6] + modal + '</div>' is correct if it ends with </div>.

# verify: shell ends with '</div></div>'  (app, scr)
# Better do: html.replace('</div></div>', modal+'</div></div>', 1) from the end.

def with_overlay(screen, overlay):
    assert screen.endswith('</div></div>')
    return screen[:-12] + overlay + '</div></div>'

sec_val = section(
    'Validasi tanda tangan',
    'Blok menghentikan. Peringatan minta alasan.',
    [
        ab('10', 'Blok, gigi hilang', '1280×900', with_overlay(rm_shell(rm_body(panel())), blok_hilang)),
        ab('11', 'Blok, kode sulung', '1280×900', with_overlay(rm_shell(rm_body(
            panel(cta='Tanda tangan', cond='Perlu dicabut', tindakan=('Ekstraksi gigi sulung', '23.01')),
            today='<div class="card p16 fc g8"><div class="f jb ac"><span class="t16 b6">Tindakan hari ini</span><span class="bdg wt">Draft</span></div><div class="f jb ac"><span>Ekstraksi gigi sulung, gigi 36</span><span class="bdg in">K08.3</span><span class="bdg sg">23.01</span></div></div>',
        )), blok_sulung)),
        ab('12', 'Peringatan, diagnosis', '1280×900', with_overlay(rm_shell(rm_body(
            panel(selected='K02.0', extra=[('K02.0', 'Karies email')], cond='Karies',
                  tindakan=('Perawatan saluran akar', '23.71')),
            today='<div class="card p16 fc g8"><div class="f jb ac"><span class="t16 b6">Tindakan hari ini</span><span class="bdg wt">Draft</span></div><div class="f jb ac"><span>Perawatan saluran akar, gigi 36</span><span class="bdg in">K02.0</span><span class="bdg sg">23.71</span></div></div>',
        )), warn_diag)),
    ],
)

# 12-13 kasir
def kasir_body(banner, rows, cta=None, total='150.000'):
    tr = ''.join(f'<tr>{r}</tr>' for r in rows)
    foot_cta = cta or '<button class="btn pri">Terima pembayaran</button>'
    return (
        '<main class="cnt">'
        '<div class="f jb ae g16"><div class="fc g4"><h1 class="t28">Tagihan</h1>'
        '<span class="mu">Budi Santoso. Sabtu 14 Nov 2026, 20.30 WIB.</span></div>'
        f'<div class="f g8">{foot_cta}</div></div>'
        f'{banner}'
        '<div class="card p16" style="flex:1;min-height:0">'
        '<table class="tbl"><thead><tr><th>Uraian</th><th>Dokter</th><th class="r">Jumlah</th></tr></thead>'
        f'<tbody>{tr}</tbody>'
        f'<tfoot><tr><td colspan="2">Total</td><td class="r">{total}</td></tr></tfoot>'
        '</table></div></main>'
    )

ban_wait = (
    '<div class="ban wt">' + ico('alert') +
    '<div class="fc g4 w1"><b>Menunggu tanda tangan drg. Nadia Putri, 2 tindakan.</b>'
    '<span>Belum bisa ditagih.</span></div>'
    '<button class="btn sec s">Ingatkan dokter</button></div>'
)
ban_tarif = (
    '<div class="ban wt">' + ico('alert') +
    '<div class="fc g4 w1"><b>Tarif belum diatur: Cabut gigi.</b>'
    '<span>Pemilik sudah diberi tugas.</span></div></div>'
)

kasir12 = shell(
    'Kasir', 'Kasir', 'wallet',
    kasir_body(
        ban_wait,
        [
            '<td>Cabut gigi, geraham bawah kiri</td><td>' + doc_cell('drg. Nadia Putri', 'Umum') + '</td><td class="r"><span class="bdg wt">Menunggu</span></td>',
            '<td>Tambal gigi, geraham bawah kanan</td><td>' + doc_cell('drg. Nadia Putri', 'Umum') + '</td><td class="r"><span class="bdg wt">Menunggu</span></td>',
        ],
        cta='<button class="btn pri is-d">Terima pembayaran</button>',
        total='Belum ada',
    ),
    who='Sari Front Desk', role='Kasir', ini='SF', search='Cari pasien atau tagihan',
)
kasir13 = shell(
    'Kasir', 'Kasir', 'wallet',
    kasir_body(
        ban_tarif,
        [
            '<td>Cabut gigi, geraham bawah kiri</td><td>' + doc_cell('drg. Nadia Putri', 'Umum') + '</td><td class="r">Belum ada</td>',
        ],
        cta='<button class="btn pri is-d">Terima pembayaran</button>',
        total='Belum ada',
    ),
    who='Sari Front Desk', role='Kasir', ini='SF', search='Cari pasien atau tagihan',
)

kasir15 = shell(
    'Kasir', 'Kasir', 'wallet',
    kasir_body(
        '',
        [
            '<td>Cabut gigi, geraham bawah kiri</td><td>' + doc_cell('drg. Nadia Putri', 'Umum') + '</td><td class="r">150.000</td>',
        ],
        cta='<button class="btn pri">Terima pembayaran</button>',
        total='150.000',
    ),
    who='Sari Front Desk', role='Kasir', ini='SF', search='Cari pasien atau tagihan',
)
kasir16 = shell(
    'Kasir', 'Kasir', 'wallet',
    kasir_body(
        '',
        [
            '<td>Cabut gigi, geraham bawah kiri</td><td>' + doc_cell('drg. Rina Wijaya', 'Spesialis') + '</td><td class="r">180.000</td>',
        ],
        cta='<button class="btn pri">Terima pembayaran</button>',
        total='180.000',
    ),
    who='Sari Front Desk', role='Kasir', ini='SF', search='Cari pasien atau tagihan',
)

sec_kasir = section(
    'Kasir',
    'Harga akhir, nama dokter, dan kategori. Tanpa ICD atau FDI.',
    [
        ab('13', 'Menunggu tanda tangan', '1280×900', kasir12),
        ab('14', 'Tarif belum diatur', '1280×900', kasir13),
        ab('15', 'Tagihan, Umum', '1280×900', kasir15),
        ab('16', 'Tagihan, spesialis', '1280×900', kasir16),
    ],
)

# 14 tablet, 15 phone
tablet_panel = panel()
# tighter for tablet: stack chart above chips? 1024 compact sidebar, 8+4 may work
tablet_inner = (
    patient_head().replace('padding:16px 28px 8px', 'padding:12px 16px 4px')
    + itabs()
    + '<main class="cnt" style="padding:16px">'
    + '<div class="f g16" style="flex:1;min-height:0">'
    + '<div class="card g-odo w1" style="padding:0;min-height:0"></div>'
    + '<div style="width:340px;flex:none">' + panel() + '</div>'
    + '</div></main>'
)
tab_screen = shell('Rekam Medis', 'Rekam Medis', 'tooth', tablet_inner, size='t', compact=True, syn=True)

phone = (
    '<div class="scr m">'
    f'<header class="ph-h">{ico("chevl", 24)}<b class="w1 t16">Rekam Medis</b><span class="syn">DATA SINTETIS</span></header>'
    '<main class="ph-b" style="padding:0;background:var(--cv)">'
    '<div class="fc g4" style="padding:12px 16px 8px;background:#fff">'
    '<b class="t18">Budi Santoso</b><span class="t12 mu">36 th, laki-laki. Umum.</span></div>'
    '<div class="card fc g16" style="margin:12px 16px 0;flex:1;min-height:0">'
    + tooth_block()
    + chips('K08.3')
    + tindakan_block()
    + '<span class="bdg wt" style="align-self:flex-start">Draft</span>'
    + '</div></main>'
    '<footer class="ph-f"><button class="btn pri wf">Tanda tangan</button></footer>'
    '<nav class="tabb">'
    f'<div>{ico("home")}Beranda</div><div>{ico("cal")}Jadwal</div>'
    f'<div>{ico("users")}Pasien</div><div class="on">{ico("tooth")}Rekam Medis</div>'
    f'<div>{ico("dots")}Lainnya</div>'
    '</nav></div>'
)

sec_dev = section(
    'Saran ICD di tablet dan HP',
    'Chip 44 px. Sumber SATUSEHAT.',
    [
        ab('17', 'Saran ICD, tablet', '1024×768', tab_screen),
        ab('18', 'Saran ICD, HP', '390×844', phone),
    ],
)

# 16 master
# (kode, klinis, awam, icd, umum, spesialis or None, selected)
CAT_ROWS = [
    ('EXT-P', 'Ekstraksi gigi permanen', 'Cabut gigi', '23.09', '150.000', '200.000'),
    ('EXT-D', 'Ekstraksi gigi sulung', 'Cabut gigi susu', '23.01', '100.000', None),
    ('EXT-RR', 'Pengambilan sisa akar', 'Cabut sisa akar gigi', '23.11', '150.000', '200.000', True),
    ('ODT', 'Odontektomi', 'Operasi gigi bungsu', '23.19', '1.500.000', '2.000.000'),
    ('RST-KOMP', 'Tumpatan resin komposit', 'Tambal gigi', '23.2', '450.000', '550.000'),
    ('PSA', 'Perawatan saluran akar', 'Perawatan saraf gigi', '23.71', '800.000', '1.200.000'),
    ('SCL', 'Skeling dan pemolesan', 'Pembersihan karang gigi', '96.54', '400.000', None),
    ('CRN', 'Mahkota tiruan', 'Mahkota gigi', '23.41', '2.000.000', '2.500.000'),
]

def cat_tr(row):
    on = ' style="background:var(--b0)"' if (len(row) > 6 and row[6]) else ''
    c, klin, awam, icd, umum, sp = row[:6]
    sp_cell = f'<span class="eq">= Umum</span>' if sp is None else sp
    return f'<tr{on}><td class="b6">{c}</td><td>{klin}</td><td>{awam}</td><td>{icd}</td><td class="r">{umum}</td><td class="r">{sp_cell}</td></tr>'

edit = (
    '<div class="card fc g16" style="width:340px;flex:none">'
    '<h2 class="t20">EXT-RR</h2>'
    '<div class="fld"><span class="lab">Nama klinis</span><div class="inp">Pengambilan sisa akar</div></div>'
    '<div class="fld"><span class="lab">Nama awam</span><div class="inp">Cabut sisa akar gigi</div></div>'
    '<div class="fld"><span class="lab">Alias</span><div class="f wr g8">'
    '<span class="chip">radix</span><span class="chip">sisa akar</span><span class="chip">gangren radix</span>'
    '</div></div>'
    '<div class="fld"><span class="lab">ICD-9-CM</span><div class="inp">23.11</div></div>'
    '<div class="fld"><span class="lab">Tarif Umum</span><div class="inp">Rp 150.000</div></div>'
    '<div class="fld"><span class="lab">Tarif Spesialis</span><div class="inp">Rp 200.000</div></div>'
    '<button class="btn pri wf">Simpan</button>'
    '</div>'
)
master_inner = (
    '<main class="cnt">'
    '<div class="f jb ae g16"><div class="fc g4"><h1 class="t28">Tindakan</h1>'
    '<span class="mu">Klinik Gigi Senyum Sehat.</span></div>'
    '<button class="btn pri">' + ico('plus', 16) + ' Baru</button></div>'
    '<div class="f g20" style="flex:1;min-height:0">'
    '<div class="card p16 w1" style="overflow:hidden"><table class="tbl"><thead><tr>'
    '<th>Kode</th><th>Nama klinis</th><th>Nama awam</th><th>ICD-9-CM</th><th class="r">Umum</th><th class="r">Spesialis</th>'
    '</tr></thead><tbody>' + ''.join(cat_tr(r) for r in CAT_ROWS) + '</tbody></table></div>'
    + edit + '</div></main>'
)
master = shell('Tindakan', 'Tindakan', 'file', master_inner, who='drg. Nadia Putri', role='Pemilik', ini='NP', search='Cari kode atau nama')

def dokter_inner(active_name, ini, cat, overrides):
    people = [
        ('NP', 'drg. Nadia Putri', 'Umum'),
        ('RW', 'drg. Rina Wijaya', 'Spesialis'),
        ('AP', 'drg. Andi Pratama', 'Umum'),
    ]
    rows = ''
    for i, name, c in people:
        on = ' on' if name == active_name else ''
        rows += f'<div class="row{on}"><span class="av">{i}</span><div class="fc w1"><b class="t14">{name}</b><span class="t12 mu">{c}</span></div>{doc_badge(c)}</div>'
    um_on = 'on' if cat == 'Umum' else ''
    sp_on = 'on' if cat == 'Spesialis' else ''
    if overrides:
        otr = ''.join(f'<tr><td>{n}</td><td class="r">{kh}</td><td class="r">{kat}</td></tr>' for n, kh, kat in overrides)
        ov = (
            '<div class="fc g8"><div class="f jb ac"><span class="lab">Tarif khusus</span>'
            '<button class="btn sec s">' + ico('plus', 16) + ' Tambah</button></div>'
            '<table class="tbl"><thead><tr><th>Tindakan</th><th class="r">Khusus</th><th class="r">Kategori</th></tr></thead>'
            f'<tbody>{otr}</tbody></table></div>'
        )
    else:
        ov = (
            '<div class="fc g8"><span class="lab">Tarif khusus</span>'
            '<span class="mu">Belum ada.</span>'
            '<button class="btn sec s" style="align-self:flex-start">' + ico('plus', 16) + ' Tambah</button></div>'
        )
    return (
        '<main class="cnt">'
        '<div class="f jb ae g16"><div class="fc g4"><h1 class="t28">Dokter</h1>'
        '<span class="mu">Klinik Gigi Senyum Sehat.</span></div></div>'
        '<div class="f g20" style="flex:1;min-height:0">'
        f'<div class="card p16 fc" style="width:320px;flex:none"><div class="dlist">{rows}</div></div>'
        '<div class="card fc g16" style="flex:1;min-height:0">'
        f'<div class="f ac g12"><span class="av l">{ini}</span>'
        f'<div class="fc"><h2 class="t20">{active_name}</h2><span class="mu">Dokter gigi</span></div></div>'
        '<div class="fld"><span class="lab">Kategori</span>'
        f'<div class="seg cat"><div class="{um_on}">Umum</div><div class="{sp_on}">Spesialis</div></div></div>'
        f'{ov}'
        '<button class="btn pri" style="align-self:flex-start">Simpan</button>'
        '</div></div></main>'
    )

dokter_umum = shell(
    'Dokter', 'Dokter', 'user',
    dokter_inner('drg. Nadia Putri', 'NP', 'Umum', None),
    who='drg. Nadia Putri', role='Pemilik', ini='NP', search='Cari dokter',
)
dokter_sp = shell(
    'Dokter', 'Dokter', 'user',
    dokter_inner('drg. Rina Wijaya', 'RW', 'Spesialis', [
        ('Pengambilan sisa akar', '180.000', '200.000'),
        ('Odontektomi', '1.800.000', '2.000.000'),
    ]),
    who='drg. Nadia Putri', role='Pemilik', ini='NP', search='Cari dokter',
)

sec_master = section(
    'Master tindakan dan dokter',
    'Dua tarif kategori. Override per dokter bersifat opsional.',
    [
        ab('19', 'Master tindakan', '1280×900', master),
        ab('20', 'Profil dokter, Umum', '1280×900', dokter_umum),
        ab('21', 'Profil dokter, spesialis', '1280×900', dokter_sp),
    ],
)

# ---------- document ----------
html = (
    '<!doctype html><html lang="id"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1">'
    '<title>Bittodent / EHR ke tagihan dan ICD</title>'
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">'
    f'<style>{CSS}\n{EXTRA_CSS}</style></head><body>'
    f'{SPRITE}'
    '<header class="bh"><h1>Bittodent / EHR ke tagihan dan ICD</h1>'
    '<span class="mu b6">Board statis. Klinik Gigi Senyum Sehat, Sabtu 14 Nov 2026.</span></header>'
    f'{sec_flow}{sec_rm}{sec_val}{sec_kasir}{sec_dev}{sec_master}'
    '</body></html>'
)

# Remove leftover unused helper typo risk: selected=None still renders chips with on for K08.3 default
# Fine.

OUT.write_text(html)
ART.parent.mkdir(parents=True, exist_ok=True)
ART.write_text(html)
raw = len(html.encode())
print(f'HTML {raw/1024:.1f} KB ({raw} B)')
print('wrote', OUT)
print('wrote', ART)
