import { useEffect, useRef, useState } from 'react'
import type { CondKey, Mark, Surface } from '../data/types'
import { LOWER, LOWER_PRIMARY, UPPER, UPPER_PRIMARY } from './Odontogram'
import '../../../odontogram/3d-blender/odontogram-3d.css'

type Layer = { condition: CondKey; surfaces?: Surface[]; status: string }
type Record3 = { tooth: number; state: 'empty' | 'draft' | 'signed'; layers: Layer[] }

declare global {
  interface Window {
    Tooth3D?: {
      view: (record: Record3, viewName: string, manifest: unknown, k: number, base: string) => HTMLElement
      info: (fdi: number) => { model: string; scale: number; upper: boolean }
    }
  }
}

const WHOLE: CondKey[] = ['hilang', 'implan', 'sisa_akar', 'mahkota', 'perlu_dicabut']
const BASE = '/odontogram-3d/'
const SCRIPT = '/odontogram-3d/tooth3d.js'
const K = 1.15

function recordsFromMarks(marks: Record<string, Mark>, plan?: Set<string>, done?: Set<string>): Record<number, Record3> {
  const by: Record<number, Record3> = {}
  for (const [id, m] of Object.entries(marks)) {
    if (m.active === false) continue
    const hit = /^t(\d+)(?:-([MDOIBL]))?$/.exec(id)
    if (!hit) continue
    const tooth = Number(hit[1])
    const sf = hit[2] as Surface | undefined
    const rec = by[tooth] ?? (by[tooth] = { tooth, state: 'empty', layers: [] })
    if (m.state === 'draft') rec.state = 'draft'
    else if (m.state === 'signed' && rec.state !== 'draft') rec.state = 'signed'
    const status = done?.has(id) ? 'selesai' : plan?.has(id) ? 'direncanakan' : 'kondisi'
    if (!sf || WHOLE.includes(m.cond)) {
      rec.layers.push({ condition: m.cond, status })
    } else {
      const existing = rec.layers.find((l) => l.condition === m.cond && l.surfaces && l.status === status)
      if (existing && existing.surfaces) existing.surfaces.push(sf)
      else rec.layers.push({ condition: m.cond, surfaces: [sf], status })
    }
  }
  return by
}

function loadScript(): Promise<void> {
  if (window.Tooth3D) return Promise.resolve()
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('tooth3d')), { once: true })
    })
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('tooth3d'))
    document.head.appendChild(s)
  })
}

export function Odontogram3D({
  marks, plan, done, dentition = 'permanen',
}: {
  marks: Record<string, Mark>
  plan?: Set<string>
  done?: Set<string>
  dentition?: 'permanen' | 'sulung' | 'campuran'
}) {
  const host = useRef<HTMLDivElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const recs = recordsFromMarks(marks, plan, done)
  const recKey = JSON.stringify(recs)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let dead = false
    ;(async () => {
      try {
        await loadScript()
        const res = await fetch(`${BASE}manifest.json`)
        if (!res.ok) throw new Error('manifest')
        const M = await res.json()
        const T = window.Tooth3D
        if (!T) throw new Error('Tooth3D')
        if (dead || !host.current) return
        host.current.replaceChildren(buildChart(T, M, recordsFromMarks(marks, plan, done), dentition))
      } catch {
        if (!dead) setErr('Aset 3D Blender belum tersedia di prototipe.')
      }
    })()
    return () => { dead = true }
  }, [recKey, dentition, marks, plan, done])

  if (err) return <p className="muted small">{err} Overlay 3D memakai data bagan yang sama setelah aset disalin.</p>
  return <div className="odo3d" ref={host} aria-label="Odontogram 3D, hanya baca" />
}

type T3 = NonNullable<Window['Tooth3D']>

function recOf(map: Record<number, Record3>, t: number): Record3 {
  return map[t] ?? { tooth: t, state: 'empty', layers: [] }
}

function buildChart(T: T3, M: { models: Record<string, { crownWidthPx: number; buccal: { h: number; cejY: number } }> }, map: Record<number, Record3>, dent: 'permanen' | 'sulung' | 'campuran') {
  const chart = document.createElement('div')
  chart.className = 'chart'
  const U = UPPER.slice(0, 8), U2 = UPPER.slice(8)
  const L = LOWER.slice(0, 8), L2 = LOWER.slice(8)
  const PU = UPPER_PRIMARY.slice(0, 5), PU2 = UPPER_PRIMARY.slice(5)
  const PL = LOWER_PRIMARY.slice(0, 5), PL2 = LOWER_PRIMARY.slice(5)

  const row = (left: number[], right: number[], view: 'buccal' | 'occlusal', cls: string) => {
    const r = document.createElement('div')
    r.className = `row ${view} ${cls}`
    left.forEach((t) => r.appendChild(lock(T.view(recOf(map, t), view, M, K, BASE))))
    const mid = document.createElement('div')
    mid.className = 'mid'
    r.appendChild(mid)
    right.forEach((t) => r.appendChild(lock(T.view(recOf(map, t), view, M, K, BASE))))
    if (view === 'buccal') {
      const I = T.info(left[0])
      const v = M.models[I.model].buccal
      const cej = v.cejY * v.h * K
      const g = document.createElement('div')
      g.className = 'gum'
      g.style.top = (cls === 'upper' ? cej - 18 : cej + 2) + 'px'
      r.prepend(g)
    }
    return r
  }
  const nums = (left: number[], right: number[]) => {
    const n = document.createElement('div')
    n.className = 'nums'
    const add = (t: number) => {
      const I = T.info(t)
      const s = document.createElement('span')
      s.textContent = String(t)
      s.style.width = (M.models[I.model].crownWidthPx * I.scale * K) + 'px'
      n.appendChild(s)
    }
    left.forEach(add)
    const g = document.createElement('span')
    g.style.width = '22px'
    n.appendChild(g)
    right.forEach(add)
    return n
  }
  const lab = (text: string) => {
    const d = document.createElement('div')
    d.className = 'dentlabel'
    d.textContent = text
    return d
  }
  if (dent !== 'sulung') {
    chart.append(lab('Gigi tetap — rahang atas (bukal, oklusal)'), row(U, U2, 'buccal', 'upper'), row(U, U2, 'occlusal', 'upper'), nums(U, U2))
    chart.append(lab('Gigi tetap — rahang bawah (oklusal, bukal)'), nums(L, L2), row(L, L2, 'occlusal', 'lower'), row(L, L2, 'buccal', 'lower'))
  }
  if (dent !== 'permanen') {
    chart.append(lab('Gigi sulung — rahang atas'), row(PU, PU2, 'buccal', 'upper'), row(PU, PU2, 'occlusal', 'upper'), nums(PU, PU2))
    chart.append(lab('Gigi sulung — rahang bawah'), nums(PL, PL2), row(PL, PL2, 'occlusal', 'lower'), row(PL, PL2, 'buccal', 'lower'))
  }
  return chart
}

function lock(cell: HTMLElement) {
  cell.removeAttribute('tabindex')
  cell.removeAttribute('role')
  cell.setAttribute('aria-hidden', 'true')
  return cell
}
