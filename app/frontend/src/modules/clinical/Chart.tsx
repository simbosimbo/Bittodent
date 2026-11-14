import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import { setActivePatient } from '../../shared/activePatient'
import { fmtDateTime } from '../../shared/format'
import type { Me } from '../../shared/session'
import { PAYER, PatientPage, SEX } from '../patients'
import {
  approveCorrection, changeStatus, correctNote, discardFinding, getChart, saveBaseline, saveFinding, saveNote, signVisit, visitFromAppointment,
  type Baseline, type Chart, type ChartVisit, type Finding, type Note, type ProcStatus, type Soap, type Surface, type ToothPresence, type Version,
} from './api'
import { AI_BADGE, CONDITIONS, conditionOf, findingText, PRESENCE, STATUSES, statusOf, surfaceLabel, surfaceName } from './legend'
import { Legend, Odontogram, StatusLegend, type Mark } from './Odontogram'
import { dentitionFromDob, Odontogram3D } from './Odontogram3D'
import { SignDialog } from './SignDialog'
import './clinical.css'

type Form = { S: string; O: string; A: { codes: string; text: string }; P: { codes: string; text: string } }
const EMPTY: Form = { S: '', O: '', A: { codes: '', text: '' }, P: { codes: '', text: '' } }
const toForm = (s: Soap): Form => ({ S: s.S, O: s.O, A: { codes: s.A.codes.join(', '), text: s.A.text }, P: { codes: s.P.codes.join(', '), text: s.P.text } })
const codes = (s: string) => s.split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter(Boolean)
const toSoap = (f: Form): Soap => ({ S: f.S, O: f.O, A: { codes: codes(f.A.codes), text: f.A.text }, P: { codes: codes(f.P.codes), text: f.P.text } })
const TABS = [['S', 'Subjektif'], ['O', 'Objektif'], ['A', 'Asesmen (ICD-10)'], ['P', 'Rencana (ICD-9-CM)']] as const
const fmt = (iso: string | null) => iso ? fmtDateTime(iso) : '—'
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

export function StatusChip({ status }: { status: string }) {
  return <span className={`chip st st-${status}`} data-status={statusOf(status)?.legend}>{statusOf(status)?.label ?? status}</span>
}

