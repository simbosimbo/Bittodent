"""Bitto odontogram: procedural soft-3D teeth rendered with Blender (Cycles CPU).

One command (from design/odontogram/):
    blender -b -P blender/teeth.py
Options (after `--`):  --only molar-upper,incisor-lower   --samples 48   --quick

Pipeline per model: signed-distance field (numpy) -> marching cubes (scikit-image,
installed into Blender's bundled Python) -> bpy mesh with per-face surface regions
(M, D, O/I, B, L, root as material slots) -> smooth + subdivision surface ->
Cycles renders (buccal + occlusal), RGB-packed surface masks, variants
(roots only, implant, ghost) -> WebP via Pillow + manifest.json.

Units: 1 Blender unit = 1 mm. Model space: +x = mesial, -y = buccal, +z = crown,
CEJ at z = 0. Every render has MESIAL ON IMAGE RIGHT. Upper teeth are the same
construction mirrored in z (roots up). Left/right quadrants mirror with CSS.
"""
import sys, os, json, math, argparse, time
import numpy as np
import bpy
from mathutils import Vector
from skimage.measure import marching_cubes
from scipy.ndimage import gaussian_filter
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", default=os.path.normpath(os.path.join(HERE, "..", "3d-blender")))
ap.add_argument("--only", default="")
ap.add_argument("--samples", type=int, default=32)
ap.add_argument("--quick", action="store_true")
ap.add_argument("--masks-only", action="store_true", help="re-render only the surface masks")
ap.add_argument("--reindex", action="store_true", help="rebuild manifest.json from files on disk, no rendering")
ARGS = ap.parse_args(argv)
OUT = ARGS.out
VOX = 0.22 if ARGS.quick else 0.13
APEX_MIN = 0.8

# ---------------------------------------------------------------- framing
# Pixel density is identical for every tooth so roots/crowns align on one CEJ line.
H160 = {"permanent": 160, "primary": 114}           # buccal frame height @1x (px)
ROOTZ = {"permanent": 19.0, "primary": 14.0}        # mm below CEJ inside frame
OCC160 = {"permanent": 72, "primary": 58}           # occlusal frame height @1x (px)
PPM160 = 160 / 31.5                                 # px per mm at the 160px size
RS = 3                                              # render at 3x of the 160 size
SIZES = {"160": 1, "320": 2}

# ---------------------------------------------------------------- SDF helpers
def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)

def smax(a, b, k):
    return -smin(-a, -b, k)

def round_cone(x, y, z, A, B, r1, r2):
    bax, bay, baz = B[0] - A[0], B[1] - A[1], B[2] - A[2]
    l2 = bax * bax + bay * bay + baz * baz
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pax, pay, paz = x - A[0], y - A[1], z - A[2]
    yv = pax * bax + pay * bay + paz * baz
    zv = yv - l2
    qx, qy, qz = pax * l2 - bax * yv, pay * l2 - bay * yv, paz * l2 - baz * yv
    x2 = qx * qx + qy * qy + qz * qz
    y2 = yv * yv * l2
    z2 = zv * zv * l2
    k = np.sign(rr) * rr * rr * x2
    d1 = np.sqrt(x2 + z2) * il2 - r2
    d2 = np.sqrt(x2 + y2) * il2 - r1
    d3 = (np.sqrt(np.maximum(x2 * a2 * il2, 0)) + yv * rr) * il2 - r1
    return np.where(np.sign(zv) * a2 * z2 > k, d1, np.where(np.sign(yv) * a2 * y2 < k, d2, d3))

def root_field(x, y, z, root):
    """Root = smooth curve (quadratic Bezier through its points) swept with a smoothly tapering
    radius, approximated by many short round cones (no kinks). Cross-section scaled (sx, sy)."""
    pts, rad = root["pts"], list(root["r"])
    sx, sy = root.get("s", (1.0, 1.0))
    cx, cy = pts[0][0], pts[0][1]
    X = cx + (x - cx) / sx
    Y = cy + (y - cy) / sy
    P = [np.array((cx + (p[0] - cx) / sx, cy + (p[1] - cy) / sy, p[2])) for p in pts]
    if len(P) == 2:
        return round_cone(X, Y, z, P[0], P[1], rad[0], rad[1]) * min(sx, sy)
    rad[-1] = max(rad[-1], APEX_MIN)                 # rounded apex, never a needle
    p0, p1, p2 = P
    ctrl = 2 * p1 - 0.5 * (p0 + p2)                  # Bezier passes through the middle point
    r0, r1, r2 = rad
    n = 12
    def at(t):
        c = (1 - t) ** 2 * p0 + 2 * (1 - t) * t * ctrl + t * t * p2
        # smooth taper: quadratic through (0,r0) (.5,r1) (1,r2), eased at the apex
        r = r0 * (1 - t) * (1 - 2 * t) + 4 * r1 * t * (1 - t) + r2 * t * (2 * t - 1)
        return c, max(r, r2)
    d = None
    prev = at(0.0)
    for i in range(1, n + 1):
        cur = at(i / n)
        di = round_cone(X, Y, z, prev[0], cur[0], prev[1], cur[1])
        d = di if d is None else np.minimum(d, di)
        prev = cur
    return d * min(sx, sy)

def gauss(x, y, cx, cy, sx, sy):
    return np.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2))

def prof(t, c0, tm, c1):
    t = np.clip(t, 0, 1)
    rise = c0 + (1 - c0) * np.sin(0.5 * np.pi * np.clip(t / tm, 0, 1))
    fall = 1 - (1 - c1) * ((np.clip(t, tm, 1) - tm) / (1 - tm)) ** 2
    return np.where(t < tm, rise, fall)

