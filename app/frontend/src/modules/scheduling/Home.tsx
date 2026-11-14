import { fmtDate, fmtTime, todayWib } from '../../shared/format'
import type { Me } from '../../shared/session'
import { StatusChip, useSchedule } from './Schedule'

export default function Home({ me }: { me: Me }) {
  const date = todayWib()
  const { data, error, loading } = useSchedule(me.active.branch_id, date)
  const all = data?.chairs.flatMap((c) => c.appointments.map((a) => ({ ...a, chair: c.label }))) ?? []
  const active = all.filter((a) => a.status !== 'cancelled' && a.status !== 'no_show')
  const queue = all.filter((a) => a.status === 'checked_in').sort((a, b) => a.starts_at.localeCompare(b.starts_at))

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Selamat datang, {me.user.name}</h1>
          <p className="muted">{fmtDate(date)} · {me.active.branch_name ?? 'Belum ada cabang aktif'}</p>
        </div>
      </div>
      {error ? <div className="card state-card error">{error}</div> : loading && !data ? <div className="card state-card muted">Memuat…</div> : (
        <div className="grid-2">
          <div className="card stat">
            <div className="stat-label">Janji hari ini</div>
            <div className="stat-value">{active.length}</div>
            <div className="muted">{all.filter((a) => a.status === 'done').length} selesai · {queue.length} menunggu</div>
            <a className="btn btn-link" href="#/jadwal">Lihat jadwal →</a>
          </div>
          <div className="card">
            <h2>Antrean (sudah datang)</h2>
            {queue.length === 0 ? <p className="muted empty">Belum ada pasien yang check-in.</p> : (
              <ul className="queue">
                {queue.map((a, i) => (
                  <li key={a.id}>
                    <span className="queue-no">{i + 1}</span>
                    <div className="grow">
                      <div className="strong">{a.patient?.name}</div>
                      <div className="muted small">{fmtTime(a.starts_at, data?.branch.timezone)} · {a.chair} · {a.dentist?.name}</div>
                    </div>
                    <StatusChip status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  )
}
