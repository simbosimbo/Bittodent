import { useEffect, useState, type ReactNode } from 'react'
import { errorText } from '../../shared/api/http'
import { fmtDateTime, num, rp, todayWib } from '../../shared/format'
import { DateField } from '../../shared/ui/DateField'
import { useIsMobile } from '../../shared/useIsMobile'
import './reporting.css'
import { ReversalApprovals } from '../billing'
import { CorrectionApprovals } from '../clinical'
import { auditEvents, integrityReport, type Alert, type AuditPage, type IntegrityReport, type Totals } from './api'

const ALERT: Record<Alert['kind'], string> = {
  tanpa_tagihan: 'Tanpa tagihan', luar_setelah_datang: 'Luar setelah datang', rp0_menunggu: 'Rp0 menunggu persetujuan',
  disetujui_sendiri: 'Disetujui sendiri', batal_tanpa_tagihan: 'Batal (tanpa tagihan, pengecualian)',
  koreksi_menunggu: 'Koreksi tindakan menunggu', pembalikan_menunggu: 'Nota kredit/void/refund menunggu',
  pembalikan_disetujui_sendiri: 'Pembalikan disetujui sendiri', tarif_nol: 'Anomali tarif Rp0', tinjau_koreksi_lama: 'Perlu tinjau koreksi > 2 hari',
}
const BILLING_ALERTS: Alert['kind'][] = ['rp0_menunggu', 'disetujui_sendiri', 'pembalikan_menunggu', 'pembalikan_disetujui_sendiri', 'tarif_nol', 'tinjau_koreksi_lama']
const COLS: [keyof IntegrityReport['totals'], string][] = [['external', 'Luar'], ['external_pending', 'Luar menunggu'], ['rp0', 'Diskon 100% disetujui'],
  ['rp0_pending', 'Rp0 menunggu'], ['discounts', 'Diskon'], ['full_discounts', 'Diskon 100%'], ['self_approved', 'Disetujui sendiri'],
  ['unbilled_visits', 'Tanpa tagihan'], ['batal', 'Batal'], ['closed_without_invoice', 'Batal tanpa tagihan'],
  ['tariff_zero', 'Anomali tarif Rp0'], ['tariff_zero_pending', 'Anomali tarif menunggu']]
type Key = keyof IntegrityReport['totals']
// Unit D: corrections are their own documents, never "Rp0". [group, columns]; *_rp columns are rupiah.
const CORR: [string, [Key, string][]][] = [
  ['Koreksi klinis', [['corr_salah_kode', 'Salah kode'], ['corr_salah_situs', 'Salah situs'], ['corr_salah_provider', 'Salah dokter'],
    ['corr_tidak_dikerjakan', 'Tidak dikerjakan'], ['corr_total_rp', 'Nilai baris'], ['corr_outside_window', 'Lewat tenggat'],
    ['corr_owner_approved', 'Disetujui pemilik'], ['corr_self_approved', 'Disetujui sendiri'], ['corr_pending', 'Menunggu']]],
  ['Nota kredit', [['cn_partial', 'Sebagian'], ['cn_partial_rp', 'Rp sebagian'], ['cn_full', 'Penuh'], ['cn_full_rp', 'Rp penuh'],
    ['cn_pending', 'Menunggu'], ['cn_pending_rp', 'Rp menunggu']]],
  ['Refund', [['refunds', 'Disetujui'], ['refund_rp', 'Rp'], ['refund_pending', 'Menunggu'], ['refund_pending_rp', 'Rp menunggu']]],
  ['Void', [['voids', 'Disetujui'], ['void_rp', 'Rp'], ['void_pending', 'Menunggu']]],
  ['Pembalikan', [['reversal_self_approved', 'Disetujui sendiri']]],
]
const cell = (k: Key, v: number) => (k.endsWith('_rp') ? rp(Math.round(v)) : num(v))

/** Section error with a retry (each section loads on its own; one failure never blanks the page). */
const Retry = ({ msg, onRetry }: { msg: string; onRetry: () => void }) => (
  <div className="form-error report-error" role="alert">{msg} <button type="button" className="btn" onClick={onRetry}>Coba lagi</button></div>
)

