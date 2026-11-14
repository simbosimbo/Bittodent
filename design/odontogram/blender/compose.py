#!/usr/bin/env python3
"""Compose the Bitto 3D odontogram preview from Blender renders + legend.json.

    python3 blender/compose.py            # from design/odontogram/
Writes 3d-blender/{legend-vars.css, odontogram-3d.css, tooth3d.js, preview.html},
adds mask bounding boxes to manifest.json and screenshots preview/odontogram-3d-blender-*.png.
"""
import json, shutil, subprocess, sys
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "3d-blender"
PREV = ROOT / "preview"
CHROME = "/usr/bin/google-chrome"
FRAMES = ["M", "D", "O", "B", "L", "crown", "root"]

legend = json.loads((ROOT / "legend.json").read_text())
manifest = json.loads((OUT / "manifest.json").read_text())

# ---- mask bounding boxes (fractions of the image box) ----
for name, m in manifest["models"].items():
    for view in ("buccal", "occlusal"):
        im = np.asarray(Image.open(OUT / m[view]["mask"]).getchannel("A"))
        h, w7 = im.shape; w = w7 // 7
        bb = {}
        for i, fr in enumerate(FRAMES):
            a = im[:, i * w:(i + 1) * w] > 96
            if a.any():
                ys, xs = np.where(a)
                bb[fr] = [round(xs.min() / w, 3), round(ys.min() / h, 3), round((xs.max() + 1) / w, 3), round((ys.max() + 1) / h, 3)]
        m[view]["bbox"] = bb
(OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))

# ---- CSS variables from legend.json (the only place colours come from) ----
st = legend["states"]
lines = ["/* GENERATED from legend.json by blender/compose.py. Do not edit; change legend.json. */", ":root {"]
for c in legend["conditions"]:
    lines.append(f"  --c-{c['key']}: {c['color']};")
for s in legend["statuses"]["items"]:
    lines.append(f"  --s-{s['key']}: {s['color']};")
lines += [f"  --state-draft: {st['draft']['color']};", f"  --state-draft-accent: {st['draft']['accent']};",
          f"  --state-draft-wash: {st['draft'].get('wash', 'transparent')};",
          f"  --state-signed: {st['signed'].get('color', 'currentColor')};", "}"]
for c in legend["conditions"]:
    lines.append(f"[data-condition=\"{c['key']}\"] {{ --cc: var(--c-{c['key']}); }}")
for s in legend["statuses"]["items"]:
    lines.append(f"[data-status=\"{s['key']}\"] {{ --sc: var(--s-{s['key']}); --op: {s['fill-opacity']}; }}")
(OUT / "legend-vars.css").write_text("\n".join(lines) + "\n")
shutil.copy(ROOT / "blender" / "odontogram-3d.css", OUT / "odontogram-3d.css")
shutil.copy(ROOT / "blender" / "tooth3d.js", OUT / "tooth3d.js")

# ---- fake chart data (same record shape as the 2D chart) ----
CHART = [
    {"tooth": 18, "state": "signed", "layers": [{"condition": "perlu_dicabut", "status": "direncanakan"}]},
    {"tooth": 17, "state": "signed", "layers": [{"condition": "tambalan", "surfaces": ["O"], "status": "sudah_ada_sini"}]},
    {"tooth": 16, "state": "signed", "layers": [{"condition": "tambalan", "surfaces": ["O", "M"], "status": "sudah_ada_sini"},
                                                 {"condition": "mahkota", "status": "direncanakan"}]},
    {"tooth": 14, "state": "draft", "layers": [{"condition": "karies", "surfaces": ["D"], "status": "kondisi"}]},
    {"tooth": 12, "state": "signed", "layers": [{"condition": "tambalan", "surfaces": ["B"], "status": "sudah_ada_lain"}]},
    {"tooth": 11, "state": "signed", "layers": [{"condition": "karies", "surfaces": ["M"], "status": "kondisi"}]},
    {"tooth": 21, "state": "signed", "layers": [{"condition": "tambalan", "surfaces": ["I"], "status": "selesai"}]},
    {"tooth": 24, "state": "signed", "layers": [{"condition": "mahkota", "status": "sudah_ada_sini"}]},
    {"tooth": 26, "state": "draft", "layers": [{"condition": "karies", "surfaces": ["O", "B"], "status": "kondisi"}]},
    {"tooth": 28, "state": "signed", "layers": [{"condition": "hilang", "status": "sudah_ada_sini"}]},
    {"tooth": 55, "state": "signed", "layers": [{"condition": "karies", "surfaces": ["O"], "status": "kondisi"}]},
    {"tooth": 64, "state": "signed", "layers": [{"condition": "tambalan", "surfaces": ["O"], "status": "selesai"}]},
    {"tooth": 85, "state": "signed", "layers": [{"condition": "sisa_akar", "status": "kondisi"}]},
    {"tooth": 74, "state": "draft", "layers": [{"condition": "karies", "surfaces": ["O"], "status": "kondisi"}]},
    {"tooth": 46, "state": "signed", "layers": [{"condition": "implan", "status": "sudah_ada_sini"}]},
    {"tooth": 47, "state": "signed", "layers": [{"condition": "tambalan", "surfaces": ["O"], "status": "sudah_ada_sini"},
                                                 {"condition": "karies", "surfaces": ["D"], "status": "direncanakan"}]},
    {"tooth": 36, "state": "signed", "layers": [{"condition": "tambalan", "surfaces": ["O", "B"], "status": "selesai"}]},
    {"tooth": 38, "state": "signed", "layers": [{"condition": "hilang", "status": "sudah_ada_sini"}]},
    {"tooth": 41, "state": "signed", "layers": [{"condition": "sehat", "surfaces": ["B"], "status": "kondisi"}]},
    {"tooth": 33, "state": "signed", "layers": [{"condition": "tambalan", "surfaces": ["D"], "status": "dirujuk"}]},
]

