import { useEffect, useRef, useState } from 'react'
import { MOBILE_QUERY } from '../../shared/useIsMobile'
import type { Baseline, Surface, ToothPresence } from './api'
import type { Mark } from './Odontogram'
import './clinical.css'
import { LOWER, LOWER_PRIMARY, statusOf, surfaceLabel, surfaceName, surfacesOf, UPPER, UPPER_PRIMARY } from './legend'

// Read-only 3D odontogram (Blender renders, design/odontogram/README.md "Tampilan 3D"). Conditions are overlays from data,
// never painted here; a tap only selects (tooth, surface). Assets are synced to public/odontogram-3d/ (scripts/sync-3d.mjs).

type Layer = { condition: string; surfaces?: Surface[]; status: string }
export type Record3 = { tooth: number; state: 'empty' | 'draft' | 'signed'; baseline?: 'missing'; layers: Layer[] }
type View = 'buccal' | 'occlusal'
type ViewInfo = { h: number; cejY?: number; mask: string; anchors: Record<string, number[]> }
type Manifest = { models: Record<string, { crownWidthPx: number; buccal: ViewInfo; occlusal: ViewInfo }> }
type T3 = {
  view: (record: Record3, view: View, manifest: Manifest, k: number, base: string) => HTMLElement
  info: (fdi: number) => { model: string; scale: number; upper: boolean }
}
declare global { interface Window { Tooth3D?: T3 } }

// Respect Vite's base (staging serves the SPA from /client/), so assets resolve under it.
const BASE = `${import.meta.env.BASE_URL}odontogram-3d/`
const K = 1.15
const FRAMES = ['M', 'D', 'O', 'B', 'L'] // sprite order in masks/<model>-<view>.webp; frame O = I on anterior teeth
const WHOLE = ['hilang', 'implan', 'sisa_akar', 'mahkota', 'perlu_dicabut']

/** Same mark ids as the 2D chart ("t16" whole tooth, "t16-O" surface) → one Tooth3D record per tooth. */
export function recordsFromMarks(marks: Record<string, Mark>, baseline?: Record<string, ToothPresence>): Record<number, Record3> {
  const by: Record<number, Record3> = {}
  const rec = (tooth: number) => (by[tooth] ??= { tooth, state: 'empty', layers: [] })
  for (const [id, m] of Object.entries(marks)) {
    if ((m as { active?: boolean }).active === false) continue
    const hit = /^t(\d+)(?:-([MDOIBL]))?$/.exec(id)
    if (!hit) continue
    const r = rec(Number(hit[1]))
    if (m.state === 'draft') r.state = 'draft'
    else if (m.state === 'signed' && r.state !== 'draft') r.state = 'signed'
    const status = (m.status && statusOf(m.status)?.legend) || 'kondisi'
    const sf = hit[2] as Surface | undefined
    if (!sf || WHOLE.includes(m.condition)) { r.layers.push({ condition: m.condition, status }); continue }
    const same = r.layers.find((l) => l.condition === m.condition && l.status === status && l.surfaces)
    if (same) same.surfaces!.push(sf)
    else r.layers.push({ condition: m.condition, surfaces: [sf], status })
  }
  for (const [t, p] of Object.entries(baseline ?? {})) if (p !== 'ada') rec(Number(t)).baseline = 'missing'
  return by
}

/** Clinical default chart from date of birth (user can override): <6 y sulung, 6–12 y campuran, ≥13 y or unknown tetap. */
export function dentitionFromDob(dob: string | null, now = new Date()): Baseline['dentition'] {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob ?? '')
  const d = m ? new Date(m[0] + 'T00:00:00Z') : null
  if (!d || Number.isNaN(d.getTime()) || d > now) return 'tetap'
  const before = now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())
  const age = now.getUTCFullYear() - d.getUTCFullYear() - (before ? 1 : 0)
  return age < 6 ? 'sulung' : age <= 12 ? 'campuran' : 'tetap'
}

export function teethForDentition(dentition: Baseline['dentition']): number[] {
  const perm = [...UPPER, ...LOWER], prim = [...UPPER_PRIMARY, ...LOWER_PRIMARY]
  return dentition === 'tetap' ? perm : dentition === 'sulung' ? prim : [...perm, ...prim]
}

