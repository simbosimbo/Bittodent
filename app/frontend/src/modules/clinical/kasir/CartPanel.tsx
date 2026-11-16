import { Button, Chip } from '@heroui/react'
import { Select } from '../../../shared/ui/Select'
import { rp } from '../../../shared/format'
import type { PriceLevel, Procedure, Surface } from '../api'
import { surfaceLabel } from '../legend'

/**
 * TK01/TK03 right column: this visit's draft tindakan that will be billed (status selesai, with a code), price per row + total.
 * A preview from the price list (D-045): the invoice line made at Selesai stays the record. Rows stay Draf until the dentist signs.
 */
export function CartPanel({ rows, prices, me, onVariant, onDiscard }: {
  rows: Procedure[]; prices: Record<string, PriceLevel[]>; me: string
  onVariant: (p: Procedure, variant: string) => void; onDiscard: (p: Procedure) => void
}) {
  const priceOf = (p: Procedure) => prices[p.procedure_code ?? '']?.find((l) => l.variant === p.variant)?.price_rp ?? null
  const total = rows.reduce((s, p) => s + (priceOf(p) ?? 0), 0)
  const name = (p: Procedure) => p.name ?? p.procedure_code ?? ''
  return (
    <div className="kasir-cart">
      <div className="card-head"><h2>Kunjungan ini</h2><Chip size="sm" className="clin-tag clin-draft">Draf</Chip></div>
      {!rows.length ? <div className="kasir-empty"><p className="kasir-empty-title">Belum ada tindakan</p>
        <p className="muted small">Pilih dari katalog. Tindakan tanpa gigi langsung masuk; tindakan per gigi meminta Anda memilih gigi di odontogram.</p></div> : (
        <ul className="kasir-rows">
          {rows.map((p) => {
            const lv = prices[p.procedure_code ?? ''] ?? []
            const price = priceOf(p)
            const own = p.created_by === me
            const where = p.tooth === null ? 'Tanpa gigi'
              : `Gigi ${p.tooth}${p.surfaces ? ' · ' + [...p.surfaces].map((s) => surfaceLabel(p.tooth!, s as Surface)).join('') : ''}`
            return (
              <li key={p.id} className="kasir-row">
                <div className="grow">
                  <strong>{name(p)}</strong> <Chip size="sm" className="clin-tag clin-draft">Draf</Chip>
                  <p className="muted small">{where} · {lv.find((l) => l.variant === p.variant)?.label ?? p.variant} · {p.procedure_code}</p>
                  {own && lv.length > 1 && (
                    <Select aria-label={`Tingkat ${name(p)}`} value={p.variant} onChange={(e) => onVariant(p, e.target.value)}>
                      {lv.map((l) => <option key={l.variant} value={l.variant}>{l.label}</option>)}
                    </Select>
                  )}
                </div>
                <div className="kasir-row-end">
                  <span className={price === null ? 'muted small' : 'kasir-price'}>{price === null ? 'Harga menunggu diisi pemilik' : rp(price)}</span>
                  {own && <Button size="sm" variant="ghost" aria-label={`Hapus ${name(p)}`} onPress={() => onDiscard(p)}>Hapus</Button>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="kasir-total" role="status" aria-label="Total"><span>Total</span> <strong>{rp(total)}</strong></p>
      <p className="muted small">Harga final mengikuti tagihan.</p>
      <p className="muted small">Harga dari pemilik klinik; Anda tidak bisa mengubahnya. Diskon hanya oleh kasir.</p>
    </div>
  )
}
