// Jadwal on a phone (≤720px): role mode (Meja depan | Dokter), sectioned agenda, cards with one primary action, toast, Bayar prompt,
// reschedule form and the owner's day summary. Schedule.tsx owns the data and the actions; this file only renders.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { SectionTitle } from '../../shared/ui/SectionTitle'
import { Select } from '../../shared/ui/Select'
import { Button, buttonVariants, Chip as HChip, Spinner, ToggleButton } from '@heroui/react'
import { ApiError, errorText } from '../../shared/api/http'
import { fmtTime } from '../../shared/format'
import type { Me } from '../../shared/session'
import { storage } from '../../shared/storage'
import { DateField } from '../../shared/ui/DateField'
import { Icon, ICONS } from '../../shared/ui/Icon'
import { Sheet } from '../../shared/ui/Sheet'
import { getDailyRevenue, invoiceStatuses } from '../billing'
import { reschedule, type Appointment, type Schedule as Sched } from './api'
import { END, hhmm, minutesOfDay, SLOTS } from './parts'
import { Note } from '../../shared/ui/Note'

// ---- Role mode ----
export type Mode = 'depan' | 'dokter'
const DESK_ROLES = ['owner', 'front_desk', 'kasir', 'assistant']

/**
 * Default mobile view per role: dentist only = Dokter; any desk role = Meja depan. A dentist with a desk role gets the
 * "Meja depan | Dokter" switch, remembered per user (storage may fail: then the role default). UI only: the server checks permissions.
 */
export function useJadwalMode(me: Me) {
  const dentist = me.roles.includes('dentist'), desk = me.roles.some((r) => DESK_ROLES.includes(r))
  const multi = dentist && desk
  const key = `jadwal-mode:${me.user.id}`
  const [mode, set] = useState<Mode>(() => {
    const saved = multi ? storage.get(key) : null
    return saved === 'depan' || saved === 'dokter' ? saved : dentist && !desk ? 'dokter' : 'depan'
  })
  // Every mounted hook (Beranda + Jadwal) follows the toggle (#70: Beranda = Pasien saya in Dokter mode).
  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent<{ key: string; m: Mode }>).detail; if (d.key === key) set(d.m) }
    addEventListener('jadwal-mode', on)
    return () => removeEventListener('jadwal-mode', on)
  }, [key])
  const setMode = (m: Mode) => {
    if (!multi) return
    set(m)
    storage.set(key, m)
    dispatchEvent(new CustomEvent('jadwal-mode', { detail: { key, m } }))
  }
  return { mode, setMode, multi, owner: me.roles.includes('owner') }
}

export const MODE_LABEL: Record<Mode, string> = { depan: 'Meja depan', dokter: 'Dokter' }

/** Segmented switch (native radios: arrow keys work); the active segment is filled and the page title changes too. */
export function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="mode-toggle" role="radiogroup" aria-label="Mode">
      {(['depan', 'dokter'] as const).map((m) => (
        <label key={m} className={m === mode ? 'on' : undefined}>
          <input type="radio" name="jadwal-mode" value={m} checked={m === mode} onChange={() => onChange(m)} />
          {MODE_LABEL[m]}
        </label>
      ))}
    </div>
  )
}

// ---- Actions (built by Schedule.tsx from permissions + status) ----
export type Act = { key: string; label: string; run?: () => void; href?: string; tone?: 'primary' | 'danger' }
const ACT_ICON: Record<string, string> = {
  confirm: ICONS.check, reject: ICONS.circleX, checkin: ICONS.check, pay: ICONS.banknote, start: ICONS.playCircle, finish: ICONS.check,
  chart: ICONS.fileText, reschedule: ICONS.calClock, noshow: ICONS.userX, cancel: ICONS.circleX, chair: ICONS.armchair, refer: ICONS.arrowRight,
}

/** Phone chip wording (board): short and front-desk oriented; desktop keeps STATUS. A finished, unpaid visit reads "Belum bayar". */
const CHIP: Record<string, string> = {
  pending_confirmation: 'Perlu konfirmasi', booked: 'Terjadwal', checked_in: 'Hadir', in_treatment: 'Merawat', done: 'Selesai',
  cancelled: 'Batal', no_show: 'No-show', rejected: 'Ditolak',
}
const Chip = ({ a, owe }: { a: Appointment; owe?: boolean }) =>
  <HChip size="sm" className={owe ? 'chip-unpaid' : `chip-${a.status}`}>{owe ? 'Belum bayar' : CHIP[a.status] ?? a.status}</HChip>

