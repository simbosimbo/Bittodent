import { useEffect, useState } from 'react'
import { errorText } from '../../shared/api/http'
import { searchPatients, type PatientRow } from './api'
import { PatientPage } from './Records'

const SEX: Record<string, string> = { laki_laki: 'Laki-laki', perempuan: 'Perempuan' }
const PAYER: Record<string, string> = { umum: 'Umum', asuransi: 'Asuransi', bpjs: 'BPJS' }
// Accepts date-only or ISO datetime; uses only the YYYY-MM-DD part (UTC) so the day never shifts. null when unparseable.
const birthDate = (d: string | null) => {
  const m = /^\d{4}-\d{2}-\d{2}/.exec(d ?? '')
  const t = m ? new Date(m[0] + 'T00:00:00Z') : null
  return t && !Number.isNaN(t.getTime()) ? t : null
}
export const dob = (d: string | null) => { const t = birthDate(d); return t ? new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(t) : '—' }
export const age = (d: string | null) => { const t = birthDate(d); return t ? Math.floor((Date.now() - t.getTime()) / 31_557_600_000) + ' th' : '' }

/** Debounced patient search against the API; stale responses are dropped. */
export function usePatientSearch(q: string, delay = 300) {
  const [rows, setRows] = useState<PatientRow[] | null>(null)
  const [next, setNext] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    let live = true
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await searchPatients(q)
        if (!live) return
        setRows(res.data)
        setNext(res.next_cursor)
        setError('')
      } catch (e) {
        if (live) setError(errorText(e))
      } finally {
        if (live) setLoading(false)
      }
    }, delay)
    return () => { live = false; clearTimeout(t) }
  }, [q, delay])

  async function more() {
    if (!next) return
    const res = await searchPatients(q, next)
    setRows((r) => [...(r ?? []), ...res.data])
    setNext(res.next_cursor)
  }
  return { rows, next, error, loading, more }
}

export function PatientList({ canCreate, canChart = false, initialQ = '' }: { canCreate: boolean; canChart?: boolean; initialQ?: string }) {
  const [q, setQ] = useState(initialQ)
  const { rows, next, error, loading, more } = usePatientSearch(q)
  return (
    <>
      <div className="page-head">
        <div><h1>Pasien</h1><p className="muted">Cari berdasarkan awalan nama, atau NIK / no. HP lengkap.</p></div>
        {canCreate && <a className="btn btn-primary" href="#/pasien/baru">+ Pasien Baru</a>}
      </div>
      <div className="card">
        <input className="search" type="search" placeholder="Cari nama, NIK, atau no. HP" aria-label="Cari pasien" value={q} onChange={(e) => setQ(e.target.value)} />
        {error ? <p className="state-card error">{error}</p>
          : rows === null ? <p className="state-card muted">Memuat…</p>
          : rows.length === 0 ? <p className="state-card muted">{q ? `Tidak ada pasien yang cocok dengan “${q}”.` : 'Belum ada pasien.'}</p> : (
            <table className={'table' + (loading ? ' is-loading' : '')}>
              <thead><tr><th>Nama</th><th>Tanggal lahir</th><th>Jenis kelamin</th><th>Penjamin</th>{canChart && <th><span className="sr-only">Aksi</span></th>}</tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} onClick={() => (location.hash = '/pasien/' + p.id)}>
                    <td><a href={'#/pasien/' + p.id} className="strong">{p.name}</a></td>
                    <td>{dob(p.dob)} <span className="muted small">{age(p.dob)}</span></td>
                    <td>{p.sex ? SEX[p.sex] : '—'}</td>
                    <td><span className="chip chip-neutral">{PAYER[p.payer_type] ?? p.payer_type}</span></td>
                    {canChart && <td className="cell-action"><a className="btn row-action" href={'#/rekam-medis/' + p.id}
                      aria-label={'Rekam Medis ' + p.name} onClick={(e) => e.stopPropagation()}>Rekam Medis</a></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        {next && <button className="btn btn-block" onClick={more}>Muat lebih banyak</button>}
      </div>
    </>
  )
}

export function PatientDetail({ id, canChart = false }: { id: string; canChart?: boolean }) {
  return (
    <PatientPage id={id} tab="pasien" canChart={canChart}
      actions={canChart ? <a className="btn btn-primary" href={`#/rekam-medis/${id}`}>Rekam Medis</a> : undefined}>
      {(p) => {
        const masked = p.nik?.includes('*')
        const rows: [string, string][] = [
          ['Tanggal lahir', `${dob(p.dob)} ${age(p.dob)}`],
          ['Jenis kelamin', p.sex ? SEX[p.sex] : '—'],
          [masked ? 'NIK (disamarkan)' : 'NIK', p.nik ?? '—'],
          ['No. HP', p.phone ?? '—'],
          ['Alamat', p.address ?? '—'],
          ['Penjamin', [PAYER[p.payer_type] ?? p.payer_type, p.payer_name, p.payer_member_no, p.payer_class].filter(Boolean).join(' · ')],
        ]
        return <div className="card"><dl className="details">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className={k.startsWith('NIK') ? 'mono' : ''}>{v}</dd></div>)}</dl></div>
      }}
    </PatientPage>
  )
}

/** Search-and-pick a patient (used by "Buat Janji"). */
export function PatientPicker({ value, onChange }: { value: { id: string; name: string } | null; onChange: (p: { id: string; name: string } | null) => void }) {
  const [q, setQ] = useState('')
  const { rows, loading } = usePatientSearch(q)
  if (value) return (
    <div className="picked"><span>Pasien: <b>{value.name}</b></span><button type="button" className="btn btn-link" onClick={() => onChange(null)}>Ganti</button></div>
  )
  return (
    <div className="picker">
      <label>Pasien<input type="search" placeholder="Cari nama, NIK, atau no. HP" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <ul className="picker-list">
        {loading && rows === null ? <li className="muted">Memuat…</li> : rows?.length === 0 ? <li className="muted">Tidak ada hasil.</li>
          : rows?.slice(0, 6).map((p) => <li key={p.id}><button type="button" onClick={() => onChange(p)}>{p.name} <span className="muted small">{dob(p.dob)}</span></button></li>)}
      </ul>
    </div>
  )
}
