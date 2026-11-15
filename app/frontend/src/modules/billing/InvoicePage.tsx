import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import type { Me } from '../../shared/session'
import { addAdjustment, addPayment, decideAdjustment, invoiceForVisit, paymentAccounts, type Adjustment, type Invoice, type PaymentAccount } from './api'

const rp = (n: number) => 'Rp' + n.toLocaleString('id-ID')
const KIND: Record<PaymentAccount['kind'], string> = { tunai: 'Tunai', qris: 'QRIS', edc: 'EDC', transfer: 'Transfer' }
const accountLabel = (a: Pick<PaymentAccount, 'name' | 'kind' | 'bank_name' | 'account_last4'>) =>
  `${a.name} (${KIND[a.kind]}${a.bank_name ? ' ' + a.bank_name : ''}${a.account_last4 ? ' ··' + a.account_last4 : ''})`
type PayRow = { account: string; amount: string; key: string }
const newRow = (amount = ''): PayRow => ({ account: '', amount, key: crypto.randomUUID() })
const STATUS: Record<Adjustment['status'], string> = { applied: 'Berlaku', pending: 'Menunggu pemilik', approved: 'Disetujui', rejected: 'Ditolak' }

// Minimal invoice view (unit 4): lines, adjustments, a Rp0 / 100% discount waits for the owner's approve/reject. Kasir screens: UI unit.
export default function InvoicePage({ visitId, me }: { visitId: string; me: Me }) {
  const [inv, setInv] = useState<Invoice | null>(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ kind: 'discount', amount: '', reason: '' })
  const [accounts, setAccounts] = useState<PaymentAccount[]>([])
  const [rows, setRows] = useState<PayRow[]>([newRow()])
  const can = (p: string) => me.permissions.includes(p)

  const load = useCallback(() => invoiceForVisit(visitId).then(setInv, (e) => setError(e instanceof ApiError && e.status === 404 ? 'Belum ada tagihan untuk kunjungan ini.' : errorText(e))), [visitId])
  useEffect(() => { load() }, [load])
  useEffect(() => { paymentAccounts().then(setAccounts, () => setAccounts([])) }, [])

  async function run(fn: () => Promise<Invoice>, ok: (i: Invoice) => string) {
    setError('')
    setMsg('')
    try {
      const i = await fn()
      setInv(i)
      setMsg(ok(i))
    } catch (e) {
      setError(e instanceof ApiError && [403, 409, 422].includes(e.status) && e.data?.message ? e.data.message : errorText(e))
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!inv) return
    run(() => addAdjustment(inv.id, { kind: form.kind, amount_rp: Number(form.amount), reason: form.reason.trim() }),
      (i) => i.adjustments.at(-1)?.status === 'pending' ? 'Saldo menjadi Rp0: menunggu persetujuan pemilik.' : 'Penyesuaian tersimpan.')
  }

  // Unit 5: money goes only into a clinic account (no rekening field). Split = one POST per row, stops at the first error.
  function pay(e: FormEvent) {
    e.preventDefault()
    if (!inv) return
    run(async () => {
      let i = inv
      for (const r of rows) {
        i = await addPayment(inv.id, { payment_account_id: r.account, amount_rp: Number(r.amount), request_key: r.key })
        setInv(i)
      }
      setRows([newRow()])
      return i
    }, (i) => i.status === 'lunas' ? 'Pembayaran diterima. Tagihan lunas.' : 'Pembayaran diterima.')
  }

  if (!inv) return <div className="card state-card">{error || 'Memuat tagihan…'}</div>
  return (
    <>
      <div className="page-head"><div><h1>Tagihan</h1><p className="muted small">Saldo {rp(inv.balance_rp)} · baris {rp(inv.lines_rp)} · penyesuaian {rp(inv.adjustments_rp)} · dibayar {rp(inv.payments_rp)} · {inv.status === 'lunas' ? 'Lunas' : 'Terbuka'}</p></div></div>
      {msg && <p className="notice" role="status">{msg}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="card">
        <h2>Tindakan</h2>
        <ul>{inv.lines.map((l) => <li key={l.id}>{l.procedure_code} {l.procedure_name}{l.tooth ? ` · gigi ${l.tooth}` : ''} · {rp(l.price_rp)}</li>)}</ul>
      </div>
      <div className="card">
        <h2>Penyesuaian</h2>
        <ul>
          {inv.adjustments.map((a) => (
            <li key={a.id}>
              {a.kind} {rp(a.amount_rp)} · {a.reason} · <strong>{STATUS[a.status]}</strong>{a.self_approved_sole_owner && ' (disetujui sendiri)'}
              {a.status === 'pending' && can('billing.approve_zero') && (
                <span className="toolbar">
                  <button className="btn btn-xs" onClick={() => run(() => decideAdjustment(a.id, 'approve'), () => 'Disetujui.')}>Setujui</button>
                  <button className="btn btn-xs" onClick={() => run(() => decideAdjustment(a.id, 'reject'), () => 'Ditolak.')}>Tolak</button>
                </span>
              )}
            </li>
          ))}
        </ul>
        {can('billing.adjust') && (
          <form onSubmit={submit} className="toolbar">
            <select aria-label="Jenis" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="discount">Diskon</option><option value="write_off">Penghapusan</option><option value="correction">Koreksi</option>
            </select>
            <input aria-label="Jumlah (Rp)" type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <input aria-label="Alasan" required minLength={5} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            <button className="btn btn-primary">Simpan</button>
          </form>
        )}
      </div>
      <div className="card">
        <h2>Pembayaran</h2>
        <ul>{inv.payments.map((p) => <li key={p.id}>{accountLabel(p.account)} · {rp(p.amount_rp)}</li>)}</ul>
        {can('billing.adjust') && inv.balance_rp > 0 && (
          <form onSubmit={pay}>
            <p className="muted small">Hanya metode milik klinik. Transfer hanya ke rekening klinik.</p>
            {rows.map((r, n) => (
              <div className="toolbar" key={r.key}>
                <select aria-label={`Metode ${n + 1}`} required value={r.account} onChange={(e) => setRows(rows.map((x) => x === r ? { ...x, account: e.target.value } : x))}>
                  <option value="">Pilih akun klinik…</option>
                  {accounts.filter((a) => a.is_active && (a.branch_id === null || a.branch_id === inv.branch_id)).map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
                </select>
                <input aria-label={`Jumlah ${n + 1} (Rp)`} type="number" min={1} required value={r.amount} onChange={(e) => setRows(rows.map((x) => x === r ? { ...x, amount: e.target.value } : x))} />
                {rows.length > 1 && <button type="button" className="btn btn-xs" onClick={() => setRows(rows.filter((x) => x !== r))}>Hapus</button>}
              </div>
            ))}
            <p className="muted small">Total {rp(rows.reduce((t, r) => t + Number(r.amount || 0), 0))} dari sisa {rp(inv.balance_rp)}</p>
            <div className="toolbar">
              <button type="button" className="btn" onClick={() => setRows([...rows, newRow()])}>Tambah metode (split)</button>
              <button className="btn btn-primary">Terima pembayaran</button>
            </div>
          </form>
        )}
      </div>
    </>
  )
}
