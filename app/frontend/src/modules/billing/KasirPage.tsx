import { useCallback, useEffect, useState } from 'react'
import { errorText } from '../../shared/api/http'
import { fmtTime, rp } from '../../shared/format'
import { getDailyRevenue, kasirList, type DailyRevenue, type KasirList, type KasirRow } from './api'
import './billing.css'

// Kasir (#69, board KL01): who still has to pay, as cards. "Belum bayar" = every open invoice (any day); today's paid/void stay
// listed for the kwitansi. Each card opens #/tagihan/<visit_id>, where payment lives. BPJS is a payment method, never a deduction.
const total = (r: KasirRow) => r.lines_rp - r.adjustments_rp - r.credit_notes_rp
const FILTERS = { semua: 'Semua', belum: 'Belum', bpjs: 'BPJS', tempo: 'Tempo' } as const
type Filter = keyof typeof FILTERS
const wibDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(iso))
const initials = (n: string | null) => (n ?? 'P').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

function Card({ r, today }: { r: KasirRow; today: string }) {
  const open = r.status === 'terbuka'
  const old = open && wibDay(r.created_at) !== today
  const meta = [old ? 'Tempo' : fmtTime(r.created_at), (r.items ?? []).join(', '), r.payer_type === 'bpjs' ? 'BPJS' : r.payer_type === 'asuransi' ? 'Asuransi' : '']
  return (
    <li>
      <a className="kasir-card" href={`#/tagihan/${r.visit_id}`} aria-label={`${r.patient_name ?? 'Pasien'}, ${open ? 'belum bayar' : r.status}, ${rp(open ? r.balance_rp : total(r))}`}>
        <span className="avatar" aria-hidden="true">{initials(r.patient_name)}</span>
        <span className="kasir-who">
          <strong>{r.patient_name ?? 'Pasien'}</strong>
          <span className="muted small">{meta.filter(Boolean).join(' · ')}</span>
        </span>
        <span className="kasir-amt">
          <strong>{rp(open ? r.balance_rp : total(r))}</strong>
          <span className={`kasir-state ${open ? 'is-open' : ''}`}>{open ? 'Belum bayar' : r.status === 'lunas' ? 'Lunas' : 'Void'}</span>
        </span>
      </a>
    </li>
  )
}

export default function KasirPage() {
  const [data, setData] = useState<KasirList | null>(null)
  const [rev, setRev] = useState<DailyRevenue | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('semua')
  const load = useCallback(() => {
    setError('')
    kasirList().then(setData, (e) => setError(errorText(e)))
    getDailyRevenue().then(setRev, () => setRev(null))
  }, [])
  useEffect(() => { load() }, [load])

  if (error) return <div className="card state-card"><p role="alert">{error}</p><button className="btn" onClick={load}>Coba lagi</button></div>
  if (!data) return <div className="card state-card muted">Memuat tagihan…</div>
  const open = data.invoices.filter((r) => r.status === 'terbuka')
  const done = data.invoices.filter((r) => r.status !== 'terbuka')
  const shown = filter === 'semua' ? data.invoices : filter === 'belum' ? open
    : filter === 'bpjs' ? data.invoices.filter((r) => r.payer_type === 'bpjs') : open.filter((r) => wibDay(r.created_at) !== data.date)
  return (
    <div className="kasir">
      <div className="page-head">
        <div><h1>Kasir</h1><p className="muted small">Tagihan cabang aktif.</p></div>
        <button className="btn" onClick={load}>Muat ulang</button>
      </div>
      <div className="kasir-kpi">
        <div className="card"><span className="muted small">Belum bayar</span><strong>{open.length}</strong></div>
        <div className="card"><span className="muted small">Diterima hari ini</span><strong>{rev ? rp(rev.amount_rp) : '–'}</strong></div>
      </div>
      <div className="kasir-filter" role="radiogroup" aria-label="Saring tagihan">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <button key={f} type="button" role="radio" aria-checked={filter === f} className="chip-method" onClick={() => setFilter(f)}>{FILTERS[f]}</button>
        ))}
      </div>
      {data.invoices.length === 0
        ? <p className="card muted">Tidak ada tagihan terbuka. Tagihan muncul setelah dokter menekan Selesai pada kunjungan yang punya tindakan.</p>
        : filter === 'semua' ? <>
          <section aria-labelledby="kasir-open"><h2 id="kasir-open" className="kasir-h">Belum bayar ({open.length})</h2>
            {open.length ? <ul className="kasir-list">{open.map((r) => <Card key={r.id} r={r} today={data.date} />)}</ul> : <p className="muted">Semua sudah lunas.</p>}
          </section>
          {done.length > 0 && <section aria-labelledby="kasir-done"><h2 id="kasir-done" className="kasir-h">Lunas / void hari ini ({done.length})</h2>
            <ul className="kasir-list">{done.map((r) => <Card key={r.id} r={r} today={data.date} />)}</ul>
          </section>}
        </> : shown.length ? <ul className="kasir-list">{shown.map((r) => <Card key={r.id} r={r} today={data.date} />)}</ul>
          : <p className="muted">Tidak ada tagihan untuk saringan ini.</p>}
    </div>
  )
}
