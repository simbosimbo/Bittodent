import { useEffect, useState } from 'react'
import { errorText } from '../../shared/api/http'
import { fmtDateTime, todayWib } from '../../shared/format'
import { ReversalApprovals } from '../billing'
import { CorrectionApprovals } from '../clinical'
import { auditEvents, integrityReport, type Alert, type AuditPage, type IntegrityReport } from './api'

const rp = (n: number) => 'Rp' + n.toLocaleString('id-ID')
const ALERT: Record<Alert['kind'], string> = {
  tanpa_tagihan: 'Tanpa tagihan', luar_setelah_datang: 'Luar setelah datang', rp0_menunggu: 'Rp0 menunggu persetujuan',
  disetujui_sendiri: 'Disetujui sendiri', batal_tanpa_tagihan: 'Batal (tanpa tagihan, pengecualian)',
}
const COLS: [keyof IntegrityReport['totals'], string][] = [['external', 'Luar'], ['external_pending', 'Luar menunggu'], ['rp0', 'Rp0'],
  ['rp0_pending', 'Rp0 menunggu'], ['discounts', 'Diskon'], ['full_discounts', 'Diskon 100%'], ['self_approved', 'Disetujui sendiri'],
  ['unbilled_visits', 'Tanpa tagihan'], ['batal', 'Batal'], ['closed_without_invoice', 'Batal tanpa tagihan']]

// Minimal owner page (unit 6): per-dentist integrity counts, alerts queue, read-only audit log. Polished screens 25–28: UI unit.
export default function ReportPage() {
  const [range, setRange] = useState({ from: todayWib().slice(0, 8) + '01', to: todayWib() })
  const [report, setReport] = useState<IntegrityReport | null>(null)
  const [audit, setAudit] = useState<AuditPage | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => { integrityReport(range.from, range.to).then(setReport, (e) => setError(errorText(e))) }, [range])
  useEffect(() => { auditEvents({ page }).then(setAudit, (e) => setError(errorText(e))) }, [page])

  return (
    <div>
      <div className="page-head"><div><h1>Laporan per dokter</h1><p className="muted small">Hanya pemilik. Setiap pembukaan laporan tercatat di audit.</p></div></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="card">
        <div className="toolbar">
          <label>Dari <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
          <label>Sampai <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
        </div>
        {!report ? <p className="muted">Memuat…</p> : (
          <table className="table">
            <thead><tr><th>Dokter</th>{COLS.map(([k, l]) => <th key={k}>{l}</th>)}<th>Total diskon</th></tr></thead>
            <tbody>
              {report.dentists.map((d) => (
                <tr key={d.dentist_id ?? '-'}><td>{d.name}</td>{COLS.map(([k]) => <td key={k}>{d[k]}</td>)}<td>{rp(d.discount_total_rp)}</td></tr>
              ))}
              <tr className="muted"><td>Rata-rata klinik</td>{COLS.map(([k]) => <td key={k}>{report.average[k].toLocaleString('id-ID')}</td>)}<td>{rp(Math.round(report.average.discount_total_rp))}</td></tr>
            </tbody>
          </table>
        )}
        <p className="muted small">Luar &amp; tanpa tagihan = dokter pelaksana tindakan; diskon/Rp0 = dokter kunjungan; batal = janji dibatalkan/tidak datang atau kehadiran dibatalkan.</p>
      </div>

      <div className="card">
        <h2>Peringatan</h2>
        {report && report.alerts.length === 0 && <p className="muted">Tidak ada peringatan pada rentang ini.</p>}
        <ul>
          {report?.alerts.map((a) => (
            <li key={a.kind + a.ref_id}>
              <strong>{ALERT[a.kind]}</strong> · {a.patient_name ?? '—'} · {a.dentist_name ?? '—'} · {a.at ? fmtDateTime(a.at) + ' WIB' : ''}
              {a.patient_id && <> · <a href={`#/rekam-medis/${a.patient_id}`}>Buka rekam</a></>}
              {a.visit_id && (a.kind === 'rp0_menunggu' || a.kind === 'disetujui_sendiri') && <> · <a href={`#/tagihan/${a.visit_id}`}>Buka tagihan</a></>}
            </li>
          ))}
        </ul>
      </div>

      <CorrectionApprovals />

      <ReversalApprovals />

      <div className="card">
        <h2>Audit log</h2>
        <p className="muted small">Tidak dapat dihapus atau diubah. Koreksi tercatat sebagai baris baru.</p>
        <table className="table">
          <thead><tr><th>Waktu, WIB</th><th>Pengguna</th><th>Aksi</th><th>Objek</th></tr></thead>
          <tbody>
            {audit?.data.map((r) => (
              <tr key={r.id}><td>{fmtDateTime(r.occurred_at)}</td><td>{r.actor_name ?? (r.actor_type === 'user' ? '—' : 'Sistem')}</td><td>{r.action}</td>
                <td>{r.entity_type}{r.entity_id ? ' ' + r.entity_id.slice(0, 8) : ''}</td></tr>
            ))}
          </tbody>
        </table>
        {audit && (
          <div className="toolbar">
            <button className="btn btn-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</button>
            <span className="muted small">Halaman {audit.page} dari {audit.last_page} · {audit.total} catatan</span>
            <button className="btn btn-xs" disabled={page >= audit.last_page} onClick={() => setPage(page + 1)}>Berikutnya</button>
          </div>
        )}
      </div>
    </div>
  )
}
