import { useCallback, useEffect, useState } from 'react'
import { errorText } from '../../shared/api/http'
import { fmtDateTime } from '../../shared/format'
import { decideCorrection, pendingCorrections, type PendingCorrection } from './api'
import { CORRECTION_LABEL, procedureText } from './legend'

/** Owner: procedure corrections waiting for approval (outside the clinic window). The window itself is set on Pengaturan RM (#55). */
export function CorrectionApprovals() {
  const [rows, setRows] = useState<PendingCorrection[] | null>(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const load = useCallback(() => { pendingCorrections().then(setRows, (e) => setError(errorText(e))) }, [])
  useEffect(load, [load])

  async function decide(id: string, d: 'approve' | 'reject') {
    try { await decideCorrection(id, d); setError(''); setMsg(d === 'approve' ? 'Koreksi disetujui dan diterapkan.' : 'Koreksi ditolak; catatan tidak berubah.'); load() } catch (err) { setError(errorText(err)) }
  }

  return (
    <div className="card">
      <h2>Koreksi tindakan menunggu persetujuan</h2>
      <p className="muted small">Koreksi lewat tenggat bebas menunggu di sini. Tenggat diatur di <a href="#/pengaturan-rm">Pengaturan RM</a>.</p>
      {error && <p className="form-error" role="alert">{error}{!rows && <> <button type="button" className="btn" onClick={() => { setError(''); load() }}>Coba lagi</button></>}</p>}
      {!rows && !error && <p className="muted">Memuat…</p>}
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
