import { useCallback, useEffect, useState } from 'react'
import { errorText } from '../../shared/api/http'
import { fmtDateTime, rp } from '../../shared/format'
import { kasirList, type KasirList, type KasirRow } from './api'
import './billing.css'

// Kasir (#69): the cashier's worklist for the active branch. "Belum lunas" = every open invoice (any day); "Hari ini" = today's
// paid/void ones (for the kwitansi). Each row opens #/tagihan/<visit_id>, where payment and the kwitansi live.
const total = (r: KasirRow) => r.lines_rp - r.adjustments_rp - r.credit_notes_rp

function Row({ r }: { r: KasirRow }) {
  const open = r.status === 'terbuka'
  return (
    <li className="kasir-row">
      <div className="kasir-who">
        <strong>{r.patient_name ?? 'Pasien'}</strong>
        <span className="muted small">{fmtDateTime(r.created_at)} · total {rp(total(r))}{r.payments_rp > 0 && ` · dibayar ${rp(r.payments_rp)}`}</span>
      </div>
      <span className={`kasir-state ${open ? 'is-open' : ''}`}>{open ? `Sisa ${rp(r.balance_rp)}` : r.status === 'lunas' ? 'Lunas' : 'Void'}</span>
      <a className={`btn ${open ? 'btn-primary' : ''}`} href={`#/tagihan/${r.visit_id}`}>{open ? 'Bayar' : 'Lihat / kwitansi'}</a>
    </li>
  )
}

export default function KasirPage() {
  const [data, setData] = useState<KasirList | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    setError('')
    kasirList().then(setData, (e) => setError(errorText(e)))
  }, [])
  useEffect(() => { load() }, [load])

  if (error) return <div className="card state-card"><p role="alert">{error}</p><button className="btn" onClick={load}>Coba lagi</button></div>
  if (!data) return <div className="card state-card muted">Memuat tagihan…</div>
  const open = data.invoices.filter((r) => r.status === 'terbuka')
  const done = data.invoices.filter((r) => r.status !== 'terbuka')
  return (
    <div className="kasir">
      <div className="page-head">
        <div><h1>Kasir</h1><p className="muted small">Tagihan cabang aktif: semua yang belum lunas, ditambah yang dibuat hari ini.</p></div>
        <button className="btn" onClick={load}>Muat ulang</button>
      </div>
      <section className="card" aria-labelledby="kasir-open">
        <h2 id="kasir-open">Belum bayar ({open.length})</h2>
        {open.length ? <ul className="kasir-list">{open.map((r) => <Row key={r.id} r={r} />)}</ul>
          : <p className="muted">Tidak ada tagihan terbuka. Tagihan muncul setelah dokter menekan Selesai pada kunjungan yang punya tindakan.</p>}
      </section>
      <section className="card" aria-labelledby="kasir-done">
        <h2 id="kasir-done">Lunas / void hari ini ({done.length})</h2>
        {done.length ? <ul className="kasir-list">{done.map((r) => <Row key={r.id} r={r} />)}</ul> : <p className="muted">Belum ada.</p>}
      </section>
    </div>
  )
}
