import { useState } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import { cancelAttendance, closeVisit } from './api'

// Unit 4: close the active visit. Completed work needs an invoice line (server says invoice_required). Only when attendance was
// cancelled (appointment batal/tidak datang, or walk-in "Batalkan kehadiran") may it close without one, with a reason.
export function CloseVisit({ visit, canBilling, onDone }: {
  visit: { id: string; appointment_id: string | null; attendance_cancelled_at?: string | null }; canBilling: boolean; onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<unknown>) {
    setError('')
    setBusy(true)
    try {
      await fn()
      onDone()
    } catch (e) {
      setError(e instanceof ApiError && [409, 422].includes(e.status) ? e.data?.message ?? 'Tidak bisa diproses.' : errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const walkIn = visit.appointment_id === null
  return (
    <div className="card">
      <div className="card-head"><h2>Tutup kunjungan</h2>{canBilling && <a className="btn btn-xs" href={`#/tagihan/${visit.id}`}>Lihat tagihan</a>}</div>
      <label>Alasan (wajib bila kehadiran dibatalkan)
        <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!error} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="toolbar">
        {walkIn && !visit.attendance_cancelled_at && (
          <button className="btn" disabled={busy} onClick={() => reason.trim().length < 10 ? setError('Isi alasan minimal 10 huruf.') : run(() => cancelAttendance(visit.id, reason.trim()))}>
            Batalkan kehadiran
          </button>
        )}
        <button className="btn btn-primary" disabled={busy} onClick={() => run(() => closeVisit(visit.id, reason.trim()))}>Tutup kunjungan</button>
      </div>
    </div>
  )
}
