import type { LedgerRow, Patient } from '../data/types'
import { dateLabel, rupiah } from '../lib/format'
import { Badge, ClaimPendingBadge } from './ui'

const METHOD = { tunai: 'Tunai', transfer: 'Transfer', kartu: 'Kartu debit/kredit', qris: 'QRIS' }
// Buku besar berjalan. TANPA diagnosis: hanya nama tindakan, pembayaran, klaim.
export function Ledger({ rows, patients, showPatient, highlight }: { rows: LedgerRow[]; patients: Patient[]; showPatient?: boolean; highlight?: string | null }) {
  let bal = 0
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  return (
    <div className="table-wrap">
      <table className="table ledger">
        <thead><tr><th>Tanggal</th>{showPatient && <th>Pasien</th>}<th>Jenis</th><th>Keterangan</th><th className="num">Tagihan</th><th className="num">Bayar / Klaim</th><th className="num">Saldo</th></tr></thead>
        <tbody>
          {sorted.map((r) => {
            bal += r.kind === 'tindakan' ? r.amount : -r.amount
            return (
              <tr key={r.id} className={`k-${r.kind} ${r.procId && r.procId === highlight ? 'row-new' : ''}`}>
                <td>{dateLabel(r.date)}</td>
                {showPatient && <td>{patients.find((p) => p.id === r.patientId)?.name.split(' ')[0]}</td>}
                <td><Badge tone={r.kind === 'tindakan' ? 'neutral' : r.kind === 'pembayaran' ? 'success' : 'info'}>{r.kind === 'tindakan' ? 'Tindakan' : r.kind === 'pembayaran' ? 'Pembayaran' : 'Klaim asuransi'}</Badge></td>
                <td>
                  {r.desc}{r.method && ` · ${METHOD[r.method]}`}
                  {r.kind === 'klaim' && <> {r.claimStatus === 'menunggu' ? <ClaimPendingBadge /> : <Badge tone="success">Dibayar asuransi</Badge>}</>}
                </td>
                <td className="num">{r.kind === 'tindakan' ? rupiah(r.amount) : ''}</td>
                <td className="num">{r.kind !== 'tindakan' ? '−' + rupiah(r.amount) : ''}</td>
                <td className="num strong">{rupiah(bal)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
