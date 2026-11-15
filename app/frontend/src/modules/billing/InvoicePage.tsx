import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import { fmtDateTime, rp } from '../../shared/format'
import type { Me } from '../../shared/session'
import { addAdjustment, addCreditNote, addPayment, addRefund, approveZeroTariff, billFromCorrection, decideAdjustment, decideCreditNote, decideRefund, decideVoid, invoiceForVisit,
  paymentAccounts, reviewCorrection, voidInvoice, type Adjustment, type Invoice, type InvoiceLine, type PaymentAccount } from './api'
import './billing.css'

const KIND: Record<PaymentAccount['kind'], string> = { tunai: 'Tunai', qris: 'QRIS', edc: 'EDC', transfer: 'Transfer' }
const accountLabel = (a: Pick<PaymentAccount, 'name' | 'kind' | 'bank_name' | 'account_last4'>) =>
  `${a.name} (${KIND[a.kind]}${a.bank_name ? ' ' + a.bank_name : ''}${a.account_last4 ? ' ··' + a.account_last4 : ''})`
type PayRow = { account: string; amount: string; key: string }
const newRow = (amount = ''): PayRow => ({ account: '', amount, key: crypto.randomUUID() })
const STATUS: Record<Adjustment['status'], string> = { applied: 'Berlaku', pending: 'Menunggu pemilik', approved: 'Disetujui', rejected: 'Ditolak' }
const INV_STATUS: Record<Invoice['status'], string> = { terbuka: 'Terbuka', lunas: 'Lunas', void: 'Dibatalkan (void)' }
const REASON: Record<string, string> = { tidak_dikerjakan: 'Tidak dikerjakan', salah_kode: 'Salah kode', salah_situs: 'Salah gigi/permukaan',
  salah_provider: 'Salah dokter', salah_tarif: 'Salah tarif', lainnya: 'Lainnya' }
type RefundForm = { payment: string; note: string; amount: string; reason: string }
const REFUND_STATUS = { pending: 'Menunggu persetujuan pemilik', approved: 'Disetujui', rejected: 'Ditolak' }
type LineForm = { line: InvoiceLine; mode: 'credit' | 'review'; amount: string; type: string; reason: string; correction: string | null; reviewId: string }

