import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import { setActivePatient } from '../../shared/activePatient'
import type { Me } from '../../shared/session'
import {
  approveCorrection, changeStatus, confirmExternal, correctNote, correctProcedure, replaceProcedure, discardFinding, discardProcedure, getChart, saveBaseline, saveFinding, saveNote, saveProcedure, signVisit,
  visitFromAppointment, type Baseline, type Chart, type ChartVisit, type Note, type ProcStatus, type Procedure, type ProcedureHistoryRow, type Soap, type Surface, type ToothPresence, type Version,
} from './api'
import { AI_BADGE, CHOOSABLE, CONDITIONS, findingText, paintCondition, PRESENCE, procedureText, sameSite, statusOf, surfaceLabel, surfaceName, surfacesOf } from './legend'
import { Legend, Odontogram, type Mark } from './Odontogram'
import { SignDialog } from './SignDialog'
import './clinical.css'

type Form = { S: string; O: string; A: { codes: string; text: string }; P: { codes: string; text: string } }
const EMPTY: Form = { S: '', O: '', A: { codes: '', text: '' }, P: { codes: '', text: '' } }
const toForm = (s: Soap): Form => ({ S: s.S, O: s.O, A: { codes: s.A.codes.join(', '), text: s.A.text }, P: { codes: s.P.codes.join(', '), text: s.P.text } })
const codes = (s: string) => s.split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter(Boolean)
const toSoap = (f: Form): Soap => ({ S: f.S, O: f.O, A: { codes: codes(f.A.codes), text: f.A.text }, P: { codes: codes(f.P.codes), text: f.P.text } })
const TABS = [['S', 'Subjektif'], ['O', 'Objektif'], ['A', 'Asesmen (ICD-10)'], ['P', 'Rencana (ICD-9-CM)']] as const
const fmt = (iso: string | null) => iso ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—'
const FREE_EDIT_MS = 48 * 3600 * 1000

