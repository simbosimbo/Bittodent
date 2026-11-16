import { useCallback, useEffect, useState, type FormEvent, type MouseEvent, type PointerEvent, useRef } from 'react'
import { SectionTitle } from '../../shared/ui/SectionTitle'
import { FilterChips } from '../../shared/ui/FilterChips'
import { Select } from '../../shared/ui/Select'
import { StateCard } from '../../shared/ui/StateCard'
import { Button, buttonVariants, Card, Chip, ToggleButton } from '@heroui/react'
import { DateField } from '../../shared/ui/DateField'
import { ApiError, errorText } from '../../shared/api/http'
import { fmtDate, fmtTime, todayWib } from '../../shared/format'
import type { Me } from '../../shared/session'
import { Icon, ICONS } from '../../shared/ui/Icon'
import { useDialog } from '../../shared/ui/Sheet'
import { Presence, usePresenceClass } from '../../shared/ui/presence'
import { PageSkeleton } from '../../shared/ui/Skeleton'
import { useIsMobile } from '../../shared/useIsMobile'
import { getPatient, PatientPicker } from '../patients'
import { startWalkInVisit } from '../clinical'
import './scheduling.css'
import { changeChair, createAppointment, getPlanned, refer, getSchedule, schedulePlanned, STATUS, transition, undoCheckin, type Appointment, type Planned, type Schedule as Sched } from './api'
import { Agenda, ApptSheet, ChairSheet, DaySummary, ModeToggle, PayPrompt, ReferSheet, RescheduleSheet, Toast, useInvoiceStatus, useJadwalMode, type Act } from './MobileJadwal'
import { addDays, dotTime, END, hhmm, minutesOfDay, ROW, SLOTS, START, StatusChip, STEP } from './parts'
import { Note } from '../../shared/ui/Note'

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

/**
 * Jadwal is organised by dentist (DEVIATIONS #68): one column / filter chip per dentist of the branch (by name), plus any
 * other dentist who has an appointment that day; the chair is a label on the card. Appointments by start time.
 */
export type DentistCol = { id: string; label: string; appointments: Appointment[] }
export function dentistColumns(s: Sched): DentistCol[] {
  const all = s.chairs.flatMap((c) => c.appointments).sort((x, y) => x.starts_at.localeCompare(y.starts_at))
  const cols = new Map<string, DentistCol>(s.dentists.map((d) => [d.id, { id: d.id, label: d.name, appointments: [] }]))
  for (const a of all) {
    const id = a.dentist?.id ?? ''
    if (!cols.has(id)) cols.set(id, { id, label: a.dentist?.name ?? 'Tanpa dokter', appointments: [] })
    cols.get(id)!.appointments.push(a)
  }
  return [...cols.values()]
}

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
/** "drg. Clara Wijaya, Sp.KGA" -> "Clara Wijaya": chips show the short name, the full one is the aria-label/tooltip. */
/** Chip label (review-3, board 01): first name only ("Andi", "Bunga"), so chips never truncate; the full name is the aria-label. */
export const shortName = (n: string) => n.replace(/^drg\.\s*/i, '').replace(/,.*$/, '').trim().split(/\s+/)[0]

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
      {error && <p className="week-error small" role="alert">Jumlah janji per hari gagal dimuat. <Button variant="ghost" size="sm" onPress={onRetry}>Coba lagi</Button></p>}
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