# ---------------------------------------------------------------- tooth catalogue
def ztop_incisor(m):
    W2, H = m["W"] / 2, m["H"]
    def f(x, y):
        ux = np.abs(x) / W2
        corner = np.where(x < 0, 3.2, 1.8)
        return H - corner * np.maximum(0, ux - 0.45) ** 2 - 0.25 * np.abs(y) / max(m["D"], 1)
    return f

def ztop_canine(m):
    W2, H = m["W"] / 2, m["H"]
    tip = 0.10 * W2
    def f(x, y):
        dx = x - tip
        slope = np.where(dx > 0, 0.95, 0.80) * (2.2 if m.get("primary") else 3.0) / W2 ** 1.1
        return H - slope * np.abs(dx) ** 1.25 - 0.35 * (np.abs(y) / (m["D"] / 2)) ** 2
    return f

def ztop_cusps(m):
    W2, D2, H = m["W"] / 2, m["D"] / 2, m["H"]
    base = H - m["cusp_h"]
    def f(x, y):
        z = np.full_like(x, base)
        for (cx, cy, h, s) in m["cusps"]:
            z = z + h * gauss(x, y, cx * W2, cy * D2, s * W2, s * D2 * 0.95)
        # marginal ridges and a soft central fissure
        z = z + 0.55 * np.exp(-((np.abs(x) - 0.78 * W2) / (0.16 * W2)) ** 2) * np.exp(-(y / (0.7 * D2)) ** 4)
        z = z - 0.7 * np.exp(-(y / (0.12 * D2)) ** 2) * np.exp(-(x / (0.75 * W2)) ** 4)
        return z
    return f

def crown_profile(m, z):
    t = z / m["H"]
    a = m["W"] / 2 * prof(t, *m["pa"])
    b = m["D"] / 2 * prof(t, *m["pb"])
    yc = m["D"] / 2 * m.get("yshift", 0.0) * np.clip(t, 0, 1) ** 1.4
    return a, b, yc

def crown_field(x, y, z, m):
    a, b, yc = crown_profile(m, z)
    n = m["n"]
    r = (np.abs(x / a) ** n + np.abs((y - yc) / b) ** n) ** (1.0 / n)
    fs = (r - 1) * np.minimum(a, b)
    ft = z - m["ztop"](x, y)
    f = smax(fs, ft, m["kc"])
    # below the CEJ the crown shell tucks in smoothly so the root trunk takes over (no seam)
    f = f + 0.9 * np.maximum(0.0, -z) ** 1.5
    return smax(f, -z - 2.2, 0.8)

P = "permanent"; Q = "primary"
MODELS = {}
def add(name, **kw):
    kw["name"] = name
    kw.setdefault("primary", kw["dentition"] == Q)
    MODELS[name] = kw

# --- permanent anterior
add("incisor-upper", dentition=P, arch="upper", kind="incisor", W=8.6, D=7.0, H=10.6, n=2.2, kc=0.55,
    pa=(0.68, 0.72, 0.97), pb=(1.0, 0.18, 0.16), yshift=-0.45,
    roots=[{"pts": [(0, 0.3, 0.6), (-0.3, 0.5, -6.5), (-0.9, 0.8, -13.0)], "r": [2.9, 2.2, 0.75], "s": (1.0, 1.0)}])
add("incisor-lower", dentition=P, arch="lower", kind="incisor", W=5.6, D=6.0, H=9.2, n=2.2, kc=0.45,
    pa=(0.70, 0.75, 0.98), pb=(1.0, 0.18, 0.18), yshift=-0.35,
    roots=[{"pts": [(0, 0.2, 0.6), (-0.2, 0.2, -6.0), (-0.5, 0.2, -12.5)], "r": [2.0, 1.55, 0.6], "s": (0.68, 1.45)}])
add("canine-upper", dentition=P, arch="upper", kind="canine", W=7.8, D=8.0, H=10.2, n=2.1, kc=0.6,
    pa=(0.70, 0.55, 0.62), pb=(1.0, 0.22, 0.28), yshift=-0.35,
    roots=[{"pts": [(0, 0.3, 0.6), (-0.4, 0.4, -8.0), (-1.1, 0.5, -16.8)], "r": [3.0, 2.3, 0.75], "s": (0.92, 1.15)}])
add("canine-lower", dentition=P, arch="lower", kind="canine", W=7.0, D=7.6, H=10.6, n=2.1, kc=0.6,
    pa=(0.70, 0.55, 0.62), pb=(1.0, 0.22, 0.28), yshift=-0.3,
    roots=[{"pts": [(0, 0.3, 0.6), (-0.3, 0.3, -8.0), (-0.9, 0.3, -15.5)], "r": [2.7, 2.1, 0.7], "s": (0.85, 1.2)}])
# --- permanent premolars
PM_UP_CUSPS = [(0.0, -0.46, 2.6, 0.50), (0.0, 0.50, 2.1, 0.46)]
PM_LO_CUSPS = [(0.0, -0.40, 2.8, 0.50), (0.05, 0.55, 1.2, 0.42)]
add("premolar1-upper", dentition=P, arch="upper", kind="premolar", W=7.1, D=9.0, H=8.4, n=2.4, kc=0.7,
    pa=(0.70, 0.60, 0.84), pb=(0.84, 0.40, 0.78), cusps=PM_UP_CUSPS, cusp_h=2.7,
    roots=[{"pts": [(0, 0, 0.6), (0, 0, -3.0)], "r": [2.6, 2.3], "s": (0.85, 1.35)},
           {"pts": [(0, -1.5, -2.5), (-0.3, -1.9, -8.0), (-0.7, -2.0, -13.0)], "r": [1.65, 1.25, 0.55], "s": (0.85, 1.0)},
           {"pts": [(0, 1.6, -2.5), (-0.3, 2.0, -8.0), (-0.6, 2.2, -12.4)], "r": [1.6, 1.2, 0.55], "s": (0.85, 1.0)}])
