#!/usr/bin/env python3
"""Papan desain editor alur kunjungan (node, gaya Magnific).

Hasil: design/boards/editor-alur.html
dan /workspace/artifacts/bittodent-board-editor-alur.html
Data sintetis. Tanpa JavaScript. Tidak mengubah kode app.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'design/boards/editor-alur.html'
ART = Path('/workspace/artifacts/bittodent-board-editor-alur.html')
KASIR = ROOT / 'design/boards/kasir.html'

src = KASIR.read_text()
CSS = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
SPRITE = re.search(r'<svg width="0".*?</svg>', src, re.S).group(0)

EXTRA_ICONS = (
    '<symbol id="tooth" viewBox="0 0 24 24">'
    '<path d="M8 4.5c0-1.4 1.6-2.5 4-2.5s4 1.1 4 2.5c0 .7-.2 1.4-.5 2 1.7.3 3 1.6 3.2 3.6.4 3.2-1 7.2-2.8 9.2-.6.7-1.7.3-1.7-.6 0-1.8-.3-3.2-.7-4.1-.3-.6-.9-.8-1.5-.4-.4.2-.8.2-1.2 0-.6-.4-1.2-.2-1.5.4-.4.9-.7 2.3-.7 4.1 0 .9-1.1 1.3-1.7.6-1.8-2-3.2-6-2.8-9.2.2-2 1.5-3.3 3.2-3.6-.3-.6-.5-1.3-.5-2z"/>'
    '</symbol>'
    '<symbol id="lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none"/></symbol>'
    '<symbol id="arrow" viewBox="0 0 24 24"><path d="M5 12h12M13 6l6 6-6 6" fill="none"/></symbol>'
    '<symbol id="flow" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="6" rx="2"/><rect x="4" y="15" width="16" height="6" rx="2"/><path d="M12 9v6"/></symbol>'
    '<symbol id="clip" viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="M9 12h6M9 16h6"/></symbol>'
    '<symbol id="pill" viewBox="0 0 24 24"><rect x="8.5" y="2" width="7" height="20" rx="3.5" transform="rotate(45 12 12)"/><path d="M7.2 11.2l5.6 5.6"/></symbol>'
    '<symbol id="alert" viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01"/><path d="M10.3 4.9L2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.9a2 2 0 0 0-3.4 0z"/></symbol>'
    '<symbol id="hist" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>'
    '<symbol id="grip" viewBox="0 0 24 24"><path d="M9 7h.01M15 7h.01M9 12h.01M15 12h.01M9 17h.01M15 17h.01"/></symbol>'
)
SPRITE = SPRITE.replace('</svg>', EXTRA_ICONS + '</svg>')


def ico(name, size=20, cls=''):
    cls_s = f' i{size}' if size != 20 else ''
    if cls:
        cls_s += f' {cls}'
    return f'<svg class="i{cls_s}" aria-hidden="true"><use href="#{name}"/></svg>'


EXTRA_CSS = """
.d-ed{width:1440px;height:1080px}
.m-ed{width:390px;height:900px;flex-direction:column}
.i{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.i16{width:16px;height:16px}
.i24{width:24px;height:24px}
.bs{margin:40px 0 8px}
.bs h2{font-size:20px;line-height:28px;margin:0 0 4px;display:flex;flex-direction:column;gap:4px}
.bs h2 span{font-size:14px;line-height:20px;font-weight:500;color:var(--mu)}
.br-row{display:flex;gap:28px;margin-top:20px;align-items:flex-start}
.ab{display:flex;flex-direction:column;gap:8px;flex:none}
.cap{font-size:12px;line-height:16px;font-weight:600;color:#3B4752}
.cap span{font-weight:500;color:#4D5A64;margin-left:8px}
.ed{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;background:var(--cv)}
.ed-bar{display:flex;align-items:center;gap:10px;padding:10px 16px;background:#fff;border-bottom:1px solid var(--bd);min-height:56px;flex:none}
.ed-bar h1{font-size:16px;line-height:24px;font-weight:700;margin:0}
.ed-body{display:grid;grid-template-columns:220px 1fr 320px;flex:1;min-height:0}
.pal,.insp,.cvs{min-height:0}
.pal{background:#fff;border-right:1px solid var(--bd);padding:12px;display:flex;flex-direction:column;gap:8px}
.insp{background:#fff;border-left:1px solid var(--bd);padding:16px;display:flex;flex-direction:column;gap:12px}
.cvs{background:var(--cv);padding:20px 24px;display:flex;flex-direction:column;gap:12px;align-items:center}
.phead{font-size:11px;line-height:16px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--mu);padding:4px 4px 0}
.pit{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 10px;border:1px solid var(--bd);border-radius:10px;background:var(--n25);font-weight:600;font-size:13px;color:var(--tx)}
.pit.off{color:var(--mu);background:var(--n50)}
.pit .plus{margin-left:auto;color:var(--mu);font-size:18px;line-height:1}
.nd{position:relative;width:360px;min-height:64px;background:#fff;border:1px solid var(--bd);border-radius:16px;padding:10px 14px 10px 12px;display:flex;align-items:center;gap:10px}
.nd.on{border-color:var(--b);box-shadow:var(--fo)}
.nd.err{border-color:var(--dsd)}
.nd .num{width:28px;height:28px;border-radius:50%;background:var(--b0);color:var(--b);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex:none}
.nd.err .num{background:var(--dbg);color:var(--dfg)}
.nd .meta{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.nd .meta b{font-size:14px;line-height:20px}
.wire{width:2px;height:16px;background:var(--n300);flex:none}
.wire.err{background:var(--dsd)}
.port{width:12px;height:12px;border-radius:50%;border:2px solid var(--n300);background:#fff;flex:none}
.chain{display:flex;flex-direction:column;align-items:center}
.hint{font-size:12px;line-height:16px;color:var(--mu);text-align:center}
.ex{width:360px;display:flex;flex-direction:column;gap:8px;margin-top:8px}
.ex .card{padding:10px 12px}
.lk{display:inline-flex;align-items:center;gap:4px}
.fldl{display:flex;align-items:center;gap:8px;min-height:44px;border-bottom:1px solid var(--bd)}
.fldl:last-child{border-bottom:0}
.role{display:flex;align-items:center;gap:8px;min-height:44px}
.ck{width:20px;height:20px;border-radius:4px;border:2px solid var(--n300);background:#fff;flex:none;display:flex;align-items:center;justify-content:center}
.ck.on{background:var(--b);border-color:var(--b);color:#fff;font-size:12px;font-weight:800}
.ck.lock:not(.on){background:var(--n100);border-color:var(--n300)}
.ck.on.lock{background:var(--b9);border-color:var(--b9);color:#fff}
.ban{display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border-radius:12px;border:1px solid var(--dbd);background:var(--dbg);color:var(--dfg);font-size:13px;line-height:18px;width:360px}
.ban.ok{border-color:var(--sbd);background:var(--sbg);color:var(--sfg)}
.ban.info{border-color:var(--ibd);background:var(--ibg);color:var(--ifg)}
.lockbar{display:flex;align-items:center;gap:8px;padding:10px 16px;background:var(--ibg);border-bottom:1px solid var(--ibd);color:var(--ifg);font-size:13px;line-height:18px;flex:none;min-height:44px}
.veil{position:absolute;inset:0;background:rgba(22,33,43,.4);display:flex;align-items:center;justify-content:center;z-index:5;padding:32px}
.modal{max-width:560px;width:100%}
.dw-w{position:absolute;inset:0;background:rgba(22,33,43,.24);display:flex;justify-content:flex-end;z-index:5}
.dw{width:400px;height:100%;background:#fff;border-left:1px solid var(--bd);display:flex;flex-direction:column;gap:16px;padding:20px 24px;flex:none}
.dw h2{font-size:20px;line-height:28px;font-weight:600;margin:0}
.tbl{width:100%;border-collapse:collapse}
.tbl th,.tbl td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--bd);font-size:13px;line-height:18px;vertical-align:top}
.tbl th{font-size:12px;color:var(--mu);font-weight:600}
.diff-add{color:var(--sfg)}
.diff-del{color:var(--dfg)}
.stepper{display:flex;flex-direction:column;gap:0;padding:16px}
.st{display:grid;grid-template-columns:28px 1fr;gap:12px}
.st .dot{width:28px;height:28px;border-radius:50%;background:var(--n100);color:var(--mu);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex:none;position:relative}
.st .dot:after{content:"";position:absolute;top:28px;left:13px;width:2px;height:calc(100% - 4px);background:var(--n200)}
.st:last-child .dot:after{display:none}
.st.on .dot{background:var(--b);color:#fff}
.st.done .dot{background:var(--sbg);color:var(--sfg);border:1px solid var(--sbd)}
.st .body{padding:0 0 16px;min-height:44px}
.more{width:44px;height:44px;display:flex;align-items:center;justify-content:center;flex:none}
.f{display:flex}.fc{display:flex;flex-direction:column}.g4{gap:4px}.g8{gap:8px}.g12{gap:12px}.g16{gap:16px}
.jb{justify-content:space-between}.ac{align-items:center}.w1{flex:1;min-width:0}
.t12{font-size:12px;line-height:16px}.t14{font-size:14px;line-height:20px}.t20{font-size:20px;line-height:28px;font-weight:700}
.mu{color:var(--mu)}.wf{width:100%}
"""

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
    ('Alur kunjungan', 'flow'),
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


def topbar(title='Alur kunjungan', who='drg. Nadia Putri', role='Pemilik', ini='NP', extra=''):
    return (
        f'<header class="top">{ico("flow", 24)}<div class="pt">{title}</div>'
        f'{extra}'
        f'<span class="ib">{ico("bell")}</span>'
        f'<span class="av">{ini}</span>'
        f'<div class="fc"><b class="t14">{who}</b><span class="t12 mu">{role}</span></div>'
        f'</header>'
    )


def shell(inner, size='d-ed', overlay='', who='drg. Nadia Putri', role='Pemilik', ini='NP'):
    ov = overlay or ''
    return (
        f'<div class="scr {size}">{sidebar("Alur kunjungan")}'
        f'<div class="app">{topbar(who=who, role=role, ini=ini)}{inner}{ov}</div></div>'
    )


def ab(num, title, size, inner):
    return f'<div class="ab"><div class="cap">{num} {title}<span>{size}</span></div>{inner}</div>'


def section(title, sub, *rows):
    inner = ''.join(
        f'<div class="br-row">{"".join(row)}</div>' if isinstance(row, (list, tuple)) else row
        for row in rows
    )
    return f'<section class="bs"><h2>{title}<span>{sub}</span></h2>{inner}</section>'


def modal(title, body, actions, wide=False):
    w = ' style="max-width:640px"' if wide else ''
    return (
        f'<div class="veil"><div class="modal card p24 fc g16"{w}>'
        f'<h2 class="t20" style="margin:0">{title}</h2>{body}'
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


# ---------- domain ----------
ENUM = [
    ('Datang', 'cal', True),
    ('Chart', 'tooth', True),
    ('Riwayat medis', 'clip', True),
    ('Pemeriksaan', 'tooth', True),
    ('Tindakan', 'file', True),
    ('Catatan', 'file', True),
    ('Selesai', 'lock', True),
]

DEFAULT_FLOW = [
    ('1', 'Datang', 'Resepsionis', True, False),
    ('2', 'Chart', 'Dokter, asisten', False, False),
    ('3', 'Riwayat medis', 'Dokter meninjau', True, False),
    ('4', 'Pemeriksaan', 'Dokter, asisten', False, False),
    ('5', 'Tindakan', 'Dokter', False, False),
    ('6', 'Catatan', 'Dokter, draf asisten', True, False),
    ('7', 'Selesai', 'Dokter merawat, lalu kasir', True, False),
]

NO_TX_FLOW = [
    ('1', 'Datang', 'Resepsionis', True, False),
    ('2', 'Chart', 'Dokter, asisten', False, False),
    ('3', 'Riwayat medis', 'Dokter meninjau', True, False),
    ('4', 'Pemeriksaan', 'Dokter, asisten', False, False),
    ('5', 'Catatan', 'Dokter, draf asisten', True, False),
    ('6', 'Selesai', 'Dokter merawat', True, True),
]


def node_card(num, title, roles, locked=False, selected=False, error=False):
    cls = 'nd'
    if selected:
        cls += ' on'
    if error:
        cls += ' err'
    lock = f'<span class="lk mu t12" title="Tidak bisa dihapus">{ico("lock", 16)}</span>' if locked else ''
    return (
        f'<div class="{cls}">'
        f'<span class="num">{num}</span>'
        f'<div class="meta"><b>{title}</b><span class="mu t12">{roles}</span></div>'
        f'{lock}</div>'
    )


def chain(nodes, errors=None):
    errors = errors or set()
    parts = ['<div class="chain">']
    for i, n in enumerate(nodes):
        num, title, roles, locked, selected = n[:5]
        err = title in errors or num in errors
        if i:
            wcls = 'wire err' if err or nodes[i - 1][1] in errors else 'wire'
            parts.append(f'<div class="{wcls}" aria-hidden="true"></div>')
        parts.append(node_card(num, title, roles, locked, selected, err))
    parts.append('</div>')
    return ''.join(parts)


def palette(used=None):
    used = used or {n[0] for n in ENUM}
    out = '<div class="pal"><div class="phead">Jenis node, tetap</div>'
    out += '<span class="mu t12">Hanya dari daftar ini. Tidak bisa membuat jenis baru.</span>'
    for name, ic, _ in ENUM:
        already = name in used
        cls = 'pit off' if already else 'pit'
        mark = '<span class="mu t12" style="margin-left:auto">Ada</span>' if already else '<span class="plus">+</span>'
        out += f'<div class="{cls}">{ico(ic, 16)}{name}{mark}</div>'
    out += '<div class="phead" style="margin-top:8px">Fase 1</div>'
    out += '<span class="mu t12">Hanya garis lurus. Percabangan belum tersedia.</span>'
    out += '</div>'
    return out


def inspector_selesai(billing=True):
    def role(label, on, locked, note=''):
        box = 'ck on lock' if locked and on else ('ck on' if on else 'ck')
        mark = '✓' if on else ''
        lk = ico('lock', 16) if locked else ''
        note_h = f'<span class="mu t12">{note}</span>' if note else ''
        return (
            f'<div class="role"><span class="{box}">{mark}</span>'
            f'<span class="w1">{label}</span>{lk}{note_h}</div>'
        )

    def fld(label, on, locked):
        box = 'ck on lock' if locked and on else ('ck lock' if locked else ('ck on' if on else 'ck'))
        mark = '✓' if on else ''
        lk = ico('lock', 16) if locked else ''
        return (
            f'<div class="fldl"><span class="{box}">{mark}</span>'
            f'<span class="w1">{label}</span>{lk}</div>'
        )

    if billing:
        kasir = (
            '<div class="phead">Kasir</div>'
            + fld('Buka kasir setelah Selesai', True, True)
            + '<span class="mu t12">Aktif karena ada node Tindakan. Tindakan boleh dihapus; maka kasir tidak dibuka.</span>'
        )
    else:
        kasir = (
            '<div class="phead">Kasir</div>'
            + fld('Buka kasir setelah Selesai', False, True)
            + '<span class="mu t12">Tidak aktif: tidak ada node Tindakan. Tagihan hanya jika Tindakan ada di alur.</span>'
        )
    return (
        '<div class="insp">'
        '<div class="f jb ac"><b>Selesai</b><span class="bdg">Tanda tangan</span></div>'
        '<span class="mu t12">Menutup kunjungan adalah tanda tangan elektronik. Kasir terbuka dari aksi ini, bukan node terpisah.</span>'
        '<div class="phead">Peran</div>'
        '<span class="mu t12">Hanya boleh dipersempit dari RBAC. Tidak bisa menambah peran baru.</span>'
        + role('Dokter merawat', True, True, '')
        + role('Dokter lain', False, True, '')
        + role('Asisten', False, True, '')
        + role('Resepsionis', False, True, '')
        + '<span class="mu t12">Dokter merawat tidak bisa dilepas. Peran lain tidak boleh ditambah.</span>'
        '<div class="phead">Isi wajib, terkunci</div>'
        + fld('Nama dokter merawat', True, True)
        + fld('Waktu (WIB)', True, True)
        + fld('Hash isi catatan', True, True)
        + fld('Pernyataan Selesai', True, True)
        + fld('Kunci catatan, hanya adendum', True, True)
        + kasir
        + '<span class="mu t12">Isi minimum Permenkes 24/2022 tidak bisa dimatikan: no. RM, nama, NIK, catatan lengkap, nama, waktu, dan tanda tangan.</span>'
        '</div>'
    )


def inspector_empty():
    return (
        '<div class="insp">'
        '<b>Inspector</b>'
        '<span class="mu t12">Pilih node di kanvas untuk mengatur peran dan isi wajib.</span>'
        '<div class="phead">Isi wajib RM, terkunci</div>'
        '<div class="fldl"><span class="w1">No. RM, nama, NIK</span>' + ico('lock', 16) + '</div>'
        '<div class="fldl"><span class="w1">Catatan lengkap</span>' + ico('lock', 16) + '</div>'
        '<div class="fldl"><span class="w1">Nama, waktu, tanda tangan nakes</span>' + ico('lock', 16) + '</div>'
        '<div class="fldl"><span class="w1">Kode ICD bila ada tindakan</span>' + ico('lock', 16) + '</div>'
        '<span class="mu t12">Permenkes 24/2022 Pasal 14, 16, dan 18. Selalu aktif di setiap alur.</span>'
        '<div class="phead">Kasir</div>'
        '<span class="mu t12">Bukan node. Selesai membuka kasir hanya jika Tindakan ada di alur.</span>'
        '</div>'
    )


def exceptions():
    items = [
        ('Batal', 'Kunjungan dibatalkan. Jalur tetap, tidak diubah di editor.'),
        ('Datang langsung', 'Walk-in: cari atau daftar pasien, lalu masuk alur dari Datang.'),
        ('Koreksi', 'Setelah Selesai, perubahan hanya lewat adendum.'),
    ]
    out = '<div class="ex"><div class="phead" style="align-self:flex-start">Jalur pengecualian, terkunci</div>'
    for title, s in items:
        out += (
            f'<div class="card" style="padding:10px 12px">'
            f'<div class="f jb ac"><b>{title}</b><span class="lk mu t12">{ico("lock", 16)} Tetap</span></div>'
            f'<span class="mu t12">{s}</span></div>'
        )
    out += '</div>'
    return out


def toolbar(state='draft', publish_on=True, locked=False):
    if locked:
        badge = '<span class="bdg dg">Terkunci</span><span class="mu t12">Hanya pemilik dan admin</span>'
        pub = 'btn pri is-d'
        sec = 'btn sec is-d'
    elif state == 'draft':
        badge = '<span class="bdg wt">Draf v3</span><span class="mu t12">2 perubahan belum diterbitkan</span>'
        pub = 'btn pri' if publish_on else 'btn pri is-d'
        sec = 'btn sec'
    elif state == 'invalid':
        badge = '<span class="bdg dg">Draf v3, 2 kesalahan</span>'
        pub = 'btn pri is-d'
        sec = 'btn sec'
    else:
        badge = '<span class="bdg ok">Terbit v2</span>'
        pub = 'btn pri' if publish_on else 'btn pri is-d'
        sec = 'btn sec'
    return (
        '<div class="ed-bar">'
        '<h1>Alur kunjungan</h1>'
        '<span class="bdg">flow.manage, pemilik dan admin</span>'
        f'{badge}'
        '<span class="w1"></span>'
        f'<button class="{sec}">Kembali ke templat default</button>'
        f'<button class="{sec}">{ico("hist", 16)} Riwayat</button>'
        f'<button class="{pub}">Terbitkan</button>'
        '</div>'
    )


def editor(canvas, insp, used=None, state='draft', publish_on=True, extra_canvas='', locked=False):
    bar = ''
    if locked:
        bar = (
            '<div class="lockbar">' + ico('lock', 16)
            + '<span>Hanya pemilik dan admin yang dapat mengubah alur. Izin flow.manage.</span></div>'
        )
    body = (
        '<div class="ed">'
        f'{toolbar(state, publish_on, locked)}{bar}'
        '<div class="ed-body">'
        f'{palette(used)}'
        f'<div class="cvs">{canvas}{extra_canvas}</div>'
        f'{insp}'
        '</div></div>'
    )
    return body


hint = '<p class="hint">Templat default: 7 langkah dari alur Open Dental. Selesai membuka kasir jika ada Tindakan. Fase 1, garis lurus.</p>'
cvs1 = hint + chain(DEFAULT_FLOW) + exceptions()
ed1 = editor(cvs1, inspector_empty())
board1 = shell(ed1)

flow_sel = [n if n[1] != 'Selesai' else (n[0], n[1], n[2], n[3], True) for n in DEFAULT_FLOW]
cvs2 = hint + chain(flow_sel) + exceptions()
ed2 = editor(cvs2, inspector_selesai(True))
board2 = shell(ed2)

BAD_FLOW = [
    ('1', 'Chart', 'Dokter, asisten', False, False),
    ('2', 'Datang', 'Resepsionis', True, False),
    ('3', 'Riwayat medis', 'Dokter meninjau', True, False),
    ('4', 'Pemeriksaan', 'Dokter, asisten', False, False),
    ('5', 'Tindakan', 'Dokter', False, False),
    ('6', 'Selesai', 'Dokter merawat, lalu kasir', True, False),
    ('7', 'Catatan', 'Dokter, draf asisten', True, False),
]
errs = {'Datang', 'Selesai', 'Catatan', '2', '6'}
bans = (
    '<div class="ban">' + ico('alert', 16)
    + '<span>Datang harus di awal alur.</span></div>'
    '<div class="ban">' + ico('alert', 16)
    + '<span>Catatan harus sebelum Selesai.</span></div>'
    '<div class="ban info">' + ico('clip', 16)
    + '<span>Tagihan hanya dibuka dari Selesai jika ada Tindakan.</span></div>'
)
cvs3 = '<p class="hint">Validasi di server. Terbitkan diblokir sampai graf benar.</p>' + chain(BAD_FLOW, errs) + bans
ed3 = editor(cvs3, inspector_empty(), state='invalid', publish_on=False)
board3 = shell(ed3)

diff_body = (
    '<span class="mu t12">Setelah diterbitkan, versi ini tidak bisa diubah. Perubahan berikutnya lewat draf baru.</span>'
    '<table class="tbl"><thead><tr><th>Perubahan</th><th>v2 terbit</th><th>Draf v3</th></tr></thead><tbody>'
    '<tr><td>Kasir</td><td>Node terpisah di akhir</td><td class="diff-add">Digabung ke Selesai</td></tr>'
    '<tr><td>Peran Tindakan</td><td>Dokter, asisten</td><td class="diff-del">Dokter saja, asisten dilepas</td></tr>'
    '<tr><td>Tanpa Tindakan</td><td>Tidak diatur</td><td class="diff-add">Boleh dihapus, kasir tidak dibuka</td></tr>'
    '</tbody></table>'
    '<span class="mu t12">v2 terbit 10 Nov 2026, 09.02 WIB, oleh drg. Nadia Putri. Tidak ditimpa.</span>'
)
ov4 = modal(
    'Terbitkan alur v3?',
    diff_body,
    '<button class="btn sec">Batal</button><button class="btn pri">Terbitkan</button>',
    wide=True,
)
ed4 = editor(hint + chain(DEFAULT_FLOW) + exceptions(), inspector_empty())
board4 = shell(ed4, overlay=ov4)

hist_body = (
    '<span class="mu t12">Yang sudah terbit tidak bisa diubah. Pulihkan sebagai draf baru jika perlu.</span>'
    '<div class="list" style="border:1px solid var(--bd);border-radius:12px;overflow:hidden;background:#fff">'
    '<div class="fldl" style="padding:0 12px"><div class="fc w1"><b>v3, draf</b>'
    '<span class="mu t12">15 Nov 2026, 13.10 WIB. drg. Nadia Putri.</span></div>'
    '<span class="bdg wt">Sedang diedit</span></div>'
    '<div class="fldl" style="padding:0 12px"><div class="fc w1"><b>v2, terbit</b>'
    '<span class="mu t12">10 Nov 2026, 09.02 WIB. drg. Nadia Putri.</span></div>'
    f'<span class="lk mu t12">{ico("lock", 16)} Tetap</span></div>'
    '<div class="fldl" style="padding:0 12px"><div class="fc w1"><b>v1, terbit</b>'
    '<span class="mu t12">2 Nov 2026, 16.40 WIB. Templat default.</span></div>'
    f'<span class="lk mu t12">{ico("lock", 16)} Tetap</span></div>'
    '</div>'
    '<div class="card" style="padding:12px 14px">'
    '<b>Selisih v2 dan draf v3</b>'
    '<div class="t12" style="margin-top:8px"><span class="diff-add">Kasir digabung ke Selesai.</span><br>'
    '<span class="diff-del">Asisten dilepas dari Tindakan.</span><br>'
    '<span class="diff-add">Tindakan boleh dihapus; kasir tidak dibuka.</span></div>'
    '</div>'
)
ov5 = drawer(
    'Riwayat versi',
    hist_body,
    '<button class="btn sec wf">Pulihkan v2 sebagai draf baru</button>',
)
ed5 = editor(hint + chain(DEFAULT_FLOW) + exceptions(), inspector_empty())
board5 = shell(ed5, overlay=ov5)

ex_focus = (
    '<p class="hint">Jalur ini milik sistem. Tidak masuk palet dan tidak bisa diubah per klinik.</p>'
    + '<div style="opacity:.45;pointer-events:none">' + chain(DEFAULT_FLOW) + '</div>'
    + exceptions()
)
ed6 = editor(ex_focus, inspector_empty())
board6 = shell(ed6)

steps_m = [
    ('done', 'Datang', 'Datang 09.52'),
    ('done', 'Chart', 'Dibuka'),
    ('done', 'Riwayat medis', 'Ditinjau'),
    ('done', 'Pemeriksaan', 'Kondisi dicatat'),
    ('on', 'Tindakan', 'Sedang dikerjakan'),
    ('', 'Catatan', 'Berikutnya'),
    ('', 'Selesai', 'Tanda tangan, lalu kasir'),
]
st_html = '<div class="stepper">'
for cls, title, meta in steps_m:
    st_html += (
        f'<div class="st {cls}"><span class="dot"></span>'
        f'<div class="body"><b>{title}</b><div class="mu t12">{meta}</div></div></div>'
    )
st_html += '</div>'
mobile_main = (
    '<main class="cnt" style="padding:16px;display:flex;flex-direction:column;gap:12px">'
    '<div class="card" style="padding:12px 14px;background:var(--ibg);border-color:var(--ibd)">'
    '<b>Ubah alur di desktop</b>'
    '<div class="mu t12">Ponsel menampilkan langkah kunjungan yang sedang berjalan.</div></div>'
    '<div class="f jb ac"><h1 class="t20" style="margin:0">Kunjungan hari ini</h1>'
    '<span class="bdg ok">Alur v2</span></div>'
    '<span class="mu t12">Budi Santoso. 15 Nov 2026.</span>'
    f'<div class="card" style="padding:0">{st_html}</div>'
    '</main>'
)
mobile_top = (
    '<header class="top" style="padding:8px 12px">'
    f'{ico("flow", 20)}<div class="pt">Alur</div>'
    '<span class="syn">DATA SINTETIS</span>'
    '<span class="av">NP</span>'
    '</header>'
)
board7 = (
    f'<div class="scr m-ed"><div class="app">{mobile_top}{mobile_main}</div></div>'
)

used_no_tx = {n[1] for n in NO_TX_FLOW}
hint8 = '<p class="hint">Tindakan dihapus. Alur valid. Selesai tidak membuka kasir.</p>'
cvs8 = hint8 + chain(NO_TX_FLOW) + exceptions()
ed8 = editor(cvs8, inspector_selesai(False), used=used_no_tx)
board8 = shell(ed8)


sec_ed = section(
    'Editor alur, desktop',
    'Satu alur per klinik. Tujuh node. Selesai membuka kasir hanya jika ada Tindakan.',
    [ab('01', 'Kanvas dan palet, templat default 7 node', '1440×1080', board1)],
    [ab('02', 'Inspector Selesai, kasir aktif karena ada Tindakan', '1440×1080', board2)],
    [ab('03', 'Kesalahan validasi, plus aturan tagihan', '1440×1080', board3)],
)
sec_ver = section(
    'Terbit, riwayat, dan jalur tetap',
    'Konfirmasi terbit memakai pop up plus selisih versi. Riwayat memakai laci. Jalur pengecualian terkunci.',
    [ab('04', 'Konfirmasi terbit, pop up dengan selisih', '1440×1080', board4)],
    [ab('05', 'Riwayat versi, laci', '1440×1080', board5)],
    [ab('06', 'Jalur pengecualian, terkunci', '1440×1080', board6)],
)
sec_var = section(
    'Tanpa tindakan dan ponsel',
    'Tindakan boleh dihapus. Editor hanya untuk pemilik dan admin; peran lain tidak melihatnya. Ponsel menampilkan langkah kunjungan.',
    [ab('07', 'Tanpa Tindakan, kasir tidak dibuka', '1440×1080', board8)],
    [ab('08', 'Stepper kunjungan di ponsel', '390×900', board7)],
)

html = (
    '<!doctype html><html lang="id"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1">'
    '<title>Bittodent / Editor alur kunjungan</title>'
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">'
    f'<style>{CSS}\n{EXTRA_CSS}</style></head><body>'
    f'{SPRITE}'
    '<header class="bh"><h1>Bittodent / Editor alur kunjungan</h1>'
    '<span class="mu b6">Board statis. Klinik Gigi Senyum Sehat, 15 Nov 2026. Data sintetis.</span></header>'
    f'{sec_ed}{sec_ver}{sec_var}'
    '</body></html>'
)

assert '\u2014' not in html, 'em dash found'
assert '\u2013' not in html, 'en dash found'

OUT.write_text(html)
ART.parent.mkdir(parents=True, exist_ok=True)
ART.write_text(html)
raw = len(html.encode())
print(f'HTML {raw/1024:.1f} KB ({raw} B)')
print('wrote', OUT)
print('wrote', ART)
