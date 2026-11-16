import type { ReactElement } from 'react'
import type { Source, Surface, ToothPresence } from './api'
import { Glyph as V2Glyph, SymbolDefs } from './odontogram/symbols'
import type { Symbol } from './odontogram/taxonomy'
import { CONDITIONS, conditionOf, statusOf, isAnterior, isUpper, LOWER, LOWER_PRIMARY, surfaceLabel, surfaceName, surfacesOf, UPPER, UPPER_PRIMARY } from './legend'

// FDI chart, operator view (patient's right on the chart's left). Ids follow design/odontogram: tooth "t16", surface "t16-O".
// data-state on .tooth: empty | draft (dashed violet) | signed (solid + lock). data-condition on surfaces / whole tooth.
// data-status (legend.json statuses) is a separate layer from data-condition; data-baseline="missing" ghosts a tooth absent at baseline.
// paint = procedure paint_type (Filling, Crown, ...) when the mark comes from a treatment; data-paint lets CSS style it later.
export type Mark = { condition: string; state: 'draft' | 'signed'; source: Source; status?: string; paint?: string
  /** odontogram v2 row: official symbol + code + entry status (rencana = dashed, lain = badge L, selesai = check) */
  symbol?: Symbol; code?: string | null; entry?: 'ada_sebelumnya' | 'klinik_lain' | 'rencana' | 'selesai'; label?: string }
type Props = { marks: Record<string, Mark>; selected?: string | null; onPick?: (tooth: number, surface: Surface) => void
  baseline?: Record<string, ToothPresence>; dentition?: string; compact?: boolean
  /** Phone: draw one jaw only (tight viewBox). Omitted = both jaws in one SVG, as on desktop. */
  arch?: 'upper' | 'lower'
  /** Phone (review-2): a tap anywhere on the tooth (48px+ box) picks the tooth with its centre surface; surfaces are chosen on the sheet's 56px pad. */
  wholeTooth?: boolean
  /** T1 gaya kasir: a tindakan is waiting for its tooth; every present tooth gets a ring (a line, not only a colour). */
  picking?: boolean }
const DENTITION: Record<string, string> = { tetap: 'permanent', sulung: 'primary', campuran: 'mixed' }

const S = 44
const K_DESK = 12
/** Phone (one jaw per SVG, `arch` set): thinner side surfaces so the centre (O/I, the usual tap) is ~60% of the tooth (#70). */
const K_PHONE = 8

function Glyph({ cond }: { cond: string }) {
  const c = conditionOf(cond)?.color
  const m = S / 2
  switch (cond) {
    case 'mahkota': return <rect x={-3} y={-3} width={S + 6} height={S + 6} rx={10} fill="none" stroke={c} strokeWidth={4} />
    case 'hilang': return <g stroke={c} strokeWidth={3.5} strokeLinecap="square"><line x1={4} y1={4} x2={S - 4} y2={S - 4} /><line x1={S - 4} y1={4} x2={4} y2={S - 4} /></g>
    case 'sisa_akar': return <path d={`M8 ${m} L${m - 4} ${S - 6} L${S - 6} 6`} fill="none" stroke={c} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    case 'perlu_dicabut': return <g stroke={c} strokeWidth={3.5}><line x1={4} y1={S - 4} x2={S - 4} y2={4} /><path d={`M${S - 14} 4 H${S - 4} V14`} fill="none" /></g>
    case 'implan': return <g stroke={c} strokeWidth={3}><line x1={m} y1={5} x2={m} y2={S - 5} />{[12, 19, 26, 33].map((y) => <line key={y} x1={m - 8} y1={y} x2={m + 8} y2={y} />)}</g>
    default: return null
  }
}

