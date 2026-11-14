#!/usr/bin/env python3
"""Papan desain odontogram 3D. Pakai render yang sudah ada, jangan menggambar gigi.
Hasil: design/boards/odontogram-3d.html dan /workspace/artifacts/bittodent-board-odontogram-3d.html
DATA SINTETIS. Tanpa JavaScript.
"""
from __future__ import annotations
import base64, io
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'design/boards/odontogram-3d.html'
ART = Path('/workspace/artifacts/bittodent-board-odontogram-3d.html')
CSS = Path('/tmp/board-base.css').read_text()
SPRITE = Path('/tmp/board-sprite.svg').read_text()

ODO = ROOT / 'design/odontogram'
BLEND = ODO / '3d-blender'
PREV = ODO / 'preview'
AUDIT3D = Path('/workspace/audit/after-3d')

def crop(im: Image.Image, box) -> Image.Image:
    return im.crop(box)

def load(path: Path) -> Image.Image:
    return Image.open(path).convert('RGBA')

def trim_white(im: Image.Image, bg=(250, 250, 250), pad=8) -> Image.Image:
    rgb = im.convert('RGB')
    bg_im = Image.new('RGB', rgb.size, bg)
    diff = ImageChops.difference(rgb, bg_im)
    bbox = diff.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    l = max(0, l - pad); t = max(0, t - pad)
    r = min(im.width, r + pad); b = min(im.height, b + pad)
    return im.crop((l, t, r, b))

def webp(im: Image.Image, q=76, scale=1.0, max_w=None) -> bytes:
    im = im.convert('RGBA')
    w, h = im.size
    if max_w and w > max_w:
        h = int(h * max_w / w); w = max_w
        im = im.resize((w, h), Image.Resampling.LANCZOS)
    elif scale != 1.0:
        im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    # flatten pale canvas for smaller files
    bg = Image.new('RGB', im.size, (255, 255, 255))
    if im.mode == 'RGBA':
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert('RGB')
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=q, method=6)
    return buf.getvalue()

def css_url(data: bytes) -> str:
    return 'url(data:image/webp;base64,' + base64.b64encode(data).decode() + ')'

def ico(name, size=20, cls=''):
    return f'<svg class="i{" i"+str(size) if size!=20 else ""}{(" "+cls) if cls else ""}" aria-hidden="true"><use href="#{name}"/></svg>'

# ---------- prepare images ----------
imgs = {}  # name -> (bytes, w, h)

def add(name, im, q=76, max_w=None):
    data = webp(im, q=q, max_w=max_w)
    # recover size after resize
    w, h = Image.open(io.BytesIO(data)).size
    imgs[name] = (data, w, h)
    print(f'  {name:16} {w:4}x{h:<4} {len(data)/1024:6.1f} KB')

print('compressing source renders…')

dewasa = load(AUDIT3D / '04b-odo3d-dewasa-v2.png')
add('dewasa', trim_white(dewasa), q=74, max_w=940)

sulung = load(AUDIT3D / '05b-odo3d-susu-v2.png')
add('sulung', trim_white(sulung), q=74, max_w=940)

campur = load(AUDIT3D / '06b-odo3d-campuran-v2.png')
add('campur', trim_white(campur), q=74, max_w=900)

cond = load(PREV / 'odontogram-3d-blender-conditions.png')
cond = cond.crop((16, 108, cond.width - 16, cond.height - 8))
add('legend', cond, q=72, max_w=1100)

st = load(PREV / 'odontogram-3d-blender-states.png')
st = st.crop((16, 108, st.width - 16, st.height - 8))
add('states', st, q=72, max_w=1200)

# surface close-ups: existing blender tooth stills
for key, rel in [
    ('mu-b', 'buccal/molar-upper@320.webp'),
    ('mu-o', 'occlusal/molar-upper@320.webp'),
    ('iu-b', 'buccal/incisor-upper@320.webp'),
    ('iu-o', 'occlusal/incisor-upper@320.webp'),
    ('ml-b', 'buccal/molar-lower@320.webp'),
    ('ml-o', 'occlusal/molar-lower@320.webp'),
]:
    im = load(BLEND / rel)
    add(key, im, q=80)

# crop surface examples from conditions (molar 16 row: O, B+D, O+M)
# conditions card after crop is ~1361 x 940; two rows (16 and 11)
# We'll also slice a few labeled columns if dimensions allow.
cw, ch = cond.size
# fallback: no extra crops if uncertain