export default function Schedule({ me, newFor = null }: { me: Me; newFor?: string | null }) {
  const [date, setDate] = useState(todayWib)
  const { data, error, loading, reload } = useSchedule(me.active.branch_id, date)
  const [dialog, setDialog] = useState<{ dentistId?: string; minute?: number; patientId?: string } | null>(null)
  // "Buat janji" from a patient's RM lands here with ?baru=<patient id>: open the booking form for that patient right away.
  useEffect(() => {
    if (!newFor) return
    setDialog({ patientId: newFor })
    history.replaceState(null, '', '#/jadwal') // a reload or Back does not reopen it
  }, [newFor])
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
  const canArrive = can('visit.register') // "Pasien datang": walk-in without appointment
  const [arriveOpen, setArriveOpen] = useState(false)
  const [notice, setNotice] = useState('')
  // Keluhan asked at check-in: starts as the appointment's reason; the desk only edits it (audit P1-1).
  const [keluhan, setKeluhan] = useState<Record<string, string>>({})
  const complaintOf = (a: Appointment) => (keluhan[a.id] ?? a.reason ?? '').trim()
  const tz = data?.branch.timezone ?? 'Asia/Jakarta'
  const mobile = useIsMobile()
  // dentist filter; null = Semua (agenda) / auto dentist (grid). Desktop (review-2): remembered per branch for this tab session.
  const docKey = `jadwal-dokter:${me.active.branch_id}`
  const [docPick, setDocPickRaw] = useState<string | null>(() => { try { return sessionStorage.getItem(docKey) } catch { return null } })
  const setDocPick = (id: string | null) => { setDocPickRaw(id); try { if (id) sessionStorage.setItem(docKey, id); else sessionStorage.removeItem(docKey) } catch { /* private mode */ } }
  const [weekOpen, setWeekOpen] = useState(false) // phone (review-2): the week strip folds; ‹ › move one day
  const [view, setView] = useState<'agenda' | 'grid'>('agenda') // mobile only; in memory, resets on reload
  const [sheetId, setSheetId] = useState<string | null>(null) // mobile: tapped card -> action sheet
  const isToday = date === todayWib()
  const now = useNow(mobile && isToday)
  const shift = (days: number) => setDate(addDays(date, days))
  const week = useWeekCounts(me.active.branch_id, weekStart(date), mobile)
  const { mode, setMode, multi, owner } = useJadwalMode(me)
  const [toast, setToast] = useState<{ id: number; text: string; undo?: () => void; undoLabel?: string } | null>(null)
  const say = (text: string, undo?: () => void, undoLabel?: string) => setToast({ id: Date.now(), text, undo, undoLabel })
  const [busyId, setBusyId] = useState<string | null>(null) // check-in running: the card's button reads "Memproses"
  const [arrivedId, setArrivedId] = useState<string | null>(null) // just checked in: slides into Menunggu
  const [payFor, setPayFor] = useState<string | null>(null) // appointment just finished -> "Lanjut ke Bayar?"
  const [reschedId, setReschedId] = useState<string | null>(null)
  const [form, setForm] = useState<{ kind: 'chair' | 'refer'; id: string } | null>(null) // Ganti kursi / Rujuk sheet
  const canRefer = can('appointment.refer')
  const ownerRole = me.roles.includes('owner')
  // Front desk (front_desk, kasir) may move any appointment to another dentist, e.g. "Dokter berhalangan" (DEVIATIONS #68).
  const deskRole = me.roles.some((r) => r === 'front_desk' || r === 'kasir')

  async function move(a: Appointment, to: string) {
    setActionError('')
    try {
      await transition(a.id, to, to === 'checked_in' ? complaintOf(a) : undefined)
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
    // Desktop path to payment (#69): a finished visit opens its Tagihan (the page says when there is none).
    canBill && a.status === 'done' && a.visit_id && { label: 'Tagihan', href: `#/tagihan/${a.visit_id}` },
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
  // Check-in feedback (board 08): "Memproses" on the button (no double tap), then the row moves to Menunggu with a "Hadir" chip and
  // a 5 s toast "{nama} hadir" whose Batalkan really undoes it (POST undo-checkin: server-checked window, audited).
  async function checkIn(a: Appointment) {
    if (busyId) return
    setBusyId(a.id)
    const ok = await move(a, 'checked_in')
    setBusyId(null)
    if (!ok) return
    setArrivedId(a.id)
    setTimeout(() => setArrivedId((x) => (x === a.id ? null : x)), 400)
    say(`${a.patient?.name ?? 'Pasien'} hadir`, async () => {
      setActionError('')
      try { await undoCheckin(a.id); await reload(); changed() } catch (e) {
        setActionError(e instanceof ApiError && e.status === 409 ? e.data?.message ?? 'Check-in tidak bisa dibatalkan lagi.' : errorText(e))
      }
    }, 'Batalkan')
  }
  // Mulai kunjungan = one tap (#70): check in first when the patient is still "Terjadwal" today (the server checks the permission
  // and the transition), then merawat, then straight into the RM.
  async function startVisit(a: Appointment) {
    if (a.status === 'booked' && !(await move(a, 'checked_in'))) return
    if (!(await move(a, 'in_treatment'))) return
    if (multi && mode !== 'dokter') setMode('dokter')
    if (canChart && a.patient) location.hash = chartHref(a)
    else if (multi) say('Mode Dokter')
  }
  // Dokter mode: Selesai sends the patient to the payment queue (Kasir / "Belum bayar"); no Bayar prompt for the doctor.
  async function finish(a: Appointment) {
    if (!(await move(a, 'done'))) return
    if (mode === 'dokter') say(canBill || a.visit_id ? 'Selesai · masuk antrean bayar' : 'Selesai')
    else if (canBill) setPayFor(a.id)
  }
  const A = {
    confirm: (a: Appointment): Act => ({ key: 'confirm', label: 'Konfirmasi', run: () => confirm(a), tone: 'primary' }),
    reject: (a: Appointment): Act => ({ key: 'reject', label: 'Tolak', run: () => move(a, 'rejected') }),
    checkin: (a: Appointment): Act => ({ key: 'checkin', label: 'Check-in', run: () => checkIn(a), tone: 'primary' }),
    start: (a: Appointment): Act => ({ key: 'start', label: 'Mulai kunjungan', run: () => startVisit(a), tone: 'primary' }),
    finish: (a: Appointment): Act => ({ key: 'finish', label: 'Selesai', run: () => finish(a) }),
    pay: (a: Appointment): Act => ({ key: 'pay', label: 'Bayar', href: `#/tagihan/${a.visit_id}`, tone: 'primary' }),
    chart: (a: Appointment): Act => ({ key: 'chart', label: 'Buka RM', href: chartHref(a) }),
  }
  const may = {
    confirm: (a: Appointment) => online(a) && canMove && canConfirm,
    checkin: (a: Appointment) => a.status === 'booked' && isToday && canMove,
    start: (a: Appointment) => (a.status === 'checked_in' || (mode === 'dokter' && a.status === 'booked' && isToday)) && canMove && canVisit,
    finish: (a: Appointment) => a.status === 'in_treatment' && canMove,
    pay: (a: Appointment) => a.status === 'done' && canBill && inv.unpaid(a),
    chart: (a: Appointment) => canChart && !!a.patient && !['cancelled', 'no_show', 'rejected', 'pending_confirmation'].includes(a.status),
  }
  const primary = (a: Appointment): Act | null => mode === 'dokter'
    ? may.start(a) ? A.start(a) : may.chart(a) ? A.chart(a) : null // Dokter: every own card has one primary
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
    canMove && ['pending_confirmation', 'booked', 'checked_in', 'in_treatment'].includes(a.status) && (data?.chairs.length ?? 0) > 1 &&
      { key: 'chair', label: 'Ganti kursi' },
    canRefer && (ownerRole || deskRole || a.dentist?.id === me.user.id) && ['pending_confirmation', 'booked', 'checked_in'].includes(a.status) &&
      (data?.dentists.some((d) => d.id !== a.dentist?.id) ?? false) && { key: 'refer', label: 'Rujuk ke dokter lain' },
    mode === 'depan' && a.status === 'booked' && canMove && date <= todayWib() && { key: 'noshow', label: 'No-show', run: () => move(a, 'no_show') },
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

  // Columns = dentists (DEVIATIONS #68). Mobile grid: one dentist column at a time; default = dentist of the next unfinished
  // appointment, else the first dentist.
  const cols = data ? dentistColumns(data) : []
  const nextDoc = () => {
    const next = all.filter((a) => new Date(a.ends_at).getTime() > now && !['cancelled', 'no_show', 'rejected', 'done'].includes(a.status))[0]
    return next?.dentist?.id ?? cols[0]?.id
  }
  // Desktop (#70): all dentist columns, or only the one picked in the chip row.
  const shownCol = mobile ? (cols.find((c) => c.id === docPick) ?? cols.find((c) => c.id === nextDoc())) : cols.find((c) => c.id === docPick)
  // Desktop "Semua" hides dentists without appointments (review-2); a picked dentist always shows, even when empty.
  const busyCols = cols.filter((c) => c.appointments.length > 0)
  const chairs = shownCol ? [shownCol] : !mobile && busyCols.length > 0 ? busyCols : cols
  const isNotOwn = (id: string) => all.find((x) => x.id === id)?.dentist?.id !== me.user.id
  const chairLabel = (a: Appointment) => data?.chairs.find((c) => c.id === a.chair_id)?.label
  const dokter = mode === 'dokter'
  const agendaList = dokter ? all.filter((a) => a.dentist?.id === me.user.id) : all.filter((a) => !docPick || a.dentist?.id === docPick)
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
  }, [gridNow, shownCol?.id])

  // Phone: a horizontal swipe on the day's content = next/previous day (arrows, week strip and Hari ini do the same).
  // touch-action: pan-y (CSS) leaves vertical scrolling to the browser; it cancels the pointer (pointercancel) when it scrolls.
  const drag = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  const swipe = {
    onPointerDown: (e: PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY }; swiped.current = false },
    onPointerCancel: () => { drag.current = null },
    onPointerUp: (e: PointerEvent) => {
      const d = drag.current
      drag.current = null
      if (!d) return
      const dx = e.clientX - d.x, dy = e.clientY - d.y
      if (Math.abs(dx) < 60 || Math.abs(dx) < 1.5 * Math.abs(dy)) return
      if ((e.target as Element).closest?.('.chair-pills')) return // the chip row scrolls sideways itself
      swiped.current = true
      shift(dx < 0 ? 1 : -1)
    },
    // the click that ends a swipe must not also open a card or a slot
    onClickCapture: (e: MouseEvent) => { if (swiped.current) { swiped.current = false; e.preventDefault(); e.stopPropagation() } },
  }

  if (!me.active.branch_id) return <StateCard>Belum ada cabang aktif.</StateCard>

  const prev = <Button variant="outline" isIconOnly onPress={() => shift(-1)} aria-label="Hari sebelumnya">‹</Button>
  const next = <Button variant="outline" isIconOnly onPress={() => shift(1)} aria-label="Hari berikutnya">›</Button>
  const today = <Button variant="outline" className={mobile ? 'sched-today' : undefined} onPress={() => setDate(todayWib())}>Hari ini</Button>
  const dateInput = <DateField aria-label="Tanggal" className="sched-date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
  const create = canCreate && <Button variant="primary" onPress={() => setDialog({})}>+ Buat Janji</Button>
  const arrive = canArrive && isToday && <Button variant="outline" onPress={() => { setNotice(''); setArriveOpen(true) }}>Pasien datang</Button>

  const dayBody = (
      error ? (mobile
          ? <div className="sched-empty" role="alert"><Icon d={ICONS.cloudOff} size={40} /><p>Gagal memuat.</p>
              <Button variant="outline" className="sched-empty-btn" onPress={reload}><Icon d={ICONS.refresh} size={18} />Coba lagi</Button></div>
          : <StateCard error={error} onRetry={reload} />)
        : !data || (mobile && loading && data.date !== date) ? <PageSkeleton variant="schedule" label="Memuat jadwal…" />
        : data.chairs.length === 0 ? <StateCard>Cabang ini belum punya kursi aktif.</StateCard> : (
          <>
          {mobile && !dokter && cols.length > 1 && (
            // Agenda: "Semua" + one pill per dentist. Grid shows one dentist column, so it has no "Semua" (see docPick).
            <FilterChips label="Pilih dokter" className="chair-pills" value={(gridOn ? shownCol?.id : docPick) ?? ''} onChange={(k) => setDocPick(k || null)}
              options={[...(gridOn ? [] : [['', <>Semua <span className="muted small">· {count}</span></>] as const]),
                ...cols.map((c) => [c.id, <>{shortName(c.label)} <span className="muted small">· {c.appointments.length}</span></>, `${c.label} · ${c.appointments.length}`] as const)]} />
          )}
          {mobile && inv.error && <p className="week-error small" role="alert">Status bayar gagal dimuat. <Button variant="ghost" size="sm" onPress={inv.retry}>Coba lagi</Button></p>}
          {mobile && (
            <Agenda mode={mode} list={agendaList} tz={tz} chairs={data.chairs} nowMin={isToday ? minutesOfDay(new Date(now).toISOString(), tz) : null}
              unpaid={inv.unpaid} primary={primary} onOpen={(a) => setSheetId(a.id)} confirmOnly={gridOn} busyId={busyId} arrivedId={arrivedId}
              empty={dokter ? (
                <div className="sched-empty" role="status">
                  <Icon d={ICONS.people} size={40} />
                  <p>{isToday ? 'Tidak ada pasien hari ini.' : 'Tidak ada pasien.'}</p>
                  {seek === 'none' ? <p className="muted">Tidak ada janji 30 hari ke depan.</p>
                    : <Button variant="outline" className="sched-empty-btn" isDisabled={seek === 'busy'} onPress={nextOwnDay}><Icon d={ICONS.arrowRight} size={18} />{seek === 'busy' ? 'Mencari…' : 'Hari berikutnya'}</Button>}
                </div>
              ) : (
                <div className="sched-empty" role="status">
                  <Icon d={docPick ? ICONS.people : ICONS.inbox} size={40} />
                  <p>{docPick ? `${cols.find((c) => c.id === docPick)?.label ?? 'Dokter'}: belum ada janji${isToday ? ' hari ini' : ''}.` : 'Belum ada janji.'}</p>
                </div>
              )} />
          )}
          {gridOn && count === 0 && <div className="sched-empty sched-empty-sm" role="status"><p>Belum ada janji.</p></div>}
          {mobile && !gridOn ? null : (
          <Card className={'schedule' + (loading ? ' is-loading' : '')}>
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
                      aria-label={`Buat janji ${dotTime(m)}, ${c.label}`} onClick={() => setDialog({ dentistId: c.id, minute: m })} />
                  ) : (
                    <div key={m} className={'sched-slot' + (m % 60 === 0 ? ' hour' : '') + (canCreate ? ' clickable' : '')} style={{ height: ROW }}
                      onClick={canCreate ? () => setDialog({ dentistId: c.id, minute: m }) : undefined} />
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
                          {a.source === 'online' && <Chip size="sm" className="sched-chip chip-online">Online</Chip>}
                          <StatusChip status={a.status} />
                        </span>
                        <span className="appt-name">{a.patient?.name}{chairLabel(a) && <span className="appt-chair">{chairLabel(a)}</span>}</span>
                      </button>
                    )
                    return (
                      <div key={a.id} className={`appt appt-${a.status}`} style={box}>
                        <div className="appt-top">
                          <span className="appt-time">{fmtTime(a.starts_at, tz)}–{fmtTime(a.ends_at, tz)}</span>
                          {a.source === 'online' && <Chip size="sm" className="sched-chip chip-online">Online</Chip>}
                          {a.status === 'pending_confirmation' ? <span className="sr-only">{STATUS.pending_confirmation}</span> : <StatusChip status={a.status} />}
                        </div>
                        <div className="appt-name">{a.patient?.name}{chairLabel(a) && <span className="appt-chair">{chairLabel(a)}</span>}</div>
                        <div className="appt-bottom">
                          {canMove && a.status === 'booked' && isToday
                            ? <input className="appt-keluhan" aria-label={`Keluhan ${a.patient?.name ?? ''}`} placeholder="Keluhan" maxLength={500}
                                value={keluhan[a.id] ?? a.reason ?? ''} onChange={(e) => setKeluhan({ ...keluhan, [a.id]: e.target.value })} />
                            : <span className="appt-meta">{a.reason ?? a.dentist?.name}</span>}
                          {actions(a).filter((x) => !x.sheetOnly).map((x) => x.href
                            ? <a key={x.label} className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' appt-act'} href={x.href}>{x.label}</a>
                            : <Button key={x.label} variant="outline" size="sm" className="appt-act" onPress={x.run}>{x.label}</Button>)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </Card>
          )}
          </>
        )
  )

  return (
    <>
      {mobile ? (
        // Phone: one compact row (date picker · count · Hari ini when elsewhere · week arrows) + the week strip, pinned under the top bar.
        <>
        <div className="sched-mhead">
          <div className="sched-title">
            <h1>{dokter ? 'Pasien saya' : 'Jadwal'}</h1>
            {!dokter && (
              <div className="view-seg" role="group" aria-label="Tampilan">
                <ToggleButton isIconOnly variant="ghost" isSelected={view === 'agenda'} aria-label="Tampilan agenda" onChange={() => setView('agenda')}><Icon d={ICONS.agenda} /></ToggleButton>
                <ToggleButton isIconOnly variant="ghost" isSelected={view === 'grid'} aria-label="Tampilan grid" onChange={() => setView('grid')}><Icon d={ICONS.grid2} /></ToggleButton>
              </div>
            )}
          </div>
          {multi && <ModeToggle mode={mode} onChange={setMode} />}
        </div>
        <div className="sched-top">
          <div className="sched-bar">
            {dateInput}
            <span className="muted sched-count">{count} janji</span>
            <Button isIconOnly variant="outline" onPress={() => shift(weekOpen ? -7 : -1)} aria-label={weekOpen ? 'Minggu sebelumnya' : 'Tanggal sebelumnya'}><Icon d={ICONS.left} size={20} /></Button>
            <Button isIconOnly variant="outline" onPress={() => shift(weekOpen ? 7 : 1)} aria-label={weekOpen ? 'Minggu berikutnya' : 'Tanggal berikutnya'}><Icon d={ICONS.right} size={20} /></Button>
            <Button isIconOnly variant={weekOpen ? 'secondary' : 'outline'} className="week-toggle" aria-expanded={weekOpen} aria-label="Pilih hari minggu ini" onPress={() => setWeekOpen(!weekOpen)}><Icon d={ICONS.calendar} size={20} /></Button>
            {!isToday && today}
            {!dokter && arrive}
          </div>
          {weekOpen && <WeekStrip date={date} counts={weekCounts} error={week.error} onPick={setDate} onRetry={week.retry} />}
        </div>
        {owner && !dokter && data && data.date === date && <DaySummary list={all} isToday={isToday} canBill={canBill} />}
        </>
      ) : (
        <div className="page-head">
          <div>
            <h1 className="shell-dup-title">Jadwal</h1>
            <p className="muted">{fmtDate(date)} · {me.active.branch_name} · {count} janji</p>
          </div>
          <div className="sched-toolbar">{prev}{today}{next}{dateInput}{arrive}{create}</div>
          {cols.length > 1 && (
            <FilterChips label="Pilih dokter" className="doc-seg" value={shownCol?.id ?? ''} onChange={(k) => setDocPick(k || null)}
              options={[['', `Semua · ${count}`], ...cols.map((c) => [c.id, `${shortName(c.label)} · ${c.appointments.length}`, `${c.label} · ${c.appointments.length}`] as const)]} />
          )}
        </div>
      )}
      {actionError && <Note status="danger" role="alert">{actionError}</Note>}
      {notice && <Note status="success" role="status">{notice}</Note>}
      {!mobile && canConfirm && pending.length > 0 && (
        <Card className="confirm-card">
          <SectionTitle count={pending.length}>Perlu konfirmasi</SectionTitle>
          <ul className="confirm-list">
            {pending.map((a) => (
              <li key={a.id} className="confirm-row">
                <span className="appt-time">{fmtTime(a.starts_at, tz)}–{fmtTime(a.ends_at, tz)}</span>
                <Chip size="sm" className="sched-chip chip-online">Online</Chip>
                <div className="grow">
                  <strong>{a.patient?.name}</strong>
                  <div className="muted small">{[a.dentist?.name, a.reason].filter(Boolean).join(' · ')}</div>
                </div>
                <Button variant="primary" onPress={() => move(a, 'booked')} aria-label={`Konfirmasi ${a.patient?.name ?? ''}`}>Konfirmasi</Button>
                <Button variant="outline" onPress={() => move(a, 'rejected')} aria-label={`Tolak ${a.patient?.name ?? ''}`}>Tolak</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {mobile ? <div className="sched-swipe" {...swipe}>{dayBody}</div> : dayBody}
      {mobile && data && (
        <Presence open={!!sheetAppt} exitMs={200}>
          {sheetAppt && <ApptSheet a={sheetAppt} tz={tz} chair={data.chairs.find((c) => c.id === sheetAppt.chair_id)?.label} acts={sheetActs(sheetAppt)}
            onClose={() => setSheetId(null)} onReschedule={() => { setSheetId(null); setReschedId(sheetAppt.id) }}
            onForm={(kind) => { setSheetId(null); setForm({ kind, id: sheetAppt.id }) }}>
            {mode === 'depan' && may.checkin(sheetAppt) && (
              <label>Keluhan<input value={keluhan[sheetAppt.id] ?? sheetAppt.reason ?? ''} maxLength={500} placeholder="mis. Gigi ngilu"
                onChange={(e) => setKeluhan({ ...keluhan, [sheetAppt.id]: e.target.value })} /></label>
            )}
          </ApptSheet>}
        </Presence>
      )}
      {mobile && data && (
        <Presence open={!!(reschedId && all.find((a) => a.id === reschedId))} exitMs={200}>
          {reschedId && all.find((a) => a.id === reschedId) && (
            <RescheduleSheet a={all.find((a) => a.id === reschedId)!} tz={tz} date={date} chairs={data.chairs}
              onClose={() => setReschedId(null)} onSaved={() => { setReschedId(null); reload(); changed(); say('Jadwal diubah') }} />
          )}
        </Presence>
      )}
      {mobile && data && (
        <Presence open={!!(form && all.find((a) => a.id === form.id))} exitMs={200}>
          {form && all.find((a) => a.id === form.id) && (form.kind === 'chair'
            ? <ChairSheet a={all.find((a) => a.id === form.id)!} chairs={data.chairs} save={changeChair}
                onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); changed(); say('Kursi diganti') }} />
            : <ReferSheet a={all.find((a) => a.id === form.id)!} dentists={data.dentists} save={refer} unavailable={deskRole && isNotOwn(form.id)}
                onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); changed(); say('Janji dirujuk') }} />)}
        </Presence>
      )}
      {mobile && (
        <Presence open={!!(payFor && all.find((a) => a.id === payFor)?.visit_id)} exitMs={200}>
          {payFor && all.find((a) => a.id === payFor)?.visit_id && (
            <PayPrompt onLater={() => setPayFor(null)} onPay={() => {
              const vid = all.find((a) => a.id === payFor)!.visit_id
              setPayFor(null)
              if (multi) setMode('depan')
              location.hash = `#/tagihan/${vid}`
            }} />
          )}
        </Presence>
      )}
      {mobile && toast && <Toast key={toast.id} text={toast.text} undo={toast.undo} undoLabel={toast.undoLabel} onDone={() => setToast(null)} />}
      {gridNow && !nowSeen && <button type="button" className="now-chip" onClick={() => toNow(true)}>Sekarang {dotTime(nowMin + START)}</button>}
      {mobile && canCreate && !dokter && <button type="button" className="fab" aria-label="Buat janji" onClick={() => setDialog({})}><Icon d={ICONS.plus} size={26} /></button>}
      {data && !(mobile && dokter) && <PlannedList sched={data} date={date} canCreate={canCreate} onScheduled={reload} folded={mobile} />}
      {data && (
        <Presence open={arriveOpen} exitMs={200}>
          {arriveOpen && <ArriveDialog sched={data} me={me} onClose={() => setArriveOpen(false)}
            onSaved={(name) => { setArriveOpen(false); setNotice(`Pasien ${name} terdaftar datang`); reload(); changed() }} />}
        </Presence>
      )}
      {data && (
        <Presence open={!!dialog} exitMs={200}>
          {dialog && <BookDialog sched={data} date={date} me={me} initial={dialog} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); reload(); changed() }} />}
        </Presence>
      )}
    </>
  )
}