function ensureCss(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return
  const l = document.createElement('link')
  l.rel = 'stylesheet'
  l.href = href
  document.head.appendChild(l)
}

let scriptLoad: Promise<void> | null = null
function loadScript(): Promise<void> {
  if (window.Tooth3D) return Promise.resolve()
  return (scriptLoad ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `${BASE}tooth3d.js`
    s.onload = () => resolve()
    s.onerror = () => { scriptLoad = null; s.remove(); reject(new Error('tooth3d')) }
    document.head.appendChild(s)
  }))
}

type Props = {
  marks: Record<string, Mark>
  baseline?: Record<string, ToothPresence>
  dentition?: Baseline['dentition']
  selected?: { tooth: number; surface?: Surface } | null
  onPick?: (tooth: number, surface: Surface) => void
}

// Desktop 3D zoom: fit the whole chart (both jaws) between its top and the viewport bottom.
// Floor keeps crowns/FDI numbers readable (below it the page scrolls); ceiling = the old wide-screen zoom.
export const ZOOM_MIN = 0.45
export const ZOOM_MAX = 0.78
export function fitZoom(naturalHeight: number, availHeight: number): number {
  if (!(naturalHeight > 0)) return ZOOM_MAX
  return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, availHeight / naturalHeight)) * 100) / 100
}

// Phone 3D zoom: the widest jaw fits the card width (whole arch visible, no sideways scroll). Rounded down so it never overflows.
export const PHONE_ZOOM_MIN = 0.3
export function fitWidthZoom(naturalWidth: number, availWidth: number): number {
  if (!(naturalWidth > 0) || !(availWidth > 0)) return ZOOM_MAX
  return Math.floor(Math.min(ZOOM_MAX, Math.max(PHONE_ZOOM_MIN, availWidth / naturalWidth)) * 100) / 100
}

export function Odontogram3D({ marks, baseline, dentition = 'tetap', selected, onPick }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const pick = useRef(onPick)
  pick.current = onPick
  const [err, setErr] = useState(false)
  const [built, setBuilt] = useState(0)
  const key = JSON.stringify(recordsFromMarks(marks, baseline))

  useEffect(() => {
    ensureCss(`${BASE}legend-vars.css`)
    ensureCss(`${BASE}odontogram-3d.css`)
    let dead = false
    ;(async () => {
      try {
        await loadScript()
        const res = await fetch(`${BASE}manifest.json`)
        if (!res.ok) throw new Error('manifest')
        const M = (await res.json()) as Manifest
        if (dead || !host.current || !window.Tooth3D) return
        host.current.replaceChildren(buildChart(window.Tooth3D, M, JSON.parse(key), dentition))
        setErr(false)
        setBuilt((n) => n + 1)
      } catch {
        if (!dead) setErr(true)
      }
    })()
    return () => { dead = true }
  }, [key, dentition])

  // Selection is CSS on the built DOM (no rebuild): ring on the tooth, primary tint through the surface mask.
  useEffect(() => {
    const el = host.current
    if (!el) return
    el.querySelectorAll('.is-sel').forEach((n) => n.classList.remove('is-sel'))
    if (!selected) return
    el.querySelectorAll(`.t3[data-tooth="${selected.tooth}"]`).forEach((c) => c.classList.add('is-sel'))
    if (selected.surface) el.querySelectorAll(`.t3[data-tooth="${selected.tooth}"] .t3-sel[data-surface="${selected.surface}"]`).forEach((n) => n.classList.add('is-sel'))
  }, [selected?.tooth, selected?.surface, built])

  // Header height (alert chips) varies, so fit on build, body resize and window resize. Phone CSS ignores --odo3d-zoom.
  useEffect(() => {
    const el = host.current
    if (!el) return
    const fit = () => {
      const chart = el.querySelector<HTMLElement>('.chart')
      if (!chart) return
      const z = parseFloat(getComputedStyle(chart).zoom) || 1
      if (window.matchMedia?.(MOBILE_QUERY).matches) { // phone: fit width (clinical.css reads --odo3d-zoom-phone)
        const widest = Math.max(0, ...[...chart.querySelectorAll('.arch-grid')].map((g) => g.getBoundingClientRect().width))
        el.style.setProperty('--odo3d-zoom-phone', String(fitWidthZoom(widest / z, el.clientWidth)))
        return
      }
      const r = chart.getBoundingClientRect() // zoomed box; r.height / z = unzoomed height
      const avail = window.innerHeight - r.top - 32 // r.top is viewport-relative; 32 = pane + card bottom padding
      el.style.setProperty('--odo3d-zoom', String(fitZoom(r.height / z, avail)))
    }
    fit()
    window.addEventListener('resize', fit)
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null
    ro?.observe(el)
    ro?.observe(document.body)
    return () => { window.removeEventListener('resize', fit); ro?.disconnect() }
  }, [built])

  const fire = (target: EventTarget | null) => {
    const t = target as HTMLElement | null
    const cell = t?.closest<HTMLElement>('.t3')
    if (!cell || !pick.current) return
    const tooth = Number(cell.dataset.tooth)
    const hit = t?.closest<HTMLElement>('.t3-hit')
    pick.current(tooth, (hit?.dataset.surface as Surface | undefined) ?? surfacesOf(tooth)[2])
  }

  return (
    <div className="odo3d-wrap">
      {err && <p className="muted small" role="alert">Gambar odontogram 3D gagal dimuat. Pakai bagan 2D.</p>}
      <div className="odo3d" ref={host} hidden={err} aria-label="Odontogram 3D, hanya baca. Ketuk gigi atau permukaan untuk memilih."
        onClick={(e) => fire(e.target)}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).classList.contains('t3')) { e.preventDefault(); fire(e.target) } }} />
    </div>
  )
}