total_img = sum(len(v[0]) for v in imgs.values())
print(f'images total {total_img/1024:.1f} KB')

# ---------- CSS for images (reuse via classes) ----------
img_css = '\n'.join(
    f'.g-{k}{{background-image:{css_url(d)};background-size:contain;background-repeat:no-repeat;background-position:center}}'
    for k, (d, w, h) in imgs.items()
)

extra_css = """
.scr.fit{background:#fff;flex-direction:column}
.scr.fit .pane{flex:1;width:100%;min-height:0}
.g{background-color:#fff}
.surf{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px;border:1px solid var(--bd);border-radius:16px;background:#fff;width:156px}
.surf .g{width:72px;height:120px}
.surf .g.oc{width:80px;height:80px}
.surf .lab{font-size:12px;font-weight:600;color:var(--mu);letter-spacing:.04em}
.pad{display:grid;grid-template-columns:40px 40px 40px;grid-template-rows:40px 40px 40px;gap:6px;justify-content:center;align-content:center}
.pad b{display:flex;align-items:center;justify-content:center;border:1px solid var(--n200);border-radius:10px;background:#fff;font-size:12px;font-weight:600;height:40px}
.pad b.on{background:var(--b);color:#fff;border-color:var(--b)}
.pad b:nth-child(1){grid-column:2;grid-row:1}
.pad b:nth-child(2){grid-column:1;grid-row:2}
.pad b:nth-child(3){grid-column:2;grid-row:2}
.pad b:nth-child(4){grid-column:3;grid-row:2}
.pad b:nth-child(5){grid-column:2;grid-row:3}
.ptabs{display:flex;gap:0;border-bottom:1px solid var(--bd)}
.ptabs span{padding:10px 16px;font-weight:600;color:var(--mu)}
.ptabs .on{color:var(--bh);border-bottom:2px solid var(--b)}
.segp{display:flex;padding:4px;gap:4px;border-radius:12px;background:var(--n50)}
.segp span{height:32px;padding:0 12px;display:flex;align-items:center;border-radius:9px;font-weight:600;font-size:13px;color:var(--n600)}
.segp .on{background:#fff;color:var(--b);box-shadow:inset 0 0 0 1px var(--bd)}
.note{font-size:12px;color:var(--mu)}
"""

# ---------- chrome helpers ----------
def sidebar(active='Rekam medis', compact=False):
    items = [('KLINIK', None), ('Jadwal saya', 'cal'), ('Rekam medis', 'file'), ('Pasien', 'users'), ('Pendapatan saya', 'chart')]
    clinic = '' if compact else '<div class="clinic"><b>Klinik Gigi Senyum Sehat</b><span class="t12 mu">Tebet, Jakarta Selatan</span></div>'
    out = f'<aside class="side{" cp" if compact else ""}"><div class="logo"><span class="lg">B</span>{"" if compact else "Bittodent"}</div>{clinic}'
    for n, ic in items:
        if ic is None:
            out += '' if compact else f'<div class="nlab">{n}</div>'
        else:
            out += f'<div class="nav{" on" if n==active else ""}">{ico(ic)}{"" if compact else n}</div>'
    return out + '</aside>'

def topbar():
    return (f'<header class="top"><div class="srch">{ico("search",16)}Cari pasien atau tagihan</div>'
            f'<span class="syn">DATA SINTETIS</span><div class="ma f ac g8"><span class="ib">{ico("bell")}</span>'
            f'<span class="av">NP</span><div class="fc"><b class="t14">drg. Nadia Putri</b><span class="t12 mu">Dokter gigi</span></div></div></header>')

def tabbar():
    items = [('Beranda','home'),('Jadwal','cal'),('Pasien','users'),('Rekam Medis','file')]
    return '<nav class="tabb">' + ''.join(
        f'<div class="{"on" if n=="Rekam Medis" else ""}">{ico(i,24)}{n}</div>' for n,i in items
    ) + '</nav>'

def ab(num, name, size_label, inner, w=None, h=None, cls=''):
    style = ''
    klass = f'scr {cls}' if cls else 'scr'
    if w and h and 'm' not in cls and 't' not in cls and 'd' not in cls:
        klass += ' fit'
        style = f' style="width:{w}px;height:{h}px"'
    return f'<div class="ab"><div class="cap">{num} {name}<span>{size_label}</span></div><div class="{klass}"{style}>{inner}</div></div>'

def section(title, sub, row_html):
    return f'<section class="bs"><h2>{title}<span>{sub}</span></h2><div class="br-row">{row_html}</div></section>'

