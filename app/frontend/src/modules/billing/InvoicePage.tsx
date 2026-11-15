import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import type { Me } from '../../shared/session'
import { addAdjustment, addCreditNote, addPayment, approveZeroTariff, billFromCorrection, decideAdjustment, decideCreditNote, decideVoid, invoiceForVisit,
  paymentAccounts, reviewCorrection, voidInvoice, type Adjustment, type Invoice, type InvoiceLine, type PaymentAccount } from './api'

const rp = (n: number) => 'Rp' + n.toLocaleString('id-ID')
const KIND: Record<PaymentAccount['kind'], string> = { tunai: 'Tunai', qris: 'QRIS', edc: 'EDC', transfer: 'Transfer' }
const accountLabel = (a: Pick<PaymentAccount, 'name' | 'kind' | 'bank_name' | 'account_last4'>) =>
  `${a.name} (${KIND[a.kind]}${a.bank_name ? ' ' + a.bank_name : ''}${a.account_last4 ? ' ··' + a.account_last4 : ''})`
type PayRow = { account: string; amount: string; key: string }
const newRow = (amount = ''): PayRow => ({ account: '', amount, key: crypto.randomUUID() })
const STATUS: Record<Adjustment['status'], string> = { applied: 'Berlaku', pending: 'Menunggu pemilik', approved: 'Disetujui', rejected: 'Ditolak' }
const INV_STATUS: Record<Invoice['status'], string> = { terbuka: 'Terbuka', lunas: 'Lunas', void: 'Dibatalkan (void)' }
const REASON: Record<string, string> = { tidak_dikerjakan: 'Tidak dikerjakan', salah_kode: 'Salah kode', salah_situs: 'Salah gigi/permukaan',
  salah_provider: 'Salah dokter', salah_tarif: 'Salah tarif', lainnya: 'Lainnya' }
type LineForm = { line: InvoiceLine; mode: 'credit' | 'review'; amount: string; type: string; reason: string; correction: string | null; reviewId: string }

// Minimal invoice view (unit 4): lines, adjustments, a Rp0 / 100% discount waits for the owner's approve/reject. Kasir screens: UI unit.
// Unit B: Nota kredit per line, void (unpaid only), lines flagged by a clinical correction, Rp0 tariff anomaly. Discounts are not for fixing procedures.
export default function InvoicePage({ visitId, me }: { visitId: string; me: Me }) {
  const [inv, setInv] = useState<Invoice | null>(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ kind: 'discount', amount: '', reason: '' })
  const [accounts, setAccounts] = useState<PaymentAccount[]>([])
  const [rows, setRows] = useState<PayRow[]>([newRow()])
  const [lineForm, setLineForm] = useState<LineForm | null>(null)
  const [voidReason, setVoidReason] = useState('')
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

  if (!inv) return <div className="card state-card">{error || 'Memuat tagihan…'}</div>
  return (
    <>
      <div className="page-head"><div><h1>Tagihan</h1><p className="muted small">Saldo {rp(inv.balance_rp)} · baris {rp(inv.lines_rp)} · penyesuaian {rp(inv.adjustments_rp)} · nota kredit {rp(inv.credit_notes_rp ?? 0)} · dibayar {rp(inv.payments_rp)} · {INV_STATUS[inv.status]}</p></div></div>
      {msg && <p className="notice" role="status">{msg}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
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
            <button className="btn btn-primary">{lineForm.mode === 'credit' ? 'Buat nota kredit' : 'Simpan'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setLineForm(null)}>Batal</button>
            {lineForm.mode === 'credit' && <span className="muted small">Penuh (sisa baris) menunggu persetujuan pemilik.</span>}
          </form>
        )}
      </div>
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
            <button className="btn btn-primary">Simpan</button>
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
              <span className="muted small">Hanya tagihan tanpa pembayaran. Sudah dibayar: pakai nota kredit.</span>
            </form>
          )}
        </div>
      )}
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
