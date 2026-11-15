import { useCallback, useEffect, useState } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import { fmtDateTime, rp } from '../../shared/format'
import { decideCreditNote, decideRefund, decideVoid, pendingReversals, type PendingReversals } from './api'


/** Owner (billing.approve_reversal): full credit notes, voids and refunds waiting for approval. Minimal; UI unit polishes. */
export function ReversalApprovals() {
  const [data, setData] = useState<PendingReversals | null>(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const load = useCallback(() => { pendingReversals().then(setData, (e) => setError(errorText(e))) }, [])
  useEffect(() => { load() }, [load])

  async function decide(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); setError(''); setMsg(ok); load() } catch (e) {
      setError(e instanceof ApiError && e.data?.message ? e.data.message : errorText(e))
    }
  }

  const empty = data && data.credit_notes.length === 0 && data.voids.length === 0 && (data.refunds ?? []).length === 0
  return (
    <div className="card">
      <h2>Nota kredit, pembatalan tagihan & refund menunggu persetujuan</h2>
      {error && <p className="form-error" role="alert">{error}{!data && <> <button type="button" className="btn" onClick={() => { setError(''); load() }}>Coba lagi</button></>}</p>}
      {!data && !error && <p className="muted">Memuat…</p>}
      {msg && <p className="small" role="status">{msg}</p>}
      {empty && <p className="muted">Tidak ada yang menunggu.</p>}
      <ul aria-label="Pembalikan menunggu">
        {data?.credit_notes.map((n) => (
          <li key={n.id}>
            <strong>{n.number}</strong> · {n.line.procedure_code} {n.line.procedure_name}{n.line.tooth ? ` · gigi ${n.line.tooth}` : ''} · {rp(n.amount_rp)}
            {' '}· {n.reason} · {fmtDateTime(n.created_at)} WIB · <a href={`#/tagihan/${n.visit_id}`}>Buka tagihan</a>
            {' '}<button className="btn btn-xs" onClick={() => decide(() => decideCreditNote(n.id, 'approve'), `${n.number} disetujui.`)}>Setujui</button>
            {' '}<button className="btn btn-xs btn-ghost" onClick={() => decide(() => decideCreditNote(n.id, 'reject'), `${n.number} ditolak.`)}>Tolak</button>
          </li>
        ))}
        {data?.voids.map((v) => (
          <li key={v.id}>
            <strong>Void tagihan</strong> · {v.reason} · {fmtDateTime(v.created_at)} WIB · <a href={`#/tagihan/${v.visit_id}`}>Buka tagihan</a>
            {' '}<button className="btn btn-xs" onClick={() => decide(() => decideVoid(v.id, 'approve'), 'Tagihan dibatalkan (void).')}>Setujui</button>
            {' '}<button className="btn btn-xs btn-ghost" onClick={() => decide(() => decideVoid(v.id, 'reject'), 'Pembatalan ditolak.')}>Tolak</button>
          </li>
        ))}
        {data?.refunds?.map((r) => (
          <li key={r.id}>
            <strong>Refund</strong> {rp(r.amount_rp)} ke {r.account?.name ?? 'akun asal'}{r.credit_note_number ? ` · ${r.credit_note_number}` : ''} · {r.reason}
            {' '}· {fmtDateTime(r.created_at)} WIB · <a href={`#/tagihan/${r.visit_id}`}>Buka tagihan</a>
            {' '}<button className="btn btn-xs" onClick={() => decide(() => decideRefund(r.id, 'approve'), 'Refund disetujui.')}>Setujui</button>
            {' '}<button className="btn btn-xs btn-ghost" onClick={() => decide(() => decideRefund(r.id, 'reject'), 'Refund ditolak.')}>Tolak</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