def gap():
    return '<div class="gap"></div>'

# RM 8+4 body
def rm_desktop(compact=False):
    pad = '24px' if compact else '28px'
    chart = '<div class="g g-dewasa" style="flex:1;min-height:0;width:100%"></div>'
    panel = f"""<aside class="card fc g16" style="width:{'280px' if compact else '320px'};flex:none;padding:16px">
<div class="f jb ac"><b class="t18">Gigi 26</b><span class="bdg dg">Karies</span></div>
<div class="t12 mu">Molar kiri atas. Permukaan O.</div>
<div class="f jc"><div class="pad"><b>P</b><b>M</b><b class="on">O</b><b>D</b><b>B</b></div></div>
<div class="f g16 jc ac">
  <div class="g g-mu-b" style="width:56px;height:120px"></div>
  <div class="g g-mu-o" style="width:72px;height:72px"></div>
</div>
<div class="fc g4"><span class="t12 mu">Temuan</span><div class="f ac g8"><span class="bdg dg">Karies</span><span class="t12">Oklusal</span></div></div>
<span class="bdg wt" style="align-self:flex-start">Draft</span>
</aside>"""
    body = f"""<div class="f jb ac">
  <div class="fc g4"><span class="crumb">Pasien {ico('chev',16)} Budi Santoso</span>
  <div class="f ac g12"><span class="av l">BS</span><div class="fc"><h1 class="t28">Budi Santoso</h1><span class="mu">36 th, laki-laki. Penjamin Umum.</span></div></div></div>
</div>
<div class="ptabs"><span class="on">Rekam Medis</span><span>Profil</span><span>Keluarga</span></div>
<div class="card fc g12" style="flex:1;min-height:0;padding:16px">
  <div class="f jb ac wr g8">
    <b class="t18">Odontogram</b>
    <div class="f ac g8">
      <div class="segp"><span class="on">Tetap</span><span>Sulung</span><span>Campuran</span></div>
      <div class="segp"><span>2D</span><span class="on">3D</span></div>
    </div>
  </div>
  <div class="f g16" style="flex:1;min-height:0">{chart}{panel}</div>
</div>"""
    return f'{sidebar(compact=compact)}<div class="app">{topbar()}<main class="cnt" style="padding:{pad};gap:16px">{body}</main></div>'

def rm_phone():
    return f"""<header class="ph-h"><span class="lg">B</span><b class="w1">Budi Santoso</b><span class="syn">DATA SINTETIS</span></header>
<main class="ph-b" style="gap:10px;padding:12px 16px">
  <span class="t12 mu">36 th, Umum</span>
  <div class="ptabs"><span class="on">Rekam Medis</span><span>Profil</span></div>
  <div class="f jb ac">
    <b class="t18">Odontogram</b>
    <div class="segp"><span>2D</span><span class="on">3D</span></div>
  </div>
  <div class="segp" style="align-self:flex-start"><span class="on">Tetap</span><span>Sulung</span><span>Campuran</span></div>
  <div class="g g-dewasa" style="flex:1;min-height:220px;width:100%;border:1px solid var(--bd);border-radius:16px"></div>
  <div class="card p16 fc g8" style="padding:12px">
    <div class="f jb ac"><b>Gigi 26</b><span class="bdg dg">Karies</span></div>
    <div class="f ac jb">
      <div class="pad" style="transform:scale(.85);transform-origin:left center"><b>P</b><b>M</b><b class="on">O</b><b>D</b><b>B</b></div>
      <div class="g g-mu-o" style="width:56px;height:56px"></div>
    </div>
  </div>
</main>
{tabbar()}"""

# specimen panes
def pane(name, w, h):
    return f'<div class="pane g g-{name}" style="width:{w}px;height:{h}px"></div>'