// Minimal invoice view (unit 4): lines, adjustments, a Rp0 / 100% discount waits for the owner's approve/reject. Kasir screens: UI unit.
// Unit B: Nota kredit per line, void (unpaid only), lines flagged by a clinical correction, Rp0 tariff anomaly. Discounts are not for fixing procedures.
// Unit C: overpayment after a credit note ("kelebihan bayar") -> refund to the original payment account, owner approves.
export default function InvoicePage({ visitId, me }: { visitId: string; me: Me }) {
  const [inv, setInv] = useState<Invoice | null>(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ kind: 'discount', amount: '', reason: '' })
  const [accounts, setAccounts] = useState<PaymentAccount[]>([])
  const [rows, setRows] = useState<PayRow[]>([newRow()])
  const [lineForm, setLineForm] = useState<LineForm | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [refund, setRefund] = useState<RefundForm | null>(null)
  const [receipt, setReceipt] = useState(false)
  const can = (p: string) => me.permissions.includes(p)

  const load = useCallback(() => invoiceForVisit(visitId).then(setInv, (e) => setError(e instanceof ApiError && e.status === 404 ? 'Belum ada tagihan untuk kunjungan ini.' : errorText(e))), [visitId])
  useEffect(() => { load() }, [load])
  useEffect(() => { paymentAccounts().then(setAccounts, () => setAccounts([])) }, [])
  // #70: the single, untouched payment row starts at the remaining balance (no typing for the usual full payment; still editable).
  const balance = inv && inv.status !== 'void' ? inv.balance_rp : 0
  useEffect(() => { if (balance > 0) setRows((rs) => rs.length === 1 && rs[0].amount === '' ? [{ ...rs[0], amount: String(balance) }] : rs) }, [balance])

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

  // Unit B: a financial correction is its own document (Nota Kredit), never a Rp0 line or a 100% discount.
  function openCredit(l: InvoiceLine) {
    const open = l.correction_reviews.find((r) => r.status === 'perlu_tinjau')
    setLineForm({ line: l, mode: 'credit', amount: String(l.price_rp - l.credited_rp), type: open?.reason_type ?? 'salah_tarif', reason: '',
      correction: open?.procedure_correction_id ?? null, reviewId: open?.id ?? '' })
  }
  function submitLine(e: FormEvent) {
    e.preventDefault()
    if (!inv || !lineForm) return
    const f = lineForm
    if (f.mode === 'review') {
      return run(() => reviewCorrection(f.reviewId, f.reason.trim()), () => { setLineForm(null); return 'Ditandai sudah ditinjau.' })
    }
    run(() => addCreditNote(inv.id, { invoice_line_id: f.line.id, amount_rp: Number(f.amount), reason_type: f.type, reason: f.reason.trim(),
      procedure_correction_id: f.correction }), (i) => {
      setLineForm(null)
      const n = i.credit_notes.at(-1)
      return n?.status === 'pending' ? `${n.number} dibuat: nota kredit penuh menunggu persetujuan pemilik.` : `${n?.number ?? 'Nota kredit'} berlaku.`
    })
  }
  function submitVoid(e: FormEvent) {
    e.preventDefault()
    if (!inv) return
    run(() => voidInvoice(inv.id, voidReason.trim()), (i) => { setVoidReason(''); return i.status === 'void' ? 'Tagihan dibatalkan (void).' : 'Pembatalan menunggu persetujuan pemilik.' })
  }

  // Unit C: refund goes back to the original payment's account (locked), allocated to an applied credit note; the owner approves.
  const refunds = inv?.refunds ?? []
  const overpaidLeft = (inv?.overpaid_rp ?? 0) - refunds.filter((r) => r.status === 'pending').reduce((t, r) => t + r.amount_rp, 0)
  const refundNotes = (inv?.credit_notes ?? []).filter((n) => ['applied', 'approved'].includes(n.status) && n.amount_rp - (n.refunded_rp ?? 0) > 0)
  const refundPays = (inv?.payments ?? []).filter((p) => p.amount_rp - (p.refunded_rp ?? 0) > 0)
  const refundMax = (payId: string, noteId: string) => {
    const p = refundPays.find((x) => x.id === payId)
    const n = refundNotes.find((x) => x.id === noteId)
    return Math.max(0, Math.min(overpaidLeft, p ? p.amount_rp - (p.refunded_rp ?? 0) : 0, n ? n.amount_rp - (n.refunded_rp ?? 0) : 0))
  }
  const setRefundPick = (f: RefundForm) => setRefund({ ...f, amount: String(refundMax(f.payment, f.note)) })
  function submitRefund(e: FormEvent) {
    e.preventDefault()
    if (!inv || !refund) return
    run(() => addRefund(inv.id, { payment_id: refund.payment, credit_note_id: refund.note, amount_rp: Number(refund.amount), reason: refund.reason.trim() }),
      () => { setRefund(null); return 'Refund diajukan: menunggu persetujuan pemilik.' })
  }

  if (!inv) return <div className="card state-card">{error || 'Memuat tagihan…'}</div>
  return (
    <>
      <div className="page-head"><div><h1>Tagihan{inv.patient_name ? ` · ${inv.patient_name}` : ''}</h1><p className="muted small">Saldo {rp(inv.balance_rp)} · baris {rp(inv.lines_rp)} · penyesuaian {rp(inv.adjustments_rp)} · nota kredit {rp(inv.credit_notes_rp ?? 0)} · dibayar {rp(inv.payments_rp)}{(inv.refunds_rp ?? 0) > 0 && ` · refund ${rp(inv.refunds_rp)}`} · {INV_STATUS[inv.status]}</p></div></div>
      {msg && <p className="notice" role="status">{msg}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {inv.payments.length > 0 && inv.status !== 'void' && (receipt ? <Kwitansi inv={inv} me={me} onClose={() => setReceipt(false)} />
        : <p className="kwitansi-actions"><button className="btn" onClick={() => setReceipt(true)}>Kwitansi</button>
          <a className="btn btn-ghost" href="#/kasir">Kembali ke Kasir</a></p>)}
      <div className="card inv-pay">
        <h2>Pembayaran</h2>
        <ul>{inv.payments.map((p) => <li key={p.id}>{accountLabel(p.account)} · {rp(p.amount_rp)}{(p.refunded_rp ?? 0) > 0 && ` · direfund ${rp(p.refunded_rp)}`}</li>)}</ul>
        {(inv.overpaid_rp ?? 0) > 0 && (
          <p className="notice" role="note">Kelebihan bayar {rp(inv.overpaid_rp)} — buat refund
            {can('billing.adjust') && !refund && overpaidLeft > 0 && refundNotes.length > 0 && refundPays.length > 0 && (
              <> <button className="btn btn-xs" onClick={() => setRefundPick({ payment: refundPays[0].id, note: refundNotes[0].id, amount: '', reason: '' })}>Refund</button></>
            )}
          </p>
        )}
        {refund && (
          <form onSubmit={submitRefund} className="toolbar" aria-label="Form refund">
            <select aria-label="Pembayaran asal" value={refund.payment} onChange={(e) => setRefundPick({ ...refund, payment: e.target.value })}>
              {refundPays.map((p) => <option key={p.id} value={p.id}>{accountLabel(p.account)} · {rp(p.amount_rp)}</option>)}
            </select>
            <input aria-label="Akun refund" disabled value={accountLabel(refundPays.find((p) => p.id === refund.payment)?.account ?? inv.payments[0].account)} />
            <select aria-label="Nota kredit refund" value={refund.note} onChange={(e) => setRefundPick({ ...refund, note: e.target.value })}>
              {refundNotes.map((n) => <option key={n.id} value={n.id}>{n.number} · {rp(n.amount_rp)}</option>)}
            </select>
            <input aria-label="Jumlah refund (Rp)" type="number" min={1} max={refundMax(refund.payment, refund.note)} required value={refund.amount}
              onChange={(e) => setRefund({ ...refund, amount: e.target.value })} />
            <input aria-label="Alasan refund" required minLength={10} value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} />
            <button className="btn">Ajukan refund</button>
            <button type="button" className="btn btn-ghost" onClick={() => setRefund(null)}>Batal</button>
            <span className="muted small">Refund hanya ke akun pembayaran asal dan menunggu persetujuan pemilik.</span>
          </form>
        )}
        {refunds.length > 0 && (
          <ul aria-label="Refund">
            {refunds.map((r) => (
              <li key={r.id}>
                Refund {rp(r.amount_rp)} · {accountLabel(inv.payments.find((p) => p.id === r.payment_id)?.account ?? { name: 'Akun asal', kind: r.method, bank_name: null, account_last4: null })}
                {' '}· {r.reason} · <strong>{REFUND_STATUS[r.status]}</strong>{r.self_approved_sole_owner && ' (disetujui sendiri)'}
                {r.status === 'pending' && can('billing.approve_reversal') && (
                  <span className="toolbar">
                    <button className="btn btn-xs" onClick={() => run(() => decideRefund(r.id, 'approve'), () => 'Refund disetujui.')}>Setujui</button>
                    <button className="btn btn-xs" onClick={() => run(() => decideRefund(r.id, 'reject'), () => 'Refund ditolak.')}>Tolak</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
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
            <div className="toolbar pay-submit">
              <button type="button" className="btn" onClick={() => setRows([...rows, newRow()])}>Tambah metode (split)</button>
              <button className="btn btn-primary">Terima pembayaran</button>
            </div>
          </form>
        )}
      </div>
      <div className="card">
        <h2>Tindakan</h2>
        <ul>
          {inv.lines.map((l) => (
            <li key={l.id}>
              {l.procedure_code} {l.procedure_name}{l.tooth ? ` · gigi ${l.tooth}` : ''} · {rp(l.price_rp)}
              {(l.credit_note_numbers ?? []).length > 0 && <> · <strong>Dikoreksi — lihat {l.credit_note_numbers.join(', ')}</strong></>}
              {l.tariff_zero === 'pending' && <> · <strong>Tarif Rp0 — menunggu pemilik</strong></>}
              {l.tariff_zero === 'pending' && can('billing.approve_zero') && (
                <> <button className="btn btn-xs" onClick={() => run(() => approveZeroTariff(l.id), () => 'Tarif Rp0 disetujui.')}>Setujui tarif Rp0</button></>
              )}
              {(l.correction_reviews ?? []).filter((r) => r.status === 'perlu_tinjau').map((r) => (
                <span key={r.id}> · <strong>Perlu tinjau koreksi ({REASON[r.reason_type] ?? r.reason_type})</strong>
                  {can('billing.adjust') && inv.status !== 'void' && <>
                    {r.billable_code && <> <button className="btn btn-xs" onClick={() => run(() => billFromCorrection(inv.id, r.procedure_correction_id), () => 'Kode yang benar ditagih; baris lama tetap.')}>Tagih kode yang benar</button></>}
                    {' '}<button className="btn btn-xs btn-ghost" onClick={() => setLineForm({ line: l, mode: 'review', amount: '', type: '', reason: '', correction: null, reviewId: r.id })}>Tandai ditinjau</button>
                  </>}
                </span>
              ))}
              {can('billing.adjust') && inv.status !== 'void' && l.price_rp - (l.credited_rp ?? 0) > 0 && (
                <> <button className="btn btn-xs" onClick={() => openCredit(l)}>Nota kredit</button></>
              )}
            </li>
          ))}
        </ul>
        {lineForm && (
          <form onSubmit={submitLine} className="toolbar" aria-label={lineForm.mode === 'credit' ? 'Form nota kredit' : 'Form tinjau koreksi'}>
            <span className="small">{lineForm.line.procedure_code} {lineForm.line.procedure_name}</span>
            {lineForm.mode === 'credit' && <>
              <input aria-label="Jumlah nota kredit (Rp)" type="number" min={1} required value={lineForm.amount} onChange={(e) => setLineForm({ ...lineForm, amount: e.target.value })} />
              <select aria-label="Jenis koreksi" value={lineForm.type} onChange={(e) => setLineForm({ ...lineForm, type: e.target.value })}>
                {Object.entries(REASON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </>}
            <input aria-label="Alasan koreksi" required minLength={5} value={lineForm.reason} onChange={(e) => setLineForm({ ...lineForm, reason: e.target.value })} />
            <button className="btn">{lineForm.mode === 'credit' ? 'Buat nota kredit' : 'Simpan'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setLineForm(null)}>Batal</button>
            {lineForm.mode === 'credit' && <span className="muted small">Penuh (sisa baris) menunggu persetujuan pemilik.</span>}
          </form>
        )}
      </div>
      {/* #70: one primary per page (Terima pembayaran); corrections fold under "Lainnya". */}
      <details className="card inv-more">
        <summary>Lainnya: penyesuaian, nota kredit, void</summary>
        {(inv.credit_notes ?? []).length > 0 && (
          <div className="card">
            <h2>Nota kredit</h2>
            <ul>
              {inv.credit_notes.map((n) => (
                <li key={n.id}>
                  <strong>{n.number}</strong> · {rp(n.amount_rp)} · {n.is_full ? 'penuh' : 'sebagian'} · {REASON[n.reason_type] ?? n.reason_type} · {n.reason}
                  {' '}· <strong>{n.status === 'pending' ? 'Menunggu persetujuan' : n.status === 'rejected' ? 'Ditolak' : 'Disetujui'}</strong>{n.self_approved_sole_owner && ' (disetujui sendiri)'}
                  {n.status === 'pending' && can('billing.approve_reversal') && (
                    <span className="toolbar">
                      <button className="btn btn-xs" onClick={() => run(() => decideCreditNote(n.id, 'approve'), () => `${n.number} disetujui.`)}>Setujui</button>
                      <button className="btn btn-xs" onClick={() => run(() => decideCreditNote(n.id, 'reject'), () => `${n.number} ditolak.`)}>Tolak</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
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
                <option value="discount">Diskon</option><option value="write_off">Penghapusan</option>
              </select>
              <input aria-label="Jumlah (Rp)" type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              <input aria-label="Alasan" required minLength={5} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              <button className="btn">Simpan</button>
            </form>
          )}
        </div>
        {((inv.voids ?? []).length > 0 || (can('billing.adjust') && inv.status !== 'void' && inv.payments.length === 0)) && (
          <div className="card">
            <h2>Void tagihan</h2>
            <ul>
              {(inv.voids ?? []).map((v) => (
                <li key={v.id}>{v.reason} · <strong>{v.status === 'pending' ? 'Menunggu persetujuan' : v.status === 'rejected' ? 'Ditolak' : 'Dibatalkan (void)'}</strong>
                  {v.status === 'pending' && can('billing.approve_reversal') && (
                    <span className="toolbar">
                      <button className="btn btn-xs" onClick={() => run(() => decideVoid(v.id, 'approve'), () => 'Tagihan dibatalkan (void).')}>Setujui</button>
                      <button className="btn btn-xs" onClick={() => run(() => decideVoid(v.id, 'reject'), () => 'Pembatalan ditolak.')}>Tolak</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {can('billing.adjust') && inv.status !== 'void' && inv.payments.length === 0 && !(inv.voids ?? []).some((v) => v.status === 'pending') && (
              <form onSubmit={submitVoid} className="toolbar">
                <input aria-label="Alasan void" required minLength={10} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
                <button className="btn">Void tagihan</button>
                <span className="muted small">Hanya tagihan tanpa pembayaran. Sudah dibayar: pakai nota kredit lalu refund.</span>
              </form>
            )}
          </div>
        )}
      </details>
    </>
  )
}

/**
 * Kwitansi (#69): a printable receipt of the money received on this invoice. Minimal: clinic + branch, patient, lines, deductions,
 * payments, balance; no own number series (the reference is the invoice id) and no tax lines. Print = the browser's print dialog,
 * the rest of the page is hidden by @media print in billing.css.
 */
export function Kwitansi({ inv, me, onClose }: { inv: Invoice; me: Me; onClose: () => void }) {
  const deductions = inv.adjustments_rp + (inv.credit_notes_rp ?? 0)
  const lastPaid = inv.payments.map((p) => p.paid_at).sort().at(-1)
  return (
    <section className="card kwitansi" aria-label="Kwitansi">
      <div className="kwitansi-head">
        <div>
          <h2>KWITANSI</h2>
          <p className="muted small">{me.active.tenant_name}{me.active.branch_name ? ` · ${me.active.branch_name}` : ''}</p>
        </div>
        {inv.status === 'lunas' && <span className="kwitansi-stamp">LUNAS</span>}
      </div>
      <p>Telah diterima dari <strong>{inv.patient_name ?? 'Pasien'}</strong>{lastPaid && <> pada {fmtDateTime(lastPaid)}</>}.</p>
      <table>
        <tbody>
          {inv.lines.map((l) => <tr key={l.id}><td>{l.procedure_name}{l.tooth ? ` · gigi ${l.tooth}` : ''}</td><td>{rp(l.price_rp)}</td></tr>)}
          {deductions !== 0 && <tr><td>Penyesuaian / nota kredit</td><td>-{rp(deductions)}</td></tr>}
          <tr className="sum"><td>Total tagihan</td><td>{rp(inv.lines_rp - deductions)}</td></tr>
          {inv.payments.map((p) => <tr key={p.id}><td>Dibayar · {p.account.name} · {fmtDateTime(p.paid_at)}</td><td>{rp(p.amount_rp)}</td></tr>)}
          {(inv.refunds_rp ?? 0) > 0 && <tr><td>Refund</td><td>-{rp(inv.refunds_rp)}</td></tr>}
          <tr className="sum"><td>Sisa</td><td>{rp(Math.max(0, inv.balance_rp))}</td></tr>
        </tbody>
      </table>
      <p className="muted small">Ref. tagihan {inv.id.slice(0, 8).toUpperCase()} · dicetak oleh {me.user.name}</p>
      <div className="kwitansi-actions">
        <button className="btn btn-primary" onClick={() => window.print()}>Cetak</button>
        <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
      </div>
    </section>
  )
}
