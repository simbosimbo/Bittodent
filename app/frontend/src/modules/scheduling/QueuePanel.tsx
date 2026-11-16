import { useEffect, useState } from 'react'
import { Select } from '../../shared/ui/Select'
import { Button, buttonVariants } from '@heroui/react'
import { fmtTime, todayWib, TZ } from '../../shared/format'
import type { Me } from '../../shared/session'
import type { Appointment } from './api'
import { useInvoiceStatus } from './MobileJadwal'
import { useSchedule } from './Schedule'

const REFRESH_MS = 60_000
const LATE_MS = 15 * 60_000 // a booked patient this far past the start time is late, not just "not yet here"

/**
 * "Antrean hari ini" (pattern from KlinikMe's always-visible queue): today's patients of the active branch grouped by where they are
 * in the visit (Menunggu → Dirawat → Siap bayar → Belum datang). Shown beside the desk pages (rail ≥1281px, sheet below that).
 * `where` = 'sheet' drops the heading: the sheet has its own title.
 */
export function QueuePanel({ me, where = 'rail' }: { me: Me; where?: 'rail' | 'sheet' }) {
  const { data, error, reload } = useSchedule(me.active.branch_id, todayWib())
  useEffect(() => {
    const t = setInterval(reload, REFRESH_MS)
    return () => clearInterval(t)
  }, [reload])
  const [dentist, setDentist] = useState('')
  const can = (p: string) => me.permissions.includes(p)
  const tz = data?.branch.timezone ?? TZ
  const all = (data?.chairs.flatMap((c) => c.appointments.map((a) => ({ ...a, chair: c.label }))) ?? [])
    .filter((a) => !dentist || a.dentist?.id === dentist)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const { unpaid } = useInvoiceStatus(all, can('billing.read'))
  const of = (s: string) => all.filter((a) => a.status === s)
  const now = Date.now() // re-read on every refresh (REFRESH_MS)
  const late = (a: Appointment) => Date.parse(a.starts_at) + LATE_MS < now
  const groups = [
    { key: 'checked_in', label: 'Menunggu', items: of('checked_in') },
    { key: 'in_treatment', label: 'Dirawat', items: of('in_treatment') },
    { key: 'unpaid', label: 'Siap bayar', items: of('done').filter(unpaid) },
    { key: 'late', label: 'Terlambat', items: of('booked').filter(late) },
    { key: 'booked', label: 'Belum datang', items: of('booked').filter((a) => !late(a)) },
  ]
  // Same rule as Beranda: a chart reader opens the chart (writers with the active visit), others the patient page.
  const href = (a: Appointment) => !a.patient ? null
    : can('note.read') ? `#/rekam-medis/${a.patient.id}${can('note.write') ? `/janji/${a.id}` : ''}`
    : can('patient.read') ? `#/pasien/${a.patient.id}` : null
  const updated = data ? fmtTime(new Date().toISOString(), tz) : ''

  return (
    <section className={`queue-panel queue-${where}`} aria-labelledby={where === 'rail' ? 'queue-panel-h' : undefined} aria-label={where === 'sheet' ? 'Antrean hari ini' : undefined}>
      <div className="queue-panel-head">
        {where === 'rail' && <div className="queue-panel-top">
          <h2 id="queue-panel-h">Antrean hari ini</h2>
          {updated && <span className="muted small">{updated}</span>}
          <Button variant="ghost" size="sm" onPress={reload}>Muat ulang</Button>
        </div>}
        {(data?.dentists.length ?? 0) > 1 && (
          <label className="queue-panel-filter"><span className="sr-only">Saring dokter</span>
            <Select value={dentist} onChange={(e) => setDentist(e.target.value)}>
              <option value="">Semua dokter</option>
              {data!.dentists.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </label>
        )}
        <div className="queue-panel-sum">
          {groups.slice(0, 3).map((g) => <div key={g.key} className={`chip-${g.key}`}><strong>{g.items.length}</strong>{g.label}</div>)}
          <div className="chip-done"><strong>{of('done').length}</strong>Selesai</div>
        </div>
      </div>
      {error ? <p className="queue-panel-error small" role="alert">{error}</p> : !data ? <p className="muted small">Memuat antrean…</p> : (
        groups.map((g) => g.items.length > 0 && (
          <div key={g.key} className="queue-panel-group">
            <h3><span>{g.label}</span><span>{g.items.length}</span></h3>
            <ul>
              {g.items.map((a, i) => {
                const h = href(a)
                const body = <><strong>{a.patient?.name ?? '—'}</strong><span className="muted small">{[a.dentist?.name, a.chair].filter(Boolean).join(' · ')}</span></>
                return (
                  <li key={a.id}>
                    <span className={`queue-panel-no chip-${g.key}`}>{g.key === 'booked' || g.key === 'late' ? fmtTime(a.starts_at, tz) : i + 1}</span>
                    {h ? <a className="queue-panel-who" href={h}>{body}</a> : <span className="queue-panel-who">{body}</span>}
                    {g.key === 'unpaid' && a.visit_id && <a className={buttonVariants({ variant: 'primary', size: 'sm' })} href={`#/tagihan/${a.visit_id}`} aria-label={`Bayar ${a.patient?.name ?? ''}`}>Bayar</a>}
                  </li>
                )
              })}
            </ul>
          </div>
        ))
      )}
      {data && groups.every((g) => g.items.length === 0) && <p className="muted small queue-panel-empty">Belum ada pasien hari ini.</p>}
      {can('appointment.read') && <a className={'queue-panel-foot ' + buttonVariants({ variant: 'outline', fullWidth: true })} href="#/jadwal">Buka jadwal</a>}
    </section>
  )
}
