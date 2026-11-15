import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import { fmtDate, fmtTime, todayWib } from '../../shared/format'
import type { Me } from '../../shared/session'
import { Icon, ICONS } from '../../shared/ui/Icon'
import { Sheet } from '../../shared/ui/Sheet'
import { useIsMobile } from '../../shared/useIsMobile'
import { PatientPicker } from '../patients'
import './scheduling.css'
import { createAppointment, getPlanned, getSchedule, schedulePlanned, STATUS, transition, type Appointment, type Planned, type Schedule as Sched } from './api'

const START = 8 * 60, END = 20 * 60, STEP = 30, ROW = 52
const SLOTS = Array.from({ length: (END - START) / STEP }, (_, i) => START + i * STEP)
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export function minutesOfDay(iso: string, tz: string) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso))
  return Number(p.find((x) => x.type === 'hour')!.value) * 60 + Number(p.find((x) => x.type === 'minute')!.value)
}

export const StatusChip = ({ status }: { status: string }) => <span className={`chip chip-${status}`}>{STATUS[status] ?? status}</span>

/** Current time, re-read every minute while `on` (mobile now-line). */
function useNow(on: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [on])
  return now
}

export function useSchedule(branchId: string | null, date: string) {
  const [data, setData] = useState<Sched | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    if (!branchId) return setLoading(false)
    setLoading(true)
    try {
      setData(await getSchedule(branchId, date))
      setError('')
    } catch (e) {
      setError(errorText(e))
    } finally {
      setLoading(false)
    }
  }, [branchId, date])
  useEffect(() => { reload() }, [reload])
  return { data, error, loading, reload }
}

