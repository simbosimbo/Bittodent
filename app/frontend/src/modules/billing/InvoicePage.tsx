import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import { fmtDateTime, rp } from '../../shared/format'
import { PageSkeleton } from '../../shared/ui/Skeleton'
import { Kop, useLetterhead } from '../../shared/letterhead'
import type { Me } from '../../shared/session'
import { addAdjustment, addCreditNote, addPayment, addRefund, approveZeroTariff, billFromCorrection, decideAdjustment, decideCreditNote, decideRefund, decideVoid, invoiceForVisit,
  paymentAccounts, reviewCorrection, voidInvoice, type Adjustment, type Invoice, type InvoiceLine, type PaymentAccount } from './api'
import './billing.css'

const KIND: Record<PaymentAccount['kind'], string> = { tunai: 'Tunai', qris: 'QRIS', edc: 'Debit', transfer: 'Transfer', bpjs: 'BPJS', asuransi: 'Asuransi' }
/** KL03: six method cards (order + hint); a kind shows only when the clinic has an active account of it. BPJS/asuransi = claim as payment. */
const KIND_HINT: Record<PaymentAccount['kind'], string> = { tunai: 'Kembalian dihitung', qris: 'QR statis cabang', edc: 'Pilih bank', transfer: 'Pilih bank',
  bpjs: 'Klaim sebagai bayar', asuransi: 'Klaim sebagai bayar' }
const accountLabel = (a: Pick<PaymentAccount, 'name' | 'kind' | 'bank_name' | 'account_last4'>) =>
  `${a.name} (${KIND[a.kind]}${a.bank_name ? ' ' + a.bank_name : ''}${a.account_last4 ? ' ··' + a.account_last4 : ''})`
/** Short chip label (#70): "Tunai", "QRIS", "EDC BCA", "Transfer BCA"; the full account sits in the tooltip. */
const chipLabel = (a: PaymentAccount) => `${KIND[a.kind]}${a.bank_name ? ' ' + a.bank_name : ''}`
const INV_CHIP: Record<Invoice['status'], [string, string]> = { terbuka: ['Belum lunas', 'unpaid'], lunas: ['Lunas', 'done'], void: ['Void', 'alert'] }
type PayRow = { account: string; amount: string; key: string }
const newRow = (amount = ''): PayRow => ({ account: '', amount, key: crypto.randomUUID() })
const STATUS: Record<Adjustment['status'], string> = { applied: 'Berlaku', pending: 'Menunggu pemilik', approved: 'Disetujui', rejected: 'Ditolak' }
const REASON: Record<string, string> = { tidak_dikerjakan: 'Tidak dikerjakan', salah_kode: 'Salah kode', salah_situs: 'Salah gigi/permukaan',
  salah_provider: 'Salah dokter', salah_tarif: 'Salah tarif', lainnya: 'Lainnya' }
type RefundForm = { payment: string; note: string; amount: string; reason: string }
const REFUND_STATUS = { pending: 'Menunggu persetujuan pemilik', approved: 'Disetujui', rejected: 'Ditolak' }
type LineForm = { line: InvoiceLine; mode: 'credit' | 'review'; amount: string; type: string; reason: string; correction: string | null; reviewId: string }

