// Jadwal on a phone (≤720px): role mode (Meja depan | Dokter), sectioned agenda, cards with one primary action, toast, Bayar prompt,
// reschedule form and the owner's day summary. Schedule.tsx owns the data and the actions; this file only renders.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import { fmtTime, initials } from '../../shared/format'
import type { Me } from '../../shared/session'
import { storage } from '../../shared/storage'
import { DateField } from '../../shared/ui/DateField'
import { Icon, ICONS } from '../../shared/ui/Icon'
import { Sheet } from '../../shared/ui/Sheet'
import { getDailyRevenue, invoiceForVisit } from '../billing'
import { reschedule, type Appointment, type Schedule as Sched } from './api'
import { END, hhmm, minutesOfDay, SLOTS } from './parts'

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
  const setMode = (m: Mode) => {
    if (!multi) return
    set(m)
    storage.set(key, m)
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
  pending_confirmation: 'Perlu konfirmasi', booked: 'Terjadwal', checked_in: 'Check-in', in_treatment: 'Merawat', done: 'Selesai',
  cancelled: 'Batal', no_show: 'No-show', rejected: 'Ditolak',
}
const Chip = ({ a, owe }: { a: Appointment; owe?: boolean }) =>
  <span className={`chip ${owe ? 'chip-unpaid' : `chip-${a.status}`}`}>{owe ? 'Belum bayar' : CHIP[a.status] ?? a.status}</span>

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
    Promise.all(key.split(',').map((v) => invoiceForVisit(v).then((i) => [v, i.status] as const,
      (e) => { if (e instanceof ApiError && e.status === 404) return [v, 'none'] as const; throw e })))
      .then((r) => { if (live) setMap(Object.fromEntries(r)) }, () => { if (live) setError(true) })
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
const isOnlineRequest = (a: Appointment) => a.status === 'pending_confirmation' && a.source === 'online'

function Card({ a, tz, chair, dentist, owe, primary, onOpen }: {
  a: Appointment; tz: string; chair?: string; dentist: boolean; owe: boolean; primary: Act | null; onOpen: () => void
}) {
  const who = a.patient?.name ?? 'Pasien'
  // Buka RM is the one outlined primary (board): opening a chart is not a state change.
  const cls = primary?.key === 'chart' ? 'btn agenda-cta agenda-cta-outline' : 'btn btn-primary agenda-cta'
  const label = primary && <>{ACT_ICON[primary.key] && primary.key !== 'checkin' && primary.key !== 'confirm' && <Icon d={ACT_ICON[primary.key]} size={18} />}{primary.label}</>
  return (
    <li className={`agenda-item appt-${a.status}`}>
      <button type="button" className="agenda-open" aria-haspopup="dialog" onClick={onOpen}>
        <span className="agenda-time">{fmtTime(a.starts_at, tz)}</span>
        <span className="agenda-av" aria-hidden="true">{initials(who)}</span>
        <span className="agenda-main">
          <span className="agenda-name">{who}</span>
          <span className="agenda-meta">{[a.reason, dentist ? a.dentist?.name : null, chair].filter(Boolean).join(' · ')}</span>
          <span className="agenda-chips">{a.source === 'online' && a.status !== 'pending_confirmation' && <span className="chip chip-online">Online</span>}<Chip a={a} owe={owe} /></span>
        </span>
        {!primary && <span className="agenda-more" aria-hidden="true"><Icon d={ICONS.more} /></span>}
      </button>
      {primary && (primary.href
        ? <a className={cls} href={primary.href} aria-label={`${primary.label} ${who}`}>{label}</a>
        : <button type="button" className={cls} aria-label={`${primary.label} ${who}`} onClick={primary.run}>{label}</button>)}
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
      <summary><h2 id={id}>{title} <span>· {count}</span></h2><Icon d={ICONS.up} size={18} /></summary>
      <ul className="agenda" aria-labelledby={id}>{children}</ul>
    </details>
  )
}

export type AgendaProps = {
  mode: Mode; list: Appointment[]; tz: string; chairs: Sched['chairs']; nowMin: number | null
  unpaid: (a: Appointment) => boolean; primary: (a: Appointment) => Act | null; onOpen: (a: Appointment) => void
  /** grid view: only the "Perlu konfirmasi" section above the grid */
  confirmOnly?: boolean; empty: ReactNode
}

/**
 * Meja depan: Perlu konfirmasi → Belum bayar → Berikutnya (Sekarang divider on today) → Selesai (collapsed).
 * Dokter (own appointments only, filtered by the caller): Sedang dirawat → Berikutnya → Selesai.
 */
