import { useState, type ReactNode } from 'react'
import type { CondKey, Mark, Surface } from '../data/types'
import { LEGEND, LEGEND_DISCLAIMER, LEGEND_TITLE, legendOf } from '../data/legend'

// Odontogram FDI. ID permukaan: "t16-O" (gigi + permukaan); ID gigi: "t16".
// Atribut: data-state="draft|signed", data-condition="<kunci legenda>", data-plan="1" bila ada tindakan rencana.
export const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
export const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
export const UPPER_PRIMARY = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65]
export const LOWER_PRIMARY = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]

export const isAnterior = (t: number) => t % 10 <= 3
/** Rahang atas (FDI 1,2,5,6). Id permukaan palatal tetap 'L'; label tampak 'P'. */
export const isUpperTooth = (t: number) => {
  const q = Math.floor(t / 10) % 10
  return q === 1 || q === 2 || q === 5 || q === 6
}
export const surfacesOf = (t: number): Surface[] => ['M', 'D', isAnterior(t) ? 'I' : 'O', 'B', 'L']
export const surfaceLetter = (t: number | undefined, sf: Surface) => (sf === 'L' && t != null && isUpperTooth(t) ? 'P' : sf)
export const surfaceName = (t: number | undefined, sf: Surface) => {
  if (sf === 'L') return t == null ? 'Lingual/palatal' : isUpperTooth(t) ? 'Palatal' : 'Lingual'
  return ({ M: 'Mesial', D: 'Distal', O: 'Oklusal', I: 'Insisal', B: 'Bukal/fasial' } as const)[sf]
}
export const SURFACE_LABEL: Record<Surface, string> = { M: 'Mesial', D: 'Distal', O: 'Oklusal', I: 'Insisal', B: 'Bukal/fasial', L: 'Lingual/palatal' }
const quadrant = (t: number) => Math.floor(t / 10) % 4 || 4 // 1/5→1, 2/6→2, 3/7→3, 4/8→4
export const isActiveMark = (m?: Mark) => !m || m.active !== false
export const visibleMarks = (marks: Record<string, Mark>) => Object.fromEntries(Object.entries(marks).filter(([, m]) => isActiveMark(m)))

export interface OdontogramProps {
  marks: Record<string, Mark>
  plan?: Set<string> // kunci "t46-O" atau "t46"
  changed?: Set<number>
  selected?: number | null
  onSelect?: (t: number) => void
  onSelectSurface?: (t: number, s: Surface) => void
  selectedSurfaces?: Surface[]
  dentition?: 'permanen' | 'sulung' | 'campuran'
  label: string
  idPrefix?: string // agar dua odontogram di satu halaman tetap punya id unik
  compact?: boolean
  done?: Set<string>
  tipFor?: (t: number) => string
  layers?: boolean // transparansi berlapis agar kondisi + status terlihat bersamaan
}