export default function Schedule({ me }: { me: Me }) {
  const [date, setDate] = useState(todayWib)
  const { data, error, loading, reload } = useSchedule(me.active.branch_id, date)
  const [dialog, setDialog] = useState<{ chairId?: string; minute?: number } | null>(null)
  const [actionError, setActionError] = useState('')
  const canCreate = me.permissions.includes('appointment.create')
  const canMove = me.permissions.includes('appointment.transition')
  const canConfirm = me.permissions.includes('appointment.confirm')
  const canChart = me.permissions.includes('note.read')
  const canVisit = me.permissions.includes('note.write') // opening from the card starts/reuses the visit
  const tz = data?.branch.timezone ?? 'Asia/Jakarta'
  const mobile = useIsMobile()
  const [chairPick, setChairPick] = useState<string | null>(null)
  const [sheetId, setSheetId] = useState<string | null>(null) // mobile: tapped card -> action sheet
  const isToday = date === todayWib()
  const now = useNow(mobile && isToday)
  const shift = (days: number) => {
    const d = new Date(date + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + days)
    setDate(d.toISOString().slice(0, 10))
  }

  async function move(a: Appointment, to: string) {
    setActionError('')
    try {
      await transition(a.id, to)
      await reload()
    } catch (e) {
      // 409 invoice_required: done also closes the visit; completed work without an invoice line blocks it (unit 4)
      setActionError(e instanceof ApiError && e.status === 409 && e.data?.message ? e.data.message
        : e instanceof ApiError && e.status === 422 ? 'Status janji tidak bisa diubah.' : errorText(e))
    }
  }

  // One action list for the desktop card buttons and the mobile action sheet (sheetOnly = not on the desktop card).
  type Action = { label: string; run?: () => void; href?: string; primary?: boolean; sheetOnly?: boolean }
  const actions = (a: Appointment): Action[] => ([
    canMove && a.status === 'booked' && date === todayWib() && { label: 'Check-in', run: () => move(a, 'checked_in') },
    canMove && a.status === 'in_treatment' && { label: 'Selesai', run: () => move(a, 'done') },
    canChart && a.patient && !['cancelled', 'no_show', 'rejected', 'pending_confirmation'].includes(a.status) &&
      { label: 'Buka Rekam Medis', href: `#/rekam-medis/${a.patient.id}${canVisit ? `/janji/${a.id}` : ''}` },
    canConfirm && a.status === 'pending_confirmation' && a.source === 'online' && { label: 'Konfirmasi', run: () => move(a, 'booked'), primary: true, sheetOnly: true },
    canConfirm && a.status === 'pending_confirmation' && a.source === 'online' && { label: 'Tolak', run: () => move(a, 'rejected'), sheetOnly: true },
  ] as (Action | false | null | undefined)[]).filter((x): x is Action => !!x)
  const sheetAppt = sheetId ? data?.chairs.flatMap((c) => c.appointments).find((a) => a.id === sheetId) : undefined

  if (!me.active.branch_id) return <div className="card state-card">Belum ada cabang aktif.</div>
  const count = data?.chairs.reduce((n, c) => n + c.appointments.length, 0) ?? 0
  const pending = (data?.chairs.flatMap((c) => c.appointments) ?? [])
    .filter((a) => a.status === 'pending_confirmation' && a.source === 'online')
    .sort((x, y) => x.starts_at.localeCompare(y.starts_at))

  // Mobile: one chair column at a time. Default = chair of the next unfinished appointment, else the first chair.
  const nextChair = () => {
    const next = (data?.chairs.flatMap((c) => c.appointments) ?? [])
      .filter((a) => new Date(a.ends_at).getTime() > now && !['cancelled', 'no_show', 'rejected', 'done'].includes(a.status))
      .sort((x, y) => x.starts_at.localeCompare(y.starts_at))[0]
    return next?.chair_id ?? data?.chairs[0]?.id
  }
  const shownChair = mobile ? (data?.chairs.find((c) => c.id === chairPick) ?? data?.chairs.find((c) => c.id === nextChair())) : undefined
  const chairs = data ? (shownChair ? [shownChair] : data.chairs) : []
  const nowMin = mobile && isToday ? minutesOfDay(new Date(now).toISOString(), tz) - START : -1
  const nowTop = nowMin >= 0 && nowMin <= END - START ? (nowMin / STEP) * ROW : null

  const prev = <button className="btn" onClick={() => shift(-1)} aria-label="Hari sebelumnya">{mobile ? <Icon d={ICONS.left} /> : '‹'}</button>
  const next = <button className="btn" onClick={() => shift(1)} aria-label="Hari berikutnya">{mobile ? <Icon d={ICONS.right} /> : '›'}</button>
  const today = <button className="btn" onClick={() => setDate(todayWib())}>Hari ini</button>
  const dateInput = <input type="date" aria-label="Tanggal" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
  const create = canCreate && <button className="btn btn-primary" onClick={() => setDialog({})}>+ Buat Janji</button>

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="shell-dup-title">Jadwal</h1>
          <p className="muted">{fmtDate(date)} · {me.active.branch_name} · {count} janji</p>
        </div>
        {mobile ? (
          // Row 1: ‹ date › Hari ini; row 2: full-width Buat Janji (styles.css .sched-bar).
          <div className="toolbar sched-bar">{prev}{dateInput}{next}{today}{create}</div>
        ) : (
          <div className="toolbar">{prev}{today}{next}{dateInput}{create}</div>
        )}
      </div>
      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      {canConfirm && pending.length > 0 && (
        <div className="card confirm-card">
          <h2>Perlu konfirmasi <span className="muted small">· {pending.length}</span></h2>
          <ul className="confirm-list">
            {pending.map((a) => (
              <li key={a.id} className="confirm-row">
                <span className="appt-time">{fmtTime(a.starts_at, tz)}–{fmtTime(a.ends_at, tz)}</span>
                <span className="chip chip-online">Online</span>
                <div className="grow">
                  <strong>{a.patient?.name}</strong>
                  <div className="muted small">{[a.dentist?.name, a.reason].filter(Boolean).join(' · ')}</div>
                </div>
                <button className="btn btn-primary" onClick={() => move(a, 'booked')} aria-label={`Konfirmasi ${a.patient?.name ?? ''}`}>Konfirmasi</button>
                <button className="btn" onClick={() => move(a, 'rejected')} aria-label={`Tolak ${a.patient?.name ?? ''}`}>Tolak</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error ? <div className="card state-card error">{error} <button className="btn" onClick={reload}>Coba lagi</button></div>
        : !data ? <div className="card state-card muted">Memuat jadwal…</div>
        : data.chairs.length === 0 ? <div className="card state-card muted">Cabang ini belum punya kursi aktif.</div> : (
          <>
          {mobile && data.chairs.length > 1 && (
            <div className="chair-pills" role="group" aria-label="Pilih kursi">
              {data.chairs.map((c) => (
                <button key={c.id} type="button" aria-pressed={c === shownChair} onClick={() => setChairPick(c.id)}>
                  {c.label} <span className="muted small">· {c.appointments.length}</span>
                </button>
              ))}
            </div>
          )}
          {mobile && count === 0 && <p className="sched-empty muted" role="status">{isToday ? 'Tidak ada janji hari ini' : 'Tidak ada janji pada tanggal ini'}</p>}
          <div className={'card schedule' + (loading ? ' is-loading' : '')}>
            <div className="sched-grid" style={{ gridTemplateColumns: `64px repeat(${chairs.length}, minmax(${mobile ? 0 : 180}px, 1fr))` }}>
              <div className="sched-head" />
              {chairs.map((c) => <div key={c.id} className="sched-head">{c.label} <span className="muted small">· {c.appointments.length}</span></div>)}
              <div className="sched-times">
                {SLOTS.map((m) => <div key={m} className="sched-time" style={{ height: ROW }}>{m % 60 === 0 ? hhmm(m) : ''}</div>)}
                {nowTop !== null && <span className="sched-now-label" style={{ top: nowTop }}>{hhmm(nowMin + START)}</span>}
              </div>
              {chairs.map((c) => (
                <div key={c.id} className="sched-col" style={{ height: SLOTS.length * ROW }}>
                  {nowTop !== null && <div className="sched-now" style={{ top: nowTop }} aria-label={`Sekarang ${hhmm(nowMin + START)}`} role="img" />}
                  {SLOTS.map((m) => (
                    <div key={m} className={'sched-slot' + (m % 60 === 0 ? ' hour' : '') + (canCreate ? ' clickable' : '')} style={{ height: ROW }}
                      onClick={canCreate ? () => setDialog({ chairId: c.id, minute: m }) : undefined} />
                  ))}
                  {c.appointments.map((a) => {
                    const top = Math.max(0, minutesOfDay(a.starts_at, tz) - START)
                    const height = Math.max(STEP, (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000)
                    const box = { top: (top / STEP) * ROW + 2, height: (height / STEP) * ROW - 4 }
                    if (mobile) return (
                      // Phone: time + name + status only; tapping opens the action sheet.
                      <button key={a.id} type="button" className={`appt appt-${a.status}`} style={box} aria-haspopup="dialog" onClick={() => setSheetId(a.id)}>
                        <span className="appt-top">
                          <span className="appt-time">{fmtTime(a.starts_at, tz)}–{fmtTime(a.ends_at, tz)}</span>
                          {a.source === 'online' && <span className="chip chip-online">Online</span>}
                          <StatusChip status={a.status} />
                        </span>
                        <span className="appt-name">{a.patient?.name}</span>
                      </button>
                    )
                    return (
                      <div key={a.id} className={`appt appt-${a.status}`} style={box}>
                        <div className="appt-top">
                          <span className="appt-time">{fmtTime(a.starts_at, tz)}–{fmtTime(a.ends_at, tz)}</span>
                          {a.source === 'online' && <span className="chip chip-online">Online</span>}
                          {a.status === 'pending_confirmation' ? <span className="sr-only">{STATUS.pending_confirmation}</span> : <StatusChip status={a.status} />}
                        </div>
                        <div className="appt-name">{a.patient?.name}</div>
                        <div className="appt-bottom">
                          <span className="appt-meta">{a.reason ?? a.dentist?.name}</span>
                          {actions(a).filter((x) => !x.sheetOnly).map((x) => x.href
                            ? <a key={x.label} className="btn btn-xs" href={x.href}>{x.label}</a>
                            : <button key={x.label} className="btn btn-xs" onClick={x.run}>{x.label}</button>)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          </>
        )}
      {mobile && sheetAppt && (
        <Sheet title={sheetAppt.patient?.name ?? 'Janji'} onClose={() => setSheetId(null)} className="appt-sheet">
          <p className="appt-sheet-meta">
            <span>{fmtTime(sheetAppt.starts_at, tz)}–{fmtTime(sheetAppt.ends_at, tz)}</span>
            {sheetAppt.source === 'online' && <span className="chip chip-online">Online</span>}
            <StatusChip status={sheetAppt.status} />
          </p>
          {(sheetAppt.reason || sheetAppt.dentist) && <p className="muted">{[sheetAppt.reason, sheetAppt.dentist?.name].filter(Boolean).join(' · ')}</p>}
          <div className="appt-sheet-actions">
            {actions(sheetAppt).map((x) => x.href
              ? <a key={x.label} className="btn" href={x.href} onClick={() => setSheetId(null)}>{x.label}</a>
              : <button key={x.label} type="button" className={x.primary ? 'btn btn-primary' : 'btn'} onClick={() => { setSheetId(null); x.run?.() }}>{x.label}</button>)}
            {actions(sheetAppt).length === 0 && <p className="muted">Tidak ada aksi untuk janji ini.</p>}
          </div>
        </Sheet>
      )}
      {data && <PlannedList sched={data} date={date} canCreate={canCreate} onScheduled={reload} />}
      {dialog && data && (
        <BookDialog sched={data} date={date} me={me} initial={dialog} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); reload() }} />
      )}
    </>
  )
}

function BookDialog({ sched, date, me, initial, onClose, onSaved }: {
  sched: Sched; date: string; me: Me; initial: { chairId?: string; minute?: number }; onClose: () => void; onSaved: () => void
}) {
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(null)
  const [chairId, setChairId] = useState(initial.chairId ?? sched.chairs[0]?.id ?? '')
  const [dentistId, setDentistId] = useState(sched.dentists.find((d) => d.id === me.user.id)?.id ?? sched.dentists[0]?.id ?? '')
  const [minute, setMinute] = useState(initial.minute ?? 9 * 60)
  const [duration, setDuration] = useState(30)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    if (!patient) return setError('Pilih pasien terlebih dahulu.')
    if (!dentistId) return setError('Pilih dokter gigi.')
    if (minute + duration > END) return setError('Janji harus selesai paling lambat 20:00.')
    setBusy(true)
    setError('')
    // shortcut: fixed +07:00 (WIB) offset; all seeded branches are WIB. Derive from branch timezone when WITA/WIT branches exist.
    const at = (m: number) => `${date}T${hhmm(m)}:00+07:00`
    try {
      await createAppointment({ patient_id: patient.id, chair_id: chairId, dentist_id: dentistId, starts_at: at(minute), ends_at: at(minute + duration), reason: reason || null })
      onSaved()
    } catch (e) {
      setError(e instanceof ApiError && (e.status === 409 || e.status === 422) ? (e.data?.message ?? 'Data janji tidak valid.') : errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="card dialog" role="dialog" aria-modal="true" aria-labelledby="book-title" onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
        <h2 id="book-title">Buat Janji</h2>
        <p className="muted">{fmtDate(date)} · {sched.branch.name}</p>
        <PatientPicker value={patient} onChange={setPatient} />
        <div className="grid-2">
          <label>Kursi<select value={chairId} onChange={(e) => setChairId(e.target.value)}>{sched.chairs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
          <label>Dokter gigi<select value={dentistId} onChange={(e) => setDentistId(e.target.value)}>{sched.dentists.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label>Jam mulai<select value={minute} onChange={(e) => setMinute(Number(e.target.value))}>{SLOTS.map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}</select></label>
          <label>Durasi<select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{[30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} menit</option>)}</select></label>
        </div>
        <label>Keperluan (opsional)<input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="mis. Kontrol, scaling" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan janji'}</button>
        </div>
      </form>
    </div>
  )
}

/** "Perlu dijadwalkan": plans made at the chair; the front desk only picks chair + time. */
function PlannedList({ sched, date, canCreate, onScheduled }: { sched: Sched; date: string; canCreate: boolean; onScheduled: () => void }) {
  const [items, setItems] = useState<Planned[] | null>(null)
  const [pick, setPick] = useState<Record<string, { chair: string; minute: number }>>({})
  const [msg, setMsg] = useState('')
  const mobile = useIsMobile()
  const load = useCallback(() => getPlanned(sched.branch.id).then((r) => setItems(r.data), (e) => setMsg(errorText(e))), [sched.branch.id])
  useEffect(() => { load() }, [load])
  const sel = (p: Planned) => pick[p.id] ?? { chair: sched.chairs[0]?.id ?? '', minute: 9 * 60 }
  async function book(p: Planned) {
    const s = sel(p)
    setMsg('')
    try {
      // shortcut: fixed +07:00 (WIB) offset, same as BookDialog.
      await schedulePlanned(p.id, { chair_id: s.chair, starts_at: `${date}T${hhmm(s.minute)}:00+07:00` })
      setMsg(`Dijadwalkan: ${p.patient_name ?? 'pasien'} ${fmtDate(date)} ${hhmm(s.minute)}.`)
      await load()
      onScheduled()
    } catch (e) {
      setMsg(e instanceof ApiError && [409, 422].includes(e.status) ? e.data?.message ?? 'Tidak bisa dijadwalkan.' : errorText(e))
    }
  }
  return (
    <div className="card">
      <h2>Perlu dijadwalkan <span className="muted small">· {items?.length ?? '…'}</span></h2>
      {msg && <p className="notice" role="status">{msg}</p>}
      {items?.length === 0 && <p className="muted">Tidak ada rencana kunjungan yang menunggu.</p>}
      <ul className="planned">
        {items?.map((p) => (
          <li key={p.id} className="planned-row">
            <div>
              <strong>{p.patient_name}</strong> {p.priority === 'segera' && <span className="chip chip-urgent">Segera</span>}
              <div className="small">{p.procedure} · {p.est_minutes} menit · {p.dentist_name}</div>
              {p.note && <div className="muted small">Catatan: {p.note}</div>}
            </div>
            {canCreate && (
              <div className={mobile ? 'toolbar planned-bar' : 'toolbar'}>
                <select aria-label="Kursi" value={sel(p).chair} onChange={(e) => setPick({ ...pick, [p.id]: { ...sel(p), chair: e.target.value } })}>
                  {sched.chairs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <select aria-label="Jam mulai" value={sel(p).minute} onChange={(e) => setPick({ ...pick, [p.id]: { ...sel(p), minute: Number(e.target.value) } })}>
                  {SLOTS.filter((m) => m + p.est_minutes <= END).map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}
                </select>
                {mobile
                  ? <button className="btn btn-primary" onClick={() => book(p)} aria-label={`Jadwalkan ${p.patient_name ?? 'pasien'} ${fmtDate(date)}`}>Jadwalkan</button>
                  : <button className="btn btn-xs btn-primary" onClick={() => book(p)}>Jadwalkan {fmtDate(date)}</button>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