// ---- Payment status of finished visits ("Belum bayar") ----
/**
 * visit id -> invoice status ('terbuka' = still owes, 'lunas', 'void'; 'none' = no invoice). Only for billing readers (visit_id
 * is only sent to them). shortcut: one GET /api/visits/{id}/invoice per finished visit of the day; add a ranged status endpoint if
 * a clinic finishes dozens of visits a day.
 */
export function useInvoiceStatus(appts: Appointment[], on: boolean) {
  const ids = on ? [...new Set(appts.filter((a) => a.status === 'done' && a.visit_id).map((a) => a.visit_id!))] : []
  const key = ids.join(',')
  const [map, setMap] = useState<Record<string, string>>({})
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!key) return
    let live = true
    setError(false)
    // One request for the whole day (was one per finished visit, which could trip the rate limit on a busy day).
    invoiceStatuses(key.split(',')).then((r) => { if (live) setMap(r.statuses) }, () => { if (live) setError(true) })
    return () => { live = false }
  }, [key, tick])
  return { unpaid: (a: Appointment) => !!a.visit_id && map[a.visit_id] === 'terbuka', error, retry: () => setTick((t) => t + 1) }
}

const rpShort = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 2 }) // "Rp 1,25 jt"

// ---- Owner: one-row day summary (Janji · Hadir · Terbayar) ----
export function DaySummary({ list, isToday, canBill }: { list: Appointment[]; isToday: boolean; canBill: boolean }) {
  const [paid, setPaid] = useState<number | null | 'error'>(null)
  useEffect(() => {
    if (!isToday || !canBill) return
    let live = true
    getDailyRevenue().then((d) => { if (live) setPaid(d.amount_rp) }, () => { if (live) setPaid('error') })
    return () => { live = false }
  }, [isToday, canBill])
  const booked = list.filter((a) => !['cancelled', 'rejected', 'no_show'].includes(a.status)).length
  const came = list.filter((a) => ['checked_in', 'in_treatment', 'done'].includes(a.status)).length
  // Payments are only known for today (daily-revenue); another day shows a dash rather than a wrong total.
  const money = !isToday || !canBill || paid === 'error' ? '–' : paid === null ? '…' : rpShort.format(paid)
  return (
    <dl className="day-sum" aria-label="Ringkasan hari">
      <div><dt>Janji</dt><dd>{booked}</dd></div>
      <div><dt>Hadir</dt><dd>{came}</dd></div>
      <div><dt>Terbayar</dt><dd>{money}</dd></div>
    </dl>
  )
}

// ---- Sectioned agenda ----
const CLOSED = ['done', 'cancelled', 'no_show', 'rejected']
const DUE_SOON = 30 // minutes: a booking this close (or late) counts as "check in now"
const isOnlineRequest = (a: Appointment) => a.status === 'pending_confirmation' && a.source === 'online'

