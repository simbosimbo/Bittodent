import { useEffect, useState } from 'react'
import { errorText } from '../../shared/api/http'
import { fmtDateTime, fmtYmdShort, initials, rp } from '../../shared/format'
import { Kop, useLetterhead } from '../../shared/letterhead'
import type { Me } from '../../shared/session'
import { revenueReport, type Period, type RevenueReport } from './api'
import './reporting.css'

// Boards KL07-KL09 (owner, tab Laporan): period chips, KPI, 7-day bars, cash differences, report kinds as cards, drill-down lists,
// download sheet (PDF = A4 print with letterhead, Excel = CSV). The integrity report stays one kind away (#/laporan/integritas).
const PERIODS: Record<Period, string> = { today: 'Hari ini', '7d': '7 hari', month: 'Bulan ini' }
const KIND: Record<string, string> = { tunai: 'Tunai', qris: 'QRIS', edc: 'Debit', transfer: 'Transfer', bpjs: 'BPJS', asuransi: 'Asuransi' }
const jt = (n: number) => (Math.abs(n) >= 1e6 ? `Rp ${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt` : rp(n))
const DAY = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
type View = 'ringkasan' | 'jenis' | 'metode' | 'dokter' | 'tindakan' | 'piutang'
type Table = { title: string; head: string[]; rows: (string | number)[][] }