add("premolar-upper", dentition=P, arch="upper", kind="premolar", W=6.8, D=9.0, H=8.0, n=2.4, kc=0.7,
    pa=(0.70, 0.60, 0.84), pb=(0.84, 0.40, 0.78), cusps=PM_UP_CUSPS, cusp_h=2.7,
    roots=[{"pts": [(0, 0, 0.6), (-0.3, 0, -7.0), (-0.8, 0, -14.0)], "r": [2.6, 2.0, 0.65], "s": (0.78, 1.38)}])
add("premolar-lower", dentition=P, arch="lower", kind="premolar", W=7.1, D=8.0, H=8.2, n=2.3, kc=0.7,
    pa=(0.70, 0.60, 0.84), pb=(0.82, 0.40, 0.75), cusps=PM_LO_CUSPS, cusp_h=2.8,
    roots=[{"pts": [(0, 0, 0.6), (-0.3, 0, -7.0), (-0.8, 0, -14.2)], "r": [2.6, 2.0, 0.65], "s": (0.88, 1.12)}])
# --- permanent molars
add("molar-upper", dentition=P, arch="upper", kind="molar", W=10.2, D=11.0, H=7.4, n=2.35, kc=0.8,
    pa=(0.74, 0.60, 0.84), pb=(0.80, 0.45, 0.76),
    cusps=[(0.44, -0.44, 2.6, 0.34), (-0.46, -0.44, 2.3, 0.32), (0.40, 0.42, 2.8, 0.38), (-0.50, 0.50, 1.7, 0.30)], cusp_h=3.0,
    roots=[{"pts": [(0, 0, 0.6), (0, 0, -3.0)], "r": [4.0, 3.5], "s": (1.05, 1.12)},
           {"pts": [(2.3, -2.0, -2.5), (2.7, -2.3, -7.5), (2.1, -2.1, -12.6)], "r": [2.0, 1.55, 0.75], "s": (0.92, 1.25)},
           {"pts": [(-2.3, -2.0, -2.5), (-2.9, -2.2, -7.0), (-2.6, -2.0, -11.6)], "r": [1.9, 1.45, 0.72], "s": (0.92, 1.2)},
           {"pts": [(0.2, 2.4, -2.5), (0.2, 3.5, -7.5), (0.2, 3.9, -12.8)], "r": [2.2, 1.7, 0.65], "s": (1.1, 0.95)}])
add("molar-lower", dentition=P, arch="lower", kind="molar", W=11.0, D=10.4, H=7.5, n=2.35, kc=0.8,
    pa=(0.74, 0.60, 0.84), pb=(0.80, 0.45, 0.76),
    cusps=[(0.52, -0.46, 2.5, 0.30), (-0.08, -0.54, 2.3, 0.28), (-0.68, -0.26, 1.7, 0.24),
           (0.46, 0.46, 2.7, 0.32), (-0.40, 0.48, 2.5, 0.32)], cusp_h=3.0,
    roots=[{"pts": [(0, 0, 0.6), (0, 0, -3.2)], "r": [4.2, 3.8], "s": (1.15, 0.95)},
           {"pts": [(2.9, 0, -2.8), (2.9, 0, -8.0), (2.0, 0, -13.6)], "r": [2.3, 1.85, 0.85], "s": (0.95, 1.65)},
           {"pts": [(-2.7, 0, -2.8), (-3.1, 0, -8.0), (-2.8, 0, -12.9)], "r": [2.2, 1.75, 0.8], "s": (0.92, 1.6)}])
# --- primary
add("p-incisor-upper", dentition=Q, arch="upper", kind="incisor", W=6.4, D=5.2, H=6.2, n=2.2, kc=0.45,
    pa=(0.74, 0.70, 0.97), pb=(1.0, 0.2, 0.2), yshift=-0.35,
    roots=[{"pts": [(0, 0.3, 0.5), (-0.2, 0.5, -5.0), (-0.7, 0.8, -10.0)], "r": [2.2, 1.65, 0.55], "s": (0.95, 1.0)}])
add("p-incisor-lower", dentition=Q, arch="lower", kind="incisor", W=4.4, D=4.0, H=5.2, n=2.2, kc=0.4,
    pa=(0.75, 0.70, 0.97), pb=(1.0, 0.2, 0.2), yshift=-0.3,
    roots=[{"pts": [(0, 0.2, 0.5), (-0.2, 0.2, -4.5), (-0.5, 0.2, -9.0)], "r": [1.5, 1.15, 0.45], "s": (0.72, 1.35)}])
add("p-canine-upper", dentition=Q, arch="upper", kind="canine", W=7.0, D=7.0, H=6.8, n=2.1, kc=0.5,
    pa=(0.74, 0.55, 0.62), pb=(1.0, 0.22, 0.3), yshift=-0.3,
    roots=[{"pts": [(0, 0.3, 0.5), (-0.3, 0.4, -6.5), (-0.9, 0.5, -12.8)], "r": [2.4, 1.8, 0.55], "s": (0.92, 1.1)}])
add("p-canine-lower", dentition=Q, arch="lower", kind="canine", W=5.6, D=5.6, H=6.4, n=2.1, kc=0.5,
    pa=(0.74, 0.55, 0.62), pb=(1.0, 0.22, 0.3), yshift=-0.3,
    roots=[{"pts": [(0, 0.3, 0.5), (-0.3, 0.3, -5.5), (-0.8, 0.3, -11.0)], "r": [2.0, 1.5, 0.5], "s": (0.85, 1.15)}])
