import { flowSteps, patientOf, useStore } from '../state/store'
import { go } from '../lib/router'
import { Icon } from './Icon'
import { Badge, UnsyncedBadge } from './ui'

// Banner offline: TANPA data pasien.
export function OfflineBanner() {
  const { s } = useStore()
  if (!s.offline) return null
  return (
    <div className="offline-banner" role="status">
      <span className="badge badge-offline">Mode offline — hanya tunai</span>
      <UnsyncedBadge />
      <span className="offline-text">Hanya data hari ini di cabang ini. Tanda tangan klinis, AI, WhatsApp, dan pembayaran non-tunai tidak tersedia. Tidak menampilkan data pasien di bilah ini.</span>
    </div>
  )
}

// Stepper "Alur kunjungan pertama": tiap langkah = modul asli untuk pasien yang sama.
export function FlowStepper({ path, inline }: { path: string; inline?: boolean }) {
  const { s, a } = useStore()
  if (!s.flow.active && !inline) return null
  const pid = s.flow.patientId ?? s.activeId
  const p = patientOf(s, pid)
  const steps = flowSteps(s, pid)
  const nextIdx = steps.findIndex((x) => !x.done)
  const mismatch = s.flow.active && pid && s.activeId !== pid
  return (
    <div className={`flow ${inline ? 'flow-inline' : ''}`} aria-label="Alur kunjungan pertama">
      <div className="flow-head">
        <strong>Alur kunjungan pertama</strong>
        <span className="flow-who">{p ? `untuk ${p.name} (${p.rm})` : 'pasien baru — mulai dari registrasi'}</span>
        {mismatch && <button className="btn btn-sm btn-secondary" onClick={() => a.setActive(pid)}>Kembali ke {p?.name}</button>}
        {s.flow.active && !inline && <button className="btn btn-sm btn-quiet" onClick={a.stopFlow}>Tutup alur</button>}
      </div>
      <ol className="flow-steps">
        {steps.map((st, i) => {
          const here = path === st.path || (st.path === '/charting' && path === '/charting' && st.key === 'periksa')
          return (
            <li key={st.key} className={`${st.done ? 'done' : ''} ${i === nextIdx ? 'next' : ''} ${here ? 'here' : ''}`}>
              <button onClick={() => { if (pid && s.activeId !== pid) a.setActive(pid); go(st.path) }} aria-current={here ? 'step' : undefined}>
                <span className="flow-dot">{st.done ? <Icon name="check" size={16} /> : i + 1}</span>
                <span className="flow-label"><strong>{st.label}</strong><small>{st.module}</small></span>
              </button>
            </li>
          )
        })}
      </ol>
      {nextIdx === -1 && <Badge tone="success" icon="check">Semua langkah selesai</Badge>}
    </div>
  )
}

export function Toast() {
  const { s, a } = useStore()
  return (
    <div className="toast-wrap" aria-live="polite">
      {s.toast && (
        <div className="toast">
          <span>{s.toast}</span>
          {s.toastAction && <button type="button" className="toast-undo" onClick={a.runToastAction}>{s.toastAction}</button>}
        </div>
      )}
    </div>
  )
}

export function NoPatient({ module }: { module: string }) {
  const { a } = useStore()
  return (
    <div className="empty">
      <Icon name="user" size={40} />
      <h2>Pilih pasien aktif untuk membuka {module}</h2>
      <p>Modul ini selalu menampilkan pasien yang dipilih di bilah atas.</p>
      <div className="row gap"><button className="btn btn-primary" onClick={() => a.openSelector(true)}><Icon name="search" size={18} />Cari pasien</button><a className="btn btn-secondary" href="#/keluarga/baru"><Icon name="plus" size={18} />Pasien baru</a></div>
    </div>
  )
}