// Minimal invoice view (unit 4): lines, adjustments, a Rp0 / 100% discount waits for the owner's approve/reject. Kasir screens: UI unit.
// Unit B: Nota kredit per line, void (unpaid only), lines flagged by a clinical correction, Rp0 tariff anomaly. Discounts are not for fixing procedures.
// Unit C: overpayment after a credit note ("kelebihan bayar") -> refund to the original payment account, owner approves.
export default function InvoicePage({ visitId, me }: { visitId: string; me: Me }) {
  const [inv, setInvRaw] = useState<Invoice | null>(null)
  // Mutation responses carry the ledger only: keep the patient's name (header + kwitansi "diterima dari …") and created_at.
  const setInv = (i: Invoice) => setInvRaw((old) => ({ ...i, patient_name: i.patient_name ?? old?.patient_name, created_at: i.created_at ?? old?.created_at }))
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ kind: 'discount', amount: '', reason: '', line: '', unit: 'rp' })
  const [accounts, setAccounts] = useState<PaymentAccount[]>([])
  const [rows, setRows] = useState<PayRow[]>([newRow()])
  const [lineForm, setLineForm] = useState<LineForm | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [refund, setRefund] = useState<RefundForm | null>(null)
  const [receipt, setReceipt] = useState(false)
  const [split, setSplit] = useState(false) // #70: one method by default; "Pecah pembayaran" opens the per-row selects
  const [kind, setKind] = useState<PaymentAccount['kind'] | null>(null) // KL04: Debit/Transfer with several banks wait for a bank chip
  const [cash, setCash] = useState('') // KL03 tunai: money handed over, only for the change (the payment is the bill amount)
  const [busy, setBusy] = useState(false) // a payment/correction request is in flight: no second tap
  const [paidNow, setPaidNow] = useState(false) // KL05: success panel right after the payment that settles the bill
  const can = (p: string) => me.permissions.includes(p)

  const vid = useRef(visitId)
  vid.current = visitId
  const load = useCallback(() => {
    const id = visitId
    return invoiceForVisit(id).then((inv) => { if (vid.current === id) setInv(inv) }, (e) => {
      if (vid.current !== id) return
      setError(e instanceof ApiError && e.status === 404 ? 'Belum ada tagihan untuk kunjungan ini.' : errorText(e))
    })
  }, [visitId])
  useEffect(() => { setInvRaw(null); setError(''); setMsg(''); load() }, [load])
  useEffect(() => { paymentAccounts().then(setAccounts, () => setAccounts([])) }, [])
  // #70: the single, untouched payment row starts at the remaining balance (no typing for the usual full payment; still editable).
  const balance = inv && inv.status !== 'void' ? inv.balance_rp : 0
  // It follows the balance while untouched (a discount lowers it), so Terima never asks for more than is owed; a typed amount stays.
  const prefilled = useRef('')
  useEffect(() => {
    if (balance <= 0) return
    const prev = prefilled.current // read outside the updater: StrictMode runs updaters twice
    prefilled.current = String(balance)
    setRows((rs) => rs.length === 1 && (rs[0].amount === '' || rs[0].amount === prev) ? [{ ...rs[0], amount: String(balance) }] : rs)
  }, [balance])
  // review-3: the usual method (Tunai of this branch, else a clinic-wide Tunai) is preselected, so Terima is active right away.
  const tunai = accounts.find((a) => a.is_active && a.kind === 'tunai' && inv && a.branch_id === inv.branch_id)
    ?? accounts.find((a) => a.is_active && a.kind === 'tunai' && a.branch_id === null)
  useEffect(() => { if (tunai) setRows((rs) => rs.length === 1 && rs[0].account === '' ? [{ ...rs[0], account: tunai.id }] : rs) }, [tunai?.id])

  async function run(fn: () => Promise<Invoice>, ok: (i: Invoice) => string) {
    setError('')
    setMsg('')
    setBusy(true)
    try {
      const i = await fn()
      setInv(i)
      setMsg(ok(i))
    } catch (e) {
      setError(e instanceof ApiError && [403, 409, 422].includes(e.status) && e.data?.message ? e.data.message : errorText(e))
    } finally {
      setBusy(false)
    }
  }

  // KlinikMe-style diskon: on one tindakan line or the whole bill, in Rp or % (of the line price / the balance), rounded to whole rupiah
  const formBase = inv ? (inv.lines.find((l) => l.id === form.line)?.price_rp ?? inv.balance_rp) : 0
  const formRp = form.unit === 'pct' ? Math.round(formBase * Number(form.amount) / 100) : Number(form.amount)
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!inv) return
    run(() => addAdjustment(inv.id, { kind: form.kind, amount_rp: formRp, reason: form.reason.trim(), ...(form.line ? { invoice_line_id: form.line } : {}) }),
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
      setCash('')
      if (i.status === 'lunas') setPaidNow(true)
      return i
    }, (i) => i.status === 'lunas' ? '' : 'Pembayaran diterima.')
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

  const payable = accounts.filter((a) => a.is_active && (!inv || a.branch_id === null || a.branch_id === inv.branch_id))
  const kinds = (Object.keys(KIND) as PaymentAccount['kind'][]).filter((k) => payable.some((a) => a.kind === k))
  const sel = payable.find((a) => a.id === rows[0].account)
  const curKind = sel?.kind ?? kind
  const banks = payable.filter((a) => a.kind === curKind)
  const pickKind = (k: PaymentAccount['kind']) => {
    const of = payable.filter((a) => a.kind === k)
    setKind(k)
    setRows([{ ...rows[0], account: of.length === 1 ? of[0].id : '' }])
  }
  // why "Terima" is disabled, said next to it (not a silent grey button)
  const payBlock = split ? '' : !curKind ? 'Pilih metode bayar.' : !sel ? 'Pilih bank dulu.'
    : sel.kind === 'tunai' && cash !== '' && Number(cash) < Number(rows[0].amount) ? 'Uang diterima kurang dari jumlah dibayar.' : ''
  const amt = rp(split ? rows.reduce((t, r) => t + Number(r.amount || 0), 0) : Number(rows[0].amount || 0))
  const payLabel = split || !sel ? `Terima ${amt}` : sel.kind === 'qris' ? 'Sudah dibayar'
    : ['edc', 'transfer'].includes(sel.kind) ? `Terima ${KIND[sel.kind].toLowerCase()} ${sel.bank_name ?? sel.name} ${amt}` : `Terima ${amt}`
  if (!inv) return error ? <div className="card state-card">{error}</div> : <PageSkeleton variant="invoice" label="Memuat tagihan…" />
  return (
    <>
      {/* #70 decluttered: name, status, sisa (big) and the payment; every secondary amount sits in "Rincian" (non-zero only). */}
      <div className="page-head inv-head">
        <div>
          <h1 aria-label={inv.patient_name ? `Tagihan · ${inv.patient_name}` : 'Tagihan'}>{inv.patient_name ?? 'Tagihan'}</h1>
          <p className="inv-sum">
            <span className={`chip inv-chip inv-chip-${INV_CHIP[inv.status][1]}`}>{INV_CHIP[inv.status][0]}</span>
            {inv.number && <span className="muted small">{inv.number}</span>}
            {inv.balance_rp > 0 ? <><span className="muted">Sisa</span><span className="inv-big" aria-label={`Sisa ${rp(inv.balance_rp)}`}>{rp(inv.balance_rp)}</span>
              {inv.balance_rp !== inv.lines_rp && <span className="muted small">dari {rp(inv.lines_rp)}</span>}</>
              : <span className="inv-big" aria-label={`Total ${rp(inv.lines_rp)}`}>{rp(inv.lines_rp)}</span>}
          </p>
        </div>
      </div>
      {msg && <p className="notice" role="status">{msg}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {paidNow && inv.status === 'lunas' && !receipt && <PaidPanel inv={inv} me={me} onPrint={() => setReceipt(true)} />}
      {inv.payments.length > 0 && inv.status !== 'void' && (receipt ? <Kwitansi inv={inv} me={me} autoPrint={paidNow} onClose={() => setReceipt(false)} />
        : !(paidNow && inv.status === 'lunas') && <p className="kwitansi-actions"><button className="btn" onClick={() => setReceipt(true)}>Kwitansi</button>
          <a className="btn btn-ghost" href="#/kasir">Kembali ke Kasir</a></p>)}
      <div className="card inv-pay">
        <h2 className="sr-only">Pembayaran</h2>
        {inv.payments.length > 0 && (
          <details className="inv-fold">
            <summary>Riwayat bayar ({inv.payments.length})</summary>
            <ul>{inv.payments.map((p) => <li key={p.id}>{accountLabel(p.account)} · {rp(p.amount_rp)}{p.paid_at && ` · ${fmtDateTime(p.paid_at)}`}{(p.refunded_rp ?? 0) > 0 && ` · direfund ${rp(p.refunded_rp)}`}</li>)}</ul>
          </details>
        )}
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
            {!split ? <>
              <div className="pay-kinds" role="radiogroup" aria-label="Metode bayar" title="Hanya akun milik klinik; transfer hanya ke rekening klinik.">
                {kinds.map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={curKind === k} className="pay-kind" onClick={() => pickKind(k)}>
                    <strong>{KIND[k]}</strong><span className="muted small">{KIND_HINT[k]}</span>
                  </button>
                ))}
              </div>
              {curKind && banks.length > 1 && (
                <div className="inv-method" role="radiogroup" aria-label="Pilih bank">
                  {banks.map((a) => <button key={a.id} type="button" role="radio" aria-checked={rows[0].account === a.id} title={accountLabel(a)} className="chip-method"
                    onClick={() => setRows([{ ...rows[0], account: a.id }])}>{a.bank_name ?? a.name}</button>)}
                </div>
              )}
              {sel?.kind === 'transfer' && sel.account_last4 && <p className="muted small">Rekening klinik {sel.bank_name} ··{sel.account_last4}</p>}
              {sel?.kind === 'qris' && <div className="pay-qris">{sel.has_qris_image && <img src={`/api/payment-accounts/${sel.id}/qris-image`} alt={`QRIS ${sel.name}`} />}
                <p className="notice">Minta pasien memindai QRIS{sel.has_qris_image ? '' : ' cabang (foto QRIS belum diunggah di Pengaturan)'}, lalu konfirmasi.</p></div>}
            </> : rows.map((r, n) => (              <div className="toolbar" key={r.key}>
                <select aria-label={`Metode ${n + 1}`} required value={r.account} onChange={(e) => setRows(rows.map((x) => x === r ? { ...x, account: e.target.value } : x))}>
                  <option value="">Pilih akun klinik…</option>
                  {payable.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
                </select>
                <input aria-label={`Jumlah ${n + 1} (Rp)`} type="number" min={1} required value={r.amount} onChange={(e) => setRows(rows.map((x) => x === r ? { ...x, amount: e.target.value } : x))} />
                {rows.length > 1 && <button type="button" className="btn btn-xs" onClick={() => setRows(rows.filter((x) => x !== r))}>Hapus</button>}
              </div>
            ))}
            {!split && <label className="inv-amount">Jumlah dibayar (Rp)<input type="number" min={1} required inputMode="numeric" value={rows[0].amount}
              onChange={(e) => setRows([{ ...rows[0], amount: e.target.value }])} /></label>}
            {!split && sel?.kind === 'tunai' && (
              <div className="pay-cash">
                <label>Uang diterima<input type="number" min={0} inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value)} /></label>
                <p>Kembalian <strong>{rp(Math.max(0, Number(cash || 0) - Number(rows[0].amount || 0)))}</strong></p>
              </div>
            )}
            {split && <p className="muted small">Total {rp(rows.reduce((t, r) => t + Number(r.amount || 0), 0))} dari sisa {rp(inv.balance_rp)}</p>}
            <div className="toolbar pay-submit">
              {split ? <button type="button" className="btn" onClick={() => setRows([...rows, newRow()])}>Tambah metode (split)</button>
                : <button type="button" className="btn btn-ghost" onClick={() => setSplit(true)}>Pecah pembayaran</button>}
              <button className="btn btn-primary" disabled={busy || !!payBlock}>{busy ? 'Memproses…' : payLabel}</button>
            </div>
            {payBlock && <p className="muted small" id="pay-hint">{payBlock}</p>}
          </form>
        )}
      </div>
      <details className="card inv-lines" open={!!lineForm || inv.lines.some((l) => l.tariff_zero === 'pending' || (l.correction_reviews ?? []).some((r) => r.status === 'perlu_tinjau'))}>
        <summary>{inv.lines.length} tindakan · {rp(inv.lines_rp)}</summary>
        <h2 className="sr-only">Tindakan</h2>
        <ul>
          {inv.lines.map((l) => (
            <li key={l.id}>
              {l.procedure_code} {l.procedure_name}{l.tooth ? ` · gigi ${l.tooth}` : ''} · {rp(l.price_rp)}
              {(l.discount_rp ?? 0) > 0 && <> · diskon -{rp(l.discount_rp!)} · <strong>{rp(l.price_rp - l.discount_rp!)}</strong></>}
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
        <dl className="inv-breakdown" aria-label="Rincian">
          {([['Tindakan', inv.lines_rp], ['Penyesuaian', inv.adjustments_rp], ['Nota kredit', inv.credit_notes_rp ?? 0], ['Dibayar', inv.payments_rp], ['Refund', inv.refunds_rp ?? 0]] as const)
            .filter(([, v]) => v !== 0).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{rp(v)}</dd></div>)}
          {inv.created_at && <div><dt>Dibuat</dt><dd>{fmtDateTime(inv.created_at)}</dd></div>}
        </dl>
      </details>
      {/* #70: one primary per page (Terima pembayaran); corrections fold under "Lainnya". */}
      <details className="card inv-more">
        <summary title="Penyesuaian, nota kredit, void">Lainnya</summary>
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
                {a.kind} {rp(a.amount_rp)}{a.invoice_line_id && ` · ${inv.lines.find((l) => l.id === a.invoice_line_id)?.procedure_name ?? 'baris'}`} · {a.reason} · <strong>{STATUS[a.status]}</strong>{a.self_approved_sole_owner && ' (disetujui sendiri)'}
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
              <select aria-label="Untuk" value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })}>
                <option value="">Seluruh tagihan</option>
                {inv.lines.map((l) => <option key={l.id} value={l.id}>{l.procedure_name}{l.tooth ? ` · gigi ${l.tooth}` : ''}</option>)}
              </select>
              <input aria-label={form.unit === 'pct' ? 'Jumlah (%)' : 'Jumlah (Rp)'} type="number" min={1} max={form.unit === 'pct' ? 100 : undefined} required
                value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              <select aria-label="Satuan" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                <option value="rp">Rp</option><option value="pct">%</option>
              </select>
              {form.unit === 'pct' && Number(form.amount) > 0 && <span className="small muted">= {rp(formRp)}</span>}
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
 * payments, balance; numbered by the invoice number (INV-YYYY-000001; older data: the invoice id) and no tax lines. Print = the browser's print dialog,
 * the rest of the page is hidden by @media print in billing.css.
 */