add("p-molar-upper", dentition=Q, arch="upper", kind="molar", W=9.0, D=10.0, H=5.6, n=2.35, kc=0.7,
    pa=(0.86, 0.32, 0.84), pb=(0.88, 0.35, 0.76),
    cusps=[(0.42, -0.42, 1.6, 0.42), (-0.45, -0.42, 1.4, 0.40), (0.40, 0.42, 1.8, 0.46), (-0.48, 0.48, 1.0, 0.36)], cusp_h=1.9,
    roots=[{"pts": [(0, 0, 0.5), (0, 0, -1.6)], "r": [3.4, 3.0], "s": (1.05, 1.1)},
           {"pts": [(2.0, -1.8, -1.4), (3.4, -2.3, -5.0), (3.7, -2.2, -8.6)], "r": [1.3, 0.95, 0.42], "s": (0.8, 1.25)},
           {"pts": [(-2.0, -1.8, -1.4), (-3.4, -2.2, -5.0), (-3.6, -2.0, -8.2)], "r": [1.25, 0.9, 0.4], "s": (0.8, 1.25)},
           {"pts": [(0, 2.2, -1.4), (0, 4.0, -5.0), (0, 4.6, -8.8)], "r": [1.4, 1.0, 0.45], "s": (1.1, 0.95)}])
add("p-molar-lower", dentition=Q, arch="lower", kind="molar", W=9.6, D=8.8, H=5.6, n=2.35, kc=0.7,
    pa=(0.86, 0.32, 0.84), pb=(0.88, 0.35, 0.76),
    cusps=[(0.50, -0.45, 1.5, 0.36), (-0.08, -0.52, 1.4, 0.34), (-0.66, -0.25, 1.0, 0.28),
           (0.45, 0.45, 1.7, 0.38), (-0.38, 0.47, 1.6, 0.38)], cusp_h=1.9,
    roots=[{"pts": [(0, 0, 0.5), (0, 0, -1.6)], "r": [3.6, 3.2], "s": (1.15, 0.95)},
           {"pts": [(2.4, 0, -1.4), (3.8, 0, -5.0), (4.1, 0, -8.8)], "r": [1.5, 1.1, 0.45], "s": (0.62, 1.9)},
           {"pts": [(-2.4, 0, -1.4), (-3.8, 0, -5.0), (-4.0, 0, -8.4)], "r": [1.45, 1.05, 0.45], "s": (0.62, 1.85)}])

for m in MODELS.values():
    m["posterior"] = m["kind"] in ("premolar", "molar")
    m["ztop"] = {"incisor": ztop_incisor, "canine": ztop_canine}.get(m["kind"], ztop_cusps)(m)
    m["implant"] = m["dentition"] == P

# ---------------------------------------------------------------- fields per variant
def model_field(m, variant):
    def field(x, y, z):
        c = crown_field(x, y, z, m)
        r = None
        for root in m["roots"]:
            d = root_field(x, y, z, root)
            r = d if r is None else smin(r, d, 1.5)        # rounded furcation
        f = smin(c, r, 1.4)                               # soft CEJ transition
        if variant == "roots":
            # fractured crown just above the CEJ, irregular break line
            cut = 0.9 + 0.55 * np.sin(1.7 * x + 0.4) + 0.35 * np.cos(2.3 * y) + 0.25 * np.sin(3.1 * x * y / m["W"])
            f = smax(f, z - cut, 0.35)
        return f
    return field

def implant_fields(m):
    R = 2.25 if m["kind"] == "molar" else 1.85
    L = 11.5 if m["kind"] != "canine" else 13.0
    def screw(x, y, z):
        taper = np.clip((z + L) / 3.0, 0, 1) * 0.35 + 0.65
        ang = np.arctan2(y, x)
        thread = 0.24 * (0.5 + 0.5 * np.sin(2 * np.pi * z / 0.9 + ang))
        d = np.sqrt(x * x + y * y) - (R * taper - thread)
        d = np.where(z > -1.2, np.sqrt(x * x + y * y) - R * 0.9, d)    # smooth collar
        d = smax(d, -(z + L), 0.7)
        d = smax(d, z - 0.9, 0.15)
        return d
    def crown(x, y, z):
        c = crown_field(x, y, z, m)
        return smax(c, -(z - 0.15), 0.4)
    return crown, screw

def bounds(m, variant):
    xs = [m["W"] / 2]; ys = [m["D"] / 2]; zmin = -1.5
    for r in m["roots"]:
        for p, rad in zip(r["pts"], r["r"]):
            s = r.get("s", (1, 1))
            xs.append(abs(p[0]) + rad * s[0]); ys.append(abs(p[1]) + rad * s[1]); zmin = min(zmin, p[2] - rad)
    X = max(xs) + 0.8; Y = max(ys) + 0.8
    if variant == "implant":
        zmin = min(zmin, -14.5)
    return (-X, X), (-Y, Y), (zmin - 0.8, m["H"] + 1.2)

def mesh_from_field(field, bx, by, bz, vox):
    xs = np.arange(bx[0], bx[1], vox, dtype=np.float32)
    ys = np.arange(by[0], by[1], vox, dtype=np.float32)
    zs = np.arange(bz[0], bz[1], vox, dtype=np.float32)
    F = np.empty((len(xs), len(ys), len(zs)), dtype=np.float32)
    step = 12                                        # evaluate in x-slabs to bound memory
    for i in range(0, len(xs), step):
        X, Y, Z = np.meshgrid(xs[i:i + step], ys, zs, indexing="ij")
        F[i:i + step] = field(X, Y, Z)
    del X, Y, Z
    F = gaussian_filter(F, sigma=1.1)                # removes marching-cubes stair steps
    v, f, _, _ = marching_cubes(F, 0.0, spacing=(vox, vox, vox))
    v = v + np.array([xs[0], ys[0], zs[0]], dtype=np.float32)
    # orient outward (positive signed volume)
    a, b, c = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    vol = np.einsum("ij,ij->i", a, np.cross(b, c)).sum()
    if vol < 0:
        f = f[:, ::-1]
    return v, np.ascontiguousarray(f)

