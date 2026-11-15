import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import { fmtTime, rp } from '../../shared/format'
import { closeShift, currentShift, openShift, type Shift, type ShiftMethod } from './api'
import './billing.css'

const KIND: Record<ShiftMethod['kind'], string> = { tunai: 'Tunai', qris: 'QRIS', edc: 'Debit', transfer: 'Transfer', bpjs: 'BPJS', asuransi: 'Asuransi' }
const label = (m: ShiftMethod) => `${KIND[m.kind]}${m.bank_name ? ' ' + m.bank_name : ''}`
const signed = (n: number) => (n < 0 ? '- ' : n > 0 ? '+ ' : '') + rp(Math.abs(n))

// Board KL06: open (opening cash) -> count -> close alone (reason when there is a difference) -> recap per method and bank.
export default function ShiftPage() {
  const [shift, setShift] = useState<Shift | null | undefined>(undefined)
  const [closed, setClosed] = useState<Shift | null>(null)
  const [opening, setOpening] = useState('')
  const [counted, setCounted] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { currentShift().then((r) => setShift(r.shift), (e) => setError(errorText(e))) }, [])

  async function act(fn: () => Promise<{ shift: Shift }>, done: (s: Shift) => void) {
    setError('')
    try { done((await fn()).shift) } catch (e) {
      setError(e instanceof ApiError && e.data?.message ? e.data.message : errorText(e))
    }
  }

  if (closed) return (
    <section className="card shift" aria-label="Shift ditutup">
      <h1>Shift ditutup</h1>
      <dl className="shift-dl">
        <dt>Diterima</dt><dd>{rp(closed.total_rp)}</dd>
        <dt>Tunai di laci</dt><dd>{rp(closed.counted_cash_rp ?? 0)}</dd>
        {closed.methods.filter((m) => m.kind !== 'tunai').map((m) => <div key={label(m)}><dt>{label(m)}</dt><dd>{rp(m.amount_rp)}</dd></div>)}
        <dt>Selisih kas</dt><dd>{signed(closed.difference_rp ?? 0)}</dd>
      </dl>
      <p className="muted small">Pemilik melihat selisih ini di laporan, tanpa perlu menyetujui.</p>
      <a className="btn btn-primary btn-block" href="#/kasir">Selesai</a>
    </section>
  )
  if (shift === undefined) return error ? <div className="card state-card" role="alert">{error}</div> : <div className="card state-card muted">Memuat shift…</div>
  if (shift === null) return (
    <form className="card shift" onSubmit={(e: FormEvent) => { e.preventDefault(); act(() => openShift(Number(opening)), setShift) }}>
      <h1>Buka shift</h1>
      <label>Kas awal (Rp)<input type="number" min={0} inputMode="numeric" required value={opening} onChange={(e) => setOpening(e.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-block">Buka shift</button>
    </form>
  )
  const diff = counted === '' ? null : Number(counted) - shift.expected_cash_rp
  const needReason = diff !== null && diff !== 0
  return (
    <form className="card shift" onSubmit={(e: FormEvent) => { e.preventDefault()
      act(() => closeShift(shift.id, { counted_cash_rp: Number(counted), reason: needReason ? reason.trim() : undefined }), setClosed) }}>
      <h1>Tutup shift</h1>
      <p className="muted small">Buka {fmtTime(shift.opened_at)}</p>
      <dl className="shift-dl">
        <dt>Kas awal</dt><dd>{rp(shift.opening_cash_rp)}</dd>
        <dt>Tunai masuk</dt><dd>{rp(shift.cash_in_rp)}</dd>
        <dt className="strong">Seharusnya di laci</dt><dd className="strong">{rp(shift.expected_cash_rp)}</dd>
      </dl>
      <label>Kas dihitung (Rp)<input type="number" min={0} inputMode="numeric" required value={counted} onChange={(e) => setCounted(e.target.value)} /></label>
      <h2 className="kasir-h">Metode lain, bukan kas</h2>
      {shift.methods.some((m) => m.kind !== 'tunai') ? (
        <dl className="shift-dl">
          {shift.methods.filter((m) => m.kind !== 'tunai').map((m) => <div key={label(m)}><dt>{label(m)}</dt><dd>{rp(m.amount_rp)}</dd></div>)}
        </dl>
      ) : <p className="muted small">Belum ada.</p>}
      {needReason && <>
        <p className="notice" role="status">Selisih {diff! < 0 ? 'kurang' : 'lebih'} {rp(Math.abs(diff!))}. Isi alasan, lalu tutup sendiri. Tidak perlu persetujuan pemilik.</p>
        <label>Alasan selisih<input required minLength={5} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={counted === '' || (needReason && reason.trim().length < 5)}>Tutup shift</button>
    </form>
  )
}
