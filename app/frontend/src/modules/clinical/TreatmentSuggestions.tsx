import { useCallback, useEffect, useState } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import {
  approveAllSuggestions, approveSuggestion, getPatientSuggestions, getVisitSuggestions, rejectSuggestion,
  type Citation, type Suggestion, type Suggestions,
} from './api'
import { conditionOf, surfaceLabel } from './legend'
import './suggestions.css'

// A2 "Saran tindakan" (board klinikme-gigi AI03 + 11). Rule-based, no AI model: every item cites the odontogram findings it came
// from and stays a draft until the dentist taps Setujui. Built for gloves/hurry: one tap per item, 44px+ targets, Setujui semua
// sticks to the bottom. Approving only adds a DRAFT plan item to the visit (signed later with the visit), never a note.
// Mount points: Chart (main) and, for PR #52, the Dokter mode "Sedang dirawat" card / RM sheet (same props).
type Props = {
  patientId: string
  visitId: string | null          // open visit; null => read-only preview for the patient
  onHighlight?: (keys: string[]) => void   // odontogram keys of the cited findings ("t26-O", "t18"); [] clears
  onChanged?: () => void          // after approve: reload the chart so the new draft plan items show
}
type Filter = 'semua' | 'draf' | 'diulas'

export const citationKey = (c: Pick<Citation, 'tooth' | 'surface'>) => (c.surface ? `t${c.tooth}-${c.surface}` : `t${c.tooth}`)
const where = (s: Pick<Suggestion, 'tooth' | 'surfaces'>) =>
  `Gigi ${s.tooth}${s.surfaces.length ? ' · ' + s.surfaces.map((x) => surfaceLabel(s.tooth, x)).join(', ') : ''}`
const citeText = (s: Suggestion) => {
  const c = s.citations[0]
  const surf = s.citations.map((x) => x.surface).filter(Boolean).map((x) => surfaceLabel(s.tooth, x!))
  return `${c.tooth} ${(conditionOf(c.condition)?.label ?? c.condition).toLowerCase()}${surf.length ? ' ' + surf.join(', ') : ''}`
}

function StateChip({ state }: { state: Suggestion['state'] }) {
  return state === 'draf' ? <span className="sg-chip sg-chip-draf">✎ Draf</span>
    : state === 'disetujui' ? <span className="sg-chip sg-chip-ok">✓ Disetujui</span>
    : <span className="sg-chip sg-chip-no">✕ Ditolak</span>
}