function Card({ a, tz, chair, dentist, owe, primary, onOpen, busy, arrived }: {
  a: Appointment; tz: string; chair?: string; dentist: boolean; owe: boolean; primary: Act | null; onOpen: () => void
  /** this card's primary action is running ("Memproses", not tappable again) */ busy?: boolean
  /** just moved into this section (200 ms slide-in) */ arrived?: boolean
}) {
  const who = a.patient?.name ?? 'Pasien'
  // Buka RM is the one outlined primary (board): opening a chart is not a state change.
  // native <button>/<a> with HeroUI button styles: the busy state needs a real `disabled` + aria-busy (board 08)
  const cls = 'agenda-cta ' + buttonVariants({ variant: primary?.key === 'chart' ? 'outline' : 'primary' })
  const label = busy ? <><Spinner size="sm" color="current" aria-hidden="true" />Memproses</>
    : primary && <>{ACT_ICON[primary.key] && primary.key !== 'checkin' && primary.key !== 'confirm' && <Icon d={ACT_ICON[primary.key]} size={18} />}{primary.label}</>
  // Board 01: a Check-in row says its status through the button; no "Terjadwal" chip. The service (reason) is never cut off;
  // dentist and chair are secondary and may truncate.
  const showChip = primary?.key !== 'checkin'
  const extra = [dentist ? a.dentist?.name : null, chair].filter(Boolean).join(' · ')
  return (
    <li className={`agenda-item appt-${a.status}${arrived ? ' agenda-arrive' : ''}`}>
      <button type="button" className="agenda-open" aria-haspopup="dialog" onClick={onOpen}>
        <span className="agenda-time">{fmtTime(a.starts_at, tz)}</span>
        <span className="agenda-main">
          <span className="agenda-name">{who}</span>
          {(a.reason || extra) && <span className="agenda-meta">{[a.reason, extra].filter(Boolean).join(' · ')}</span>}
          {(showChip || a.source === 'online') && <span className="agenda-chips">{a.source === 'online' && a.status !== 'pending_confirmation' && <HChip size="sm" className="chip-online">Online</HChip>}{showChip && <Chip a={a} owe={owe} />}</span>}
        </span>
        {!primary && <span className="agenda-more" aria-hidden="true"><Icon d={ICONS.more} /></span>}
      </button>
      {primary && (primary.href
        ? <a className={cls} href={primary.href} aria-label={`${primary.label} ${who}`}>{label}</a>
        : <button type="button" className={cls} aria-label={busy ? `Memproses ${who}` : `${primary.label} ${who}`} aria-busy={busy || undefined} disabled={busy} onClick={primary.run}>{label}</button>)}
    </li>
  )
}

function Section({ title, items, render, collapsed }: { title: string; items: Appointment[]; render: (a: Appointment) => ReactNode; collapsed?: boolean }) {
  if (items.length === 0) return null
  return <Fold title={title} count={items.length} open={!collapsed}>{items.map(render)}</Fold>
}

/** Collapsible section (native details/summary: keyboard + screen reader state for free); chevron up = open. */
function Fold({ title, count, open, children }: { title: string; count: number; open: boolean; children: ReactNode }) {
  const id = 'sec-' + title.toLowerCase().replace(/\s+/g, '-')
  return (
    <details className="agenda-sec" open={open}>
      <summary><SectionTitle id={id} count={count}>{title}</SectionTitle><Icon d={ICONS.up} size={18} /></summary>
      <ul className="agenda" aria-labelledby={id}>{children}</ul>
    </details>
  )
}

export type AgendaProps = {
  mode: Mode; list: Appointment[]; tz: string; chairs: Sched['chairs']; nowMin: number | null
  unpaid: (a: Appointment) => boolean; primary: (a: Appointment) => Act | null; onOpen: (a: Appointment) => void
  /** grid view: only the "Perlu konfirmasi" section above the grid */
  confirmOnly?: boolean; empty: ReactNode
  /** appointment whose primary action is running / that just moved (check-in feedback, board 08) */
  busyId?: string | null; arrivedId?: string | null
}

/**
 * Meja depan: Perlu tindakan sekarang (Check-in due · Bayar · Konfirmasi) → Berikutnya (Sekarang divider on today) → Selesai (collapsed).
 * Dokter (own appointments only, filtered by the caller): Sedang dirawat → Berikutnya → Selesai.
 */
