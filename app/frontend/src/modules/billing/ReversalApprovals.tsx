import { useCallback, useEffect, useState } from 'react'
import { Button, Card } from '@heroui/react'
import { ApiError, errorText } from '../../shared/api/http'
import { fmtDateTime, rp } from '../../shared/format'
import { decideCreditNote, decideRefund, decideVoid, pendingReversals, type PendingReversals } from './api'
import { Note } from './ui'

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
    <Card className="billing">
      <h2>Nota kredit, pembatalan tagihan & refund menunggu persetujuan</h2>
      {error && <Note status="danger" role="alert">{error}{!data && <> <Button size="sm" variant="secondary" onPress={() => { setError(''); load() }}>Coba lagi</Button></>}</Note>}
      {!data && !error && <p className="text-muted">Memuat…</p>}
      {msg && <p className="text-sm" role="status">{msg}</p>}
      {empty && <p className="text-muted">Tidak ada yang menunggu.</p>}
      <ul aria-label="Pembalikan menunggu" className="m-0 flex list-none flex-col gap-2 p-0">
        {data?.credit_notes.map((n) => (
          <li key={n.id} className="border-t border-separator pt-2">
            <strong>{n.number}</strong> · {n.line.procedure_code} {n.line.procedure_name}{n.line.tooth ? ` · gigi ${n.line.tooth}` : ''} · {rp(n.amount_rp)}
            {' '}· {n.reason} · {fmtDateTime(n.created_at)} WIB · <a href={`#/tagihan/${n.visit_id}`}>Buka tagihan</a>
            <span className="ml-1 inline-flex gap-2"><Button size="sm" variant="secondary" onPress={() => decide(() => decideCreditNote(n.id, 'approve'), `${n.number} disetujui.`)}>Setujui</Button>
            <Button size="sm" variant="ghost" onPress={() => decide(() => decideCreditNote(n.id, 'reject'), `${n.number} ditolak.`)}>Tolak</Button></span>
          </li>
        ))}
        {data?.voids.map((v) => (
          <li key={v.id} className="border-t border-separator pt-2">
            <strong>Void tagihan</strong> · {v.reason} · {fmtDateTime(v.created_at)} WIB · <a href={`#/tagihan/${v.visit_id}`}>Buka tagihan</a>
            <span className="ml-1 inline-flex gap-2"><Button size="sm" variant="secondary" onPress={() => decide(() => decideVoid(v.id, 'approve'), 'Tagihan dibatalkan (void).')}>Setujui</Button>
            <Button size="sm" variant="ghost" onPress={() => decide(() => decideVoid(v.id, 'reject'), 'Pembatalan ditolak.')}>Tolak</Button></span>
          </li>
        ))}
        {data?.refunds?.map((r) => (
          <li key={r.id} className="border-t border-separator pt-2">
            <strong>Refund</strong> {rp(r.amount_rp)} ke {r.account?.name ?? 'akun asal'}{r.credit_note_number ? ` · ${r.credit_note_number}` : ''} · {r.reason}
            {' '}· {fmtDateTime(r.created_at)} WIB · <a href={`#/tagihan/${r.visit_id}`}>Buka tagihan</a>
            <span className="ml-1 inline-flex gap-2"><Button size="sm" variant="secondary" onPress={() => decide(() => decideRefund(r.id, 'approve'), 'Refund disetujui.')}>Setujui</Button>
            <Button size="sm" variant="ghost" onPress={() => decide(() => decideRefund(r.id, 'reject'), 'Refund ditolak.')}>Tolak</Button></span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