const ENDED = ['cancelled', 'no_show', 'rejected', 'done']
/** First chair with no running appointment over [minute, minute+30) that day (branch timezone), else undefined. */
function freeChair(s: Sched, minute: number) {
  return s.chairs.find((c) => !c.appointments.some((a) => !ENDED.includes(a.status)
    && minutesOfDay(a.starts_at, s.branch.timezone) < minute + 30 && minutesOfDay(a.ends_at, s.branch.timezone) > minute))?.id
}

function BookDialog({ sched, date, me, initial, onClose, onSaved }: {
  sched: Sched; date: string; me: Me; initial: { dentistId?: string; minute?: number; patientId?: string }; onClose: () => void; onSaved: () => void
}) {
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(null)
  useEffect(() => { if (initial.patientId) getPatient(initial.patientId).then((p) => setPatient({ id: p.id, name: p.name }), () => null) }, [initial.patientId])
  const [minute, setMinute] = useState(initial.minute ?? 9 * 60)
  // Columns are dentists: a tapped slot presets the dentist; the chair defaults to the first one free at that start (server re-checks).
  const [chairId, setChairId] = useState(() => freeChair(sched, initial.minute ?? 9 * 60) ?? sched.chairs[0]?.id ?? '')
  const [dentistId, setDentistId] = useState(initial.dentistId ?? sched.dentists.find((d) => d.id === me.user.id)?.id ?? sched.dentists[0]?.id ?? '')
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
  const phase = usePresenceClass()
  useDialog(dlg, onClose, useIsMobile())
  return (
    <div className={`overlay ${phase}`} onClick={onClose}>
      <Card<'form'> ref={dlg} render={(p) => <form {...p} />} className="dialog" role="dialog" aria-modal="true" aria-labelledby="book-title"
        onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
        <h2 id="book-title">Buat Janji</h2>
        <p className="muted">{fmtDate(date)} · {sched.branch.name}</p>
        <PatientPicker value={patient} onChange={setPatient} />
        <div className="grid-2">
          <label>Kursi<Select value={chairId} onChange={(e) => setChairId(e.target.value)}>{sched.chairs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></label>
          <label>Dokter gigi<Select value={dentistId} onChange={(e) => setDentistId(e.target.value)}>{sched.dentists.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></label>
          <label>Jam mulai<Select value={minute} onChange={(e) => setMinute(Number(e.target.value))}>{SLOTS.map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}</Select></label>
          <label>Durasi<Select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{[30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} menit</option>)}</Select></label>
        </div>
        <label>Keperluan (opsional)<input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="mis. Kontrol, scaling" /></label>
        {error && <Note status="danger" role="alert">{error}</Note>}
        <div className="dialog-actions">
          <Button variant="outline" onPress={onClose}>Batal</Button>
          <Button type="submit" variant="primary" isDisabled={busy}>{busy ? 'Menyimpan…' : 'Simpan janji'}</Button>
        </div>
      </Card>
    </div>
  )
}

/** "Pasien datang" (audit P1-6): a walk-in without appointment arrives; opens today's visit with dentist + complaint, no time or chair. */
function ArriveDialog({ sched, me, onClose, onSaved }: { sched: Sched; me: Me; onClose: () => void; onSaved: (name: string) => void }) {
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(null)
  const [dentistId, setDentistId] = useState(sched.dentists.find((d) => d.id === me.user.id)?.id ?? (sched.dentists.length === 1 ? sched.dentists[0].id : ''))
  const [complaint, setComplaint] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    if (!patient) return setError('Pilih pasien terlebih dahulu.')
    if (!dentistId) return setError('Pilih dokter gigi.')
    setBusy(true)
    setError('')
    try {
      await startWalkInVisit(patient.id, { dentist_id: dentistId, ...(complaint.trim() ? { complaint: complaint.trim() } : {}) })
      onSaved(patient.name)
    } catch (e) {
      setError(e instanceof ApiError && e.status === 422 ? (e.data?.message ?? 'Data tidak valid.') : errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const dlg = useRef<HTMLFormElement>(null)
  const phase = usePresenceClass()
  useDialog(dlg, onClose, useIsMobile())
  return (
    <div className={`overlay ${phase}`} onClick={onClose}>
      <Card<'form'> ref={dlg} render={(p) => <form {...p} />} className="dialog" role="dialog" aria-modal="true" aria-labelledby="arrive-title"
        onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
        <h2 id="arrive-title">Pasien datang</h2>
        <p className="muted">Tanpa janji · {sched.branch.name}</p>
        <PatientPicker value={patient} onChange={setPatient} />
        <label>Dokter gigi<Select value={dentistId} onChange={(e) => setDentistId(e.target.value)}>
          <option value="">Pilih dokter gigi</option>
          {sched.dentists.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select></label>
        <label>Keluhan (opsional)<input value={complaint} maxLength={500} onChange={(e) => setComplaint(e.target.value)} placeholder="mis. Gigi ngilu" /></label>
        {error && <Note status="danger" role="alert">{error}</Note>}
        <div className="dialog-actions">
          <Button variant="outline" onPress={onClose}>Batal</Button>
          <Button type="submit" variant="primary" isDisabled={busy}>{busy ? 'Menyimpan…' : 'Daftarkan datang'}</Button>
        </div>
      </Card>
    </div>
  )
}

/** "Perlu dijadwalkan": plans made at the chair; the front desk only picks chair + time. */
function PlannedList({ sched, date, canCreate, onScheduled, folded }: { sched: Sched; date: string; canCreate: boolean; onScheduled: () => void; folded?: boolean }) {
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
  const title = <h2>Perlu dijadwalkan <span className="muted small">· {items?.length ?? '…'}</span></h2>
  const body = (
    <>
      {msg && <Note status="success" role="status">{msg}</Note>}
      {items?.length === 0 && <p className="muted">Tidak ada rencana kunjungan yang menunggu.</p>}
      <ul className="planned">
        {items?.map((p) => (
          <li key={p.id} className="planned-row">
            <div>
              <strong>{p.patient_name}</strong> {p.priority === 'segera' && <Chip size="sm" className="chip-urgent">Segera</Chip>}
              <div className="small">{p.procedure} · {p.est_minutes} menit · {p.dentist_name}</div>
              {p.note && <div className="muted small">Catatan: {p.note}</div>}
            </div>
            {canCreate && (
              <div className={mobile ? 'sched-toolbar planned-bar' : 'sched-toolbar'}>
                <Select aria-label="Kursi" value={sel(p).chair} onChange={(e) => setPick({ ...pick, [p.id]: { ...sel(p), chair: e.target.value } })}>
                  {sched.chairs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Select>
                <Select aria-label="Jam mulai" value={sel(p).minute} onChange={(e) => setPick({ ...pick, [p.id]: { ...sel(p), minute: Number(e.target.value) } })}>
                  {SLOTS.filter((m) => m + p.est_minutes <= END).map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}
                </Select>
                {mobile
                  ? <Button variant="primary" onPress={() => book(p)} aria-label={`Jadwalkan ${p.patient_name ?? 'pasien'} ${fmtDate(date)}`}>Jadwalkan</Button>
                  : <Button variant="primary" size="sm" onPress={() => book(p)}>Jadwalkan {fmtDate(date)}</Button>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  )
  // Phone (review-2): folded, so today's operational list stays short; desktop unchanged.
  return folded
    ? <Card<'details'> render={(el) => <details {...el} />} className="planned-fold"><summary>{title}</summary>{body}</Card>
    : <Card className="planned-card">{title}{body}</Card>
}