export function Kwitansi({ inv, me, onClose, autoPrint = false }: { inv: Invoice; me: Me; onClose: () => void; autoPrint?: boolean }) {
  useEffect(() => { if (autoPrint) window.print() }, [autoPrint]) // KL05 "Cetak": straight to the printer dialog
  const l = useLetterhead()
  const deductions = inv.adjustments_rp + (inv.credit_notes_rp ?? 0)
  const lastPaid = inv.payments.map((p) => p.paid_at).sort().at(-1)
  return (
    <section className={`card kwitansi paper-${l?.receipt_paper_mm ?? 80}`} aria-label="Kwitansi">
      {l && <Kop l={l} branchId={inv.branch_id} />}
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
          {inv.payments.map((p) => <tr key={p.id}><td>{p.account ? chipLabel(p.account as PaymentAccount) : 'Dibayar'} · {fmtDateTime(p.paid_at)}</td><td>{rp(p.amount_rp)}</td></tr>)}
          {(inv.refunds_rp ?? 0) > 0 && <tr><td>Refund</td><td>-{rp(inv.refunds_rp)}</td></tr>}
          <tr className="sum"><td>Sisa</td><td>{rp(Math.max(0, inv.balance_rp))}</td></tr>
        </tbody>
      </table>
      <p className="muted small">No. tagihan {inv.number ?? inv.id.slice(0, 8).toUpperCase()} · dicetak oleh {me.user.name}</p>
      <div className="kwitansi-actions">
        <button className="btn btn-primary" onClick={() => window.print()}>Cetak</button>
        <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
      </div>
    </section>
  )
}