# ---------------------------------------------------------------- regions (material slots)
SLOT = {"M": 0, "D": 1, "O": 2, "B": 3, "L": 4, "root": 5}

def classify(m, v, f):
    a_, b_, c_ = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    cen = (a_ + b_ + c_) / 3
    nrm = np.cross(b_ - a_, c_ - a_)
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-9
    x, y, z = cen[:, 0], cen[:, 1], cen[:, 2]
    W2 = m["W"] / 2
    a, b, yc = crown_profile(m, np.maximum(z, 0.01))
    u = x / a; w = (y - yc) / b
    cej = (1.6 if not m["posterior"] else 0.7) * np.clip(np.abs(x) / W2, 0, 1) ** 2 * (0.6 if m["primary"] else 1.0)
    out = np.where(np.abs(u) > np.abs(w), np.where(x > 0, SLOT["M"], SLOT["D"]), np.where(y < 0, SLOT["B"], SLOT["L"]))
    zt = m["ztop"](x, y)
    if m["posterior"]:
        occ = (z > m["H"] - m["cusp_h"] - 0.55) & (nrm[:, 2] > 0.30) & (np.maximum(np.abs(u), np.abs(w)) < 0.68)
    else:
        occ = z > zt - (1.7 if m["kind"] == "incisor" else 2.0) * (0.7 if m["primary"] else 1.0)
    out = np.where(occ, SLOT["O"], out)
    out = np.where(z < cej, SLOT["root"], out)
    return out.astype(np.int32)

# ---------------------------------------------------------------- scene
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    sc.cycles.max_bounces = 6
    sc.cycles.diffuse_bounces = 2
    sc.cycles.glossy_bounces = 2
    sc.cycles.transmission_bounces = 2
    sc.cycles.transparent_max_bounces = 4
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "8"
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    world = bpy.data.worlds.new("w"); sc.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.92, 0.95, 1.0, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.32
    cam_data = bpy.data.cameras.new("cam"); cam_data.type = "ORTHO"; cam_data.sensor_fit = "VERTICAL"
    cam = bpy.data.objects.new("cam", cam_data); sc.collection.objects.link(cam); sc.camera = cam
    cam_data.clip_start = 1; cam_data.clip_end = 400
    def sun(name, travel, strength, angle):
        ld = bpy.data.lights.new(name, "SUN"); ld.energy = strength; ld.angle = math.radians(angle)
        ob = bpy.data.objects.new(name, ld); sc.collection.objects.link(ob)
        ob.parent = cam
        ob.rotation_mode = "QUATERNION"
        ob.rotation_quaternion = Vector((0, 0, -1)).rotation_difference(Vector(travel).normalized())
        return ob
    sun("key", (0.45, -0.65, -1.0), 1.9, 30)
    sun("fill", (-0.8, -0.15, -1.0), 0.55, 70)
    sun("rim", (0.0, -1.0, 0.55), 1.4, 25)
    return sc, cam

def aim(cam, view, arch, center, ortho):
    """view buccal: camera at -y. occlusal: camera on the crown side. Mesial always image right."""
    cam.data.ortho_scale = ortho
    cx, cy, cz = center
    if view == "buccal":
        cam.location = (cx, cy - 150, cz)
        R = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], dtype=float)  # cols: right, up, back
        R = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], dtype=float).T
        right, up, back = (1, 0, 0), (0, 0, 1), (0, -1, 0)
    elif arch == "lower":
        cam.location = (cx, cy, cz + 150)
        right, up, back = (1, 0, 0), (0, 1, 0), (0, 0, 1)
    else:
        cam.location = (cx, cy, cz - 150)
        right, up, back = (1, 0, 0), (0, -1, 0), (0, 0, -1)
    from mathutils import Matrix
    M3 = Matrix((right, up, back)).transposed()
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = M3.to_quaternion()

# ---------------------------------------------------------------- materials
ENAMEL_CERV = (0.80, 0.69, 0.50); ENAMEL_MID = (0.90, 0.85, 0.74); ENAMEL_EDGE = (0.93, 0.91, 0.86)
ROOT_TOP = (0.82, 0.68, 0.50); ROOT_APEX = (0.74, 0.58, 0.42)