function Tooth({ t, x, y, marks, selected, onPick, baseline, arch, wholeTooth, picking }: Props & { t: number; x: number; y: number }) {
  const K = arch ? K_PHONE : K_DESK
  const upper = isUpper(t)
  const q = Math.floor(t / 10)
  const mesialRight = [1, 4, 5, 8].includes(q) // M faces the midline
  const center: Surface = isAnterior(t) ? 'I' : 'O'
  const poly = {
    top: `0,0 ${S},0 ${S - K},${K} ${K},${K}`,
    bottom: `${K},${S - K} ${S - K},${S - K} ${S},${S} 0,${S}`,
    left: `0,0 ${K},${K} ${K},${S - K} 0,${S}`,
    right: `${S},0 ${S},${S} ${S - K},${S - K} ${S - K},${K}`,
  }
  const shapes: [Surface, ReactElement][] = [
    [upper ? 'B' : 'L', <polygon points={poly.top} />],
    [upper ? 'L' : 'B', <polygon points={poly.bottom} />],
    [mesialRight ? 'D' : 'M', <polygon points={poly.left} />],
    [mesialRight ? 'M' : 'D', <polygon points={poly.right} />],
    [center, <rect x={K} y={K} width={S - 2 * K} height={S - 2 * K} />],
  ]
  const whole = marks[`t${t}`]
  const all = [whole, ...surfacesOf(t).map((s) => marks[`t${t}-${s}`])].filter(Boolean) as Mark[]
  const state = all.some((m) => m.state === 'draft') ? 'draft' : all.length ? 'signed' : 'empty'
  return (
    <g id={`t${t}`} className="tooth" data-tooth={t} data-state={state} data-condition={whole?.condition} data-status={whole && statusOf(whole.status ?? '')?.legend} data-paint={whole?.paint}
      data-baseline={baseline?.[t] && baseline[t] !== 'ada' ? 'missing' : undefined} transform={`translate(${x},${y})`}>
      {wholeTooth && onPick && <rect className="tooth-hit" x={-4} y={-4} width={S + 8} height={S + 8} fill="transparent" onClick={() => onPick(t, center)} />}
      {state === 'draft' && <rect className="tooth-wash" x={-4} y={-4} width={S + 8} height={S + 8} rx={6} />}
      {picking && !(baseline?.[t] && baseline[t] !== 'ada') && <rect className="tooth-ring" x={-3} y={-3} width={S + 6} height={S + 6} rx={6} />}
      {shapes.map(([s, shape]) => {
        const m = marks[`t${t}-${s}`]
        const label = `Gigi ${t} ${surfaceName(t, s)}${m ? ': ' + (m.label ?? conditionOf(m.condition)?.label ?? m.condition) + (m.status ? ', ' + (statusOf(m.status)?.label ?? m.status) : '') + (m.state === 'draft' ? ' (draf)' : '') : ''}${baseline?.[t] && baseline[t] !== 'ada' ? ' (baseline: ' + (baseline[t] === 'hilang' ? 'tidak ada' : 'belum tumbuh') + ')' : ''}`
        return (
          <g key={s} id={`t${t}-${s}`} className={`tooth-surface${selected === `t${t}-${s}` ? ' is-sel' : ''}`} data-surface={s}
            data-condition={m?.condition} data-state={m?.state} data-status={m && statusOf(m.status ?? '')?.legend} data-paint={m?.paint} data-symbol={m?.symbol} data-entry={m?.entry} role={onPick ? 'button' : undefined} tabIndex={onPick ? 0 : undefined} aria-label={label}
            onClick={onPick && (() => onPick(t, wholeTooth ? center : s))} onKeyDown={onPick && ((e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(t, s) } })}>
            <title>{label}</title>
            {shape}
          </g>
        )
      })}
      <rect className="tooth-outline" x={0} y={0} width={S} height={S} rx={3} />
      {whole && !whole.symbol && <g className="tooth-glyph" data-state={whole.state}><Glyph cond={whole.condition} /></g>}
      {whole?.symbol && <g className="tooth-glyph-v2" data-state={whole.state}><V2Glyph symbol={whole.symbol} code={whole.code} size={S} planned={whole.entry === 'rencana'} /></g>}
      {[whole, ...surfacesOf(t).map((s) => marks[`t${t}-${s}`])].find((m) => m?.entry === 'klinik_lain' || m?.entry === 'selesai') && (
        <text className="tooth-badge" x={-6} y={upper ? -2 : S + 8}>{[whole, ...surfacesOf(t).map((s) => marks[`t${t}-${s}`])].some((m) => m?.entry === 'klinik_lain') ? 'L' : '✓'}</text>)}
      {state === 'draft' && <path className="tooth-draft-mark" d={`M${S} -6 l5 5 l-5 5 l-5 -5 Z`} />}
      {state === 'signed' && <g className="tooth-lock" transform={`translate(${S - 4},-8)`}><rect x={0} y={4} width={9} height={7} rx={1} /><path d="M2 4 V2.5 a2.5 2.5 0 0 1 5 0 V4" fill="none" strokeWidth={1.4} /></g>}
      <text className="tooth-letter" x={S / 2} y={upper ? S - 2 : 10} textAnchor="middle" aria-hidden>{surfaceLabel(t, 'L')}</text>
      <text className="tooth-number" x={S / 2} y={upper ? -8 : S + 18} textAnchor="middle">{t}</text>
    </g>
  )
}

