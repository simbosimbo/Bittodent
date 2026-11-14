#!/usr/bin/env python3
"""Generates design/system/index.html, design/boards/self-service.html, design/boards/kasir.html.
DATA SINTETIS. Standalone files: inline CSS, inline SVG, no JS. Run: python3 design/system/build.py"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOK = json.loads((ROOT / 'design/tokens.json').read_text())
C = TOK['color']
P, N = C['primary'], C['neutral']

# ---------- contrast ----------
def lum(h):
    h = h.lstrip('#'); r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True); return (la + 0.05) / (lb + 0.05)
def grade(r): return 'AA' if r >= 4.5 else ('AA besar' if r >= 3 else 'gagal')

assert ratio(C['muted'], C['canvas']) >= 4.5, ratio(C['muted'], C['canvas'])
assert ratio('#FFFFFF', C['brand']) >= 4.5
assert C['brand'] == P['700'] and C['brandHover'] == P['800']

# ---------- shared component CSS (same block in all three files) ----------
CSS = f"""
:root{{--b:{P['700']};--bh:{P['800']};--b9:{P['900']};--b3:{P['300']};--b2:{P['200']};--b1:{P['100']};--b0:{P['50']};
--n25:{N['25']};--n50:{N['50']};--n100:{N['100']};--n200:{N['200']};--n300:{N['300']};--n400:{N['400']};--n500:{N['500']};--n600:{N['600']};--n700:{N['700']};--n900:{N['900']};
--cv:{C['canvas']};--bd:{C['border']};--tx:{C['text']};--mu:{C['muted']};--sb:{C['sidebar']};
--sbg:{C['success']['bg']};--sbd:{C['success']['border']};--sfg:{C['success']['fg']};
--wbg:{C['warning']['bg']};--wbd:{C['warning']['border']};--wfg:{C['warning']['fg']};
--dbg:{C['danger']['bg']};--dbd:{C['danger']['border']};--dfg:{C['danger']['fg']};
--ibg:{C['info']['bg']};--ibd:{C['info']['border']};--ifg:{C['info']['fg']};
--rbg:{C['draft']['bg']};--rbd:{C['draft']['border']};--rfg:{C['draft']['fg']};
--fo:{TOK['shadow']['focus']};--ff:{TOK['font']['family']['sans']}}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font:14px/20px var(--ff);color:var(--tx);-webkit-font-smoothing:antialiased}}
table{{border-collapse:collapse;width:100%}}
.i{{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}}
.i24{{width:24px;height:24px}}.i16{{width:16px;height:16px}}.i32{{width:32px;height:32px}}
.t12{{font-size:12px;line-height:16px}}.t14{{font-size:14px;line-height:20px}}.t16{{font-size:16px;line-height:24px}}
.t18{{font-size:18px;line-height:26px;font-weight:700}}.t20{{font-size:20px;line-height:28px;font-weight:700}}.t24{{font-size:24px;line-height:32px;font-weight:700}}
.t28{{font-size:28px;line-height:36px;font-weight:700;letter-spacing:-.01em}}.t32{{font-size:32px;line-height:40px;font-weight:700;letter-spacing:-.01em}}
.t56{{font-size:56px;line-height:64px;font-weight:700}}
.mu{{color:var(--mu)}}.b6{{font-weight:600}}.b7{{font-weight:700}}.br{{color:var(--b)}}.ok{{color:var(--sfg)}}.er{{color:var(--dfg)}}
.num,.t28,.t32,.t56,.kp{{font-variant-numeric:tabular-nums}}.r{{text-align:right}}.c{{text-align:center}}
.up{{font-size:12px;line-height:16px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--mu)}}
.f{{display:flex}}.fc{{display:flex;flex-direction:column}}.ac{{align-items:center}}.ae{{align-items:flex-end}}.jb{{justify-content:space-between}}.jc{{justify-content:center}}
.w1{{flex:1;min-width:0}}.wr{{flex-wrap:wrap}}.ma{{margin-left:auto}}.as{{align-self:stretch}}
.g2{{gap:2px}}.g4{{gap:4px}}.g8{{gap:8px}}.g12{{gap:12px}}.g16{{gap:16px}}.g20{{gap:20px}}.g24{{gap:24px}}.g32{{gap:32px}}
.gd{{display:grid;gap:20px}}.c2{{grid-template-columns:1fr 1fr}}.c3{{grid-template-columns:repeat(3,1fr)}}.c4{{grid-template-columns:repeat(4,1fr)}}
.card{{background:#fff;border:1px solid var(--bd);border-radius:20px;padding:20px}}.p16{{padding:16px}}.p24{{padding:24px}}
.hr{{border-top:1px solid var(--bd)}}.hd{{border-top:1px dashed var(--n300)}}
.kv{{display:flex;justify-content:space-between;gap:12px}}.kv>:last-child{{text-align:right;font-variant-numeric:tabular-nums}}
.btn{{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;padding:0 18px;border-radius:12px;border:1px solid transparent;font:600 14px/20px var(--ff);white-space:nowrap}}
.btn.s{{height:36px;padding:0 14px}}.btn.l{{height:48px;padding:0 22px;font-size:16px}}.btn.xl{{height:64px;padding:0 32px;font-size:18px;border-radius:16px}}.btn.wf{{width:100%}}
.pri{{background:var(--b);color:#fff}}.pri.is-h{{background:var(--bh)}}
.sec{{background:#fff;color:var(--tx);border-color:var(--n200)}}.sec.is-h{{background:var(--n50)}}
.gh{{background:transparent;color:var(--b)}}.gh.is-h{{background:var(--b0)}}
.dan{{background:var(--dfg);color:#fff}}.dan.is-h{{background:#912018}}
.is-f{{box-shadow:var(--fo)}}
.btn.is-d{{background:var(--n100);color:var(--n500);border-color:transparent}}
.lab{{font-size:12px;line-height:16px;font-weight:600;color:var(--n700)}}
.fld{{display:flex;flex-direction:column;gap:6px}}
.inp{{display:flex;align-items:center;gap:8px;height:44px;padding:0 14px;border:1px solid var(--n200);border-radius:12px;background:#fff;font-size:14px;color:var(--tx)}}
.inp.l{{height:56px;font-size:20px;font-weight:700;letter-spacing:.08em}}
.inp .ph{{color:var(--mu)}}.inp.is-f{{border-color:var(--b)}}.inp.is-e{{border-color:var(--dfg)}}.inp.is-d{{background:var(--n50);color:var(--n500);border-color:var(--n100)}}
.hint{{font-size:12px;line-height:16px;color:var(--mu)}}.hint.er{{color:var(--dfg)}}
.otp{{display:flex;gap:8px}}.otp span{{flex:1;height:56px;min-width:40px;display:flex;align-items:center;justify-content:center;border:1px solid var(--n200);border-radius:12px;background:#fff;font-size:22px;font-weight:700}}
.otp .is-f{{border-color:var(--b)}}.otp.is-e span{{border-color:var(--dfg)}}
.chip{{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--n200);background:#fff;font-weight:600;white-space:nowrap}}
.chip.on{{background:var(--b0);border-color:var(--b);color:var(--b)}}.chip.off{{background:var(--n50);border-color:var(--n100);color:var(--n500);text-decoration:line-through}}
.slot{{height:44px;display:flex;align-items:center;justify-content:center;border:1px solid var(--n200);border-radius:12px;background:#fff;font-weight:600;font-variant-numeric:tabular-nums}}
.slot.on{{background:var(--b);border-color:var(--b);color:#fff}}.slot.off{{background:var(--n50);border-color:var(--n100);color:var(--n500);text-decoration:line-through}}
.day{{flex:1;height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid var(--n200);border-radius:12px;background:#fff}}
.day b{{font-size:18px;line-height:24px}}.day small{{font-size:12px;line-height:16px;color:var(--mu)}}
.day.on{{background:var(--b);border-color:var(--b);color:#fff}}.day.on small{{color:#fff}}.day.off{{background:var(--n50);border-color:var(--n100);color:var(--n500)}}.day.off b{{text-decoration:line-through}}
.svc{{display:flex;align-items:center;gap:12px;padding:8px 16px;min-height:44px;border:1px solid var(--n200);border-radius:12px;background:#fff}}
.svc.on{{border-color:var(--b);box-shadow:inset 0 0 0 1px var(--b);background:var(--b0)}}
.rad{{width:20px;height:20px;border-radius:50%;border:2px solid var(--n300);flex:none}}.on>.rad,.rad.on{{border:6px solid var(--b)}}
.stp{{display:flex;flex-direction:column;gap:8px}}.stp i{{display:flex;gap:4px}}.stp i b{{flex:1;height:4px;border-radius:2px;background:var(--n100)}}.stp i b.on{{background:var(--b)}}
.bdg{{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:999px;border:1px solid var(--n200);background:var(--n50);color:var(--n700);font-size:12px;font-weight:600;white-space:nowrap}}
.bdg.ok{{background:var(--sbg);border-color:var(--sbd);color:var(--sfg)}}.bdg.wt{{background:var(--wbg);border-color:var(--wbd);color:var(--wfg)}}
.bdg.dg{{background:var(--dbg);border-color:var(--dbd);color:var(--dfg)}}.bdg.in{{background:var(--ibg);border-color:var(--ibd);color:var(--ifg)}}
.bdg.dr{{background:var(--rbg);border-color:var(--rbd);color:var(--rfg)}}.bdg.sg{{background:var(--b0);border-color:var(--b2);color:var(--bh)}}
.dot:before{{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}}
.syn{{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;background:var(--wbg);color:var(--wfg);font-size:11px;font-weight:700;letter-spacing:.06em}}
.tbl th{{font-size:12px;line-height:16px;font-weight:600;color:var(--mu);text-align:left;padding:10px 12px;border-bottom:1px solid var(--bd);background:var(--n25)}}
.tbl td{{padding:12px;border-bottom:1px solid var(--bd);vertical-align:middle}}.tbl tr:last-child td{{border-bottom:0}}
.tbl .r{{text-align:right;font-variant-numeric:tabular-nums}}.tbl tfoot td{{font-weight:700;border-top:1px solid var(--bd);border-bottom:0}}
.pm{{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}}
.pm>div{{height:72px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:1px solid var(--n200);border-radius:12px;background:#fff;font-weight:600}}
.pm>div.on{{border-color:var(--b);box-shadow:inset 0 0 0 1px var(--b);background:var(--b0);color:var(--b)}}.pm.sm>div{{height:64px;font-size:12px}}
.kp{{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}}
.kp b{{height:56px;display:flex;align-items:center;justify-content:center;border:1px solid var(--n200);border-radius:12px;background:#fff;font-size:22px;font-weight:600}}
.kp.k64 b{{height:64px}}.kp b.is-h{{background:var(--n50)}}
.nom{{display:flex;flex-direction:column;gap:4px;padding:16px;border-radius:16px;background:var(--b0)}}.nom .t32{{color:var(--b9)}}
.toast{{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;background:var(--n900);color:#fff;font-weight:500}}.toast .i{{color:var(--b3)}}
.ban{{display:flex;gap:12px;align-items:flex-start;padding:12px 16px;border-radius:12px;border:1px solid}}
.ban.in{{background:var(--ibg);border-color:var(--ibd)}}.ban.in .i{{color:var(--ifg)}}.ban.wt{{background:var(--wbg);border-color:var(--wbd)}}.ban.wt .i{{color:var(--wfg)}}
.ban.ok{{background:var(--sbg);border-color:var(--sbd)}}.ban.ok .i{{color:var(--sfg)}}.ban.dg{{background:var(--dbg);border-color:var(--dbd)}}.ban.dg .i{{color:var(--dfg)}}
.scrim{{position:absolute;inset:0;background:rgba(22,33,43,.48);display:flex;align-items:center;justify-content:center}}
.modal{{background:#fff;border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:16px}}
.sheet{{position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:20px 20px 0 0;padding:12px 16px 16px;display:flex;flex-direction:column;gap:16px}}
.sheet:before{{content:"";align-self:center;width:40px;height:4px;border-radius:2px;background:var(--n200)}}
.side{{width:248px;flex:none;background:var(--sb);border-right:1px solid var(--bd);padding:16px 12px;display:flex;flex-direction:column;gap:2px}}
.side.cp{{width:72px;align-items:center}}
.nav{{display:flex;align-items:center;gap:12px;height:40px;padding:0 12px;border-radius:12px;color:var(--n600);font-weight:600}}
.nav.on{{background:var(--b1);color:var(--bh)}}.side.cp .nav{{width:48px;height:44px;padding:0;justify-content:center}}
.nlab{{padding:16px 12px 6px;font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--mu)}}
.logo{{display:flex;align-items:center;gap:10px;height:40px;padding:0 8px;margin-bottom:8px;font-weight:700;font-size:16px}}
.lg{{width:32px;height:32px;border-radius:10px;background:var(--b);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;flex:none}}
.top{{height:56px;flex:none;display:flex;align-items:center;gap:16px;padding:0 24px;background:#fff;border-bottom:1px solid var(--bd)}}
.srch{{display:flex;align-items:center;gap:8px;width:320px;height:36px;padding:0 12px;border-radius:12px;background:var(--cv);color:var(--mu)}}
.av{{width:32px;height:32px;border-radius:50%;background:var(--b1);color:var(--bh);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex:none}}
.av.l{{width:44px;height:44px;font-size:14px}}
.tabb{{height:64px;flex:none;display:flex;background:#fff;border-top:1px solid var(--bd)}}
.tabb div{{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:12px;font-weight:600;color:var(--mu)}}.tabb .on{{color:var(--b)}}
.empty{{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:32px}}
.ico{{width:56px;height:56px;border-radius:50%;background:var(--cv);color:var(--b);display:flex;align-items:center;justify-content:center;flex:none}}
.ico.ok{{background:var(--sbg);color:var(--sfg)}}.ico.dg{{background:var(--dbg);color:var(--dfg)}}.ico.l{{width:72px;height:72px}}
.sk{{height:12px;border-radius:6px;background:var(--n100)}}
.qr{{display:block;width:100%;height:100%;fill:var(--n900)}}
.qf{{padding:12px;background:#fff;border:1px solid var(--bd);border-radius:16px}}
.seg{{display:flex;padding:4px;gap:4px;border-radius:12px;background:var(--n50)}}.seg div{{flex:1;height:36px;display:flex;align-items:center;justify-content:center;gap:6px;border-radius:9px;font-weight:600;color:var(--n600)}}
.seg .on{{background:#fff;color:var(--b);box-shadow:inset 0 0 0 1px var(--bd)}}
.stepr{{display:flex;align-items:center;border:1px solid var(--n200);border-radius:12px;height:36px;background:#fff}}.stepr b{{width:36px;text-align:center;color:var(--b)}}.stepr span{{width:44px;text-align:center;font-weight:600;font-variant-numeric:tabular-nums}}
.paper{{background:#fff;border:1px solid var(--n200);font-size:12px;line-height:18px}}
"""

# ---------- icons (Lucide-style, stroke 2, 24 grid) ----------
ICONS = {
    'plus': '<path d="M5 12h14M12 5v14"/>', 'check': '<path d="M20 6 9 17l-5-5"/>',
    'chev': '<path d="m9 18 6-6-6-6"/>', 'chevd': '<path d="m6 9 6 6 6-6"/>', 'chevl': '<path d="m15 18-6-6 6-6"/>',
    'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    'cal': '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    'card': '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    'cash': '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    'qr': '<rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3M21 21v.01M12 7v3a2 2 0 0 1-2 2H7M3 12h.01M12 3h.01M12 16v.01M16 12h1M21 12v.01M12 21v-1"/>',
    'phone': '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
    'user': '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'x': '<path d="M18 6 6 18M6 6l12 12"/>',
    'xfer': '<path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/>',
    'split': '<path d="M16 3h5v5M8 3H3v5M12 22v-8.3a4 4 0 0 0-1.17-2.87L3 3M15 9l6-6"/>',
    'bksp': '<path d="M10 5a2 2 0 0 0-1.34.52l-6.33 5.74a1 1 0 0 0 0 1.48l6.33 5.74A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zM12 9l6 6M18 9l-6 6"/>',
    'home': '<path d="M3 10a2 2 0 0 1 .7-1.53l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 21v-8h6v8"/>',
    'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    'clock': '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    'file': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5M16 13H8M16 17H8M10 9H8"/>',
    'chart': '<path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"/>',
    'alert': '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    'lock': '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    'print': '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    'msg': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>',
    'undo': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    'load': '<path d="M21 12a9 9 0 1 1-6.22-8.56"/>',
    'scan': '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>',
    'menu': '<path d="M4 6h16M4 12h16M4 18h16"/>',
    'bell': '<path d="M10.3 21a2 2 0 0 0 3.4 0M3.3 15.3A1 1 0 0 0 4 17h16a1 1 0 0 0 .7-1.7C19.4 14 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.4 6-2.7 7.3"/>',
    'wallet': '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    'pct': '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    'dl': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    'mail': '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    'cog': '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    'shield': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
}

def qr_path(seed=7, n=25):
    """Synthetic QR-looking pattern (not a real code). Finder squares + LCG noise, merged per row run."""
    g = [[0] * n for _ in range(n)]
    x = seed
    for r in range(n):
        for c in range(n):
            x = (x * 1103515245 + 12345) & 0x7FFFFFFF
            g[r][c] = (x >> 16) & 1
    for (fr, fc) in ((0, 0), (0, n - 7), (n - 7, 0)):
        for r in range(-1, 8):
            for c in range(-1, 8):
                rr, cc = fr + r, fc + c
                if 0 <= rr < n and 0 <= cc < n:
                    edge = r in (0, 6) or c in (0, 6)
                    core = 2 <= r <= 4 and 2 <= c <= 4
                    g[rr][cc] = 1 if (0 <= r <= 6 and 0 <= c <= 6 and (edge or core)) else 0
    d = []
    for r in range(n):
        c = 0
        while c < n:
            if g[r][c]:
                s = c
                while c < n and g[r][c]: c += 1
                d.append(f'M{s} {r}h{c - s}v1h-{c - s}z')
            else:
                c += 1
    return ''.join(d)

def sprite():
    sy = ''.join(f'<symbol id="{k}" viewBox="0 0 24 24">{v}</symbol>' for k, v in ICONS.items())
    sy += f'<symbol id="qrc" viewBox="-1 -1 27 27"><path d="{qr_path()}"/></symbol>'
    return f'<svg width="0" height="0" style="position:absolute" aria-hidden="true">{sy}</svg>'

def I(n, s=20, cls=''):
    sz = {16: ' i16', 24: ' i24', 32: ' i32'}.get(s, '')
    return f'<svg class="i{sz}{cls}" aria-hidden="true"><use href="#{n}"/></svg>'

def QR(px, dim=False):
    st = f'width:{px}px;height:{px}px' + (';opacity:.25' if dim else '')
    return f'<svg class="qr" style="{st}" role="img" aria-label="QR contoh"><use href="#qrc"/></svg>'

FONT = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">')

def mini(s):
    s = re.sub(r'\s*\n\s*', '', s)
    s = re.sub(r'\s*([{};:,>])\s*', r'\1', s)
    return s.replace(';}', '}')

def page(title, extra_css, body):
    return (f'<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{title}</title>{FONT}<style>{mini(CSS + extra_css)}</style></head><body>{sprite()}{body}</body></html>')

def rp(v, sign=''):
    return f'{sign}Rp {v:,}'.replace(',', '.')

# =====================================================================
# 1. DESIGN SYSTEM DOCS
# =====================================================================
DS_CSS = """
body{background:var(--cv)}
.dnav{position:fixed;top:0;left:0;bottom:0;width:232px;background:#fff;border-right:1px solid var(--bd);padding:24px 16px;display:flex;flex-direction:column;gap:2px}
.dnav a{display:flex;align-items:center;height:36px;padding:0 12px;border-radius:10px;color:var(--n600);font-weight:600;text-decoration:none}
.dnav a:hover{background:var(--n50)}.dnav .h{padding:16px 12px 6px;font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--mu)}
.dmain{margin-left:232px;padding:40px 48px 96px;max-width:1360px}
.dsec{padding-top:48px;display:flex;flex-direction:column;gap:20px}
.dsec>h2{font-size:28px;line-height:36px;font-weight:700}.dsec h3{font-size:18px;line-height:26px;font-weight:700}
.frame{background:#fff;border:1px solid var(--bd);border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:16px}
.ann{font-size:11px;line-height:14px;font-weight:600;color:#6D28D9;font-family:ui-monospace,Menlo,monospace}
.sw{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.sw>div{border:1px solid var(--bd);border-radius:12px;overflow:hidden;background:#fff}
.sw i{display:flex;align-items:flex-end;height:72px;padding:8px 10px;font-style:normal;font-weight:700;font-size:13px}
.sw p{padding:8px 10px;font-size:12px;line-height:16px}.sw p b{display:block;font-size:13px}
.rule{display:flex;gap:16px;align-items:center;padding:16px 20px;border-radius:16px;background:var(--b0);border:1px solid var(--b2)}
.lad{display:flex;flex-direction:column;gap:8px}.lad div{display:flex;align-items:center;gap:16px}.lad span{width:40px;font-size:12px;color:var(--mu);font-variant-numeric:tabular-nums}
.lad b{height:16px;background:var(--b3);border-radius:4px}
.grd{position:relative;padding:0 24px;height:200px;background:var(--cv);border:1px solid var(--bd);border-radius:12px;display:grid;grid-template-columns:repeat(12,1fr);gap:20px}
.grd i{background:rgba(234,85,85,.12);border-left:1px solid rgba(234,85,85,.35);border-right:1px solid rgba(234,85,85,.35)}
.grd.t{grid-template-columns:repeat(8,1fr)}.grd.m{grid-template-columns:repeat(4,1fr);padding:0 16px;gap:16px;width:390px}
.st{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}.st>div{display:flex;flex-direction:column;gap:8px}
.ph{position:relative;overflow:hidden;border:1px solid var(--bd);border-radius:16px;background:var(--cv)}
.dhead{display:flex;align-items:center;gap:12px}
"""

def sw(name, hx, label=''):
    w = ratio('#FFFFFF', hx); t = ratio(C['text'], hx)
    if w >= t:
        fg, desc = '#FFFFFF', f'putih di {name}: {w:.2f}:1 {grade(w)}'
    else:
        fg, desc = C['text'], f'teks di {name}: {t:.2f}:1 {grade(t)}'
    return (f'<div><i style="background:{hx};color:{fg}">{label or name}</i>'
            f'<p><b>{hx}</b><span class="mu">{desc}</span></p></div>')

def ds():
    navs = [('foundations', 'Foundations'), ('color', 'Color'), ('type', 'Type'), ('space', 'Space'), ('grid', 'Grid'),
            ('radius', 'Radius'), ('icon', 'Icon'), ('components', 'Components')]
    comps = [('btn', 'Button'), ('input', 'Input'), ('chip', 'Chip & slot'), ('choice', 'Pilihan layanan'), ('badge', 'Badge'),
             ('table', 'Table'), ('pay', 'Pembayaran'), ('msg', 'Toast & banner'), ('overlay', 'Modal & sheet'),
             ('shell', 'Navigasi'), ('state', 'Empty & skeleton')]
    nav = ('<nav class="dnav"><div class="logo"><span class="lg">B</span>Bittodent</div>'
           + ''.join(f'<a href="#{a}">{b}</a>' for a, b in navs[:7]) + '<div class="h">COMPONENTS</div>'
           + ''.join(f'<a href="#{a}">{b}</a>' for a, b in comps) + '</nav>')

    brand = ''.join(sw(k, P[k], (k + (' Brand / action' if k == '700' else ' hover' if k == '800' else ' bukan tombol' if k == '500' else '')))
                    for k in P)
    neut = ''.join(sw(k, N[k]) for k in N)
    alias = ''.join(sw(k, C[k], k) for k in ('brand', 'canvas', 'border', 'text', 'muted', 'sidebar', 'surface'))
    sem = ''
    for k in ('success', 'warning', 'danger', 'info', 'draft'):
        v = C[k]; r = ratio(v['fg'], v['bg'])
        sem += (f'<div><i style="background:{v["bg"]};color:{v["fg"]};box-shadow:inset 0 -4px 0 {v["border"]}">{k}</i>'
                f'<p><b>{v["fg"]} / {v["bg"]}</b><span class="mu">fg di bg: {r:.2f}:1 {grade(r)}</span></p></div>')
    mr = ratio(C['muted'], C['canvas'])

    color = f"""
<section class="dsec" id="color"><h2>Color</h2>
<div class="rule">{I('info', 24, ' br')}<div><b>Brand / action = primary-700 {P['700']}. Hover = 800 {P['800']}.</b><div class="mu">500 {P['500']} hanya di skala. Tidak untuk tombol, chrome, atau focus ring.</div></div></div>
<div class="frame"><h3>Brand</h3><div class="sw">{brand}</div></div>
<div class="frame"><h3>Neutral</h3><div class="sw">{neut}</div></div>
<div class="frame"><h3>Alias</h3><div class="sw">{alias}</div><div class="ann">muted {C['muted']} di canvas {C['canvas']}: {mr:.2f}:1 {grade(mr)}</div></div>
<div class="frame"><h3>Semantic</h3><div class="sw">{sem}</div></div>
</section>"""

    types = [(12, 'Label', 'label', 'Nomor antrean'), (14, 'Body', 'body', 'Tambalan komposit, Rp 450.000'),
             (16, 'Clinical', 'clinical', 'Karies oklusal, gigi 36'), (18, 'Card title', 'title', 'Rincian tagihan'),
             (28, 'Page title', 'page', 'Antrean kasir'), (32, 'KPI', 'kpi', 'Rp 1.450.000')]
    ty = ''.join(f'<div class="f ac g24" style="padding:12px 0;border-bottom:1px solid var(--bd)"><div style="width:180px" class="fc g2">'
                 f'<b>{n}</b><span class="ann">font.size.{t} {s}px</span></div><div style="font-size:{s}px;line-height:1.3;font-weight:{700 if s >= 18 else 400}">{ex}</div></div>'
                 for s, n, t, ex in types)
    typ = f"""<section class="dsec" id="type"><h2>Type</h2><div class="frame">
<div class="f jb ac"><div class="t18">Plus Jakarta Sans</div><span class="ann">400 500 600 700, fallback Inter, Segoe UI, system-ui</span></div>{ty}
<div class="ann">Angka uang: tabular-nums. Display 56 hanya untuk nomor antrean.</div></div></section>"""

    lad = ''.join(f'<div><span>{v}</span><b style="width:{v * 4}px"></b><span class="ann">space.{k}</span></div>'
                  for k, v in [(1, 4), (2, 8), (3, 12), (4, 16), (5, 20), (6, 24), (8, 32), (10, 40), (12, 48), (16, 64)])
    spc = f'<section class="dsec" id="space"><h2>Space</h2><div class="frame"><div class="ann">Basis 4 px</div><div class="lad">{lad}</div></div></section>'

    grid = f"""<section class="dsec" id="grid"><h2>Grid</h2>
<div class="frame"><div class="f jb"><h3>Desktop 12 kolom</h3><span class="ann">gutter 20, padding 24, sidebar 248</span></div><div class="grd">{'<i></i>' * 12}</div></div>
<div class="gd c2"><div class="frame"><div class="f jb"><h3>Tablet 8 kolom</h3><span class="ann">gutter 20, padding 24</span></div><div class="grd t">{'<i></i>' * 8}</div></div>
<div class="frame"><div class="f jb"><h3>HP 4 kolom</h3><span class="ann">gutter 16, padding 16</span></div><div class="grd m">{'<i></i>' * 4}</div></div></div></section>"""

    rad = f"""<section class="dsec" id="radius"><h2>Radius</h2><div class="frame">
<div class="st"><div><div class="card" style="width:200px;height:120px"></div><span class="ann">radius.card 20</span></div>
<div><div class="inp" style="width:200px">Kontrol</div><span class="ann">radius.control 12</span></div>
<div><span class="chip on">Chip</span><span class="ann">pill 999</span></div></div>
<div class="rule">{I('info', 24, ' br')}<div><b>Tanpa bayangan. Elevasi = border 1 px {C['border']}. Canvas {C['canvas']}.</b><div class="mu">Bayangan hanya untuk focus ring: {TOK['shadow']['focus']}</div></div></div>
</div></section>"""

    show = ['plus', 'check', 'chev', 'search', 'cal', 'card', 'cash', 'qr', 'phone', 'user', 'x']
    names = {'chev': 'chevron', 'cal': 'calendar', 'card': 'credit-card', 'cash': 'banknote', 'qr': 'qr-code'}
    ic = ''.join(f'<div class="fc ac g8" style="width:96px">{I(k)}{I(k, 24)}<span class="ann">{names.get(k, k)}</span></div>' for k in show)
    icn = f'<section class="dsec" id="icon"><h2>Icon</h2><div class="frame"><div class="ann">Lucide-style, SVG inline, stroke 2, 20 dan 24</div><div class="f wr g16">{ic}</div></div></section>'

    def btnrow(v, label):
        cells = [('Default', ''), ('Hover', ' is-h'), ('Focus', ' is-f'), ('Disabled', ' is-d'), ('Loading', '')]
        out = ''
        for n, cl in cells:
            inner = (I('load', 16) + 'Memproses') if n == 'Loading' else label
            out += f'<div><button class="btn {v}{cl}">{inner}</button><span class="ann">{n}</span></div>'
        return f'<div class="st">{out}</div>'
    btn = f"""<section class="dsec" id="components"><h2>Components</h2></section>
<section class="dsec" id="btn" style="padding-top:8px"><h3>Button</h3><div class="frame">
{btnrow('pri', 'Bayar')}{btnrow('sec', 'Batal')}{btnrow('gh', 'Kirim ulang')}{btnrow('dan', 'Void')}
<div class="hr"></div><div class="st ae">
<div><button class="btn pri s">Simpan</button><span class="ann">S 36×auto, tabel padat saja</span></div>
<div><button class="btn pri">Simpan</button><span class="ann">M 44×auto, bawaan</span></div>
<div><button class="btn pri l">Simpan</button><span class="ann">L 48×auto, CTA utama</span></div>
<div><button class="btn pri xl">Ketuk untuk mulai</button><span class="ann">XL 64, kios</span></div></div>
<div class="ann">radius 12. Sentuh min 44. S 32 terlalu kecil untuk sentuh, jadi S = 36 dan hanya di tabel desktop.</div></div></section>"""

    inp = f"""<section class="dsec" id="input"><h3>Input, select, OTP</h3><div class="frame"><div class="gd c3">
<div class="fld"><span class="lab">Nama lengkap</span><div class="inp"><span class="ph">Contoh: Ratna Dewi</span></div><span class="ann">Default 44, radius 12</span></div>
<div class="fld"><span class="lab">Nama lengkap</span><div class="inp is-f">Ratna Dewi Anggraini</div><span class="ann">Focus</span></div>
<div class="fld"><span class="lab">Nomor WhatsApp</span><div class="inp is-e">0800-000</div><span class="hint er">Nomor belum lengkap.</span></div>
<div class="fld"><span class="lab">Penjamin</span><div class="inp is-d">Umum</div><span class="ann">Disabled</span></div>
<div class="fld"><span class="lab">Mesin EDC</span><div class="inp">EDC Bank A<span class="ma">{I('chevd')}</span></div><span class="ann">Select</span></div>
<div class="fld"><span class="lab">Cari pasien</span><div class="inp">{I('search', 20)}Budi<span class="ma mu">{I('load', 16)}</span></div><span class="ann">Loading</span></div></div>
<div class="hr"></div><div class="gd c3">
<div class="fld"><span class="lab">Kode verifikasi</span><div class="otp"><span>3</span><span>8</span><span>1</span><span class="is-f">5</span><span></span><span></span></div><span class="ann">OTP 6 kotak, 56 tinggi</span></div>
<div class="fld"><span class="lab">Kode verifikasi</span><div class="otp is-e"><span>3</span><span>8</span><span>1</span><span>5</span><span>0</span><span>2</span></div><span class="hint er">Kode salah. Sisa 2 percobaan.</span></div>
<div class="fld"><span class="lab">Kode verifikasi</span><div class="otp"><span>3</span><span>8</span><span>1</span><span>5</span><span>0</span><span>2</span></div><span class="hint">{I('load', 16)} Memeriksa</span></div>
</div></div></section>"""

    chip = f"""<section class="dsec" id="chip"><h3>Chip dan slot waktu</h3><div class="frame"><div class="st">
<div><div class="f g8"><span class="chip">10%</span><span class="chip on">{I('check', 16)}15%</span><span class="chip off">20%</span></div><span class="ann">Chip 36, pill. Default, selected, disabled</span></div>
<div><div class="f g8" style="width:320px"><span class="slot w1">09.45</span><span class="slot on w1">09.00</span><span class="slot off w1">13.45</span></div><span class="ann">Slot 44, radius 12. Default, selected, terisi</span></div>
<div><div class="f g8" style="width:300px"><div class="day off"><small>Min</small><b>15</b></div><div class="day"><small>Sen</small><b>16</b></div><div class="day on"><small>Sel</small><b>17</b></div></div><span class="ann">Tanggal 60</span></div>
</div></div></section>"""

    choice = f"""<section class="dsec" id="choice"><h3>Pilihan layanan dan stepper</h3><div class="frame"><div class="gd c3">
<div class="fc g8"><div class="svc"><span class="rad"></span><div class="w1"><b>Konsultasi</b><div class="t12 mu">30 mnt</div></div><b class="num">Rp 100.000</b></div><span class="ann">Default, padding 12 16, radius 12</span></div>
<div class="fc g8"><div class="svc on"><span class="rad"></span><div class="w1"><b>Scaling</b><div class="t12 mu">40 mnt</div></div><b class="num">Rp 400.000</b></div><span class="ann">Selected, border 2 brand</span></div>
<div class="fc g8"><div class="stp"><span class="up">Langkah 2 dari 3</span><i><b class="on"></b><b class="on"></b><b></b></i></div><span class="ann">Stepper, bar 4</span></div>
</div></div></section>"""

    badge = f"""<section class="dsec" id="badge"><h3>Badge status</h3><div class="frame"><div class="f wr g12">
<span class="bdg ok dot">Online</span><span class="bdg wt">Menunggu</span><span class="bdg ok">Lunas</span><span class="bdg dr">Draft</span>
<span class="bdg sg">{I('lock', 16)}Ditandatangani</span><span class="bdg dg">Void</span><span class="bdg in">Check-in</span><span class="bdg">Tutup</span></div>
<span class="ann">24 tinggi, 12/600, pill. Warna = status, teks tetap ada.</span></div></section>"""

    table = f"""<section class="dsec" id="table"><h3>Table</h3><div class="frame"><table class="tbl">
<thead><tr><th>No. tagihan</th><th>Pasien</th><th>Metode</th><th>Status</th><th class="r">Total</th></tr></thead><tbody>
<tr><td class="num">TG-2026-11014-001</td><td>Budi Santoso</td><td>Saldo + Tunai</td><td><span class="bdg ok">Lunas</span></td><td class="r">Rp 800.000</td></tr>
<tr><td class="num">TG-2026-11014-002</td><td>Ratna Dewi Anggraini</td><td class="mu">-</td><td><span class="bdg wt">Menunggu</span></td><td class="r">Rp 400.000</td></tr>
<tr><td class="num">TG-2026-11014-004</td><td>Joko Wijaya</td><td>QRIS</td><td><span class="bdg ok">Lunas</span></td><td class="r">Rp 400.000</td></tr>
</tbody></table><span class="ann">Header 12/600 muted, baris 44+, angka rata kanan</span></div></section>"""

    pay = f"""<section class="dsec" id="pay"><h3>Metode bayar, keypad, nominal</h3><div class="frame"><div class="gd" style="grid-template-columns:1.4fr 1fr">
<div class="fc g16">{pm('Tunai')}<span class="ann">Tile 72, radius 12. Ikon + label saja</span>
<div class="nom"><span class="lab">Nominal</span><span class="t32">Rp 600.000</span></div><span class="ann">KPI 32, tabular</span></div>
<div class="fc g8">{keypad()}<span class="ann">Tombol 56 (HP), 64 (desktop)</span></div></div></div></section>"""

    msg = f"""<section class="dsec" id="msg"><h3>Toast dan banner</h3><div class="frame"><div class="gd c2">
<div class="fc g12">{ban('in', 'info', 'Tagihan dikirim ke WhatsApp pasien.')}{ban('wt', 'alert', 'Di atas Rp 500.000 perlu PIN pemilik.')}
{ban('ok', 'check', 'Shift dibuka. Kas awal Rp 500.000.')}{ban('dg', 'alert', 'QR sudah tidak berlaku.')}</div>
<div class="fc g12"><div class="toast">{I('check')}Pembayaran diterima<span class="ma b6" style="color:var(--b3)">Lihat</span></div><span class="ann">Toast: n900, 4 dtk, bawah tengah</span></div>
</div></div></section>"""

    overlay = f"""<section class="dsec" id="overlay"><h3>Modal dan sheet</h3><div class="f g24 wr">
<div class="ph" style="width:640px;height:420px"><div class="scrim"><div class="modal" style="width:420px">
<div class="f jb ac"><span class="t18">Persetujuan pemilik</span>{I('x')}</div><div class="mu">Minta Rina Kusuma memasukkan PIN.</div>
<div class="otp"><span>•</span><span>•</span><span>•</span><span class="is-f">•</span><span></span><span></span></div>
<div class="f g12"><button class="btn sec w1">Kembali</button><button class="btn pri w1">Setujui</button></div></div></div></div>
<div class="ph" style="width:300px;height:420px"><div class="scrim" style="align-items:flex-end"></div><div class="sheet">
<span class="t18">Bayar di meja depan</span><div class="mu">Tunai atau EDC. Tunjukkan kode ini.</div><b class="t24 c">TG-2026-11014-001</b><button class="btn sec wf">Tutup</button></div></div>
</div><span class="ann">Modal 420 lebar, radius 20, padding 24. Sheet radius 20 atas. Scrim n900 48%.</span></section>"""

    shell = f"""<section class="dsec" id="shell"><h3>Sidebar, top bar, bottom bar</h3><div class="f g24 wr ae">
<div class="ph f" style="width:760px;height:420px">{sidebar(KASIR_NAV, 'Kasir')}<div class="w1 fc">{topbar('Sari Front Desk', 'Kasir', 'SF')}<div class="fc g12" style="padding:24px"><div class="sk" style="width:40%;height:20px"></div><div class="sk" style="width:70%"></div></div></div></div>
<div class="ph fc" style="width:300px;height:420px"><div class="w1"></div>{tabbar()}</div></div>
<span class="ann">Sidebar 248 (ringkas 72), item 40, aktif primary-100. Top bar 56. Bottom bar 64.</span></section>"""

    state = f"""<section class="dsec" id="state"><h3>Empty state dan skeleton</h3><div class="gd c2">
<div class="frame"><div class="empty"><span class="ico">{I('file', 24)}</span><b class="t18">Belum ada tagihan</b><span class="mu">Tagihan muncul setelah tindakan ditandatangani.</span></div></div>
<div class="frame">{''.join(f'<div class="f g12 ac"><div class="sk" style="width:44px;height:44px;border-radius:50%"></div><div class="fc g8 w1"><div class="sk" style="width:{w}%"></div><div class="sk" style="width:{w - 25}%"></div></div><div class="sk" style="width:72px"></div></div>' for w in (70, 55, 80))}</div>
</div></section>"""

    head = f"""<header class="dhead" id="foundations"><div class="fc g4 w1"><span class="up">Foundations dan components</span><h1 class="t32">Bittodent design system</h1>
<span class="mu">Sumber: design/tokens.json</span></div><span class="syn">DATA SINTETIS</span></header>"""
    body = nav + '<main class="dmain">' + head + color + typ + spc + grid + rad + icn + btn + inp + chip + choice + badge + table + pay + msg + overlay + shell + state + '</main>'
    return page('Bittodent design system', DS_CSS, body)

# ---------- shared building blocks ----------
def ban(kind, icon, text, sub=''):
    s = f'<div class="t12 mu">{sub}</div>' if sub else ''
    return f'<div class="ban {kind}">{I(icon)}<div class="w1"><div>{text}</div>{s}</div></div>'

def pm(on='Tunai', small=False):
    items = [('Tunai', 'cash'), ('QRIS', 'qr'), ('EDC', 'card'), ('Transfer', 'xfer'), ('Split', 'split')]
    return f'<div class="pm{" sm" if small else ""}">' + ''.join(
        f'<div class="{"on" if n == on else ""}">{I(i, 24)}{n}</div>' for n, i in items) + '</div>'

def keypad(lg=False, h=None):
    st = f' style="height:{h}px"' if h else ''
    keys = [str(k) for k in range(1, 10)] + ['000', '0', I('bksp', 24)]
    return f'<div class="kp{" k64" if lg else ""}">' + ''.join(f'<b{st}>{k}</b>' for k in keys) + '</div>'

KASIR_NAV = [('KLINIK', None), ('Beranda', 'home'), ('Jadwal', 'cal'), ('Pasien', 'users'), ('Kasir', 'wallet'), ('Pendapatan saya', 'chart'),
             ('KEUANGAN', None), ('Laporan kasir', 'file'), ('Keuangan', 'chart'), ('Audit', 'shield'), ('Tarif', 'cog')]
FO_NAV = [('Pengecualian', 'alert'), ('Antrean', 'users'), ('Jadwal', 'cal'), ('Laporan', 'file')]
DOC_NAV = [('KLINIK', None), ('Jadwal saya', 'cal'), ('Rekam medis', 'file'), ('Pasien', 'users'), ('Pendapatan saya', 'chart')]

def sidebar(items, active, compact=False):
    out = f'<aside class="side{" cp" if compact else ""}"><div class="logo"><span class="lg">B</span>{"" if compact else "Bittodent"}</div>'
    for n, ic in items:
        if ic is None:
            out += '' if compact else f'<div class="nlab">{n}</div>'
        else:
            out += f'<div class="nav{" on" if n == active else ""}" title="{n}">{I(ic)}{"" if compact else n}</div>'
    return out + '</aside>'

def topbar(name, role, ini, left=None):
    lft = left or f'<div class="srch">{I("search", 16)}Cari pasien atau tagihan</div>'
    return (f'<header class="top">{lft}<span class="syn">DATA SINTETIS</span><div class="ma f ac g12">{I("bell")}'
            f'<span class="av">{ini}</span><div class="fc"><b class="t14">{name}</b><span class="t12 mu">{role}</span></div></div></header>')

def tabbar(active='Beranda'):
    items = [('Beranda', 'home'), ('Jadwal', 'cal'), ('Kasir', 'wallet'), ('Akun', 'user')]
    return '<nav class="tabb">' + ''.join(f'<div class="{"on" if n == active else ""}">{I(i, 24)}{n}</div>' for n, i in items) + '</nav>'

# =====================================================================
# BOARDS
# =====================================================================
BOARD_CSS = """
body{background:#D9DCE3;padding:40px 48px 96px;min-width:max-content}
.bh{display:flex;align-items:baseline;gap:16px;margin-bottom:8px}.bh h1{font-size:24px;line-height:32px}
.bs{margin-top:56px}.bs>h2{font-size:20px;line-height:28px;font-weight:700;color:#16212B}.bs>h2 span{font-size:13px;font-weight:600;color:#4D5A64;margin-left:12px}
.br-row{display:flex;align-items:center;gap:0;margin-top:24px}
.ab{display:flex;flex-direction:column;gap:8px;flex:none}
.cap{font-size:12px;line-height:16px;font-weight:600;color:#3B4752}.cap span{font-weight:500;color:#4D5A64;margin-left:8px}
.scr{position:relative;overflow:hidden;background:var(--cv);border:1px solid #B5BCC8;box-shadow:0 0 0 4px rgba(255,255,255,.35);display:flex}
.m{width:390px;height:844px;flex-direction:column}.t{width:1024px;height:768px}.d{width:1440px;height:900px}
.arw{flex:none;width:72px;display:flex;flex-direction:column;align-items:center;gap:4px;color:#4D5A64;font-size:11px;font-weight:600;padding-top:24px}
.arw svg{width:40px;height:16px;fill:none;stroke:#4D5A64;stroke-width:1.5}
.gap{flex:none;width:56px}
.ph-h{height:56px;flex:none;display:flex;align-items:center;gap:10px;padding:0 16px;background:#fff;border-bottom:1px solid var(--bd)}
.ph-h .lg{width:28px;height:28px;border-radius:8px;font-size:13px}
.ph-b{flex:1;min-height:0;overflow:hidden;padding:16px;display:flex;flex-direction:column;gap:12px}
.ph-f{flex:none;padding:12px 16px 16px;background:#fff;border-top:1px solid var(--bd);display:flex;flex-direction:column;gap:8px}
.app{flex:1;min-width:0;display:flex;flex-direction:column}
.cnt{flex:1;min-height:0;overflow:hidden;padding:24px;display:flex;flex-direction:column;gap:20px}
.k-top{height:72px;flex:none;display:flex;align-items:center;gap:12px;padding:0 32px;background:#fff;border-bottom:1px solid var(--bd)}
.cam{position:relative;width:280px;height:280px;border-radius:20px;background:var(--n900);display:flex;align-items:center;justify-content:center}
.cam:after{content:"";position:absolute;left:32px;right:32px;top:50%;height:2px;background:var(--b3)}
.cam i{position:absolute;width:40px;height:40px;border:4px solid #fff}
.kpi{display:flex;flex-direction:column;gap:4px}
.crumb{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--mu);font-weight:600}
"""

ARROW = '<svg viewBox="0 0 40 16"><path d="M0 8h37M31 2l6 6-6 6"/></svg>'

def ab(name, size_cls, inner, size_label=None):
    dims = {'m': '390×844', 't': '1024×768', 'd': '1440×900'}[size_cls]
    return f'<div class="ab"><div class="cap">{name}<span>{size_label or dims}</span></div><div class="scr {size_cls}">{inner}</div></div>'

def row(*items):
    """items: artboard html strings, or ('->', label) arrows, or '|' plain gap."""
    out = ''
    for it in items:
        if it == '|':
            out += '<div class="gap"></div>'
        elif isinstance(it, tuple):
            out += f'<div class="arw" style="align-self:center">{ARROW}{it[1]}</div>'
        else:
            out += it
    return f'<div class="br-row">{out}</div>'

def section(title, sub, rows):
    return f'<section class="bs"><h2>{title}<span>{sub}</span></h2>{"".join(rows)}</section>'

def board(title, sub, sections):
    head = f'<header class="bh"><h1>{title}</h1><span class="mu b6">{sub}</span></header>'
    return page(title, BOARD_CSS, head + ''.join(sections))

# ---------- phone chrome ----------
def phone(main, foot='', head=None):
    h = head or '<span class="lg">B</span><b class="w1">Klinik Gigi Senyum Sehat</b>'
    h += '<span class="syn">DATA SINTETIS</span>'
    f = f'<footer class="ph-f">{foot}</footer>' if foot else ''
    return f'<header class="ph-h">{h}</header><main class="ph-b">{main}</main>{f}'

def back(title):
    return f'{I("chevl", 24)}<b class="w1 t16">{title}</b>'

def kv(rows, cls='g8'):
    return f'<div class="fc {cls}">' + ''.join(f'<div class="kv"><span class="mu">{a}</span><span class="b6">{b}</span></div>' for a, b in rows) + '</div>'

def stepper(n):
    return f'<div class="stp"><span class="up">Langkah {n} dari 3</span><i>' + ''.join(f'<b class="{"on" if i < n else ""}"></b>' for i in range(3)) + '</i></div>'

def svc(name, meta, price, on=False):
    return f'<div class="svc{" on" if on else ""}"><span class="rad"></span><div class="w1"><b>{name}</b><div class="t12 mu">{meta}</div></div><b class="num">{price}</b></div>'

def days(items):
    return '<div class="f g8">' + ''.join(f'<div class="day {s}"><small>{d}</small><b>{n}</b></div>' for d, n, s in items) + '</div>'

def slots(items, cols=4):
    return f'<div class="gd" style="grid-template-columns:repeat({cols},1fr);gap:8px">' + ''.join(f'<div class="slot {s}">{t}</div>' for t, s in items) + '</div>'

# ---------- self-service screens ----------
def ss_booking():
    m = f"""{stepper(1)}<div class="fc g4"><h1 class="t20">Buat janji temu</h1>
<div class="f ac g8"><span class="av" style="width:24px;height:24px;font-size:10px">NP</span><span class="b6">drg. Nadia Putri</span><span class="mu t12">Dokter gigi umum</span></div></div>
<div class="fc g4"><b>Layanan</b>{svc('Pemeriksaan + konsultasi', '20 mnt', 'Rp 150.000')}{svc('Scaling', '40 mnt', 'Rp 400.000', True)}{svc('Tambalan komposit', '30 mnt', 'Rp 450.000')}{svc('Ekstraksi', '30 mnt', 'Rp 350.000')}{svc('Kontrol', '15 mnt, gratis 14 hari', 'Rp 0')}</div>
<div class="fc g8"><b>Tanggal</b>{days([('Sab', 14, 'off'), ('Min', 15, 'off'), ('Sen', 16, ''), ('Sel', 17, 'on'), ('Rab', 18, '')])}
<span class="t12 mu">14 Nov slot habis. 15 Nov tutup.</span></div>
<div class="fc g8"><b>Jam, Selasa 17 Nov</b>{slots([('09.00', 'on'), ('09.30', ''), ('10.00', ''), ('10.30', ''), ('11.00', ''), ('13.00', ''), ('13.30', 'off'), ('14.00', '')])}</div>"""
    f = '<div class="kv t14"><span class="mu">Scaling, Sel 17 Nov, 09.00</span><b>Rp 400.000</b></div><button class="btn pri l wf">Lanjut</button>'
    return phone(m, f)

def ss_data():
    m = f"""{stepper(2)}<div class="fc g4"><h1 class="t20">Data Anda</h1><span class="mu">Untuk janji Selasa 17 Nov, 09.00.</span></div>
<div class="fc g16">
<div class="fld"><span class="lab">Nama lengkap</span><div class="inp">Ratna Dewi Anggraini</div></div>
<div class="fld"><span class="lab">Tanggal lahir</span><div class="inp">03/12/1997<span class="ma mu">{I('cal')}</span></div></div>
<div class="fld"><span class="lab">Jenis kelamin</span><div class="seg"><div class="on">Perempuan</div><div>Laki-laki</div></div></div>
<div class="fld"><span class="lab">Nomor WhatsApp</span><div class="inp is-f">0800-000-0001</div></div>
<div class="fld"><span class="lab">Email (opsional)</span><div class="inp"><span class="ph">nama@contoh.id</span></div></div></div>
<div class="t12 mu">Tanpa NIK.</div>"""
    f = '<button class="btn pri l wf">Kirim kode</button>'
    return phone(m, f)

def ss_otp():
    m = f"""{stepper(3)}<div class="fc g4"><h1 class="t20">Masukkan kode</h1><span class="mu">Dikirim ke WhatsApp 0800-000-0001 (contoh).</span></div>
<div class="otp"><span>3</span><span>8</span><span>1</span><span>5</span><span>0</span><span class="is-f">2</span></div>
<div class="f jb ac"><span class="t12 mu">Kirim ulang dalam 0:42</span><button class="btn gh s">Ganti nomor</button></div>"""
    return phone(m, '<button class="btn pri l wf">Verifikasi</button>')

def ss_book_ok():
    m = f"""<div class="fc ac g8 c" style="padding-top:4px"><span class="ico ok">{I('check', 32)}</span><h1 class="t20">Janji temu terkonfirmasi</h1><span class="mu">Dikirim juga ke WhatsApp.</span></div>
<div class="card p16 fc ac g8"><div class="qf">{QR(148)}</div><span class="up">Kode booking</span><b class="t24" style="letter-spacing:.06em">SS-17-R4T</b><span class="t12 mu">Tunjukkan di kios saat datang.</span></div>
<div class="card p16">{kv([('Pasien', 'Ratna Dewi Anggraini'), ('Layanan', 'Scaling (40 mnt)'), ('Tanggal', 'Selasa, 17 Nov 2026'), ('Jam', '09.00 WIB'), ('Dokter', 'drg. Nadia Putri'), ('Biaya', 'Rp 400.000')])}</div>"""
    f = f'<div class="f g8"><button class="btn sec w1">{I("cal")}Kalender</button><button class="btn pri w1">Selesai</button></div>'
    return phone(m, f)

def queue_card(big=False):
    n = 't56' if not big else 't56'
    return f"""<div class="card fc ac g4 c"><span class="up">Nomor antrean</span><span class="{n} br">2</span>
<div class="gd c3 as" style="gap:8px;margin-top:8px">{''.join(f'<div class="fc g2" style="padding:8px;border-radius:12px;background:var(--cv)"><b class="t16">{a}</b><span class="t12 mu">{b}</span></div>' for a, b in [('1', 'dirawat'), ('±20 mnt', 'perkiraan'), ('Ke-2', 'posisi')])}</div></div>"""

def ss_queue():
    m = f"""<div class="fc g4"><h1 class="t20">Antrean Anda</h1><span class="mu">Selasa, 17 Nov 2026, 08.50</span></div>
{queue_card()}<div class="card p16">{kv([('Dokter', 'drg. Nadia Putri'), ('Layanan', 'Scaling'), ('Jam janji', '09.00 WIB')])}</div>
{ban('in', 'bell', 'Tunggu nama Anda dipanggil.', 'Diperbarui 08.50')}"""
    return phone(m, '<button class="btn sec l wf">Selesai</button>')

BILL_ITEMS = [('Tambalan komposit', 450000), ('Ekstraksi', 350000)]

def ss_bill():
    items = ''.join(f'<div class="kv"><span>{a}</span><span>{rp(b)}</span></div>' for a, b in BILL_ITEMS)
    m = f"""<div class="fc g4"><span class="t12 mu num">TG-2026-11014-001, 14 Nov 2026</span><div class="f jb ac"><h1 class="t20">Halo, Budi Santoso</h1><span class="bdg wt">Menunggu</span></div></div>
<div class="card p16 fc g12"><b class="t16">Rincian</b>{items}<div class="hr"></div>
<div class="kv"><span class="mu">Subtotal</span><span>Rp 800.000</span></div>
<div class="kv"><span class="mu">Saldo deposit dipakai</span><span>−Rp 200.000</span></div><div class="hr"></div>
<div class="kv ac"><b class="t16">Sisa bayar</b><span class="t24">Rp 600.000</span></div></div>
<span class="t12 mu">Catatan klinis tidak ditampilkan.</span>
{ban('in', 'clock', 'Berlaku sampai 15 Nov 2026, 20.10 WIB.', 'Sekali pakai.')}"""
    f = f'<button class="btn pri l wf">{I("qr")}Bayar Rp 600.000</button><span class="t12 mu c">Tunai atau EDC: bayar di meja depan.</span>'
    return phone(m, f)

def qris_card(failed=False):
    st = ('<span class="bdg dg">Kedaluwarsa</span><span class="t12 mu num">Berlaku 0.00</span>' if failed
          else '<span class="bdg wt dot">Menunggu</span><span class="t12 mu num">Berlaku 14.59</span>')
    over = f'<span style="position:absolute" class="ico dg l">{I("x", 32)}</span>' if failed else ''
    return f"""<div class="card p16 fc ac g8 c"><span class="up">Klinik Gigi Senyum Sehat</span><span class="t12 mu">NMID contoh</span>
<div class="qf f ac jc" style="position:relative">{QR(200, failed)}{over}</div><span class="t28">Rp 600.000</span>
<span class="t12 mu">QR contoh, tidak bisa dibayar.</span><div class="f ac g8">{st}</div></div>"""

def ss_qris():
    m = f"""<div class="fc g4"><h1 class="t20">Bayar dengan QRIS</h1><span class="t12 mu num">TG-2026-11014-001</span></div>
{qris_card()}"""
    return phone(m, '<button class="btn sec l wf">Hubungi FO</button>', back('Bayar'))

def ss_qris_fail():
    m = f"""<div class="fc g4"><h1 class="t20">Bayar dengan QRIS</h1><span class="t12 mu num">TG-2026-11014-001</span></div>
{qris_card(True)}{ban('dg', 'alert', 'QR sudah tidak berlaku.', 'Tagihan belum dibayar.')}"""
    f = f'<button class="btn pri l wf">{I("undo")}Buat QR baru</button><button class="btn sec wf">Hubungi FO</button>'
    return phone(m, f, back('Bayar'))

def receipt_public():
    rows = lambda r: ''.join(f'<div class="kv"><span class="mu">{a}</span><span>{b}</span></div>' for a, b in r)
    return f"""<div class="card p16 fc g8 t12"><div class="c"><b class="t14">Klinik Gigi Senyum Sehat</b><div class="mu">Jl. Tebet Raya No. 21, Jakarta Selatan</div></div><div class="hd"></div>
{rows([('No. tagihan', 'TG-2026-11014-001'), ('Waktu', '14/11/2026 20.31'), ('Pasien', 'Budi Santoso'), ('Dokter', 'drg. Nadia Putri')])}<div class="hd"></div>
<div class="kv"><span>Tambalan komposit</span><span>450.000</span></div><div class="kv"><span>Ekstraksi</span><span>350.000</span></div><div class="hd"></div>
{rows([('Subtotal', '800.000'), ('Saldo deposit', '−200.000'), ('QRIS', '600.000')])}<div class="kv b7 t14"><span>Sisa</span><span>0</span></div>
<div class="f jc"><span class="bdg ok" style="height:28px;font-size:13px;letter-spacing:.12em">LUNAS</span></div><div class="c mu">Terima kasih. Semoga lekas pulih.</div></div>"""

def ss_struk():
    m = f"""<div class="f ac g12"><span class="ico ok">{I('check', 24)}</span><div class="fc"><h1 class="t20">Pembayaran berhasil</h1><span class="mu">QRIS Rp 600.000</span></div></div>
{receipt_public()}<div class="f g8"><button class="btn sec w1">{I('dl', 16)}Unduh</button><button class="btn sec w1">{I('msg', 16)}WhatsApp</button><button class="btn sec w1">{I('mail', 16)}Email</button></div>"""
    f = f'<button class="btn pri l wf">{I("cal")}Buat janji kontrol</button><span class="t12 mu c">Gratis dalam 14 hari.</span>'
    return phone(m, f)

def ss_kontrol():
    m = f"""<div class="fc g4"><h1 class="t20">Janji kontrol</h1><span class="mu">Budi Santoso, drg. Nadia Putri</span></div>
{svc('Kontrol', '15 mnt', 'Rp 0', True)}
<div class="fc g8"><b>Tanggal</b>{days([('Sen', 16, ''), ('Sel', 17, ''), ('Rab', 18, 'on'), ('Kam', 19, ''), ('Jum', 20, '')])}</div>
<div class="fc g8"><b>Jam, Rabu 18 Nov</b>{slots([('09.00', ''), ('09.30', ''), ('10.00', 'on'), ('10.30', ''), ('11.00', 'off'), ('13.00', ''), ('13.30', ''), ('14.00', '')])}</div>"""
    f = '<div class="kv"><span class="mu">Kontrol, Rab 18 Nov, 10.00</span><b>Rp 0</b></div><button class="btn pri l wf">Konfirmasi</button>'
    return phone(m, f, back('Janji kontrol'))

def ss_kontrol_ok():
    m = f"""<div class="fc ac g8 c" style="padding-top:24px"><span class="ico ok l">{I('check', 32)}</span><h1 class="t20">Janji kontrol terkonfirmasi</h1><span class="mu">Pengingat via WhatsApp H-1.</span></div>
<div class="card p16">{kv([('Layanan', 'Kontrol (15 mnt)'), ('Tanggal', 'Rabu, 18 Nov 2026'), ('Jam', '10.00 WIB'), ('Dokter', 'drg. Nadia Putri'), ('Biaya', 'Rp 0'), ('Kode booking', 'SS-18-B6D')], 'g12')}</div>"""
    f = f'<div class="f g8"><button class="btn sec w1">Ubah jadwal</button><button class="btn pri w1">{I("cal")}Kalender</button></div>'
    return phone(m, f)

def ss_expired():
    m = f"""<div class="empty w1"><span class="ico l">{I('clock', 32)}</span><span class="bdg dg">Kedaluwarsa</span><h1 class="t20">Tautan tidak berlaku</h1><span class="mu">Sudah lewat 24 jam.</span></div>"""
    return phone(m, f'<button class="btn pri l wf">{I("msg")}Minta tautan baru</button>')

# ---------- kiosk ----------
def kiosk(main):
    h = ('<div class="k-top"><span class="lg">B</span><div class="fc"><b class="t16">Klinik Gigi Senyum Sehat</b><span class="t12 mu">Kios check-in</span></div>'
         '<span class="syn" style="margin-left:16px">DATA SINTETIS</span><div class="ma fc ae"><b class="t18 num">08.50</b><span class="t12 mu">Selasa, 17 Nov 2026</span></div></div>')
    return f'<div class="app">{h}<main class="w1 fc" style="padding:32px 48px;gap:24px;overflow:hidden">{main}</main></div>'

def k_idle():
    return kiosk(f"""<div class="w1 fc ac jc g24 c"><span class="lg" style="width:80px;height:80px;border-radius:24px;font-size:36px">B</span>
<div class="fc g4"><span class="t20 mu" style="font-weight:500">Selamat datang di</span><span class="t32">Klinik Gigi Senyum Sehat</span></div>
<button class="btn pri xl" style="width:400px">Ketuk untuk mulai</button>
<div class="f g12"><span class="chip">{I('scan', 16)}Check-in</span><span class="chip">{I('cal', 16)}Daftar janji</span><span class="chip">{I('users', 16)}Lihat antrean</span></div></div>""")

def k_checkin():
    corners = ''.join(f'<i style="{p}"></i>' for p in ['top:24px;left:24px;border-width:4px 0 0 4px', 'top:24px;right:24px;border-width:4px 4px 0 0',
                                                      'bottom:24px;left:24px;border-width:0 0 4px 4px', 'bottom:24px;right:24px;border-width:0 4px 4px 0'])
    return kiosk(f"""<div class="fc g4"><h1 class="t28">Check-in</h1><span class="mu t16">Scan QR atau ketik kode booking.</span></div>
<div class="gd c2 w1" style="gap:24px"><div class="card p24 fc ac jc g16"><div class="cam">{corners}</div><b class="t16">Arahkan QR ke kamera</b></div>
<div class="card p24 fc g16"><b class="t18">Ketik kode</b><div class="fld"><span class="lab">Kode booking</span><div class="inp l is-f">SS-17-R4T</div><span class="hint">Ada di WhatsApp konfirmasi.</span></div>
<div class="w1"></div><button class="btn pri xl wf">Check-in</button><button class="btn sec l wf">Daftar janji baru</button></div></div>""")

def k_queue():
    return kiosk(f"""<div class="w1 gd c2" style="gap:24px;align-items:center"><div class="fc g16"><span class="ico ok l">{I('check', 32)}</span>
<h1 class="t32">Check-in berhasil, Ratna D.</h1><span class="t16 mu">Tunggu nama Anda dipanggil.</span>
<div class="card p16">{kv([('Dokter', 'drg. Nadia Putri'), ('Layanan', 'Scaling'), ('Jam janji', '09.00 WIB')], 'g12')}</div></div>
<div class="fc g16">{queue_card(True)}<button class="btn pri xl wf">Selesai</button><span class="t12 mu c">Kembali ke awal dalam 10 detik.</span></div></div>""")

# ---------- FO ----------
def staff(nav, active, name, role, ini, content, compact=False, dim=None):
    s = sidebar(nav, active, compact) + f'<div class="app">{topbar(name, role, ini)}<main class="cnt">{content}</main></div>'
    if dim:
        s += f'<div class="scrim">{dim}</div>'
    return s

def kpi_card(label, val, sub='', cls='t32'):
    s = f'<span class="t12 mu">{sub}</span>' if sub else ''
    return f'<div class="card p16 kpi"><span class="t12 b6 mu">{label}</span><span class="{cls}">{val}</span>{s}</div>'

def fo_row(ini, name, meta, amt, badge, actions):
    return (f'<div class="f ac g12" style="padding:12px 0"><span class="av l">{ini}</span><div class="w1 fc"><b>{name}</b><span class="t12 mu num">{meta}</span></div>'
            f'<b class="num">{amt}</b>{badge}<div class="f g8" style="width:224px;justify-content:flex-end">{actions}</div></div>')

def fo_panel():
    grp = lambda t, ic, r: f'<div class="fc"><div class="f ac g8 b6 mu t12">{I(ic, 16)}{t}</div>{r}</div>'
    T = '<button class="btn pri">Terima</button>'
    K = '<button class="btn sec">Kirim ulang</button>'
    return f"""<div class="f jb ae"><div class="fc g4"><h1 class="t28">Pengecualian</h1><span class="mu">Sabtu, 14 Nov 2026, 20.30 WIB</span></div></div>
<div class="gd c3">{kpi_card('Pengecualian terbuka', '3')}{kpi_card('Menunggu di kios', '0')}{kpi_card('Lunas QRIS hari ini', '9')}</div>
<div class="card fc g8">{grp('Tunai / EDC', 'cash', fo_row('SM', 'Siti Marlina', 'TG-2026-11014-005, minta tunai', 'Rp 150.000', '<span class="bdg wt">Menunggu</span>', T))}<div class="hr"></div>
{grp('Belum bayar', 'clock', fo_row('AR', 'Alya Rahmawati, 6 th', 'TG-2026-11014-003, menunggu 25 mnt', 'Rp 300.000', '<span class="bdg wt">Menunggu</span>', K + T))}<div class="hr"></div>
{grp('QRIS gagal', 'alert', fo_row('FP', 'Fajar Pratama', 'TG-2026-11014-002, kedaluwarsa 19.55', 'Rp 400.000', '<span class="bdg dg">Gagal</span>', K + T))}</div>"""

def fo_modal(method):
    if method == 'Tunai':
        body = f"""<div class="fld"><span class="lab">Uang diterima</span><div class="inp is-f num">Rp 200.000</div></div>
<div class="f g8"><span class="chip">Uang pas</span><span class="chip on">Rp 200.000</span><span class="chip">Rp 500.000</span></div>
<div class="kv ac" style="padding:12px 16px;border-radius:12px;background:var(--sbg)"><span class="ok b6">Kembalian</span><b class="t20 ok">Rp 50.000</b></div>"""
    else:
        body = f"""{ban('in', 'card', 'Tap kartu di mesin EDC.')}
<div class="fld"><span class="lab">Mesin EDC</span><div class="inp">EDC Bank A<span class="ma">{I('chevd')}</span></div></div>
<div class="fld"><span class="lab">No. referensi EDC</span><div class="inp is-f num">482915</div></div>"""
    seg = ''.join(f'<div class="{"on" if m == method else ""}">{I(i, 16)}{m}</div>' for m, i in [('Tunai', 'cash'), ('EDC', 'card')])
    return f"""<div class="modal" style="width:480px"><div class="f jb ac"><span class="t18">Terima pembayaran</span>{I('x', 24)}</div>
<div class="fc g4"><span class="mu">Siti Marlina, TG-2026-11014-005</span><span class="t32">Rp 150.000</span></div>
<div class="seg">{seg}</div>{body}<div class="f g12"><button class="btn sec w1">Batal</button><button class="btn pri w1">Konfirmasi lunas</button></div></div>"""

FO = lambda content, dim=None: staff(FO_NAV, 'Pengecualian', 'Sari Front Desk', 'FO', 'SF', content, True, dim)

def doc_discount():
    rm = lambda t, m: f'<div class="f ac g12" style="padding:12px 0"><div class="w1 fc"><b class="t16">{t}</b><span class="t12 mu">{m}</span></div><span class="bdg sg">{I("lock", 16)}Ditandatangani</span></div>'
    content = f"""<div class="card p16 f ac g16"><span class="av l">BS</span><div class="w1 fc"><b class="t18">Budi Santoso</b><span class="mu">36 th, laki-laki. RM-000123. Penjamin Umum.</span></div>
<div class="fc ae"><span class="t12 mu">Saldo deposit</span><b class="num">Rp 200.000</b></div><span class="bdg in">Kunjungan hari ini</span></div>
<div class="gd" style="grid-template-columns:1fr 520px;flex:1;min-height:0">
<div class="card fc g4"><div class="f jb ac"><b class="t18">Rekam medis ringkas</b><span class="t12 mu">14 Nov 2026</span></div>
{rm('Tambalan komposit 36-O', 'drg. Nadia Putri, 19.40')}<div class="hr"></div>{rm('Ekstraksi 48', 'drg. Nadia Putri, 20.05')}<div class="hr"></div>
<div class="f ac g12" style="padding:12px 0"><div class="w1 fc"><b class="t16">Temuan 46: hilang</b><span class="t12 mu">Temuan, bukan tindakan</span></div><span class="bdg">Tidak ditagih</span></div></div>
<div class="card fc g16"><div class="f jb ac"><b class="t18">Kasir ringkas</b><span class="bdg wt">Belum dikirim</span></div>
<div class="fc g8"><div class="kv"><span>Tambalan komposit 36-O</span><span>Rp 450.000</span></div><div class="kv"><span>Ekstraksi 48</span><span>Rp 350.000</span></div>
<div class="hr"></div><div class="kv"><span class="mu">Subtotal</span><span>Rp 800.000</span></div></div>
<div class="fld"><span class="lab">Diskon</span><div class="f g8"><span class="chip">Tanpa</span><span class="chip">5%</span><span class="chip">10%</span><span class="chip on">{I('check', 16)}15%</span></div></div>
<div class="fld"><span class="lab">Alasan, dicatat di audit</span><div class="f g8 wr"><span class="chip on">Pasien lama</span><span class="chip">Keringanan biaya</span><span class="chip">Kebijakan klinik</span></div></div>
<div class="fc g8"><div class="kv"><span class="mu">Diskon 15%</span><span>−Rp 120.000</span></div><div class="kv"><span class="mu">Saldo deposit dipakai</span><span>−Rp 200.000</span></div>
<div class="hr"></div><div class="kv ac"><b class="t16">Sisa bayar</b><span class="t32">Rp 480.000</span></div></div>
<div class="f g12" style="margin-top:auto"><button class="btn sec l">Serahkan ke FO</button><button class="btn pri l w1">{I('msg')}Kirim tagihan</button></div></div></div>"""
    return staff(DOC_NAV, 'Rekam medis', 'drg. Nadia Putri', 'Dokter gigi', 'NP', content)

def build_ss():
    A = [
        ab('1 Booking', 'm', ss_booking()), ab('2 Data', 'm', ss_data()), ab('3 OTP', 'm', ss_otp()),
        ab('4 Konfirmasi', 'm', ss_book_ok()), ab('5 Antrean', 'm', ss_queue()),
        ab('6 Tagihan', 'm', ss_bill()), ab('7 Bayar QRIS', 'm', ss_qris()), ab('8 QRIS gagal', 'm', ss_qris_fail()),
        ab('9 Struk', 'm', ss_struk()), ab('10a Kontrol', 'm', ss_kontrol()), ab('10b Kontrol OK', 'm', ss_kontrol_ok()),
        ab('11 Link kedaluwarsa', 'm', ss_expired()),
    ]
    K = [ab('12 Idle', 't', k_idle()), ab('13 Check-in', 't', k_checkin()), ab('14 Antrean', 't', k_queue())]
    F = [ab('15 Panel pengecualian', 't', FO(fo_panel())), ab('16 Bayar tunai', 't', FO(fo_panel(), fo_modal('Tunai'))),
         ab('17 Bayar EDC', 't', FO(fo_panel(), fo_modal('EDC')))]
    D = ab('18 Approval diskon', 'd', doc_discount())
    a = lambda t: ('->', t)
    secs = [
        section('Pasien', 'HP 390×844. Booking', [row(A[0], a('Lanjut'), A[1], a('Kirim kode'), A[2], a('Verifikasi'), A[3], a('Hari H'), A[4])]),
        section('Pasien', 'HP 390×844. Bayar', [row(A[5], a('Bayar'), A[6], a('Gagal'), A[7], '|', A[8], a('Kontrol'), A[9], a('Konfirmasi'), A[10], '|', A[11])]),
        section('Kiosk', 'Tablet 1024×768', [row(K[0], a('Ketuk'), K[1], a('Check-in'), K[2])]),
        section('FO', 'Tablet 1024×768', [row(F[0], a('Terima'), F[1], '|', F[2])]),
        section('Dokter', 'Desktop 1440×900', [row(D)]),
    ]
    return board('Bittodent / Layanan mandiri', 'Board statis. Jam beku Sabtu 14 Nov 2026, 20.30.', secs)

# ---------- kasir ----------
def K(content, active='Kasir', who=('Sari Front Desk', 'Kasir', 'SF'), compact=False, dim=None):
    return staff(KASIR_NAV, active, *who, content, compact, dim)

def title(t, sub, right='', crumb=''):
    c = f'<div class="crumb">{crumb}</div>' if crumb else ''
    return f'<div class="f jb ae g16"><div class="fc g4">{c}<h1 class="t28">{t}</h1><span class="mu">{sub}</span></div><div class="f g8">{right}</div></div>'

def crumb(*p):
    return f' {I("chev", 16)} '.join(p)

def wait_row(ini, name, meta, amt, saldo):
    return (f'<div class="f ac g12" style="padding:12px 0"><span class="av l">{ini}</span><div class="w1 fc"><div class="f ac g8"><b>{name}</b><span class="bdg wt">Menunggu bayar</span></div>'
            f'<span class="t12 mu">{meta}</span></div><div class="fc ae"><b class="num">{amt}</b><span class="t12 mu">Saldo {saldo}</span></div><button class="btn pri">Bayar</button></div>')

def k_antrean():
    c = f"""{title('Antrean kasir', 'Sabtu, 14 Nov 2026, 20.30 WIB. Cabang Tebet.')}
<div class="gd c4">{kpi_card('Menunggu bayar', '3', 'Total Rp 1.500.000')}{kpi_card('Lunas hari ini', '2', 'Tunai 1, QRIS 1')}{kpi_card('Sisa tagihan', '1', 'Rp 500.000')}{kpi_card('Diterima hari ini', 'Rp 850.000', '2 tagihan')}</div>
<div class="gd" style="grid-template-columns:1fr 380px;flex:1;min-height:0">
<div class="fc g20"><div class="card fc"><b class="t18">Daftar menunggu</b>
{wait_row('BS', 'Budi Santoso', '36 th, drg. Nadia Putri, TG-2026-11014-001. Tambalan komposit 36-O, Ekstraksi 48', 'Rp 600.000', 'Rp 200.000')}<div class="hr"></div>
{wait_row('RD', 'Ratna Dewi Anggraini', '29 th, drg. Arif Hidayat, TG-2026-11014-002. Scaling seluruh mulut', 'Rp 400.000', 'Rp 0')}<div class="hr"></div>
{wait_row('AR', 'Alya Rahmawati', '6 th, drg. Clara Wijaya, Sp.KGA, TG-2026-11014-003. Tambalan GIC 74-O', 'Rp 300.000', 'Rp 0')}</div>
<div class="card fc g12"><div class="f jb ac"><b class="t18">Lunas hari ini</b><span class="t12 mu">2 tagihan</span></div>
<div class="f ac g12"><span class="av">HG</span><div class="w1 fc"><b>Hendra Gunawan</b><span class="t12 mu">TG-2026-11014-005, Tunai 14.10</span></div><span class="bdg ok">Lunas</span><b class="num">Rp 450.000</b></div>
<div class="f ac g12"><span class="av">JW</span><div class="w1 fc"><b>Joko Wijaya</b><span class="t12 mu">TG-2026-11014-004, QRIS 11.25</span></div><span class="bdg ok">Lunas</span><b class="num">Rp 400.000</b></div></div></div>
<div class="fc g20"><div class="card fc g12"><div class="f jb ac"><b class="t18">Shift kasir</b><span class="bdg ok dot">Buka 08.00</span></div>
{kv([('Kas awal', 'Rp 500.000'), ('+ Tunai masuk (1)', 'Rp 450.000'), ('Non-tunai', 'Rp 400.000')])}<div class="hr"></div>
<div class="kv ac"><b>Uang di laci</b><span class="t20">Rp 950.000</span></div><div class="f g8"><button class="btn sec w1">Cek kas awal</button><button class="btn sec w1">Tutup shift</button></div></div>
<div class="card fc g12"><div class="f jb ac"><b class="t18">Sisa tagihan</b><span class="t12 mu">1 pasien</span></div>
<div class="f ac g12"><span class="av">DL</span><div class="w1 fc"><b>Dewi Lestari</b><span class="t12 mu">Jatuh tempo 21 Nov 2026</span></div><b class="num">Rp 500.000</b></div>
<div class="f g8"><button class="btn sec w1">{I('msg', 16)}Ingatkan WA</button><button class="btn pri w1">Terima sisa</button></div></div></div></div>"""
    return K(c)

def sum_card(cta=True, disc='Rp 0'):
    b = (f'<button class="btn pri l wf">Bayar Rp 600.000</button><button class="btn sec wf">{I("msg", 16)}Ingatkan WA</button>' if cta else '')
    return f"""<div class="card fc g16"><b class="t18">Ringkasan</b>{kv([('Subtotal', 'Rp 800.000'), ('Diskon (tanpa)', disc), ('Saldo deposit', '−Rp 200.000')], 'g12')}
<div class="hr"></div><div class="fc g4"><span class="t12 b6 mu">Sisa dibayar</span><span class="t32">Rp 600.000</span></div>{b}</div>"""

def k_tagihan():
    c = f"""{title('Tagihan Budi Santoso', 'TG-2026-11014-001, 14 Nov 2026', '<span class="bdg wt">Menunggu bayar</span>', crumb('Antrean kasir', 'Tagihan'))}
<div class="card p16 f ac g24"><span class="av l">BS</span><div class="fc"><b class="t16">Budi Santoso</b><span class="t12 mu">36 th, laki-laki</span></div>
{''.join(f'<div class="fc"><span class="t12 mu">{a}</span><b>{b}</b></div>' for a, b in [('Penjamin', 'Umum'), ('Dokter', 'drg. Nadia Putri'), ('No. tagihan', 'TG-2026-11014-001'), ('Saldo deposit', 'Rp 200.000')])}</div>
<div class="gd" style="grid-template-columns:1fr 400px;align-items:start"><div class="card fc g16"><div class="f jb ac"><b class="t18">Item tagihan</b><span class="bdg sg">{I('lock', 16)}Ditandatangani drg. Nadia Putri, 10.45</span></div>
<table class="tbl"><thead><tr><th>Tindakan</th><th>Gigi / permukaan (FDI)</th><th class="r">Qty</th><th class="r">Harga</th><th class="r">Jumlah</th></tr></thead><tbody>
<tr><td class="b6">Tambalan komposit</td><td class="num">36-O</td><td class="r">1</td><td class="r">Rp 450.000</td><td class="r">Rp 450.000</td></tr>
<tr><td class="b6">Ekstraksi gigi permanen</td><td class="num">48</td><td class="r">1</td><td class="r">Rp 350.000</td><td class="r">Rp 350.000</td></tr></tbody>
<tfoot><tr><td colspan="4">Subtotal</td><td class="r">Rp 800.000</td></tr></tfoot></table>
<div class="f ac g8 t12 mu">{I('info', 16)}Temuan tidak ditagih: 26-O karies, 46 hilang.</div><div class="hr"></div>
<div class="fld"><span class="lab">Diskon</span><div class="f g8"><span class="chip on">Tanpa</span><span class="chip">5%</span><span class="chip">10%</span><span class="chip">15%</span><span class="chip">Nominal</span></div>
<span class="hint">Batas kasir 10% atau Rp 100.000. Di atasnya PIN dokter.</span></div></div>{sum_card()}</div>"""
    return K(c)

def pay_left(compact=False):
    chips = ['Uang pas', '+50.000', '+100.000', '+200.000', '+500.000', '+1.000.000']
    ch = '<div class="f g8 wr">' + ''.join(f'<span class="chip{" on" if i == 0 else ""}">{x}</span>' for i, x in enumerate(chips)) + '<span class="chip">Ulang</span></div>'
    return f"""<div class="card p16 f jb ac"><div class="fc"><span class="t12 b6 mu">Sisa dibayar</span><span class="t28">Rp 600.000</span></div>
<span class="t12 mu r">Subtotal Rp 800.000<br>Deposit −Rp 200.000</span></div>
<div class="fc g8"><span class="lab">Metode</span>{pm('Tunai')}</div><div class="fc g8"><span class="lab">Pecahan</span>{ch}</div>
<div class="gd c2" style="gap:12px"><div class="nom"><span class="lab">Uang diterima</span><span class="t32">Rp 600.000</span></div>
<div class="nom" style="background:var(--sbg)"><span class="lab">Kembalian</span><span class="t32" style="color:var(--sfg)">Rp 0</span></div></div>"""

def k_bayar():
    c = f"""{title('Terima pembayaran', 'Budi Santoso, TG-2026-11014-001', '<button class="btn sec">' + I('chevl', 16) + 'Kembali</button>')}
<div class="gd" style="grid-template-columns:1fr 420px;flex:1;min-height:0"><div class="card fc g20">{pay_left()}</div>
<div class="card fc g16">{keypad(True)}<div class="w1"></div><button class="btn pri l wf" style="height:56px;font-size:18px">{I('check')}Terima Rp 600.000</button></div></div>"""
    return K(c)

def lunas_rincian():
    return f"""<div class="card fc g12"><b class="t18">Rincian</b>{kv([('Tambalan komposit', 'Rp 450.000'), ('Ekstraksi gigi permanen', 'Rp 350.000')], 'g8')}<div class="hr"></div>
{kv([('Subtotal', 'Rp 800.000'), ('Diskon (tanpa)', 'Rp 0'), ('Saldo deposit dipakai', '−Rp 200.000')], 'g8')}<div class="hr"></div>
<div class="kv"><b>Dibayar (Tunai)</b><b>Rp 600.000</b></div><span class="t12 mu">Sisa saldo deposit: Rp 0</span></div>"""

def k_lunas():
    c = f"""<div class="gd" style="grid-template-columns:1fr 420px;flex:1;min-height:0;align-items:start">
<div class="card p24 fc ac g16 c" style="padding:48px 24px"><span class="ico ok l">{I('check', 32)}</span><div class="fc g4"><b class="t18">Pembayaran diterima</b><span class="t32">Rp 600.000</span></div>
<span class="mu">Tunai, Budi Santoso, TG-2026-11014-001, 20.28</span><span class="mu">Uang diterima Rp 600.000. Kembalian Rp 0.</span>
<div class="f g8"><span class="bdg ok">Lunas</span><span class="bdg">{I('lock', 16)}Terkunci</span></div>
<div class="f g8"><button class="btn pri">{I('print')}Cetak struk</button><button class="btn sec">{I('msg')}WhatsApp</button><button class="btn sec">{I('mail')}Email</button></div>
<div class="hr as"></div><div class="f g8"><button class="btn gh">Lihat struk</button><button class="btn gh">{I('cal')}Buat janji</button><button class="btn gh" style="color:var(--dfg)">Void / Refund</button><button class="btn sec">Selesai</button></div></div>
{lunas_rincian()}</div>"""
    return K(c)

def receipt_80():
    r = lambda a, b: f'<div class="kv"><span>{a}</span><span>{b}</span></div>'
    return f"""<div class="paper fc g8" style="width:302px;padding:20px 16px"><div class="c"><b class="t14">Klinik Gigi Senyum Sehat</b><div>Jl. Tebet Raya No. 21, Jakarta Selatan</div></div>
<div class="c b7" style="letter-spacing:.2em">KUITANSI</div><div class="hd"></div>
{r('No.', 'TG-2026-11014-001')}{r('Tanggal', '14/11/2026 20.28')}{r('Kasir', 'Sari Front Desk')}{r('Pasien', 'Budi Santoso')}{r('Dokter', 'drg. Nadia Putri')}{r('Penjamin', 'Umum')}<div class="hd"></div>
<div><div>Tambalan komposit</div>{r('1 × 450.000', '450.000')}</div><div><div>Ekstraksi gigi permanen</div>{r('1 × 350.000', '350.000')}</div><div class="hd"></div>
{r('Subtotal', '800.000')}{r('Diskon', '0')}{r('Saldo deposit', '−200.000')}<div class="kv b7 t14"><span>Tunai</span><span>600.000</span></div>{r('Kembalian', '0')}
<div class="c b7" style="letter-spacing:.2em;margin-top:4px">LUNAS</div><div class="hd"></div><div class="c">Terima kasih. Semoga lekas pulih.</div>
<div class="c mu">Bukti pembayaran, bukan dokumen klinis.</div></div>"""

def k_struk():
    seg = '<div class="seg" style="width:260px"><div>58 mm</div><div class="on">80 mm</div><div>A5</div></div>'
    c = f"""{title('Pratinjau struk', 'TG-2026-11014-001, Budi Santoso', f'<button class="btn sec">{I("undo")}Void / Refund</button><button class="btn pri">{I("print")}Cetak</button>', crumb('Pembayaran Budi Santoso', 'Struk'))}
<div class="gd" style="grid-template-columns:1fr 360px;flex:1;min-height:0"><div class="card fc ac g16" style="background:var(--n50)"><div class="f g12 ac">{seg}<span class="chip">Tandai salinan</span></div>{receipt_80()}</div>
<div class="fc g20"><div class="card fc g12"><b class="t18">Kirim struk</b><button class="btn sec wf">{I('msg')}WhatsApp</button><button class="btn sec wf">{I('mail')}Email</button></div>
<div class="card fc g8"><b class="t18">Riwayat cetak</b><span>Cetak ulang ke-1</span><span class="t12 mu">14/11/2026 20.41, Sari Front Desk</span></div>
{ban('in', 'info', 'Tanpa nomor gigi dan catatan klinis.', 'Struk untuk pasien.')}</div></div>"""
    return K(c)

def refund_content():
    return f"""{title('Void / Refund', 'TG-2026-11014-001, Budi Santoso. Dibayar Rp 600.000 (Tunai) + deposit Rp 200.000', '', crumb('Pembayaran Budi Santoso', 'Void / Refund'))}
<div class="gd" style="grid-template-columns:1fr 420px;align-items:start"><div class="card fc g20">
<div class="fld"><span class="lab">Jumlah dikembalikan</span><div class="f g8"><span class="chip on">{I('check', 16)}Penuh</span><span class="chip">Rp 100.000</span><span class="chip">Rp 350.000</span><span class="chip">Nominal</span></div></div>
<div class="fld"><span class="lab">Alasan (wajib)</span><div class="inp">Kesalahan input<span class="ma">{I('chevd')}</span></div></div>
<div class="fld"><span class="lab">Catatan (opsional)</span><div class="inp"><span class="ph">Pasien salah, diganti tagihan baru</span></div></div>
<div class="fld"><span class="lab">Dikembalikan lewat</span><div class="inp is-d">{I('lock', 16)}Tunai dari laci<span class="ma t12">Mengikuti metode bayar asli</span></div></div>
{ban('wt', 'shield', 'Di atas Rp 500.000 perlu PIN pemilik.', 'Deposit tidak dihitung.')}
<div class="f g12"><button class="btn sec l">Batal</button><button class="btn dan l w1">Catat refund Rp 600.000</button></div></div>
<div class="card fc g12"><b class="t18">Dikembalikan</b>{kv([('Tunai dari laci', 'Rp 600.000'), ('Deposit kembali ke saldo pasien', 'Rp 200.000')], 'g12')}<div class="hr"></div>
<div class="kv"><b>Total</b><b>Rp 800.000</b></div><span class="t12 mu">Tagihan asli tetap tersimpan. Tercatat di audit.</span></div></div>"""

def k_refund():
    return K(refund_content())

def k_pin():
    m = f"""<div class="modal" style="width:440px"><div class="f jb ac"><span class="t18">Persetujuan pemilik</span>{I('x', 24)}</div>
<span class="mu">Minta Rina Kusuma (pemilik) memasukkan PIN.</span>
<div class="card p16" style="background:var(--cv)">{kv([('Refund tunai', 'Rp 600.000'), ('Alasan', 'Kesalahan input')])}</div>
<div class="fld"><span class="lab">PIN pemilik</span><div class="otp"><span>•</span><span>•</span><span>•</span><span>•</span><span class="is-f"></span><span></span></div></div>
<div class="f g12"><button class="btn sec l w1">Kembali</button><button class="btn pri l w1">Setujui</button></div></div>"""
    return K(refund_content(), dim=m)

DEN_OPEN = [(100000, 2), (50000, 4), (20000, 3), (10000, 2), (5000, 2), (2000, 4), (1000, 2)]
DEN_CLOSE = [(100000, 10), (50000, 8), (20000, 5), (10000, 3), (5000, 2), (2000, 4), (1000, 2)]
assert sum(a * b for a, b in DEN_OPEN) == 500000 and sum(a * b for a, b in DEN_CLOSE) == 1550000

def den_table(rows, dense=False):
    pad = ' style="padding:8px 12px"' if dense else ''
    body = ''.join(f'<tr><td{pad} class="b6 num">{rp(a)}</td><td{pad}><div class="stepr" style="width:fit-content"><b>−</b><span>{b}</span><b>+</b></div></td><td{pad} class="r">{rp(a * b)}</td></tr>' for a, b in rows)
    tot = sum(a * b for a, b in rows)
    return f'<table class="tbl"><thead><tr><th>Pecahan</th><th>Jumlah</th><th class="r">Subtotal</th></tr></thead><tbody>{body}</tbody><tfoot><tr><td{pad} colspan="2">Total dihitung</td><td{pad} class="r">{rp(tot)}</td></tr></tfoot></table>'

def k_buka():
    c = f"""{title('Buka shift', 'Sari Front Desk, 14 Nov 2026, 08.00', '', crumb('Antrean kasir', 'Buka shift'))}
<div class="gd" style="grid-template-columns:1fr 400px;align-items:start"><div class="card fc g12"><b class="t18">Kas awal per pecahan</b>{den_table(DEN_OPEN)}</div>
<div class="card fc g16"><div class="fc g4"><span class="t12 b6 mu">Kas awal</span><span class="t32">Rp 500.000</span></div>
{kv([('Standar', 'Rp 500.000'), ('Selisih', 'Rp 0')], 'g12')}<span class="bdg ok" style="align-self:flex-start">{I('check', 16)}Sesuai standar</span>
<button class="btn pri l wf">Buka shift</button></div></div>"""
    return K(c)

def close_summary(dense=False):
    g = 'g8' if dense else 'g12'
    return f"""<div class="card fc {g}"><b class="t18">Ringkasan</b>{kv([('Kas awal', 'Rp 500.000'), ('+ Tunai masuk (2)', 'Rp 1.050.000'), ('− Refund tunai', 'Rp 0')], g)}<div class="hr"></div>
{kv([('Seharusnya di laci', 'Rp 1.550.000'), ('Dihitung', 'Rp 1.550.000')], g)}<div class="kv ac"><b>Selisih</b><span class="bdg ok">Rp 0</span></div>
<div class="fld"><span class="lab">Alasan selisih</span><div class="inp is-d">Tidak perlu, selisih Rp 0</div></div>
<button class="btn pri l wf">Tutup shift</button></div>"""

def k_tutup(compact=False):
    nontunai = f"""<div class="card fc g8"><b class="t18">Non-tunai</b>{kv([('QRIS (1)', 'Rp 400.000'), ('EDC (0)', 'Rp 0'), ('Transfer (0)', 'Rp 0'), ('Deposit dipakai', 'Rp 200.000'), ('Transaksi lunas', '3')])}</div>"""
    warn = ban('wt', 'alert', '2 tagihan masih menunggu bayar.')
    if compact:
        c = f"""{title('Tutup shift', 'Sari Front Desk, 08.00-20.30')}
<div class="gd" style="grid-template-columns:1fr 340px;flex:1;min-height:0;gap:16px"><div class="card p16 fc g8"><b class="t18">Uang di laci</b>{den_table(DEN_CLOSE, True)}</div>
<div class="fc g16">{close_summary(True)}{warn}</div></div>"""
        return K(c, compact=True)
    c = f"""{title('Tutup shift', 'Sari Front Desk, 14 Nov 2026, 08.00-20.30', '', crumb('Laporan kasir', 'Tutup shift'))}
<div class="gd" style="grid-template-columns:1fr 400px 340px;align-items:start"><div class="card fc g12"><b class="t18">Uang di laci</b>{den_table(DEN_CLOSE)}</div>
{close_summary()}<div class="fc g20">{nontunai}{warn}</div></div>"""
    return K(c, 'Laporan kasir')

def report_kpis():
    return f"""<div class="gd c4">{kpi_card('Tagihan lunas', '3', '2 masih menunggu')}{kpi_card('Total tagihan', 'Rp 1.650.000', 'Diskon hari ini Rp 0')}
{kpi_card('Uang diterima', 'Rp 1.450.000', '+ saldo deposit Rp 200.000')}{kpi_card('Rata-rata per tagihan', 'Rp 550.000', 'Rp 1.650.000 ÷ 3')}</div>"""

def tabs(items, on):
    return '<div class="seg" style="width:fit-content">' + ''.join(f'<div class="{"on" if i == on else ""}" style="padding:0 16px">{t}</div>' for i, t in enumerate(items)) + '</div>'

def k_laporan():
    rows = [('Tunai', 'Ya', 2, 'Rp 1.050.000'), ('QRIS', 'Tidak', 1, 'Rp 400.000'), ('EDC', 'Tidak', 0, 'Rp 0'), ('Transfer', 'Tidak', 0, 'Rp 0'), ('Refund tunai', 'Keluar laci', 0, 'Rp 0')]
    tb = ''.join(f'<tr><td class="b6">{a}</td><td>{b}</td><td class="r">{c}</td><td class="r">{d}</td></tr>' for a, b, c, d in rows)
    btns = f'<button class="btn sec">{I("dl", 16)}Unduh PDF</button><button class="btn sec">{I("dl", 16)}Unduh Excel</button>'
    c = f"""{title('Laporan kasir', 'Sari Front Desk, 14 Nov 2026, 08.00-20.30', btns)}{tabs(['Rekap per metode', 'Laporan harian', 'Sisa tagihan'], 0)}{report_kpis()}
<div class="gd" style="grid-template-columns:1fr 400px;align-items:start"><div class="card fc g12"><b class="t18">Penerimaan per metode</b>
<table class="tbl"><thead><tr><th>Metode</th><th>Ke laci?</th><th class="r">Transaksi</th><th class="r">Jumlah</th></tr></thead><tbody>{tb}</tbody>
<tfoot><tr><td colspan="2">Total uang masuk</td><td class="r">3</td><td class="r">Rp 1.450.000</td></tr></tfoot></table>
<span class="t12 mu">Deposit dipakai Rp 200.000, tidak masuk laci.</span></div>
<div class="card fc g12"><div class="f jb ac"><b class="t18">Kas laci</b><span class="bdg ok dot">Shift buka</span></div>{kv([('Kas awal', 'Rp 500.000'), ('+ Tunai masuk', 'Rp 1.050.000'), ('− Refund tunai', 'Rp 0')], 'g12')}
<div class="hr"></div><div class="kv ac"><b>Kas akhir (sistem)</b><span class="t20">Rp 1.550.000</span></div><button class="btn pri wf">Tutup shift</button></div></div>"""
    return K(c, 'Laporan kasir')

def k_laporan_owner():
    data = [('TG-2026-11014-001', 'Budi Santoso', 'drg. Nadia Putri', 'Saldo + Tunai', 'ok', 'Rp 800.000'),
            ('TG-2026-11014-002', 'Ratna Dewi Anggraini', 'drg. Arif Hidayat', '-', 'wt', 'Rp 400.000'),
            ('TG-2026-11014-003', 'Alya Rahmawati', 'drg. Clara Wijaya, Sp.KGA', '-', 'wt', 'Rp 300.000'),
            ('TG-2026-11014-004', 'Joko Wijaya', 'drg. Arif Hidayat', 'QRIS', 'ok', 'Rp 400.000'),
            ('TG-2026-11014-005', 'Hendra Gunawan', 'drg. Nadia Putri', 'Tunai', 'ok', 'Rp 450.000')]
    tb = ''.join(f'<tr><td class="num">{a}</td><td class="b6">{b}</td><td>{c}</td><td>{d}</td><td><span class="bdg {s}">{"Lunas" if s == "ok" else "Menunggu"}</span></td><td class="r">{t}</td></tr>' for a, b, c, d, s, t in data)
    btns = f'<span class="bdg">{I("lock", 16)}Hanya lihat</span><button class="btn sec">{I("dl", 16)}Unduh PDF</button>'
    c = f"""{title('Laporan kasir', 'Sari Front Desk, 14 Nov 2026, 08.00-20.30', btns)}{tabs(['Rekap per metode', 'Laporan harian', 'Sisa tagihan'], 1)}{report_kpis()}
<div class="card fc g12"><div class="f jb ac"><b class="t18">Tagihan hari ini</b><span class="t12 mu">5 tagihan</span></div>
<table class="tbl"><thead><tr><th>No. tagihan</th><th>Pasien</th><th>Dokter</th><th>Metode</th><th>Status</th><th class="r">Total</th></tr></thead><tbody>{tb}</tbody></table></div>"""
    return K(c, 'Laporan kasir', ('Rina Kusuma', 'Pemilik', 'RK'))

def k_bayar_tab():
    c = f"""{title('Terima pembayaran', 'Budi Santoso, TG-2026-11014-001')}
<div class="gd" style="grid-template-columns:1fr 300px;flex:1;min-height:0;gap:16px"><div class="card p16 fc g16">{pay_left()}</div>
<div class="card p16 fc g12">{keypad()}<div class="w1"></div><button class="btn pri l wf">Terima Rp 600.000</button></div></div>"""
    return K(c, compact=True)

def phone_staff(main, foot, t):
    return phone(main, foot, back(t))

def k_bayar_hp():
    m = f"""<div class="kv ac"><div class="fc"><span class="t12 mu">Budi Santoso, TG-2026-11014-001</span><span class="t12 b6 mu">Sisa dibayar</span></div><span class="t24">Rp 600.000</span></div>
{pm('Tunai', True)}<div class="nom"><div class="kv"><span class="lab">Uang diterima</span><span class="lab ok">Kembalian Rp 0</span></div><span class="t32">Rp 600.000</span></div>
<div class="f g8"><span class="chip on">Uang pas</span><span class="chip">+50.000</span><span class="chip">+100.000</span></div>{keypad(h=60)}"""
    return phone_staff(m, f'<button class="btn pri l wf">{I("check")}Terima Rp 600.000</button>', 'Terima pembayaran')

def k_lunas_hp():
    m = f"""<div class="fc ac g8 c" style="padding-top:8px"><span class="ico ok l">{I('check', 32)}</span><b class="t18">Pembayaran diterima</b><span class="t32">Rp 600.000</span>
<span class="t12 mu">Tunai, Budi Santoso, 20.28</span><div class="f g8"><span class="bdg ok">Lunas</span><span class="bdg">{I('lock', 16)}Terkunci</span></div></div>
{lunas_rincian()}<div class="f g8"><button class="btn sec w1">{I('print', 16)}Cetak struk</button><button class="btn sec w1">{I('msg', 16)}WhatsApp</button></div>"""
    return phone_staff(m, '<button class="btn pri l wf">Selesai</button>', 'Kasir')

def build_kasir():
    D = [ab('1 Antrean', 'd', k_antrean()), ab('2 Tagihan', 'd', k_tagihan()), ab('3 Bayar', 'd', k_bayar()), ab('4 Lunas', 'd', k_lunas()),
         ab('5 Struk 80 mm', 'd', k_struk()), ab('6 Refund', 'd', k_refund()), ab('7 PIN pemilik', 'd', k_pin()),
         ab('8 Buka shift', 'd', k_buka()), ab('9 Tutup shift', 'd', k_tutup()), ab('10 Laporan', 'd', k_laporan()), ab('11 Laporan pemilik', 'd', k_laporan_owner())]
    T = [ab('12 Bayar', 't', k_bayar_tab()), ab('13 Tutup shift', 't', k_tutup(True))]
    M = [ab('14 Bayar', 'm', k_bayar_hp()), ab('15 Lunas', 'm', k_lunas_hp())]
    a = lambda t: ('->', t)
    secs = [
        section('Kasir', 'Desktop 1440×900. Bayar', [row(D[0], a('Bayar'), D[1], a('Bayar'), D[2], a('Terima'), D[3])]),
        section('Kasir', 'Desktop 1440×900. Struk dan refund', [row(D[4], a('Refund'), D[5], a('> Rp 500.000'), D[6])]),
        section('Kasir', 'Desktop 1440×900. Shift dan laporan', [row(D[7], '|', D[8], '|', D[9]), row(D[10])]),
        section('Kasir', 'Tablet 1024×768', [row(T[0], '|', T[1])]),
        section('Kasir', 'HP 390×844', [row(M[0], a('Terima'), M[1])]),
    ]
    return board('Bittodent / Kasir', 'Board statis. Klinik Gigi Senyum Sehat, Sabtu 14 Nov 2026.', secs)

if __name__ == '__main__':
    out = {ROOT / 'design/system/index.html': ds(), ROOT / 'design/boards/self-service.html': build_ss(), ROOT / 'design/boards/kasir.html': build_kasir()}
    for p, html in out.items():
        assert '—' not in html, f'em dash in {p}'
        assert not re.search(r'\bNIK\b', html.replace('Tanpa NIK', '')), f'NIK in {p}'
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(html)
        print(f'{p.relative_to(ROOT)}: {len(html.encode()):,} B')
