import { useCallback, useEffect, useState } from 'react'
import { Avatar, Button, buttonVariants, Card, Chip, EmptyState, ToggleButton, ToggleButtonGroup } from '@heroui/react'
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

function Row({ r, today }: { r: KasirRow; today: string }) {
  const open = r.status === 'terbuka'
  const old = open && wibDay(r.created_at) !== today
  const meta = [old ? 'Tempo' : fmtTime(r.created_at), (r.items ?? []).join(', '), r.payer_type === 'bpjs' ? 'BPJS' : r.payer_type === 'asuransi' ? 'Asuransi' : '']
  return (
    <li>
      <a className="kasir-card" href={`#/tagihan/${r.visit_id}`} aria-label={`${r.patient_name ?? 'Pasien'}, ${open ? 'belum bayar' : r.status}, ${rp(open ? r.balance_rp : total(r))}`}>
        <Avatar size="sm" color="accent" variant="soft" className="flex shrink-0" aria-hidden="true"><Avatar.Fallback>{initials(r.patient_name)}</Avatar.Fallback></Avatar>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <strong className="[overflow-wrap:anywhere]">{r.patient_name ?? 'Pasien'}</strong>
          <span className="text-sm text-muted">{meta.filter(Boolean).join(' · ')}</span>
        </span>
        <span className="flex flex-col items-end gap-1 text-right tabular-nums">
          <strong>{rp(open ? r.balance_rp : total(r))}</strong>
          <Chip size="sm" variant="soft" color={open ? 'warning' : r.status === 'lunas' ? 'success' : 'danger'}>{open ? 'Belum bayar' : r.status === 'lunas' ? 'Lunas' : 'Void'}</Chip>
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

  if (error) return <Card className="billing state-card items-center"><p role="alert">{error}</p><Button variant="secondary" onPress={load}>Coba lagi</Button></Card>
  if (!data) return <Card className="state-card text-muted">Memuat tagihan…</Card>
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
        <Card className="gap-1"><span className="text-sm text-muted">Belum bayar</span><strong className="text-2xl tabular-nums">{open.length}</strong></Card>
        <Card className="gap-1"><span className="text-sm text-muted">Diterima hari ini</span><strong className="text-2xl tabular-nums">{rev ? rp(rev.amount_rp) : '–'}</strong></Card>
      </div>
      <ToggleButtonGroup aria-label="Saring tagihan" selectionMode="single" disallowEmptySelection isDetached className="mb-3 flex-wrap gap-2"
        selectedKeys={[filter]} onSelectionChange={(k) => { const f = [...k][0]; if (f) setFilter(f as Filter) }}>
        {(Object.keys(FILTERS) as Filter[]).map((f) => <ToggleButton key={f} id={f} className="pick">{FILTERS[f]}</ToggleButton>)}
      </ToggleButtonGroup>
      {data.invoices.length === 0
        ? <Card><EmptyState><strong>Tidak ada tagihan terbuka.</strong>
          <p className="text-sm text-muted">Tagihan muncul setelah dokter menekan Selesai pada kunjungan yang punya tindakan.</p></EmptyState></Card>
        : filter === 'semua' ? <>
          <section aria-labelledby="kasir-open"><h2 id="kasir-open" className="kasir-h">Belum bayar ({open.length})</h2>
            {open.length ? list(open) : <p className="text-muted">Semua sudah lunas.</p>}
          </section>
          {done.length > 0 && <section aria-labelledby="kasir-done"><h2 id="kasir-done" className="kasir-h">Lunas / void hari ini ({done.length})</h2>
            {list(done)}
          </section>}
        </> : shown.length ? list(shown)
          : <p className="text-muted">Tidak ada tagihan untuk saringan ini.</p>}
    </div>
  )
}
