#!/usr/bin/env python3
"""Papan desain impersonasi superadmin untuk setup awal admin klinik.

Hasil: design/boards/impersonate.html
dan /workspace/artifacts/bittodent-board-impersonate.html
Data sintetis. Tanpa JavaScript. Tidak mengubah kode app.

Keputusan: tanpa persetujuan klinik, tanpa alasan, tanpa durasi.
Log hanya di log platform. Data pasien tetap terlihat.
Hanya aksi tanda tangan klinis yang disembunyikan (Selesai, adendum,
koreksi, Setujui draf agen). Hanya peran admin yang boleh diimpersonasi,
bukan dokter gigi.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'design/boards/impersonate.html'
ART = Path('/workspace/artifacts/bittodent-board-impersonate.html')
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
    '<symbol id="arrow" viewBox="0 0 24 24"><path d="M19 12H7M11 6l-6 6 6 6" fill="none"/></symbol>'
    '<symbol id="building" viewBox="0 0 24 24"><path d="M4 20V6l8-3 8 3v14"/><path d="M9 20v-6h6v6M4 20h16M9 9h.01M12 9h.01M15 9h.01M9 13h.01M12 13h.01M15 13h.01"/></symbol>'
)
SPRITE = SPRITE.replace('</svg>', EXTRA_ICONS + '</svg>')


def ico(name, size=20, cls=''):
    cls_s = f' i{size}' if size != 20 else ''
    if cls:
        cls_s += f' {cls}'
    return f'<svg class="i{cls_s}" aria-hidden="true"><use href="#{name}"/></svg>'


EXTRA_CSS = """
.i{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.i16{width:16px;height:16px}
.i24{width:24px;height:24px}
.nav{height:44px}
.ib{width:44px;height:44px}
.av-hit{width:44px;height:44px;display:flex;align-items:center;justify-content:center;flex:none}
.app{position:relative}
.tbl th,.tbl td{height:44px;padding:8px 12px;vertical-align:middle}
.tbl{width:100%;border-collapse:collapse}
.bs{margin:40px 0 8px}
.bs h2{font-size:20px;line-height:28px;margin:0 0 4px;display:flex;flex-direction:column;gap:4px}
.bs h2 span{font-size:14px;line-height:20px;font-weight:500;color:var(--mu)}
.br-row{display:flex;gap:28px;margin-top:20px;align-items:flex-start}
.ab{display:flex;flex-direction:column;gap:8px;flex:none}
.cap{font-size:12px;line-height:16px;font-weight:600;color:#3B4752}
.cap span{font-weight:500;color:#4D5A64;margin-left:8px}
.side.con{background:#F4F5F8}
.imp-ban{flex:none;min-height:48px;padding:2px 20px;background:var(--ibg);border-bottom:1px solid var(--ibd);color:var(--ifg);display:flex;align-items:center;gap:12px;font-weight:600;font-size:14px;line-height:20px}
.imp-ban .sep{opacity:.6;font-weight:500}
.imp-ban .kel{display:inline-flex;align-items:center;justify-content:center;min-width:72px;height:44px;padding:0 16px;border-radius:10px;border:1px solid var(--ibd);background:#fff;color:var(--ifg);font:600 14px/20px var(--ff)}
.scr.imp{flex-direction:column}
.scr.imp .body{flex:1;min-height:0;display:flex;width:100%}
.veil{position:absolute;inset:0;background:rgba(22,33,43,.4);display:flex;align-items:center;justify-content:center;z-index:5;padding:32px}
.modal{max-width:480px;width:100%}
.rdo{display:flex;flex-direction:column;gap:8px}
.rdo .opt{display:flex;align-items:center;gap:12px;min-height:44px;padding:8px 12px;border:1px solid var(--n200);border-radius:12px;background:#fff}
.rdo .opt.on{border-color:var(--b);box-shadow:inset 0 0 0 1px var(--b);background:var(--b0)}
.rdo .dot{width:20px;height:20px;border-radius:50%;border:2px solid var(--n300);flex:none;position:relative}
.rdo .opt.on .dot{border-color:var(--b)}
.rdo .opt.on .dot:after{content:"";position:absolute;inset:4px;border-radius:50%;background:var(--b)}
.ck{width:20px;height:20px;border-radius:6px;border:2px solid var(--n300);flex:none;display:flex;align-items:center;justify-content:center}
.ck.on{background:var(--b);border-color:var(--b);color:#fff}
.ck.on svg{stroke:#fff}
.row-act{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--n200);background:#fff;font:600 14px/20px var(--ff);color:var(--tx);white-space:nowrap}
.list-card{background:#fff;border:1px solid var(--bd);border-radius:16px;overflow:hidden}
.list-card .rw{display:flex;align-items:center;gap:12px;min-height:48px;padding:8px 16px;border-bottom:1px solid var(--bd)}
.list-card .rw:last-child{border-bottom:0}
.side.set{background:#F4F7F7;border-right:1px solid var(--bd)}
.set-brand{padding:0 4px 12px;border-bottom:1px solid var(--bd);margin-bottom:8px;display:flex;flex-direction:column;gap:8px}
.set-brand .tag{display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:6px;background:#fff;border:1px solid var(--b1);color:var(--bh);font-size:11px;font-weight:700;letter-spacing:.04em;align-self:flex-start}
.back{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 10px;border:1px solid var(--n200);border-radius:10px;background:#fff;font-weight:600;font-size:13px;color:var(--tx)}
.set-top{background:var(--b0);border-bottom:1px solid var(--b1)}
.set-top .pt{color:var(--b9)}
.side.set .clinic{margin:0}
.cnt.set{gap:16px;padding:20px 28px}
.note{background:#fff;border:1px solid var(--bd);border-radius:16px;padding:16px}
.f{display:flex}.fc{display:flex;flex-direction:column}.g4{gap:4px}.g8{gap:8px}.g12{gap:12px}.g16{gap:16px}
.jb{justify-content:space-between}.ac{align-items:center}.w1{flex:1;min-width:0}
.t12{font-size:12px;line-height:16px}.t14{font-size:14px;line-height:20px}
.t20{font-size:20px;line-height:28px;font-weight:700}.t28{font-size:28px;line-height:36px;font-weight:700}
.mu{color:var(--mu)}.wf{width:100%}
"""

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
    ('Tindakan', 'file'),
    ('Tarif', 'wallet'),
    ('Metode bayar', 'file'),
    ('Diskon', 'file'),
    ('TIM', None),
    ('Pengguna', 'users'),
    ('Peran', 'user'),
    ('SISTEM', None),
    ('Audit log', 'clip'),
]

NAV_CON = [
    ('PLATFORM', None),
    ('Klinik', 'building'),
    ('Log', 'clip'),
]


def ico_nav(name, ic, on):
    cls = ' nav on' if on else ' nav'
    return f'<div class="{cls}" title="{name}">{ico(ic)}{name}</div>'


def nav_block(items, active):
    out = ''
    for name, ic in items:
        if ic is None:
            out += f'<div class="nlab">{name}</div>'
            continue
        out += ico_nav(name, ic, name == active)
    return out


def ops_sidebar(active, syn=True):
    badge = '<span class="syn">DATA SINTETIS</span>' if syn else ''
    return (
        '<aside class="side">'
        '<div class="logo"><span class="lg">B</span>Bittodent</div>'
        '<div class="clinic"><b>Klinik Gigi Senyum Sehat</b>'
        '<span class="t12 mu">Tebet, Jakarta Selatan</span>'
        f'{badge}</div>'
        f'{nav_block(NAV_OPS, active)}'
        '</aside>'
    )


def set_sidebar(active, syn=True):
    badge = '<span class="syn">DATA SINTETIS</span>' if syn else ''
    return (
        '<aside class="side set">'
        '<div class="set-brand">'
        '<div class="logo"><span class="lg">B</span>Bittodent</div>'
        '<span class="tag">PENGATURAN</span>'
        f'<div class="back">{ico("arrow", 16)}Kembali ke klinik</div>'
        '<div class="clinic"><b>Klinik Gigi Senyum Sehat</b>'
        '<span class="t12 mu">Berlaku untuk seluruh klinik</span>'
        f'{badge}</div></div>'
        f'{nav_block(NAV_SET, active)}'
        '</aside>'
    )


def con_sidebar(active, syn=True):
    badge = '<span class="syn">DATA SINTETIS</span>' if syn else ''
    return (
        '<aside class="side con">'
        '<div class="logo"><span class="lg">B</span>Bittodent</div>'
        f'<div class="clinic"><b>Konsol platform</b>'
        f'<span class="t12 mu">Superadmin</span>{badge}</div>'
        f'{nav_block(NAV_CON, active)}'
        '</aside>'
    )


def ops_topbar(title, icon='menu', who='Rina Wulandari', role='Admin', ini='RW'):
    return (
        f'<header class="top">{ico(icon, 24)}<div class="pt">{title}</div>'
        f'<div class="srch">{ico("search", 16)}Cari pasien atau No. RM</div>'
        '<span class="w1"></span>'
        f'<span class="ib">{ico("bell")}</span>'
        f'<span class="av-hit"><span class="av">{ini}</span></span>'
        f'<div class="fc"><b class="t14">{who}</b><span class="t12 mu">{role}</span></div>'
        '</header>'
    )


def set_topbar(page, who='Rina Wulandari', role='Admin', ini='RW'):
    return (
        '<header class="top set-top">'
        f'{ico("cog", 24)}<div class="pt">Pengaturan</div>'
        f'<span class="mu">/</span><span class="t14" style="font-weight:700">{page}</span>'
        '<span class="w1"></span>'
        f'<span class="av-hit"><span class="av">{ini}</span></span>'
        f'<div class="fc"><b class="t14">{who}</b><span class="t12 mu">{role}</span></div>'
        '</header>'
    )


def con_topbar(title, icon='building'):
    return (
        f'<header class="top">{ico(icon, 24)}<div class="pt">{title}</div>'
        '<span class="w1"></span>'
        '<span class="av-hit"><span class="av">MK</span></span>'
        '<div class="fc"><b class="t14">Maya Kusuma</b><span class="t12 mu">Superadmin</span></div>'
        '</header>'
    )


def impersonate_banner():
    return (
        '<div class="imp-ban" role="status">'
        '<span>Masuk sebagai Rina Wulandari</span>'
        '<span class="sep" aria-hidden="true">·</span>'
        '<span>Klinik Gigi Senyum Sehat</span>'
        '<span class="w1"></span>'
        '<button class="kel" type="button">Keluar</button>'
        '</div>'
    )


def clinic_frame(side, top, main, overlay='', banner=False, size='d'):
    if banner:
        return (
            f'<div class="scr {size} imp" style="position:relative">'
            f'{impersonate_banner()}'
            f'<div class="body">{side}<div class="app">{top}{main}{overlay}</div></div>'
            '</div>'
        )
    return (
        f'<div class="scr {size}" style="position:relative">'
        f'{side}<div class="app">{top}{main}{overlay}</div></div>'
    )


def con_frame(active, title, icon, main, overlay='', size='d'):
    return clinic_frame(
        con_sidebar(active, syn=True),
        con_topbar(title, icon),
        main,
        overlay=overlay,
        banner=False,
        size=size,
    )


def ab(num, title, size, inner):
    return f'<div class="ab"><div class="cap">{num} {title}<span>{size}</span></div>{inner}</div>'


def section(title, sub, *rows):
    inner = ''.join(
        f'<div class="br-row">{"".join(row)}</div>' if isinstance(row, (list, tuple)) else row
        for row in rows
    )
    return f'<section class="bs"><h2>{title}<span>{sub}</span></h2>{inner}</section>'


def modal(title, body, actions):
    return (
        f'<div class="veil"><div class="modal card p24 fc g16">'
        f'<h2 class="t20" style="margin:0">{title}</h2>{body}'
        f'<div class="f g8" style="justify-content:flex-end">{actions}</div>'
        f'</div></div>'
    )


# ---------- shared tenant table ----------
TENANTS = [
    ('Klinik Gigi Senyum Sehat', 'Tebet, Jakarta Selatan', 'Setup awal', True, True),
    ('Klinik Gigi Harmoni', 'Menteng, Jakarta Pusat', 'Aktif', False, True),
    ('Klinik Gigi Melati', 'Bandung', 'Aktif', False, True),
]


def tenant_table(highlight=None):
    rows = ''
    for name, loc, status, setup, can in TENANTS:
        on = ' style="background:var(--b0)"' if name == highlight else ''
        st = ' bdg wt' if setup else ' bdg ok'
        act = (
            '<button class="row-act" type="button">Masuk sebagai admin</button>'
            if can else ''
        )
        rows += (
            f'<tr{on}><td><div class="fc"><b>{name}</b>'
            f'<span class="mu t12">{loc}</span></div></td>'
            f'<td><span class="{st}">{status}</span></td>'
            f'<td class="r">{act}</td></tr>'
        )
    return (
        '<main class="cnt" style="padding:20px 28px;gap:16px">'
        '<div class="f jb ac"><h1 class="t28" style="margin:0">Klinik</h1>'
        '<span class="mu">Masuk kapan saja, tanpa persetujuan klinik.</span></div>'
        '<div class="card p16" style="padding:0;overflow:hidden">'
        '<table class="tbl"><thead><tr><th>Klinik</th><th>Status</th><th></th></tr></thead>'
        f'<tbody>{rows}</tbody></table></div></main>'
    )


# ---------- 01 console ----------
board1 = con_frame('Klinik', 'Klinik', 'building', tenant_table())

# ---------- 02 start popup ----------
picker = (
    '<span class="mu t12">Klinik Gigi Senyum Sehat. Hanya peran admin. Dokter tidak masuk daftar.</span>'
    '<div class="rdo">'
    '<div class="opt on"><span class="dot"></span>'
    '<div class="fc w1"><b>Rina Wulandari</b><span class="mu t12">Admin</span></div></div>'
    '</div>'
)
ov2 = modal(
    'Masuk sebagai admin',
    picker,
    '<button class="btn sec" type="button">Batal</button>'
    '<button class="btn pri" type="button">Masuk</button>',
)
board2 = con_frame('Klinik', 'Klinik', 'building', tenant_table('Klinik Gigi Senyum Sehat'), overlay=ov2)

# ---------- 03 clinic app + banner ----------
antrean_rows = [
    ('Budi Santoso', 'Kontrol 15. Kursi 1.', 'Datang, 09.52'),
    ('Siti Rahma', 'Pemeriksaan awal.', 'Di kursi'),
    ('Andi Wijaya', 'Scaling.', 'Terjadwal, 11.00'),
]
lis = ''
for n, m, s in antrean_rows:
    ok = ' bdg ok' if 'Datang' in s or 'kursi' in s.lower() else ' bdg'
    lis += (
        f'<div class="card" style="padding:14px 16px">'
        f'<div class="f jb ac"><div class="fc g4"><b>{n}</b>'
        f'<span class="mu t12">{m}</span></div>'
        f'<span class="{ok}">{s}</span></div></div>'
    )
antrean_main = (
    '<main class="cnt" style="padding:20px 28px;display:flex;flex-direction:column;gap:12px">'
    '<div class="f jb ac"><h1 class="t28" style="margin:0">Antrean</h1>'
    '<span class="mu">Senin, 15 Nov 2026</span></div>'
    f'{lis}</main>'
)
board3 = clinic_frame(
    ops_sidebar('Antrean'),
    ops_topbar('Antrean'),
    antrean_main,
    banner=True,
)

# ---------- 04 settings: import templat tindakan ----------
TEMPLATES = [
    'Pemeriksaan awal',
    'Scaling',
    'Kontrol',
    'Tambalan 1 permukaan',
    'Tambalan 2 permukaan',
    'Pencabutan gigi permanen',
]
trows = ''
for i, name in enumerate(TEMPLATES):
    trows += (
        f'<div class="rw"><span class="ck on">{ico("check", 16)}</span>'
        f'<span class="w1"><b>{name}</b></span></div>'
    )
import_main = (
    '<main class="cnt set">'
    '<div class="f jb ac">'
    '<div class="fc g4"><h1 class="t28" style="margin:0">Templat tindakan</h1>'
    '<span class="mu">Templat awal untuk setup. Bukan panduan klinis.</span></div>'
    '<button class="btn pri" type="button">Impor 6 templat</button></div>'
    f'<div class="list-card">{trows}</div>'
    '</main>'
)
board4 = clinic_frame(
    set_sidebar('Tindakan'),
    set_topbar('Tindakan'),
    import_main,
    banner=True,
)

# ---------- 05 clinical screen, signing hidden, patient data visible ----------
visit_main = (
    '<main class="cnt" style="padding:20px 28px;gap:16px">'
    '<div class="f jb ac">'
    '<div class="fc g4"><h1 class="t28" style="margin:0">Kunjungan</h1>'
    '<span class="mu">Budi Santoso · No. RM BT-000184 · Kontrol 15</span></div>'
    '<span class="bdg">Catatan, draf agen</span></div>'
    '<div class="note fc g12">'
    '<div class="f jb ac"><b>Pemeriksaan</b><span class="mu t12">drg. Arif Hidayat, 15 Nov 2026, 10.12 WIB</span></div>'
    '<span>Gigi 15: tumpatan lama retak di tepi mesial. Nyeri tekan ringan. Tidak ada pembengkakan.</span>'
    '</div>'
    '<div class="note fc g12">'
    '<div class="f jb ac"><b>Draf catatan</b><span class="mu t12">Ditulis agen, 10.18 WIB</span></div>'
    '<span>Kontrol tumpatan gigi 15. Rencana: ganti tumpatan jika retak dalam, atau poles tepi jika dangkal. Pasien setuju ditunda ke kunjungan berikut jika perlu foto.</span>'
    '</div>'
    '</main>'
)
board5 = clinic_frame(
    ops_sidebar('Rekam Medis', syn=True),
    ops_topbar('Rekam Medis', icon='tooth'),
    visit_main,
    banner=True,
)

# ---------- 06 session end + summary ----------
summary = (
    '<div class="fc g8">'
    '<div class="f jb"><span class="mu">Klinik</span><b>Klinik Gigi Senyum Sehat</b></div>'
    '<div class="f jb"><span class="mu">Masuk sebagai</span><b>Rina Wulandari, Admin</b></div>'
    '<div class="f jb"><span class="mu">Mulai</span><span>15 Nov 2026, 14.02 WIB</span></div>'
    '<div class="f jb"><span class="mu">Keluar</span><span>15 Nov 2026, 14.11 WIB</span></div>'
    '</div>'
    '<div class="fc g8">'
    '<span class="mu t12">Jejak, hanya di log platform</span>'
    '<div class="list-card">'
    '<div class="rw"><span class="mu t12">14.02</span><span class="w1">Masuk sebagai Rina Wulandari</span></div>'
    '<div class="rw"><span class="mu t12">14.06</span><span class="w1">Impor templat tindakan, 6 item</span></div>'
    '<div class="rw"><span class="mu t12">14.11</span><span class="w1">Keluar</span></div>'
    '</div></div>'
)
ov6 = modal(
    'Sesi selesai',
    summary,
    '<button class="btn sec" type="button">Tutup</button>'
    '<button class="btn pri" type="button">Lihat log</button>',
)
board6 = con_frame('Klinik', 'Klinik', 'building', tenant_table(), overlay=ov6)

# ---------- 07 platform log ----------
LOGS = [
    ('15 Nov 2026, 14.11 WIB', 'Maya Kusuma', 'Klinik Gigi Senyum Sehat', 'Keluar, sesi sebagai Rina Wulandari'),
    ('15 Nov 2026, 14.06 WIB', 'Maya Kusuma', 'Klinik Gigi Senyum Sehat', 'Impor templat tindakan, 6 item'),
    ('15 Nov 2026, 14.02 WIB', 'Maya Kusuma', 'Klinik Gigi Senyum Sehat', 'Masuk sebagai Rina Wulandari'),
    ('12 Nov 2026, 09.40 WIB', 'Maya Kusuma', 'Klinik Gigi Harmoni', 'Keluar, sesi sebagai Dina Pratiwi'),
    ('12 Nov 2026, 09.18 WIB', 'Maya Kusuma', 'Klinik Gigi Harmoni', 'Masuk sebagai Dina Pratiwi'),
]
lrows = ''
for when, who, clinic, ev in LOGS:
    hi = ' style="background:var(--b0)"' if '14.06' in when else ''
    lrows += (
        f'<tr{hi}><td class="t12">{when}</td>'
        f'<td>{who}</td><td>{clinic}</td><td>{ev}</td></tr>'
    )
log_main = (
    '<main class="cnt" style="padding:20px 28px;gap:16px">'
    '<div class="fc g4"><h1 class="t28" style="margin:0">Log platform</h1>'
    '<span class="mu">Jejak impersonasi hanya di sini. Tidak ditulis ke audit log klinik.</span></div>'
    '<div class="card p16" style="padding:0;overflow:hidden">'
    '<table class="tbl"><thead><tr><th>Waktu</th><th>Pelaku</th><th>Klinik</th><th>Peristiwa</th></tr></thead>'
    f'<tbody>{lrows}</tbody></table></div></main>'
)
board7 = con_frame('Log', 'Log', 'clip', log_main)

# ---------- assemble ----------
sec_in = section(
    'Masuk dari konsol platform',
    'Superadmin masuk kapan saja, tanpa persetujuan klinik. Hanya peran admin, bukan dokter gigi. Tanpa alasan dan tanpa durasi.',
    [ab('01', 'Konsol, daftar klinik dan aksi Masuk sebagai admin', '1440×900', board1)],
    [ab('02', 'Mulai sesi, pilih admin lalu Masuk', '1440×900', board2)],
)
sec_in2 = section(
    'Di dalam klinik, sebagai admin',
    'Pita tetap di atas. Data pasien tetap terlihat. Hanya aksi tanda tangan klinis yang disembunyikan.',
    [ab('03', 'Aplikasi klinik, pita Masuk sebagai', '1440×900', board3)],
    [ab('04', 'Pengaturan, impor templat tindakan', '1440×900', board4)],
    [ab('05', 'Kunjungan, Selesai dan aksi tanda tangan disembunyikan', '1440×900', board5)],
)
sec_out = section(
    'Keluar dan jejak platform',
    'Setelah Keluar, kembali ke konsol dengan ringkasan. Jejak hanya di log platform, tidak di audit log klinik.',
    [ab('06', 'Sesi selesai, ringkasan tindakan', '1440×900', board6)],
    [ab('07', 'Log platform, jejak impersonasi', '1440×900', board7)],
)

html = (
    '<!doctype html><html lang="id"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1">'
    '<title>Bittodent / Impersonasi superadmin</title>'
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">'
    f'<style>{CSS}\n{EXTRA_CSS}</style></head><body>'
    f'{SPRITE}'
    '<header class="bh"><h1>Bittodent / Impersonasi superadmin</h1>'
    '<span class="mu b6">Board statis. Setup awal admin klinik, 15 Nov 2026. Data sintetis.</span></header>'
    f'{sec_in}{sec_in2}{sec_out}'
    '</body></html>'
)

assert '\u2014' not in html, 'em dash found'
assert '\u2013' not in html, 'en dash found'
assert '<script' not in html.lower()

OUT.write_text(html)
ART.parent.mkdir(parents=True, exist_ok=True)
ART.write_text(html)
raw = len(html.encode())
print(f'HTML {raw/1024:.1f} KB ({raw} B)')
print('wrote', OUT)
print('wrote', ART)
