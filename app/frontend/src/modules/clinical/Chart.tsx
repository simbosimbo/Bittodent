import { useCallback, useEffect, useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode, useRef } from 'react'
import { DateField } from '../../shared/ui/DateField'
import { useDialog } from '../../shared/ui/Sheet'
import { Presence, usePresenceClass } from '../../shared/ui/presence'
import { PageSkeleton } from '../../shared/ui/Skeleton'
import { ApiError, errorText } from '../../shared/api/http'
import { setActivePatient } from '../../shared/activePatient'
import { fmtDateTime, fmtDay, fmtTime } from '../../shared/format'
import type { Me } from '../../shared/session'
import { ToothSheet as EntrySheet } from './odontogram/ToothSheet'
import { OfficialLegend } from './odontogram/OfficialLegend'
import { ExamPalette, useExam } from './odontogram/ExamPalette'
import { conditionByKey, spanTeeth, TAXONOMY, type SurfaceKey } from './odontogram/taxonomy'
// procedure status -> v2 entry status (line shape on the chart)
const ENTRY: Partial<Record<string, Mark['entry']>> = { ada_di_klinik_ini: 'ada_sebelumnya', ada_di_tempat_lain: 'klinik_lain', direncanakan: 'rencana', selesai: 'selesai' }
import { PHONE_QUERY, useIsMobile, useMedia } from '../../shared/useIsMobile'
import { PatientPage } from '../patients'
import type { PatientFull } from '../patients'
import {
  approveCorrection, approveDrafts, changeStatus, confirmExternal, correctNote, correctProcedure, discardProcedure, getChart, getDentists,
  replaceProcedure, saveNote, saveProcedure, selesaiVisit, getCatalog, getStages, type CatalogRow, startWalkInVisit, visitFromAppointment,
  type Baseline, type Chart, type ChartVisit, type CorrectionType, type Finding, type Note, type ProcStatus, type Procedure, type ProcedureHistoryRow,
  type Soap, type Surface, type Version,
} from './api'
import { AI_BADGE, CONDITIONS, conditionOf, CORRECTION_LABEL, findingText, isAnterior, paintCondition, procedureText, statusOf,
  surfaceLabel, surfaceName, toothAnatomicalName } from './legend'
import { Odontogram, type Mark } from './Odontogram'
import { dentitionFromDob, Odontogram3D } from './Odontogram3D'
import { SelesaiDialog } from './SelesaiDialog'
import { CloseVisit } from './CloseVisit'
import { fillEmpty, SOAP_TEMPLATES } from './quick'
import './clinical.css'

type Form = { S: string; O: string; A: { codes: string; text: string }; P: { codes: string; text: string } }
const EMPTY: Form = { S: '', O: '', A: { codes: '', text: '' }, P: { codes: '', text: '' } }
const toForm = (s: Soap): Form => ({ S: s.S, O: s.O, A: { codes: s.A.codes.join(', '), text: s.A.text }, P: { codes: s.P.codes.join(', '), text: s.P.text } })
const codes = (s: string) => s.split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter(Boolean)
const toSoap = (f: Form): Soap => ({ S: f.S, O: f.O, A: { codes: codes(f.A.codes), text: f.A.text }, P: { codes: codes(f.P.codes), text: f.P.text } })
const TABS = [['S', 'Subjektif'], ['O', 'Objektif'], ['A', 'Asesmen (ICD-10)'], ['P', 'Rencana (ICD-9-CM)']] as const
const fmt = (iso: string | null) => iso ? fmtDateTime(iso) : '—'
// Header chip for the in-progress visit; dentist from the visit only (omitted when unknown), "drg." not doubled.
const drName = (n: string | null | undefined) => { const name = n?.trim(); return name ? (/^(drg|dr)\./i.test(name) ? name : 'drg. ' + name) : '' }
export function visitStatusText(v: Pick<ChartVisit, 'started_at' | 'dentist'>, short = false) {
  return [short ? 'Dirawat' : 'Sedang dirawat', drName(v.dentist.name), (short ? '' : 'sejak ') + fmtTime(v.started_at)].filter(Boolean).join(' · ')
}
// Modal focus trap: Tab / Shift+Tab wrap inside `el`.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
function trapTab(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Tab') return
  const f = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)]
  if (!f.length) return
  const [first, last] = [f[0], f[f.length - 1]]
  if (e.shiftKey ? document.activeElement === first || !e.currentTarget.contains(document.activeElement) : document.activeElement === last) {
    e.preventDefault()
    ;(e.shiftKey ? last : first).focus()
  }
}
/** "2 karies · 1 tambalan" over current rows, CONDITIONS order, zero counts skipped. */
/**
 * "8 gigi hilang (mis) · 1 tambalan amalgam (amf) · 21 sehat (sou)": legacy findings + odontogram v2 entries, counted per tooth per
 * condition (a span counts each tooth). Same exclusions as the chart: cancelled / not done / superseded rows and unconfirmed externals.
 */
export function findingSummary(items: { condition: string }[], procs: Procedure[] = []) {
  const legacy = CONDITIONS.map((c) => [items.filter((f) => f.condition === c.key).length, c.label.toLowerCase()] as const).filter(([n]) => n).map(([n, l]) => `${n} ${l}`)
  const teeth = new Map<string, Set<number>>()
  for (const p of procs) {
    if (!p.condition || ['cancelled', 'superseded', 'tidak_dikerjakan'].includes(p.status) || p.external_confirmation === 'pending' || p.external_confirmation === 'rejected') continue
    const ts = p.tooth !== null ? [p.tooth] : p.tooth_range ? spanTeeth(...(p.tooth_range.split('-').map(Number) as [number, number])) : []
    teeth.set(p.condition, new Set([...(teeth.get(p.condition) ?? []), ...ts]))
  }
  const v2 = TAXONOMY.conditions.filter((c) => teeth.get(c.key)?.size).map((c) => `${teeth.get(c.key)!.size} ${c.label.toLowerCase()} (${c.code ?? 'panah'})`)
  return [...legacy, ...v2].join(' · ')
}
const FREE_EDIT_MS = 48 * 3600 * 1000
// "sehat (sou)" is an exam finding stored as a procedure_record row: drawn and signed, never counted or listed as work (audit P2-3)
const isWork = (p: Procedure) => p.condition !== 'sehat'
const INNER = [['odo', 'Odontogram'], ['notes', 'Catatan Klinis'], ['bill', 'Billing']] as const
// Surface keypad (sketch): lingual/palatal top, M left, O/I centre, D right, buccal/labial bottom. Labels come from surfaceLabel.
const PAD: [Surface, string][] = [['L', 'top'], ['M', 'left'], ['O', 'center'], ['D', 'right'], ['B', 'bottom']]

function StatusBadge({ v }: { v: Version }) {
  return (
    <>
      {v.status === 'draf' ? <span className="badge badge-draft">Draf</span>
        : v.status === 'berlaku' ? <span className="badge badge-signed">🔒 Selesai</span>
        : <span className="badge badge-old">Digantikan</span>}
      {v.status === 'draf' && v.source === 'ai_draft' && <span className="badge badge-ai">{AI_BADGE}</span>}
    </>
  )
}