/** Phone card: name + one key figure, the rest as label:value pairs. */
function FigureCard({ name, main, mainLabel, muted, children }: { name: string; main: string; mainLabel: string; muted?: boolean; children: ReactNode }) {
  return (
    <li className={'report-card' + (muted ? ' is-avg' : '')}>
      <div className="report-card-head">
        <strong>{name}</strong>
        <span className="report-card-main">{main}<small>{mainLabel}</small></span>
      </div>
      {children}
    </li>
  )
}
const Pairs = ({ items }: { items: [string, string][] }) => (
  <dl className="report-pairs">{items.map(([l, v]) => <div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}</dl>
)

// Minimal owner page (unit 6): per-dentist integrity counts, alerts queue, read-only audit log. Polished screens 25–28: UI unit.
// Phone (≤720px): KPIs, per-dentist cards and audit cards instead of the tables; desktop keeps the tables.
export default function ReportPage() {
  const mobile = useIsMobile()
  const [range, setRange] = useState({ from: todayWib().slice(0, 8) + '01', to: todayWib() })
  const [report, setReport] = useState<IntegrityReport | null>(null)
  const [audit, setAudit] = useState<AuditPage | null>(null)
  const [page, setPage] = useState(1)
  const [repError, setRepError] = useState('')
  const [audError, setAudError] = useState('')
  const [repTry, setRepTry] = useState(0)
  const [audTry, setAudTry] = useState(0)

  useEffect(() => { setRepError(''); integrityReport(range.from, range.to).then(setReport, (e) => setRepError(errorText(e))) }, [range, repTry])
  useEffect(() => { setAudError(''); auditEvents({ page }).then(setAudit, (e) => setAudError(errorText(e))) }, [page, audTry])
  const repRetry = <Retry msg={repError} onRetry={() => setRepTry(repTry + 1)} />

  const dentistCard = (name: string, d: Totals, muted = false) => (
    <FigureCard key={name} name={name} main={rp(Math.round(d.discount_total_rp))} mainLabel="total diskon" muted={muted}>
      <Pairs items={COLS.map(([k, l]) => [l, num(d[k])])} />
    </FigureCard>
  )
  const corrCard = (name: string, d: Totals, muted = false) => (
    <FigureCard key={name} name={name} main={rp(Math.round(d.corr_total_rp))} mainLabel="nilai koreksi" muted={muted}>
      {CORR.map(([g, cols]) => (
        <div key={g} className="report-group"><h3>{g}</h3><Pairs items={cols.map(([k, l]) => [l, cell(k, d[k])])} /></div>
      ))}
    </FigureCard>
  )

  return (
    <div className={mobile ? 'report-m' : undefined}>
      <div className="page-head"><div><h1>Laporan per dokter</h1><p className="muted small">Hanya pemilik. Setiap pembukaan laporan tercatat di audit.</p></div></div>
      <div className="card">
        <div className={mobile ? 'report-range' : 'toolbar'}>
          <label>Dari <DateField value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
          <label>Sampai <DateField value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
        </div>
        {repError ? repRetry : !report ? <p className="muted">Memuat…</p> : mobile ? (
          <>
            <div className="report-kpis" aria-label="Ringkasan klinik">
              {([['Total diskon', rp(Math.round(report.totals.discount_total_rp))], ['Tanpa tagihan', num(report.totals.unbilled_visits)],
                ['Rp0 menunggu', num(report.totals.rp0_pending)], ['Koreksi menunggu', num(report.totals.corr_pending)]] as const).map(([l, v]) => (
                <div key={l} className="report-kpi"><span className="report-kpi-value">{v}</span><span className="report-kpi-label">{l}</span></div>
              ))}
            </div>
            {report.dentists.length === 0 && <p className="muted">Tidak ada data dokter pada rentang ini.</p>}
            <ul className="report-cards" aria-label="Per dokter">
              {report.dentists.map((d) => dentistCard(d.name, d))}
              {dentistCard('Rata-rata klinik', report.average, true)}
            </ul>
          </>
        ) : (
          <div className="table-scroll"><table className="table">
            <thead><tr><th>Dokter</th>{COLS.map(([k, l]) => <th key={k}>{l}</th>)}<th>Total diskon</th></tr></thead>
            <tbody>
              {report.dentists.map((d) => (
                <tr key={d.dentist_id ?? '-'}><td>{d.name}</td>{COLS.map(([k]) => <td key={k}>{num(d[k])}</td>)}<td>{rp(d.discount_total_rp)}</td></tr>
              ))}
              <tr className="muted"><td>Rata-rata klinik</td>{COLS.map(([k]) => <td key={k}>{num(report.average[k])}</td>)}<td>{rp(Math.round(report.average.discount_total_rp))}</td></tr>
            </tbody>
          </table></div>
        )}
        <p className="muted small">Luar &amp; tanpa tagihan = dokter pelaksana tindakan; diskon = dokter kunjungan; anomali tarif Rp0 = dokter baris tagihan (bukan koreksi, bukan diskon); batal = janji dibatalkan/tidak datang atau kehadiran dibatalkan.</p>
      </div>

      <div className="card">
        <h2>Koreksi &amp; pembalikan</h2>
        {repError ? repRetry : !report ? <p className="muted">Memuat…</p> : mobile ? (
          <ul className="report-cards" aria-label="Koreksi per dokter">
            {report.dentists.map((d) => corrCard(d.name, d))}
            {corrCard('Rata-rata klinik', report.average, true)}
          </ul>
        ) : (
          <div className="table-scroll"><table className="table">
            <thead>
              <tr><th rowSpan={2}>Dokter</th>{CORR.map(([g, cols]) => <th key={g} colSpan={cols.length}>{g}</th>)}</tr>
              <tr>{CORR.flatMap(([, cols]) => cols.map(([k, l]) => <th key={k}>{l}</th>))}</tr>
            </thead>
            <tbody>
              {report.dentists.map((d) => (
                <tr key={d.dentist_id ?? '-'}><td>{d.name}</td>{CORR.flatMap(([, cols]) => cols.map(([k]) => <td key={k}>{cell(k, d[k])}</td>))}</tr>
              ))}
              <tr className="muted"><td>Rata-rata klinik</td>{CORR.flatMap(([, cols]) => cols.map(([k]) => <td key={k}>{cell(k, report.average[k])}</td>))}</tr>
            </tbody>
          </table></div>
        )}
        <p className="muted small">Koreksi klinis = dokter pelaksana tindakan asli (jumlah = yang berlaku; nilai = harga baris tertagih tindakan itu). Nota kredit &amp; refund = dokter baris tagihan; void = dokter kunjungan. Nota kredit dan void tidak pernah dihitung sebagai Rp0.</p>
      </div>

      <div className="card">
        <h2>Peringatan</h2>
        {repError ? repRetry : !report ? <p className="muted">Memuat…</p> : report.alerts.length === 0 && <p className="muted">Tidak ada peringatan pada rentang ini.</p>}
        <ul>
          {report?.alerts.map((a) => (
            <li key={a.kind + a.ref_id}>
              <strong>{ALERT[a.kind]}</strong> · {a.patient_name ?? '—'} · {a.dentist_name ?? '—'} · {a.at ? fmtDateTime(a.at) + ' WIB' : ''}
              {a.patient_id && <> · <a href={`#/rekam-medis/${a.patient_id}`}>Buka rekam</a></>}
              {a.visit_id && BILLING_ALERTS.includes(a.kind) && <> · <a href={`#/tagihan/${a.visit_id}`}>Buka tagihan</a></>}
            </li>
          ))}
        </ul>
      </div>

      <CorrectionApprovals />

      <ReversalApprovals />

      <div className="card">
        <h2>Audit log</h2>
        <p className="muted small">Tidak dapat dihapus atau diubah. Koreksi tercatat sebagai baris baru.</p>
        {audError ? <Retry msg={audError} onRetry={() => setAudTry(audTry + 1)} /> : mobile ? (
          !audit ? <p className="muted">Memuat…</p> : audit.data.length === 0 ? <p className="muted">Belum ada catatan audit.</p> : (
            <ul className="report-cards" aria-label="Audit log">
              {audit.data.map((r) => (
                <li key={r.id} className="report-card report-audit">
                  <strong>{r.action}</strong>
                  <span className="muted small">{fmtDateTime(r.occurred_at)} WIB · {r.actor_name ?? (r.actor_type === 'user' ? '—' : 'Sistem')}</span>
                  <span className="muted small">{r.entity_type}{r.entity_id ? ' ' + r.entity_id.slice(0, 8) : ''}</span>
                </li>
              ))}
            </ul>
          )
        ) : <>
          <div className="table-scroll"><table className="table">
            <thead><tr><th>Waktu, WIB</th><th>Pengguna</th><th>Aksi</th><th>Objek</th></tr></thead>
            <tbody>
              {audit?.data.map((r) => (
                <tr key={r.id}><td>{fmtDateTime(r.occurred_at)}</td><td>{r.actor_name ?? (r.actor_type === 'user' ? '—' : 'Sistem')}</td><td>{r.action}</td>
                  <td>{r.entity_type}{r.entity_id ? ' ' + r.entity_id.slice(0, 8) : ''}</td></tr>
              ))}
            </tbody>
          </table></div>
          {!audit ? <p className="muted">Memuat…</p> : audit.data.length === 0 && <p className="muted">Belum ada catatan audit.</p>}
        </>}
        {audit && !audError && (mobile ? (
          <div className="report-pager">
            <span className="muted small">Halaman {audit.page} dari {audit.last_page} · {num(audit.total)} catatan</span>
            <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</button>
            <button className="btn" disabled={page >= audit.last_page} onClick={() => setPage(page + 1)}>Berikutnya</button>
          </div>
        ) : (
          <div className="toolbar">
            <button className="btn btn-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</button>
            <span className="muted small">Halaman {audit.page} dari {audit.last_page} · {audit.total} catatan</span>
            <button className="btn btn-xs" disabled={page >= audit.last_page} onClick={() => setPage(page + 1)}>Berikutnya</button>
          </div>
        ))}
      </div>
    </div>
  )
}