export function Agenda({ mode, list, tz, chairs, nowMin, unpaid, primary, onOpen, confirmOnly, empty, busyId, arrivedId }: AgendaProps) {
  const label = Object.fromEntries(chairs.map((c) => [c.id, c.label]))
  const card = (a: Appointment) => <Card key={a.id} a={a} tz={tz} chair={label[a.chair_id]} dentist={mode === 'depan'} owe={a.status === 'done' && unpaid(a)}
    primary={primary(a)} onOpen={() => onOpen(a)} busy={busyId === a.id} arrived={arrivedId === a.id} />
  const nowRow = () => <li key="now" className="agenda-now-row"><span className="agenda-now">Sekarang</span></li>
  const withNow = (a: Appointment, i: number, all: Appointment[]) => {
    const at = minutesOfDay(a.starts_at, tz)
    const first = nowMin !== null && at >= nowMin && (i === 0 || minutesOfDay(all[i - 1].starts_at, tz) < nowMin)
    return first ? [nowRow(), card(a)] : card(a)
  }
  const nextWithNow = (items: Appointment[]) => {
    const rows = items.flatMap(withNow)
    // Everything still to come started before now: the divider closes the list.
    if (nowMin !== null && items.length > 0 && items.every((a) => minutesOfDay(a.starts_at, tz) < nowMin))
      rows.push(nowRow())
    return rows
  }

  if (mode === 'dokter') {
    if (list.length === 0) return <>{empty}</>
    const treating = list.filter((a) => a.status === 'in_treatment')
    const next = list.filter((a) => !CLOSED.includes(a.status) && a.status !== 'in_treatment')
    const done = list.filter((a) => CLOSED.includes(a.status))
    return (
      <>
        <Section title="Sedang dirawat" items={treating} render={card} />
        {next.length > 0 && <Fold title="Berikutnya" count={next.length} open>{nextWithNow(next)}</Fold>}
        <Section title="Selesai" items={done} render={card} collapsed />
      </>
    )
  }

  const confirm = list.filter(isOnlineRequest)
  if (confirmOnly) return <Section title="Perlu konfirmasi" items={confirm} render={card} />
  if (list.length === 0) return <>{empty}</>
  const owe = list.filter((a) => a.status === 'done' && unpaid(a))
  // #70: what the desk must do now comes first, in one section: patients due (booked, starting within 30 min or late) -> Check-in,
  // then Bayar, then online requests. Later bookings stay in Berikutnya; Selesai stays folded.
  const due = nowMin === null ? [] : list.filter((a) => a.status === 'booked' && minutesOfDay(a.starts_at, tz) <= nowMin + DUE_SOON)
  const act = [...due, ...owe, ...confirm]
  // Board 08: checked-in patients wait in their own section ("Hadir" chip), between the to-do list and later bookings.
  const waiting = list.filter((a) => a.status === 'checked_in')
  const next = list.filter((a) => !CLOSED.includes(a.status) && !isOnlineRequest(a) && !due.includes(a) && a.status !== 'checked_in')
  const done = list.filter((a) => CLOSED.includes(a.status) && !owe.includes(a))
  return (
    <>
      <Section title="Perlu tindakan sekarang" items={act} render={card} />
      <Section title="Menunggu" items={waiting} render={card} />
      {next.length > 0 && <Fold title="Berikutnya" count={next.length} open>{nextWithNow(next)}</Fold>}
      <Section title="Selesai" items={done} render={card} collapsed />
    </>
  )
}

// ---- Action sheet ----
/** Tap a card: status action first, the rest below, Batalkan last behind a confirm step. */
export function ApptSheet({ a, tz, chair, acts, onClose, onReschedule, onForm, children }: {
  a: Appointment; tz: string; chair?: string; acts: Act[]; onClose: () => void; onReschedule?: () => void; onForm?: (kind: 'chair' | 'refer') => void
  children?: ReactNode
}) {
  const [confirmCancel, setConfirmCancel] = useState<Act | null>(null)
  const run = (x: Act) => {
    if (x.key === 'cancel') return setConfirmCancel(x)
    if (x.key === 'reschedule') return onReschedule?.()
    if (x.key === 'chair' || x.key === 'refer') return onForm?.(x.key)
    onClose()
    x.run?.()
  }
  return (
    <Sheet title={a.patient?.name ?? 'Janji'} onClose={onClose} className="appt-sheet">
      <p className="appt-sheet-meta">
        <span>{fmtTime(a.starts_at, tz)}–{fmtTime(a.ends_at, tz)}</span>
        {a.source === 'online' && a.status !== 'pending_confirmation' && <HChip size="sm" className="chip-online">Online</HChip>}
        <Chip a={a} />
      </p>
      {(a.reason || a.dentist || chair) && <p className="muted">{[a.reason, a.dentist?.name, chair].filter(Boolean).join(' · ')}</p>}
      {children}
      {confirmCancel ? (
        <div className="appt-sheet-actions" role="group" aria-label="Batalkan janji?">
          <p><strong>Batalkan janji ini?</strong></p>
          <Button variant="danger" onPress={() => { onClose(); confirmCancel.run?.() }}>Ya, batalkan</Button>
          <Button variant="outline" onPress={() => setConfirmCancel(null)}>Tidak</Button>
        </div>
      ) : (
        <div className="appt-sheet-actions sheet-rows">
          {acts.map((x) => {
            const body = <>{ACT_ICON[x.key] && <Icon d={ACT_ICON[x.key]} />}{x.label}</>
            const cls = 'sheet-row' + (x.tone ? ` sheet-row-${x.tone}` : '')
            return x.href
              ? <a key={x.key} className={cls} href={x.href} onClick={onClose}>{body}</a>
              : <button key={x.key} type="button" className={cls} onClick={() => run(x)}>{body}</button>
          })}
          {acts.length === 0 && <p className="muted">Tidak ada aksi untuk janji ini.</p>}
        </div>
      )}
    </Sheet>
  )
}

