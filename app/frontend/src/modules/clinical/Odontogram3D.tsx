import { useEffect, useRef, useState } from 'react'
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

const BASE = '/odontogram-3d/'
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
    if (view === 'buccal') {
      // One keyboard stop per tooth (Enter = center surface); surfaces are pointer-first.
      c.tabIndex = 0
      c.setAttribute('role', 'button')
      c.setAttribute('aria-label', `Gigi ${t}`)
    } else c.setAttribute('aria-hidden', 'true')
    return c
  }
  const row = (left: number[], right: number[], view: View, arch: 'upper' | 'lower') => {
    const r = div(`row ${view} ${arch}`)
    left.forEach((t) => r.appendChild(cell(t, view)))
    r.appendChild(div('mid'))
    right.forEach((t) => r.appendChild(cell(t, view)))
    const v = M.models[T.info(left[0]).model]?.buccal
    if (view === 'buccal' && v?.cejY != null) {
      const cej = v.cejY * v.h * K
      const g = div('gum')
      g.style.top = `${arch === 'upper' ? cej - 18 : cej + 2}px`
      r.prepend(g)
    }
    return r
  }
  const nums = (left: number[], right: number[]) => {
    const n = div('nums')
    const add = (t: number) => {
      const I = T.info(t)
      const s = document.createElement('span')
      s.textContent = String(t)
      s.style.width = `${(M.models[I.model]?.crownWidthPx ?? 40) * I.scale * K}px`
      n.appendChild(s)
    }
    left.forEach(add)
    n.appendChild(div('mid'))
    right.forEach(add)
    return n
  }
  const block = (title: string, U: number[], L: number[]) => {
    const h = U.length / 2
    const [u1, u2, l1, l2] = [U.slice(0, h), U.slice(h), L.slice(0, h), L.slice(h)]
    const b = div('jaw-block')
    b.append(div('dentlabel', title), row(u1, u2, 'buccal', 'upper'), row(u1, u2, 'occlusal', 'upper'), nums(u1, u2),
      nums(l1, l2), row(l1, l2, 'occlusal', 'lower'), row(l1, l2, 'buccal', 'lower'))
    return b
  }
  const chart = div('chart')
  const sides = div('sides')
  sides.append(div('', 'Kanan pasien'), div('', 'Kiri pasien'))
  chart.appendChild(sides)
  if (dent !== 'sulung') chart.appendChild(block('Gigi tetap', UPPER, LOWER))
  if (dent !== 'tetap') chart.appendChild(block('Gigi sulung', UPPER_PRIMARY, LOWER_PRIMARY))
  return chart
}
