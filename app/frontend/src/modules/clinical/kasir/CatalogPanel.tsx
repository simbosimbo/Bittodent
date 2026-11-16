import { useState } from 'react'
import { Card } from '@heroui/react'
import { rp } from '../../../shared/format'
import type { CatalogRow, PriceLevel } from '../api'

/** Treat areas the visit screen can add in one step (range/quadrant/arch stay in the tooth sheet). */
export const KASIR_AREAS = ['mouth', 'surface', 'tooth']
const WHERE: Record<string, string> = { mouth: 'Tanpa gigi', surface: 'Per gigi dan permukaan', tooth: 'Per gigi' }

/** TK01 left column: the clinic's tindakan with today's price (D-045, read only). No price = "Harga menunggu diisi pemilik", not addable. */
export function CatalogPanel({ rows, prices, armed, onPick }: {
  rows: CatalogRow[]; prices: Record<string, PriceLevel[]>; armed: string | null; onPick: (r: CatalogRow) => void
}) {
  const [q, setQ] = useState('')
  const shown = rows.filter((r) => KASIR_AREAS.includes(r.treat_area) && (!q.trim() || `${r.name} ${r.procedure_code}`.toLowerCase().includes(q.trim().toLowerCase())))
  return (
    <Card render={(p) => <section {...p} />} className="kasir-catalog" aria-label="Katalog tindakan">
      <div className="card-head"><h2>Tindakan</h2><span className="muted small">Harga dari pemilik</span></div>
      <input type="search" className="tsheet-search" placeholder="Cari tindakan atau kode" aria-label="Cari tindakan" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="kasir-list">
        {shown.map((r) => {
          const lv = prices[r.procedure_code] ?? []
          const min = lv.length ? Math.min(...lv.map((l) => l.price_rp)) : null
          return (
            <li key={r.procedure_code}>
              <button type="button" className="kasir-item" disabled={min === null} aria-pressed={armed === r.procedure_code} onClick={() => onPick(r)}>
                <span className="kasir-item-top">
                  <strong className="kasir-name" title={r.name}>{r.name}</strong>
                  {min !== null && <span className="kasir-price">{`${lv.length > 1 ? 'mulai ' : ''}${rp(min)}`}</span>}
                </span>
                <span className="muted small">{min === null ? 'Harga menunggu diisi pemilik' : `${WHERE[r.treat_area]} · ${r.procedure_code}`}</span>
              </button>
            </li>
          )
        })}
        {!shown.length && <li className="muted small">{q ? 'Tidak ada tindakan yang cocok.' : 'Belum ada tindakan di katalog klinik.'}</li>}
      </ul>
    </Card>
  )
}