# surface close-up inner (custom artboard)
def surfaces_inner():
    cells = [
        ('O', 'Oklusal, molar 16', 'mu-o', True),
        ('I', 'Insisal, insisor 11', 'iu-o', True),
        ('B', 'Bukal, molar 16', 'mu-b', False),
        ('P / L', 'Palatal atas, lingual bawah. Id: L.', 'mu-o', True),
        ('M', 'Mesial, ke garis tengah', 'mu-o', True),
        ('D', 'Distal, menjauh dari tengah', 'mu-o', True),
    ]
    # For M/D/P we only have occlusal/buccal cameras; show the same 3D still
    # with a short caption. Do not invent new tooth drawings.
    blocks = []
    for code, cap, img, oc in cells:
        gcls = 'g oc' if oc else 'g'
        blocks.append(
            f'<div class="surf"><div class="{gcls} g-{img}"></div>'
            f'<b>{code}</b><span class="lab c">{cap}</span></div>'
        )
    return f"""<div class="fc g16" style="padding:24px;flex:1">
<div class="fc g4"><b class="t18">Permukaan gigi</b>
<span class="note">Render Blender yang sama. Huruf P hanya label tampak di rahang atas; kode permukaan tetap L.</span></div>
<div class="f g12 wr">{''.join(blocks)}</div>
<div class="f ac g24" style="margin-top:8px">
  <div class="g g-mu-b" style="width:80px;height:200px"></div>
  <div class="g g-mu-o" style="width:120px;height:120px"></div>
  <div class="fc g8">
    <span class="t12 mu">Gigi 16, molar kanan atas</span>
    <div class="pad"><b>P</b><b>M</b><b class="on">O</b><b>D</b><b>B</b></div>
    <span class="bdg ok" style="align-self:flex-start">Sehat</span>
  </div>
</div>
</div>"""

# ---------- assemble ----------
# specimen artboard sizes = image size + padding 24*2
def fit_size(name, pad=24, extra_h=0):
    _, w, h = imgs[name]
    return w + pad * 2, h + pad * 2 + extra_h

dw, dh = fit_size('dewasa')
sw, sh = fit_size('sulung')
cw_, ch_ = fit_size('campur')
lw, lh = fit_size('legend')
stw, sth = fit_size('states')

row1 = ''.join([
    ab('1', 'Odontogram 3D dewasa', f'{dw}×{dh}', pane('dewasa', dw, dh), dw, dh),
    gap(),
    ab('2', 'Gigi sulung', f'{sw}×{sh}', pane('sulung', sw, sh), sw, sh),
])
row2 = ab('3', 'Gigi campuran', f'{cw_}×{ch_}', pane('campur', cw_, ch_), cw_, ch_)
row3 = ''.join([
    ab('4', 'Legenda kondisi', f'{lw}×{lh}', pane('legend', lw, lh), lw, lh),
    gap(),
    ab('5', 'State per gigi', f'{stw}×{sth}', pane('states', stw, sth), stw, sth),
])
row4 = ''.join([
    ab('6', 'Rekam Medis 8+4', '1440×900', rm_desktop(False), cls='d'),
    gap(),
    ab('7', 'Rekam Medis tablet', '1024×768', rm_desktop(True), cls='t'),
])
row5 = ab('8', 'Rekam Medis HP', '390×844', rm_phone(), cls='m')
row6 = ab('9', 'Close-up permukaan', '1100×720', surfaces_inner(), 1100, 720)

sections = [
    section('Bagan 3D', 'Render Blender. Data sintetis. Pandangan operator: kanan pasien di kiri bagan.', row1),
    section('Campuran', 'Gigi tetap dan sulung pada satu bagan.', row2),
    section('Legenda dan state', 'Warna plus bentuk. Kosong, draft, ditandatangani.', row3),
    section('Rekam Medis', 'Tata letak 8+4. Desktop 1440, tablet 1024, HP 390.', row4),
    section('Rekam Medis', 'HP 390×844. 3D dan pemilih permukaan terlihat penuh.', row5),
    section('Permukaan', 'O / I, B, P / L, M, D. Aset 3D yang sama, tanpa gambar ulang.', row6),
]

html = f"""<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bittodent / Odontogram 3D</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
{CSS}
{extra_css}
{img_css}
</style>
</head>
<body>
{SPRITE}
<header class="bh"><h1>Bittodent / Odontogram 3D</h1>
<span class="mu">Board statis. Render Blender yang sudah ada. Data sintetis. Sabtu 14 Nov 2026.</span></header>
{''.join(sections)}
</body>
</html>
"""

# guards
assert '—' not in html, 'em dash found'
assert 'script' not in html.lower() or '<script' not in html.lower()
# allow the word Javascript? we said no JS - check script tags
assert '<script' not in html.lower()

raw = html.encode()
print(f'HTML {len(raw)/1024:.1f} KB ({len(raw):,} B)')
if len(raw) > 2_000_000:
    raise SystemExit('over 2 MB, abort')
OUT.write_text(html)
ART.parent.mkdir(parents=True, exist_ok=True)
ART.write_text(html)
print(f'wrote {OUT}')
print(f'wrote {ART}')