export function Agenda({ mode, list, tz, chairs, nowMin, unpaid, primary, onOpen, confirmOnly, empty }: AgendaProps) {
  const label = Object.fromEntries(chairs.map((c) => [c.id, c.label]))
  const card = (a: Appointment) => <Card key={a.id} a={a} tz={tz} chair={label[a.chair_id]} dentist={mode === 'depan'} owe={a.status === 'done' && unpaid(a)}
    primary={primary(a)} onOpen={() => onOpen(a)} />
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
  const next = list.filter((a) => !CLOSED.includes(a.status) && !isOnlineRequest(a))
  const done = list.filter((a) => CLOSED.includes(a.status) && !owe.includes(a))
  return (
    <>
      <Section title="Perlu konfirmasi" items={confirm} render={card} />
      <Section title="Belum bayar" items={owe} render={card} />
      {next.length > 0 && <Fold title="Berikutnya" count={next.length} open>{nextWithNow(next)}</Fold>}
      <Section title="Selesai" items={done} render={card} collapsed />
    </>
  )
}

// ---- Action sheet ----
/** Tap a card: status action first, the rest below, Batalkan last behind a confirm step. */
export function ApptSheet({ a, tz, chair, acts, onClose, onReschedule, onForm }: {
  a: Appointment; tz: string; chair?: string; acts: Act[]; onClose: () => void; onReschedule?: () => void; onForm?: (kind: 'chair' | 'refer') => void
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
        {a.source === 'online' && a.status !== 'pending_confirmation' && <span className="chip chip-online">Online</span>}
        <Chip a={a} />
      </p>
      {(a.reason || a.dentist || chair) && <p className="muted">{[a.reason, a.dentist?.name, chair].filter(Boolean).join(' · ')}</p>}
      {confirmCancel ? (
        <div className="appt-sheet-actions" role="group" aria-label="Batalkan janji?">
          <p><strong>Batalkan janji ini?</strong></p>
          <button type="button" className="btn btn-danger" onClick={() => { onClose(); confirmCancel.run?.() }}>Ya, batalkan</button>
          <button type="button" className="btn" onClick={() => setConfirmCancel(null)}>Tidak</button>
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
        <label>Tanggal<DateField value={day} onChange={(e) => e.target.value && setDay(e.target.value)} /></label>
        <label>Jam mulai<select value={minute} onChange={(e) => setMinute(Number(e.target.value))}>{SLOTS.map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}</select></label>
        <label>Kursi<select value={chair} onChange={(e) => setChair(e.target.value)}>{chairs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="appt-sheet-actions">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
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
        <label>Kursi<select value={chair} onChange={(e) => setChair(e.target.value)}>
          {chairs.map((c) => <option key={c.id} value={c.id}>{c.label}{c.id === a.chair_id ? ' (sekarang)' : ''}</option>)}
        </select></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="appt-sheet-actions">
          <button className="btn btn-primary" disabled={busy || chair === a.chair_id}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </form>
    </Sheet>
  )
}

/** Rujuk: the only way to give an appointment to another dentist; reason required, audited (POST /appointments/{id}/refer). */
export function ReferSheet({ a, dentists, save, onClose, onSaved }: {
  a: Appointment; dentists: Sched['dentists']; save: (id: string, body: { dentist_id: string; reason: string }) => Promise<unknown>
  onClose: () => void; onSaved: () => void
}) {
  const others = dentists.filter((d) => d.id !== a.dentist?.id)
  const [dentist, setDentist] = useState(others[0]?.id ?? '')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (reason.trim().length < 5) return setError('Tulis alasan rujukan (minimal 5 huruf).')
    setBusy(true)
    setError('')
    try {
      await save(a.id, { dentist_id: dentist, reason: reason.trim() })
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
        <label>Dokter gigi tujuan<select value={dentist} onChange={(e) => setDentist(e.target.value)}>
          {others.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select></label>
        <label>Alasan rujukan<textarea value={reason} maxLength={500} rows={3} required onChange={(e) => setReason(e.target.value)} placeholder="mis. Perlu penanganan bedah mulut" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="appt-sheet-actions">
          <button className="btn btn-primary" disabled={busy || !dentist}>{busy ? 'Menyimpan…' : 'Rujuk'}</button>
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
        <button type="button" className="btn btn-primary" onClick={onPay}>Bayar</button>
        <button type="button" className="btn" onClick={onLater}>Nanti</button>
      </div>
    </Sheet>
  )
}

/** Short status message above the bottom nav; optional undo; gone after 5 s. Never traps focus. */
export function Toast({ text, undo, onDone }: { text: string; undo?: () => void; onDone: () => void }) {
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const t = setTimeout(() => done.current(), 5000)
    return () => clearTimeout(t)
  }, []) // the parent keys each toast, so a new one restarts the 5 s
  return (
    <div className="toast" role="status">
      <span>{text}{undo && ' ·'}</span>
      {undo && <button type="button" className="btn btn-ghost" onClick={() => { onDone(); undo() }}>Urungkan</button>}
    </div>
  )
}
