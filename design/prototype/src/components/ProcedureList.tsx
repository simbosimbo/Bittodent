import type { Proc, ProcStatus, Surface } from '../data/types'
import { PROC_STATUSES, STATUS_MVP_NOTE, procStatusOf } from '../data/legend'
import { isUpperTooth, surfaceLetter } from './Odontogram'
import { dateLabel, rupiah } from '../lib/format'
import { Badge, Button } from './ui'

export const STATUS_LABEL: Record<ProcStatus, string> = Object.fromEntries(PROC_STATUSES.map((s) => [s.key, s.label])) as Record<ProcStatus, string>

const tone: Record<ProcStatus, 'neutral' | 'success' | 'primary' | 'warning' | 'info' | 'draft'> = {
  kondisi: 'neutral',
  sudah_ada_sini: 'success',
  sudah_ada_lain: 'info',
  direncanakan: 'warning',
  selesai: 'primary',
  dirujuk: 'draft',
}

export const ProcStatusBadge = ({ st }: { st: ProcStatus }) => {
  const item = procStatusOf(st)
  return <Badge tone={tone[st]}><span className={`st-dot st-${st}`} aria-hidden />{item.label}</Badge>
}

export function formatSurfaces(tooth: number | undefined, surfaces: Surface[]) {
  if (!surfaces.length) return '—'
  return surfaces.map((sf) => surfaceLetter(tooth, sf)).join(', ')
}

export function ProcedureList({ procs, highlight, onComplete, onBill, showFlow = true, empty = 'Belum ada tindakan.', selected, onToggle, colorByStatus = true }: {
  procs: Proc[]; highlight?: string | null; onComplete?: (id: string) => void; onBill?: (id: string) => void; showFlow?: boolean; empty?: string
  selected?: Set<string>; onToggle?: (id: string) => void; colorByStatus?: boolean
}) {
  if (!procs.length) return <p className="muted pad">{empty}</p>
  return (
    <div className="table-wrap">
      <p className="mvp-note" title={STATUS_MVP_NOTE}><span className="badge badge-neutral">Kemungkinan MVP</span> Status tindakan terpisah dari kondisi gigi: kondisi, sudah ada di sini, sudah ada di tempat lain, direncanakan, selesai, dirujuk.</p>
      <table className={`table ${colorByStatus ? 'table-status' : ''}`}>
        <thead><tr>{onToggle && <th className="chk" />}<th>Tanggal</th><th>Gigi</th><th>Permukaan</th><th>Tindakan</th><th>Status</th><th className="num">Biaya</th>{showFlow && <th>Alur</th>}{(onComplete || onBill) && <th><span className="sr-only">Aksi</span></th>}</tr></thead>
        <tbody>
          {procs.map((p) => (
            <tr key={p.id} className={`${p.id === highlight ? 'row-new' : ''} ${selected?.has(p.id) ? 'is-selected' : ''} ${colorByStatus ? `row-st-${p.status}` : ''}`} onClick={() => onToggle?.(p.id)}>
              {onToggle && <td className="chk"><input type="checkbox" checked={selected?.has(p.id) ?? false} onChange={() => onToggle(p.id)} onClick={(e) => e.stopPropagation()} aria-label={`Pilih ${p.name}`} /></td>}
              <td>{dateLabel(p.date)}</td>
              <td>{p.tooth ?? '—'}</td>
              <td>{formatSurfaces(p.tooth, p.surfaces)}{p.tooth && p.surfaces.includes('L') ? <small className="muted"> {isUpperTooth(p.tooth) ? '(P = palatal)' : '(L = lingual)'}</small> : null}</td>
              <td>{p.name}</td>
              <td><ProcStatusBadge st={p.status} /></td>
              <td className="num">{p.fee ? rupiah(p.fee) : '—'}</td>
              {showFlow && <td className="flow-cell">
                {p.status !== 'kondisi' && p.status !== 'sudah_ada_lain' && p.status !== 'sudah_ada_sini' && <>
                  <span className={p.inPlan ? 'ok' : 'off'}>{p.inPlan ? '✓' : '○'} Rencana</span>
                  <span className={p.billed ? 'ok' : 'off'}>{p.billed ? '✓' : '○'} Tagihan</span>
                </>}
              </td>}
              {(onComplete || onBill) && <td className="actions">
                {onBill && !p.billed && (p.status === 'direncanakan' || p.status === 'selesai') && <Button size="sm" variant="primary" onClick={() => onBill(p.id)}>Kirim ke tagihan</Button>}
                {onComplete && p.status === 'direncanakan' && <Button size="sm" onClick={() => onComplete(p.id)}>Tandai selesai</Button>}
              </td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