function SoapFields({ form, onChange, readOnly, stacked }: { form: Form; onChange?: (f: Form) => void; readOnly?: boolean; stacked?: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('S')
  const set = (patch: Partial<Form>) => onChange?.({ ...form, ...patch })
  // Phone (#70): S/O/A/P stacked, no sub-tabs (fewer taps, one scroll).
  if (stacked) return (
    <div className="soap soap-stacked">
      {TABS.map(([k, label]) => (k === 'S' || k === 'O')
        ? <label key={k}>{k} — {label}<textarea rows={2} aria-label={k} readOnly={readOnly} value={form[k]} onChange={(e) => set({ [k]: e.target.value })} placeholder="Tulis catatan…" /></label>
        : <div key={k} className="soap-row"><span className="soap-k">{k} — {label}</span>
            <input className="mono" aria-label={k === 'A' ? 'Kode ICD-10' : 'Kode ICD-9-CM'} readOnly={readOnly} value={form[k].codes} placeholder={k === 'A' ? 'K02.1' : '23.2'}
              onChange={(e) => set({ [k]: { ...form[k], codes: e.target.value } })} />
            <input aria-label={`${k} teks`} readOnly={readOnly} value={form[k].text} placeholder="Keterangan…" onChange={(e) => set({ [k]: { ...form[k], text: e.target.value } })} />
          </div>)}
    </div>
  )
  return (
    <div className="soap">
      <div role="tablist" className="tabs">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>{k} — {label}</button>
        ))}
      </div>
      <div role="tabpanel" className="soap-panel">
        {(tab === 'S' || tab === 'O') && (
          <textarea rows={5} aria-label={tab} readOnly={readOnly} value={form[tab]} onChange={(e) => set({ [tab]: e.target.value })} placeholder="Tulis catatan…" />
        )}
        {(tab === 'A' || tab === 'P') && (
          <>
            <label>{tab === 'A' ? 'Kode ICD-10 (pisahkan dengan koma)' : 'Kode ICD-9-CM (opsional)'}
              <input className="mono" readOnly={readOnly} value={form[tab].codes} placeholder={tab === 'A' ? 'K02.1' : '23.2'}
                onChange={(e) => set({ [tab]: { ...form[tab], codes: e.target.value } })} />
            </label>
            <textarea rows={4} aria-label={`${tab} teks`} readOnly={readOnly} value={form[tab].text} placeholder="Keterangan…"
              onChange={(e) => set({ [tab]: { ...form[tab], text: e.target.value } })} />
          </>
        )}
      </div>
    </div>
  )
}

function CorrectionDialog({ note, solo, onDone, onClose }: { note: Note; solo: boolean; onDone: () => void; onClose: () => void }) {
  const current = note.versions.find((v) => v.status === 'berlaku')!
  const first = note.versions.find((v) => v.signed_at)!
  const [form, setForm] = useState(toForm(current.soap))
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const late = Date.now() - new Date(first.signed_at!).getTime() > FREE_EDIT_MS
  const info = !late ? 'Masih dalam 2x24 jam sejak ditandatangani: koreksi langsung berlaku.'
    : solo ? 'Lewat 2x24 jam. Praktik mandiri: Anda menyetujui sendiri, alasan dicatat di jejak audit.'
    : 'Lewat 2x24 jam: perlu persetujuan pemilik klinik sebelum versi baru berlaku.'
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (reason.trim().length < 10) return setError('Alasan koreksi wajib, minimal 10 huruf.')
    setBusy(true)
    try {
      await correctNote(note.id, { reason: reason.trim(), soap: toSoap(form) })
      onDone()
    } catch (err) {
      setError(err instanceof ApiError && (err.status === 409 || err.status === 422) ? err.data?.message ?? 'Data tidak valid.' : errorText(err))
      setBusy(false)
    }
  }
  // Phone: bottom sheet (styles.css) with modal focus/Escape/scroll lock; desktop behaviour unchanged.
  const dlg = useRef<HTMLFormElement>(null)
  const phase = usePresenceClass()
  useDialog(dlg, onClose, useIsMobile())
  return (
    <div className={`overlay ${phase}`} onClick={onClose}>
      <form ref={dlg} className="card dialog dialog-wide" role="dialog" aria-modal="true" aria-labelledby="fix-title" onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
        <h2 id="fix-title">Koreksi catatan (versi {current.version} → {Math.max(...note.versions.map((v) => v.version)) + 1})</h2>
        <p className={late ? 'notice notice-warn' : 'notice'}>{info}</p>
        <label>Alasan koreksi *<textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!error} /></label>
        <SoapFields form={form} onChange={setForm} />
        <p className="muted small">Versi {current.version} tetap tersimpan dan ditandai “Digantikan”.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan…' : late && !solo ? 'Ajukan koreksi' : 'Simpan koreksi'}</button>
        </div>
      </form>
    </div>
  )
}