def mat_tooth(m, name="tooth", whiter=False):
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    nt = mat.node_tree; N = nt.nodes; Lk = nt.links
    bsdf = N["Principled BSDF"]
    tc = N.new("ShaderNodeTexCoord"); sep = N.new("ShaderNodeSeparateXYZ"); Lk.new(tc.outputs["Object"], sep.inputs[0])
    # crown ramp along z/H
    mr = N.new("ShaderNodeMapRange"); mr.inputs[1].default_value = 0.0; mr.inputs[2].default_value = m["H"]
    Lk.new(sep.outputs["Z"], mr.inputs[0])
    ramp = N.new("ShaderNodeValToRGB"); Lk.new(mr.outputs[0], ramp.inputs[0])
    e = ramp.color_ramp.elements
    edge = (0.86, 0.89, 0.92) if m["kind"] == "incisor" else ENAMEL_EDGE
    if whiter:
        e[0].color = (0.90, 0.88, 0.84, 1); e[1].color = (0.97, 0.97, 0.95, 1)
    else:
        e[0].position = 0.0; e[0].color = (*ENAMEL_CERV, 1)
        e[1].position = 1.0; e[1].color = (*edge, 1)
        mid = e.new(0.42); mid.color = (*ENAMEL_MID, 1)
    # root ramp
    mr2 = N.new("ShaderNodeMapRange"); mr2.inputs[1].default_value = 0.0; mr2.inputs[2].default_value = -14.0
    Lk.new(sep.outputs["Z"], mr2.inputs[0])
    rr = N.new("ShaderNodeMix"); rr.data_type = "RGBA"
    rr.inputs[6].default_value = (*ROOT_TOP, 1); rr.inputs[7].default_value = (*ROOT_APEX, 1)
    Lk.new(mr2.outputs[0], rr.inputs[0])
    # crown/root blend at CEJ
    mr3 = N.new("ShaderNodeMapRange"); mr3.interpolation_type = "SMOOTHSTEP"
    mr3.inputs[1].default_value = -0.5; mr3.inputs[2].default_value = 0.7
    Lk.new(sep.outputs["Z"], mr3.inputs[0])
    mix = N.new("ShaderNodeMix"); mix.data_type = "RGBA"
    Lk.new(mr3.outputs[0], mix.inputs[0]); Lk.new(rr.outputs[2], mix.inputs[6]); Lk.new(ramp.outputs[0], mix.inputs[7])
    # fissure / contact darkening (ambient occlusion within ~1 mm)
    ao = N.new("ShaderNodeAmbientOcclusion"); ao.inputs["Distance"].default_value = 1.2; ao.samples = 8
    aor = N.new("ShaderNodeMapRange"); aor.inputs[3].default_value = 0.62; aor.inputs[4].default_value = 1.0
    Lk.new(ao.outputs["AO"], aor.inputs[0])
    mul = N.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"; mul.inputs[0].default_value = 1.0
    comb = N.new("ShaderNodeCombineColor")
    for i in range(3):
        Lk.new(aor.outputs[0], comb.inputs[i])
    Lk.new(mix.outputs[2], mul.inputs[6]); Lk.new(comb.outputs[0], mul.inputs[7])
    Lk.new(mul.outputs[2], bsdf.inputs["Base Color"])
    rough = N.new("ShaderNodeMapRange"); rough.inputs[3].default_value = 0.62; rough.inputs[4].default_value = 0.30
    Lk.new(mr3.outputs[0], rough.inputs[0]); Lk.new(rough.outputs[0], bsdf.inputs["Roughness"])
    bsdf.inputs["Subsurface Weight"].default_value = 0.25
    bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.75, 0.5)
    bsdf.inputs["Subsurface Scale"].default_value = 0.6
    bsdf.inputs["Coat Weight"].default_value = 0.25
    bsdf.inputs["Coat Roughness"].default_value = 0.25
    bsdf.inputs["Specular IOR Level"].default_value = 0.45
    return mat

def mat_titanium():
    mat = bpy.data.materials.new("ti"); mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.58, 0.63, 0.64, 1)
    b.inputs["Metallic"].default_value = 1.0
    b.inputs["Roughness"].default_value = 0.32
    return mat

def mat_emit(rgb):
    mat = bpy.data.materials.new("e"); mat.use_nodes = True
    N = mat.node_tree.nodes; N.remove(N["Principled BSDF"])
    em = N.new("ShaderNodeEmission"); em.inputs[0].default_value = (*rgb, 1); em.inputs[1].default_value = 1.0
    mat.node_tree.links.new(em.outputs[0], N["Material Output"].inputs[0])
    return mat

def make_object(name, v, f, slots, mats, arch, bake=True):
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(v)); me.vertices.foreach_set("co", v.astype(np.float32).ravel())
    me.loops.add(f.size); me.loops.foreach_set("vertex_index", f.astype(np.int32).ravel())
    me.polygons.add(len(f)); me.polygons.foreach_set("loop_start", np.arange(0, f.size, 3, dtype=np.int32))
    me.update(calc_edges=True)
    for mt in mats:
        me.materials.append(mt)
    if slots is not None:
        me.polygons.foreach_set("material_index", slots)
    me.shade_smooth()
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if arch == "upper":
        ob.scale = (1, 1, -1)
    sm = ob.modifiers.new("smooth", "LAPLACIANSMOOTH"); sm.lambda_factor = 0.5; sm.iterations = 2
    sm.use_volume_preserve = True; sm.use_normalized = True
    cs = ob.modifiers.new("corrective", "CORRECTIVE_SMOOTH"); cs.factor = 0.5; cs.iterations = 6
    cs.smooth_type = "LENGTH_WEIGHTED"; cs.use_only_smooth = True
    ss = ob.modifiers.new("subsurf", "SUBSURF"); ss.levels = 1; ss.render_levels = 1
    if bake:
        # evaluate the modifier stack once, so the ~9 renders per model don't re-run it
        dg = bpy.context.evaluated_depsgraph_get()
        baked = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        old = ob.data; ob.modifiers.clear(); ob.data = baked; bpy.data.meshes.remove(old)
    return ob

# ---------------------------------------------------------------- rendering
def frame(m, view):
    dent = m["dentition"]
    h160 = H160[dent] if view == "buccal" else OCC160[dent]
    h_mm = h160 / PPM160
    return h160, h_mm

def render_to(path, w_px, h_px, samples, raw=False):
    sc = bpy.context.scene
    sc.render.resolution_x = w_px; sc.render.resolution_y = h_px
    sc.cycles.samples = samples
    sc.cycles.use_denoising = not raw
    sc.view_settings.view_transform = "Raw" if raw else "Standard"
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)

def setup_view(cam, m, view, w160):
    dent = m["dentition"]
    h160, h_mm = frame(m, view)
    if view == "buccal":
        zc = (h_mm / 2 - ROOTZ[dent])               # lower (crown-up) frame centre in z
        if m["arch"] == "upper":
            zc = -zc
        aim(cam, "buccal", m["arch"], (0, 0, zc), h_mm)
    else:
        aim(cam, "occlusal", m["arch"], (0, 0, 0), h_mm)
    return w160 * RS, h160 * RS, h160

