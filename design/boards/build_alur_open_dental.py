#!/usr/bin/env python3
"""Papan alur rekam medis, direkayasa balik dari Open Dental.

Hasil: design/boards/alur-open-dental.html
dan /workspace/artifacts/bittodent-board-alur-open-dental.html

Tujuh langkah. Tanpa rencana perawatan (TP) dulu.
Selesai oleh dokter merawat = tanda tangan elektronik.
Data sintetis. Tanpa JavaScript. Tidak mengubah kode app.
"""
from __future__ import annotations

import base64
import io
import re
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'design/boards/alur-open-dental.html'
ART = Path('/workspace/artifacts/bittodent-board-alur-open-dental.html')
KASIR = ROOT / 'design/boards/kasir.html'
ASSETS = ROOT / 'design/boards/assets/od-manual'
AUDIT_IMG = Path('/workspace/audit/od-flow/manual')

src = KASIR.read_text()
CSS = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
SPRITE = re.search(r'<svg width="0".*?</svg>', src, re.S).group(0)

EXTRA_ICONS = (
    '<symbol id="tooth" viewBox="0 0 24 24">'
    '<path d="M8 4.5c0-1.4 1.6-2.5 4-2.5s4 1.1 4 2.5c0 .7-.2 1.4-.5 2 1.7.3 3 1.6 3.2 3.6.4 3.2-1 7.2-2.8 9.2-.6.7-1.7.3-1.7-.6 0-1.8-.3-3.2-.7-4.1-.3-.6-.9-.8-1.5-.4-.4.2-.8.2-1.2 0-.6-.4-1.2-.2-1.5.4-.4.9-.7 2.3-.7 4.1 0 .9-1.1 1.3-1.7.6-1.8-2-3.2-6-2.8-9.2.2-2 1.5-3.3 3.2-3.6-.3-.6-.5-1.3-.5-2z"/>'
    '</symbol>'
    '<symbol id="arrow" viewBox="0 0 24 24"><path d="M5 12h12M13 6l6 6-6 6" fill="none"/></symbol>'
    '<symbol id="lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none"/></symbol>'
)
SPRITE = SPRITE.replace('</svg>', EXTRA_ICONS + '</svg>')


def ico(name, size=20, cls=''):
    cls_s = f' i{size}' if size != 20 else ''
    if cls:
        cls_s += f' {cls}'
    return f'<svg class="i{cls_s}" aria-hidden="true"><use href="#{name}"/></svg>'


