// Jadwal on a phone (≤720px): role mode (Meja depan | Dokter), sectioned agenda, cards with one primary action, toast, Bayar prompt,
// reschedule form and the owner's day summary. Schedule.tsx owns the data and the actions; this file only renders.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import { fmtTime } from '../../shared/format'
import type { Me } from '../../shared/session'
import { storage } from '../../shared/storage'
import { DateField } from '../../shared/ui/DateField'
import { Sheet } from '../../shared/ui/Sheet'
import { fmtRp, getDailyRevenue, invoiceForVisit } from '../billing'
import { reschedule, type Appointment, type Schedule as Sched } from './api'
import { dotTime, END, hhmm, minutesOfDay, SLOTS, StatusChip } from './parts'

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
  const money = !isToday || !canBill || paid === 'error' ? '–' : paid === null ? '…' : fmtRp(paid)
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

function Card({ a, tz, chair, primary, onOpen }: { a: Appointment; tz: string; chair?: string; primary: Act | null; onOpen: () => void }) {
  const mins = Math.round((new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000)
  const who = a.patient?.name ?? 'Pasien'
  return (
    <li className={`agenda-item appt-${a.status}`}>
      <button type="button" className="agenda-open" aria-haspopup="dialog" onClick={onOpen}>
        <span className="agenda-time"><strong>{fmtTime(a.starts_at, tz)}</strong><span>{mins} mnt</span></span>
        <span className="agenda-main">
          <span className="agenda-name">{who}</span>
          <span className="agenda-meta">{[a.reason, a.dentist?.name, chair].filter(Boolean).join(' · ')}</span>
          <span className="agenda-chips">{a.source === 'online' && <span className="chip chip-online">Online</span>}<StatusChip status={a.status} /></span>
        </span>
      </button>
      {primary && (primary.href
        ? <a className="btn btn-primary agenda-cta" href={primary.href} aria-label={`${primary.label} ${who}`}>{primary.label}</a>
        : <button type="button" className="btn btn-primary agenda-cta" aria-label={`${primary.label} ${who}`} onClick={primary.run}>{primary.label}</button>)}
    </li>
  )
}

function Section({ title, items, render, collapsed }: { title: string; items: Appointment[]; render: (a: Appointment) => ReactNode; collapsed?: boolean }) {
  if (items.length === 0) return null
  const id = 'sec-' + title.toLowerCase().replace(/\s+/g, '-')
  if (collapsed) return (
    <details className="agenda-sec">
      <summary><h2 id={id}>{title} <span className="muted">· {items.length}</span></h2></summary>
      <ul className="agenda" aria-labelledby={id}>{items.map(render)}</ul>
    </details>
  )
  return (
    <section className="agenda-sec" aria-labelledby={id}>
      <h2 id={id}>{title} <span className="muted">· {items.length}</span></h2>
      <ul className="agenda" aria-labelledby={id}>{items.map(render)}</ul>
    </section>
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
  const card = (a: Appointment) => <Card key={a.id} a={a} tz={tz} chair={label[a.chair_id]} primary={primary(a)} onOpen={() => onOpen(a)} />
  const withNow = (a: Appointment, i: number, all: Appointment[]) => {
    const at = minutesOfDay(a.starts_at, tz)
    const first = nowMin !== null && at >= nowMin && (i === 0 || minutesOfDay(all[i - 1].starts_at, tz) < nowMin)
    return first ? [<li key="now" className="agenda-now-row"><span className="agenda-now">Sekarang {dotTime(nowMin)}</span></li>, card(a)] : card(a)
  }
  const nextWithNow = (items: Appointment[]) => {
    const rows = items.flatMap(withNow)
    // Everything still to come started before now: the divider closes the list.
    if (nowMin !== null && items.length > 0 && items.every((a) => minutesOfDay(a.starts_at, tz) < nowMin))
      rows.push(<li key="now" className="agenda-now-row"><span className="agenda-now">Sekarang {dotTime(nowMin)}</span></li>)
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
        {next.length > 0 && (
          <section className="agenda-sec" aria-labelledby="sec-berikutnya">
            <h2 id="sec-berikutnya">Berikutnya <span className="muted">· {next.length}</span></h2>
            <ul className="agenda" aria-labelledby="sec-berikutnya">{nextWithNow(next)}</ul>
          </section>
        )}
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
      {next.length > 0 && (
        <section className="agenda-sec" aria-labelledby="sec-berikutnya">
          <h2 id="sec-berikutnya">Berikutnya <span className="muted">· {next.length}</span></h2>
          <ul className="agenda" aria-labelledby="sec-berikutnya">{nextWithNow(next)}</ul>
        </section>
      )}
      <Section title="Selesai" items={done} render={card} collapsed />
    </>
  )
}

// ---- Action sheet ----
/** Tap a card: status action first, the rest below, Batalkan last behind a confirm step. */
export function ApptSheet({ a, tz, chair, acts, onClose, onReschedule }: {
  a: Appointment; tz: string; chair?: string; acts: Act[]; onClose: () => void; onReschedule?: () => void
}) {
  const [confirmCancel, setConfirmCancel] = useState<Act | null>(null)
  const run = (x: Act) => {
    if (x.key === 'cancel') return setConfirmCancel(x)
    if (x.key === 'reschedule') return onReschedule?.()
    onClose()
    x.run?.()
  }
  return (
    <Sheet title={a.patient?.name ?? 'Janji'} onClose={onClose} className="appt-sheet">
      <p className="appt-sheet-meta">
        <span>{fmtTime(a.starts_at, tz)}–{fmtTime(a.ends_at, tz)}</span>
        {a.source === 'online' && <span className="chip chip-online">Online</span>}
        <StatusChip status={a.status} />
      </p>
      {(a.reason || a.dentist || chair) && <p className="muted">{[a.reason, a.dentist?.name, chair].filter(Boolean).join(' · ')}</p>}
      {confirmCancel ? (
        <div className="appt-sheet-actions" role="group" aria-label="Batalkan janji?">
          <p><strong>Batalkan janji ini?</strong></p>
          <button type="button" className="btn btn-danger" onClick={() => { onClose(); confirmCancel.run?.() }}>Ya, batalkan</button>
          <button type="button" className="btn" onClick={() => setConfirmCancel(null)}>Tidak</button>
        </div>
      ) : (
        <div className="appt-sheet-actions">
          {acts.map((x) => x.href
            ? <a key={x.key} className={x.tone === 'primary' ? 'btn btn-primary' : 'btn'} href={x.href} onClick={onClose}>{x.label}</a>
            : <button key={x.key} type="button" className={x.tone === 'primary' ? 'btn btn-primary' : x.tone === 'danger' ? 'btn btn-danger' : 'btn'} onClick={() => run(x)}>{x.label}</button>)}
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

/** After Selesai (billing readers): Bayar = Meja depan + this visit's invoice; Nanti = stay (the visit shows under Belum bayar). */
export function PayPrompt({ onPay, onLater }: { onPay: () => void; onLater: () => void }) {
  return (
    <Sheet title="Lanjut ke Bayar?" onClose={onLater} className="appt-sheet">
      <div className="appt-sheet-actions">
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
      <span>{text}</span>
      {undo && <button type="button" className="btn btn-ghost" onClick={() => { onDone(); undo() }}>Urungkan</button>}
    </div>
  )
}
