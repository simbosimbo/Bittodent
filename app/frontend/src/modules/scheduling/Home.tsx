import { useEffect, useState, type CSSProperties } from 'react'
import { fmtDate, fmtTime, initials, todayWib, TZ } from '../../shared/format'
import type { Me } from '../../shared/session'
import { Icon, ICONS } from '../../shared/ui/Icon'
import type { Appointment } from './api'
import { minutesOfDay, StatusChip, useSchedule } from './Schedule'

type Row = Appointment & { chair: string }
const LEGEND = [['done', 'Selesai'], ['in_treatment', 'Merawat'], ['checked_in', 'Check-in'], ['booked', 'Terjadwal']]
const AXIS_START = 8 * 60, AXIS_MIN_END = 15 * 60, AXIS_MAX_END = 20 * 60
// "drg. Clara Wijaya, Sp.KGA" -> "CW": skip titles (words with a dot).

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function Home({ me }: { me: Me }) {
  const date = todayWib()
  const now = useNow()
  const { data, error, loading } = useSchedule(me.active.branch_id, date)
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const can = (p: string) => me.permissions.includes(p)
  const canChart = can('note.read')
  const canVisit = can('note.write') // same rule as Schedule: a writer lands on the chart with an active visit
  const tz = data?.branch.timezone ?? TZ
  const all: Row[] = (data?.chairs.flatMap((c) => c.appointments.map((a) => ({ ...a, chair: c.label }))) ?? [])
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const active = all.filter((a) => a.status !== 'cancelled' && a.status !== 'no_show')
  const count = (s: string) => active.filter((a) => a.status === s).length
  const done = count('done'), treating = count('in_treatment'), waiting = count('checked_in')
  const queue = active.filter((a) => a.status === 'checked_in' || a.status === 'in_treatment')
  const shown = filter === 'open' ? active.filter((a) => a.status !== 'done') : active
  const patients = new Set(active.flatMap((a) => (a.patient ? [a.patient.id] : []))).size

  const time = (a: Appointment) => fmtTime(a.starts_at, tz)
  const span = (a: Appointment) => `${time(a)}–${fmtTime(a.ends_at, tz)}`
  const href = (a: Appointment) => canChart && a.patient ? `#/rekam-medis/${a.patient.id}${canVisit ? `/janji/${a.id}` : ''}` : null
  const open = (a: Appointment) => {
    const h = href(a)
    return h && <a className="btn row-action" href={h} aria-label={`Buka Rekam Medis ${a.patient!.name}`}>Buka Rekam Medis</a>
  }

  const nowMin = minutesOfDay(now.toISOString(), tz)
  const greeting = nowMin < 11 * 60 ? 'Selamat pagi' : nowMin < 15 * 60 ? 'Selamat siang' : 'Selamat sore'
  const nowLabel = fmtTime(now.toISOString(), tz)

  // Timeline: 08:00 to at least 15:00, extended (max 20:00) so no appointment is clipped.
  const lastEnd = Math.max(AXIS_MIN_END, ...active.map((a) => minutesOfDay(a.ends_at, tz)))
  const axisEnd = Math.min(AXIS_MAX_END, Math.ceil(lastEnd / 60) * 60)
  const hours = Array.from({ length: (axisEnd - AXIS_START) / 60 + 1 }, (_, i) => AXIS_START + i * 60)
  const pct = (m: number) => `${((Math.min(Math.max(m, AXIS_START), axisEnd) - AXIS_START) / (axisEnd - AXIS_START)) * 100}%`
  const dentists = [...(data?.dentists ?? [])]
  for (const a of active) if (a.dentist && !dentists.some((d) => d.id === a.dentist!.id)) dentists.push(a.dentist)
  const lanes = dentists.map((d) => ({ id: d.id, name: d.name, items: active.filter((a) => a.dentist?.id === d.id) }))
  const orphan = active.filter((a) => !a.dentist)
  if (orphan.length) lanes.push({ id: '-', name: 'Tanpa dokter', items: orphan })

  const kpis = [
    { label: 'Pasien hari ini', icon: ICONS.user, value: patients, note: `${patients} dengan janji` },
    { label: 'Janji temu', icon: ICONS.calendar, value: active.length, note: `${done} selesai · ${active.length - done} tersisa` },
    { label: 'Antrean', icon: ICONS.users, value: queue.length, note: `${treating} sedang dirawat · ${waiting} menunggu` },
  ]

  return (
    <>
      <div className="page-head home-head">
        <div>
          <h1>Beranda</h1>
          <p className="home-greet">{greeting}, {me.user.name}</p>
          <p className="muted">{fmtDate(date)} · {nowLabel} WIB</p>
        </div>
        <div className="toolbar">
          {can('patient.create') && <a className="btn" href="#/pasien/baru">Daftarkan pasien</a>}
          {can('appointment.create') && <a className="btn btn-primary" href="#/jadwal">Buat janji</a>}
        </div>
      </div>
      {error ? <div className="card state-card error">{error}</div> : loading && !data ? <div className="card state-card muted">Memuat…</div> : (
        <div className="grid-12">
          {kpis.map((k) => (
            <section key={k.label} className="card stat span-3" aria-label={k.label}>
              <div className="stat-head"><span className="stat-label">{k.label}</span><span className="stat-icon"><Icon d={k.icon} /></span></div>
              <div className="stat-value">{k.value}</div>
              <div className="muted">{k.note}</div>
            </section>
          ))}
          <section className="card stat span-3" aria-label="Pendapatan hari ini">
            <div className="stat-head"><span className="stat-label">Pendapatan hari ini</span><span className="stat-icon"><Icon d={ICONS.card} /></span></div>
            {/* No daily-revenue API yet: never show a made-up amount. */}
            <div className="stat-value"><span aria-hidden="true">—</span><span className="sr-only">Belum tersedia</span></div>
            <div className="muted">Tagihan harian belum tersedia</div>
          </section>

          <section className="card span-12" aria-labelledby="home-board">
            <div className="card-head">
              <div>
                <h2 id="home-board">Jadwal hari ini per dokter</h2>
                <p className="muted small">Klik blok untuk membuka rekam medis pasien</p>
              </div>
              <div className="tl-legend" aria-label="Keterangan status">
                {LEGEND.map(([s, l]) => <span key={s} className={`chip chip-${s}`}>{l}</span>)}
              </div>
            </div>
            {lanes.length === 0 ? <p className="muted empty">Belum ada janji aktif hari ini.</p> : (
              <div className="tl-scroll">
                <div className="tl" style={{ '--tl-hours': hours.length - 1 } as CSSProperties}>
                  <div className="tl-row tl-axis" aria-hidden="true">
                    <div />
                    <div className="tl-track">
                      {hours.map((h) => <span key={h} style={{ left: pct(h) }}>{String(h / 60).padStart(2, '0')}.00</span>)}
                    </div>
                  </div>
                  {lanes.map((l) => (
                    <div key={l.id} className="tl-row">
                      <div className="tl-who">
                        <span className="avatar">{initials(l.name) || '?'}</span>
                        <div>
                          <div className="strong">{l.name}</div>
                          <div className="muted small">{l.items.length} janji · {l.items.filter((a) => a.status !== 'done').length} tersisa</div>
                        </div>
                      </div>
                      <div className="tl-track tl-lane">
                        {l.items.map((a) => {
                          const s = minutesOfDay(a.starts_at, tz), e = minutesOfDay(a.ends_at, tz)
                          const name = a.patient?.name ?? '—'
                          const style = { left: pct(s), width: `calc(${pct(e)} - ${pct(s)})` }
                          const body = <><span className="tl-name">{name}</span><span className="tl-time">{time(a)}</span></>
                          const h = href(a)
                          return h
                            ? <a key={a.id} className={`tl-block tl-${a.status}`} style={style} href={h} title={`${name} · ${span(a)}`} aria-label={`Buka Rekam Medis ${name}`}>{body}</a>
                            : <div key={a.id} className={`tl-block tl-${a.status}`} style={style} title={`${name} · ${span(a)}`}>{body}</div>
                        })}
                      </div>
                    </div>
                  ))}
                  {nowMin >= AXIS_START && nowMin <= axisEnd && (
                    <div className="tl-now-layer" aria-hidden="true">
                      <div className="tl-now" style={{ left: pct(nowMin) }}><span>Sekarang {nowLabel}</span></div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="card span-8" aria-labelledby="home-today">
            <div className="card-head">
              <div>
                <h2 id="home-today">Janji hari ini</h2>
                <p className="muted small" aria-live="polite">{shown.length} janji ditampilkan · urut berdasarkan jam</p>
              </div>
              <div className="seg" role="group" aria-label="Saring janji">
                <button type="button" className="btn" aria-pressed={filter === 'open'} onClick={() => setFilter('open')}>Belum selesai</button>
                <button type="button" className="btn" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Semua</button>
              </div>
            </div>
            {shown.length === 0 ? <p className="muted empty">Belum ada janji aktif hari ini.</p> : (
              <ul className="queue">
                {shown.map((a) => (
                  <li key={a.id}>
                    <span className="queue-time">{time(a)}</span>
                    <div className="grow">
                      <div className="strong">{a.patient?.name ?? '—'}</div>
                      <div className="muted small">{[a.chair, a.dentist?.name, a.reason].filter(Boolean).join(' · ')}</div>
                    </div>
                    <StatusChip status={a.status} />
                    {open(a)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card span-4" aria-labelledby="home-queue">
            <div className="card-head">
              <h2 id="home-queue">Antrean live</h2>
              <span className="muted small">Diperbarui {nowLabel}</span>
            </div>
            <div className="queue-sum">
              <div className="chip-checked_in"><strong>{waiting}</strong>Check-in</div>
              <div className="chip-in_treatment"><strong>{treating}</strong>Merawat</div>
              <div className="chip-done"><strong>{done}</strong>Selesai</div>
            </div>
            {queue.length === 0 ? <p className="muted empty">Belum ada pasien yang check-in.</p> : (
              <ul className="queue">
                {queue.map((a, i) => (
                  <li key={a.id}>
                    <span className="queue-no">{i + 1}</span>
                    <div className="grow">
                      <div className="strong">{a.patient?.name ?? '—'}</div>
                      <div className="muted small">{time(a)} · {a.chair} · {a.dentist?.name} <StatusChip status={a.status} /></div>
                    </div>
                    {open(a)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  )
}