/** Ubah jadwal: same duration and dentist; date, start and chair change (POST /appointments/{id}/reschedule, booked only). */
export function RescheduleSheet({ a, tz, date, chairs, onClose, onSaved }: {
  a: Appointment; tz: string; date: string; chairs: Sched['chairs']; onClose: () => void; onSaved: () => void
}) {
  const mins = Math.round((new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000)
  const [day, setDay] = useState(date)
  const [minute, setMinute] = useState(() => { const m = minutesOfDay(a.starts_at, tz); return SLOTS.includes(m) ? m : SLOTS[0] })
  const [chair, setChair] = useState(a.chair_id)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (minute + mins > END) return setError(`Janji harus selesai paling lambat ${hhmm(END)}.`)
    setBusy(true)
    setError('')
    // shortcut: fixed +07:00 (WIB) offset, same as BookDialog.
    const at = (m: number) => `${day}T${hhmm(m)}:00+07:00`
    try {
      await reschedule(a.id, { starts_at: at(minute), ends_at: at(minute + mins), chair_id: chair })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError && [409, 422].includes(err.status) ? err.data?.message ?? 'Jadwal tidak bisa diubah.' : errorText(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet title="Ubah jadwal" onClose={onClose} className="appt-sheet">
      <form className="resched" onSubmit={submit} noValidate>
        <p className="muted">{a.patient?.name} · {mins} menit</p>
        <label>Tanggal<DateField className="resched-date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} /></label>
        <label>Jam mulai<Select value={minute} onChange={(e) => setMinute(Number(e.target.value))}>{SLOTS.map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}</Select></label>
        <label>Kursi<Select value={chair} onChange={(e) => setChair(e.target.value)}>{chairs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></label>
        {error && <Note status="danger" role="alert">{error}</Note>}
        <div className="appt-sheet-actions">
          <Button type="submit" variant="primary" isDisabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Sheet>
  )
}

const saveError = (err: unknown, fallback: string) =>
  err instanceof ApiError && [403, 409, 422].includes(err.status) ? err.data?.message ?? fallback : errorText(err)

/** Ganti kursi: same time and dentist, another chair of the branch (POST /appointments/{id}/chair; chair clash checked by the API). */
export function ChairSheet({ a, chairs, save, onClose, onSaved }: {
  a: Appointment; chairs: Sched['chairs']; save: (id: string, chairId: string) => Promise<unknown>; onClose: () => void; onSaved: () => void
}) {
  const [chair, setChair] = useState(chairs.find((c) => c.id !== a.chair_id)?.id ?? a.chair_id)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await save(a.id, chair)
      onSaved()
    } catch (err) {
      setError(saveError(err, 'Kursi tidak bisa diganti.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet title="Ganti kursi" onClose={onClose} className="appt-sheet">
      <form className="resched" onSubmit={submit} noValidate>
        <p className="muted">{a.patient?.name} · {a.dentist?.name} · dokter tetap</p>
        <label>Kursi<Select value={chair} onChange={(e) => setChair(e.target.value)}>
          {chairs.map((c) => <option key={c.id} value={c.id}>{c.label}{c.id === a.chair_id ? ' (sekarang)' : ''}</option>)}
        </Select></label>
        {error && <Note status="danger" role="alert">{error}</Note>}
        <div className="appt-sheet-actions">
          <Button type="submit" variant="primary" isDisabled={busy || chair === a.chair_id}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Sheet>
  )
}

/** "Dokter berhalangan": the front desk's preset reason (DEVIATIONS #68); free text is added after it. */
export const UNAVAILABLE = 'Dokter berhalangan'

/**
 * Rujuk: the only way to give an appointment to another dentist; reason required, audited (POST /appointments/{id}/refer).
 * Preset "Dokter berhalangan" (on by default for the front desk moving someone else's patient) + free text.
 */
export function ReferSheet({ a, dentists, save, unavailable = false, onClose, onSaved }: {
  a: Appointment; dentists: Sched['dentists']; save: (id: string, body: { dentist_id: string; reason: string }) => Promise<unknown>
  unavailable?: boolean; onClose: () => void; onSaved: () => void
}) {
  const others = dentists.filter((d) => d.id !== a.dentist?.id)
  const [dentist, setDentist] = useState(others[0]?.id ?? '')
  const [preset, setPreset] = useState(unavailable)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const reason = preset ? (note.trim() ? `${UNAVAILABLE}: ${note.trim()}` : UNAVAILABLE) : note.trim()
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (reason.length < 5) return setError('Tulis alasan rujukan (minimal 5 huruf).')
    setBusy(true)
    setError('')
    try {
      await save(a.id, { dentist_id: dentist, reason })
      onSaved()
    } catch (err) {
      setError(saveError(err, 'Janji tidak bisa dirujuk.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet title="Rujuk ke dokter lain" onClose={onClose} className="appt-sheet">
      <form className="resched" onSubmit={submit} noValidate>
        <p className="muted">{a.patient?.name} · dari {a.dentist?.name ?? 'dokter'} · jam dan kursi tetap</p>
        <label>Dokter gigi tujuan<Select value={dentist} onChange={(e) => setDentist(e.target.value)}>
          {others.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select></label>
        <div className="refer-presets" role="group" aria-label="Alasan cepat">
          <ToggleButton className="refer-preset" isSelected={preset} onChange={(on) => { setPreset(on); setError('') }}>{UNAVAILABLE}</ToggleButton>
        </div>
        <label>{preset ? 'Keterangan (opsional)' : 'Alasan rujukan'}<textarea value={note} maxLength={450} rows={3}
          onChange={(e) => { setNote(e.target.value); setError('') }} placeholder={preset ? 'mis. sakit, cuti' : 'mis. Perlu penanganan bedah mulut'} /></label>
        {error && <Note status="danger" role="alert">{error}</Note>}
        <div className="appt-sheet-actions">
          <Button type="submit" variant="primary" isDisabled={busy || !dentist}>{busy ? 'Menyimpan…' : 'Rujuk'}</Button>
        </div>
      </form>
    </Sheet>
  )
}

/** After Selesai (billing readers): Bayar = Meja depan + this visit's invoice; Nanti = stay (the visit shows under Belum bayar). */
export function PayPrompt({ onPay, onLater }: { onPay: () => void; onLater: () => void }) {
  return (
    <Sheet title="Lanjut ke Bayar?" onClose={onLater} className="appt-sheet">
      <div className="pay-prompt">
        <Button variant="primary" onPress={onPay}>Bayar</Button>
        <Button variant="outline" onPress={onLater}>Nanti</Button>
      </div>
    </Sheet>
  )
}

/** Short status message above the bottom nav; optional undo; gone after 5 s. Never traps focus. */
export function Toast({ text, undo, undoLabel = 'Urungkan', onDone }: { text: string; undo?: () => void; undoLabel?: string; onDone: () => void }) {
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const t = setTimeout(() => done.current(), 5000)
    return () => clearTimeout(t)
  }, []) // the parent keys each toast, so a new one restarts the 5 s
  return (
    <div className="sched-toast" role="status">
      <span>{text}{undo && ' ·'}</span>
      {undo && <Button variant="ghost" onPress={() => { onDone(); undo() }}>{undoLabel}</Button>}
    </div>
  )
}
