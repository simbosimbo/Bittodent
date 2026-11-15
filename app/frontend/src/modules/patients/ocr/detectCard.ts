// Find e-KTP card rectangles on a page (front + back, or a scan of one card). Pure: no I/O, no logging.
export const CARD_RATIO = 85.6 / 53.98
export type Crop = { x: number; y: number; w: number; h: number }

/** Light teal/blue of an e-KTP, excluding the white page. */
export function isKtpBlue(r: number, g: number, b: number): boolean {
  return b > 90 && b > r + 10 && b > g - 15 && r < 230
}

function runsAtLeast(values: number[], thr: number): [number, number][] {
  const out: [number, number][] = []
  let start = -1
  for (let i = 0; i <= values.length; i++) {
    const on = i < values.length && values[i] >= thr
    if (on && start < 0) start = i
    else if (!on && start >= 0) { out.push([start, i]); start = -1 }
  }
  return out
}

function mergeRuns(runs: [number, number][], gap: number): [number, number][] {
  if (!runs.length) return []
  const out: [number, number][] = [[runs[0][0], runs[0][1]]]
  for (let i = 1; i < runs.length; i++) {
    const prev = out[out.length - 1]
    if (runs[i][0] - prev[1] <= gap) prev[1] = runs[i][1]
    else out.push([runs[i][0], runs[i][1]])
  }
  return out
}

/** Detect ISO-ish card boxes from RGBA (4 bytes/pixel). */
export function cardCropsFromRgba(width: number, height: number, rgba: ArrayLike<number>): Crop[] {
  const row = new Array(height).fill(0)
  const mask: Uint8Array = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    let n = 0
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (isKtpBlue(rgba[i], rgba[i + 1], rgba[i + 2])) { mask[y * width + x] = 1; n++ }
    }
    row[y] = n / width
  }
  const minH = Math.max(40, Math.round(height * 0.08))
  const raw = runsAtLeast(row, 0.1)
  const merged = mergeRuns(raw, Math.max(16, Math.round(height * 0.025)))
    .filter(([a, b]) => b - a >= minH)
  const pad = 8

  const cropFromBand = (y0: number, y1: number): Crop | 'tall' | undefined => {
    const col = new Array(width).fill(0)
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < width; x++) if (mask[y * width + x]) col[x]++
    }
    const h = y1 - y0
    const xs = runsAtLeast(col.map((n) => n / h), 0.08)
    if (!xs.length) return
    const x0 = Math.max(0, xs[0][0] - pad)
    const x1 = Math.min(width, xs[xs.length - 1][1] + pad)
    const y = Math.max(0, y0 - pad)
    const yb = Math.min(height, y1 + pad)
    const w = x1 - x0, hh = yb - y
    const aspect = w / hh
    if (aspect < 1.2) return 'tall'
    if (aspect > 2.2) return
    if (w * hh < width * height * 0.05) return
    return { x: x0, y, w, h: hh }
  }

  const out: Crop[] = []
  for (const [y0, y1] of merged) {
    const crop = cropFromBand(y0, y1)
    if (crop && crop !== 'tall') { out.push(crop); continue }
    if (crop !== 'tall') continue
    // A two-sided page can fuse front and back across a thin blue gap; split into the raw runs.
    for (const [a, b] of raw) {
      if (a < y0 || b > y1 || b - a < minH) continue
      const part = cropFromBand(a, b)
      if (part && part !== 'tall') out.push(part)
    }
  }
  return out
}

/** Prefer the front (PROVINSI/NIK + photo on the right) over the back or a thin mid-page strip. */
export function pickFrontCard(crops: Crop[], pageW: number, pageH: number, rgba?: ArrayLike<number>): Crop | undefined {
  if (!crops.length) return
  if (crops.length === 1) return crops[0]
  const scored = crops.map((c) => {
    const aspectScore = -Math.abs(c.w / c.h - CARD_RATIO)
    // A photo on the right is a front-card cue; the back is a map.
    let photo = 0
    if (rgba) {
      const rx = Math.round(c.x + c.w * 0.68)
      const ry = Math.round(c.y + c.h * 0.22)
      const rw = Math.round(c.w * 0.26)
      const rh = Math.round(c.h * 0.45)
      let sat = 0, n = 0
      for (let y = ry; y < ry + rh; y++) {
        for (let x = rx; x < rx + rw; x++) {
          if (x < 0 || y < 0 || x >= pageW || y >= pageH) continue
          const i = (y * pageW + x) * 4
          const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2]
          const max = Math.max(r, g, b), min = Math.min(r, g, b)
          sat += max - min
          n++
        }
      }
      photo = n ? sat / n : 0
    }
    return { c, aspectScore, photo, y: c.y }
  })
  scored.sort((a, b) => b.photo - a.photo || b.aspectScore - a.aspectScore || a.y - b.y)
  return scored[0].c
}

export function detectFrontCard(width: number, height: number, rgba: ArrayLike<number>): Crop | undefined {
  return pickFrontCard(cardCropsFromRgba(width, height, rgba), width, height, rgba)
}