function buildChart(T: T3, M: Manifest, map: Record<number, Record3>, dent: Baseline['dentition']) {
  const div = (cls: string, text?: string) => {
    const d = document.createElement('div')
    d.className = cls
    if (text) d.textContent = text
    return d
  }
  const surfaces = (t: number, view: View) => {
    const c = T.view(map[t] ?? { tooth: t, state: 'empty', layers: [] }, view, M, K, BASE)
    const box = c.querySelector<HTMLElement>('.t3-box')
    const v = M.models[T.info(t).model]?.[view]
    if (!box || !v) return c
    const area = parseFloat(box?.style.width ?? '0') * parseFloat(box?.style.height ?? '0')
    const hits: { sf: Surface; a: number[] }[] = []
    for (const sf of surfacesOf(t)) {
      const fr = sf === 'I' ? 'O' : sf
      const a = v.anchors[fr]
      if (!a) continue
      // Selected-surface tint: same 7-frame mask sprite as the condition layers.
      const sel = div('t3-sel')
      sel.dataset.surface = sf
      sel.style.setProperty('--mask', `url("${BASE}${v.mask}")`)
      sel.style.setProperty('--i', String(FRAMES.indexOf(fr)))
      box.appendChild(sel)
      if ((a[2] ?? 0) >= 0.004) hits.push({ sf, a }) // e.g. palatal is a sliver in the buccal view: pick it in the occlusal view
    }
    // Hit targets around each surface anchor (CSS masks do not hit-test); smaller surfaces last so they sit on top.
    hits.sort((x, y) => (y.a[2] ?? 0) - (x.a[2] ?? 0))
    for (const { sf, a } of hits) {
      const h = div('t3-hit')
      h.dataset.surface = sf
      h.title = `Gigi ${t}, ${surfaceName(t, sf)} (${surfaceLabel(t, sf)})`
      const size = Math.max(14, Math.sqrt((a[2] ?? 0) * area))
      Object.assign(h.style, { left: `calc(${a[0] * 100}% - ${size / 2}px)`, top: `calc(${a[1] * 100}% - ${size / 2}px)`, width: `${size}px`, height: `${size}px` })
      box.appendChild(h)
    }
    return c
  }
  const cell = (t: number, view: View) => {
    const c = surfaces(t, view)
    // Keep lock / draft mark in the top corner so they do not sit on the crown.
    c.querySelectorAll('.lock, .draft-mark').forEach((el) => el.setAttribute('transform', 'translate(2 2)'))
    if (view === 'buccal') {
      // One keyboard stop per tooth (Enter = center surface); surfaces are pointer-first.
      c.tabIndex = 0
      c.setAttribute('role', 'button')
      c.setAttribute('aria-label', `Gigi ${t}`)
    } else c.setAttribute('aria-hidden', 'true')
    return c
  }
  // Shared column grid: each FDI pair (e.g. 18 above 48) uses one column width = max crown width.
  // Numbers sit in the same columns as the renders (not a separate flex row).
  const crownW = (t: number) => (M.models[T.info(t).model]?.crownWidthPx ?? 40) * T.info(t).scale * K
  const place = (grid: HTMLElement, el: HTMLElement, column: number, row: number, align: string) => {
    el.style.gridColumn = String(column)
    el.style.gridRow = String(row)
    el.style.alignSelf = align
    el.style.justifySelf = 'center'
    grid.appendChild(el)
  }
  const num = (t: number) => {
    const s = document.createElement('span')
    s.className = 'num'
    s.dataset.tooth = String(t)
    s.textContent = String(t)
    return s
  }
  const block = (title: string, U: number[], L: number[], withSides = false) => {
    const half = U.length / 2
    const [u1, u2, l1, l2] = [U.slice(0, half), U.slice(half), L.slice(0, half), L.slice(half)]
    const leftW = u1.map((u, i) => Math.max(crownW(u), crownW(l1[i])))
    const rightW = u2.map((u, i) => Math.max(crownW(u), crownW(l2[i])))
    const midCol = half + 1
    const grid = div('arch-grid')
    grid.style.gridTemplateColumns = [...leftW.map((w) => `${w}px`), '18px', ...rightW.map((w) => `${w}px`)].join(' ')
    const mid = div('mid')
    mid.style.gridColumn = String(midCol)
    mid.style.gridRow = withSides ? '2 / -1' : '1 / -1'
    grid.appendChild(mid)
    let row0 = 0
    if (withSides) {
      const leftLabel = div('side-label', 'Kanan pasien')
      const rightLabel = div('side-label', 'Kiri pasien')
      leftLabel.style.gridColumn = `1 / ${midCol}`
      rightLabel.style.gridColumn = `${midCol + 1} / -1`
      leftLabel.style.gridRow = rightLabel.style.gridRow = '1'
      leftLabel.style.justifySelf = 'start'
      rightLabel.style.justifySelf = 'end'
      grid.append(leftLabel, rightLabel)
      row0 = 1
    }
    // rows after optional labels: upper buccal, upper occlusal, upper nums, lower nums, lower occlusal, lower buccal
    u1.forEach((t, i) => {
      const col = i + 1
      place(grid, cell(t, 'buccal'), col, row0 + 1, 'end')
      place(grid, cell(t, 'occlusal'), col, row0 + 2, 'end')
      place(grid, num(t), col, row0 + 3, 'center')
    })
    l1.forEach((t, i) => {
      const col = i + 1
      place(grid, num(t), col, row0 + 4, 'center')
      place(grid, cell(t, 'occlusal'), col, row0 + 5, 'start')
      place(grid, cell(t, 'buccal'), col, row0 + 6, 'start')
    })
    u2.forEach((t, i) => {
      const col = midCol + 1 + i
      place(grid, cell(t, 'buccal'), col, row0 + 1, 'end')
      place(grid, cell(t, 'occlusal'), col, row0 + 2, 'end')
      place(grid, num(t), col, row0 + 3, 'center')
    })
    l2.forEach((t, i) => {
      const col = midCol + 1 + i
      place(grid, num(t), col, row0 + 4, 'center')
      place(grid, cell(t, 'occlusal'), col, row0 + 5, 'start')
      place(grid, cell(t, 'buccal'), col, row0 + 6, 'start')
    })
    const b = div('jaw-block')
    b.append(div('dentlabel', title), grid)
    return b
  }
  const chart = div('chart')
  if (dent !== 'sulung') chart.appendChild(block('Gigi tetap', UPPER, LOWER, true))
  if (dent !== 'tetap') chart.appendChild(block('Gigi sulung', UPPER_PRIMARY, LOWER_PRIMARY, dent === 'sulung'))
  return chart
}