const S = 44 // ukuran kotak gigi
function Patterns({ p }: { p: string }) {
  return (
    <defs>
      <pattern id={`${p}dots`} width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="var(--legend-condition-karies)" /><circle cx="3" cy="3" r="1.3" fill="var(--legend-enamel)" /></pattern>
      <pattern id={`${p}hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--legend-condition-tambalan)" /><line x1="0" y1="0" x2="0" y2="6" stroke="var(--legend-enamel)" strokeWidth="1.6" /></pattern>
    </defs>
  )
}
const fillFor = (c: CondKey | undefined, p: string) => c === 'karies' ? `url(#${p}dots)` : c === 'tambalan' ? `url(#${p}hatch)` : 'var(--legend-enamel)'

function ToothGlyph({ cond }: { cond: CondKey }) {
  const c = legendOf(cond).color
  const m = S / 2
  switch (cond) {
    case 'mahkota': return <rect x={-3} y={-3} width={S + 6} height={S + 6} rx={10} fill="none" stroke={c} strokeWidth={4} />
    case 'hilang': return <g stroke={c} strokeWidth={3.5} strokeLinecap="round"><line x1={4} y1={4} x2={S - 4} y2={S - 4} /><line x1={S - 4} y1={4} x2={4} y2={S - 4} /></g>
    case 'sisa_akar': return <path d={`M8 ${m} L${m - 4} ${S - 6} L${S - 6} 6`} fill="none" stroke={c} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    case 'perlu_dicabut': return <g stroke={c} strokeWidth={4} strokeLinecap="round"><line x1={3} y1={m - 6} x2={S - 3} y2={m - 6} /><line x1={3} y1={m + 6} x2={S - 3} y2={m + 6} /></g>
    case 'implan': return <g stroke={c} strokeWidth={3}><line x1={m} y1={5} x2={m} y2={S - 5} />{[12, 19, 26, 33].map((y) => <line key={y} x1={m - 8} y1={y} x2={m + 8} y2={y} />)}</g>
    default: return null
  }
}

function Tooth({ t, x, y, upper, props, p, onTip }: { t: number; x: number; y: number; upper: boolean; props: OdontogramProps; p: string; onTip?: (t: number | null, ev?: { clientX: number; clientY: number }) => void }) {
  const marks = visibleMarks(props.marks)
  const { plan, done, changed, selected, onSelect, layers } = props
  const q = quadrant(t)
  const mesialRight = q === 1 || q === 4 // kuadran kanan pasien tampil di kiri layar; mesial menghadap garis tengah
  const outerTop: Surface = upper ? 'B' : 'L'
  const outerBottom: Surface = upper ? 'L' : 'B'
  const center: Surface = isAnterior(t) ? 'I' : 'O'
  const k = 12 // tebal sisi
  const poly: Record<string, string> = {
    top: `0,0 ${S},0 ${S - k},${k} ${k},${k}`,
    bottom: `${k},${S - k} ${S - k},${S - k} ${S},${S} 0,${S}`,
    left: `0,0 ${k},${k} ${k},${S - k} 0,${S}`,
    right: `${S},0 ${S},${S} ${S - k},${S - k} ${S - k},${k}`,
  }
  const pos: [Surface, string][] = [[outerTop, poly.top], [outerBottom, poly.bottom], [mesialRight ? 'D' : 'M', poly.left], [mesialRight ? 'M' : 'D', poly.right]]
  const toothMark = marks[`t${t}`]
  const isSel = selected === t
  const anyDraft = toothMark?.state === 'draft' || surfacesOf(t).some((s) => marks[`t${t}-${s}`]?.state === 'draft')
  const surf = (s: Surface, shape: ReactNode) => {
    const m = marks[`t${t}-${s}`]
    const surfOn = props.selected === t && !!props.selectedSurfaces?.includes(s)
    return (
      <g key={s} id={`${p}t${t}-${s}`} data-surface={s} data-condition={m?.cond ?? 'sehat'} data-state={m?.state ?? 'signed'} data-plan={plan?.has(`t${t}-${s}`) ? '1' : undefined} className={`surf ${surfOn ? 'is-surf-sel' : ''}`}
        onClick={(e) => {
          if (!props.onSelect && !props.onSelectSurface) return
          e.stopPropagation()
          if (props.onSelectSurface) props.onSelectSurface(t, s)
          else props.onSelect?.(t)
        }}
      >
        {shape}
      </g>
    )
  }
  const sx = (m?: Mark) => ({ fill: fillFor(m?.cond, p), stroke: m?.state === 'draft' ? 'var(--color-draft-border)' : 'var(--color-neutral-500)', strokeWidth: m?.state === 'draft' ? 2 : 1, strokeDasharray: m?.state === 'draft' ? '3 2' : undefined, fillOpacity: layers && m?.cond && m.cond !== 'sehat' ? 0.72 : 1 })
  const missing = toothMark?.cond === 'hilang' || toothMark?.cond === 'sisa_akar'
  const planned = !missing && (plan?.has(`t${t}`) || surfacesOf(t).some((s) => plan?.has(`t${t}-${s}`)))
  const completed = !missing && (done?.has(`t${t}`) || surfacesOf(t).some((s) => done?.has(`t${t}-${s}`)))
  return (
    <g
      id={`${p}t${t}`} transform={`translate(${x},${y})`} className={`tooth ${isSel ? 'is-sel' : ''} ${toothMark?.cond === 'hilang' ? 'is-missing' : ''}`}
      data-condition={toothMark?.cond ?? 'sehat'} data-state={anyDraft ? 'draft' : 'signed'} data-plan={planned ? '1' : undefined}
      role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined}
      aria-label={`Gigi ${t}${toothMark ? ', ' + legendOf(toothMark.cond).label : ''}${anyDraft ? ', draf' : ''}${isSel ? ', dipilih' : ''}`}
      aria-pressed={onSelect ? isSel : undefined}
      onClick={() => onSelect?.(t)} onKeyDown={(e) => { if (onSelect && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(t) } }}
      onMouseEnter={(e) => onTip?.(t, { clientX: e.clientX, clientY: e.clientY })}
      onMouseMove={(e) => onTip?.(t, { clientX: e.clientX, clientY: e.clientY })}
      onMouseLeave={() => onTip?.(null)}
    >
      {changed?.has(t) && <rect x={-7} y={-7} width={S + 14} height={S + 14} rx={12} className="tooth-changed" />}
      {isSel && <rect x={-5} y={-5} width={S + 10} height={S + 10} rx={10} className="tooth-sel" />}
      {!missing && pos.map(([s, pts]) => surf(s, <polygon points={pts} {...sx(marks[`t${t}-${s}`])} />))}
      {!missing && surf(center, <rect x={k} y={k} width={S - 2 * k} height={S - 2 * k} {...sx(marks[`t${t}-${center}`])} />)}
      {missing && <rect x={0} y={0} width={S} height={S} rx={4} fill="var(--color-neutral-50)" stroke="var(--color-neutral-300)" />}
      <text x={S / 2} y={upper ? S - 4 : 11} textAnchor="middle" className="surf-letter" aria-hidden>{surfaceLetter(t, 'L')}</text>
      {toothMark && <g data-condition={toothMark.cond} className={toothMark.state === 'draft' ? 'glyph-draft' : ''}><ToothGlyph cond={toothMark.cond} /></g>}
      {planned && <g className="plan-mark"><circle cx={S} cy={0} r={8} /><text x={S} y={3.5} textAnchor="middle">R</text></g>}
      {completed && <g className="done-mark"><circle cx={planned ? S - 16 : S} cy={0} r={8} /><text x={planned ? S - 16 : S} y={3.5} textAnchor="middle">S</text></g>}
      <text x={S / 2} y={upper ? -10 : S + 20} textAnchor="middle" className="tooth-num">{t}</text>
    </g>
  )
}

export function Odontogram(props: OdontogramProps) {
  const p = props.idPrefix ?? ''
  const mixed = props.dentition === 'campuran'
  const up = props.dentition === 'sulung' ? UPPER_PRIMARY : UPPER
  const lo = props.dentition === 'sulung' ? LOWER_PRIMARY : LOWER
  const gap = 10, mid = 18
  const width = (mixed ? UPPER.length : up.length) * (S + gap) + mid + 24
  const row = S + 36
  const xOf = (i: number, n: number) => 12 + i * (S + gap) + (i >= n / 2 ? mid : 0)
  // gigi sulung rata dengan posisi 15–11 / 21–25 (indeks 3–12 pada deret permanen)
  const xPrimary = (i: number) => xOf(i + 3, UPPER.length)
  const height = mixed ? 4 * row + 40 : 2 * S + 100
  const [tip, setTip] = useState<{ t: number; x: number; y: number } | null>(null)
  const onTip = (t: number | null, ev?: { clientX: number; clientY: number }) => {
    if (!props.tipFor) return
    if (t == null || !ev) { setTip(null); return }
    setTip({ t, x: ev.clientX, y: ev.clientY })
  }
  return (
    <div className="odontogram-wrap">
      <svg className={`odontogram ${props.compact ? 'compact' : ''} ${mixed ? 'is-mixed' : ''}`} viewBox={`-6 -6 ${width} ${height}`} role="group" aria-label={props.label}>
        <Patterns p={p} />
        {mixed ? (
          <>
            <line x1={xOf(8, 16) - mid / 2 - gap / 2} y1={0} x2={xOf(8, 16) - mid / 2 - gap / 2} y2={height - 10} className="midline" />
            {UPPER.map((t, i) => <Tooth key={t} t={t} x={xOf(i, 16)} y={22} upper props={props} p={p} onTip={onTip} />)}
            {UPPER_PRIMARY.map((t, i) => <Tooth key={t} t={t} x={xPrimary(i)} y={22 + row} upper props={props} p={p} onTip={onTip} />)}
            {LOWER_PRIMARY.map((t, i) => <Tooth key={t} t={t} x={xPrimary(i)} y={22 + row * 2} upper={false} props={props} p={p} onTip={onTip} />)}
            {LOWER.map((t, i) => <Tooth key={t} t={t} x={xOf(i, 16)} y={22 + row * 3} upper={false} props={props} p={p} onTip={onTip} />)}
          </>
        ) : (
          <>
            <line x1={xOf(up.length / 2, up.length) - mid / 2 - gap / 2} y1={0} x2={xOf(up.length / 2, up.length) - mid / 2 - gap / 2} y2={2 * S + 82} className="midline" />
            <line x1={0} y1={S + 40} x2={width - 12} y2={S + 40} className="midline" />
            {up.map((t, i) => <Tooth key={t} t={t} x={xOf(i, up.length)} y={22} upper props={props} p={p} onTip={onTip} />)}
            {lo.map((t, i) => <Tooth key={t} t={t} x={xOf(i, lo.length)} y={S + 58} upper={false} props={props} p={p} onTip={onTip} />)}
          </>
        )}
      </svg>
      {tip && props.tipFor && (
        <div className="tooth-tip" style={{ left: tip.x + 12, top: tip.y + 12 }} role="tooltip">{props.tipFor(tip.t)}</div>
      )}
    </div>
  )
}

export function Legend() {
  return (
    <div className="legend" aria-label="Legenda internal">
      <div className="legend-title"><strong>{LEGEND_TITLE}</strong><small>{LEGEND_DISCLAIMER}</small></div>
      <ul>
        {LEGEND.map((l) => (
          <li key={l.key}>
            <svg width="26" height="26" viewBox="-4 -4 52 52" aria-hidden><Patterns p="lg-" />
              <rect width={S} height={S} rx={4} fill={fillFor(l.key, 'lg-')} stroke="var(--color-neutral-500)" />{l.scope === 'tooth' && <ToothGlyph cond={l.key} />}
            </svg>
            <span><strong>{l.label}</strong><small>{l.desc}</small></span>
          </li>
        ))}
        <li><svg width="26" height="26" viewBox="-4 -4 52 52" aria-hidden><rect width={S} height={S} rx={4} fill="var(--legend-enamel)" stroke="var(--color-draft-border)" strokeWidth={3} strokeDasharray="6 4" /></svg><span><strong>Garis putus</strong><small>Temuan draf, belum ditandatangani</small></span></li>
        <li><svg width="26" height="26" viewBox="-12 -12 24 24" aria-hidden><g className="plan-mark"><circle r={10} /><text y={4} textAnchor="middle">R</text></g></svg><span><strong>R</strong><small>Ada tindakan rencana</small></span></li>
      </ul>
    </div>
  )
}
