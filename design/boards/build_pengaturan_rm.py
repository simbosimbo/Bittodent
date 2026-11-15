#!/usr/bin/env python3
"""Papan desain pengaturan rekam medis.

Hasil: design/boards/pengaturan-rm.html
dan /workspace/artifacts/bittodent-board-pengaturan-rm.html
Data sintetis. Tanpa JavaScript. Tidak mengubah kode app.
"""
from __future__ import annotations

import base64
import io
import re
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'design/boards/pengaturan-rm.html'
ART = Path('/workspace/artifacts/bittodent-board-pengaturan-rm.html')
KASIR = ROOT / 'design/boards/kasir.html'

src = KASIR.read_text()
CSS = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
SPRITE = re.search(r'<svg width="0".*?</svg>', src, re.S).group(0)

EXTRA_ICONS = (
    '<symbol id="tooth" viewBox="0 0 24 24">'
    '<path d="M8 4.5c0-1.4 1.6-2.5 4-2.5s4 1.1 4 2.5c0 .7-.2 1.4-.5 2 1.7.3 3 1.6 3.2 3.6.4 3.2-1 7.2-2.8 9.2-.6.7-1.7.3-1.7-.6 0-1.8-.3-3.2-.7-4.1-.3-.6-.9-.8-1.5-.4-.4.2-.8.2-1.2 0-.6-.4-1.2-.2-1.5.4-.4.9-.7 2.3-.7 4.1 0 .9-1.1 1.3-1.7.6-1.8-2-3.2-6-2.8-9.2.2-2 1.5-3.3 3.2-3.6-.3-.6-.5-1.3-.5-2z"/>'
    '</symbol>'
    '<symbol id="clip" viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="M9 12h6M9 16h6"/></symbol><symbol id="dots" viewBox="0 0 24 24"><circle cx="12" cy="6" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="18" r="1"/></symbol>'
    '<symbol id="pill" viewBox="0 0 24 24"><rect x="8.5" y="2" width="7" height="20" rx="3.5" transform="rotate(45 12 12)"/><path d="M7.2 11.2l5.6 5.6"/></symbol>'
)
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
.t{{height:780px}}
.top .pt{{display:flex;align-items:center;gap:8px;font-size:18px;line-height:24px;font-weight:700;color:var(--tx);flex:none;margin-right:8px}}
.top .srch{{width:auto;flex:1;max-width:280px}}
.ptn{{display:flex;align-items:center;gap:16px;padding:16px 28px 8px;background:#fff}}
.itab{{display:flex;gap:4px;padding:0 28px;background:#fff;border-bottom:1px solid var(--bd);flex:none}}
.itab span{{height:44px;display:inline-flex;align-items:center;padding:0 12px;font-weight:600;color:var(--mu);border-bottom:2px solid transparent;white-space:nowrap}}
.itab .on{{color:var(--tx);border-bottom-color:var(--b)}}
.add{{width:44px;height:44px;border-radius:50%;background:var(--b);color:#fff;display:flex;align-items:center;justify-content:center;flex:none;border:0}}
.more{{width:44px;height:44px;border-radius:10px;border:1px solid var(--n200);background:#fff;display:flex;align-items:center;justify-content:center;color:var(--n700);flex:none}}
.nav{{min-height:44px;height:auto}}
.clinic .syn{{margin-top:6px;align-self:flex-start}}
.g-odo{{background-image:{IMG_URL};background-size:contain;background-repeat:no-repeat;background-position:center;background-color:#fff;min-height:280px;border-radius:12px;border:1px solid var(--bd)}}
.seg.cat{{width:100%}}
.seg.cat div{{height:44px}}
.seg.cat .on{{color:var(--tx);font-weight:700}}
.row44{{display:flex;align-items:center;gap:12px;min-height:44px}}
.sw{{width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;flex:none}}
.sw b{{display:block;width:40px;height:24px;border-radius:999px;background:var(--n200);position:relative}}
.sw b:after{{content:"";position:absolute;width:20px;height:20px;border-radius:50%;background:#fff;top:2px;left:2px;box-shadow:0 0 0 1px var(--n200)}}
.sw.on b{{background:var(--b)}}
.sw.on b:after{{left:18px;box-shadow:none}}
.rdo{{display:flex;flex-direction:column;gap:8px}}
.rdo .opt{{display:flex;align-items:flex-start;gap:12px;min-height:44px;padding:10px 12px;border:1px solid var(--n200);border-radius:12px;background:#fff}}
.rdo .opt.on{{border-color:var(--b);box-shadow:inset 0 0 0 1px var(--b);background:var(--b0)}}
.rdo .dot{{width:20px;height:20px;border-radius:50%;border:2px solid var(--n300);flex:none;margin-top:2px;position:relative}}
.rdo .opt.on .dot{{border-color:var(--b)}}
.rdo .opt.on .dot:after{{content:"";position:absolute;inset:4px;border-radius:50%;background:var(--b)}}
.veil{{position:absolute;inset:0;background:rgba(22,33,43,.4);display:flex;align-items:center;justify-content:center;z-index:5;padding:32px}}
.modal{{max-width:480px;width:100%}}
.dw-w{{position:absolute;inset:0;background:rgba(22,33,43,.24);display:flex;justify-content:flex-end;z-index:5}}
.dw{{width:400px;height:100%;background:#fff;border-left:1px solid var(--bd);display:flex;flex-direction:column;gap:16px;padding:20px 24px;flex:none}}
.dw h2{{font-size:20px;line-height:28px;font-weight:600}}
.cnt.set{{gap:16px;padding:20px 28px}}
.t .cnt.set{{padding:12px 16px;gap:12px}}
.t .card.p16{{padding:12px}}
.chip44{{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 12px;border-radius:999px;border:1px solid var(--wbd);background:var(--wbg);color:var(--wfg);font-weight:600;flex:none}}
.chip44 .n{{min-width:20px;height:20px;border-radius:999px;background:var(--wfg);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px}}
.sign{{height:88px;border:1px dashed var(--n300);border-radius:10px;background:var(--n25)}}
.log td,.log th{{padding:10px 12px}}
.m .cnt{{padding:16px}}
.m .top{{padding:0 16px}}
.m-set{{width:390px;height:1240px;flex-direction:column;background:var(--cv)}}
.spec{{background:#fff;padding:36px 48px;display:flex;flex-direction:column;gap:20px;flex:1;min-height:0}}
.spec .tbl th,.spec .tbl td{{padding:12px 14px;vertical-align:top}}
.spec .tbl th{{font-size:12px;letter-spacing:0;text-transform:none}}
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
    ('Rekam medis', 'clip'),
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


def topbar(title, icon, who='drg. Nadia Putri', role='Pemilik', ini='NP', search='Cari pasien atau No. RM', extra=''):
    return (
        f'<header class="top">{ico(icon, 24)}<div class="pt">{title}</div>'
        f'<div class="srch">{ico("search", 16)}{search}</div>'
        f'{extra}'
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


def itabs(active='Catatan Klinis'):
    names = ['Odontogram', 'Catatan Klinis', 'Rencana Perawatan', 'Resep', 'Billing']
    spans = ''.join(f'<span class="{"on" if n==active else ""}">{n}</span>' for n in names)
    return f'<div class="itab">{spans}</div>'


def shell(active, title, icon, inner, size='d', compact=False, who='drg. Nadia Putri', role='Pemilik', ini='NP', search='Cari pasien atau No. RM', extra='', overlay='', overlay_on='app'):
    app = (
        f'<div class="app">{topbar(title, icon, who, role, ini, search, extra)}{inner}'
        f'{overlay if overlay_on=="app" else ""}</div>'
    )
    scr_ov = overlay if overlay_on == 'scr' else ''
    return f'<div class="scr {size}">{sidebar(active, compact)}{app}{scr_ov}</div>'


def rm_shell(inner, active_tab='Catatan Klinis', size='d', who='drg. Nadia Putri', role='Dokter gigi', ini='NP', extra='', overlay='', overlay_on='app'):
    body = patient_head() + itabs(active_tab) + inner
    return shell('Rekam Medis', 'Rekam Medis', 'tooth', body, size, who=who, role=role, ini=ini, extra=extra, overlay=overlay, overlay_on=overlay_on)


def ab(num, title, size, inner):
    return f'<div class="ab"><div class="cap">{num} {title}<span>{size}</span></div>{inner}</div>'


def section(title, sub, *rows):
    inner = ''.join(
        f'<div class="br-row">{"".join(row)}</div>' if isinstance(row, (list, tuple)) else row
        for row in rows
    )
    return f'<section class="bs"><h2>{title}<span>{sub}</span></h2>{inner}</section>'


def sw(on=True):
    return f'<span class="sw{" on" if on else ""}" aria-label="{"Ya" if on else "Tidak"}"><b></b></span>'


def radio(options, selected):
    # options: list of (label, consequence)
    out = '<div class="rdo">'
    for label, cons in options:
        on = label == selected
        cons_h = f'<span class="mu t12">{cons}</span>' if on and cons else ''
        out += (
            f'<div class="opt{" on" if on else ""}"><span class="dot"></span>'
            f'<div class="fc w1"><b>{label}</b>{cons_h}</div></div>'
        )
    return out + '</div>'


def modal(title, body, actions, wide=False):
    w = ' style="max-width:560px"' if wide else ''
    return (
        f'<div class="veil"><div class="modal card p24 fc g16"{w}>'
        f'<h2 class="t20">{title}</h2>{body}'
        f'<div class="f g8" style="justify-content:flex-end">{actions}</div>'
        f'</div></div>'
    )


def drawer(title, body, actions=''):
    close = f'<span class="more" aria-label="Tutup">{ico("x")}</span>'
    foot = f'<div class="f g8" style="margin-top:auto">{actions}</div>' if actions else ''
    return (
        f'<div class="dw-w"><div class="dw">'
        f'<div class="f jb ac"><h2>{title}</h2>{close}</div>'
        f'{body}{foot}</div></div>'
    )


def unsigned_chip(n=2, on=False):
    cls = ' chip44' + ('' if not on else '')
    return f'<span class="chip44{" " if on else ""}">{ico("alert", 16)}Belum ditandatangani<span class="n">{n}</span></span>'


# ---------- 01 decision table ----------
dec_rows = [
    ('Pengaturan rekam medis', 'Halaman', 'Isi panjang. Bukan laci atau pop up.'),
    ('Simpan pengaturan', 'Pop up', 'Konfirmasi singkat. Mengubah aturan klinik.'),
    ('Tanda tangan catatan', 'Pop up', 'Keputusan legal singkat. Tidak bisa dibatalkan.'),
    ('Adendum', 'Laci', 'Form lebih panjang. Catatan asli perlu terlihat.'),
    ('Tinjau riwayat medis', 'Laci', 'Versi lama dan konteks kunjungan.'),
    ('Tutup kunjungan, diblokir', 'Pop up', 'Pemblokiran singkat. Harus ditanggapi.'),
    ('Tutup kunjungan, peringatan', 'Pop up', 'Pilih lanjut atau kembali.'),
    ('Daftar belum ditandatangani', 'Laci', 'Daftar dari lencana. Halaman tetap terlihat.'),
    ('Entri klinik lain', 'Laci', 'Form wajib. Odontogram perlu terlihat.'),
    ('Persetujuan diskon', 'Pop up', 'Persetujuan singkat. Tidak bisa dibatalkan.'),
    ('Riwayat gigi', 'Laci', 'Histori. Odontogram perlu terlihat.'),
]
dec_tr = ''.join(
    f'<tr><td>{a}</td><td><b>{b}</b></td><td>{c}</td></tr>' for a, b, c in dec_rows
)
dec_board = (
    '<div class="scr d"><div class="app"><div class="spec">'
    '<div class="fc g8"><h1 class="t28">Drawer vs pop up</h1>'
    '<span class="mu">Laci jika perlu konteks halaman di belakang, form panjang, atau histori. '
    'Pop up untuk keputusan singkat, konfirmasi, aksi yang tidak bisa dibatalkan, dan tanda tangan.</span></div>'
    '<div class="card" style="padding:0;overflow:hidden"><table class="tbl">'
    '<thead><tr><th>Interaksi</th><th>Pola</th><th>Alasan</th></tr></thead>'
    f'<tbody>{dec_tr}</tbody></table></div>'
    '<div class="fc g8">'
    '<span class="lab">Sumber</span>'
    '<span class="mu t12">Material 3 Dialogs, https://m3.material.io/components/dialogs/guidelines</span>'
    '<span class="mu t12">Material 3 Side sheets, https://m3.material.io/components/side-sheets/guidelines</span>'
    '<span class="mu t12">Apple HIG Alerts, https://developer.apple.com/design/human-interface-guidelines/alerts</span>'
    '<span class="mu t12">Apple HIG Sheets, https://developer.apple.com/design/human-interface-guidelines/sheets</span>'
    '<span class="mu t12">Apple HIG Modality, https://developer.apple.com/design/human-interface-guidelines/modality</span>'
    '<span class="mu t12">NN/g Modal and Nonmodal Dialogs, https://www.nngroup.com/articles/modal-nonmodal-dialog/</span>'
    '</div></div></div></div>'
)

# ---------- 02 settings desktop ----------
role_rows = (
    f'<tr><td>Dokter</td><td class="c">{sw(True)}</td></tr>'
    f'<tr><td>Asisten</td><td class="c">{sw(True)}</td></tr>'
    f'<tr><td>Perawat</td><td class="c">{sw(True)}</td></tr>'
    '<tr><td>Agen</td><td><span class="bdg">Selalu draf saja</span></td></tr>'
)
card_draft = (
    '<div class="card p16 fc g16">'
    '<h2 class="t20">Draf dan tanda tangan</h2>'
    '<div style="overflow:hidden;border:1px solid var(--bd);border-radius:12px">'
    '<table class="tbl"><thead><tr><th>Peran</th><th class="c">Tulis draf</th></tr></thead>'
    f'<tbody>{role_rows}</tbody></table></div>'
    '<div class="fld"><span class="lab">Siapa menandatangani</span>'
    '<div class="rdo">'
    '<div class="opt on"><span class="dot"></span><div class="fc w1"><b>Dokter merawat saja</b></div></div>'
    '<div class="opt"><span class="dot"></span><div class="fc w1"><b>Dokter mana pun</b></div></div>'
    '</div></div>'
    '<span class="mu t12">Tanda tangan selalu oleh dokter gigi. Bukan sakelar.</span>'
    '</div>'
)
card_close = (
    '<div class="card p16 fc g16">'
    '<h2 class="t20">Tutup kunjungan dan kasir</h2>'
    + radio(
        [
            ('Blokir', 'Kunjungan dan kasir tidak bisa ditutup.'),
            ('Peringatkan', 'Bisa ditutup setelah konfirmasi. Pengaturan awal.'),
            ('Biarkan', 'Bisa ditutup tanpa konfirmasi.'),
        ],
        'Peringatkan',
    )
    + '</div>'
)
card_hx = (
    '<div class="card p16 fc g16">'
    '<h2 class="t20">Riwayat medis</h2>'
    + radio(
        [
            ('Form baru tiap kunjungan', 'Form lama tetap ada dan hanya dibaca. Pengaturan awal.'),
            ('Perbarui form terakhir', 'Terisi dari jawaban terakhir. Disimpan sebagai versi baru, tidak menimpa.'),
        ],
        'Form baru tiap kunjungan',
    )
    + '<div class="fld"><span class="lab">Seberapa sering ditanyakan</span>'
    '<div class="seg cat"><div class="on">Setiap kunjungan</div><div>Setiap N bulan</div></div></div>'
    '<span class="mu t12">Dokter menandai form itu Ditinjau.</span>'
    '</div>'
)
settings_main = (
    '<main class="cnt set">'
    '<div class="f jb ac">'
    '<div class="fc g4"><div class="crumb">Pengaturan ' + ico('chev', 16) + ' Rekam medis</div>'
    '<h1 class="t28">Rekam medis</h1></div>'
    '<span class="bdg">Hanya pemilik dan admin</span>'
    '</div>'
    f'<div class="gd c3 w1">{card_draft}{card_close}{card_hx}</div>'
    '<div class="f ac g8" style="margin-top:auto"><span class="mu">2 perubahan belum disimpan</span>'
    '<button class="btn sec ma">Batal</button><button class="btn pri">Simpan</button></div>'
    '</main>'
)
settings_board = shell('Rekam medis', 'Pengaturan', 'cog', settings_main, 'd', who='drg. Nadia Putri', role='Pemilik', ini='NP')

# ---------- 03 save confirm modal ----------
save_body = (
    '<div class="fc g12">'
    '<div class="fc g4"><span class="lab">Tutup kunjungan dan kasir</span><b>Biarkan menjadi Peringatkan</b></div>'
    '<div class="fc g4"><span class="lab">Perawat, tulis draf</span><b>Tidak menjadi Ya</b></div>'
    '</div>'
)
save_actions = '<button class="btn sec">Batal</button><button class="btn pri">Simpan</button>'
save_board = shell(
    'Rekam medis', 'Pengaturan', 'cog', settings_main, 'd',
    who='drg. Nadia Putri', role='Pemilik', ini='NP',
    overlay=modal('Simpan pengaturan rekam medis?', save_body, save_actions),
    overlay_on='scr',
)

# ---------- 04 audit ----------
audit_inner = (
    '<main class="cnt fc g16">'
    '<div class="f jb ac"><div class="fc g4"><div class="crumb">Pengaturan ' + ico('chev', 16) + ' Rekam medis</div>'
    '<h2 class="t20">Audit pengaturan rekam medis</h2></div>'
    '<span class="bdg">Tidak bisa dihapus</span></div>'
    '<div class="card" style="padding:0;overflow:hidden"><table class="tbl log"><thead><tr>'
    '<th>Waktu</th><th>Pengguna</th><th>Perubahan</th><th>Sebelum</th><th>Sesudah</th>'
    '</tr></thead><tbody>'
    '<tr><td>15 Nov 2026, 12.18</td><td>drg. Nadia Putri, pemilik</td>'
    '<td>Tutup kunjungan dan kasir</td><td>Biarkan</td><td>Peringatkan</td></tr>'
    '<tr><td>15 Nov 2026, 12.18</td><td>drg. Nadia Putri, pemilik</td>'
    '<td>Perawat, tulis draf</td><td>Tidak</td><td>Ya</td></tr>'
    '<tr><td>10 Nov 2026, 16.02</td><td>drg. Nadia Putri, pemilik</td>'
    '<td>Siapa menandatangani</td><td>Dokter mana pun</td><td>Dokter merawat saja</td></tr>'
    '</tbody></table></div>'
    '</main>'
)
audit_board = shell('Rekam medis', 'Pengaturan', 'cog', audit_inner, 'd', who='drg. Nadia Putri', role='Pemilik', ini='NP')

# ---------- 05 tablet settings ----------
settings_t = settings_main.replace('class="cnt set"', 'class="cnt set" style="padding:16px 20px"')
# c2 may be tight on 1024-72 sidebar; keep c2 or stack. 1024-72=952, ok-ish.
tablet_board = shell('Rekam medis', 'Pengaturan', 'cog', settings_t, 't', compact=True, who='drg. Nadia Putri', role='Pemilik', ini='NP')

# ---------- 06 mobile settings ----------
mobile_main = (
    '<main class="cnt fc g16">'
    '<div class="f jb ac"><h1 class="t20">Rekam medis</h1><span class="bdg">Pemilik</span></div>'
    '<div class="card p16 fc g12"><b>Draf dan tanda tangan</b>'
    f'<div class="row44"><span class="w1">Dokter</span>{sw(True)}</div>'
    f'<div class="row44"><span class="w1">Asisten</span>{sw(True)}</div>'
    f'<div class="row44"><span class="w1">Perawat</span>{sw(True)}</div>'
    '<div class="row44"><span class="w1">Agen</span><span class="bdg">Selalu draf saja</span></div>'
    '<span class="lab">Siapa menandatangani</span>'
    '<div class="rdo">'
    '<div class="opt on"><span class="dot"></span><div class="fc w1"><b>Dokter merawat saja</b></div></div>'
    '<div class="opt"><span class="dot"></span><div class="fc w1"><b>Dokter mana pun</b></div></div>'
    '</div>'
    '<span class="mu t12">Tanda tangan selalu oleh dokter gigi.</span></div>'
    '<div class="card p16 fc g12"><b>Tutup kunjungan dan kasir</b>'
    + radio([('Blokir', ''), ('Peringatkan', 'Bisa ditutup setelah konfirmasi.'), ('Biarkan', '')], 'Peringatkan')
    + '</div>'
    '<div class="card p16 fc g12"><b>Riwayat medis</b>'
    + radio([('Form baru tiap kunjungan', 'Form lama tetap, hanya dibaca.'), ('Perbarui form terakhir', '')], 'Form baru tiap kunjungan')
    + '<span class="lab">Seberapa sering</span>'
    '<div class="seg cat"><div class="on">Setiap kunjungan</div><div>Setiap N bulan</div></div>'
    '<span class="mu t12">Dokter menandai Ditinjau.</span></div>'
    '<button class="btn pri wf">Simpan</button>'
    '</main>'
)
# Mobile 844 may overflow with all cards. Use a taller phone if needed later.
mobile_top = (
    f'<header class="top"><span class="more" aria-label="Kembali">{ico("chevl")}</span>'
    '<div class="pt">Pengaturan</div>'
    '<span class="av ma">NP</span>'
    '</header>'
)
mobile_board = (
    f'<div class="scr m-set"><div class="app">{mobile_top}{mobile_main}</div></div>'
)

# ---------- 07 sign popup ----------
note_card = (
    '<div class="card p16 fc g12 w1">'
    '<div class="f jb ac"><div class="fc"><b>Kontrol tambalan, 15</b>'
    '<span class="mu t12">Draf oleh Rina Asisten, 14 Nov 2026, 11.20.</span></div>'
    '<span class="bdg wt">Draf</span></div>'
    '<p>Pasien kontrol tambalan 15. Tambalan utuh, tidak ada nyeri tekan. Kebersihan baik. Kontrol 6 bulan.</p>'
    '<button class="btn pri" style="align-self:flex-start">Tandatangani</button>'
    '</div>'
)
sign_body = (
    '<span class="mu">Kontrol tambalan, 15. Draf oleh Rina Asisten.</span>'
    '<div class="sign" aria-label="Area tanda tangan"></div>'
    '<span class="mu t12">Tanda tangan merujuk ke catatan ini, dengan nama dan waktu.</span>'
)
sign_overlay = modal('Tandatangani catatan?', sign_body, '<button class="btn sec">Batal</button><button class="btn pri">Tandatangani</button>')
sign_board = rm_shell(
    '<main class="cnt">' + note_card + '</main>',
    extra=unsigned_chip(2),
    overlay=sign_overlay,
    overlay_on='scr',
    role='Dokter gigi',
)

# ---------- 08 addendum drawer ----------
signed_note = (
    '<div class="card p16 fc g12 w1">'
    '<div class="f jb ac"><div class="fc"><b>Kontrol tambalan, 15</b>'
    '<span class="mu t12">Ditandatangani drg. Nadia Putri, 14 Nov 2026, 11.42.</span></div>'
    '<span class="bdg ok">Ditandatangani</span></div>'
    '<p>Pasien kontrol tambalan 15. Tambalan utuh, tidak ada nyeri tekan. Kebersihan baik. Kontrol 6 bulan.</p>'
    '<button class="btn sec" style="align-self:flex-start">Tambah adendum</button>'
    '</div>'
)
add_body = (
    '<span class="mu t12">Menambah catatan baru. Catatan asli tidak diubah.</span>'
    '<div class="fld"><span class="lab">Adendum</span>'
    '<div class="inp" style="height:96px;align-items:flex-start;padding-top:12px">Nyeri tekan ringan di palatal, dicatat setelah pasien kembali ke ruang tunggu.</div></div>'
    '<div class="fld"><span class="lab">Alasan</span>'
    '<div class="inp">Keluhan muncul setelah catatan ditandatangani.</div></div>'
)
add_overlay = drawer(
    'Adendum',
    add_body,
    '<button class="btn sec w1">Batal</button><button class="btn pri w1">Simpan adendum</button>',
)
add_board = rm_shell('<main class="cnt">' + signed_note + '</main>', overlay=add_overlay, overlay_on='app', role='Dokter gigi')

# ---------- 09 unsigned list drawer ----------
unsigned_list = (
    '<div class="fc g8">'
    '<div class="card p16 row44"><div class="fc w1"><b>Budi Santoso</b>'
    '<span class="mu t12">Kontrol tambalan, 15. Draf Rina Asisten.</span></div><span class="bdg wt">Draf</span></div>'
    '<div class="card p16 row44"><div class="fc w1"><b>Siti Rahma</b>'
    '<span class="mu t12">Pemeriksaan awal. Draf agen.</span></div><span class="bdg wt">Draf</span></div>'
    '</div>'
)
un_overlay = drawer('Belum ditandatangani', unsigned_list, '<span class="mu t12">2 catatan menunggu tanda tangan Anda.</span>')
un_board = rm_shell(
    '<main class="cnt">' + note_card + '</main>',
    extra=unsigned_chip(2),
    overlay=un_overlay,
    overlay_on='app',
    role='Dokter gigi',
)

# ---------- 10 close blocked ----------
close_bar = (
    '<main class="cnt fc g16">'
    + note_card
    + '<div class="f ac g8" style="margin-top:auto"><span class="mu">Kunjungan 14 Nov 2026</span>'
    '<button class="btn pri ma">Tutup kunjungan</button></div></main>'
)
block_body = (
    '<span>1 catatan belum ditandatangani. Kunjungan tidak bisa ditutup.</span>'
    '<div class="ban wt">' + ico('alert') + '<span>Kontrol tambalan, 15. Draf oleh Rina Asisten.</span></div>'
)
block_overlay = modal(
    'Tidak bisa menutup kunjungan',
    block_body,
    '<button class="btn sec">Kembali</button><button class="btn pri">Lihat daftar</button>',
)
block_board = rm_shell(close_bar, extra=unsigned_chip(1), overlay=block_overlay, overlay_on='scr', role='Dokter gigi')

# ---------- 11 close warning ----------
warn_body = (
    '<span>1 catatan belum ditandatangani. Kunjungan masih bisa ditutup.</span>'
    '<div class="ban wt">' + ico('alert') + '<span>Kontrol tambalan, 15. Draf oleh Rina Asisten.</span></div>'
)
warn_overlay = modal(
    'Tutup kunjungan?',
    warn_body,
    '<button class="btn sec">Kembali</button><button class="btn pri">Tutup kunjungan</button>',
)
warn_board = rm_shell(close_bar, extra=unsigned_chip(1), overlay=warn_overlay, overlay_on='scr', role='Dokter gigi')

# ---------- 12 medical history review drawer ----------
hx_page = (
    '<main class="cnt">'
    '<div class="card p16 fc g12" style="max-width:640px">'
    '<div class="f jb ac"><div class="fc"><b>Riwayat medis</b>'
    '<span class="mu t12">Form 14 Nov 2026. Belum ditinjau.</span></div>'
    '<span class="bdg wt">Belum ditinjau</span></div>'
    '<div class="kv"><span class="mu">Alergi</span><b>Penisilin</b></div>'
    '<div class="kv"><span class="mu">Penyakit</span><b>Hipertensi</b></div>'
    '<div class="kv"><span class="mu">Obat rutin</span><b>Amlodipin 5 mg</b></div>'
    '<button class="btn pri" style="align-self:flex-start">Tinjau form</button>'
    '</div></main>'
)
hx_drawer_body = (
    '<div class="fc g8">'
    '<div class="card p16 fc g8"><div class="f jb ac"><b>14 Nov 2026</b><span class="bdg wt">Baru</span></div>'
    '<span class="mu t12">Alergi penisilin. Hipertensi. Amlodipin 5 mg.</span></div>'
    '<div class="card p16 fc g8"><div class="f jb ac"><b>10 Jan 2026</b><span class="bdg ok">Ditinjau</span></div>'
    '<span class="mu t12">Hanya dibaca. Alergi penisilin. Hipertensi.</span></div>'
    '<div class="card p16 fc g8"><div class="f jb ac"><b>12 Jun 2025</b><span class="bdg ok">Ditinjau</span></div>'
    '<span class="mu t12">Hanya dibaca. Alergi penisilin.</span></div>'
    '</div>'
)
hx_overlay = drawer(
    'Tinjau riwayat medis',
    hx_drawer_body,
    '<button class="btn sec w1">Tutup</button><button class="btn pri w1">Tandai Ditinjau</button>',
)
hx_board = rm_shell(hx_page, active_tab='Odontogram', overlay=hx_overlay, overlay_on='app', role='Dokter gigi')

# ---------- 13 klinik lain drawer ----------
odo = '<div class="card p16 fc g12 w1"><b>Odontogram</b><div class="g-odo" role="img" aria-label="Odontogram dewasa"></div></div>'
kl_body = (
    '<span class="mu t12">Kode sama. Tidak masuk tagihan.</span>'
    '<div class="fld"><span class="lab">Tindakan</span><div class="inp">Gigi tiruan, 31</div></div>'
    '<div class="fld"><span class="lab">Nama klinik</span><div class="inp is-f">Klinik Gigi Melati</div></div>'
    '<div class="fld"><span class="lab">Tanggal</span><div class="inp">12/06/2025</div></div>'
)
kl_overlay = drawer(
    'Klinik lain',
    kl_body,
    '<button class="btn sec w1">Batal</button><button class="btn pri w1">Simpan</button>',
)
kl_board = rm_shell(
    '<main class="cnt">' + odo + '</main>',
    active_tab='Odontogram',
    overlay=kl_overlay,
    overlay_on='app',
    role='Dokter gigi',
)

# ---------- 14 discount popup ----------
disc_page = (
    '<main class="cnt">'
    '<div class="card p16 fc g16" style="max-width:560px">'
    '<div class="f jb ac"><div class="fc"><b>Kontrol tambalan, 15</b><span class="mu t12">Tarif Rp 150.000</span></div>'
    '<div class="fc ae"><span class="mu t12">Sesudah diskon</span><b>Rp 0</b></div></div>'
    '<div class="f ac g8"><div class="inp w1">100</div>'
    '<div class="seg cat" style="width:140px;flex:none"><div class="on">%</div><div>Rp</div></div></div>'
    '<div class="fld"><span class="lab">Alasan</span><div class="inp">Garansi tambalan, kontrol 14 Nov 2026.</div></div>'
    '<button class="btn pri" style="align-self:flex-start">Setujui sendiri</button>'
    '</div></main>'
)
disc_body = (
    '<div class="kv"><span class="mu">Nilai</span><b>Rp 0, 100%</b></div>'
    '<div class="kv"><span class="mu">Alasan</span><b>Garansi tambalan, kontrol 14 Nov 2026.</b></div>'
    '<span class="mu t12">Pemilik yang merawat menyetujui diskonnya sendiri. Tercatat di audit sebagai disetujui sendiri.</span>'
)
disc_overlay = modal(
    'Setujui diskon ini?',
    disc_body,
    '<button class="btn sec">Batal</button><button class="btn pri">Setujui sendiri</button>',
)
disc_board = shell(
    'Kasir', 'Kasir', 'wallet', disc_page, 'd',
    who='drg. Nadia Putri', role='Pemilik', ini='NP',
    overlay=disc_overlay, overlay_on='scr',
)

# ---------- 15 tooth history drawer ----------
th_body = (
    '<div class="fc g8">'
    '<div class="card p16 fc g4"><b>12 Jun 2025</b><span class="mu t12">Gigi tiruan, 31. Klinik lain, Klinik Gigi Melati.</span></div>'
    '<div class="card p16 fc g4"><b>14 Nov 2026</b><span class="mu t12">Kondisi dipertahankan. Tidak ada tindakan hari ini.</span></div>'
    '</div>'
)
th_overlay = drawer('Riwayat gigi 31', th_body, '<button class="btn sec wf">Tutup</button>')
th_board = rm_shell(
    '<main class="cnt">' + odo + '</main>',
    active_tab='Odontogram',
    overlay=th_overlay,
    overlay_on='app',
    role='Dokter gigi',
)

# ---------- assemble ----------
sec_pola = section(
    'Drawer vs pop up',
    'Laci untuk konteks, form, atau histori. Pop up untuk keputusan singkat dan tanda tangan.',
    [ab('01', 'Drawer vs pop up', '1440×900', dec_board)],
)
sec_set = section(
    'Pengaturan rekam medis',
    'Hanya pemilik dan admin. Tiga keputusan jadi pengaturan klinik, bukan aturan tetap di kode.',
    [ab('02', 'Pengaturan rekam medis, desktop', '1440×900', settings_board)],
    [ab('03', 'Konfirmasi simpan, pop up', '1440×900', save_board)],
    [ab('04', 'Audit perubahan pengaturan', '1440×900', audit_board)],
    [ab('05', 'Pengaturan, tablet', '1024×780', tablet_board),
     ab('06', 'Pengaturan, ponsel', '390×1240', mobile_board)],
)
sec_klinis = section(
    'Efek di alur klinis',
    'Tanda tangan dan tutup kunjungan memakai pop up. Adendum, daftar draf, dan tinjau riwayat memakai laci.',
    [ab('07', 'Tanda tangan catatan, pop up', '1440×900', sign_board)],
    [ab('08', 'Adendum, laci', '1440×900', add_board)],
    [ab('09', 'Belum ditandatangani, laci', '1440×900', un_board)],
    [ab('10', 'Tutup kunjungan, diblokir, pop up', '1440×900', block_board),
     ab('11', 'Tutup kunjungan, peringatan, pop up', '1440×900', warn_board)],
    [ab('12', 'Tinjau riwayat medis, laci', '1440×900', hx_board)],
)
sec_rtk = section(
    'Pola yang sama di Riwayat dan Kontrol',
    'Entri klinik lain dan riwayat gigi memakai laci. Persetujuan diskon memakai pop up.',
    [ab('13', 'Entri klinik lain, laci', '1440×900', kl_board)],
    [ab('14', 'Persetujuan diskon, pop up', '1440×900', disc_board),
     ab('15', 'Riwayat gigi, laci', '1440×900', th_board)],
)

html = (
    '<!doctype html><html lang="id"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1">'
    '<title>Bittodent / Pengaturan rekam medis</title>'
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">'
    f'<style>{CSS}\n{EXTRA_CSS}</style></head><body>'
    f'{SPRITE}'
    '<header class="bh"><h1>Bittodent / Pengaturan rekam medis</h1>'
    '<span class="mu b6">Board statis. Klinik Gigi Senyum Sehat, 15 Nov 2026.</span></header>'
    f'{sec_pola}{sec_set}{sec_klinis}{sec_rtk}'
    '</body></html>'
)

OUT.write_text(html)
ART.parent.mkdir(parents=True, exist_ok=True)
ART.write_text(html)
raw = len(html.encode())
print(f'HTML {raw/1024:.1f} KB ({raw} B)')
print('wrote', OUT)
print('wrote', ART)
