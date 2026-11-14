import { fmtDate, fmtTime, todayWib } from '../../shared/format'
import type { Me } from '../../shared/session'
import type { Appointment } from './api'
import { StatusChip, useSchedule } from './Schedule'

export default function Home({ me }: { me: Me }) {
  const date = todayWib()
  const { data, error, loading } = useSchedule(me.active.branch_id, date)
  const canChart = me.permissions.includes('note.read')
  const canVisit = me.permissions.includes('note.write') // same rule as Schedule: a writer lands on the chart with an active visit
  const all = (data?.chairs.flatMap((c) => c.appointments.map((a) => ({ ...a, chair: c.label }))) ?? [])
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const active = all.filter((a) => a.status !== 'cancelled' && a.status !== 'no_show')
  const queue = all.filter((a) => a.status === 'checked_in')
  const time = (a: Appointment) => fmtTime(a.starts_at, data?.branch.timezone)
  const open = (a: Appointment) => canChart && a.patient && (
    <a className="btn row-action" href={`#/rekam-medis/${a.patient.id}${canVisit ? `/janji/${a.id}` : ''}`}
      aria-label={`Buka Rekam Medis ${a.patient.name}`}>Buka Rekam Medis</a>
  )

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Selamat datang, {me.user.name}</h1>
          <p className="muted">{fmtDate(date)} · {me.active.branch_name ?? 'Belum ada cabang aktif'}</p>
        </div>
      </div>
      {error ? <div className="card state-card error">{error}</div> : loading && !data ? <div className="card state-card muted">Memuat…</div> : (
        <div className="grid-2 gap">
          <section className="card stat" aria-labelledby="home-today">
            <div className="stat-label" id="home-today">Janji hari ini</div>
            <div className="stat-value">{active.length}</div>
            <div className="muted">{all.filter((a) => a.status === 'done').length} selesai · {queue.length} menunggu</div>
            <a className="btn btn-link" href="#/jadwal">Lihat jadwal →</a>
            {active.length === 0 ? <p className="muted empty">Belum ada janji aktif hari ini.</p> : (
              <ul className="queue">
                {active.map((a) => (
                  <li key={a.id}>
                    <span className="queue-time">{time(a)}</span>
                    <div className="grow">
                      <div className="strong">{a.patient?.name ?? '—'}</div>
                      <div className="muted small">{[a.chair, a.dentist?.name, a.reason].filter(Boolean).join(' · ')} <StatusChip status={a.status} /></div>
                    </div>
                    {open(a)}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card" aria-labelledby="home-queue">
            <h2 id="home-queue">Antrean (sudah datang)</h2>
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