export function Odontogram(props: Props) {
  const gap = 10, mid = 18, row = S + 38
  const xOf = (i: number) => 12 + i * (S + gap) + (i >= 8 ? mid : 0)
  const width = 16 * (S + gap) + mid + 24
  // Only the rows of the chosen dentition (undefined = all four, as before); kept rows close up vertically.
  const all: [number[], boolean, 'upper' | 'lower'][] = [[UPPER, false, 'upper'], [UPPER_PRIMARY, true, 'upper'], [LOWER_PRIMARY, true, 'lower'], [LOWER, false, 'lower']]
  const rows = all.filter(([, primary, arch]) => (!props.arch || arch === props.arch)
    && (props.dentition === 'tetap' ? !primary : props.dentition === 'sulung' ? primary : true))
  const name = props.arch ? `Rahang ${props.arch === 'upper' ? 'atas' : 'bawah'}` : 'Odontogram'
  return (
    <svg className={`odontogram${props.compact ? ' is-compact' : ''}`} data-dentition={props.dentition ? DENTITION[props.dentition] : 'mixed'} viewBox={`-6 -6 ${width} ${rows.length * row + 30}`} role="group" aria-label={`${name} (FDI). Pilih permukaan untuk mengisi kondisi.`}>
      <SymbolDefs />
      <defs>
        {/* karies always carries dots (colour is never the only signal) */}
        <pattern id="odo-dots" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#BE123C" /><circle cx="3" cy="3" r="1.3" fill="#fff" /></pattern>
      </defs>
      <line className="midline" x1={xOf(8) - mid / 2 - gap / 2} y1={0} x2={xOf(8) - mid / 2 - gap / 2} y2={rows.length * row + 20} />
      {rows.map(([teeth, primary], r) => teeth.map((t, i) => (
        <Tooth key={t} t={t} x={xOf(primary ? i + 3 : i)} y={22 + r * row} {...props} />
      )))}
    </svg>
  )
}

export function Legend() {
  return (
    <ul className="odo-legend" aria-label="Legenda internal (bukan formulir resmi)">
      {CONDITIONS.map((c) => (
        <li key={c.key}><span className={`swatch swatch-${c.key}`} style={{ borderColor: c.color }} /> {c.label}{c.whole ? ' (seluruh gigi)' : ''}</li>
      ))}
      <li><span className="swatch swatch-draft" /> Draf (garis putus ungu)</li>
      <li><span className="swatch swatch-signed" /> Ditandatangani (terkunci)</li>
    </ul>
  )
}