HTML = r"""<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<title>Bitto — odontogram 3D (render Blender)</title>
<link rel="stylesheet" href="legend-vars.css">
<link rel="stylesheet" href="odontogram-3d.css">
<style>
:root { --bg:#F8FAFC; --card:#FFFFFF; --ink:#1F2937; --ink-soft:#4B5563; --rule:#E5E7EB; --halo:#FFFFFF; --focus:#2563EB; --gum: rgba(214,120,130,.10); }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font: 14px/1.4 Inter, "Segoe UI", system-ui, sans-serif; }
.page { padding: 20px 24px 28px; width: max-content; }
h1 { font-size: 18px; margin: 0 0 2px; } h2 { font-size: 15px; margin: 18px 0 8px; }
.note { color: var(--ink-soft); font-size: 12.5px; }
.badge { display:inline-block; font-size:12px; font-weight:600; border:1.5px solid var(--ink-soft); border-radius:999px; padding:1px 8px; margin-left:8px; color: var(--ink-soft); }
.card { width: max-content; background: var(--card); border:1px solid var(--rule); border-radius:14px; padding: 14px 18px; }
.chart { display:flex; flex-direction:column; align-items:center; gap:0; }
.row { display:flex; align-items:flex-start; justify-content:center; position:relative; }
.row .mid { width: 14px; flex:none; border-left: 1.5px dashed var(--rule); align-self: stretch; margin: 0 4px; }
.gum { position:absolute; left:-6px; right:-6px; height: 16px; background: var(--gum); pointer-events:none; border-radius: 8px; z-index: 0; }
.row > .t3 { z-index: 1; }
.nums { display:flex; justify-content:center; color: var(--ink-soft); font: 600 12px/1 ui-monospace, monospace; padding: 6px 0; }
.nums span { text-align:center; flex:none; }
.sep { height: 1px; background: var(--rule); width: 100%; margin: 6px 0; }
.dentlabel { font-size: 11.5px; color: var(--ink-soft); align-self:flex-start; margin: 4px 0 0; }
.legend { width: 0; min-width: 100%; display:flex; flex-wrap:wrap; gap: 6px 16px; margin-top: 10px; font-size: 12.5px; }
.legend .k { display:inline-flex; align-items:center; gap:6px; }
.legend svg { width: 20px; height: 20px; overflow: visible; }
.grid { display:grid; gap: 8px 10px; align-items:end; }
.grid .lbl { font-size: 12px; color: var(--ink-soft); text-align:center; max-width: 120px; line-height:1.25; }
.cellwrap { display:flex; flex-direction:column; align-items:center; gap:2px; }
.side { font-size: 11px; color: var(--ink-soft); writing-mode: vertical-rl; transform: rotate(180deg); }
</style></head>
<body><div class="page">
<header>
  <h1>Odontogram Bitto — tampilan 3D (render Blender) <span class="badge">Legenda internal</span></h1>
  <div class="note">Legenda internal, bukan standar resmi Kemenkes/PDGI. Pandangan operator: kanan pasien di kiri bagan. Tampilan hanya-baca; isian per permukaan di bagan 2D. Data contoh fiktif.</div>
</header>
<section id="full"><div class="card"><div class="chart" id="chart"></div><div class="legend" id="legend"></div></div></section>
<section id="conditions"><h2>Kondisi pada molar 16 dan insisor 11 (warna + bentuk)</h2><div class="card"><div class="grid" id="condgrid"></div></div></section>
<section id="states"><h2>State dan status</h2><div class="card"><div class="grid" id="stategrid"></div></div></section>
</div>
<script src="tooth3d.js"></script>
<script>
const M = __MANIFEST__; const LEGEND = __LEGEND__; const CHART = __CHART__;
const q = new URLSearchParams(location.search);
const only = q.get("only"); if (only) document.querySelectorAll("section").forEach(s => { if (s.id !== only) s.style.display = "none"; });
const K = +(q.get("k") || 1.55);
const byTooth = Object.fromEntries(CHART.map(r => [r.tooth, r]));
const rec = (t) => byTooth[t] || { tooth: t, state: "empty", layers: [] };
const T = window.Tooth3D;
const seq = (a) => a;
const U = [18,17,16,15,14,13,12,11], U2 = [21,22,23,24,25,26,27,28];
const PU = [55,54,53,52,51], PU2 = [61,62,63,64,65];
const PL = [85,84,83,82,81], PL2 = [71,72,73,74,75];
const L = [48,47,46,45,44,43,42,41], L2 = [31,32,33,34,35,36,37,38];
function row(left, right, view, cls, k) {
  const r = document.createElement("div"); r.className = `row ${view} ${cls}`;
  left.forEach(t => r.appendChild(T.view(rec(t), view, M, k, "")));
  const mid = document.createElement("div"); mid.className = "mid"; r.appendChild(mid);
  right.forEach(t => r.appendChild(T.view(rec(t), view, M, k, "")));
  if (view === "buccal") {   // subtle gum band just on the root side of the CEJ line
    const I = T.info(left[0]); const v = M.models[I.model].buccal; const cej = v.cejY * v.h * k;
    const g = document.createElement("div"); g.className = "gum";
    g.style.top = (cls === "upper" ? cej - 18 : cej + 2) + "px"; r.prepend(g);
  }
  return r;
}
function nums(left, right, k) {
  const n = document.createElement("div"); n.className = "nums";
  const add = (t) => { const I = T.info(t); const s = document.createElement("span"); s.textContent = t;
    s.style.width = (M.models[I.model].crownWidthPx * I.scale * k) + "px"; n.appendChild(s); };
  left.forEach(add); const g = document.createElement("span"); g.style.width = "22px"; n.appendChild(g); right.forEach(add);
  return n;
}
const ch = document.getElementById("chart");
const kp = K * 0.9;
const lab = (t) => { const d = document.createElement("div"); d.className = "dentlabel"; d.textContent = t; return d; };
ch.append(lab("Gigi tetap — rahang atas (bukal, oklusal)"), row(U, U2, "buccal", "upper", K), row(U, U2, "occlusal", "upper", K), nums(U, U2, K));
const s1 = document.createElement("div"); s1.className = "sep"; ch.append(s1);
ch.append(lab("Gigi sulung"), row(PU, PU2, "buccal", "upper", kp), row(PU, PU2, "occlusal", "upper", kp), nums(PU, PU2, kp),
          nums(PL, PL2, kp), row(PL, PL2, "occlusal", "lower", kp), row(PL, PL2, "buccal", "lower", kp));
const s2 = document.createElement("div"); s2.className = "sep"; ch.append(s2);
ch.append(lab("Gigi tetap — rahang bawah (oklusal, bukal)"), nums(L, L2, K), row(L, L2, "occlusal", "lower", K), row(L, L2, "buccal", "lower", K));

// legend strip (glyph + colour from legend.json)
const lg = document.getElementById("legend");
const SVGNS = "http://www.w3.org/2000/svg";
for (const c of LEGEND.conditions) {
  const k = document.createElement("span"); k.className = "k";
  const svg = document.createElementNS(SVGNS, "svg"); svg.setAttribute("viewBox", "-10 -10 20 20"); svg.classList.add("t3-glyphs"); svg.style.position = "static";
  const g = document.createElementNS(SVGNS, "g"); g.setAttribute("data-condition", c.key); svg.appendChild(g);
  // reuse renderer glyphs through a tiny fake tooth is overkill; draw via a throwaway view
  k.appendChild(svg); k.append(c.label); lg.appendChild(k);
  window.__g = window.__g || []; window.__g.push([g, c.key]);
}
for (const s of LEGEND.statuses.items) {
  const k = document.createElement("span"); k.className = "k";
  const svg = document.createElementNS(SVGNS, "svg"); svg.setAttribute("viewBox", "-10 -10 20 20"); svg.classList.add("t3-glyphs"); svg.style.position = "static";
  const g = document.createElementNS(SVGNS, "g"); svg.appendChild(g); k.appendChild(svg); k.append("Status: " + s.label); lg.appendChild(k);
  window.__s = window.__s || []; window.__s.push([g, s.key]);
}
const drk = document.createElement("span"); drk.className = "k"; drk.innerHTML = '<svg viewBox="0 0 20 20" class="t3-glyphs" style="position:static"><rect x="2" y="2" width="16" height="16" rx="4" fill="none" stroke="var(--state-draft)" stroke-width="2" stroke-dasharray="4 3"/><path d="M5 1 L9 5 L5 9 L1 5Z" fill="var(--state-draft-accent)"/></svg>' + LEGEND.states.draft.badge; lg.appendChild(drk);
const sg = document.createElement("span"); sg.className = "k"; sg.innerHTML = '<svg viewBox="0 0 20 20" class="t3-glyphs" style="position:static"><rect x="2" y="2" width="16" height="16" rx="4" fill="none" stroke="var(--state-signed)" stroke-width="2.2"/><rect x="6" y="9" width="8" height="6" rx="1" fill="var(--state-signed)"/><path d="M7.5 9 V7.5 a2.5 2.5 0 0 1 5 0 V9" fill="none" stroke="var(--state-signed)" stroke-width="1.6"/></svg>' + LEGEND.states.signed.badge; lg.appendChild(sg);

// conditions grid
function cellFor(record, label, k) {
  const w = document.createElement("div"); w.className = "cellwrap";
  w.appendChild(T.view(record, "buccal", M, k, "")); w.appendChild(T.view(record, "occlusal", M, k, ""));
  const l = document.createElement("div"); l.className = "lbl"; l.textContent = label; w.appendChild(l); return w;
}
const CONDS = [
  ["Kosong", []],
  ["Sehat (B)", [{ condition: "sehat", surfaces: ["B", "O"] }]],
  ["Karies (O + M)", [{ condition: "karies", surfaces: ["O", "M"] }]],
  ["Tambalan (O)", [{ condition: "tambalan", surfaces: ["O"] }]],
  ["Tambalan (B + D)", [{ condition: "tambalan", surfaces: ["B", "D"] }]],
  ["Mahkota", [{ condition: "mahkota" }]],
  ["Hilang", [{ condition: "hilang" }]],
  ["Sisa akar", [{ condition: "sisa_akar" }]],
  ["Perlu dicabut", [{ condition: "perlu_dicabut" }]],
  ["Implan", [{ condition: "implan" }]],
  ["Berlapis: tambalan sudah ada + mahkota direncanakan", [{ condition: "tambalan", surfaces: ["O"], status: "sudah_ada_sini" }, { condition: "mahkota", status: "direncanakan" }]],
  ["Tambalan direncanakan vs selesai", null],
];
const cg = document.getElementById("condgrid");
const kc = K * 1.05;
cg.style.gridTemplateColumns = `repeat(${CONDS.length + 1}, auto)`;
for (const tooth of [16, 11]) {
  for (const [label, layers] of CONDS) {
    if (layers === null) {
      const w = document.createElement("div"); w.className = "cellwrap"; w.style.flexDirection = "column";
      const pair = document.createElement("div"); pair.style.display = "flex"; pair.style.gap = "6px";
      for (const st of ["direncanakan", "selesai"]) {
        const sub = document.createElement("div"); sub.className = "cellwrap";
        const r = { tooth, state: "empty", layers: [{ condition: "tambalan", surfaces: [tooth === 16 ? "O" : "B"], status: st }] };
        sub.appendChild(T.view(r, "buccal", M, kc, "")); sub.appendChild(T.view(r, "occlusal", M, kc, ""));
        pair.appendChild(sub);
      }
      w.appendChild(pair); const l = document.createElement("div"); l.className = "lbl"; l.textContent = label; w.appendChild(l);
      cg.appendChild(w); continue;
    }
    cg.appendChild(cellFor({ tooth, state: "empty", layers }, label, kc));
  }
  const tl = document.createElement("div"); tl.className = "lbl"; tl.style.alignSelf = "center"; tl.textContent = `gigi ${tooth}`; cg.appendChild(tl);
}

// states grid
const sgd = document.getElementById("stategrid");
const STATES = [
  ["Kosong", { state: "empty", layers: [] }],
  ["Draf AI, perlu persetujuan dokter", { state: "draft", layers: [{ condition: "karies", surfaces: ["O"], status: "kondisi" }] }],
  ["Terkunci (ditandatangani)", { state: "signed", layers: [{ condition: "karies", surfaces: ["O"], status: "kondisi" }] }],
];
sgd.style.gridTemplateColumns = `repeat(12, auto)`;
for (const tooth of [16, 11]) for (const [label, r] of STATES) sgd.appendChild(cellFor({ tooth, ...r }, label, kc));
{ // baseline missing + supernumerary
  sgd.appendChild(cellFor({ tooth: 16, state: "empty", baseline: "missing", layers: [] }, "Baseline: tidak ada (sebelum temuan)", kc));
  const w = document.createElement("div"); w.className = "cellwrap";
  const pr = document.createElement("div"); pr.style.display = "flex"; pr.style.alignItems = "flex-end";
  pr.appendChild(T.view(rec(12), "buccal", M, kc, "")); pr.appendChild(T.supernumerary(12, "buccal", M, kc, "")); pr.appendChild(T.view(rec(11), "buccal", M, kc, ""));
  w.appendChild(pr); const l = document.createElement("div"); l.className = "lbl"; l.textContent = "Slot gigi supernumerari (kecil, di samping)"; w.appendChild(l); sgd.appendChild(w);
}
for (const s of LEGEND.statuses.items) {
  sgd.appendChild(cellFor({ tooth: 16, state: "empty", layers: [{ condition: "tambalan", surfaces: ["O"], status: s.key }] }, "Status: " + s.label, kc));
}
// legend glyphs drawn with the renderer's own glyph shapes
(function () {
  const tmp = T.view({ tooth: 16, state: "empty", layers: [] }, "buccal", M, 1, "");
})();
</script>
<script>
// legend glyph drawing (shapes from tooth3d.js internals, duplicated minimal)
(function () {
  for (const [g, key] of (window.__g || [])) {
    const r = T.view({ tooth: 11, state: "empty", layers: [{ condition: key, surfaces: ["B"] }] }, "buccal", M, 1, "");
    const src = r.querySelector(`.t3-glyphs .g-${key}`) || r.querySelector(`.t3-glyphs [data-condition="${key}"] .g`) || r.querySelector(`.t3-glyphs [data-condition="${key}"]`);
    if (src) { const c = src.cloneNode(true); c.setAttribute("transform", "scale(1.1)"); g.appendChild(c); }
  }
  for (const [g, key] of (window.__s || [])) {
    const r = T.view({ tooth: 11, state: "empty", layers: [{ condition: "sehat", surfaces: ["B"], status: key }] }, "buccal", M, 1, "");
    const src = r.querySelector(`.sm-${key}`);
    if (src) { const c = src.cloneNode(true); c.setAttribute("transform", "scale(1.4)"); g.appendChild(c); }
  }
})();
</script>
</body></html>
"""
html = (HTML.replace("__MANIFEST__", json.dumps(manifest)).replace("__LEGEND__", json.dumps(legend))
        .replace("__CHART__", json.dumps(CHART)))
(OUT / "preview.html").write_text(html)

def shot(query, dest, w, h):
    url = (OUT / "preview.html").resolve().as_uri() + query
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--allow-file-access-from-files",
           f"--window-size={w},{h}", "--virtual-time-budget=4000", f"--screenshot={dest}", url]
    subprocess.run(cmd, check=True, capture_output=True, text=True)
    im = Image.open(dest).convert("RGB"); a = np.asarray(im).astype(int)
    bg = a[-1, -1]; diff = np.abs(a - bg).sum(axis=2) > 12
    rows = np.where(diff.any(axis=1))[0]; cols = np.where(diff.any(axis=0))[0]
    if len(rows):
        im.crop((0, 0, min(w, cols.max() + 24), min(h, rows.max() + 24))).save(dest)

if "--no-shots" not in sys.argv:
    PREV.mkdir(exist_ok=True)
    shot("?only=full", PREV / "odontogram-3d-blender-full.png", 1560, 2000)
    shot("?only=conditions", PREV / "odontogram-3d-blender-conditions.png", 1800, 1100)
    shot("?only=states", PREV / "odontogram-3d-blender-states.png", 1800, 1100)
    print("screenshots in", PREV)