TMP = os.path.join(os.path.expanduser("~"), ".cache", "bitto-teeth")   # scratch PNGs (not /tmp: shared box)

def save_webp(src_png, dst_base, h160, kind="beauty", ghost=False):
    im = Image.open(src_png).convert("RGBA")
    out = {}
    for label, mult in SIZES.items():
        h = h160 * mult
        w = round(im.width * h / im.height)
        r = im.resize((w, h), Image.LANCZOS)
        if ghost:
            g = r.convert("LA").convert("RGBA")
            a = g.getchannel("A").point(lambda p: int(p * 0.30))
            g.putalpha(a); r = g
        fn = f"{dst_base}@{label}.webp"
        r.save(fn, "WEBP", quality=82, method=6)
        out[label] = os.path.relpath(fn, OUT)
    return out

def build_masks(pa, pb, dst):
    A = np.asarray(Image.open(pa).convert("RGB"), dtype=np.float32) / 255
    B = np.asarray(Image.open(pb).convert("RGB"), dtype=np.float32) / 255
    chans = [A[..., 0], A[..., 1], A[..., 2], B[..., 0], B[..., 1]]
    crown = np.clip(sum(chans), 0, 1)
    frames = chans + [crown, B[..., 2]]
    h, w = A.shape[:2]
    sheet = np.zeros((h, w * 7, 4), dtype=np.uint8); sheet[..., :3] = 255
    anchors = {}
    yy, xx = np.mgrid[0:h, 0:w]
    for i, (nm, fr) in enumerate(zip(["M", "D", "O", "B", "L", "crown", "root"], frames)):
        sheet[:, i * w:(i + 1) * w, 3] = (np.clip(fr, 0, 1) * 255).astype(np.uint8)
        s = fr.sum()
        if s > 4:
            anchors[nm] = [round(float((xx * fr).sum() / s / w), 3), round(float((yy * fr).sum() / s / h), 3),
                           round(float(s / (w * h)), 4)]
    Image.fromarray(sheet, "RGBA").save(dst, "WEBP", lossless=True, quality=100, method=6)
    return anchors

def anchors_from_sprite(path):
    a = np.asarray(Image.open(path).getchannel("A"), dtype=np.float32) / 255
    h, w7 = a.shape; w = w7 // 7
    yy, xx = np.mgrid[0:h, 0:w]
    out = {}
    for i, nm in enumerate(["M", "D", "O", "B", "L", "crown", "root"]):
        fr = a[:, i * w:(i + 1) * w]; s = fr.sum()
        if s > 4:
            out[nm] = [round(float((xx * fr).sum() / s / w), 3), round(float((yy * fr).sum() / s / h), 3), round(float(s / (w * h)), 4)]
    return out

def entry_from_disk(name, m):
    rel = lambda *p: os.path.join(*p)
    def imgs(folder, base):
        return {k: rel(folder, f"{base}@{k}.webp") for k in SIZES}
    w160 = Image.open(os.path.join(OUT, "buccal", f"{name}@160.webp")).width
    h160b = H160[m["dentition"]]
    cej_from_top = (h160b / PPM160 - ROOTZ[m["dentition"]]) / (h160b / PPM160)
    e = {"dentition": m["dentition"], "arch": m["arch"], "kind": m["kind"],
         "crownWidthMm": m["W"], "crownWidthPx": round(m["W"] * PPM160, 2), "w": w160,
         "buccal": {"h": h160b, "cejY": round(cej_from_top if m["arch"] == "lower" else 1 - cej_from_top, 4),
                    "img": imgs("buccal", name), "mask": rel("masks", f"{name}-buccal.webp")},
         "occlusal": {"h": OCC160[m["dentition"]], "img": imgs("occlusal", name), "mask": rel("masks", f"{name}-occlusal.webp")},
         "ghost": imgs("ghost", name),
         "roots": {v: imgs("roots", f"{name}-{v}") for v in ("buccal", "occlusal")}}
    for v in ("buccal", "occlusal"):
        e[v]["anchors"] = anchors_from_sprite(os.path.join(OUT, e[v]["mask"]))
    if m["implant"]:
        e["implant"] = imgs("implant", name)
    return e

def write_manifest(models):
    man = {
        "units": "Pixel sizes below are for the @160 set; @320 is exactly 2x.",
        "ppm160": PPM160,
        "orientation": "Every image has MESIAL on image right. Quadrants 2,3,6,7 (patient left, chart right) use CSS transform: scaleX(-1).",
        "maskFrames": ["M", "D", "O", "B", "L", "crown", "root"],
        "maskNote": "masks/<model>-<view>.webp is a 7-frame horizontal sprite (alpha = region). CSS: mask-size: 700% 100%; mask-position: calc(i * 100% / 6) 0. O frame = I on anterior teeth.",
        "models": models,
    }
    with open(os.path.join(OUT, "manifest.json"), "w") as fh:
        json.dump(man, fh, indent=1)

def reindex():
    models = {n: entry_from_disk(n, m) for n, m in MODELS.items()
              if all(os.path.exists(os.path.join(OUT, f)) for f in (f"buccal/{n}@160.webp", f"masks/{n}-buccal.webp",
                     f"masks/{n}-occlusal.webp", f"roots/{n}-occlusal@320.webp"))}
    write_manifest(models)
    print(f"[teeth] manifest: {len(models)}/{len(MODELS)} models")

