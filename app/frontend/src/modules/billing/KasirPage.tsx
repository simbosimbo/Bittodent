import { useCallback, useEffect, useState } from 'react'
import { Stat } from '../../shared/ui/Stat'
import { StateCard } from '../../shared/ui/StateCard'
import { Button, buttonVariants, Card, EmptyState } from '@heroui/react'
import { FilterChips } from '../../shared/ui/FilterChips'
import { RowLink } from '../../shared/ui/RowLink'
import { SectionTitle } from '../../shared/ui/SectionTitle'
import { StatusDot } from '../../shared/ui/StatusDot'
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

function Row({ r, today }: { r: KasirRow; today: string }) {
  const open = r.status === 'terbuka'
  const old = open && wibDay(r.created_at) !== today
  const meta = [old ? 'Tempo' : fmtTime(r.created_at), (r.items ?? []).join(', '), r.payer_type === 'bpjs' ? 'BPJS' : r.payer_type === 'asuransi' ? 'Asuransi' : '']
  return (
    <li>
      <RowLink href={`#/tagihan/${r.visit_id}`} aria-label={`${r.patient_name ?? 'Pasien'}, ${open ? 'belum bayar' : r.status}, ${rp(open ? r.balance_rp : total(r))}`}
        title={r.patient_name ?? 'Pasien'} sub={meta.filter(Boolean).join(' · ')}
        aside={<><StatusDot status={r.status}>{open ? 'Belum bayar' : r.status === 'lunas' ? 'Lunas' : 'Void'}</StatusDot><strong className="tabular-nums">{rp(open ? r.balance_rp : total(r))}</strong></>} />
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

  if (error) return <StateCard error={error} onRetry={load} />
  if (!data) return <StateCard>Memuat tagihan…</StateCard>
  const open = data.invoices.filter((r) => r.status === 'terbuka')
  const done = data.invoices.filter((r) => r.status !== 'terbuka')
  const shown = filter === 'semua' ? data.invoices : filter === 'belum' ? open
    : filter === 'bpjs' ? data.invoices.filter((r) => r.payer_type === 'bpjs') : open.filter((r) => wibDay(r.created_at) !== data.date)
  const list = (rows: KasirRow[]) => <ul className="m-0 flex list-none flex-col gap-2 p-0">{rows.map((r) => <Row key={r.id} r={r} today={data.date} />)}</ul>
  return (
    <div className="billing kasir">
      <div className="page-head">
        <div><h1>Kasir</h1><p className="text-sm text-muted">Tagihan cabang aktif.</p></div>
        <span className="flex flex-wrap gap-2">
          <a className={buttonVariants({ variant: 'secondary' })} href="#/shift">Shift</a>
          <Button variant="secondary" onPress={load}>Muat ulang</Button>
        </span>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Stat label="Belum bayar" value={open.length} />
        <Stat label="Diterima hari ini" value={rev ? rp(rev.amount_rp) : '–'} />
      </div>
      <FilterChips label="Saring tagihan" className="mb-3" value={filter} onChange={setFilter} options={Object.entries(FILTERS) as [Filter, string][]} />
      {data.invoices.length === 0
        ? <Card><EmptyState><strong>Tidak ada tagihan terbuka.</strong>
          <p className="text-sm text-muted">Tagihan muncul setelah dokter menekan Selesai pada kunjungan yang punya tindakan.</p></EmptyState></Card>
        : filter === 'semua' ? <>
          <section aria-labelledby="kasir-open"><SectionTitle id="kasir-open" count={open.length}>Belum bayar</SectionTitle>
            {open.length ? list(open) : <p className="text-muted">Semua sudah lunas.</p>}
          </section>
          {done.length > 0 && <section aria-labelledby="kasir-done"><SectionTitle id="kasir-done" count={done.length}>Lunas / void hari ini</SectionTitle>
            {list(done)}
          </section>}
        </> : shown.length ? list(shown)
          : <p className="text-muted">Tidak ada tagihan untuk saringan ini.</p>}
    </div>
  )
}