export default function TreatmentSuggestions({ patientId, visitId, onHighlight, onChanged }: Props) {
  const [data, setData] = useState<Suggestions | null>(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState<string | null>(null)   // item id, 'all' or null
  const [cited, setCited] = useState<string | null>(null) // item whose source is open
  const [filter, setFilter] = useState<Filter>('semua')

  const load = useCallback(async () => {
    try {
      setData(visitId ? await getVisitSuggestions(visitId) : await getPatientSuggestions(patientId))
      setError('')
    } catch (e) {
      setError(errorText(e))
    }
  }, [patientId, visitId])
  useEffect(() => { load() }, [load])

  const showSource = (s: Suggestion | null) => {
    const key = s ? s.id ?? `${s.tooth}|${s.rule.key}` : null
    const next = key === cited ? null : key
    setCited(next)
    onHighlight?.(next && s ? s.citations.map(citationKey) : [])
  }

  async function act(id: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(id)
    setMsg('')
    try {
      await fn()
      setMsg(ok)
      await load()
      onChanged?.()
    } catch (e) {
      setMsg(e instanceof ApiError && [409, 422].includes(e.status) ? e.data?.message ?? 'Saran tidak bisa diproses.' : errorText(e))
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (error) return <div className="sg" role="alert"><p className="muted small">{error}</p></div>
  if (!data) return <div className="sg"><p className="muted small">Memuat saran tindakan…</p></div>

  const open = data.items.filter((i) => i.state === 'draf')
  const reviewed = data.items.filter((i) => i.state !== 'draf')
  const ready = open.filter((i) => !i.stale && i.id)
  const readOnly = data.locked || !visitId
  const shown = filter === 'draf' ? open : filter === 'diulas' ? reviewed : open

  const card = (s: Suggestion) => {
    const key = s.id ?? `${s.tooth}|${s.rule.key}`
    return (
      <li key={key} className={`sg-card sg-${s.state}${s.stale ? ' is-stale' : ''}`} aria-label={`${s.procedure_name}, ${where(s)}`}>
        <div className="sg-card-head">
          <div className="sg-title">
            <strong>{s.procedure_name}</strong> <span className="mono small muted">{s.procedure_code}</span>
            <div className="small">{where(s)}</div>
          </div>
          <StateChip state={s.state} />
          <button type="button" className={`sg-cite${cited === key ? ' is-on' : ''}`} aria-pressed={cited === key}
            aria-label={`Sumber: temuan ${citeText(s)}`} onClick={() => showSource(s)}>
            <span aria-hidden>❝</span> {citeText(s)}
          </button>
        </div>
        {cited === key && (
          <div className="sg-source" role="region" aria-label="Sumber saran">
            <span className="small muted">SUMBER · odontogram</span>
            <ul>
              {s.citations.map((c) => (
                <li key={c.id}><mark>Gigi {c.tooth}{c.surface ? ' ' + surfaceLabel(c.tooth, c.surface) : ''}: {conditionOf(c.condition)?.label ?? c.condition}</mark>
                  <span className="small muted"> · versi {c.version} · ditandatangani</span></li>
              ))}
            </ul>
            {s.signal.approvals > 0 && <p className="small muted">Anda menyetujui aturan ini {s.signal.approvals}× sebelumnya.</p>}
          </div>
        )}
        {s.stale && <p className="small sg-stale">Temuan sumber berubah. Muat ulang saran.</p>}
        {s.state === 'draf' && !readOnly && s.id && (
          <div className="sg-actions">
            <button type="button" className="sg-btn sg-no" disabled={!!busy} onClick={() => act(s.id!, () => rejectSuggestion(s.id!), 'Saran ditolak (dicatat sebagai umpan balik).')}>Tolak</button>
            <button type="button" className="sg-btn sg-ok" disabled={!!busy || s.stale} onClick={() => act(s.id!, () => approveSuggestion(s.id!), `Disetujui: ${s.procedure_name} gigi ${s.tooth} masuk rencana (draf).`)}>
              ✓ Setujui
            </button>
          </div>
        )}
      </li>
    )
  }

  return (
    <section className="sg" aria-label="Saran tindakan">
      <div className="sg-chips" aria-label="Ringkasan status">
        <span className="sg-chip sg-chip-draf">✎ {data.counts.draf} draf</span>
        <span className="sg-chip sg-chip-ok">✓ {data.counts.disetujui} disetujui</span>
        <span className="sg-chip sg-chip-no">✕ {data.counts.ditolak} ditolak</span>
      </div>
      <div className="sg-bar">
        <div className="sg-seg" role="radiogroup" aria-label="Tampilkan">
          {(['semua', 'draf', 'diulas'] as Filter[]).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={filter === f} className={filter === f ? 'is-on' : ''} onClick={() => setFilter(f)}>
              {f === 'semua' ? 'Semua' : f === 'draf' ? 'Draf' : 'Diulas'}
            </button>
          ))}
        </div>
        <span className="small muted">Hanya dari temuan di odontogram · aturan klinik, bukan AI</span>
      </div>
      {msg && <p className="notice" role="status">{msg}</p>}
      {readOnly && <p className="small muted">{visitId ? 'Kunjungan sudah ditandatangani; saran hanya bisa dibaca.' : 'Pratinjau: buka kunjungan untuk menyetujui.'}</p>}

      {data.items.length === 0 ? (
        <p className="sg-empty">Tidak ada saran. Saran muncul dari temuan odontogram yang sudah ditandatangani dan belum direncanakan.</p>
      ) : (
        <>
          {shown.length > 0 && <ul className="sg-list">{shown.map(card)}</ul>}
          {filter === 'semua' && reviewed.length > 0 && (
            <details className="sg-done">
              <summary>{reviewed.length} sudah diulas</summary>
              <ul className="sg-list">{reviewed.map(card)}</ul>
            </details>
          )}
          {filter !== 'semua' && shown.length === 0 && <p className="sg-empty">Tidak ada.</p>}
        </>
      )}

      {!readOnly && ready.length > 0 && visitId && (
        <div className="sg-sticky">
          <button type="button" className="sg-btn sg-all" disabled={!!busy}
            onClick={() => act('all', () => approveAllSuggestions(visitId), `${ready.length} saran disetujui dan masuk rencana (draf).`)}>
            ✓ Setujui semua ({ready.length})
          </button>
        </div>
      )}
    </section>
  )
}