def run():
    os.makedirs(TMP, exist_ok=True)
    for d in ("buccal", "occlusal", "roots", "implant", "ghost", "masks"):
        os.makedirs(os.path.join(OUT, d), exist_ok=True)
    only = [s for s in ARGS.only.split(",") if s]
    man_path = os.path.join(OUT, "manifest.json")
    manifest = json.load(open(man_path)) if (only and os.path.exists(man_path)) else {}
    manifest.setdefault("models", {})
    manifest.update({
        "units": "Pixel sizes below are for the @160 set; @320 is exactly 2x.",
        "ppm160": PPM160,
        "orientation": "Every image has MESIAL on image right. Quadrants 2,3,6,7 (patient left, chart right) use CSS transform: scaleX(-1).",
        "maskFrames": ["M", "D", "O", "B", "L", "crown", "root"],
        "maskNote": "masks/<model>-<view>.webp is a 7-frame horizontal sprite (alpha = region). CSS: mask-size: 700% 100%; mask-position: calc(i * 100% / 6) 0. O frame = I on anterior teeth.",
    })
    t0 = time.time()
    for name, m in MODELS.items():
        if only and name not in only:
            continue
        print(f"[teeth] {name}", flush=True)
        sc, cam = reset_scene()
        bx, by, bz = bounds(m, "normal")
        v, f = mesh_from_field(model_field(m, "normal"), bx, by, bz, VOX)
        slots = classify(m, v, f)
        tooth = mat_tooth(m)
        ob = make_object(name, v, f, slots, [tooth] * 6, m["arch"])
        xext = float(np.abs(v[:, 0]).max())
        w160 = int(math.ceil((2 * xext + 1.2) * PPM160))
        h160b = H160[m["dentition"]]
        entry = {"dentition": m["dentition"], "arch": m["arch"], "kind": m["kind"],
                 "crownWidthMm": m["W"], "crownWidthPx": round(m["W"] * PPM160, 2), "w": w160,
                 "buccal": {"h": h160b}, "occlusal": {"h": OCC160[m["dentition"]]}}
        cej_from_top = (h160b / PPM160 - ROOTZ[m["dentition"]]) / (h160b / PPM160)
        entry["buccal"]["cejY"] = round(cej_from_top if m["arch"] == "lower" else 1 - cej_from_top, 4)
        for view in ("buccal", "occlusal"):
            W, Hh, h160 = setup_view(cam, m, view, w160)
            png = f"{TMP}/{name}-{view}.png"
            if not ARGS.masks_only:
                render_to(png, W, Hh, ARGS.samples)
                entry[view]["img"] = save_webp(png, os.path.join(OUT, view, f"{name}"), h160)
            if view == "buccal" and not ARGS.masks_only:
                entry["ghost"] = save_webp(png, os.path.join(OUT, "ghost", f"{name}"), h160, ghost=True)
            # masks: two RGB-packed emission passes at the @320 size
            mats_a = [mat_emit(c) for c in [(1, 0, 0), (0, 1, 0), (0, 0, 1), (0, 0, 0), (0, 0, 0), (0, 0, 0)]]
            mats_b = [mat_emit(c) for c in [(0, 0, 0), (0, 0, 0), (0, 0, 0), (1, 0, 0), (0, 1, 0), (0, 0, 1)]]
            outs = []
            for tag, mats in (("a", mats_a), ("b", mats_b)):
                for i, mt in enumerate(mats):
                    ob.material_slots[i].material = mt
                p = f"{TMP}/{name}-{view}-mask{tag}.png"
                render_to(p, w160 * 2, h160 * 2, 12 if ARGS.quick else 24, raw=True)
                outs.append(p)
            for i in range(6):
                ob.material_slots[i].material = tooth
            dst = os.path.join(OUT, "masks", f"{name}-{view}.webp")
            entry[view]["anchors"] = build_masks(outs[0], outs[1], dst)
            entry[view]["mask"] = os.path.relpath(dst, OUT)
        bpy.data.objects.remove(ob)
        if ARGS.masks_only:
            print(f"[teeth] {name} masks done {time.time()-t0:.0f}s", flush=True)
            continue
        # roots only (sisa akar)
        v2, f2 = mesh_from_field(model_field(m, "roots"), bx, by, bz, VOX)
        ob2 = make_object(name + "-roots", v2, f2, None, [tooth], m["arch"])
        entry["roots"] = {}
        for view in ("buccal", "occlusal"):
            W, Hh, h160 = setup_view(cam, m, view, w160)
            png = f"{TMP}/{name}-roots-{view}.png"
            render_to(png, W, Hh, ARGS.samples)
            entry["roots"][view] = save_webp(png, os.path.join(OUT, "roots", f"{name}-{view}"), h160)
        bpy.data.objects.remove(ob2)
        if m["implant"]:
            cf, sf = implant_fields(m)
            bxi, byi, bzi = bounds(m, "implant")
            vc, fc = mesh_from_field(cf, bx, by, (-0.5, bz[1]), VOX)
            vs, fs = mesh_from_field(sf, (-3, 3), (-3, 3), (-15.5, 1.5), VOX)
            porcelain = mat_tooth(m, "porcelain", whiter=True)
            o1 = make_object(name + "-icrown", vc, fc, None, [porcelain], m["arch"])
            o2 = make_object(name + "-iscrew", vs, fs, None, [mat_titanium()], m["arch"], bake=False)
            o2.modifiers["smooth"].iterations = 1; o2.modifiers["corrective"].iterations = 1
            W, Hh, h160 = setup_view(cam, m, "buccal", w160)
            png = f"{TMP}/{name}-implant.png"
            render_to(png, W, Hh, ARGS.samples)
            entry["implant"] = save_webp(png, os.path.join(OUT, "implant", f"{name}"), h160)
        print(f"[teeth] {name} done {time.time()-t0:.0f}s", flush=True)
        reindex()                                  # manifest is rebuilt from disk after every model

if ARGS.reindex:
    reindex()
else:
    run()