/** Findings table (Open Dental pattern, our data only). Dentists move a signed item along the allowed transitions (server appends a new row). */
function Items({ items, canMove, onMove }: { items: Finding[]; canMove: boolean; onMove: (f: Finding, to: ProcStatus) => void }) {
  if (!items.length) return null
  return (
    <div className="findings-wrap">
      <table className="table findings" aria-label="Temuan odontogram dan status">
        <thead><tr><th scope="col">Status</th><th scope="col">Gigi</th><th scope="col">Permukaan</th><th scope="col">Kondisi</th><th scope="col">Kode ICD-9-CM</th><th scope="col">Ubah status</th></tr></thead>
        <tbody>
          {[...items].sort((a, b) => a.tooth - b.tooth).map((f) => (
            <tr key={f.id}>
              <td><StatusChip status={f.status} /> {f.state === 'draft' ? <span className="badge badge-draft">Draf</span> : <span className="muted small" aria-label="Terkunci">🔒</span>}</td>
              <td className="mono">{f.tooth}</td>
              <td>{f.surface ? `${surfaceLabel(f.tooth, f.surface)} (${surfaceName(f.tooth, f.surface)})` : 'Seluruh gigi'}</td>
              <td>{conditionOf(f.condition)?.label ?? f.condition}</td>
              <td className="mono">{f.procedure_code ?? '—'}</td>
              <td>{f.state === 'final' && canMove && statusOf(f.status)?.next.map((to) => (
                <button key={to} className="btn btn-xs" onClick={() => onMove(f, to)}>→ {statusOf(to)!.label}</button>
              ))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">Biaya dan prioritas belum ada di data temuan.</p>
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
  const [status, setStatus] = useState<ProcStatus>('kondisi_pantau')
  const [procCode, setProcCode] = useState('')
  const [baselineOpen, setBaselineOpen] = useState(false)
  const [view, setView] = useState<'2d' | '3d'>('2d') // not persisted: 2D every time
  const [legendOpen, setLegendOpen] = useState(true)
  // 3D needs the vertical space: legends collapse on 3D, reopen on 2D; manual toggle still works in both.
  const changeView = (v: '2d' | '3d') => { setView(v); setLegendOpen(v === '2d') }
  // View-only dentition override, dropped when the default (baseline or DOB) changes; the baseline editor is what persists.
  const defDent = chart ? `${chart.patient.id}:${chart.baseline?.dentition ?? dentitionFromDob(chart.patient.dob)}` : ''
  const [dentPick, setDentPick] = useState<{ base: string; v: Baseline['dentition'] } | null>(null)
  const dent = dentPick?.base === defDent ? dentPick.v : defDent.split(':')[1] as Baseline['dentition'] | undefined
  const can = (p: string) => me.permissions.includes(p)

  const load = useCallback(async () => {
    try {
      const vid = appointmentId && can('note.write') ? (await visitFromAppointment(appointmentId)).id : null
      const c = await getChart(patientId)
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
  }, [patientId, appointmentId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const visit = chart?.visits.find((v) => v.id === visitId) ?? null
  const note = visit?.notes[0] ?? null
  const draft = note?.versions.find((x) => x.status === 'draf') ?? null
  const editable = !!visit && can('note.write') && !note?.versions.some((x) => x.signed_at)
  const mine = useMemo(() => chart?.drafts.filter((d) => d.visit_id === visitId) ?? [], [chart, visitId])
  const marks = useMemo(() => {
    const m: Record<string, Mark> = {}
    for (const f of [...(chart?.findings ?? []), ...mine]) {
      m[f.surface ? `t${f.tooth}-${f.surface}` : `t${f.tooth}`] = { condition: f.condition, state: f.state === 'draft' ? 'draft' : 'signed', source: f.source, status: f.status }
    }
    return m
  }, [chart, mine])

  // Profile tabs stay visible on the chart (record lives inside the patient), so wrap every state in PatientPage.
  const page = (actions: ReactNode, body: ReactNode) => <PatientPage id={patientId} tab="rekam-medis" canChart actions={actions}>{() => body}</PatientPage>
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
  const onPick = (tooth: number, surface: Surface) => setPick({ tooth, surface }) // selecting works anytime; picker only when editable
  const choose = (condition: string, whole: boolean) => pick && visit && run(() => saveFinding(visit.id,
    { tooth: pick.tooth, surface: whole ? null : pick.surface, condition, status, procedure_code: procCode.trim() || null }))
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

  return page(
    <div className="muted small chart-meta">
      <div>{p.sex ? SEX[p.sex] ?? p.sex : '—'} · Penjamin {PAYER[p.payer_type] ?? p.payer_type}</div>
      {visit && <div>Kunjungan aktif: {fmt(visit.started_at)}</div>}
    </div>,
    <>
      {msg && <p className="notice" role="status">{msg}</p>}

      <div className="card">
        <div className="card-head">
          <h2>Odontogram</h2>
          {mine.length > 0 && <span className="badge badge-draft">Draf: {mine.length} temuan</span>}
          {mine.some((d) => d.source === 'ai_draft') && <span className="badge badge-ai">{AI_BADGE}</span>}
          <div className="card-head-tools">
            <Seg label="Dentisi" value={dent ?? 'tetap'} onChange={(v) => setDentPick({ base: defDent, v })} options={[['tetap', 'Tetap'], ['sulung', 'Sulung'], ['campuran', 'Campuran']]} />
            <Seg label="Tampilan" value={view} onChange={changeView} options={[['2d', '2D'], ['3d', '3D']]} />
          </div>
        </div>
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
        <div className="odo2d-wrap">
          <Odontogram marks={marks} baseline={chart.baseline?.teeth} dentition={dent} compact={view === '3d'} selected={pick ? `t${pick.tooth}-${pick.surface}` : null} onPick={onPick} />
        </div>
        {!editable && (visit ? <p className="muted small">Kunjungan ini sudah ditandatangani.</p> : (
          <p className="chart-cta small">Belum ada kunjungan aktif. Odontogram dan SOAP diisi dari janji pasien hari ini.{' '}
            <a className="btn btn-primary" href={can('appointment.read') ? '#/jadwal' : '#/'}>Buka janji hari ini</a></p>
        ))}
        {pick && !editable && <p className="muted small" role="status">Dipilih: Gigi {pick.tooth} · {surfaceName(pick.tooth, pick.surface)} ({surfaceLabel(pick.tooth, pick.surface)})</p>}
        {pick && editable && (
          <div className="picker-pop" role="group" aria-label="Pilih kondisi">
            <strong>Gigi {pick.tooth} · {surfaceName(pick.tooth, pick.surface)} ({surfaceLabel(pick.tooth, pick.surface)})</strong>
            <div className="cond-row">
              <label className="small">Status <select value={status} onChange={(e) => setStatus(e.target.value as ProcStatus)}>
                {STATUSES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
              </select></label>
              <label className="small">Kode tindakan ICD-9-CM (opsional) <input className="mono" size={6} value={procCode} placeholder="23.2" onChange={(e) => setProcCode(e.target.value)} /></label>
            </div>
            <div className="cond-row">
              <span className="muted small">Permukaan:</span>
              {CONDITIONS.filter((c) => !c.whole).map((c) => <button key={c.key} className={`btn btn-xs cond cond-${c.key}`} onClick={() => choose(c.key, false)}>{c.label}</button>)}
              {myDraftAt(false) && <button className="btn btn-xs btn-ghost" onClick={() => run(() => discardFinding(myDraftAt(false)!.id))}>Hapus draf permukaan</button>}
            </div>
            <div className="cond-row">
              <span className="muted small">Seluruh gigi:</span>
              {CONDITIONS.filter((c) => c.whole).map((c) => <button key={c.key} className={`btn btn-xs cond cond-${c.key}`} onClick={() => choose(c.key, true)}>{c.label}</button>)}
              {myDraftAt(true) && <button className="btn btn-xs btn-ghost" onClick={() => run(() => discardFinding(myDraftAt(true)!.id))}>Hapus draf gigi</button>}
            </div>
            <button className="btn btn-xs btn-link" onClick={() => setPick(null)}>Tutup</button>
          </div>
        )}
        <Items items={[...chart.findings, ...mine]} canMove={can('note.sign')}
          onMove={(f, to) => run(() => changeStatus(f.id, to, visit?.id), `Status gigi ${f.tooth} diubah (baris baru; versi lama tetap).`)} />
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
            ...visit.draft_findings.map((f) => findingText(f) + (f.created_by !== me.user.id ? ' (draf pengguna lain)' : ''))]} />
      )}
      {fixing && <CorrectionDialog note={fixing} solo={chart.solo_practice} onClose={() => setFixing(null)} onDone={async () => { setFixing(null); await load(); setMsg('Koreksi tersimpan.') }} />}
    </>
  )
}
