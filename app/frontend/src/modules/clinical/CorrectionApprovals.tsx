import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { errorText } from '../../shared/api/http'
import { fmtDateTime } from '../../shared/format'
import { decideCorrection, getClinicSettings, pendingCorrections, saveClinicSettings, type PendingCorrection } from './api'
import { CORRECTION_LABEL, procedureText } from './legend'

/** Owner: procedure corrections waiting for approval (outside the clinic window) + the window setting (hours). Minimal; UI unit polishes. */
export function CorrectionApprovals() {
  const [rows, setRows] = useState<PendingCorrection[] | null>(null)
  const [hours, setHours] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const load = useCallback(() => { pendingCorrections().then(setRows, (e) => setError(errorText(e))) }, [])
  useEffect(() => {
    load()
    getClinicSettings().then((s) => setHours(String(s.correction_window_hours)), (e) => setError(errorText(e)))
  }, [load])

  async function save(e: FormEvent) {
    e.preventDefault()
    const n = Number(hours)
    if (!Number.isInteger(n) || n < 1 || n > 720) return setError('Tenggat koreksi 1–720 jam.')
    try { await saveClinicSettings({ correction_window_hours: n }); setError(''); setMsg('Tenggat koreksi tersimpan.') } catch (err) { setError(errorText(err)) }
  }
  async function decide(id: string, d: 'approve' | 'reject') {
    try { await decideCorrection(id, d); setError(''); setMsg(d === 'approve' ? 'Koreksi disetujui dan diterapkan.' : 'Koreksi ditolak; catatan tidak berubah.'); load() } catch (err) { setError(errorText(err)) }
  }

  return (
    <div className="card">
      <h2>Koreksi tindakan menunggu persetujuan</h2>
      <form className="toolbar" onSubmit={save} noValidate>
        <label>Tenggat koreksi bebas (jam) <input type="number" min={1} max={720} value={hours} onChange={(e) => setHours(e.target.value)} /></label>
        <button className="btn btn-xs">Simpan</button>
      </form>
      <p className="muted small">Bawaan 48 jam (2×24 jam) sejak tindakan difinalkan. Dasar hukum untuk data klinis perlu dicek.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {msg && <p className="small" role="status">{msg}</p>}
      {rows && rows.length === 0 && <p className="muted">Tidak ada koreksi yang menunggu.</p>}
      <ul aria-label="Koreksi menunggu">
        {rows?.map((c) => (
          <li key={c.id}>
            <strong>{CORRECTION_LABEL[c.reason_type]}</strong> · {procedureText(c.procedure)}
            {c.proposed?.procedure_code && <> → kode {c.proposed.procedure_code}</>}
            {c.proposed?.surfaces !== undefined && <> → permukaan {c.proposed.surfaces || 'seluruh gigi'}</>}
            {' '}· {c.requested_by.name ?? '—'} · {fmtDateTime(c.created_at)} WIB · Alasan: {c.reason}
            {' '}<button className="btn btn-xs" onClick={() => decide(c.id, 'approve')}>Setujui</button>
            {' '}<button className="btn btn-xs btn-ghost" onClick={() => decide(c.id, 'reject')}>Tolak</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
