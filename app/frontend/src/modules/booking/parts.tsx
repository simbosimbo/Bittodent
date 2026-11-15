import { useEffect, useState, type ReactNode } from 'react'
import { ApiError } from '../../shared/api/http'
import { fmtTime, todayWib } from '../../shared/format'
import { getSlots, type Slot } from './api'
import './booking.css'

export const DAYS = 30

export const addDays = (ymd: string, n: number) => {
  const d = new Date(ymd + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const dayFmt = (opts: Intl.DateTimeFormatOptions) => (ymd: string) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', ...opts }).format(new Date(ymd + 'T00:00:00Z'))
const weekday = dayFmt({ weekday: 'short' })
const dayMonth = dayFmt({ day: 'numeric', month: 'short' })
export const longDate = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
export const timeRange = (s: string, e: string) => `${fmtTime(s)}–${fmtTime(e)} WIB`

export const apiMessage = (e: unknown, fallback = 'Gagal memuat. Coba lagi.') =>
  e instanceof ApiError && e.data?.message && e.status < 500 ? (e.status === 429 && e.data?.error !== 'resend_limited' ? 'Terlalu banyak permintaan. Coba lagi nanti.' : e.data.message) : fallback

export function Page({ clinic, children, aside }: { clinic: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="bk">
      <header className="bk-top">
        <span className="bk-mark" aria-hidden="true">B</span>
        <div><strong>{clinic}</strong><small>Booking janji temu</small></div>
      </header>
      <main className={'bk-main' + (aside ? ' has-aside' : '')}>
        <div className="bk-col">{children}</div>
        {aside && <aside className="bk-aside">{aside}</aside>}
      </main>
    </div>
  )
}

export function Summary({ rows, title = 'Ringkasan' }: { rows: [string, ReactNode][]; title?: string }) {
  return (
    <section className="bk-card" aria-label={title}>
      <h2 className="bk-card-title">{title}</h2>
      <dl className="bk-kv">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v ?? '–'}</dd></div>)}
      </dl>
    </section>
  )
}

/** Date strip (today..+30) + free slots of one dentist/service. */
export function SlotPicker({ slug, dentistId, serviceId, value, onChange, near }: {
  slug: string; dentistId: string; serviceId: string; value: Slot | null; onChange: (s: Slot) => void; near?: string /* ISO: open on that day */
}) {
  const today = todayWib()
  const start = value?.starts_at ?? near
  const [date, setDate] = useState(() => {
    const d = start ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(start)) : today
    return d < today || d > addDays(today, DAYS) ? today : d
  })
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    setSlots(null)
    setError('')
    getSlots(slug, dentistId, serviceId, date).then((r) => live && setSlots(r.slots), (e) => live && setError(apiMessage(e)))
    return () => { live = false }
  }, [slug, dentistId, serviceId, date])

  return (
    <>
      <div className="bk-dates" role="group" aria-label="Tanggal">
        {Array.from({ length: DAYS + 1 }, (_, i) => addDays(today, i)).map((d) => (
          <button key={d} type="button" aria-pressed={d === date} aria-label={dayFmt({ weekday: 'long', day: 'numeric', month: 'long' })(d)} onClick={() => setDate(d)}>
            <small>{i18nDay(d, today)}</small>{dayMonth(d)}
          </button>
        ))}
      </div>
      <div aria-live="polite">
        {error ? <p className="bk-error" role="alert">{error}</p>
          : slots === null ? <p className="bk-muted">Memuat jam…</p>
          : slots.length === 0 ? <p className="bk-muted">Tidak ada jam kosong.</p>
          : (
            <div className="bk-slots" role="group" aria-label="Jam">
              {slots.map((s) => (
                <button key={s.starts_at} type="button" aria-pressed={value?.starts_at === s.starts_at} onClick={() => onChange(s)}>{s.time}</button>
              ))}
            </div>
          )}
      </div>
    </>
  )
}

const i18nDay = (d: string, today: string) => d === today ? 'Hari ini' : d === addDays(today, 1) ? 'Besok' : weekday(d)

export const StatusChip = ({ status }: { status: string }) => (
  <span className={`bk-chip bk-chip-${status}`}>{({ pending_confirmation: 'Menunggu konfirmasi', booked: 'Terkonfirmasi', cancelled: 'Dibatalkan', rejected: 'Ditolak' } as Record<string, string>)[status] ?? status}</span>
)
