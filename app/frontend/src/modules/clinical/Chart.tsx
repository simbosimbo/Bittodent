import { useCallback, useEffect, useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import { setActivePatient } from '../../shared/activePatient'
import { fmtDateTime, fmtDay, fmtTime } from '../../shared/format'
import type { Me } from '../../shared/session'
import { PHONE_QUERY, useIsMobile, useMedia } from '../../shared/useIsMobile'
import { AlertRibbon, ageTahun, PatientPage, SEX } from '../patients'
import type { PatientFull } from '../patients'
import {
  approveCorrection, approveDrafts, changeStatus, confirmExternal, correctNote, correctProcedure, discardFinding, discardProcedure, getChart, getDentists,
  replaceProcedure, saveBaseline, saveFinding, saveNote, saveProcedure, selesaiVisit, startWalkInVisit, visitFromAppointment,
  type Baseline, type Chart, type ChartVisit, type CorrectionType, type Finding, type Note, type ProcStatus, type Procedure, type ProcedureHistoryRow,
  type Soap, type Surface, type ToothPresence, type Version,
} from './api'
import { AI_BADGE, CHOOSABLE, CONDITIONS, conditionOf, CORRECTION_LABEL, findingText, isAnterior, paintCondition, PRESENCE, procedureText, sameSite, statusOf,
  surfaceLabel, surfaceName, surfacesOf, toothAnatomicalName } from './legend'
import { Legend, Odontogram, StatusLegend, type Mark } from './Odontogram'
import { dentitionFromDob, Odontogram3D } from './Odontogram3D'
import { SelesaiDialog } from './SelesaiDialog'
import { CloseVisit } from './CloseVisit'
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
export const findingSummary = (items: { condition: string }[]) =>
  CONDITIONS.map((c) => [items.filter((f) => f.condition === c.key).length, c.label.toLowerCase()] as const).filter(([n]) => n).map(([n, l]) => `${n} ${l}`).join(' · ')
const FREE_EDIT_MS = 48 * 3600 * 1000
const INNER = [['odo', 'Odontogram'], ['notes', 'Catatan Klinis'], ['plan', 'Rencana Perawatan'], ['rx', 'Resep'], ['bill', 'Billing']] as const
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

function SoapFields({ form, onChange, readOnly }: { form: Form; onChange?: (f: Form) => void; readOnly?: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('S')
  const set = (patch: Partial<Form>) => onChange?.({ ...form, ...patch })
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
  return (
    <div className="overlay" onClick={onClose}>
      <form className="card dialog dialog-wide" role="dialog" aria-modal="true" aria-labelledby="fix-title" onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
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
  return (
    <div className="overlay" onClick={onClose}>
      <form className="card dialog" role="dialog" aria-modal="true" aria-labelledby="pfix-title" onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
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
      <span className="seg-label" id={`seg-${label}`}>{label}</span>
      <div className="seg" role="radiogroup" aria-labelledby={`seg-${label}`}>
        {options.map(([k, text]) => (
          <button key={k} type="button" role="radio" aria-checked={value === k} className={value === k ? 'is-on' : ''} onClick={() => onChange(k)}>{text}</button>
        ))}
      </div>
    </div>
  )
}

/** Baseline (first visit): dentition + per-tooth presence. Saving = new version (never overwritten). */
function BaselineEditor({ value, onSave, onClose }: { value: Baseline | null; onSave: (b: { dentition: Baseline['dentition']; teeth: Record<string, ToothPresence> }) => void; onClose: () => void }) {
  const [dentition, setDentition] = useState<Baseline['dentition']>(value?.dentition ?? 'tetap')
  const [teeth, setTeeth] = useState<Record<string, ToothPresence>>(value?.teeth ?? {})
  const [tooth, setTooth] = useState('')
  const t = Number(tooth)
  return (
    <div className="picker-pop" role="group" aria-label="Keadaan awal gigi">
      <strong>Keadaan awal gigi (kunjungan pertama){value ? ` · versi ${value.version}` : ''}</strong>
      <p className="muted small">Bukan temuan klinis: “tidak ada” di sini berbeda dari kondisi “Hilang”. Gigi yang tidak ada tampil pudar.</p>
      <div className="baseline-row">
        <label>Gigi geligi <select value={dentition} onChange={(e) => setDentition(e.target.value as Baseline['dentition'])}>
          <option value="tetap">Tetap</option><option value="sulung">Sulung (susu)</option><option value="campuran">Campuran</option>
        </select></label>
        <label>Nomor gigi (FDI) <input className="mono" size={3} value={tooth} onChange={(e) => setTooth(e.target.value.replace(/\D/g, '').slice(0, 2))} /></label>
        {PRESENCE.map(([k, label]) => (
          <button key={k} type="button" className="btn btn-xs" disabled={!t} onClick={() => setTeeth({ ...teeth, [t]: k })}>{label}</button>
        ))}
      </div>
      <ul className="items">
        {Object.entries(teeth).filter(([, v]) => v !== 'ada').map(([k, v]) => (
          <li key={k}>Gigi {k}: {PRESENCE.find(([p]) => p === v)?.[1]} <button className="btn btn-xs btn-ghost" onClick={() => setTeeth({ ...teeth, [k]: 'ada' })}>Batal</button></li>
        ))}
      </ul>
      <div className="dialog-actions">
        <button className="btn" onClick={onClose}>Tutup</button>
        <button className="btn btn-primary" onClick={() => onSave({ dentition, teeth })}>Simpan keadaan awal</button>
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
  const [signing, setSigning] = useState<{ busy: boolean; error: string } | null>(null)
  const [fixing, setFixing] = useState<Note | null>(null)
  const [status, setStatus] = useState<ProcStatus>('selesai')
  const [surfs, setSurfs] = useState<Surface[]>([])
  const [procCode, setProcCode] = useState('')
  const [extClinic, setExtClinic] = useState('')
  const [extDate, setExtDate] = useState('')
  const [baselineOpen, setBaselineOpen] = useState(false)
  const [asOf, setAsOf] = useState('') // '' = today; otherwise the chart as of the end of that day (read-only)
  const [procFix, setProcFix] = useState<{ p: Procedure; mode: 'ganti' | 'koreksi' } | null>(null)
  // Chosen condition waits for "Simpan ke kunjungan hari ini"; bound to its tooth so switching teeth drops it.
  const [pending, setPending] = useState<{ tooth: number; condition: string; whole: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  // Table filter starts on the picked tooth; "Semua gigi" is remembered for that tooth only; no pick = all.
  const [allFor, setAllFor] = useState<number | null>(null)
  const [view, setView] = useState<'2d' | '3d'>('2d') // not persisted: 2D every time
  const mobile = useIsMobile()
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
  // View-only dentition override, dropped when the default (baseline or DOB) changes; the baseline editor is what persists.
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

  const load = useCallback(async () => {
    try {
      const vid = appointmentId && can('note.write') ? (await visitFromAppointment(appointmentId)).id : null
      const c = await getChart(patientId, asOf || null)
      setChart(c)
      setActivePatient({ id: c.patient.id, name: c.patient.name })
      const open = vid ?? c.visits.find((v) => v.status === 'berlangsung' && !v.notes.some((n) => n.versions.some((x) => x.signed_at)))?.id ?? null
      setVisitId(open)
      const shown = c.visits.find((v) => v.id === open)?.notes[0]?.versions.find((x) => x.status !== 'digantikan') // draft or current signed
      setForm(shown ? toForm(shown.soap) : EMPTY)
      setDirty(false)
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? 'Pasien atau janji tidak ditemukan.' : errorText(e))
    }
  }, [patientId, appointmentId, asOf]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const visit = chart?.visits.find((v) => v.id === visitId) ?? null
  const note = visit?.notes[0] ?? null
  const draft = note?.versions.find((x) => x.status === 'draf') ?? null
  const editable = !asOf && !!visit && can('note.write') && !note?.versions.some((x) => x.signed_at)
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
      if (p.tooth === null || p.status === 'cancelled' || p.external_confirmation === 'pending' || p.external_confirmation === 'rejected') continue
      const mark: Mark = { condition: paintCondition(p.paint_type), paint: p.paint_type, state: p.state === 'draft' ? 'draft' : 'signed', source: p.source, status: p.status }
      for (const k of p.surfaces ? [...p.surfaces].map((s) => `t${p.tooth}-${s}`) : [`t${p.tooth}`]) m[k] = mark
    }
    return m
  }, [chart, mine, myProcs])

  // The record lives inside the patient: wrap every state in PatientPage (header + Profil/Keluarga/Riwayat menu).
  const page = (actions: ReactNode, body: ReactNode | ((pp: PatientFull) => ReactNode), status?: ReactNode) =>
    <PatientPage id={patientId} tab="rekam-medis" canChart alerts actions={actions} status={status}>{(pp) => typeof body === 'function' ? body(pp) : body}</PatientPage>
  if (error) return page(null, <div className="card state-card error">{error} <a href="#/pasien">Kembali</a></div>)
  if (!chart) return page(null, <div className="card state-card muted">Memuat rekam medis…</div>)
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
  // selecting works anytime; picker only when editable. Same tooth: add the surface to the treatment's combination (MOD); new tooth: restart.
  const onPick = (tooth: number, surface: Surface) => {
    setSurfs(pick?.tooth === tooth ? (surfs.includes(surface) ? surfs : [...surfs, surface]) : [surface])
    setPick({ tooth, surface })
  }
  const chosen = pick && pending?.tooth === pick.tooth ? pending : null
  const choose = (condition: string, whole: boolean) => pick && setPending({ tooth: pick.tooth, condition, whole })
  async function saveChosen() {
    if (!pick || !visit || !chosen) return
    setSaving(true)
    await run(async () => {
      await saveFinding(visit.id, { tooth: pick.tooth, surface: chosen.whole ? null : pick.surface, condition: chosen.condition })
      setPending(null)
    }, 'Temuan tersimpan sebagai draf di kunjungan hari ini.')
    setSaving(false)
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
  // one procedure for all toggled surfaces (MOD = one row, one price); no surface = whole tooth. The catalog decides the area for known codes.
  const surfaces = pick ? surfacesOf(pick.tooth).filter((s) => surfs.includes(s)).join('') || null : null
  // today's chair work on this visit (any author); an external on the same site is refused, elsewhere it waits for confirmation
  const selesaiToday = visit ? [...visit.draft_procedures, ...chart.procedures.filter((x) => x.visit_id === visit.id)].filter((x) => x.status === 'selesai') : []
  const external = status === 'ada_di_tempat_lain'
  const extBlocked = external && !!pick && selesaiToday.some((x) => sameSite(pick.tooth, surfaces, x))
  const record = () => pick && visit && run(() => saveProcedure(visit.id, { tooth: pick.tooth, surfaces, status, procedure_code: procCode.trim() || null,
    ...(procCode.trim() ? {} : { treat_area: surfaces ? 'surface' : 'tooth' }),
    ...(external ? { external_clinic_name: extClinic.trim(), external_date: extDate.trim() } : {}) }),
    external && selesaiToday.length ? 'Tersimpan; menunggu konfirmasi resepsionis/asisten.' : 'Tindakan tersimpan sebagai draf.')
  const myDraftAt = (whole: boolean) => pick && mine.find((d) => d.tooth === pick.tooth && d.surface === (whole ? null : pick.surface))

  // agent drafts still waiting for "Setujui" (Selesai is refused until none are left; the server checks too)
  const unapproved = visit ? [...(draft?.source === 'ai_draft' && !draft.approved_at ? [draft] : []),
    ...visit.draft_findings.filter((f) => f.source === 'ai_draft' && !f.approved_at),
    ...visit.draft_procedures.filter((x) => x.source === 'ai_draft' && !x.approved_at)].length : 0
  const isDpjp = !!visit && visit.dentist.id === me.user.id && can('note.sign')

  async function selesai(pin?: string) {
    if (!visit || !draft) return
    setSigning({ busy: true, error: '' })
    try {
      await selesaiVisit(visit.id, { revision: draft.revision, confirm: true, ...(pin ? { pin } : {}) })
      setSigning(null)
      setMsg('Selesai: rekam medis terkunci dan kunjungan ditutup.')
      await load()
    } catch (e) {
      if (e instanceof ApiError && e.data?.signed) { // #55: signed, but the invoice guard kept the visit open
        setSigning(null)
        setMsg(`Rekam medis sudah ditandatangani, tetapi kunjungan belum ditutup: ${e.data.message ?? 'tagihan belum lengkap.'}`)
        await load()
        return
      }
      setSigning({ busy: false, error: e instanceof ApiError && [403, 409, 422].includes(e.status) ? e.data?.message ?? 'Tidak bisa diproses.' : errorText(e) })
    }
  }

  const items = [...chart.findings, ...mine]
  const procs = [...chart.procedures, ...myProcs]
  const summary = findingSummary(items)
  const only = pick && allFor !== pick.tooth ? pick.tooth : null
  const shownItems = only ? items.filter((f) => f.tooth === only) : items
  const shownProcs = only ? procs.filter((x) => x.tooth === only) : procs
  const saveWhy = !visit ? 'Belum ada kunjungan aktif. Mulai kunjungan dulu.' : !editable ? asOf ? 'Tampilan riwayat: hanya baca.' : 'Hanya lihat: kunjungan ini sudah Selesai atau Anda tidak berhak menulis.'
    : !chosen ? 'Pilih kondisi terlebih dahulu' : ''
  const center: Surface | null = pick && (isAnterior(pick.tooth) ? 'I' : 'O')
  const panel = !pick ? <p className="muted tooth-empty">Pilih gigi untuk melihat detail.</p> : (
    <>
      <div className="tooth-panel-head">
        <div><h2>Gigi {pick.tooth}</h2><p className="tooth-name">{toothAnatomicalName(pick.tooth)}</p></div>
        <button type="button" className="btn btn-ghost tooth-close" aria-label="Tutup detail gigi" autoFocus={mobile} onClick={() => setPick(null)}>×</button>
      </div>
      <p className="muted small" role="status">Dipilih: Gigi {pick.tooth} · {surfaceName(pick.tooth, pick.surface)} ({surfaceLabel(pick.tooth, pick.surface)})</p>
      <div className="surf-pad" role="group" aria-label="Permukaan">
        {PAD.map(([s, pos]) => {
          const sv = s === 'O' ? center! : s
          return <button key={pos} type="button" className={`surf surf-${pos}`} aria-pressed={pick.surface === sv} title={surfaceName(pick.tooth, sv)}
            onClick={() => setPick({ tooth: pick.tooth, surface: sv })}>{surfaceLabel(pick.tooth, sv)}</button>
        })}
      </div>
      {items.some((f) => f.tooth === pick.tooth) || procs.some((x) => x.tooth === pick.tooth) ? (
        <ul className="items tooth-findings" aria-label={`Temuan gigi ${pick.tooth}`}>
          {items.filter((f) => f.tooth === pick.tooth).map((f) => (
            <li key={f.id}>{f.surface ? surfaceLabel(f.tooth, f.surface) : 'Seluruh gigi'} · {conditionOf(f.condition)?.label ?? f.condition}
              {f.state === 'draft' && <span className="badge badge-draft">Draf</span>}</li>
          ))}
          {procs.filter((x) => x.tooth === pick.tooth).map((x) => (
            <li key={x.id}><StatusChip status={x.status} /> {procedureText(x)}{x.state === 'draft' && <span className="badge badge-draft">Draf</span>}</li>
          ))}
        </ul>
      ) : <p className="muted small">Belum ada temuan di gigi ini.</p>}
      {editable ? (
        <div className="picker-pop" role="group" aria-label="Pilih kondisi">
          <div className="cond-row" role="group" aria-label="Tindakan">
            <span className="muted small">Tindakan:</span>
            <label className="small">Kode ICD-9-CM <input className="mono" size={6} value={procCode} placeholder="23.2" onChange={(e) => setProcCode(e.target.value)} /></label>
            <label className="small">Status <select value={status} onChange={(e) => setStatus(e.target.value as ProcStatus)}>
              {CHOOSABLE.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </select></label>
            {surfacesOf(pick.tooth).map((sf) => (
              <button key={sf} type="button" className="btn btn-xs" aria-pressed={surfs.includes(sf)} title={surfaceName(pick.tooth, sf)}
                onClick={() => setSurfs(surfs.includes(sf) ? surfs.filter((x) => x !== sf) : [...surfs, sf])}>{surfaceLabel(pick.tooth, sf)}</button>
            ))}
            {external && (
              <>
                <label className="small">Nama klinik lain * <input size={18} maxLength={120} value={extClinic} onChange={(e) => setExtClinic(e.target.value)} /></label>
                <label className="small">Perkiraan tanggal * <input size={10} value={extDate} placeholder="2025 / 06/2025 / 12/06/2025" onChange={(e) => setExtDate(e.target.value)} /></label>
                <span className="muted small">Tidak ditagih.</span>
                {extBlocked ? <span className="form-error small" role="alert">Gigi/permukaan ini sudah dikerjakan hari ini; tidak bisa dicatat sebagai klinik lain.</span>
                  : selesaiToday.length > 0 && <span className="notice notice-warn small">Kunjungan ini sudah ada tindakan selesai hari ini: perlu konfirmasi resepsionis/asisten.</span>}
              </>
            )}
            <button className="btn btn-xs btn-primary" onClick={record} disabled={extBlocked || (external && (!extClinic.trim() || !extDate.trim()))}>Simpan tindakan{surfaces ? ` (${[...surfaces].map((sf) => surfaceLabel(pick.tooth, sf as Surface)).join('')})` : ' (seluruh gigi)'}</button>
          </div>
          <div className="cond-row">
            <span className="muted small">Kondisi permukaan:</span>
            {CONDITIONS.filter((c) => !c.whole).map((c) => <button key={c.key} type="button" className={`btn cond cond-${c.key}`} aria-pressed={chosen?.condition === c.key} onClick={() => choose(c.key, false)}>{c.label}</button>)}
            {myDraftAt(false) && <button className="btn btn-xs btn-ghost" onClick={() => run(() => discardFinding(myDraftAt(false)!.id))}>Hapus draf permukaan</button>}
          </div>
          <div className="cond-row">
            <span className="muted small">Kondisi seluruh gigi:</span>
            {CONDITIONS.filter((c) => c.whole).map((c) => <button key={c.key} type="button" className={`btn cond cond-${c.key}`} aria-pressed={chosen?.condition === c.key} onClick={() => choose(c.key, true)}>{c.label}</button>)}
            {myDraftAt(true) && <button className="btn btn-xs btn-ghost" onClick={() => run(() => discardFinding(myDraftAt(true)!.id))}>Hapus draf gigi</button>}
          </div>
        </div>
      ) : <p className="muted small">Hanya lihat: kondisi dan tindakan diisi dari kunjungan aktif yang belum Selesai.</p>}
      {startCtl}
      <button type="button" className="btn btn-primary tooth-save" disabled={!!saveWhy || saving} title={saveWhy || undefined} aria-describedby={saveWhy ? 'save-why' : undefined}
        onClick={saveChosen}>{saving ? 'Menyimpan…' : 'Simpan ke kunjungan hari ini'}</button>
      {saveWhy && <p id="save-why" className="muted small">{saveWhy}</p>}
    </>
  )

  return page(
    <div className="chart-actions">
      {can('appointment.create') && <a className="btn btn-primary" href="#/jadwal">Buat janji</a>}
    </div>,
    (pp: PatientFull) => <>
      {msg && <p className="notice" role="status">{msg}</p>}

      <div role="tablist" aria-label="Bagian rekam medis" className="tabs chart-tabs">
        {INNER.map(([k, label]) => (
          <button key={k} type="button" role="tab" id={`ct-${k}`} aria-selected={tab === k} aria-controls="chart-tabpanel" className={tab === k ? 'on' : undefined} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      <div role="tabpanel" id="chart-tabpanel" aria-labelledby={`ct-${tab}`}>
      {tab === 'odo' && (
        <div className="grid-12 chart-grid">
          <section className="card span-8 odo-card" aria-label="Odontogram">
            <div className="card-head">
              <h2>Odontogram</h2>
              {mine.length + myProcs.length > 0 && <span className="badge badge-draft">Draf: {mine.length} temuan, {myProcs.length} tindakan</span>}
              {mine.some((d) => d.source === 'ai_draft') && <span className="badge badge-ai">{AI_BADGE}</span>}
              <div className="card-head-tools">
                <label className="small">Lihat per tanggal <input type="date" value={asOf} max={new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })}
                  onChange={(e) => setAsOf(e.target.value)} /></label>
                {asOf && <button className="btn btn-xs" onClick={() => setAsOf('')}>Kembali ke hari ini</button>}
                <Seg label="Dentisi" value={dent ?? 'tetap'} onChange={(v) => setDentPick({ base: defDent, v })} options={[['tetap', 'Tetap'], ['sulung', 'Sulung'], ['campuran', 'Campuran']]} />
                <Seg label="Tampilan" value={view} onChange={changeView} options={[['2d', '2D'], ['3d', '3D']]} />
              </div>
            </div>
            {chart.as_of && <p className="notice notice-warn small" role="status">Tampilan riwayat: keadaan pada akhir {chart.as_of} (WIB). Hanya baca.</p>}
            <p className={summary ? 'odo-summary' : 'odo-summary muted'} role="note" aria-label="Ringkasan temuan">{summary || 'Belum ada temuan.'}</p>
            <button type="button" className="btn btn-xs odo-legend-toggle" aria-expanded={legendOpen} aria-controls="odo-legends" onClick={() => setLegendOpen(!legendOpen)}>
              {legendOpen ? 'Sembunyikan legenda' : 'Tampilkan legenda'}
            </button>
            {legendOpen && (
              <div className="odo-legends" id="odo-legends">
                <StatusLegend />
                <Legend />
              </div>
            )}
            {can('note.write') && (
              <div className="baseline-row">
                <span className="muted small">Keadaan awal: {chart.baseline ? `${chart.baseline.dentition} · versi ${chart.baseline.version}` : 'belum diisi (isi di kunjungan pertama)'}</span>
                <button className="btn btn-xs" aria-pressed={baselineOpen} onClick={() => setBaselineOpen(!baselineOpen)}>{baselineOpen ? 'Tutup keadaan awal' : 'Isi / ubah keadaan awal'}</button>
              </div>
            )}
            {baselineOpen && <BaselineEditor value={chart.baseline} onClose={() => setBaselineOpen(false)}
              onSave={(b) => run(async () => { await saveBaseline(p.id, { base_version: chart.baseline?.version ?? null, ...b }); setBaselineOpen(false) }, 'Keadaan awal tersimpan (versi baru).')} />}
            {view === '3d' && (
              <>
                <Odontogram3D marks={marks} baseline={chart.baseline?.teeth} dentition={dent} selected={pick} onPick={onPick} />
                <p className="muted small odo3d-note">Tampilan 3D hanya baca; overlay mengikuti data bagan dan legenda internal. Ketuk gigi/permukaan di 3D untuk memilih, atau pakai bagan 2D di bawah untuk input per permukaan.</p>
              </>
            )}
            {phone ? <>
              {/* Phone (≤480px, sketch 06): one sideways scroller per jaw; each opens centred on its midline (11|21, 41|31; 51|61, 81|71). */}
              <p className="muted small odo-jaw-hint">{DENT_HINT[dent ?? ''] ?? 'FDI dewasa + sulung'} · geser rahang, ketuk gigi untuk detail</p>
              {(['upper', 'lower'] as const).map((arch) => (
                <div key={arch} className="odo-jaw">
                  <p className="odo-jaw-head"><span id={`jaw-${arch}`}>{arch === 'upper' ? 'Rahang atas' : 'Rahang bawah'}</span> <span className="muted">kanan ← kiri pasien</span></p>
                  <div className="odo2d-wrap odo-jaw-scroll" role="group" aria-labelledby={`jaw-${arch}`} ref={(el) => centre(el, String(dent))}>
                    <Odontogram arch={arch} marks={marks} baseline={chart.baseline?.teeth} dentition={dent} compact={view === '3d'} selected={pick ? `t${pick.tooth}-${pick.surface}` : null} onPick={onPick} />
                  </div>
                </div>
              ))}
            </> : (
            // ≤720px: the chart keeps its size and scrolls sideways; opens centred on the midline (11|21).
            <div className="odo2d-wrap" ref={(el) => { if (mobile) centre(el, String(dent)) }}>
              <Odontogram marks={marks} baseline={chart.baseline?.teeth} dentition={dent} compact={view === '3d'} selected={pick ? `t${pick.tooth}-${pick.surface}` : null} onPick={onPick} />
            </div>
            )}
            {!editable && (visit ? <p className="muted small">{asOf ? 'Tampilan riwayat: hanya baca.' : 'Kunjungan ini sudah Selesai.'}</p> : (
              <div className="chart-cta small">
                <p>Belum ada kunjungan aktif. Mulai kunjungan hari ini (tanpa janji juga bisa) untuk mengisi odontogram dan SOAP.</p>
                {!pick && startCtl /* with a tooth picked the control sits in the tooth panel/sheet instead */}
                <a href={can('appointment.read') ? '#/jadwal' : '#/'}>Buka janji hari ini</a>
              </div>
            ))}
          </section>
          {!mobile ? <aside className="card span-4 tooth-panel" aria-label="Detail gigi">{panel}</aside> : pick && (
            // Mobile: tooth detail is a bottom sheet. Backdrop tap / × / Esc close it and clear the pick (same as × on desktop).
            <>
              <div className="sheet-backdrop" onClick={() => setPick(null)} />
              <aside className="card tooth-panel sheet tooth-sheet" role="dialog" aria-modal="true" aria-label={`Detail gigi ${pick.tooth}`}
                onKeyDown={(e) => { if (e.key === 'Escape') setPick(null); else trapTab(e) }}>
                {/* Designer note: patient + allergies pinned at the top of the sheet while recording a finding. Header patient, no refetch. */}
                <div className="sheet-strip">
                  <p><strong>{pp.name}</strong> <span className="muted small">{[ageTahun(pp.dob), pp.sex && (SEX[pp.sex] ?? pp.sex)].filter(Boolean).map((x) => x + ' · ')}
                    <span className="patient-mrn">No. RM <strong>{pp.mrn ?? 'belum ada'}</strong></span></span></p>
                  <AlertRibbon patientId={pp.id} compactDefault label="Peringatan medis di detail gigi" only={['premedikasi', 'catatan_penting', 'alergi', 'kosong']} />
                </div>
                {panel}
              </aside>
            </>
          )}
          <section className="card span-12" aria-labelledby="temuan-title">
            <div className="temuan-head">
              <h2 id="temuan-title">Temuan &amp; tindakan</h2>
              <div className="seg" role="radiogroup" aria-label="Saring temuan">
                <button type="button" role="radio" aria-checked={!only} className={!only ? 'is-on' : ''} onClick={() => setAllFor(pick?.tooth ?? null)}>Semua gigi</button>
                {pick && <button type="button" role="radio" aria-checked={!!only} className={only ? 'is-on' : ''} onClick={() => setAllFor(null)}>Gigi {pick.tooth}</button>}
              </div>
            </div>
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
              <SoapFields form={form} readOnly={!editable} onChange={(f) => { setForm(f); setDirty(true) }} />
              {editable && (
                <div className="dialog-actions">
                  <button className="btn" disabled={!dirty} onClick={() => run(() => saveNote(visit.id, { revision: draft?.revision ?? null, soap: toSoap(form) }), 'Draf tersimpan.')}>Simpan draf</button>
                  {isDpjp && draft && unapproved > 0 && (
                    <button className="btn" onClick={() => run(() => approveDrafts(visit.id), 'Draf agen disetujui.')}>Setujui draf agen ({unapproved})</button>
                  )}
                  {isDpjp && draft && (
                    <button className="btn btn-primary" disabled={dirty || unapproved > 0}
                      title={dirty ? 'Simpan draf dulu' : unapproved > 0 ? 'Setujui draf agen dulu' : undefined} onClick={() => setSigning({ busy: false, error: '' })}>Selesai</button>
                  )}
                </div>
              )}
            </div>
          )}

          {visit && visit.status === 'berlangsung' && !asOf && can('appointment.transition') && (
            <CloseVisit visit={visit} needsSelesai={!!visit.needs_selesai && !visit.attendance_cancelled} canBilling={can('billing.read')} onDone={async () => { await load(); setMsg('Kunjungan diperbarui.') }} />
          )}

          <div className="card">
            <h2>Riwayat kunjungan</h2>
            <History visits={chart.visits} me={me} onFix={setFixing} onApprove={(id) => run(() => approveCorrection(id), 'Koreksi disetujui.')} />
          </div>
        </div>
      )}
      {(tab === 'plan' || tab === 'rx' || tab === 'bill') && <div className="card state-card muted">Belum tersedia.</div>}
      </div>

      {signing && visit && draft && (
        <SelesaiDialog busy={signing.busy} error={signing.error} onClose={() => setSigning(null)} onConfirm={selesai}
          pinRequired={!!me.selesai?.pin_required} hasPin={!!me.selesai?.has_pin}
          lines={[`Catatan SOAP versi ${draft.version} (revisi ${draft.revision})${draft.soap.A.codes.length ? ' · ICD-10 ' + draft.soap.A.codes.join(', ') : ''}`,
            ...visit.draft_findings.map((f) => findingText(f) + (f.created_by !== me.user.id ? ' (draf pengguna lain)' : '')),
            ...visit.draft_procedures.map((x) => procedureText(x) + ` · ${statusOf(x.status)?.label ?? x.status}` + (x.created_by !== me.user.id ? ' (draf pengguna lain)' : ''))]} />
      )}
      {procFix && <ProcedureFixDialog p={procFix.p} mode={procFix.mode} visitId={visit?.id ?? null} onClose={() => setProcFix(null)}
        onDone={async (m) => { setProcFix(null); await load(); setMsg(m) }} />}
      {fixing && <CorrectionDialog note={fixing} solo={chart.solo_practice} onClose={() => setFixing(null)} onDone={async () => { setFixing(null); await load(); setMsg('Koreksi tersimpan.') }} />}
    </>,
    visit?.status === 'berlangsung' && !visit.notes.some((n) => n.versions.some((x) => x.signed_at))
      ? <span className="visit-chip" role="note" aria-label="Status kunjungan">{visitStatusText(visit, mobile)}</span> : null,
  )
}
