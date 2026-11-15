import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import { approveIcd, getPatientIcd, getVisitIcd, type IcdCitation, type IcdItem, type IcdRejectReason, type IcdSuggestions as Data } from './icdApi'
import { pendingRejects } from './pendingReject'
import './icd.css'

// A1 "Saran ICD": every item cites its source (F1 = signed odontogram finding, A/P = SOAP draft text) and stays a draft until
// the dentist taps Setujui. Approving only adds the code to the DRAFT SOAP (A.codes / P.codes); signing stays a separate step.
// Tolak is a delayed commit (5s + Urungkan): drafts are immutable once the reject is recorded.
type Props = {
  patientId: string
  visitId: string | null             // open visit; null => read-only preview
  dirty?: boolean                    // SOAP form has unsaved edits: approving would clash with its revision
  onHighlight?: (keys: string[]) => void
  onChanged?: () => void             // after approve: reload the chart so A.codes / P.codes show
}
type Filter = 'semua' | 'draf' | 'diulas'

const SYSTEM = { icd10: 'ICD-10', icd9cm: 'ICD-9-CM' } as const
const REASONS: { id: IcdRejectReason; label: string }[] = [
  { id: 'tidak_sesuai', label: 'Tidak sesuai' },
  { id: 'sudah_dicatat', label: 'Sudah dicatat' },
  { id: 'terlalu_umum', label: 'Terlalu umum' },
  { id: 'kode_lain', label: 'Kode lain' },
  { id: 'lainnya', label: 'Lainnya' },
]
const keyOf = (c: IcdCitation) => (c.type === 'finding' ? (c.surface ? `t${c.tooth}-${c.surface}` : `t${c.tooth}`) : null)
const citeText = (c: IcdCitation) => (c.type === 'finding' ? `${c.ref} · gigi ${c.tooth}${c.surface ? ' ' + c.surface : ''}` : c.ref === 'A' ? 'A · diagnosis' : 'P · rencana')

function applyPending(data: Data): Data {
  const pending = new Set(pendingRejects.list().map((p) => p.id))
  if (pending.size === 0) return data
  const items = data.items.map((i) => (i.id && pending.has(i.id) ? { ...i, state: 'ditolak' as const } : i))
  const counts = {
    draf: items.filter((i) => i.state === 'draf').length,
    disetujui: items.filter((i) => i.state === 'disetujui').length,
    ditolak: items.filter((i) => i.state === 'ditolak').length,
  }
  return { ...data, items, counts }
}

function StateChip({ state }: { state: IcdItem['state'] }) {
  return state === 'draf' ? <span className="ic-chip ic-chip-draf">✎ Draf</span>
    : state === 'disetujui' ? <span className="ic-chip ic-chip-ok">✓ Disetujui</span>
    : <span className="ic-chip ic-chip-no">✕ Ditolak</span>
}