function History({ visits, me, onFix, onApprove }: { visits: ChartVisit[]; me: Me; onFix: (n: Note) => void; onApprove: (id: string) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const can = (p: string) => me.permissions.includes(p)
  if (!visits.length) return <p className="muted">Belum ada kunjungan.</p>
  return (
    <ol className="timeline">
      {visits.map((v) => (
        <li key={v.id}>
          <div className="timeline-head"><strong>{fmt(v.started_at)}</strong> <span className="muted small">{v.dentist.name}</span></div>
          {v.notes.length === 0 && <p className="muted small">Belum ada catatan.</p>}
          {v.notes.map((n) => (
            <div key={n.id}>
              {n.pending_correction && (
                <div className="notice notice-warn">
                  Koreksi menunggu persetujuan pemilik ({n.pending_correction.requested_by_name}): “{n.pending_correction.reason}”
                  {can('correction.approve') && n.pending_correction.requested_by !== me.user.id && (
                    <button className="btn btn-xs" onClick={() => onApprove(n.pending_correction!.id)}>Setujui</button>
                  )}
                </div>
              )}
              {[...n.versions].reverse().map((x) => (
                <div key={x.id} className={`version version-${x.status}`}>
                  <button className="version-row" aria-expanded={open === x.id} onClick={() => setOpen(open === x.id ? null : x.id)}>
                    <strong>Versi {x.version}</strong> <StatusBadge v={x} />
                    {x.supersedes_id && <span className="badge badge-fix">Dikoreksi</span>}
                    <span className="muted small">{x.signed_at ? `${x.signed_by_name ?? ''} · ${fmt(x.signed_at)}` : 'Belum ditandatangani'}</span>
                  </button>
                  {x.reason && <p className="small">Alasan koreksi: {x.reason}</p>}
                  {open === x.id && <SoapFields form={toForm(x.soap)} readOnly />}
                  {x.status === 'berlaku' && !n.pending_correction && n.author_id === me.user.id && can('note.sign') && (
                    <button className="btn btn-xs" onClick={() => onFix(n)}>Koreksi</button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </li>
      ))}
    </ol>
  )
}

const REPLACEABLE: ProcStatus[] = ['selesai', 'ada_di_klinik_ini', 'ada_di_tempat_lain']
const CHANGE_LABEL = { digantikan: 'Digantikan', koreksi: 'Dikoreksi', status: 'Status berubah' } as const

/** Replace (new work on the same site; old kept as Digantikan) or correct (same status, new row) a signed procedure. Reason required. */
export function ProcedureFixDialog({ p, mode, visitId, onDone, onClose }: { p: Procedure; mode: 'ganti' | 'koreksi'; visitId: string | null; onDone: (msg: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [code, setCode] = useState(mode === 'koreksi' ? p.procedure_code ?? '' : '')
  const [surfaces, setSurfaces] = useState(mode === 'koreksi' ? p.surfaces ?? '' : '') // a crown is whole-tooth; a re-filling types its surfaces
  const [to, setTo] = useState<'direncanakan' | 'selesai'>('direncanakan')
  const [type, setType] = useState<CorrectionType | ''>('')
  const notDone = type === 'tidak_dikerjakan'
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (reason.trim().length < 10) return setError('Alasan wajib, minimal 10 huruf.')
    if (mode === 'koreksi' && !type) return setError('Pilih jenis koreksi.')
    if (mode === 'ganti' && (!visitId || !code.trim())) return setError(visitId ? 'Kode tindakan pengganti wajib.' : 'Buka kunjungan aktif dulu.')
    setBusy(true)
    try {
      const sf = surfaces.trim().toUpperCase() || null
      if (mode === 'ganti') await replaceProcedure(p.id, { visit_id: visitId!, status: to, procedure_code: code.trim(), tooth: p.tooth, surfaces: sf, reason: reason.trim() })
      else {
        const r = await correctProcedure(p.id, notDone ? { reason_type: 'tidak_dikerjakan', reason: reason.trim() }
          : { reason_type: type as CorrectionType, reason: reason.trim(), procedure_code: code.trim() || undefined, surfaces: sf })
        return onDone(r.approval === 'pending' ? `Di luar tenggat ${r.window_hours} jam: Menunggu persetujuan pemilik.` : 'Koreksi tersimpan (baris baru; versi lama tetap).')
      }
      onDone('Tindakan lama ditandai Digantikan; tindakan baru tercatat.')
    } catch (err) {
      setError(err instanceof ApiError && (err.status === 409 || err.status === 422) ? err.data?.message ?? 'Data tidak valid.' : errorText(err))
      setBusy(false)
    }
  }
  // Phone: bottom sheet (styles.css) with modal focus/Escape/scroll lock; desktop behaviour unchanged.
  const dlg = useRef<HTMLFormElement>(null)
  const phase = usePresenceClass()
  useDialog(dlg, onClose, useIsMobile())
  return (
    <div className={`overlay ${phase}`} onClick={onClose}>
      <form ref={dlg} className="card dialog" role="dialog" aria-modal="true" aria-labelledby="pfix-title" onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
        <h2 id="pfix-title">{mode === 'ganti' ? 'Ganti tindakan' : 'Koreksi tindakan'}: {procedureText(p)}</h2>
        {mode === 'koreksi' && <label>Jenis koreksi * <select value={type} onChange={(e) => setType(e.target.value as CorrectionType)}>
          <option value="">Pilih…</option>
          {(Object.keys(CORRECTION_LABEL) as CorrectionType[]).filter((k) => k !== 'tidak_dikerjakan' || p.status === 'selesai')
            .map((k) => <option key={k} value={k}>{CORRECTION_LABEL[k]}</option>)}</select></label>}
        <label>Alasan *<textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!error} /></label>
        {!notDone && <>
          <label>Kode ICD-9-CM{mode === 'ganti' ? ' pengganti *' : ''} <input className="mono" size={6} value={code} placeholder="23.41" onChange={(e) => setCode(e.target.value)} /></label>
          <label>Permukaan (kosong = seluruh gigi) <input className="mono" size={6} value={surfaces} onChange={(e) => setSurfaces(e.target.value)} /></label>
        </>}
        {mode === 'ganti' && <label>Status <select value={to} onChange={(e) => setTo(e.target.value as 'direncanakan' | 'selesai')}>
          <option value="direncanakan">Direncanakan</option><option value="selesai">Selesai (ditagih)</option></select></label>}
        <p className="muted small">{mode === 'ganti' ? 'Tindakan lama tetap tersimpan sebagai “Digantikan”; tagihannya tidak berubah.' : 'Koreksi tidak menambah tagihan. Lewat tenggat klinik, koreksi menunggu persetujuan pemilik. Pekerjaan ulang yang sungguh dikerjakan: pakai Ganti.'}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </form>
    </div>
  )
}

/** Every final row in force (as of the chosen date), newest first, with how it was superseded. */
export function ProcedureHistory({ rows }: { rows: ProcedureHistoryRow[] }) {
  if (!rows.length) return null
  return (
    <details className="small">
      <summary>Riwayat tindakan ({rows.length})</summary>
      <ul className="items" aria-label="Riwayat tindakan">
        {[...rows].reverse().map((h) => (
          <li key={h.id}>
            <span className="muted">{fmt(h.effective_at)}</span> {procedureText(h)} <StatusChip status={h.status} />
            {h.change && <span className="badge badge-old">{CHANGE_LABEL[h.change]}</span>}
            {h.reason && <span className="muted"> · Alasan: {h.reason}</span>}
          </li>
        ))}
      </ul>
    </details>
  )
}

export function StatusChip({ status }: { status: string }) {
  return <span className={`chip st st-${status}`} data-status={statusOf(status)?.legend}>{statusOf(status)?.label ?? status}</span>
}

/** Findings + treatments table (Open Dental pattern, our data only). Newest first (drafts = today, then finalized_at desc), then tooth.
 *  Dentist = the row's visit dentist; drafts show "Draf" instead of a date. Findings are visual conditions (no status); treatments
 *  (procedure_record) carry the status: dentists move a signed one along the allowed transitions, replace it or correct it. */
type Row = { kind: 'finding'; f: Finding } | { kind: 'procedure'; p: Procedure }
function Items({ findings, procedures, visits, canMove, onMove, onDiscard, onFix }: { findings: Finding[]; procedures: Procedure[]; visits: ChartVisit[]
  canMove: boolean; onMove: (p: Procedure, to: ProcStatus) => void; onDiscard: (p: Procedure) => void; onFix: (p: Procedure, mode: 'ganti' | 'koreksi') => void }) {
  const rows: Row[] = [...findings.map((f) => ({ kind: 'finding' as const, f })), ...procedures.map((p) => ({ kind: 'procedure' as const, p }))]
  const of = (r: Row) => r.kind === 'finding' ? r.f : r.p
  const at = (r: Row) => of(r).finalized_at ?? '\uffff' // drafts sort as newest
  const dentist = (visitId: string | null) => drName(visits.find((v) => v.id === visitId)?.dentist.name) || '—'
  return (
    <div className="findings-wrap">
      <table className="table findings" aria-label="Temuan & tindakan">
        <thead><tr><th scope="col">Tanggal</th><th scope="col">Gigi</th><th scope="col">Permukaan</th><th scope="col">Kondisi / tindakan</th><th scope="col">Dokter</th><th scope="col">Status</th></tr></thead>
        <tbody>
          {[...rows].sort((a, b) => at(b).localeCompare(at(a)) || (of(a).tooth ?? 0) - (of(b).tooth ?? 0)).map((r) => {
            const x = of(r)
            const lock = x.state === 'draft' ? <span className="badge badge-draft">Draf</span> : <span className="muted small" aria-label="Terkunci">🔒</span>
            return r.kind === 'finding' ? (
              <tr key={x.id}>
                <td>{x.finalized_at ? fmtDay(x.finalized_at) : <span className="muted">Draf</span>}</td>
                <td className="mono">{r.f.tooth}</td>
                <td>{r.f.surface ? `${surfaceLabel(r.f.tooth, r.f.surface)} (${surfaceName(r.f.tooth, r.f.surface)})` : 'Seluruh gigi'}</td>
                <td>{conditionOf(r.f.condition)?.label ?? r.f.condition}</td>
                <td>{dentist(r.f.visit_id)}</td>
                <td><span className="muted small">Kondisi</span> {lock}</td>
              </tr>
            ) : (
              <tr key={x.id}>
                <td>{x.finalized_at ? fmtDay(x.finalized_at) : <span className="muted">Draf</span>}</td>
                <td className="mono">{r.p.tooth ?? '—'}</td>
                <td>{r.p.surfaces && r.p.tooth !== null ? [...r.p.surfaces].map((sf) => surfaceLabel(r.p.tooth!, sf as Surface)).join('') : r.p.tooth !== null ? 'Seluruh gigi' : '—'}</td>
                <td>{procedureText(r.p)}</td>
                <td>{dentist(r.p.visit_id)}</td>
                <td><StatusChip status={r.p.status} /> {lock}
                  {r.p.state === 'draft' && <button className="btn btn-xs btn-ghost" onClick={() => onDiscard(r.p)}>Hapus draf</button>}
                  {r.p.state === 'final' && canMove && statusOf(r.p.status)?.next.map((to) => (
                    <button key={to} className="btn btn-xs" onClick={() => onMove(r.p, to)}>→ {statusOf(to)!.label}</button>
                  ))}
                  {r.p.state === 'final' && canMove && REPLACEABLE.includes(r.p.status) && <button className="btn btn-xs" onClick={() => onFix(r.p, 'ganti')}>Ganti…</button>}
                  {r.p.state === 'final' && canMove && <button className="btn btn-xs btn-ghost" onClick={() => onFix(r.p, 'koreksi')}>Koreksi…</button>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Segmented control (radiogroup); 44px targets. */
function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg-field">
      <span className="seg-label" id={`seg-${label.replace(/\s+/g, '-')}`}>{label}</span>
      <div className="seg" role="radiogroup" aria-labelledby={`seg-${label.replace(/\s+/g, '-')}`}>
        {options.map(([k, text]) => (
          <button key={k} type="button" role="radio" aria-checked={value === k} className={value === k ? 'is-on' : ''} onClick={() => onChange(k)}>{text}</button>
        ))}
      </div>
    </div>
  )
}

const DENT_HINT: Record<string, string> = { tetap: 'FDI dewasa', sulung: 'FDI sulung' }
/** Scroll a sideways chart to its middle (the midline) once per dentition; scrollWidth forces layout, so it is ready here. */
const centre = (el: HTMLDivElement | null, key: string) => {
  if (el && el.dataset.centred !== key) { el.dataset.centred = key; el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2 }
}

export default function ChartPage({ patientId, appointmentId, me }: { patientId: string; appointmentId?: string; me: Me }) {
  const [chart, setChart] = useState<Chart | null>(null)
  const [visitId, setVisitId] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [dirty, setDirty] = useState(false)
  const [pick, setPick] = useState<{ tooth: number; surface: Surface } | null>(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [signing, setSigning] = useState<{ busy: boolean; error: string; warnings?: { message: string }[] } | null>(null)
  const [billFor, setBillFor] = useState<string | null>(null) // visit just closed by Selesai -> "Lanjut ke tagihan" (#69)
  const [fixing, setFixing] = useState<Note | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false) // phone: Temuan & tindakan, Tutup kunjungan, Riwayat collapsed (#70)
  const [asOf, setAsOf] = useState('') // '' = today; otherwise the chart as of the end of that day (read-only)
  const [procFix, setProcFix] = useState<{ p: Procedure; mode: 'ganti' | 'koreksi' } | null>(null)
  // Table filter starts on the picked tooth; "Semua gigi" is remembered for that tooth only; no pick = all.
  const [allFor, setAllFor] = useState<number | null>(null)
  const [view, setView] = useState<'2d' | '3d'>('2d') // not persisted: 2D every time
  // OVv2: Perawatan (tooth first, the sheet) | Pemeriksaan awal (palette: one tool, many teeth, one Simpan)
  const [mode, setMode] = useState<'perawatan' | 'periksa'>('perawatan')
  const exam = useExam()
  const mobile = useIsMobile()
  const [mouthProcs, setMouthProcs] = useState<CatalogRow[]>([]) // e.g. Scaling: billed work without a tooth
  const [stages, setStages] = useState<Record<string, { variant: string; label: string }[]>>({}) // S2 price levels, as in ToothSheet
  const [mouthPick, setMouthPick] = useState<CatalogRow | null>(null) // mouth procedure waiting for its stage (Konsultasi / Kontrol)
  const phone = useMedia(PHONE_QUERY)
  const [legendOpen, setLegendOpen] = useState(!mobile) // phone: chart first, legend on demand
  const [tab, setTab] = useState<(typeof INNER)[number][0]>('odo')
  // Phone: the tab row scrolls sideways; keep the active tab in view.
  useEffect(() => {
    const t = document.getElementById(`ct-${tab}`), row = t?.parentElement
    if (!mobile || !t || !row) return
    const a = t.getBoundingClientRect(), r = row.getBoundingClientRect() // horizontal only: never scrolls the page
    if (a.left < r.left || a.right > r.right) row.scrollLeft += a.left - r.left - (r.width - a.width) / 2
  }, [mobile, tab])
  // 3D needs the vertical space: legends collapse on 3D, reopen on 2D; manual toggle still works in both.
  const changeView = (v: '2d' | '3d') => { setView(v); setLegendOpen(v === '2d') }
  // View-only dentition override, dropped when the default (baseline or DOB) changes; nothing is persisted from here.
  const defDent = chart ? `${chart.patient.id}:${chart.baseline?.dentition ?? dentitionFromDob(chart.patient.dob)}` : ''
  const [dentPick, setDentPick] = useState<{ base: string; v: Baseline['dentition'] } | null>(null)
  const dent = dentPick?.base === defDent ? dentPick.v : defDent.split(':')[1] as Baseline['dentition'] | undefined
  const can = (p: string) => me.permissions.includes(p)
  // Walk-in: dentists default to themselves; others (assistant: note.write without note.sign) must pick the dentist.
  const pickDentist = can('note.write') && !can('note.sign')
  const [dentists, setDentists] = useState<{ id: string; name: string }[]>([])
  const [walkInDentist, setWalkInDentist] = useState('')
  const [starting, setStarting] = useState(false)
  useEffect(() => { if (pickDentist) getDentists().then((r) => setDentists(r.data), () => setDentists([])) }, [pickDentist])

  const want = useRef({ patientId, appointmentId, asOf })
  want.current = { patientId, appointmentId, asOf }
  const load = useCallback(async () => {
    const req = { patientId, appointmentId, asOf }
    try {
      const vid = appointmentId && can('note.write') ? (await visitFromAppointment(appointmentId)).id : null
      const c = await getChart(patientId, asOf || null)
      if (want.current.patientId !== req.patientId || want.current.appointmentId !== req.appointmentId || want.current.asOf !== req.asOf) return
      setChart(c)
      setActivePatient({ id: c.patient.id, name: c.patient.name })
      const open = vid ?? c.visits.find((v) => v.status === 'berlangsung' && !v.notes.some((n) => n.versions.some((x) => x.signed_at)))?.id ?? null
      setVisitId(open)
      const ov = c.visits.find((v) => v.id === open)
      const shown = ov?.notes[0]?.versions.find((x) => x.status !== 'digantikan') // draft or current signed
      setForm(shown ? toForm(shown.soap) : { ...EMPTY, S: ov?.complaint ?? '' }) // no note yet: S starts from the desk's complaint
      setDirty(false)
    } catch (e) {
      if (want.current.patientId !== req.patientId || want.current.appointmentId !== req.appointmentId || want.current.asOf !== req.asOf) return
      setError(e instanceof ApiError && e.status === 404 ? 'Pasien atau janji tidak ditemukan.' : errorText(e))
    }
  }, [patientId, appointmentId, asOf]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setChart(null)
    setError('')
    setPick(null)
    setSigning(null)
    setBillFor(null)
    setFixing(null)
    setProcFix(null)
    setDirty(false)
    setForm(EMPTY)
    setMsg('')
  }, [patientId, appointmentId])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!can('note.write')) return
    getCatalog().then((c) => setMouthProcs(Array.isArray(c) ? c.filter((x) => x.treat_area === 'mouth') : []), () => setMouthProcs([]))
    getStages().then((s) => setStages(s && typeof s === 'object' && !Array.isArray(s) ? s : {}), () => setStages({}))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const visit = chart?.visits.find((v) => v.id === visitId) ?? null
  const note = visit?.notes[0] ?? null
  const draft = note?.versions.find((x) => x.status === 'draf') ?? null
  const editable = !asOf && !!visit && can('note.write') && !note?.versions.some((x) => x.signed_at)
  // "Ulangi kunjungan terakhir": the latest signed SOAP of an earlier visit (cheap: already in the chart payload).
  const lastSoap = chart?.visits.filter((v) => v.id !== visitId).sort((a, b) => b.started_at.localeCompare(a.started_at))
    .flatMap((v) => v.notes.flatMap((n) => n.versions.filter((x) => x.status === 'berlaku' && x.soap)))[0]?.soap ?? null
  // Why the chart is read-only, in that order: history view, a role that never writes clinical records (e.g. pemilik), a signed visit.
  // "Selesai" only when the visit really is closed; a permission limit must not read as "visit finished".
  const readOnlyWhy = asOf ? 'Tampilan riwayat: hanya baca.' : !can('note.write') ? 'Hanya lihat: peran Anda tidak mengisi rekam medis.' : 'Kunjungan ini sudah Selesai.'
  const mine = useMemo(() => chart?.drafts.filter((d) => d.visit_id === visitId) ?? [], [chart, visitId])
  const myProcs = useMemo(() => chart?.procedure_drafts.filter((d) => d.visit_id === visitId) ?? [], [chart, visitId])
  const marks = useMemo(() => {
    const m: Record<string, Mark> = {}
    for (const f of [...(chart?.findings ?? []), ...mine]) {
      m[f.surface ? `t${f.tooth}-${f.surface}` : `t${f.tooth}`] = { condition: f.condition, state: f.state === 'draft' ? 'draft' : 'signed', source: f.source }
    }
    // treatments paint over conditions: every letter of a combination ("MOD" -> M, O, D); cancelled ones are not painted
    for (const p of [...(chart?.procedures ?? []), ...myProcs]) {
      // an external waiting for confirmation (or rejected) never paints over today's work
      if (p.status === 'cancelled' || p.external_confirmation === 'pending' || p.external_confirmation === 'rejected') continue
      const v2 = p.condition ? conditionByKey(p.condition) : undefined // odontogram v2: the entry's own official symbol
      const teeth = p.tooth !== null ? [p.tooth] : v2 && p.tooth_range ? spanTeeth(...(p.tooth_range.split('-').map(Number) as [number, number])) : []
      if (!teeth.length) continue
      const mark: Mark = v2 ? { condition: v2.key, symbol: v2.symbol, code: v2.code, label: `${v2.label} (${v2.code ?? '-'})`, entry: ENTRY[p.status],
        state: p.state === 'draft' ? 'draft' : 'signed', source: p.source, status: p.status }
        : { condition: paintCondition(p.paint_type), paint: p.paint_type, state: p.state === 'draft' ? 'draft' : 'signed', source: p.source, status: p.status }
      for (const t of teeth) for (const k of p.surfaces && p.tooth !== null ? [...p.surfaces].map((s) => `t${t}-${s}`) : [`t${t}`]) m[k] = mark
    }
    return m
  }, [chart, mine, myProcs])

  // teeth of the drawn dentition with nothing charted yet (Tandai sisa sou)
  const emptyTeeth = (dent === 'campuran' ? [] : dent === 'sulung' ? TAXONOMY.dentitions.primary : TAXONOMY.dentitions.permanent).filter((t) => !Object.keys(marks).some((k) => k === `t${t}` || k.startsWith(`t${t}-`)))
  const shown = mode === 'periksa' ? { ...marks, ...exam.preview } : marks
  // The record lives inside the patient: wrap every state in PatientPage (header + Profil/Keluarga/Riwayat menu).
  // review-2 P1: a billing reader continues to the payment (solid); a dentist without billing goes back to the schedule.
  const afterSelesai = <>
    {can('billing.read') && <a className="btn btn-primary" href={`#/tagihan/${billFor}`}>Lanjut ke tagihan</a>}
    {can('appointment.read') && <a className={can('billing.read') ? 'btn' : 'btn btn-primary'} href="#/jadwal">Kembali ke Jadwal</a>}
  </>
  const page = (actions: ReactNode, body: ReactNode | ((pp: PatientFull) => ReactNode), status?: ReactNode) =>
    <PatientPage id={patientId} tab="rekam-medis" canChart alerts actions={actions} status={status}>{(pp) => typeof body === 'function' ? body(pp) : body}</PatientPage>
  if (error) return page(null, <div className="card state-card error">{error} <a href="#/pasien">Kembali</a></div>)
  if (!chart) return page(null, <PageSkeleton variant="record" label="Memuat rekam medis…" />)
  const p = chart.patient

  async function run(fn: () => Promise<unknown>, ok = '') {
    setMsg('')
    try {
      await fn()
      setMsg(ok)
      await load()
    } catch (e) {
      setMsg(e instanceof ApiError && [409, 422].includes(e.status) ? e.data?.message ?? 'Data tidak valid.' : errorText(e))
    }
  }
  const saveMouth = (x: CatalogRow, stage?: { variant: string; label: string }) => {
    setMouthPick(null)
    return run(() => saveProcedure(visit!.id, { tooth: null, surfaces: null, status: 'selesai', procedure_code: x.procedure_code, ...(stage ? { variant: stage.variant } : {}) }),
      `${x.name}${stage ? ` (${stage.label})` : ''} tersimpan (masuk tagihan saat Selesai).`)
  }
  // selecting works anytime; picker only when editable. Same tooth: add the surface to the treatment's combination (MOD); new tooth: restart.
  const onPick = (tooth: number, surface: Surface) => {
    if (mode === 'periksa' && editable) return exam.tap(tooth) // palette: the tool records, no sheet
    setPick({ tooth, surface })
  }
  async function startVisit() {
    setStarting(true)
    await run(() => startWalkInVisit(p.id, pickDentist ? { dentist_id: walkInDentist } : {}), 'Kunjungan hari ini dimulai.')
    setStarting(false)
  }
  const startCtl = !visit && can('note.write') && (
    <div className="walk-in">
      {pickDentist && (
        <label className="small">Dokter gigi * <select required value={walkInDentist} onChange={(e) => setWalkInDentist(e.target.value)}>
          <option value="">Pilih dokter gigi</option>
          {dentists.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select></label>
      )}
      <button type="button" className="btn btn-primary" disabled={starting || (pickDentist && !walkInDentist)} onClick={startVisit}>
        {starting ? 'Memulai…' : 'Mulai kunjungan'}</button>
    </div>
  )

  // agent drafts still waiting for "Setujui" (Selesai is refused until none are left; the server checks too)
  const unapproved = visit ? [...(draft?.source === 'ai_draft' && !draft.approved_at ? [draft] : []),
    ...visit.draft_findings.filter((f) => f.source === 'ai_draft' && !f.approved_at),
    ...visit.draft_procedures.filter((x) => x.source === 'ai_draft' && !x.approved_at)].length : 0
  const isDpjp = !!visit && visit.dentist.id === me.user.id && can('note.sign')

  // Selesai saves the typed draft first (no "Simpan draf dulu" detour, #70).
  async function openSelesai() {
    if (!visit) return
    if (dirty || !draft) {
      try {
        await saveNote(visit.id, { revision: draft?.revision ?? null, soap: toSoap(form) })
      } catch (e) {
        setMsg(e instanceof ApiError && [409, 422].includes(e.status) ? e.data?.message ?? 'Data tidak valid.' : errorText(e))
        return
      }
      await load()
    }
    setSigning({ busy: false, error: '' })
  }
  async function selesai(pin?: string, reason?: string) {
    if (!visit || !draft) return
    setSigning((s) => ({ ...s, busy: true, error: '' }))
    try {
      await selesaiVisit(visit.id, { revision: draft.revision, confirm: true, ...(pin ? { pin } : {}), ...(reason ? { accept_warnings: true, reason } : {}) })
      setSigning(null)
      // only promise the cashier queue when this visit really has billed work (a coded selesai procedure)
      const billed = procs.some((x) => x.visit_id === visit.id && x.status === 'selesai' && x.procedure_code)
      setMsg(billed ? 'Selesai: rekam medis terkunci, pasien masuk antrean bayar.' : 'Selesai: rekam medis terkunci. Tidak ada tindakan yang ditagih.')
      setBillFor(visit.id)
      await load()
    } catch (e) {
      if (e instanceof ApiError && e.data?.signed) { // #55: signed, but the invoice guard kept the visit open
        setSigning(null)
        setMsg(`Rekam medis sudah ditandatangani, tetapi kunjungan belum ditutup: ${e.data.message ?? 'tagihan belum lengkap.'}`)
        await load()
        return
      }
      if (e instanceof ApiError && e.data?.error === 'no_billable_work') { // nothing signed: close the dialog so the mouth buttons are reachable
        setSigning(null)
        setMsg(e.data.message ?? 'Belum ada tindakan selesai.')
        return
      }
      if (e instanceof ApiError && e.status === 422 && e.data?.error === 'warnings') { // SignCheck warnings: pick a reason chip
        setSigning({ busy: false, error: '', warnings: (e.data.warnings as { message: string }[]) ?? [] })
        return
      }
      setSigning((s) => ({ ...s, busy: false, error: e instanceof ApiError && [403, 409, 422].includes(e.status) ? e.data?.message ?? 'Tidak bisa diproses.' : errorText(e) }))
    }
  }

  const items = [...chart.findings, ...mine]
  const procs = [...chart.procedures, ...myProcs]
  const summary = findingSummary(items, procs)
  const only = pick && allFor !== pick.tooth ? pick.tooth : null
  const shownItems = only ? items.filter((f) => f.tooth === only) : items
  const shownProcs = only ? procs.filter((x) => x.tooth === only) : procs
  const center: Surface | null = pick && (isAnterior(pick.tooth) ? 'I' : 'O')
  const panel = !pick ? <p className="muted tooth-empty">Pilih gigi untuk melihat detail.</p> : (
    <>
      <div className="tooth-panel-head">
        <div><h2>Gigi {pick.tooth}</h2><p className="tooth-name">{toothAnatomicalName(pick.tooth)}</p></div>
        <button type="button" className="btn btn-ghost tooth-close" aria-label="Tutup detail gigi" autoFocus={mobile} onClick={() => setPick(null)}>×</button>
      </div>
      <p className="muted small" role="status">Dipilih: Gigi {pick.tooth} · {surfaceName(pick.tooth, pick.surface)} ({surfaceLabel(pick.tooth, pick.surface)})</p>
      {!editable && <div className="surf-pad" role="group" aria-label="Permukaan">
        {PAD.map(([s, pos]) => {
          const sv = s === 'O' ? center! : s
          return <button key={pos} type="button" className={`surf surf-${pos}`} aria-pressed={pick.surface === sv} title={surfaceName(pick.tooth, sv)}
            onClick={() => setPick({ tooth: pick.tooth, surface: sv })}>{surfaceLabel(pick.tooth, sv)}</button>
        })}
      </div>}
      {items.some((f) => f.tooth === pick.tooth) || procs.some((x) => x.tooth === pick.tooth) ? (
        <ul className="items tooth-findings" aria-label={`Temuan gigi ${pick.tooth}`}>
          {items.filter((f) => f.tooth === pick.tooth).map((f) => (
            <li key={f.id}>{f.surface ? surfaceLabel(f.tooth, f.surface) : 'Seluruh gigi'} · {conditionOf(f.condition)?.label ?? f.condition}
              {f.state === 'draft' && <span className="badge badge-draft">Draf</span>}</li>
          ))}
          {procs.filter((x) => x.tooth === pick.tooth).map((x) => (
            <li key={x.id}><StatusChip status={x.status} /> {procedureText(x)}{x.state === 'draft' && <span className="badge badge-draft">Draf</span>}
              {/* P2-5: fix a wrong pick in place = remove own draft here, pick again below */}
              {editable && x.state === 'draft' && x.visit_id === visit?.id && x.created_by === me.user.id && (
                <button type="button" className="btn btn-xs btn-ghost" aria-label={`Hapus draf ${procedureText(x)}`}
                  onClick={() => run(() => discardProcedure(x.id), 'Draf dihapus.')}>Hapus</button>
              )}</li>
          ))}
        </ul>
      ) : <p className="muted small">Belum ada temuan di gigi ini.</p>}
      {editable ? (
        // OVv2 "tindakan dulu": one sheet records condition + status; Selesai = today's procedure, billed via the clinic mapping
        <EntrySheet key={pick.tooth} tooth={pick.tooth} visitId={visit!.id} initialSurface={pick.surface === 'B' ? 'V' : pick.surface as SurfaceKey}
          onSaved={(m) => { setMsg(m); load(); if (mobile) setPick(null) }} />
      ) : <p className="muted small">{visit ? readOnlyWhy : 'Hanya lihat: kondisi dan tindakan diisi dari kunjungan aktif yang belum Selesai.'}</p>}
      {startCtl}
    </>
  )

  const odoTools = (
<div className="card-head-tools">
                  <label className="small">Lihat per tanggal <DateField value={asOf} placeholder="Hari ini" max={new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })}
                    onChange={(e) => setAsOf(e.target.value)} /></label>
                  {asOf && <button className="btn btn-xs" onClick={() => setAsOf('')}>Kembali ke hari ini</button>}
                </div>
  )
  const odoLegend = (
    <>
        <button type="button" className="btn btn-xs odo-legend-toggle" aria-expanded={legendOpen} aria-controls="odo-legends" onClick={() => setLegendOpen(!legendOpen)}>
          {legendOpen ? 'Sembunyikan legenda' : 'Tampilkan legenda'}
        </button>
        {legendOpen && (
          <div className="odo-legends" id="odo-legends">
            <OfficialLegend />
          </div>
        )}
        {/* legacy baseline (read only): the initial state is now recorded through Pemeriksaan awal */}
        {chart.baseline && <p className="muted small">Keadaan awal lama: {chart.baseline.dentition} · versi {chart.baseline.version}</p>}
    </>
  )
  return page(
    <div className="chart-actions">
      {can('appointment.create') && <a className="btn btn-primary" href={`#/jadwal?baru=${encodeURIComponent(patientId)}`}>Buat janji</a>}
    </div>,
    (pp: PatientFull) => <>
      {msg && <p className="notice" role="status">{msg}</p>}
      {billFor && !mobile && <p className="toolbar rm-done">{afterSelesai}</p>}

      <div role="tablist" aria-label="Bagian rekam medis" className="tabs chart-tabs">
        {INNER.filter(([k]) => k !== 'bill' || can('billing.read')).map(([k, label]) => (
          <button key={k} type="button" role="tab" id={`ct-${k}`} aria-selected={tab === k} aria-controls="chart-tabpanel" className={tab === k ? 'on' : undefined} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      <div role="tabpanel" id="chart-tabpanel" aria-labelledby={`ct-${tab}`}>
      {tab === 'odo' && (
        <div className="grid-12 chart-grid">
          <section className="card span-8 odo-card" aria-label="Odontogram">
            <div className="card-head">
              <h2>Odontogram</h2>
              {mine.length + myProcs.filter(isWork).length > 0 && <span className="badge badge-draft">Draf: {mine.length} temuan, {myProcs.filter(isWork).length} tindakan</span>}
              {mine.some((d) => d.source === 'ai_draft') && <span className="badge badge-ai">{AI_BADGE}</span>}
              {!mobile && odoTools}
            </div>
            {/* OVv2-05: 2D | 3D (and the entry mode) always visible under the title, never folded away on the phone */}
            <div className="odo-switches">
              <Seg label="Tampilan" value={view} onChange={changeView} options={[['2d', '2D'], ['3d', '3D']]} />
              {editable && view === '2d' && me.odontogram_exam_enabled !== false && <Seg label="Mode isi" value={mode} onChange={(m) => { setMode(m); setPick(null) }} options={[['perawatan', 'Perawatan'], ['periksa', 'Pemeriksaan awal']]} />}
            </div>
            {chart.as_of && <p className="notice notice-warn small" role="status">Tampilan riwayat: keadaan pada akhir {chart.as_of} (WIB). Hanya baca.</p>}
            <p className={summary ? 'odo-summary' : 'odo-summary muted'} role="note" aria-label="Ringkasan temuan">{summary || 'Belum ada temuan.'}</p>
            {editable && mouthProcs.length > 0 && (
              // work without a tooth (Scaling ...): done today = Selesai, billed like a tooth entry
              <div className="mouth-procs" role="group" aria-label="Tindakan seluruh mulut">
                <span className="muted small">Tindakan seluruh mulut:</span>
                {mouthProcs.map((x) => (
                  <button key={x.procedure_code} type="button" className="btn" aria-pressed={mouthPick?.procedure_code === x.procedure_code}
                    onClick={() => (stages[x.procedure_code]?.length ?? 0) > 1 ? setMouthPick(x) : saveMouth(x)}>{x.name} <code>{x.procedure_code}</code></button>
                ))}
              </div>
            )}
            {editable && mouthPick && (
              <div className="tsheet-pick" role="radiogroup" aria-label={`Tahap ${mouthPick.name}`}>
                <p className="small">Tahap {mouthPick.name} hari ini:</p>
                {stages[mouthPick.procedure_code].map((s) => (
                  <button key={s.variant} type="button" role="radio" aria-checked={false} onClick={() => saveMouth(mouthPick, s)}>{s.label}</button>
                ))}
              </div>
            )}
            {mobile ? (
              <details className="odo-more">
                <summary>Tampilan &amp; legenda</summary>
                {odoTools}
                {odoLegend}
              </details>
            ) : odoLegend}
            {view === '3d' && (
              <>
                <Odontogram3D marks={shown} baseline={chart.baseline?.teeth} dentition={dent} selected={pick} onPick={onPick} />
                <p className="muted small odo3d-note">3D hanya baca. Untuk mencatat, kembali ke 2D.</p>
              </>
            )}
            {phone ? <>
              {/* Phone (≤480px, sketch 06): one sideways scroller per jaw; each opens centred on its midline (11|21, 41|31; 51|61, 81|71). */}
              <p className="muted small odo-jaw-hint">{DENT_HINT[dent ?? ''] ?? 'FDI dewasa + sulung'} · geser rahang, ketuk gigi untuk detail</p>
              {(['upper', 'lower'] as const).map((arch) => (
                <div key={arch} className="odo-jaw">
                  <p className="odo-jaw-head"><span id={`jaw-${arch}`}>{arch === 'upper' ? 'Rahang atas' : 'Rahang bawah'}</span> <span className="muted">kanan ← kiri pasien</span></p>
                  <div className="odo2d-wrap odo-jaw-scroll" role="group" aria-labelledby={`jaw-${arch}`} ref={(el) => centre(el, String(dent))}>
                    <Odontogram arch={arch} wholeTooth marks={shown} baseline={chart.baseline?.teeth} dentition={dent} compact={view === '3d'} selected={pick ? `t${pick.tooth}-${pick.surface}` : null} onPick={onPick} />
                  </div>
                </div>
              ))}
            </> : (
            // ≤720px: the chart keeps its size and scrolls sideways; opens centred on the midline (11|21).
            <div className="odo2d-wrap" ref={(el) => { if (mobile) centre(el, String(dent)) }}>
              <Odontogram marks={shown} baseline={chart.baseline?.teeth} dentition={dent} compact={view === '3d'} selected={pick ? `t${pick.tooth}-${pick.surface}` : null} onPick={onPick} />
            </div>
            )}
            {/* OVv2-07: dentition under the chart, always visible (48px); default from age, the dentist can change it */}
            <div className="dent-toggle">
              <Seg label="Dentisi" value={dent ?? 'tetap'} onChange={(v) => setDentPick({ base: defDent, v })} options={[['tetap', 'Tetap'], ['sulung', 'Sulung'], ['campuran', 'Campuran']]} />
            </div>
            {!editable && (visit ? <p className="muted small">{readOnlyWhy}</p> : (
              <div className="chart-cta small">
                <p>Belum ada kunjungan aktif. Mulai kunjungan hari ini (tanpa janji juga bisa) untuk mengisi odontogram dan SOAP.</p>
                {/* with a tooth picked the control sits in the tooth panel/sheet instead; phone: pinned above the bottom nav */}
                {!pick && startCtl && (mobile ? <div className="walk-in-bar">{startCtl}</div> : startCtl)}
                <a href={can('appointment.read') ? '#/jadwal' : '#/'}>Buka janji hari ini</a>
              </div>
            ))}
          </section>
          {mode === 'periksa' && editable ? (
            <aside className="card span-4 tooth-panel exam-panel" aria-label="Pemeriksaan awal">
              <ExamPalette exam={exam} visitId={visit!.id} emptyTeeth={emptyTeeth} onSaved={(m) => { setMsg(m); load() }} />
            </aside>
          ) : !mobile ? <aside className="card span-4 tooth-panel" aria-label="Detail gigi">{panel}</aside> : (
            <Presence open={!!pick} exitMs={200}>
              {pick && <ToothSheet tooth={pick.tooth} panel={panel} onClose={() => setPick(null)} trapTab={trapTab} />}
            </Presence>
          )}
          <section className="card span-12" aria-labelledby="temuan-title">
            <div className="temuan-head">
              <h2 id="temuan-title">Temuan &amp; tindakan</h2>
              {mobile && <button type="button" className="btn btn-ghost" aria-expanded={detailsOpen} aria-controls="temuan-body" onClick={() => setDetailsOpen(!detailsOpen)}>
                {detailsOpen ? 'Sembunyikan' : `Lihat (${items.length + procs.length})`}</button>}
              {(!mobile || detailsOpen) && <div className="seg" role="radiogroup" aria-label="Saring temuan">
                <button type="button" role="radio" aria-checked={!only} className={!only ? 'is-on' : ''} onClick={() => setAllFor(pick?.tooth ?? null)}>Semua gigi</button>
                {pick && <button type="button" role="radio" aria-checked={!!only} className={only ? 'is-on' : ''} onClick={() => setAllFor(null)}>Gigi {pick.tooth}</button>}
              </div>}
            </div>
            {(!mobile || detailsOpen) && <div id="temuan-body">
            {chart.pending_externals.length > 0 && (
              <div className="notice notice-warn" role="status">
                <strong>Tindakan klinik lain menunggu konfirmasi</strong> (dicatat pada hari dengan tindakan selesai; belum masuk riwayat, tidak ditagih)
                <ul>
                  {chart.pending_externals.map((x) => (
                    <li key={x.id}>
                      {procedureText(x)} · {x.external_clinic_name} · {x.external_date}{x.external_date_precision !== 'day' ? ` (perkiraan ${x.external_date_precision === 'year' ? 'tahun' : 'bulan'})` : ''}
                      {can('procedure.confirm_external') && (
                        <>
                          {' '}<button className="btn btn-xs" onClick={() => run(() => confirmExternal(x.id, true), 'Tindakan klinik lain dikonfirmasi.')}>Konfirmasi</button>
                          {' '}<button className="btn btn-xs btn-ghost" onClick={() => run(() => confirmExternal(x.id, false), 'Tindakan klinik lain ditolak.')}>Tolak</button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {shownItems.length + shownProcs.length ? <Items findings={shownItems} procedures={shownProcs} visits={chart.visits} canMove={can('note.sign') && !asOf}
              onDiscard={(x) => run(() => discardProcedure(x.id))} onFix={(x, mode) => setProcFix({ p: x, mode })}
              onMove={(x, to) => run(() => changeStatus(x.id, to, visit?.id), `Status ${procedureText(x)} diubah (baris baru; versi lama tetap).`)} />
              : <p className="muted">{only ? 'Tidak ada temuan pada gigi ini.' : 'Belum ada temuan.'}</p>}
            <ProcedureHistory rows={chart.procedure_history} />
            </div>}
          </section>
        </div>
      )}
      {tab === 'notes' && (
        <div className="stack">
          {visit && (
            <div className="card">
              <div className="card-head">
                <h2>Catatan SOAP</h2>
                {draft ? <StatusBadge v={draft} /> : note ? <span className="badge badge-signed">🔒 Selesai</span> : <span className="badge badge-old">Belum ada</span>}
              </div>
              {editable && (
                <div className="soap-quick" role="group" aria-label="Template catatan">
                  {SOAP_TEMPLATES.map((t) => <button key={t.key} type="button" className="btn chip-quick" onClick={() => { setForm(toForm(fillEmpty(toSoap(form), t.soap))); setDirty(true) }}>{t.label}</button>)}
                  {lastSoap && <button type="button" className="btn chip-quick" onClick={() => { setForm(toForm(fillEmpty(toSoap(form), lastSoap))); setDirty(true) }}>Ulangi kunjungan terakhir</button>}
                </div>
              )}
              <SoapFields form={form} readOnly={!editable} stacked={mobile} onChange={(f) => { setForm(f); setDirty(true) }} />
              {editable && (
                <div className={mobile && isDpjp ? 'dialog-actions rm-actions-inline' : 'dialog-actions'}>
                  <button className="btn" disabled={!dirty} onClick={() => run(() => saveNote(visit.id, { revision: draft?.revision ?? null, soap: toSoap(form) }), 'Draf tersimpan.')}>Simpan draf</button>
                  {isDpjp && unapproved > 0 && (
                    <button className="btn btn-primary" onClick={() => run(() => approveDrafts(visit.id), 'Draf agen disetujui.')}>Setujui draf agen ({unapproved})</button>
                  )}
                  {isDpjp && (draft || dirty) && !mobile && (
                    <button className={unapproved > 0 ? 'btn' : 'btn btn-primary'} disabled={unapproved > 0}
                      title={unapproved > 0 ? 'Setujui draf agen dulu' : undefined} onClick={openSelesai}>Selesai</button>
                  )}
                </div>
              )}
            </div>
          )}

          {mobile && <button type="button" className="btn btn-ghost fold-toggle" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(!detailsOpen)}>
            {detailsOpen ? 'Sembunyikan tutup kunjungan & riwayat' : 'Tutup kunjungan & riwayat'}</button>}
          {(!mobile || detailsOpen) && visit && visit.status === 'berlangsung' && !asOf && can('appointment.transition') && (
            <CloseVisit visit={visit} needsSelesai={!!visit.needs_selesai && !visit.attendance_cancelled} canBilling={can('billing.read')} onDone={async () => { await load(); setMsg('Kunjungan diperbarui.') }} />
          )}

          {(!mobile || detailsOpen) && <div className="card">
            <h2>Riwayat kunjungan</h2>
            <History visits={chart.visits} me={me} onFix={setFixing} onApprove={(id) => run(() => approveCorrection(id), 'Koreksi disetujui.')} />
          </div>}
        </div>
      )}
      {tab === 'bill' && can('billing.read') && <BillingTab visits={chart.visits} />}
      </div>

      {/* review-3 P2: on the phone the next step after Selesai sits in the bottom dock, where Selesai was */}
      {mobile && billFor && <div className="rm-actionbar rm-done">{afterSelesai}</div>}
      {/* OVv2-06: the exam dock owns the bottom while Pemeriksaan awal is on (one primary: Simpan N gigi) */}
      {mobile && !billFor && editable && isDpjp && visit && mode !== 'periksa' && (
        // Phone (#70): one sticky bar above the bottom nav, on every RM tab: Setujui while agent drafts wait, else Selesai.
        <div className="rm-actionbar">
          {unapproved > 0
            ? <button className="btn btn-primary" onClick={() => run(() => approveDrafts(visit.id), 'Draf agen disetujui.')}>Setujui draf agen ({unapproved})</button>
            : <button className="btn btn-primary" onClick={openSelesai}>Selesai</button>}
        </div>
      )}
      <Presence open={!!(signing && visit && draft)} exitMs={200}>
        {signing && visit && draft && (
        <SelesaiDialog busy={signing.busy} error={signing.error} warnings={signing.warnings} onClose={() => setSigning(null)} onConfirm={selesai}
          pinRequired={!!me.selesai?.pin_required} hasPin={!!me.selesai?.has_pin}
          lines={[`Catatan SOAP versi ${draft.version} (revisi ${draft.revision})${draft.soap.A.codes.length ? ' · ICD-10 ' + draft.soap.A.codes.join(', ') : ''}`,
            ...visit.draft_findings.map((f) => findingText(f) + (f.created_by !== me.user.id ? ' (draf pengguna lain)' : '')),
            ...visit.draft_procedures.filter(isWork).map((x) => procedureText(x) + ` · ${statusOf(x.status)?.label ?? x.status}` + (x.created_by !== me.user.id ? ' (draf pengguna lain)' : '')),
            ...(visit.draft_procedures.some((x) => !isWork(x)) ? [`Pemeriksaan: ${visit.draft_procedures.filter((x) => !isWork(x)).length} gigi sehat (sou)`] : [])]} />
        )}
      </Presence>
      <Presence open={!!procFix} exitMs={200}>
        {procFix && <ProcedureFixDialog p={procFix.p} mode={procFix.mode} visitId={visit?.id ?? null} onClose={() => setProcFix(null)}
          onDone={async (m) => { setProcFix(null); await load(); setMsg(m) }} />}
      </Presence>
      <Presence open={!!fixing} exitMs={200}>
        {fixing && <CorrectionDialog note={fixing} solo={chart.solo_practice} onClose={() => setFixing(null)} onDone={async () => { setFixing(null); await load(); setMsg('Koreksi tersimpan.') }} />}
      </Presence>
    </>,
    <>
      {visit?.status === 'berlangsung' && !visit.notes.some((n) => n.versions.some((x) => x.signed_at))
        && <span className="visit-chip" role="note" aria-label="Status kunjungan">{visitStatusText(visit, mobile)}</span>}
      {visit?.complaint && <span className="visit-chip" role="note" aria-label="Keluhan pasien">Keluhan: {visit.complaint}</span>}
    </>,
  )
}

/** RM > Billing (#69, billing readers): this patient's visits, newest first, each opening its Tagihan (payment + kwitansi). */
function BillingTab({ visits }: { visits: ChartVisit[] }) {
  const rows = [...visits].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 20)
  return (
    <div className="card">
      <h2>Tagihan per kunjungan</h2>
      {rows.length === 0 ? <p className="muted">Belum ada kunjungan.</p> : (
        <ul className="bill-visits">
          {rows.map((v) => (
            <li key={v.id}>
              <span>{fmtDateTime(v.started_at)} · {v.dentist.name ?? 'Dokter'} · {v.status === 'berlangsung' ? 'berlangsung' : 'selesai'}</span>
              <a className="btn btn-xs" href={`#/tagihan/${v.id}`}>Buka tagihan</a>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">Tagihan dibuat otomatis dari tindakan berstatus selesai; kunjungan tanpa tindakan tidak punya tagihan.</p>
    </div>
  )
}

function ToothSheet({ tooth, panel, onClose, trapTab }: {
  tooth: number; panel: ReactNode; onClose: () => void; trapTab: (e: KeyboardEvent<HTMLElement>) => void
}) {
  const phase = usePresenceClass()
  return (
    <>
      <div className={`sheet-backdrop ${phase}`} onClick={onClose} />
      <aside className={`card tooth-panel sheet tooth-sheet ${phase}`} role="dialog" aria-modal="true" aria-label={`Detail gigi ${tooth}`}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); else trapTab(e) }}>
        {/* review-3 (board 02): no patient identity strip; the page header above names the patient and its pinned alert ribbon stays visible */}
        <div className="sheet-handle" aria-hidden="true" />
        {panel}
      </aside>
    </>
  )
}