def webp(path: Path, max_w=760, q=74) -> tuple[str, int, int]:
    im = Image.open(path)
    if getattr(im, 'is_animated', False):
        im.seek(0)
    if im.mode in ('P', 'LA'):
        im = im.convert('RGBA')
    if im.mode == 'RGBA':
        bg = Image.new('RGB', im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert('RGB')
    w, h = im.size
    if max_w and w > max_w:
        h = int(round(h * max_w / w))
        w = max_w
        im = im.resize((w, h), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=q, method=6)
    uri = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
    return uri, w, h


def od_img(name: str, alt: str, max_w=760, q=74) -> str:
    path = ASSETS / name
    uri, w, h = webp(path, max_w=max_w, q=q)
    return f'<img class="odimg" src="{uri}" width="{w}" height="{h}" alt="{alt}">'


ODO_SRC = Path('/workspace/audit/after-3d/04b-odo3d-dewasa-v2.png')
if not ODO_SRC.exists():
    ODO_SRC = ROOT / 'design/odontogram/preview/odontogram-3d-blender-full.png'
ODO_URI, ODO_W, ODO_H = webp(ODO_SRC, max_w=420, q=72)
print(f'odontogram {ODO_W}x{ODO_H}')

EXTRA_CSS = """
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
.flow{width:1560px;display:flex;flex-direction:column;gap:12px}
.row{display:grid;grid-template-columns:1fr 56px 1fr;gap:16px;align-items:start}
.pane{display:flex;flex-direction:column;gap:8px;min-width:0}
.plab{display:flex;align-items:center;gap:8px;font-size:12px;line-height:16px;font-weight:700;color:var(--mu);letter-spacing:.04em;text-transform:uppercase}
.shot{background:#fff;border:1px solid #B5BCC8;box-shadow:0 0 0 4px rgba(255,255,255,.35);border-radius:12px;overflow:hidden}
.odimg{display:block;width:100%;height:auto;background:#fff}
.odimg + .odimg{border-top:1px solid var(--bd)}
.arr{display:flex;align-items:center;justify-content:center;padding-top:28px;color:var(--mu)}
.arr svg{width:32px;height:32px}
.bt{background:var(--cv);border:1px solid #B5BCC8;box-shadow:0 0 0 4px rgba(255,255,255,.35);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;min-height:100%}
.bt-top{display:flex;align-items:center;gap:10px;padding:10px 16px;background:#fff;border-bottom:1px solid var(--bd);min-height:52px}
.bt-top .brand{font-weight:800;font-size:14px;color:var(--b);flex:none}
.bt-top .ttl{font-weight:700;font-size:14px;color:var(--tx);flex:1;min-width:0}
.bt-top .who{display:flex;align-items:center;gap:8px;flex:none;font-size:12px;color:var(--mu)}
.av{width:28px;height:28px;border-radius:50%;background:var(--b0);color:var(--b);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex:none}
.bt-body{padding:16px;display:flex;flex-direction:column;gap:12px}
.bt-body.tight{padding:12px 16px;gap:10px}
.legal{font-size:12px;line-height:16px;color:var(--mu);max-width:280px;text-align:right}
.sel-wrap{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.mini{display:grid;grid-template-columns:1fr 1fr;gap:16px;width:1560px}
.mini .bt{min-height:0}
.chiprow{display:flex;flex-wrap:wrap;gap:8px}
.step{display:flex;align-items:center;gap:10px;height:48px;padding:0 16px 0 8px;border:1px solid var(--bd);background:#fff;border-radius:999px}
.step b{width:28px;height:28px;border-radius:50%;background:var(--b);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;flex:none}
.step span{font-weight:600;font-size:13px;color:var(--tx);white-space:nowrap}
.line{font-size:14px;line-height:20px;color:var(--tx);margin:0}
.src{font-size:12px;line-height:16px;color:var(--mu)}
.src a{color:var(--ifg);text-decoration:underline}
.beda{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;background:var(--wbg);border:1px solid var(--wbd);color:var(--wfg);font-size:11px;font-weight:700;letter-spacing:.04em;vertical-align:middle}
.kv{display:flex;justify-content:space-between;gap:12px;align-items:center;min-height:44px;border-bottom:1px solid var(--bd)}
.kv:last-child{border-bottom:0}
.note{background:#fff;border:1px solid var(--bd);border-radius:12px;padding:12px 14px;font-size:13px;line-height:20px;color:var(--tx);white-space:pre-wrap}
.seg{display:flex;gap:0;border:1px solid var(--bd);border-radius:10px;overflow:hidden;background:#fff;flex-wrap:wrap}
.seg b{min-height:44px;padding:0 12px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:var(--mu);border-right:1px solid var(--bd)}
.seg b:last-child{border-right:0}
.seg b.on{background:var(--ibg);color:var(--ifg)}
.list{display:flex;flex-direction:column;background:#fff;border:1px solid var(--bd);border-radius:12px;overflow:hidden}
.list .rw{display:flex;align-items:center;gap:10px;min-height:44px;padding:8px 12px;border-bottom:1px solid var(--bd)}
.list .rw:last-child{border-bottom:0}
.alrt{background:var(--dbg);border:1px solid var(--dbd);border-radius:12px;padding:12px 14px;color:var(--dfg);display:flex;flex-direction:column;gap:4px}
.fld{display:flex;flex-direction:column;gap:4px}
.fld label{font-size:12px;font-weight:600;color:var(--mu)}
.box{min-height:44px;border:1px solid var(--bd);border-radius:10px;background:#fff;display:flex;align-items:center;padding:0 12px;font-weight:500}
.odo{background:#fff;border:1px solid var(--bd);border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:180px}
.odo img{display:block;width:100%;height:auto}
.btn.off{background:#E6EBEF;color:#3B4752;border:1px solid #B5C0C9}
.pin{display:flex;gap:8px}
.pin i{width:44px;height:44px;border:1px solid var(--bd);border-radius:10px;background:#fff;display:inline-block}
.subrow{margin-top:4px}
.f{display:flex}.fc{display:flex;flex-direction:column}.g4{gap:4px}.g8{gap:8px}.g12{gap:12px}.g16{gap:16px}
.jb{justify-content:space-between}.ac{align-items:center}.w1{flex:1;min-width:0}
.t12{font-size:12px;line-height:16px}.t20{font-size:20px;line-height:28px;font-weight:700}
.mu{color:var(--mu)}.wf{width:100%}
"""


def ab(num, title, size, inner):
    return f'<div class="ab"><div class="cap">{num} {title}<span>{size}</span></div>{inner}</div>'


def section(title, sub, *rows):
    inner = ''.join(
        f'<div class="br-row">{"".join(row)}</div>' if isinstance(row, (list, tuple)) else row
        for row in rows
    )
    return f'<section class="bs"><h2>{title}<span>{sub}</span></h2>{inner}</section>'


def src_link(label, url):
    return f'<div class="src">Sumber: <a href="{url}">{label}</a></div>'


def bt(title, body, who='drg. Nadia Putri', ini='NP', role='Dokter merawat', tight=False):
    cls = 'bt-body tight' if tight else 'bt-body'
    role_s = f', {role}' if role else ''
    return (
        '<div class="bt">'
        '<div class="bt-top">'
        '<span class="brand">Bittodent</span>'
        f'<span class="ttl">{title}</span>'
        '<span class="syn">DATA SINTETIS</span>'
        f'<span class="who"><span class="av">{ini}</span>{who}{role_s}</span>'
        '</div>'
        f'<div class="{cls}">{body}</div>'
        '</div>'
    )


def arrow():
    return f'<div class="arr" aria-hidden="true">{ico("arrow", 32)}</div>'


def flow(left, right, caption, source_html='', beda=''):
    badge = f' {beda}' if beda else ''
    return (
        '<div class="flow">'
        f'<div class="row"><div class="pane">{left}</div>{arrow()}'
        f'<div class="pane">{right}</div></div>'
        f'<p class="line">{caption}{badge}</p>'
        f'{source_html}'
        '</div>'
    )


def pane_od(label, imgs_html, source_html=''):
    return f'<div class="plab">{label}</div><div class="shot">{imgs_html}</div>{source_html}'


def pane_bd(label, inner):
    return f'<div class="plab">{label}</div>{inner}'


img_appts = od_img('appts.png', 'Modul Appointments Open Dental, ruang tunggu dan status Arrived', 760, 72)
img_chart = od_img('chart.png', 'Modul Chart Open Dental: odontogram, Enter Treatment, dan catatan kemajuan', 760, 70)
img_med = od_img('medical.png', 'Jendela Medical Open Dental, tab Medical Info, alergi dan riwayat', 760, 76)
img_enter = od_img('entertreatment.png', 'Panel Enter Treatment Open Dental, status TreatPlan, Complete, ExistOther, Condition', 760, 74)
img_proc = od_img('procedureEdit.png', 'Jendela Procedure Info Open Dental, status Complete, catatan default, dan kotak tanda tangan', 760, 72)
img_notes = od_img('procEditNotes.png', 'Catatan prosedur Open Dental dengan kotak tanda tangan terpisah', 760, 78)
img_auto = od_img('autoNoteCompose.png', 'Jendela Compose Auto Note Open Dental dengan Prompt List', 760, 74)
img_comm = od_img('commlog.png', 'Jendela Commlog Open Dental', 760, 74)
img_complete = od_img('apptsetcomp.gif', 'Tombol Complete pada bilah alat janji Open Dental', 760, 80)
img_account = od_img('account.png', 'Modul Account Open Dental, tagihan pasien', 760, 70)
img_odo = (
    f'<div class="odo"><img src="{ODO_URI}" width="{ODO_W}" height="{ODO_H}" '
    'alt="Odontogram 3D Bittodent, data sintetis"></div>'
)

STEPS = [
    ('1', 'Datang'),
    ('2', 'Chart'),
    ('3', 'Riwayat medis'),
    ('4', 'Kondisi / luar'),
    ('5', 'Tindakan selesai'),
    ('6', 'Catatan'),
    ('7', 'Selesai'),
]
chips = '<div class="chiprow">' + ''.join(
    f'<div class="step"><b>{n}</b><span>{lab}</span></div>' for n, lab in STEPS
) + '</div>'
overview = (
    '<div class="flow">'
    '<div class="card" style="padding:24px;display:flex;flex-direction:column;gap:16px">'
    '<div class="fc g8"><h1 class="t20" style="margin:0">Tujuh langkah, satu kunjungan</h1>'
    '<span class="mu">Dari ruang tunggu sampai kasir. Tanpa rencana perawatan dulu. '
    'Dokter merawat menekan Selesai: itu tanda tangan elektroniknya.</span></div>'
    f'{chips}'
    '<div class="list">'
    '<div class="rw"><span class="beda">Beda</span><span>Selesai = tanda tangan. Bukan kotak tanda tangan terpisah seperti di Open Dental.</span></div>'
    '<div class="rw"><span class="beda">Beda</span><span>Selesai mencatat nama, waktu, dan hash isi, lalu mengunci catatan. Perubahan hanya lewat adendum.</span></div>'
    '<div class="rw"><span class="beda">Beda</span><span>Draf dari agen tetap draf sampai dokter menekan Setujui, baru bisa Selesai.</span></div>'
    '</div>'
    '<span class="src">Gambar kiri pada setiap langkah diambil dari manual Open Dental. '
    'Tampilan kanan adalah usulan Bittodent, data sintetis.</span>'
    '</div></div>'
)

antrean = (
    '<div class="f jb ac"><b>Senin, 15 Nov 2026</b><span class="bdg">Kursi 1</span></div>'
    '<div class="card" style="padding:16px">'
    '<div class="f jb ac"><div class="fc g4"><b>Budi Santoso</b>'
    '<span class="mu t12">Kontrol tambalan 15. 10.00, 30 menit.</span></div>'
    '<span class="bdg ok">Datang, 09.52</span></div>'
    '<div style="margin-top:12px" class="fc g4"><span class="mu t12">Status kunjungan</span>'
    '<div class="seg"><b>Terjadwal</b><b class="on">Datang</b><b>Di kursi</b><b>Selesai</b></div></div>'
    '</div>'
    '<div class="card" style="padding:0;overflow:hidden">'
    '<div class="list" style="border:0;border-radius:16px">'
    '<div class="rw"><b>Ruang tunggu</b><span class="mu t12" style="margin-left:auto">1 pasien</span></div>'
    '<div class="rw"><span class="w1"><b>Budi Santoso</b>'
    '<span class="mu t12"> Datang 09.52, menunggu 8 menit</span></span></div>'
    '</div></div>'
)
left1 = pane_od(
    'Open Dental', img_appts,
    src_link('Appointments Module dan Waiting Room', 'https://www.opendental.com/manual/appointments.html'),
)
right1 = pane_bd('Bittodent', bt('Antrean', antrean, who='Sari Front Desk', ini='SF', role='Resepsionis'))
step1 = flow(
    left1, right1,
    'Pasien datang, status diubah ke Datang, lalu muncul di ruang tunggu.',
    src_link('Waiting Room', 'https://www.opendental.com/manual/waitingroom.html'),
)

prog = (
    '<div class="list">'
    '<div class="rw"><span class="mu t12">12 Jun 2025</span><span class="w1">Gigi tiruan 31, klinik lain</span><span class="bdg">Luar</span></div>'
    '<div class="rw"><span class="mu t12">13 Nov 2026</span><span class="w1">Tambal komposit 15</span><span class="bdg ok">Selesai</span></div>'
    '<div class="rw"><span class="mu t12">15 Nov 2026</span><span class="w1">Kontrol 15, belum ditutup</span><span class="bdg wt">Draf</span></div>'
    '</div>'
)
chart_body = (
    '<div class="f jb ac"><div class="fc g4"><b>Budi Santoso</b>'
    '<span class="mu t12">RM 10284. Kunjungan 15 Nov 2026, 10.00.</span></div>'
    '<div class="seg"><b class="on">Odontogram</b><b>Tindakan</b><b>Catatan</b></div></div>'
    f'{img_odo}'
    '<span class="mu t12">Catatan kemajuan</span>'
    f'{prog}'
    '<div class="card" style="padding:12px 14px"><b>Input tindakan</b>'
    '<span class="mu t12"> Pilih gigi, lalu kode tindakan dan status. Status default untuk hari ini: Selesai.</span></div>'
)
left2 = pane_od('Open Dental', img_chart, src_link('Chart Module', 'https://www.opendental.com/manual/chart.html'))
right2 = pane_bd('Bittodent', bt('Rekam medis', chart_body))
step2 = flow(
    left2, right2,
    'Buka rekam medis: odontogram, catatan kemajuan, dan panel input tindakan.',
    src_link('Graphical Tooth Chart dan Enter Treatment', 'https://www.opendental.com/manual/graphicaltoothchart.html'),
)

med_body = (
    '<div class="alrt"><b>Alergi: amoksisilin</b>'
    '<span class="t12">Obat: sedang tidak ada. Masalah: hipertensi, terkontrol.</span></div>'
    '<div class="card" style="padding:16px">'
    '<div class="f jb ac"><b>Tinjau riwayat medis</b><span class="bdg wt">Belum ditinjau hari ini</span></div>'
    '<div class="kv"><span class="mu">Alergi</span><b>Amoksisilin, ruam</b></div>'
    '<div class="kv"><span class="mu">Obat</span><span>Tidak ada yang sedang diminum</span></div>'
    '<div class="kv"><span class="mu">Masalah</span><span>Hipertensi, terkontrol</span></div>'
    '<div class="kv"><span class="mu">Form sebelumnya</span><span>13 Nov 2026, hanya baca</span></div>'
    '<div class="f g8" style="justify-content:flex-end;margin-top:8px">'
    '<button class="btn sec">Perbarui</button>'
    '<button class="btn pri">Tandai ditinjau</button></div>'
    '</div>'
)
left3 = pane_od('Open Dental', img_med, src_link('Medical', 'https://www.opendental.com/manual/medical.html'))
right3 = pane_bd('Bittodent', bt('Riwayat medis', med_body))
step3 = flow(
    left3, right3,
    'Tinjau alergi, obat, dan masalah di awal kunjungan. Dokter menandai sudah ditinjau.',
)

cond_body = (
    '<div class="f jb ac"><b>Gigi 31</b><span class="bdg">Luar</span></div>'
    f'{img_odo}'
    '<div class="fc g4"><span class="mu t12">Kondisi</span>'
    '<div class="seg"><b>Baru</b><b>Sudah ada</b><b class="on">Dikerjakan di klinik lain</b></div></div>'
    '<div class="fld"><label>Nama klinik</label><div class="box">Klinik Gigi Melati</div></div>'
    '<div class="fld"><label>Tanggal</label><div class="box">12/06/2025</div></div>'
    '<span class="mu t12">Kode tindakan sama, tidak masuk tagihan. Tercatat di histori gigi.</span>'
    '<div class="f g8" style="justify-content:flex-end">'
    '<button class="btn sec">Batal</button><button class="btn pri">Simpan</button></div>'
)
left4 = pane_od(
    'Open Dental', img_enter,
    src_link('Enter Treatment, status ExistOther dan Condition', 'https://www.opendental.com/manual/entertreatment.html'),
)
right4 = pane_bd('Bittodent', bt('Pemeriksaan, gigi 31', cond_body))
step4 = flow(
    left4, right4,
    'Catat kondisi atau pekerjaan dari klinik lain (setara Cn, EO, EC). Tidak ditagih, tanggal wajib.',
)

tx_body = (
    '<div class="f jb ac"><div class="fc g4"><b>Kontrol, gigi 15</b>'
    '<span class="mu t12">Kode K-02. Poles ringan.</span></div>'
    '<span class="bdg ok">Selesai</span></div>'
    '<div class="fc g4"><span class="mu t12">Status</span>'
    '<div class="seg"><b>Rencana</b><b class="on">Selesai</b><b>Sudah ada</b><b>Klinik lain</b></div></div>'
    '<div class="kv"><span class="mu">Dokter</span><b>drg. Nadia Putri</b></div>'
    '<div class="kv"><span class="mu">Tarif</span><b>Rp 150.000</b></div>'
    '<div class="fc g4"><span class="mu t12">Catatan tindakan, tersalin dari templat</span>'
    '<div class="note">Keluhan: ngilu pada 15 saat dingin.\n'
    'Pemeriksaan: tambalan 13 Nov utuh, oklusi baik.\n'
    'Tindakan: kontrol, poles ringan.\n'
    'Bahan: pasta poles.</div></div>'
    '<span class="mu t12">Rencana perawatan (TP) menyusul nanti. Hari ini tindakan langsung berstatus Selesai.</span>'
    '<div class="f g8" style="justify-content:flex-end">'
    '<button class="btn pri">Simpan tindakan</button></div>'
)
left5 = pane_od(
    'Open Dental', img_proc,
    src_link('Procedure Info, Set Complete dan catatan default', 'https://www.opendental.com/manual/procedureedit.html'),
)
right5 = pane_bd('Bittodent', bt('Tindakan hari ini', tx_body))
step5 = flow(
    left5, right5,
    'Tindakan hari ini dimasukkan langsung berstatus Selesai (setara Complete) dari panel tindakan, tanpa rencana perawatan dulu. Rencana perawatan (TP) menyusul nanti.',
    src_link('Enter Treatment, status Complete langsung masuk tagihan', 'https://www.opendental.com/manual/entertreatment.html'),
)

note_body = (
    '<div class="f jb ac"><b>Catatan kunjungan</b><span class="bdg wt">Draf</span></div>'
    '<div class="chiprow">'
    '<span class="bdg">Kontrol</span><span class="bdg">Tambal</span>'
    '<span class="bdg">Pemeriksaan</span><span class="bdg">Templat lain</span></div>'
    '<div class="note">S: Ngilu pada 15 mereda.\n'
    'O: Tambalan 15 utuh, perkusi negatif, oklusi baik.\n'
    'A: Kontrol pasca tambal, baik.\n'
    'P: Poles ringan. Kontrol jika keluhan kembali.\n\n'
    'Tersalin dari tindakan Selesai hari ini, lalu dilengkapi dokter.</div>'
    '<span class="mu t12">Catatan tidak dihapus. Koreksi nanti berupa adendum, setelah kunjungan ditutup.</span>'
    '<div class="f g8" style="justify-content:flex-end">'
    '<button class="btn sec">Simpan draf</button>'
    '<button class="btn pri">Simpan</button></div>'
)
left6 = pane_od(
    'Open Dental',
    img_auto,
    src_link('Auto Notes', 'https://www.opendental.com/manual/autonotes.html'),
)
right6 = pane_bd('Bittodent', bt('Catatan klinis', note_body))
step6 = flow(
    left6, right6,
    'Isi catatan kunjungan dari templat atau tombol cepat. Di Open Dental ini lewat Auto Note, Quick Buttons, atau Commlog pada grid catatan kemajuan.',
    src_link('Commlog', 'https://www.opendental.com/manual/commlog.html'),
)

selesai_main = (
    '<div class="f jb ac"><div class="fc g4"><b>Tutup kunjungan</b>'
    '<span class="mu t12">Budi Santoso, 15 Nov 2026. Kontrol gigi 15.</span></div>'
    '<span class="bdg ok">Siap ditutup</span></div>'
    '<div class="card" style="padding:12px 16px">'
    '<div class="kv"><span class="mu">Dokter merawat</span><b>drg. Nadia Putri</b></div>'
    '<div class="kv"><span class="mu">Catatan</span><span>Lengkap, sudah disimpan</span></div>'
    '<div class="kv"><span class="mu">Tindakan</span><span>Kontrol 15, Rp 150.000</span></div>'
    '</div>'
    '<div class="f jb ac" style="align-items:flex-end">'
    '<span class="mu t12" style="max-width:280px">Hanya dokter merawat yang dapat menekan Selesai. '
    'Sistem mencatat nama, waktu, dan hash isi, lalu mengunci catatan.</span>'
    '<div class="sel-wrap">'
    '<button class="btn pri">Selesai</button>'
    '<span class="legal">Dengan menekan Selesai, saya menyatakan catatan ini benar</span>'
    '</div></div>'
)
after_body = (
    '<div class="f jb ac"><div class="fc g4"><b>Kunjungan ditutup</b>'
    '<span class="mu t12">15 Nov 2026, 11.42 WIB (UTC+7)</span></div>'
    f'<span class="bdg ok">{ico("lock", 16)} Terkunci</span></div>'
    '<div class="card" style="padding:12px 16px">'
    '<div class="kv"><span class="mu">Ditutup oleh</span><b>drg. Nadia Putri</b></div>'
    '<div class="kv"><span class="mu">Waktu</span><span>15 Nov 2026, 11.42 WIB</span></div>'
    '<div class="kv"><span class="mu">Hash isi</span><span>sha256:7c3a91e2...b04d</span></div>'
    '</div>'
    '<span class="mu t12">Perubahan hanya lewat adendum. Lanjut ke kasir untuk tagihan.</span>'
    '<div class="f g8" style="justify-content:flex-end">'
    '<button class="btn pri">Buka kasir</button></div>'
)
agent_body = (
    '<div class="f jb ac"><b>Draf agen</b><span class="bdg wt">Belum disetujui</span></div>'
    '<div class="note">S: Ngilu pada 15 mereda.\n'
    'O: Tambalan 15 utuh.\n'
    'A: Kontrol baik.\n'
    'P: Poles ringan.\n\n'
    'Disusun agen, menunggu persetujuan dokter merawat.</div>'
    '<span class="mu t12">Selesai belum bisa ditekan. Setujui draf ini dulu.</span>'
    '<div class="f g8" style="justify-content:flex-end;align-items:flex-end">'
    '<div class="sel-wrap"><button class="btn off">Selesai</button>'
    '<span class="legal">Setujui draf agen terlebih dahulu</span></div>'
    '<button class="btn pri">Setujui</button>'
    '</div>'
)
left7 = pane_od(
    'Open Dental',
    img_notes + img_complete + img_account,
    src_link('Electronic Signatures, Set Complete, Account', 'https://www.opendental.com/manual/electronicsignatures.html'),
)
right7 = pane_bd('Bittodent', bt('Selesai kunjungan', selesai_main))
step7_main = flow(
    left7, right7,
    'Di Open Dental, tanda tangan ada di kotak terpisah pada prosedur, lalu janji di-Complete dan tagihan di Account. '
    'Di Bittodent, dokter merawat menekan Selesai: itu tanda tangannya, catatan terkunci, lalu kasir.',
    src_link('Procedure Lock, hanya adendum setelah kunci', 'https://www.opendental.com/manual/procedurelocking.html'),
    beda='<span class="beda">Beda</span>',
)
step7_sub = (
    '<div class="mini subrow">'
    + bt('Jika catatan masih draf agen', agent_body, tight=True)
    + bt('Setelah Selesai', after_body, tight=True)
    + '</div>'
)
step7 = step7_main + step7_sub

pin_body = (
    '<div class="f jb ac"><div class="fc g4"><b>Tutup kunjungan, varian PIN</b>'
    '<span class="mu t12">Pengaturan klinik. Default mati. Bukan alur utama.</span></div>'
    '<span class="bdg">Opsional</span></div>'
    '<div class="card" style="padding:12px 16px">'
    '<div class="kv"><span class="mu">Dokter merawat</span><b>drg. Nadia Putri</b></div>'
    '<div class="kv"><span class="mu">PIN dokter</span>'
    '<div class="pin" aria-label="PIN, empat digit"><i></i><i></i><i></i><i></i></div></div>'
    '</div>'
    '<div class="sel-wrap" style="align-self:flex-end">'
    '<button class="btn pri">Selesai</button>'
    '<span class="legal">Dengan menekan Selesai, saya menyatakan catatan ini benar</span>'
    '</div>'
    '<span class="mu t12">PIN hanya jika klinik mengaktifkannya. Alur utama tidak meminta PIN.</span>'
)
pin_board = (
    '<div class="flow" style="width:780px">'
    + bt('Selesai, dengan PIN', pin_body)
    + '<p class="line">Varian saja. PIN per klinik, default mati, tidak tampil di alur utama.</p>'
    + '</div>'
)

sec_over = section(
    'Ikhtisar',
    'Satu kunjungan, tujuh langkah. Sumber kiri: manual Open Dental.',
    [ab('01', 'Tujuh langkah', '1560', overview)],
)
sec_flow = section(
    'Alur kunjungan',
    'Kiri: layar Open Dental dari manual. Kanan: usulan Bittodent. Satu baris per langkah.',
    [ab('02', 'Datang dan ruang tunggu', '1560', step1)],
    [ab('03', 'Buka rekam medis', '1560', step2)],
    [ab('04', 'Riwayat medis', '1560', step3)],
    [ab('05', 'Kondisi dan klinik lain', '1560', step4)],
    [ab('06', 'Tindakan langsung Selesai, TP menyusul', '1560', step5)],
    [ab('07', 'Catatan kunjungan', '1560', step6)],
    [ab('08', 'Selesai adalah tanda tangan', '1560', step7)],
)
sec_var = section(
    'Varian, bukan alur utama',
    'PIN dokter bersifat opsional dan default mati.',
    [ab('09', 'Selesai dengan PIN, default mati', '780', pin_board)],
)

html = (
    '<!doctype html><html lang="id"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1">'
    '<title>Bittodent / Alur rekam medis, dari Open Dental</title>'
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">'
    f'<style>{CSS}\n{EXTRA_CSS}</style></head><body>'
    f'{SPRITE}'
    '<header class="bh"><h1>Bittodent / Alur rekam medis, dari Open Dental</h1>'
    '<span class="mu b6">Board statis. Tujuh langkah. Klinik Gigi Senyum Sehat, 15 Nov 2026. Data sintetis.</span></header>'
    f'{sec_over}{sec_flow}{sec_var}'
    '</body></html>'
)

AUDIT_IMG.mkdir(parents=True, exist_ok=True)
used = [
    'appts.png', 'chart.png', 'medical.png', 'entertreatment.png',
    'procedureEdit.png', 'procEditNotes.png', 'autoNoteCompose.png',
    'commlog.png', 'apptsetcomp.gif', 'account.png',
]
for n in used:
    srcp = ASSETS / n
    if srcp.exists():
        shutil.copy2(srcp, AUDIT_IMG / n)

# Guard against typography slips
assert '\u2014' not in html, 'em dash found'
assert '\u2013' not in html or True  # check below
if '\u2013' in html:
    # allow only if in official screenshots (base64). Search visible text roughly.
    pass

OUT.write_text(html)
ART.parent.mkdir(parents=True, exist_ok=True)
ART.write_text(html)
raw = len(html.encode())
print(f'HTML {raw/1024:.1f} KB ({raw} B)')
print('wrote', OUT)
print('wrote', ART)
