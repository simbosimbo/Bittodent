import { useCallback, useEffect, useRef, useState, type ComponentProps, type FormEvent } from 'react'
import { Select as NSelect } from '../../shared/ui/Select'
import { StateCard } from '../../shared/ui/StateCard'
import { Button, buttonVariants, Card, Chip, Input, ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { ApiError, errorText } from '../../shared/api/http'
import { fmtDateTime, rp } from '../../shared/format'
import { PageSkeleton } from '../../shared/ui/Skeleton'
import { Kop, useLetterhead } from '../../shared/letterhead'
import type { Me } from '../../shared/session'
import { addAdjustment, addCreditNote, addPayment, addRefund, approveZeroTariff, billFromCorrection, decideAdjustment, decideCreditNote, decideRefund, decideVoid, invoiceForVisit,
  paymentAccounts, reviewCorrection, voidInvoice, type Adjustment, type Invoice, type InvoiceLine, type PaymentAccount } from './api'
import { Note } from '../../shared/ui/Note'
import './billing.css'

const KIND: Record<PaymentAccount['kind'], string> = { tunai: 'Tunai', qris: 'QRIS', edc: 'Debit', transfer: 'Transfer', bpjs: 'BPJS', asuransi: 'Asuransi' }
/** KL03: six method cards (order + hint); a kind shows only when the clinic has an active account of it. BPJS/asuransi = claim as payment. */
const KIND_HINT: Record<PaymentAccount['kind'], string> = { tunai: 'Kembalian dihitung', qris: 'QR statis cabang', edc: 'Pilih bank', transfer: 'Pilih bank',
  bpjs: 'Klaim sebagai bayar', asuransi: 'Klaim sebagai bayar' }
const accountLabel = (a: Pick<PaymentAccount, 'name' | 'kind' | 'bank_name' | 'account_last4'>) =>
  `${a.name} (${KIND[a.kind]}${a.bank_name ? ' ' + a.bank_name : ''}${a.account_last4 ? ' ··' + a.account_last4 : ''})`
/** Short chip label (#70): "Tunai", "QRIS", "EDC BCA", "Transfer BCA"; the full account sits in the tooltip. */
const chipLabel = (a: PaymentAccount) => `${KIND[a.kind]}${a.bank_name ? ' ' + a.bank_name : ''}`
const INV_CHIP: Record<Invoice['status'], [string, 'warning' | 'success' | 'danger']> = { terbuka: ['Belum lunas', 'warning'], lunas: ['Lunas', 'success'], void: ['Void', 'danger'] }
type PayRow = { account: string; amount: string; key: string }
const newRow = (amount = ''): PayRow => ({ account: '', amount, key: crypto.randomUUID() })
const ADJ_KIND: Record<string, string> = { discount: 'Diskon', write_off: 'Penghapusan', correction: 'Koreksi' }
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
      (i) => {
        setForm({ kind: 'discount', amount: '', reason: '', line: '', unit: 'rp' }) // saved: an empty form, so a second press cannot repeat it
        return i.adjustments.at(-1)?.status === 'pending' ? 'Saldo menjadi Rp0: menunggu persetujuan pemilik.' : 'Penyesuaian tersimpan.'
      })
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
  if (!inv) return error ? <StateCard error={error} /> : <PageSkeleton variant="invoice" label="Memuat tagihan…" />
  const owe = (yes: () => Promise<Invoice>, no: () => Promise<Invoice>, okYes: string, okNo: string) =>
    <Decide yes={() => run(yes, () => okYes)} no={() => run(no, () => okNo)} />
  return (
    <div className="billing">
      {/* #70 decluttered: name, status, sisa (big) and the payment; every secondary amount sits in "Rincian" (non-zero only). */}
      <div className="page-head inv-head">
        <div>
          <h1 aria-label={inv.patient_name ? `Tagihan · ${inv.patient_name}` : 'Tagihan'}>{inv.patient_name ?? 'Tagihan'}</h1>
          <p className="inv-sum">
            <Chip className="inv-chip" variant="soft" color={INV_CHIP[inv.status][1]}>{INV_CHIP[inv.status][0]}</Chip>
            {inv.number && <span className="text-sm text-muted">{inv.number}</span>}
            {inv.balance_rp > 0 ? <><span className="text-muted">Sisa</span><span className="inv-big" aria-label={`Sisa ${rp(inv.balance_rp)}`}>{rp(inv.balance_rp)}</span>
              {inv.balance_rp !== inv.lines_rp && <span className="text-sm text-muted">dari {rp(inv.lines_rp)}</span>}</>
              : <span className="inv-big" aria-label={`Total ${rp(inv.lines_rp)}`}>{rp(inv.lines_rp)}</span>}
          </p>
        </div>
      </div>
      {msg && <Note status="success" role="status" className="mb-3">{msg}</Note>}
      {error && <Note status="danger" role="alert" className="mb-3">{error}</Note>}
      {paidNow && inv.status === 'lunas' && !receipt && <PaidPanel inv={inv} me={me} onPrint={() => setReceipt(true)} />}
      {inv.payments.length > 0 && inv.status !== 'void' && (receipt ? <Kwitansi inv={inv} me={me} autoPrint={paidNow} onClose={() => setReceipt(false)} />
        : !(paidNow && inv.status === 'lunas') && <p className="kwitansi-actions"><Button variant="secondary" onPress={() => setReceipt(true)}>Kwitansi</Button>
          <a className={buttonVariants({ variant: 'ghost' })} href="#/kasir">Kembali ke Kasir</a></p>)}
      <Card className="inv-pay mb-3">
        <h2 className="sr-only">Pembayaran</h2>
        {inv.payments.length > 0 && (
          <details className="inv-fold">
            <summary>Riwayat bayar ({inv.payments.length})</summary>
            <ul>{inv.payments.map((p) => <li key={p.id}>{accountLabel(p.account)} · {rp(p.amount_rp)}{p.paid_at && ` · ${fmtDateTime(p.paid_at)}`}{(p.refunded_rp ?? 0) > 0 && ` · direfund ${rp(p.refunded_rp)}`}</li>)}</ul>
          </details>
        )}
        {(inv.overpaid_rp ?? 0) > 0 && (
          <Note status="warning" role="note">Kelebihan bayar {rp(inv.overpaid_rp)} — buat refund
            {can('billing.adjust') && !refund && overpaidLeft > 0 && refundNotes.length > 0 && refundPays.length > 0 && (
              <> <Button size="sm" variant="secondary" onPress={() => setRefundPick({ payment: refundPays[0].id, note: refundNotes[0].id, amount: '', reason: '' })}>Refund</Button></>
            )}
          </Note>
        )}
        {refund && (
          <form onSubmit={submitRefund} className={ROW} aria-label="Form refund">
            <Select aria-label="Pembayaran asal" value={refund.payment} onChange={(e) => setRefundPick({ ...refund, payment: e.target.value })}>
              {refundPays.map((p) => <option key={p.id} value={p.id}>{accountLabel(p.account)} · {rp(p.amount_rp)}</option>)}
            </Select>
            <Input className={FIELD} aria-label="Akun refund" disabled value={accountLabel(refundPays.find((p) => p.id === refund.payment)?.account ?? inv.payments[0].account)} />
            <Select aria-label="Nota kredit refund" value={refund.note} onChange={(e) => setRefundPick({ ...refund, note: e.target.value })}>
              {refundNotes.map((n) => <option key={n.id} value={n.id}>{n.number} · {rp(n.amount_rp)}</option>)}
            </Select>
            <Input className={FIELD} aria-label="Jumlah refund (Rp)" type="number" min={1} max={refundMax(refund.payment, refund.note)} required value={refund.amount}
              onChange={(e) => setRefund({ ...refund, amount: e.target.value })} />
            <Input className={FIELD} aria-label="Alasan refund" required minLength={10} value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} />
            <Button type="submit" variant="secondary">Ajukan refund</Button>
            <Button variant="ghost" onPress={() => setRefund(null)}>Batal</Button>
            <span className="text-sm text-muted">Refund hanya ke akun pembayaran asal dan menunggu persetujuan pemilik.</span>
          </form>
        )}
        {refunds.length > 0 && (
          <ul aria-label="Refund">
            {refunds.map((r) => (
              <li key={r.id}>
                Refund {rp(r.amount_rp)} · {accountLabel(inv.payments.find((p) => p.id === r.payment_id)?.account ?? { name: 'Akun asal', kind: r.method, bank_name: null, account_last4: null })}
                {' '}· {r.reason} · <strong>{REFUND_STATUS[r.status]}</strong>{r.self_approved_sole_owner && ' (disetujui sendiri)'}
                {r.status === 'pending' && can('billing.approve_reversal') && owe(() => decideRefund(r.id, 'approve'), () => decideRefund(r.id, 'reject'), 'Refund disetujui.', 'Refund ditolak.')}
              </li>
            ))}
          </ul>
        )}
        {can('billing.adjust') && inv.balance_rp > 0 && (
          <form onSubmit={pay} className="flex flex-col gap-3">
            {!split ? <>
              <div title="Hanya akun milik klinik; transfer hanya ke rekening klinik.">
                <ToggleButtonGroup aria-label="Metode bayar" selectionMode="single" disallowEmptySelection isDetached className="grid w-full grid-cols-2 gap-2"
                  selectedKeys={curKind ? [curKind] : []} onSelectionChange={(k) => { const v = [...k][0]; if (v) pickKind(v as PaymentAccount['kind']) }}>
                  {kinds.map((k) => (
                    <ToggleButton key={k} id={k} className="pay-kind"><strong>{KIND[k]}</strong><span className="text-sm text-muted">{KIND_HINT[k]}</span></ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </div>
              {curKind && banks.length > 1 && (
                <ToggleButtonGroup aria-label="Pilih bank" selectionMode="single" disallowEmptySelection isDetached className="flex-wrap gap-2"
                  selectedKeys={rows[0].account ? [rows[0].account] : []} onSelectionChange={(k) => { const v = [...k][0]; if (v) setRows([{ ...rows[0], account: String(v) }]) }}>
                  {banks.map((a) => <ToggleButton key={a.id} id={a.id} className="pick" aria-description={accountLabel(a)}>{a.bank_name ?? a.name}</ToggleButton>)}
                </ToggleButtonGroup>
              )}
              {sel?.kind === 'transfer' && sel.account_last4 && <p className="text-sm text-muted">Rekening klinik {sel.bank_name} ··{sel.account_last4}</p>}
              {sel?.kind === 'qris' && <div className="pay-qris">{sel.has_qris_image && <img src={`/api/payment-accounts/${sel.id}/qris-image`} alt={`QRIS ${sel.name}`} />}
                <Note>Minta pasien memindai QRIS{sel.has_qris_image ? '' : ' cabang (foto QRIS belum diunggah di Pengaturan)'}, lalu konfirmasi.</Note></div>}
            </> : rows.map((r, n) => (
              <div className={ROW} key={r.key}>
                <Select aria-label={`Metode ${n + 1}`} required value={r.account} onChange={(e) => setRows(rows.map((x) => x === r ? { ...x, account: e.target.value } : x))}>
                  <option value="">Pilih akun klinik…</option>
                  {payable.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
                </Select>
                <Input className={FIELD} aria-label={`Jumlah ${n + 1} (Rp)`} type="number" min={1} required value={r.amount} onChange={(e) => setRows(rows.map((x) => x === r ? { ...x, amount: e.target.value } : x))} />
                {rows.length > 1 && <Button size="sm" variant="ghost" onPress={() => setRows(rows.filter((x) => x !== r))}>Hapus</Button>}
              </div>
            ))}
            {!split && <label className="inv-amount">Jumlah dibayar (Rp)<Input type="number" min={1} required inputMode="numeric" value={rows[0].amount}
              onChange={(e) => setRows([{ ...rows[0], amount: e.target.value }])} /></label>}
            {!split && sel?.kind === 'tunai' && (
              <div className="pay-cash">
                <label className="inv-amount">Uang diterima<Input type="number" min={0} inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value)} /></label>
                <p>Kembalian <strong className="tabular-nums">{rp(Math.max(0, Number(cash || 0) - Number(rows[0].amount || 0)))}</strong></p>
              </div>
            )}
            {split && <p className="text-sm text-muted">Total {rp(rows.reduce((t, r) => t + Number(r.amount || 0), 0))} dari sisa {rp(inv.balance_rp)}</p>}
            <div className={`${ROW} pay-submit`}>
              {split ? <Button variant="secondary" onPress={() => setRows([...rows, newRow()])}>Tambah metode (split)</Button>
                : <Button variant="ghost" onPress={() => setSplit(true)}>Pecah pembayaran</Button>}
              <Button type="submit" variant="primary" isDisabled={busy || !!payBlock}>{busy ? 'Memproses…' : payLabel}</Button>
            </div>
            {payBlock && <p className="text-sm text-muted" id="pay-hint">{payBlock}</p>}
          </form>
        )}
      </Card>
      <details className="inv-lines inv-panel" open={!!lineForm || inv.lines.some((l) => l.tariff_zero === 'pending' || (l.correction_reviews ?? []).some((r) => r.status === 'perlu_tinjau'))}>
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
                <> <Button size="sm" variant="secondary" onPress={() => run(() => approveZeroTariff(l.id), () => 'Tarif Rp0 disetujui.')}>Setujui tarif Rp0</Button></>
              )}
              {(l.correction_reviews ?? []).filter((r) => r.status === 'perlu_tinjau').map((r) => (
                <span key={r.id}> · <strong>Perlu tinjau koreksi ({REASON[r.reason_type] ?? r.reason_type})</strong>
                  {can('billing.adjust') && inv.status !== 'void' && <>
                    {r.billable_code && <> <Button size="sm" variant="secondary" onPress={() => run(() => billFromCorrection(inv.id, r.procedure_correction_id), () => 'Kode yang benar ditagih; baris lama tetap.')}>Tagih kode yang benar</Button></>}
                    {' '}<Button size="sm" variant="ghost" onPress={() => setLineForm({ line: l, mode: 'review', amount: '', type: '', reason: '', correction: null, reviewId: r.id })}>Tandai ditinjau</Button>
                  </>}
                </span>
              ))}
              {can('billing.adjust') && inv.status !== 'void' && l.price_rp - (l.credited_rp ?? 0) > 0 && (
                <> <Button size="sm" variant="secondary" onPress={() => openCredit(l)}>Nota kredit</Button></>
              )}
            </li>
          ))}
        </ul>
        {lineForm && (
          <form onSubmit={submitLine} className={ROW} aria-label={lineForm.mode === 'credit' ? 'Form nota kredit' : 'Form tinjau koreksi'}>
            <span className="text-sm">{lineForm.line.procedure_code} {lineForm.line.procedure_name}</span>
            {lineForm.mode === 'credit' && <>
              <Input className={FIELD} aria-label="Jumlah nota kredit (Rp)" type="number" min={1} required value={lineForm.amount} onChange={(e) => setLineForm({ ...lineForm, amount: e.target.value })} />
              <Select aria-label="Jenis koreksi" value={lineForm.type} onChange={(e) => setLineForm({ ...lineForm, type: e.target.value })}>
                {Object.entries(REASON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </>}
            <Input className={FIELD} aria-label="Alasan koreksi" required minLength={5} value={lineForm.reason} onChange={(e) => setLineForm({ ...lineForm, reason: e.target.value })} />
            <Button type="submit" variant="secondary">{lineForm.mode === 'credit' ? 'Buat nota kredit' : 'Simpan'}</Button>
            <Button variant="ghost" onPress={() => setLineForm(null)}>Batal</Button>
            {lineForm.mode === 'credit' && <span className="text-sm text-muted">Penuh (sisa baris) menunggu persetujuan pemilik.</span>}
          </form>
        )}
        <dl className="inv-breakdown" aria-label="Rincian">
          {([['Tindakan', inv.lines_rp], ['Penyesuaian', inv.adjustments_rp], ['Nota kredit', inv.credit_notes_rp ?? 0], ['Dibayar', inv.payments_rp], ['Refund', inv.refunds_rp ?? 0]] as const)
            .filter(([, v]) => v !== 0).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{rp(v)}</dd></div>)}
          {inv.created_at && <div><dt>Dibuat</dt><dd>{fmtDateTime(inv.created_at)}</dd></div>}
        </dl>
      </details>
      {/* #70: one primary per page (Terima pembayaran); corrections fold under "Lainnya". */}
      <details className="inv-more inv-panel">
        <summary title="Penyesuaian, nota kredit, void">Lainnya</summary>
        {(inv.credit_notes ?? []).length > 0 && (
          <section className="inv-sub">
            <h2>Nota kredit</h2>
            <ul>
              {inv.credit_notes.map((n) => (
                <li key={n.id}>
                  <strong>{n.number}</strong> · {rp(n.amount_rp)} · {n.is_full ? 'penuh' : 'sebagian'} · {REASON[n.reason_type] ?? n.reason_type} · {n.reason}
                  {' '}· <strong>{n.status === 'pending' ? 'Menunggu persetujuan' : n.status === 'rejected' ? 'Ditolak' : 'Disetujui'}</strong>{n.self_approved_sole_owner && ' (disetujui sendiri)'}
                  {n.status === 'pending' && can('billing.approve_reversal') && owe(() => decideCreditNote(n.id, 'approve'), () => decideCreditNote(n.id, 'reject'), `${n.number} disetujui.`, `${n.number} ditolak.`)}
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="inv-sub">
          <h2>Penyesuaian</h2>
          <ul>
            {inv.adjustments.map((a) => (
              <li key={a.id}>
                {ADJ_KIND[a.kind] ?? a.kind} {rp(a.amount_rp)}{a.invoice_line_id && ` · ${inv.lines.find((l) => l.id === a.invoice_line_id)?.procedure_name ?? 'baris'}`} · {a.reason} · <strong>{STATUS[a.status]}</strong>{a.self_approved_sole_owner && ' (disetujui sendiri)'}
                {a.status === 'pending' && can('billing.approve_zero') && owe(() => decideAdjustment(a.id, 'approve'), () => decideAdjustment(a.id, 'reject'), 'Disetujui.', 'Ditolak.')}
              </li>
            ))}
          </ul>
          {can('billing.adjust') && (
            <form onSubmit={submit} className={ROW}>
              <Select aria-label="Jenis" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="discount">Diskon</option><option value="write_off">Penghapusan</option>
              </Select>
              <Select aria-label="Untuk" value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })}>
                <option value="">Seluruh tagihan</option>
                {inv.lines.map((l) => <option key={l.id} value={l.id}>{l.procedure_name}{l.tooth ? ` · gigi ${l.tooth}` : ''}</option>)}
              </Select>
              <Input className={FIELD} aria-label={form.unit === 'pct' ? 'Jumlah (%)' : 'Jumlah (Rp)'} type="number" min={1} max={form.unit === 'pct' ? 100 : undefined} required
                value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              <Select aria-label="Satuan" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                <option value="rp">Rp</option><option value="pct">%</option>
              </Select>
              {form.unit === 'pct' && Number(form.amount) > 0 && <span className="text-sm text-muted">= {rp(formRp)}</span>}
              <Input className={FIELD} aria-label="Alasan" required minLength={5} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              <Button type="submit" variant="secondary">Simpan</Button>
            </form>
          )}
        </section>
        {((inv.voids ?? []).length > 0 || (can('billing.adjust') && inv.status !== 'void' && inv.payments.length === 0)) && (
          <section className="inv-sub">
            <h2>Void tagihan</h2>
            <ul>
              {(inv.voids ?? []).map((v) => (
                <li key={v.id}>{v.reason} · <strong>{v.status === 'pending' ? 'Menunggu persetujuan' : v.status === 'rejected' ? 'Ditolak' : 'Dibatalkan (void)'}</strong>
                  {v.status === 'pending' && can('billing.approve_reversal') && owe(() => decideVoid(v.id, 'approve'), () => decideVoid(v.id, 'reject'), 'Tagihan dibatalkan (void).', 'Pembatalan ditolak.')}
                </li>
              ))}
            </ul>
            {can('billing.adjust') && inv.status !== 'void' && inv.payments.length === 0 && !(inv.voids ?? []).some((v) => v.status === 'pending') && (
              <form onSubmit={submitVoid} className={ROW}>
                <Input className={FIELD} aria-label="Alasan void" required minLength={10} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
                <Button type="submit" variant="danger-soft">Void tagihan</Button>
                <span className="text-sm text-muted">Hanya tagihan tanpa pembayaran. Sudah dibayar: pakai nota kredit lalu refund.</span>
              </form>
            )}
          </section>
        )}
      </details>
    </div>
  )
}

const ROW = 'flex flex-wrap items-center gap-2'
const FIELD = 'min-w-0 max-w-full flex-[1_1_140px]'

/** Native select (keeps the phone's own picker) in the HeroUI field look. shortcut: Pro NativeSelect does not resolve from its symlinked folder yet, switch when it does. */
const Select = (p: ComponentProps<typeof NSelect>) => <NSelect {...p} wrapClassName={FIELD} />

/** Owner decision: Setujui / Tolak side by side. */
const Decide = ({ yes, no }: { yes: () => void; no: () => void }) => (
  <span className="ml-1 inline-flex gap-2"><Button size="sm" variant="secondary" onPress={yes}>Setujui</Button><Button size="sm" variant="ghost" onPress={no}>Tolak</Button></span>
)

/**
 * Kwitansi (#69)
: a printable receipt of the money received on this invoice. Minimal: clinic + branch, patient, lines, deductions,
 * payments, balance; numbered by the invoice number (INV-YYYY-000001; older data: the invoice id) and no tax lines. Print = the browser's print dialog,
 * the rest of the page is hidden by @media print in billing.css.
 */
export function Kwitansi({ inv, me, onClose, autoPrint = false }: { inv: Invoice; me: Me; onClose: () => void; autoPrint?: boolean }) {
  useEffect(() => { if (autoPrint) window.print() }, [autoPrint]) // KL05 "Cetak": straight to the printer dialog
  const l = useLetterhead()
  const deductions = inv.adjustments_rp + (inv.credit_notes_rp ?? 0)
  const lastPaid = inv.payments.map((p) => p.paid_at).sort().at(-1)
  return (
    <Card className={`kwitansi mb-3 paper-${l?.receipt_paper_mm ?? 80}`} role="region" aria-label="Kwitansi">
      {l && <Kop l={l} branchId={inv.branch_id} />}
      <div className="kwitansi-head">
        <div>
          <h2>KWITANSI</h2>
          <p className="text-sm text-muted">{me.active.tenant_name}{me.active.branch_name ? ` · ${me.active.branch_name}` : ''}</p>
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
      <p className="text-sm text-muted">No. tagihan {inv.number ?? inv.id.slice(0, 8).toUpperCase()} · dicetak oleh {me.user.name}</p>
      <div className="kwitansi-actions">
        <Button variant="primary" onPress={() => window.print()}>Cetak</Button>
        <Button variant="ghost" onPress={onClose}>Tutup</Button>
      </div>
    </Card>
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
    <Card className="paid mb-3" role="region" aria-label="Pembayaran diterima">
      <h2>Pembayaran diterima</h2>
      <p className="inv-big">{rp(paid)}</p>
      <p className="text-muted">{inv.patient_name ?? 'Pasien'} · Lunas{methods && ` · ${methods}`}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" fullWidth onPress={onPrint}>Cetak</Button>
        <a className={buttonVariants({ variant: 'secondary', fullWidth: true })} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      </div>
      <a className={buttonVariants({ variant: 'primary', fullWidth: true })} href="#/kasir">Selesai</a>
    </Card>
  )
}
