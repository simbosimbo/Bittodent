#!/usr/bin/env python3
"""Papan desain area pengaturan, terpisah dari alur operasional.

Hasil: design/boards/area-pengaturan.html
dan /workspace/artifacts/bittodent-board-area-pengaturan.html
Data sintetis. Tanpa JavaScript. Tidak mengubah kode app.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'design/boards/area-pengaturan.html'
ART = Path('/workspace/artifacts/bittodent-board-area-pengaturan.html')
KASIR = ROOT / 'design/boards/kasir.html'

src = KASIR.read_text()
CSS = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
SPRITE = re.search(r'<svg width="0".*?</svg>', src, re.S).group(0)

EXTRA_ICONS = (
    '<symbol id="tooth" viewBox="0 0 24 24">'
    '<path d="M8 4.5c0-1.4 1.6-2.5 4-2.5s4 1.1 4 2.5c0 .7-.2 1.4-.5 2 1.7.3 3 1.6 3.2 3.6.4 3.2-1 7.2-2.8 9.2-.6.7-1.7.3-1.7-.6 0-1.8-.3-3.2-.7-4.1-.3-.6-.9-.8-1.5-.4-.4.2-.8.2-1.2 0-.6-.4-1.2-.2-1.5.4-.4.9-.7 2.3-.7 4.1 0 .9-1.1 1.3-1.7.6-1.8-2-3.2-6-2.8-9.2.2-2 1.5-3.3 3.2-3.6-.3-.6-.5-1.3-.5-2z"/>'
    '</symbol>'
    '<symbol id="clip" viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="M9 12h6M9 16h6"/></symbol>'
    '<symbol id="pill" viewBox="0 0 24 24"><rect x="8.5" y="2" width="7" height="20" rx="3.5" transform="rotate(45 12 12)"/><path d="M7.2 11.2l5.6 5.6"/></symbol>'
    '<symbol id="flow" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="6" rx="2"/><rect x="4" y="15" width="16" height="6" rx="2"/><path d="M12 9v6"/></symbol>'
    '<symbol id="lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none"/></symbol>'
    '<symbol id="arrow" viewBox="0 0 24 24"><path d="M19 12H7M11 6l-6 6 6 6" fill="none"/></symbol>'
    '<symbol id="dots" viewBox="0 0 24 24"><circle cx="12" cy="6" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="18" r="1"/></symbol>'
    '<symbol id="building" viewBox="0 0 24 24"><path d="M4 20V6l8-3 8 3v14"/><path d="M9 20v-6h6v6M4 20h16M9 9h.01M12 9h.01M15 9h.01M9 13h.01M12 13h.01M15 13h.01"/></symbol>'
)
SPRITE = SPRITE.replace('</svg>', EXTRA_ICONS + '</svg>')


def ico(name, size=20, cls=''):
    cls_s = f' i{size}' if size != 20 else ''
    if cls:
        cls_s += f' {cls}'
    return f'<svg class="i{cls_s}" aria-hidden="true"><use href="#{name}"/></svg>'


EXTRA_CSS = """
.d-set{width:1440px;height:1080px}
.m-set{width:390px;height:960px;flex-direction:column}
.i{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.i16{width:16px;height:16px}
.i24{width:24px;height:24px}
.nav{height:44px}
.ib,.srch{height:44px}
.ib{width:44px}
.av-hit{width:44px;height:44px;display:flex;align-items:center;justify-content:center;flex:none;border-radius:10px}
.av-hit.on{box-shadow:var(--fo)}
.app{position:relative}
.tbl th,.tbl td{height:44px}
.side.set .clinic{margin:0}
.bs{margin:40px 0 8px}
.bs h2{font-size:20px;line-height:28px;margin:0 0 4px;display:flex;flex-direction:column;gap:4px}
.bs h2 span{font-size:14px;line-height:20px;font-weight:500;color:var(--mu)}
.br-row{display:flex;gap:28px;margin-top:20px;align-items:flex-start}
.ab{display:flex;flex-direction:column;gap:8px;flex:none}
.cap{font-size:12px;line-height:16px;font-weight:600;color:#3B4752}
.cap span{font-weight:500;color:#4D5A64;margin-left:8px}
.gear{width:44px;height:44px;border-radius:10px;border:1px solid var(--n200);background:#fff;display:flex;align-items:center;justify-content:center;color:var(--n700);flex:none}
.gear.on{border-color:var(--b);color:var(--b);box-shadow:var(--fo)}
.menu{position:absolute;top:60px;right:24px;width:280px;background:#fff;border:1px solid var(--bd);border-radius:16px;box-shadow:0 8px 24px rgba(22,33,43,.12);padding:8px;z-index:6}
.mi{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 12px;border-radius:10px;font-weight:600;font-size:14px;color:var(--tx)}
.mi .mu{font-weight:500}
.mi.on{background:var(--b0);color:var(--b)}
.side.set{background:#F4F7F7;border-right:1px solid var(--bd)}
.set-brand{padding:0 4px 12px;border-bottom:1px solid var(--bd);margin-bottom:8px;display:flex;flex-direction:column;gap:8px}
.set-brand .tag{display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:6px;background:#fff;border:1px solid var(--b1);color:var(--bh);font-size:11px;font-weight:700;letter-spacing:.04em;align-self:flex-start}
.back{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 10px;border:1px solid var(--n200);border-radius:10px;background:#fff;font-weight:600;font-size:13px;color:var(--tx)}
.set-top{background:var(--b0);border-bottom:1px solid var(--b1)}
.set-top .pt{color:var(--b9)}
.nd{width:100%;min-height:52px;background:#fff;border:1px solid var(--bd);border-radius:12px;padding:8px 12px;display:flex;align-items:center;gap:10px}
.nd .num{width:24px;height:24px;border-radius:50%;background:var(--b0);color:var(--b);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex:none}
.nd.on{border-color:var(--b);box-shadow:var(--fo)}
.wire{width:2px;height:12px;background:var(--n300)}
.chain{display:flex;flex-direction:column;align-items:center;max-width:420px}
.sw{width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;flex:none}
.sw b{display:block;width:40px;height:24px;border-radius:999px;background:var(--n200);position:relative}
.sw b:after{content:"";position:absolute;width:20px;height:20px;border-radius:50%;background:#fff;top:2px;left:2px;box-shadow:0 0 0 1px var(--n200)}
.sw.on b{background:var(--b)}
.sw.on b:after{left:18px;box-shadow:none}
.rdo{display:flex;flex-direction:column;gap:8px}
.rdo .opt{display:flex;align-items:flex-start;gap:12px;min-height:44px;padding:10px 12px;border:1px solid var(--n200);border-radius:12px;background:#fff}
.rdo .opt.on{border-color:var(--b);box-shadow:inset 0 0 0 1px var(--b);background:var(--b0)}
.rdo .dot{width:20px;height:20px;border-radius:50%;border:2px solid var(--n300);flex:none;margin-top:2px;position:relative}
.rdo .opt.on .dot{border-color:var(--b)}
.rdo .opt.on .dot:after{content:"";position:absolute;inset:4px;border-radius:50%;background:var(--b)}
.row44{display:flex;align-items:center;gap:12px;min-height:44px;padding:0 4px}
.list{display:flex;flex-direction:column;background:#fff;border:1px solid var(--bd);border-radius:16px;overflow:hidden}
.list .rw{display:flex;align-items:center;gap:10px;min-height:48px;padding:8px 14px;border-bottom:1px solid var(--bd);font-weight:600}
.list .rw:last-child{border-bottom:0}
.phead{font-size:11px;line-height:16px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--mu);padding:16px 14px 6px}
.hint{font-size:12px;line-height:16px;color:var(--mu);text-align:center}
.cmp{display:flex;flex-direction:column;gap:8px;flex:none}
.f{display:flex}.fc{display:flex;flex-direction:column}.g4{gap:4px}.g8{gap:8px}.g12{gap:12px}.g16{gap:16px}
.jb{justify-content:space-between}.ac{align-items:center}.w1{flex:1;min-width:0}
.t12{font-size:12px;line-height:16px}.t14{font-size:14px;line-height:20px}
.t20{font-size:20px;line-height:28px;font-weight:700}.t28{font-size:28px;line-height:36px;font-weight:700}
.mu{color:var(--mu)}.wf{width:100%}
.cnt.set{gap:16px;padding:20px 28px}.cnt.set .gd{align-items:start;flex:1}
.crumb{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--mu)}
.back-hint{font-size:12px;line-height:16px;color:var(--mu);padding:0 10px}
.toast-wrap{position:absolute;left:50%;bottom:32px;transform:translateX(-50%);z-index:8}
.toast{min-height:44px;box-shadow:0 8px 24px rgba(22,33,43,.18);white-space:nowrap}
.loc{display:flex;align-items:center;gap:12px;min-height:64px;padding:12px 16px;border:1px solid var(--bd);border-radius:12px;background:#fff}
"""

NAV_NOW = [
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

NAV_OPS = [
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
]

NAV_SET = [
    ('KLINIK', None),
    ('Profil klinik', 'building'),
    ('Cabang', 'home'),
    ('REKAM MEDIS', None),
    ('Pengaturan RM', 'clip'),
    ('Editor alur', 'flow'),
    ('KEUANGAN', None),
    ('Tarif', 'wallet'),
    ('Metode bayar', 'file'),
    ('Diskon', 'file'),
    ('TIM', None),
    ('Pengguna', 'users'),
    ('Peran', 'user'),
    ('SISTEM', None),
    ('Audit log', 'clip'),
]


def ico_nav(name, ic, on, compact=False):
    cls = ' nav on' if on else ' nav'
    label = '' if compact else name
    return f'<div class="{cls}" title="{name}">{ico(ic)}{label}</div>'


def ops_sidebar(nav, active, compact=False, syn=True):
    clinic = ''
    if not compact:
        badge = '<span class="syn">DATA SINTETIS</span>' if syn else ''
        clinic = (
            '<div class="clinic"><b>Klinik Gigi Senyum Sehat</b>'
            '<span class="t12 mu">Tebet, Jakarta Selatan</span>'
            f'{badge}</div>'
        )
    out = (
        f'<aside class="side{" cp" if compact else ""}">'
        f'<div class="logo"><span class="lg">B</span>{"" if compact else "Bittodent"}</div>'
        f'{clinic}'
    )
    for name, ic in nav:
        if ic is None:
            if not compact:
                out += f'<div class="nlab">{name}</div>'
            continue
        out += ico_nav(name, ic, name == active, compact)
    return out + '</aside>'


def set_sidebar(active, back_to='Antrean'):
    out = (
        '<aside class="side set">'
        '<div class="set-brand">'
        '<div class="logo"><span class="lg">B</span>Bittodent</div>'
        '<span class="tag">PENGATURAN</span>'
        f'<div class="back" title="Kembali ke layar operasional terakhir">{ico("arrow", 16)}Kembali ke klinik</div>'
        f'<span class="back-hint">Ke {back_to}</span>'
        '<div class="clinic"><b>Klinik Gigi Senyum Sehat</b>'
        '<span class="t12 mu">Berlaku untuk seluruh klinik</span>'
        '<span class="syn">DATA SINTETIS</span></div>'
        '</div>'
    )
    for name, ic in NAV_SET:
        if ic is None:
            out += f'<div class="nlab">{name}</div>'
            continue
        out += ico_nav(name, ic, name == active)
    return out + '</aside>'


def ops_topbar(title='Antrean', icon='menu', who='drg. Nadia Putri', role='Pemilik', ini='NP',
               gear=False, gear_on=False, search=True, menu_on=False):
    srch = f'<div class="srch">{ico("search", 16)}Cari pasien atau No. RM</div>' if search else ''
    g = ''
    if gear:
        g = f'<span class="gear{" on" if gear_on else ""}" aria-label="Pengaturan">{ico("cog")}</span>'
    hit = ' on' if menu_on else ''
    return (
        f'<header class="top">{ico(icon, 24)}<div class="pt">{title}</div>'
        f'{srch}<span class="w1"></span>'
        f'{g}'
        f'<span class="ib">{ico("bell")}</span>'
        f'<span class="av-hit{hit}"><span class="av">{ini}</span></span>'
        f'<div class="fc"><b class="t14">{who}</b><span class="t12 mu">{role}</span></div>'
        f'</header>'
    )


def set_topbar(page, who='drg. Nadia Putri', role='Pemilik', ini='NP', syn=False, badge=True):
    syn_h = '<span class="syn">DATA SINTETIS</span>' if syn else ''
    bdg_h = '<span class="bdg">Hanya pemilik dan admin</span>' if badge else ''
    return (
        '<header class="top set-top">'
        f'{ico("cog", 24)}<div class="pt">Pengaturan</div>'
        f'<span class="mu">/</span><span class="t14" style="font-weight:700">{page}</span>'
        '<span class="w1"></span>'
        f'{syn_h}{bdg_h}'
        f'<span class="av-hit"><span class="av">{ini}</span></span>'
        f'<div class="fc"><b class="t14">{who}</b><span class="t12 mu">{role}</span></div>'
        '</header>'
    )


def antrean_main():
    rows = [
        ('Budi Santoso', 'Kontrol 15. Kursi 1.', 'Datang, 09.52'),
        ('Siti Rahma', 'Pemeriksaan awal.', 'Di kursi'),
        ('Andi Wijaya', 'Scaling.', 'Terjadwal, 11.00'),
    ]
    lis = ''
    for n, m, s in rows:
        ok = ' bdg ok' if 'Datang' in s or 'kursi' in s.lower() else ' bdg'
        lis += (
            f'<div class="card" style="padding:14px 16px">'
            f'<div class="f jb ac"><div class="fc g4"><b>{n}</b>'
            f'<span class="mu t12">{m}</span></div>'
            f'<span class="{ok}">{s}</span></div></div>'
        )
    return (
        '<main class="cnt" style="padding:20px 28px;display:flex;flex-direction:column;gap:12px">'
        '<div class="f jb ac"><h1 class="t28" style="margin:0">Antrean</h1>'
        '<span class="mu">Senin, 15 Nov 2026</span></div>'
        f'{lis}'
        '</main>'
    )


def ops_shell(nav, active='Antrean', who='drg. Nadia Putri', role='Pemilik', ini='NP',
              gear=False, gear_on=False, overlay='', size='d', title='Antrean', menu_on=False):
    return (
        f'<div class="scr {size}" style="position:relative">'
        f'{ops_sidebar(nav, active)}'
        f'<div class="app">{ops_topbar(title, "menu", who, role, ini, gear, gear_on, True, menu_on)}'
        f'{antrean_main()}{overlay}</div></div>'
    )


def set_shell(active, page, inner, size='d-set'):
    return (
        f'<div class="scr {size}">{set_sidebar(active)}'
        f'<div class="app">{set_topbar(page)}{inner}</div></div>'
    )


def ab(num, title, size, inner):
    return f'<div class="ab"><div class="cap">{num} {title}<span>{size}</span></div>{inner}</div>'


def section(title, sub, *rows):
    inner = ''.join(
        f'<div class="br-row">{"".join(row)}</div>' if isinstance(row, (list, tuple)) else row
        for row in rows
    )
    return f'<section class="bs"><h2>{title}<span>{sub}</span></h2>{inner}</section>'


def menu(items, owner=True):
    out = '<div class="menu" role="menu">'
    for label, ic, on, show in items:
        if not show:
            continue
        cls = 'mi on' if on else 'mi'
        out += f'<div class="{cls}">{ico(ic, 16)}{label}</div>'
    out += '</div>'
    return out


def sw(on=True):
    return f'<span class="sw{" on" if on else ""}" aria-label="{"Ya" if on else "Tidak"}"><b></b></span>'


def radio(options, selected):
    out = '<div class="rdo">'
    for label, cons in options:
        on = label == selected
        cons_h = f'<span class="mu t12">{cons}</span>' if on and cons else ''
        out += (
            f'<div class="opt{" on" if on else ""}"><span class="dot"></span>'
            f'<div class="fc w1"><b>{label}</b>{cons_h}</div></div>'
        )
    return out + '</div>'


# ---------- 01 current sidebar ----------
board1 = ops_shell(NAV_NOW, active='Antrean', gear=False)

# ---------- 02 proposed sidebar ----------
board2 = ops_shell(NAV_OPS, active='Antrean', gear=True)

# ---------- 03 gear-only entry ----------
menu_owner = menu([
    ('Profil saya', 'user', False, True),
    ('Keluar', 'x', False, True),
])
board3 = ops_shell(NAV_OPS, active='Antrean', gear=True, gear_on=True, overlay=menu_owner, menu_on=True)

# ---------- 04 settings + editor alur ----------
NODES = [
    ('1', 'Datang', 'Resepsionis', True),
    ('2', 'Chart', 'Dokter, asisten', False),
    ('3', 'Riwayat medis', 'Dokter meninjau', True),
    ('4', 'Pemeriksaan', 'Dokter, asisten', False),
    ('5', 'Tindakan', 'Dokter', False),
    ('6', 'Catatan', 'Dokter, draf asisten', True),
    ('7', 'Selesai', 'Dokter merawat, lalu kasir', True),
]
chain = '<div class="chain">'
for i, (num, title, roles, locked) in enumerate(NODES):
    if i:
        chain += '<div class="wire" aria-hidden="true"></div>'
    lk = f'<span class="mu t12" style="margin-left:auto">{ico("lock", 16)}</span>' if locked else ''
    on = ' on' if title == 'Selesai' else ''
    chain += (
        f'<div class="nd{on}"><span class="num">{num}</span>'
        f'<div class="fc w1"><b>{title}</b><span class="mu t12">{roles}</span></div>{lk}</div>'
    )
chain += '</div>'
editor_main = (
    '<main class="cnt set">'
    '<div class="f jb ac">'
    '<div class="fc g4"><h1 class="t28" style="margin:0">Editor alur</h1>'
    '<span class="mu">Templat default, 7 langkah. Selesai membuka kasir jika ada Tindakan.</span></div>'
    '<div class="f g8"><button class="btn sec">Kembali ke templat default</button>'
    '<button class="btn pri">Terbitkan</button></div></div>'
    '<div class="card" style="padding:20px;display:flex;flex-direction:column;align-items:center;gap:12px">'
    '<span class="hint">Fase 1, garis lurus. Node hanya dari daftar tetap.</span>'
    f'{chain}'
    '</div></main>'
)
board4 = set_shell('Editor alur', 'Editor alur', editor_main)

# ---------- 05 settings + pengaturan RM ----------
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
    '<div class="fc g8"><span class="mu t12">Siapa menandatangani</span>'
    + radio(
        [('Dokter merawat saja', ''), ('Dokter mana pun', '')],
        'Dokter merawat saja',
    )
    + '</div>'
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
            ('Perbarui form terakhir', 'Terisi dari jawaban terakhir. Versi baru, tidak menimpa.'),
        ],
        'Form baru tiap kunjungan',
    )
    + '<span class="mu t12">Dokter menandai form itu Ditinjau.</span>'
    '</div>'
)
rm_main = (
    '<main class="cnt set">'
    '<div class="fc g4"><h1 class="t28" style="margin:0">Pengaturan RM</h1>'
    '<span class="mu">Draf, tutup kunjungan, dan tinjauan riwayat medis.</span></div>'
    f'<div class="gd c3 w1">{card_draft}{card_close}{card_hx}</div>'
    '<div class="f ac g8" style="margin-top:auto"><span class="mu">2 perubahan belum disimpan</span>'
    '<button class="btn sec ma">Batal</button><button class="btn pri">Simpan</button></div>'
    '</main>'
)
board5 = set_shell('Pengaturan RM', 'Pengaturan RM', rm_main)

# ---------- 07 no entry for other roles ----------
menu_doc = menu([
    ('Profil saya', 'user', False, True),
    ('Keluar', 'x', False, True),
])
board7 = ops_shell(
    NAV_OPS, active='Antrean',
    who='drg. Arif Hidayat', role='Dokter gigi', ini='AH',
    gear=False, overlay=menu_doc, menu_on=True,
)

# ---------- 07 mobile list ----------
def mrow(title, meta='', badge=''):
    b = f'<span class="{badge}" style="margin-left:auto">{meta}</span>' if badge else (
        f'<span class="mu t12" style="margin-left:auto">{meta}</span>' if meta else
        f'<span class="mu" style="margin-left:auto">{ico("chev", 16)}</span>'
    )
    return f'<div class="rw"><span class="w1">{title}</span>{b}</div>'

mobile = (
    '<div class="scr m-set"><div class="app">'
    '<header class="top set-top" style="padding:8px 12px">'
    f'{ico("cog", 20)}<div class="pt">Pengaturan</div>'
    '<span class="syn">DATA SINTETIS</span>'
    '<span class="av-hit"><span class="av">NP</span></span></header>'
    '<main class="cnt" style="padding:16px;display:flex;flex-direction:column;gap:12px">'
    f'<div class="back" title="Kembali ke layar operasional terakhir">{ico("arrow", 16)}Kembali ke klinik</div>'
    '<span class="back-hint">Ke Antrean</span>'
    '<div class="list">'
    '<div class="phead">Klinik</div>'
    + mrow('Profil klinik') + mrow('Cabang', 'Daftar lokasi', '')
    + '<div class="phead">Rekam medis</div>'
    + mrow('Pengaturan RM')
    + mrow('Alur kunjungan')
    + '<div class="phead">Keuangan</div>'
    + mrow('Tarif') + mrow('Metode bayar') + mrow('Diskon')
    + '<div class="phead">Tim</div>'
    + mrow('Pengguna') + mrow('Peran')
    + '<div class="phead">Sistem</div>'
    + mrow('Audit log')
    + '</div>'
    '<span class="mu t12">Hanya pemilik dan admin. Pengaturan berlaku untuk seluruh klinik. Di ponsel, alur kunjungan tampil sebagai langkah.</span>'
    '</main></div></div>'
)

# ---------- 06 cabang list, not a settings scope ----------
cabang_main = (
    '<main class="cnt set">'
    '<div class="fc g4"><h1 class="t28" style="margin:0">Cabang</h1>'
    '<span class="mu">Daftar lokasi. Pengaturan di kiri berlaku untuk seluruh klinik, bukan per cabang.</span></div>'
    '<div class="fc g8" style="max-width:640px">'
    '<div class="loc"><div class="fc w1"><b>Tebet, Jakarta Selatan</b>'
    '<span class="mu t12">Cabang utama</span></div>'
    '<span class="bdg">Utama</span></div>'
    '<button class="btn sec" style="align-self:flex-start">Tambah cabang</button>'
    '</div></main>'
)
board6 = set_shell('Cabang', 'Cabang', cabang_main, size='d')

# ---------- 08 settings URL redirects to last operational screen ----------
toast = '<div class="toast-wrap"><div class="toast">Kembali ke Antrean</div></div>'
board8 = ops_shell(
    NAV_OPS, active='Antrean',
    who='drg. Arif Hidayat', role='Dokter gigi', ini='AH',
    gear=False, overlay=toast,
)

# ---------- assemble ----------
sec_ops = section(
    'Pintu masuk, terpisah dari operasional',
    'Sidebar operasional tidak memuat pengaturan. Pemilik dan admin masuk lewat ikon gigi di topbar.',
    [ab('01', 'Sekarang, pengaturan tercampur di sidebar operasional', '1440×900', board1)],
    [ab('02', 'Usulan, sidebar operasional tanpa pengaturan', '1440×900', board2)],
    [ab('03', 'Masuk lewat ikon gigi. Menu avatar hanya Profil saya dan Keluar', '1440×900', board3)],
)
sec_set = section(
    'Area pengaturan, shell sendiri',
    'Kembali ke klinik membuka layar operasional terakhir. Pengaturan berlaku untuk seluruh klinik, bukan per cabang.',
    [ab('04', 'Pengaturan, Editor alur. Kembali ke Antrean', '1440×1080', board4)],
    [ab('05', 'Pengaturan, Pengaturan RM. Berlaku untuk seluruh klinik', '1440×1080', board5)],
    [ab('06', 'Cabang, daftar lokasi, bukan lingkup pengaturan', '1440×900', board6)],
)
sec_role = section(
    'Hak akses dan ponsel',
    'Dokter dan resepsionis tidak melihat ikon gigi. URL pengaturan mengembalikan ke layar operasional terakhir.',
    [ab('07', 'Peran lain, tidak ada pintu masuk', '1440×900', board7)],
    [ab('08', 'URL pengaturan mengembalikan ke Antrean, layar terakhir', '1440×900', board8)],
    [ab('09', 'Ponsel, daftar pengaturan. Kembali ke Antrean', '390×960', mobile)],
)

html = (
    '<!doctype html><html lang="id"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1">'
    '<title>Bittodent / Area pengaturan</title>'
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">'
    f'<style>{CSS}\n{EXTRA_CSS}</style></head><body>'
    f'{SPRITE}'
    '<header class="bh"><h1>Bittodent / Area pengaturan</h1>'
    '<span class="mu b6">Board statis. Klinik Gigi Senyum Sehat, 15 Nov 2026. Data sintetis.</span></header>'
    f'{sec_ops}{sec_set}{sec_role}'
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