function table(r: RevenueReport, v: View): Table {
  if (v === 'dokter') return { title: 'Pendapatan per dokter', head: ['Dokter', 'Tindakan', 'Pasien', 'Jumlah'],
    rows: r.by_doctor.map((d) => [d.name, d.procedures, d.patients, d.amount_rp]) }
  if (v === 'tindakan') return { title: 'Pendapatan per tindakan', head: ['Tindakan', 'Jumlah tindakan', 'Jumlah'], rows: r.by_procedure.map((p) => [p.name, p.count, p.amount_rp]) }
  if (v === 'piutang') return { title: 'Piutang', head: ['Pasien', 'Umur (hari)', 'Tindakan', 'Jumlah'],
    rows: r.receivables.map((p) => [p.patient_name, p.days, p.items.join(', '), p.amount_rp]) }
  return { title: 'Laporan Pendapatan', head: ['Metode', 'Transaksi', 'Jumlah'],
    rows: r.by_method.map((m) => [`${KIND[m.kind] ?? m.kind}${m.bank_name ? ' ' + m.bank_name : ''}`, m.count, m.amount_rp]) }
}
const csv = (t: Table) => [t.head, ...t.rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')

export default function RevenuePage({ me }: { me: Me }) {
  const [period, setPeriod] = useState<Period>('month')
  const [r, setR] = useState<RevenueReport | null>(null)
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('ringkasan')
  const [sheet, setSheet] = useState(false)
  const [a4, setA4] = useState(false)
  const l = useLetterhead()
  useEffect(() => { setR(null); setError(''); revenueReport(period).then(setR, (e) => setError(errorText(e))) }, [period])
  useEffect(() => { if (a4) { window.print(); setA4(false) } }, [a4])

  const t = r && table(r, view)
  const range = r ? (r.from === r.to ? fmtYmdShort(r.from) : `${fmtYmdShort(r.from)} – ${fmtYmdShort(r.to)}`) : ''
  const delta = r && r.prev_revenue_rp > 0 ? Math.round((r.revenue_rp / r.prev_revenue_rp - 1) * 100) : null
  const max = r ? Math.max(1, ...r.daily.map((d) => d.amount_rp)) : 1
  const download = () => {
    if (!t) return
    // Excel = CSV with ";" (opens in Excel id-ID); built in the browser, nothing cached server-side.
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv(t)], { type: 'text/csv;charset=utf-8' }))
    a.download = `${t.title.toLowerCase().replace(/\s+/g, '-')}-${r!.from}-${r!.to}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="rev">
      <div className="page-head">
        <div>
          {view !== 'ringkasan' && <button className="btn btn-link" onClick={() => setView(view === 'jenis' ? 'ringkasan' : 'jenis')}>← Kembali</button>}
          <h1>{view === 'ringkasan' || view === 'jenis' ? 'Laporan' : t?.title}</h1>
          <p className="muted small">{range}{r && ` · Cabang ${r.branch.name}`}</p>
        </div>
        <span className="toolbar">
          {view === 'ringkasan' && <button className="btn" onClick={() => setView('jenis')}>Jenis</button>}
          <button className="btn" onClick={() => setSheet(true)} disabled={!r}>Unduh</button>
        </span>
      </div>
      <div className="rev-chips" role="radiogroup" aria-label="Periode">
        {(Object.keys(PERIODS) as Period[]).map((p) => (
          <button key={p} type="button" role="radio" aria-checked={period === p} className="chip-method" onClick={() => setPeriod(p)}>{PERIODS[p]}</button>
        ))}
      </div>
      {error ? <div className="card state-card" role="alert">{error}</div> : !r ? <div className="card state-card muted">Memuat laporan…</div> : view === 'ringkasan' ? <>
        <div className="rev-kpi">
          <div className="card"><span className="muted small">Pendapatan</span><strong>{jt(r.revenue_rp)}</strong>
            {delta !== null && <span className="small muted">{delta >= 0 ? '+' : ''}{delta}% vs periode sebelumnya</span>}</div>
          <div className="card"><span className="muted small">Transaksi</span><strong>{r.transactions}</strong></div>
          <div className="card"><span className="muted small">Piutang</span><strong>{jt(r.receivable_rp)}</strong>
            <span className="small muted">{r.receivable_patients} pasien</span></div>
        </div>
        <section className="card" aria-labelledby="rev-7">
          <h2 id="rev-7">Pendapatan 7 hari</h2>
          <ol className="rev-bars">
            {r.daily.map((d) => (
              <li key={d.date} aria-label={`${fmtYmdShort(d.date)}: ${rp(d.amount_rp)}`}>
                <span className="rev-bar" style={{ height: `${Math.round((d.amount_rp / max) * 100)}%` }} />
                <span className="small muted">{DAY[new Date(d.date + 'T00:00:00Z').getUTCDay()]}</span>
              </li>
            ))}
          </ol>
        </section>
        {r.shift_differences.map((s) => (
          <section key={s.closed_at} className="card rev-diff" aria-label="Selisih kas">
            <div><strong>Selisih kas {fmtDateTime(s.closed_at)}</strong><span className="muted small">{s.user_name}{s.reason && ` · ${s.reason}`}</span></div>
            <strong>{s.difference_rp < 0 ? '- ' : '+ '}{rp(Math.abs(s.difference_rp))}</strong>
          </section>
        ))}
      </> : view === 'jenis' ? (
        <ul className="rev-cards">
          {([['metode', 'Pendapatan', 'Per metode dan bank'], ['dokter', 'Per dokter', r.by_doctor.slice(0, 3).map((d) => d.name).join(', ') || 'Belum ada'],
            ['tindakan', 'Per tindakan', r.by_procedure.slice(0, 3).map((p) => p.name).join(', ') || 'Belum ada'],
            ['piutang', 'Piutang', `${r.receivable_patients} pasien, ${jt(r.receivable_rp)}`]] as [View, string, string][]).map(([v, name, sub]) => (
            <li key={v}><button className="rev-card" onClick={() => setView(v)}><strong>{name}</strong><span className="muted small">{sub}</span></button></li>
          ))}
          <li><a className="rev-card" href="#/laporan/integritas"><strong>Integritas</strong><span className="muted small">Per dokter: koreksi, diskon, tanpa tagihan</span></a></li>
        </ul>
      ) : (
        <ul className="rev-cards">
          {view === 'piutang' && <li className="card"><span className="muted small">Total piutang</span> <strong>{jt(r.receivable_rp)}</strong> · {r.receivable_patients} pasien</li>}
          {t!.rows.length === 0 ? <li className="muted">Belum ada data di periode ini.</li> : t!.rows.map((row, i) => (
            <li key={i} className="rev-row">
              {view !== 'metode' && view !== 'tindakan' && <span className="avatar" aria-hidden="true">{initials(String(row[0]))}</span>}
              <span className="grow"><strong>{row[0]}</strong><span className="muted small">{view === 'dokter' ? `${row[1]} tindakan · ${row[2]} pasien`
                : view === 'piutang' ? `${row[1]} hari · ${row[2]}` : `${row[1]} ${view === 'metode' ? 'transaksi' : 'tindakan'}`}</span></span>
              <strong>{jt(Number(row.at(-1)))}</strong>
            </li>
          ))}
        </ul>
      )}
      {sheet && t && (
        <div className="overlay" onClick={() => setSheet(false)}>
          <div className="card dialog" role="dialog" aria-modal="true" aria-labelledby="dl-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="dl-title">Unduh laporan</h2>
            <p className="muted small">{t.title} · {range} · {r!.branch.name}</p>
            <div className="dialog-actions">
              <button className="btn" onClick={() => { download(); setSheet(false) }}>Excel</button>
              <button className="btn btn-primary" onClick={() => { setSheet(false); setA4(true) }}>Unduh PDF</button>
            </div>
            <p className="muted small">PDF lewat dialog cetak: pilih "Simpan sebagai PDF".</p>
            <button className="btn btn-ghost btn-block" onClick={() => setSheet(false)}>Batal</button>
          </div>
        </div>
      )}
      {r && t && (
        <section className="a4" aria-hidden="true">
          <header>{l ? <Kop l={l} branchId={r.branch.id} /> : <strong>{me.active.tenant_name}</strong>}<span>Cabang {r.branch.name}</span></header>
          <h2>{t.title}</h2>
          <p>{range} · Cabang {r.branch.name} · DATA SINTETIS</p>
          <p>Pendapatan {rp(r.revenue_rp)} · Transaksi {r.transactions} · Piutang {rp(r.receivable_rp)}</p>
          <table>
            <thead><tr>{t.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{t.rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{j === row.length - 1 ? rp(Number(c)) : c}</td>)}</tr>)}</tbody>
          </table>
          <footer>Dicetak {fmtDateTime(new Date().toISOString())} · {me.user.name} · {r.branch.name}</footer>
        </section>
      )}
    </div>
  )
}