/**
 * KL05: right after the payment that settles the bill. Two actions side by side (Cetak, WhatsApp), one primary Selesai.
 * The WhatsApp text carries no clinical content (D-011): clinic, amount, date, reference only; the patient's number is picked in WhatsApp.
 */
function PaidPanel({ inv, me, onPrint }: { inv: Invoice; me: Me; onPrint: () => void }) {
  const paid = inv.payments.reduce((t, p) => t + p.amount_rp, 0)
  const methods = [...new Set(inv.payments.map((p) => (p.account ? chipLabel(p.account as PaymentAccount) : '')))].filter(Boolean).join(' + ')
  const text = `Kuitansi ${me.active.tenant_name}: pembayaran ${rp(paid)} diterima ${fmtDateTime(new Date().toISOString())}. Ref ${inv.id.slice(0, 8).toUpperCase()}. Terima kasih.`
  return (
    <section className="card paid" aria-label="Pembayaran diterima">
      <h2>Pembayaran diterima</h2>
      <p className="inv-big">{rp(paid)}</p>
      <p className="muted">{inv.patient_name ?? 'Pasien'} · Lunas{methods && ` · ${methods}`}</p>
      <div className="paid-actions">
        <button className="btn" onClick={onPrint}>Cetak</button>
        <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      </div>
      <a className="btn btn-primary btn-block" href="#/kasir">Selesai</a>
    </section>
  )
}
