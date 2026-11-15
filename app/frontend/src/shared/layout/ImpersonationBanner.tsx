import { useState } from 'react'
import { api } from '../api/http'
import { fmtDateTime } from '../format'
import type { Me } from '../session'

// DEVIATIONS #61: always visible while a platform admin acts as a clinic admin. "Berhenti" ends it and goes to the platform page.
export function ImpersonationBanner({ me }: { me: Me }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const imp = me.impersonation
  if (!imp?.active) return null
  async function stop() {
    setBusy(true)
    try {
      await api('/api/platform/impersonate/stop', { method: 'POST' })
      location.hash = '/platform'
    } catch {
      setError('Gagal berhenti. Coba lagi.')
      setBusy(false)
    }
  }
  return (
    <div className="impersonation-banner" role="alert">
      <span>
        Anda masuk sebagai <strong>{me.user.name}</strong> (klinik <strong>{me.active.tenant_name}</strong>) oleh{' '}
        <strong>{imp.platform_admin_name}</strong> sejak {fmtDateTime(imp.started_at)} WIB
      </span>
      {error && <span className="form-error">{error}</span>}
      <button className="btn" onClick={stop} disabled={busy}>Berhenti</button>
    </div>
  )
}