export default function IcdSuggestions({ patientId, visitId, dirty = false, onHighlight, onChanged }: Props) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [cited, setCited] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('semua')
  const [sheet, setSheet] = useState<string | null>(null)
  const [, setPendingTick] = useState(0)
  const sheetRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      setData(visitId ? await getVisitIcd(visitId) : await getPatientIcd(patientId))
      setError('')
    } catch (e) {
      setError(errorText(e))
    }
  }, [patientId, visitId])
  useEffect(() => { load() }, [load])
  useEffect(() => pendingRejects.subscribe(() => setPendingTick((n) => n + 1)), [])
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(''), 2400)
    return () => clearTimeout(t)
  }, [msg])
  useLayoutEffect(() => {
    const el = sheetRef.current
    if (!el) return
    const fit = () => {
      const vv = window.visualViewport
      const vh = vv?.height ?? window.innerHeight
      const offset = vv?.offsetTop ?? 0
      const top = el.getBoundingClientRect().top
      const safeBot = Number.parseFloat(getComputedStyle(el).getPropertyValue('padding-bottom')) || 0
      el.style.maxHeight = `${Math.max(48 * 2, vh - Math.max(0, top - offset) - 8 - safeBot)}px`
    }
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    fit()
    const vv = window.visualViewport
    vv?.addEventListener('resize', fit)
    window.addEventListener('scroll', fit, true)
    return () => {
      vv?.removeEventListener('resize', fit)
      window.removeEventListener('scroll', fit, true)
    }
  }, [sheet])

  async function act(id: string, fn: () => Promise<unknown>, ok: string, changed: boolean) {
    setBusy(id)
    setSheet(null)
    try {
      await fn()
      setMsg(ok)
      await load()
      if (changed) onChanged?.()
    } catch (e) {
      setMsg(e instanceof ApiError && [409, 422].includes(e.status) ? e.data?.message ?? 'Tidak bisa diproses.' : errorText(e))
      await load()
    } finally {
      setBusy(null)
    }
  }

  function reject(id: string, reason?: IcdRejectReason) {
    setSheet(null)
    setMsg('')
    pendingRejects.queue(id, reason)
  }

  const toggleSource = (key: string, item: IcdItem) => {
    const next = key === cited ? null : key
    setCited(next)
    onHighlight?.(next ? item.citations.map(keyOf).filter((k): k is string => k !== null) : [])
  }

  if (error) return <section className="ic" role="alert"><p className="muted small">{error}</p></section>
  if (!data) return <section className="ic"><p className="muted small">Memuat…</p></section>

  const view = applyPending(data)
  const readOnly = view.locked || !visitId
  const open = view.items.filter((i) => i.state === 'draf')
  const reviewed = view.items.filter((i) => i.state !== 'draf')
  const shown = filter === 'draf' ? open : filter === 'diulas' ? reviewed : open
  const pending = pendingRejects.latest()

  const card = (s: IcdItem) => {
    const key = s.id ?? `${s.system}:${s.code}`
    return (
      <li key={key} className={`ic-card ic-${s.state}`} aria-label={`${SYSTEM[s.system]} ${s.code}`}>
        <div className="ic-row">
          <span className={`ic-sys ic-sys-${s.system}`}>{SYSTEM[s.system]}</span>
          <strong className="ic-code">{s.code}</strong>
          <StateChip state={s.state} />
        </div>
        <div className="ic-display" title={`${s.version} · contoh kamus, perlu dicek`}>{s.display}{s.source === 'model' && <span className="ic-ai"> · AI</span>}</div>
        <button type="button" className={`ic-cite${cited === key ? ' is-on' : ''}`} aria-pressed={cited === key}
          title={s.reason} onClick={() => toggleSource(key, s)}>
          <span aria-hidden>❝</span> {s.citations.map(citeText).join(' · ')}
        </button>
        {s.state === 'draf' && !readOnly && s.id && (
          <>
            <div className="ic-actions">
              <div className="ic-split">
                <button type="button" className="ic-btn ic-no" disabled={!!busy} onClick={() => reject(s.id!)}>Tolak</button>
                <button type="button" className="ic-btn ic-no ic-more" disabled={!!busy} aria-label="Alasan" aria-expanded={sheet === s.id}
                  aria-controls={`ic-alasan-${s.id}`} onClick={() => setSheet(sheet === s.id ? null : s.id!)}>▾</button>
              </div>
              <button type="button" className="ic-btn ic-ok" disabled={!!busy || dirty} title={dirty ? 'Simpan draf SOAP dulu' : undefined}
                onClick={() => act(s.id!, () => approveIcd(s.id!), `${s.code} masuk ${s.system === 'icd10' ? 'A' : 'P'}`, true)}>✓ Setujui</button>
            </div>
            {sheet === s.id && (
              <div className="ic-sheet" id={`ic-alasan-${s.id}`} ref={sheetRef} role="dialog" aria-label="Alasan">
                {REASONS.map((r) => (
                  <button key={r.id} type="button" className="ic-btn ic-reason" disabled={!!busy}
                    onClick={() => reject(s.id!, r.id)}>{r.label}</button>
                ))}
              </div>
            )}
          </>
        )}
      </li>
    )
  }

  return (
    <section className="ic" aria-label="Saran ICD">
      <div className="ic-head">
        <h2>Saran ICD</h2>
        <button type="button" className="ic-info"
          aria-label={`Kamus contoh SATUSEHAT, perlu dicek. ${view.paid ? 'AI memilih dari kamus.' : 'Tanpa AI.'} Setujui = kode masuk SOAP draf, belum ditandatangani.`}
          title={`Kamus contoh SATUSEHAT (perlu dicek) · ${view.paid ? 'AI memilih dari kamus' : 'tanpa AI'} · Setujui = masuk SOAP draf`}>i</button>
      </div>
      <div className="ic-chips" aria-label="Ringkasan status">
        {view.counts.draf > 0 && <span className="ic-chip ic-chip-draf">✎ {view.counts.draf} draf</span>}
        {view.counts.disetujui > 0 && <span className="ic-chip ic-chip-ok">✓ {view.counts.disetujui} disetujui</span>}
        {view.counts.ditolak > 0 && <span className="ic-chip ic-chip-no">✕ {view.counts.ditolak} ditolak</span>}
      </div>
      <div className="ic-bar">
        <div className="ic-seg" role="radiogroup" aria-label="Tampilkan">
          {(['semua', 'draf', 'diulas'] as Filter[]).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={filter === f} className={`ic-tab${filter === f ? ' is-on' : ''}`} onClick={() => { setFilter(f); setSheet(null) }}>
              {f === 'semua' ? 'Semua' : f === 'draf' ? 'Draf' : 'Diulas'}
            </button>
          ))}
        </div>
      </div>
      {pending ? (
        <div className="ic-toast ic-toast-undo" role="status">
          <span>Ditolak</span>
          <button type="button" className="ic-btn ic-undo" onClick={() => pendingRejects.cancel(pending.id)}>Urungkan</button>
        </div>
      ) : msg ? <p className="ic-toast" role="status">{msg}</p> : null}
      {readOnly && <p className="small muted">{visitId ? 'Terkunci: kunjungan sudah ditandatangani.' : 'Pratinjau: buka kunjungan untuk menyetujui.'}</p>}
      {dirty && !readOnly && open.length > 0 && <p className="small ic-warn">Simpan draf SOAP dulu.</p>}
      {view.items.length === 0 ? <p className="ic-empty">Belum ada saran.</p> : (
        <>
          {shown.length > 0 && <ul className="ic-list">{shown.map(card)}</ul>}
          {filter === 'semua' && reviewed.length > 0 && (
            <details className="ic-done" open={pendingRejects.list().length > 0}>
              <summary>{reviewed.length} sudah diulas</summary>
              <ul className="ic-list">{reviewed.map(card)}</ul>
            </details>
          )}
          {filter !== 'semua' && shown.length === 0 && <p className="ic-empty">Tidak ada.</p>}
        </>
      )}
    </section>
  )
}
