import { useCallback, useEffect, useState, type FormEvent, useRef } from 'react'
import { DateField } from '../../shared/ui/DateField'
import { ApiError, errorText } from '../../shared/api/http'
import { fmtDate, fmtTime, todayWib } from '../../shared/format'
import type { Me } from '../../shared/session'
import { Icon, ICONS } from '../../shared/ui/Icon'
import { useDialog } from '../../shared/ui/Sheet'
import { useIsMobile } from '../../shared/useIsMobile'
import { PatientPicker } from '../patients'
import './scheduling.css'
import { createAppointment, getPlanned, getSchedule, schedulePlanned, STATUS, transition, type Appointment, type Planned, type Schedule as Sched } from './api'
import { Agenda, ApptSheet, DaySummary, ModeToggle, PayPrompt, RescheduleSheet, Toast, useInvoiceStatus, useJadwalMode, type Act } from './MobileJadwal'
import { addDays, dotTime, END, hhmm, minutesOfDay, ROW, SLOTS, START, StatusChip, STEP } from './parts'

export { minutesOfDay, StatusChip } from './parts'

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

/** Monday of the week containing ymd. */
const weekStart = (ymd: string) => addDays(ymd, -((new Date(ymd + 'T00:00:00Z').getUTCDay() + 6) % 7))
const dayFmt = (opts: Intl.DateTimeFormatOptions) => (ymd: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', ...opts }).format(new Date(ymd + 'T00:00:00Z'))
const wdShort = dayFmt({ weekday: 'short' }), dayNum = dayFmt({ day: 'numeric' })
const apptCount = (s: Sched) => s.chairs.reduce((n, c) => n + c.appointments.length, 0)

/** Appointments per day for the 7 days from `from` (mobile week strip dots). */
function useWeekCounts(branchId: string | null, from: string, on: boolean) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!on || !branchId) return
    let live = true
    setCounts(null)
    setError(false)
    // shortcut: 7 calls to the one-day /api/schedule (no backend change); add a ranged count endpoint if this shows up in load.
    Promise.all(Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => getSchedule(branchId, d).then((s) => [d, apptCount(s)] as const)))
      .then((r) => { if (live) setCounts(Object.fromEntries(r)) }, () => { if (live) setError(true) })
    return () => { live = false }
  }, [branchId, from, on, tick])
  return { counts, error, retry: () => setTick((t) => t + 1) }
}

/** Mobile: Mon–Sun of the selected date's week; tap a day to select it. Dots = appointments that day (max 3). */
function WeekStrip({ date, counts, error, onPick, onRetry }: {
  date: string; counts: Record<string, number> | null; error: boolean; onPick: (d: string) => void; onRetry: () => void
}) {
  const from = weekStart(date), today = todayWib()
  return (
    <>
      <div className="week-strip" role="group" aria-label="Pilih hari" aria-busy={!counts && !error}>
        {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => {
          const n = counts?.[d]
          return (
            <button key={d} type="button" aria-pressed={d === date} aria-current={d === today ? 'date' : undefined}
              aria-label={`${fmtDate(d)}${n === undefined ? '' : `, ${n} janji`}`} onClick={() => onPick(d)}>
              <span className="week-wd">{wdShort(d)}</span>
              <span className="week-day">{dayNum(d)}</span>
              <span className="week-dots" aria-hidden="true">{Array.from({ length: Math.min(n ?? 0, 3) }, (_, k) => <i key={k} />)}</span>
            </button>
          )
        })}
      </div>
      {error && <p className="week-error small" role="alert">Jumlah janji per hari gagal dimuat. <button type="button" className="btn btn-ghost" onClick={onRetry}>Coba lagi</button></p>}
    </>
  )
}

/**
 * Online bookings waiting for confirmation today in the active branch (phone nav badge). Re-read when Jadwal changes something
 * ('jadwal:changed'). A failed read shows no badge rather than a wrong number.
 */