function StatusBadge({ v }: { v: Version }) {
  return (
    <>
      {v.status === 'draf' ? <span className="badge badge-draft">Draf</span>
        : v.status === 'berlaku' ? <span className="badge badge-signed">🔒 Ditandatangani</span>
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
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (reason.trim().length < 10) return setError('Alasan wajib, minimal 10 huruf.')
    if (mode === 'ganti' && (!visitId || !code.trim())) return setError(visitId ? 'Kode tindakan pengganti wajib.' : 'Buka kunjungan aktif dulu.')
    setBusy(true)
    try {
      const sf = surfaces.trim().toUpperCase() || null
      if (mode === 'ganti') await replaceProcedure(p.id, { visit_id: visitId!, status: to, procedure_code: code.trim(), tooth: p.tooth, surfaces: sf, reason: reason.trim() })
      else await correctProcedure(p.id, { reason: reason.trim(), procedure_code: code.trim() || undefined, surfaces: sf })
      onDone(mode === 'ganti' ? 'Tindakan lama ditandai Digantikan; tindakan baru tercatat.' : 'Koreksi tersimpan (baris baru; versi lama tetap).')
    } catch (err) {
      setError(err instanceof ApiError && (err.status === 409 || err.status === 422) ? err.data?.message ?? 'Data tidak valid.' : errorText(err))
      setBusy(false)
    }
  }
  return (
    <div className="overlay" onClick={onClose}>
      <form className="card dialog" role="dialog" aria-modal="true" aria-labelledby="pfix-title" onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
        <h2 id="pfix-title">{mode === 'ganti' ? 'Ganti tindakan' : 'Koreksi tindakan'}: {procedureText(p)}</h2>
        <label>Alasan *<textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!error} /></label>
        <label>Kode ICD-9-CM{mode === 'ganti' ? ' pengganti *' : ''} <input className="mono" size={6} value={code} placeholder="23.41" onChange={(e) => setCode(e.target.value)} /></label>
        <label>Permukaan (kosong = seluruh gigi) <input className="mono" size={6} value={surfaces} onChange={(e) => setSurfaces(e.target.value)} /></label>
        {mode === 'ganti' && <label>Status <select value={to} onChange={(e) => setTo(e.target.value as 'direncanakan' | 'selesai')}>
          <option value="direncanakan">Direncanakan</option><option value="selesai">Selesai (ditagih)</option></select></label>}
        <p className="muted small">{mode === 'ganti' ? 'Tindakan lama tetap tersimpan sebagai “Digantikan”; tagihannya tidak berubah.' : 'Status tidak dikoreksi di sini. Koreksi tidak menambah tagihan.'}</p>
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

/** Treatments with status chips. Dentists move a signed procedure along the allowed transitions (server appends a new row). */
function Items({ items, canMove, onMove, onDiscard, onFix }: { items: Procedure[]; canMove: boolean; onMove: (p: Procedure, to: ProcStatus) => void; onDiscard: (p: Procedure) => void
  onFix: (p: Procedure, mode: 'ganti' | 'koreksi') => void }) {
  if (!items.length) return null
  return (
    <ul className="items" aria-label="Tindakan dan status">
      {[...items].sort((a, b) => (a.tooth ?? 0) - (b.tooth ?? 0)).map((p) => (
        <li key={p.id}>
          <span>{procedureText(p)}</span> <StatusChip status={p.status} />
          {p.state === 'draft' ? <><span className="badge badge-draft">Draf</span> <button className="btn btn-xs btn-ghost" onClick={() => onDiscard(p)}>Hapus draf</button></>
            : <span className="muted small">🔒</span>}
          {p.state === 'final' && canMove && statusOf(p.status)?.next.map((to) => (
            <button key={to} className="btn btn-xs" onClick={() => onMove(p, to)}>→ {statusOf(to)!.label}</button>
          ))}
          {p.state === 'final' && canMove && REPLACEABLE.includes(p.status) && <button className="btn btn-xs" onClick={() => onFix(p, 'ganti')}>Ganti…</button>}
          {p.state === 'final' && canMove && <button className="btn btn-xs btn-ghost" onClick={() => onFix(p, 'koreksi')}>Koreksi…</button>}
        </li>
      ))}
    </ul>
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
  const can = (p: string) => me.permissions.includes(p)

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

  if (error) return <div className="card state-card error">{error} <a href="#/pasien">Kembali</a></div>
  if (!chart) return <div className="card state-card muted">Memuat rekam medis…</div>
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
  const choose = (condition: string, whole: boolean) => pick && visit && run(() => saveFinding(visit.id,
    { tooth: pick.tooth, surface: whole ? null : pick.surface, condition }))
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

  async function sign(code: string) {
    if (!visit || !draft) return
    setSigning({ busy: true, error: '' })
    try {
      await signVisit(visit.id, { revision: draft.revision, confirm: true, code })
      setSigning(null)
      setMsg('Rekam medis ditandatangani dan terkunci.')
      await load()
    } catch (e) {
      setSigning({ busy: false, error: e instanceof ApiError && e.status === 403 ? 'Kode salah atau Anda bukan dokter penulis catatan ini.'
        : e instanceof ApiError && e.status === 409 ? 'Draf berubah. Tutup, periksa lagi, lalu tanda tangani.' : errorText(e) })
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <a href={`#/pasien/${p.id}`} className="muted small">← Data pasien</a>
          <h1>Rekam Medis · {p.name}</h1>
          <p className="muted small">Lahir {p.dob ?? '—'} · {p.sex === 'laki_laki' ? 'Laki-laki' : p.sex === 'perempuan' ? 'Perempuan' : '—'} · Penjamin {p.payer_type}</p>
        </div>
        {visit && <div className="muted small">Kunjungan aktif: {fmt(visit.started_at)}</div>}
      </div>
      {msg && <p className="notice" role="status">{msg}</p>}

      <div className="card">
        <div className="card-head">
          <h2>Odontogram</h2>
          {mine.length + myProcs.length > 0 && <span className="badge badge-draft">Draf: {mine.length} temuan, {myProcs.length} tindakan</span>}
          {mine.some((d) => d.source === 'ai_draft') && <span className="badge badge-ai">{AI_BADGE}</span>}
          <label className="small">Lihat per tanggal <input type="date" value={asOf} max={new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })}
            onChange={(e) => setAsOf(e.target.value)} /></label>
          {asOf && <button className="btn btn-xs" onClick={() => setAsOf('')}>Kembali ke hari ini</button>}
        </div>
        {chart.as_of && <p className="notice notice-warn small" role="status">Tampilan riwayat: keadaan pada akhir {chart.as_of} (WIB). Hanya baca.</p>}
        {can('note.write') && (
          <div className="baseline-row">
            <span className="muted small">Keadaan awal: {chart.baseline ? `${chart.baseline.dentition} · versi ${chart.baseline.version}` : 'belum diisi (isi di kunjungan pertama)'}</span>
            <button className="btn btn-xs" aria-pressed={baselineOpen} onClick={() => setBaselineOpen(!baselineOpen)}>{baselineOpen ? 'Tutup keadaan awal' : 'Isi / ubah keadaan awal'}</button>
          </div>
        )}
        {baselineOpen && <BaselineEditor value={chart.baseline} onClose={() => setBaselineOpen(false)}
          onSave={(b) => run(async () => { await saveBaseline(p.id, { base_version: chart.baseline?.version ?? null, ...b }); setBaselineOpen(false) }, 'Keadaan awal tersimpan (versi baru).')} />}
        <Odontogram marks={marks} baseline={chart.baseline?.teeth} dentition={chart.baseline?.dentition} selected={pick ? `t${pick.tooth}-${pick.surface}` : null}
          onPick={editable ? (tooth, surface) => { setSurfs(pick?.tooth === tooth ? (surfs.includes(surface) ? surfs : [...surfs, surface]) : [surface]); setPick({ tooth, surface }) } : undefined} />
        {!editable && <p className="muted small">{visit ? 'Kunjungan ini sudah ditandatangani.' : 'Tidak ada kunjungan aktif. Buka dari kartu janji untuk mengisi.'}</p>}
        {pick && editable && (
          <div className="picker-pop" role="group" aria-label="Pilih kondisi">
            <strong>Gigi {pick.tooth} · {surfaceName(pick.tooth, pick.surface)} ({surfaceLabel(pick.tooth, pick.surface)})</strong>
            <div className="cond-row" role="group" aria-label="Tindakan">
              <span className="muted small">Tindakan:</span>
              <label className="small">Kode ICD-9-CM <input className="mono" size={6} value={procCode} placeholder="23.2" onChange={(e) => setProcCode(e.target.value)} /></label>
              <label className="small">Status <select value={status} onChange={(e) => setStatus(e.target.value as ProcStatus)}>
                {CHOOSABLE.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
              </select></label>
              {surfacesOf(pick.tooth).map((s) => (
                <button key={s} type="button" className="btn btn-xs" aria-pressed={surfs.includes(s)} title={surfaceName(pick.tooth, s)}
                  onClick={() => setSurfs(surfs.includes(s) ? surfs.filter((x) => x !== s) : [...surfs, s])}>{surfaceLabel(pick.tooth, s)}</button>
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
              <button className="btn btn-xs btn-primary" onClick={record} disabled={extBlocked || (external && (!extClinic.trim() || !extDate.trim()))}>Simpan tindakan{surfaces ? ` (${[...surfaces].map((s) => surfaceLabel(pick.tooth, s as Surface)).join('')})` : ' (seluruh gigi)'}</button>
            </div>
            <div className="cond-row">
              <span className="muted small">Kondisi permukaan:</span>
              {CONDITIONS.filter((c) => !c.whole).map((c) => <button key={c.key} className={`btn btn-xs cond cond-${c.key}`} onClick={() => choose(c.key, false)}>{c.label}</button>)}
              {myDraftAt(false) && <button className="btn btn-xs btn-ghost" onClick={() => run(() => discardFinding(myDraftAt(false)!.id))}>Hapus draf permukaan</button>}
            </div>
            <div className="cond-row">
              <span className="muted small">Kondisi seluruh gigi:</span>
              {CONDITIONS.filter((c) => c.whole).map((c) => <button key={c.key} className={`btn btn-xs cond cond-${c.key}`} onClick={() => choose(c.key, true)}>{c.label}</button>)}
              {myDraftAt(true) && <button className="btn btn-xs btn-ghost" onClick={() => run(() => discardFinding(myDraftAt(true)!.id))}>Hapus draf gigi</button>}
            </div>
            <button className="btn btn-xs btn-link" onClick={() => setPick(null)}>Tutup</button>
          </div>
        )}
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
        <Items items={[...chart.procedures, ...myProcs]} canMove={can('note.sign') && !asOf} onDiscard={(p) => run(() => discardProcedure(p.id))}
          onFix={(p, mode) => setProcFix({ p, mode })}
          onMove={(p, to) => run(() => changeStatus(p.id, to, visit?.id), `Status ${procedureText(p)} diubah (baris baru; versi lama tetap).`)} />
        <ProcedureHistory rows={chart.procedure_history} />
        <Legend />
      </div>

      {visit && (
        <div className="card">
          <div className="card-head">
            <h2>Catatan SOAP</h2>
            {draft ? <StatusBadge v={draft} /> : note ? <span className="badge badge-signed">🔒 Ditandatangani</span> : <span className="badge badge-old">Belum ada</span>}
          </div>
          <SoapFields form={form} readOnly={!editable} onChange={(f) => { setForm(f); setDirty(true) }} />
          {editable && (
            <div className="dialog-actions">
              <button className="btn" disabled={!dirty} onClick={() => run(() => saveNote(visit.id, { revision: draft?.revision ?? null, soap: toSoap(form) }), 'Draf tersimpan.')}>Simpan draf</button>
              {can('note.sign') && note?.author_id === me.user.id && draft && (
                <button className="btn btn-primary" disabled={dirty} title={dirty ? 'Simpan draf dulu' : undefined} onClick={() => setSigning({ busy: false, error: '' })}>Tanda Tangani</button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2>Riwayat kunjungan</h2>
        <History visits={chart.visits} me={me} onFix={setFixing} onApprove={(id) => run(() => approveCorrection(id), 'Koreksi disetujui.')} />
      </div>

      {signing && visit && draft && (
        <SignDialog busy={signing.busy} error={signing.error} onClose={() => setSigning(null)} onConfirm={sign}
          lines={[`Catatan SOAP versi ${draft.version} (revisi ${draft.revision})${draft.soap.A.codes.length ? ' · ICD-10 ' + draft.soap.A.codes.join(', ') : ''}`,
            ...visit.draft_findings.map((f) => findingText(f) + (f.created_by !== me.user.id ? ' (draf pengguna lain)' : '')),
            ...visit.draft_procedures.map((p) => procedureText(p) + ` · ${statusOf(p.status)?.label ?? p.status}` + (p.created_by !== me.user.id ? ' (draf pengguna lain)' : ''))]} />
      )}
      {procFix && <ProcedureFixDialog p={procFix.p} mode={procFix.mode} visitId={visit?.id ?? null} onClose={() => setProcFix(null)}
        onDone={async (m) => { setProcFix(null); await load(); setMsg(m) }} />}
      {fixing && <CorrectionDialog note={fixing} solo={chart.solo_practice} onClose={() => setFixing(null)} onDone={async () => { setFixing(null); await load(); setMsg('Koreksi tersimpan.') }} />}
    </>
  )
}
