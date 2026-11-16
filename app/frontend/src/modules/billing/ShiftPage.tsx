import { useEffect, useState, type FormEvent } from 'react'
import { Button, buttonVariants, Card, Input } from '@heroui/react'
import { ApiError, errorText } from '../../shared/api/http'
import { fmtTime, rp } from '../../shared/format'
import { closeShift, currentShift, openShift, type Shift, type ShiftMethod } from './api'
import { Note } from './ui'
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
  const [busy, setBusy] = useState(false)
  useEffect(() => { currentShift().then((r) => setShift(r.shift), (e) => setError(errorText(e))) }, [])

  async function act(fn: () => Promise<{ shift: Shift }>, done: (s: Shift) => void) {
    setError('')
    setBusy(true)
    try { done((await fn()).shift) } catch (e) {
      setError(e instanceof ApiError && e.data?.message ? e.data.message : errorText(e))
    }
    setBusy(false)
  }

  const err = error && <Note status="danger" role="alert">{error}</Note>
  if (closed) return (
    <Card className="billing shift" role="region" aria-label="Shift ditutup">
      <h1>Shift ditutup</h1>
      <dl className="shift-dl">
        <dt>Diterima</dt><dd>{rp(closed.total_rp)}</dd>
        <dt>Tunai di laci</dt><dd>{rp(closed.counted_cash_rp ?? 0)}</dd>
        {closed.methods.filter((m) => m.kind !== 'tunai').map((m) => <div key={label(m)}><dt>{label(m)}</dt><dd>{rp(m.amount_rp)}</dd></div>)}
        <dt>Selisih kas</dt><dd>{signed(closed.difference_rp ?? 0)}</dd>
      </dl>
      <p className="text-sm text-muted">Pemilik melihat selisih ini di laporan, tanpa perlu menyetujui.</p>
      <a className={buttonVariants({ variant: 'primary', fullWidth: true })} href="#/kasir">Selesai</a>
    </Card>
  )
  if (shift === undefined) return error ? <Card className="state-card" role="alert">{error}</Card> : <Card className="state-card text-muted">Memuat shift…</Card>
  if (shift === null) return (
    <form className="billing shift" onSubmit={(e: FormEvent) => { e.preventDefault(); act(() => openShift(Number(opening)), setShift) }}>
      <Card className="gap-3">
        <h1>Buka shift</h1>
        <label className="shift-field">Kas awal (Rp)<Input type="number" min={0} inputMode="numeric" required value={opening} onChange={(e) => setOpening(e.target.value)} /></label>
        {err}
        <Button type="submit" variant="primary" fullWidth isDisabled={busy}>{busy ? 'Memproses…' : 'Buka shift'}</Button>
      </Card>
    </form>
  )
  const diff = counted === '' ? null : Number(counted) - shift.expected_cash_rp
  const needReason = diff !== null && diff !== 0
  return (
    <form className="billing shift" onSubmit={(e: FormEvent) => { e.preventDefault()
      act(() => closeShift(shift.id, { counted_cash_rp: Number(counted), reason: needReason ? reason.trim() : undefined }), setClosed) }}>
      <Card className="gap-3">
        <h1>Tutup shift</h1>
        <p className="text-sm text-muted">Buka {fmtTime(shift.opened_at)}</p>
        <dl className="shift-dl">
          <dt>Kas awal</dt><dd>{rp(shift.opening_cash_rp)}</dd>
          <dt>Tunai masuk</dt><dd>{rp(shift.cash_in_rp)}</dd>
          <dt className="font-semibold">Seharusnya di laci</dt><dd className="font-semibold">{rp(shift.expected_cash_rp)}</dd>
        </dl>
        <label className="shift-field">Kas dihitung (Rp)<Input type="number" min={0} inputMode="numeric" required value={counted} onChange={(e) => setCounted(e.target.value)} /></label>
        <h2 className="kasir-h">Metode lain, bukan kas</h2>
        {shift.methods.some((m) => m.kind !== 'tunai') ? (
          <dl className="shift-dl">
            {shift.methods.filter((m) => m.kind !== 'tunai').map((m) => <div key={label(m)}><dt>{label(m)}</dt><dd>{rp(m.amount_rp)}</dd></div>)}
          </dl>
        ) : <p className="text-sm text-muted">Belum ada.</p>}
        {needReason && <>
          <Note status="warning" role="status">Selisih {diff! < 0 ? 'kurang' : 'lebih'} {rp(Math.abs(diff!))}. Isi alasan, lalu tutup sendiri. Tidak perlu persetujuan pemilik.</Note>
          <label className="shift-field">Alasan selisih<Input required minLength={5} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        </>}
        {err}
        <Button type="submit" variant="primary" fullWidth isDisabled={busy || counted === '' || (needReason && reason.trim().length < 5)}>{busy ? 'Memproses…' : 'Tutup shift'}</Button>
      </Card>
    </form>
  )
}