export function usePendingConfirm(branchId: string | null, on: boolean) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!on || !branchId) return setN(0)
    let live = true
    const load = () => getSchedule(branchId, todayWib()).then((s) => {
      if (live) setN(s.chairs.reduce((k, c) => k + c.appointments.filter((a) => a.status === 'pending_confirmation' && a.source === 'online').length, 0))
    }, () => { if (live) setN(0) })
    load()
    addEventListener('jadwal:changed', load)
    return () => { live = false; removeEventListener('jadwal:changed', load) }
  }, [branchId, on])
  return n
}
const changed = () => dispatchEvent(new Event('jadwal:changed'))

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
  // Same checks the API enforces; actions an impersonation session blocks are hidden too (never shown disabled).
  const blocked = me.impersonation?.blocked_actions ?? []
  const can = (p: string) => me.permissions.includes(p) && !blocked.includes(p)
  const canCreate = can('appointment.create')
  const canMove = can('appointment.transition')
  const canConfirm = can('appointment.confirm')
  const canChart = can('note.read')
  const canVisit = can('note.write') // opening from the card starts/reuses the visit
  const canBill = can('billing.read')
  const tz = data?.branch.timezone ?? 'Asia/Jakarta'
  const mobile = useIsMobile()
  const [chairPick, setChairPick] = useState<string | null>(null) // null = Semua (agenda) / auto chair (grid)
  const [view, setView] = useState<'agenda' | 'grid'>('agenda') // mobile only; in memory, resets on reload
  const [sheetId, setSheetId] = useState<string | null>(null) // mobile: tapped card -> action sheet
  const isToday = date === todayWib()
  const now = useNow(mobile && isToday)
  const shift = (days: number) => setDate(addDays(date, days))
  const week = useWeekCounts(me.active.branch_id, weekStart(date), mobile)
  const { mode, setMode, multi, owner } = useJadwalMode(me)
  const [toast, setToast] = useState<{ id: number; text: string; undo?: () => void } | null>(null)
  const say = (text: string, undo?: () => void) => setToast({ id: Date.now(), text, undo })
  const [payFor, setPayFor] = useState<string | null>(null) // appointment just finished -> "Lanjut ke Bayar?"
  const [reschedId, setReschedId] = useState<string | null>(null)

  async function move(a: Appointment, to: string) {
    setActionError('')
    try {
      await transition(a.id, to)
      await reload()
      changed()
      return true
    } catch (e) {
      // 409 invoice_required: done also closes the visit; completed work without an invoice line blocks it (unit 4)
      setActionError(e instanceof ApiError && e.status === 409 && e.data?.message ? e.data.message
        : e instanceof ApiError && e.status === 422 ? 'Status janji tidak bisa diubah.' : errorText(e))
      return false
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
  const all = (data?.chairs.flatMap((c) => c.appointments) ?? []).sort((x, y) => x.starts_at.localeCompare(y.starts_at))
  const sheetAppt = sheetId ? all.find((a) => a.id === sheetId) : undefined
  const inv = useInvoiceStatus(all, mobile && canBill)

  // ---- Phone actions: one primary per card (by mode + status), the full list in the sheet ----
  const chartHref = (a: Appointment) => `#/rekam-medis/${a.patient!.id}${canVisit ? `/janji/${a.id}` : ''}`
  const online = (a: Appointment) => a.status === 'pending_confirmation' && a.source === 'online'
  async function confirm(a: Appointment) {
    if (await move(a, 'booked')) say('Dikonfirmasi', () => { move(a, 'pending_confirmation') }) // booked -> pending is a real API move
  }
  async function startVisit(a: Appointment) {
    if (!(await move(a, 'in_treatment'))) return
    if (multi && mode !== 'dokter') { setMode('dokter'); say('Mode Dokter') }
  }
  async function finish(a: Appointment) {
    if ((await move(a, 'done')) && canBill) setPayFor(a.id)
  }
  const A = {
    confirm: (a: Appointment): Act => ({ key: 'confirm', label: 'Konfirmasi', run: () => confirm(a), tone: 'primary' }),
    reject: (a: Appointment): Act => ({ key: 'reject', label: 'Tolak', run: () => move(a, 'rejected') }),
    checkin: (a: Appointment): Act => ({ key: 'checkin', label: 'Check-in', run: () => move(a, 'checked_in'), tone: 'primary' }),
    start: (a: Appointment): Act => ({ key: 'start', label: 'Mulai kunjungan', run: () => startVisit(a), tone: 'primary' }),
    finish: (a: Appointment): Act => ({ key: 'finish', label: 'Selesai', run: () => finish(a) }),
    pay: (a: Appointment): Act => ({ key: 'pay', label: 'Bayar', href: `#/tagihan/${a.visit_id}`, tone: 'primary' }),
    chart: (a: Appointment): Act => ({ key: 'chart', label: 'Buka RM', href: chartHref(a) }),
  }
  const may = {
    confirm: (a: Appointment) => online(a) && canMove && canConfirm,
    checkin: (a: Appointment) => a.status === 'booked' && isToday && canMove,
    start: (a: Appointment) => a.status === 'checked_in' && canMove && canVisit,
    finish: (a: Appointment) => a.status === 'in_treatment' && canMove,
    pay: (a: Appointment) => a.status === 'done' && canBill && inv.unpaid(a),
    chart: (a: Appointment) => canChart && !!a.patient && !['cancelled', 'no_show', 'rejected', 'pending_confirmation'].includes(a.status),
  }
  const primary = (a: Appointment): Act | null => mode === 'dokter'
    ? may.start(a) ? A.start(a) : a.status === 'in_treatment' && may.chart(a) ? A.chart(a) : null
    : may.confirm(a) ? A.confirm(a) : may.checkin(a) ? A.checkin(a) : may.pay(a) ? A.pay(a) : null
  const sheetActs = (a: Appointment): Act[] => ([
    mode === 'depan' && may.confirm(a) && A.confirm(a),
    mode === 'depan' && may.confirm(a) && A.reject(a),
    mode === 'depan' && may.checkin(a) && A.checkin(a),
    mode === 'depan' && may.pay(a) && A.pay(a),
    may.start(a) && A.start(a),
    may.finish(a) && A.finish(a),
    may.chart(a) && A.chart(a),
    mode === 'depan' && a.status === 'booked' && canCreate && { key: 'reschedule', label: 'Ubah jadwal' },
    mode === 'depan' && a.status === 'booked' && canMove && date <= todayWib() && { key: 'noshow', label: 'Tidak datang', run: () => move(a, 'no_show') },
    mode === 'depan' && ((a.status === 'booked' && canMove) || (a.status === 'pending_confirmation' && canMove && canConfirm)) &&
      { key: 'cancel', label: 'Batalkan', run: () => move(a, 'cancelled'), tone: 'danger' },
  ] as (Act | false)[]).filter((x): x is Act => !!x)
  // Dokter: "Hari berikutnya" from the empty state = the nearest later date with one of my appointments (up to 30 days).
  const [seek, setSeek] = useState<'idle' | 'busy' | 'none'>('idle')
  async function nextOwnDay() {
    setSeek('busy')
    try {
      for (let i = 1; i <= 30; i++) {
        const d = addDays(date, i)
        const s = await getSchedule(me.active.branch_id!, d)
        if (s.chairs.some((c) => c.appointments.some((a) => a.dentist?.id === me.user.id && !['cancelled', 'rejected', 'no_show'].includes(a.status))))
          return (setSeek('idle'), setDate(d))
      }
      setSeek('none')
    } catch {
      setSeek('idle')
      setActionError('Gagal memuat.')
    }
  }
  useEffect(() => setSeek('idle'), [date, mode])

  const count = data ? apptCount(data) : 0
  // The selected day's dot follows the live day data (after a booking or a status change), not the week fetch.
  const weekCounts = week.counts && data && data.date === date ? { ...week.counts, [date]: count } : week.counts
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
  const dokter = mode === 'dokter'
  const agendaList = dokter ? all.filter((a) => a.dentist?.id === me.user.id) : all.filter((a) => !chairPick || a.chair_id === chairPick)
  const gridOn = mobile && !dokter && view === 'grid'
  const nowMin = mobile && isToday ? minutesOfDay(new Date(now).toISOString(), tz) - START : -1
  const nowTop = nowMin >= 0 && nowMin <= END - START ? (nowMin / STEP) * ROW : null

  // Phone grid on today: open with the now-line at ~35% of the screen; a "Sekarang" chip brings it back once scrolled away.
  const gridNow = gridOn && nowTop !== null && !!data && data.date === date
  const nowRef = useRef<HTMLDivElement>(null)
  const [nowSeen, setNowSeen] = useState(true)
  const toNow = (smooth: boolean) => {
    const el = nowRef.current
    if (!el) return
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.35, behavior: smooth && !still ? 'smooth' : 'auto' })
  }
  useEffect(() => {
    const el = nowRef.current
    if (!gridNow || !el) return
    toNow(false)
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setNowSeen(e.isIntersecting))
    io.observe(el)
    return () => { io.disconnect(); setNowSeen(true) }
  }, [gridNow, shownChair?.id])

  if (!me.active.branch_id) return <div className="card state-card">Belum ada cabang aktif.</div>

  const prev = <button className="btn" onClick={() => shift(-1)} aria-label="Hari sebelumnya">‹</button>
  const next = <button className="btn" onClick={() => shift(1)} aria-label="Hari berikutnya">›</button>
  const today = <button className={mobile ? 'btn sched-today' : 'btn'} onClick={() => setDate(todayWib())}>Hari ini</button>
  const dateInput = <DateField aria-label="Tanggal" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
  const create = canCreate && <button className="btn btn-primary" onClick={() => setDialog({})}>+ Buat Janji</button>

  return (
    <>
      {mobile ? (
        // Phone: one compact row (date picker · count · Hari ini when elsewhere · week arrows) + the week strip, pinned under the top bar.
        <>
        <div className="sched-title">
          <h1>{dokter ? 'Pasien saya' : 'Jadwal'}</h1>
          {multi && <ModeToggle mode={mode} onChange={setMode} />}
          {!dokter && (
            <button type="button" className="btn sched-grid-btn" aria-pressed={view === 'grid'} aria-label="Tampilan grid"
              onClick={() => setView(view === 'grid' ? 'agenda' : 'grid')}><Icon d={ICONS.grid} /></button>
          )}
        </div>
        <div className="sched-top">
          <div className="sched-bar">
            {dateInput}
            <span className="muted small sched-count">{count} janji</span>
            {!isToday && today}
            <button className="btn" onClick={() => shift(-7)} aria-label="Minggu sebelumnya"><Icon d={ICONS.left} /></button>
            <button className="btn" onClick={() => shift(7)} aria-label="Minggu berikutnya"><Icon d={ICONS.right} /></button>
          </div>
          <WeekStrip date={date} counts={weekCounts} error={week.error} onPick={setDate} onRetry={week.retry} />
        </div>
        {owner && !dokter && data && data.date === date && <DaySummary list={all} isToday={isToday} canBill={canBill} />}
        </>
      ) : (
        <div className="page-head">
          <div>
            <h1 className="shell-dup-title">Jadwal</h1>
            <p className="muted">{fmtDate(date)} · {me.active.branch_name} · {count} janji</p>
          </div>
          <div className="toolbar">{prev}{today}{next}{dateInput}{create}</div>
        </div>
      )}
      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      {!mobile && canConfirm && pending.length > 0 && (
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
      {error ? (mobile
          ? <div className="card state-card error" role="alert">Gagal memuat. <button className="btn" onClick={reload}>Coba lagi</button></div>
          : <div className="card state-card error">{error} <button className="btn" onClick={reload}>Coba lagi</button></div>)
        : !data || (mobile && loading && data.date !== date) ? <div className="card state-card muted" role="status">Memuat jadwal…</div>
        : data.chairs.length === 0 ? <div className="card state-card muted">Cabang ini belum punya kursi aktif.</div> : (
          <>
          {mobile && !dokter && data.chairs.length > 1 && (
            // Agenda: "Semua" + one pill per chair. Grid shows one chair column, so it has no "Semua" (see chairPick).
            <div className="chair-pills" role="group" aria-label="Pilih kursi">
              {!gridOn && <button type="button" aria-pressed={!chairPick} onClick={() => setChairPick(null)}>Semua <span className="muted small">· {count}</span></button>}
              {data.chairs.map((c) => (
                <button key={c.id} type="button" aria-pressed={gridOn ? c === shownChair : c.id === chairPick} onClick={() => setChairPick(c.id)}>
                  {c.label} <span className="muted small">· {c.appointments.length}</span>
                </button>
              ))}
            </div>
          )}
          {mobile && inv.error && <p className="week-error small" role="alert">Status bayar gagal dimuat. <button type="button" className="btn btn-ghost" onClick={inv.retry}>Coba lagi</button></p>}
          {mobile && (
            <Agenda mode={mode} list={agendaList} tz={tz} chairs={data.chairs} nowMin={isToday ? minutesOfDay(new Date(now).toISOString(), tz) : null}
              unpaid={inv.unpaid} primary={primary} onOpen={(a) => setSheetId(a.id)} confirmOnly={gridOn}
              empty={dokter ? (
                <div className="sched-empty" role="status">
                  <p>{isToday ? 'Tidak ada pasien hari ini.' : 'Tidak ada pasien.'}</p>
                  {seek === 'none' ? <p className="muted">Tidak ada janji 30 hari ke depan.</p>
                    : <button type="button" className="btn btn-ghost" disabled={seek === 'busy'} onClick={nextOwnDay}>{seek === 'busy' ? 'Mencari…' : 'Hari berikutnya'}</button>}
                </div>
              ) : (
                <p className="sched-empty" role="status">
                  {chairPick ? `${data.chairs.find((c) => c.id === chairPick)?.label ?? 'Kursi'} kosong${isToday ? ' hari ini' : ''}.` : 'Belum ada janji.'}
                </p>
              )} />
          )}
          {gridOn && count === 0 && <p className="sched-empty" role="status">Belum ada janji.</p>}
          {mobile && !gridOn ? null : (
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
                  {nowTop !== null && <div ref={nowRef} className="sched-now" style={{ top: nowTop }} aria-label={`Sekarang ${hhmm(nowMin + START)}`} role="img" />}
                  {SLOTS.map((m) => mobile && canCreate ? (
                    // Phone: each empty half hour is a real button (44px+, labelled, visible "+") that opens Buat Janji there.
                    <button key={m} type="button" className={'sched-slot clickable' + (m % 60 === 0 ? ' hour' : '')} style={{ height: ROW }}
                      aria-label={`Buat janji ${dotTime(m)}, ${c.label}`} onClick={() => setDialog({ chairId: c.id, minute: m })} />
                  ) : (
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
          )}
          </>
        )}
      {mobile && sheetAppt && data && (
        <ApptSheet a={sheetAppt} tz={tz} chair={data.chairs.find((c) => c.id === sheetAppt.chair_id)?.label} acts={sheetActs(sheetAppt)}
          onClose={() => setSheetId(null)} onReschedule={() => { setSheetId(null); setReschedId(sheetAppt.id) }} />
      )}
      {mobile && reschedId && data && all.find((a) => a.id === reschedId) && (
        <RescheduleSheet a={all.find((a) => a.id === reschedId)!} tz={tz} date={date} chairs={data.chairs}
          onClose={() => setReschedId(null)} onSaved={() => { setReschedId(null); reload(); changed(); say('Jadwal diubah') }} />
      )}
      {mobile && payFor && all.find((a) => a.id === payFor)?.visit_id && (
        <PayPrompt onLater={() => setPayFor(null)} onPay={() => {
          const vid = all.find((a) => a.id === payFor)!.visit_id
          setPayFor(null)
          if (multi) setMode('depan')
          location.hash = `#/tagihan/${vid}`
        }} />
      )}
      {mobile && toast && <Toast key={toast.id} text={toast.text} undo={toast.undo} onDone={() => setToast(null)} />}
      {gridNow && !nowSeen && <button type="button" className="now-chip" onClick={() => toNow(true)}>Sekarang {dotTime(nowMin + START)}</button>}
      {mobile && canCreate && <button type="button" className="fab" aria-label="Buat janji" onClick={() => setDialog({})}><Icon d={ICONS.plus} size={26} /></button>}
      {data && <PlannedList sched={data} date={date} canCreate={canCreate} onScheduled={reload} />}
      {dialog && data && (
        <BookDialog sched={data} date={date} me={me} initial={dialog} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); reload(); changed() }} />
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

  // Phone: bottom sheet (styles.css) with modal focus/Escape/scroll lock; desktop behaviour unchanged.
  const dlg = useRef<HTMLFormElement>(null)
  useDialog(dlg, onClose, useIsMobile())
  return (
    <div className="overlay" onClick={onClose}>
      <form ref={dlg} className="card dialog" role="dialog" aria-modal="true" aria-labelledby="book-title" onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
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
