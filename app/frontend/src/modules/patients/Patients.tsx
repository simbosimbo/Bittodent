import { useEffect, useState } from 'react'
import { errorText } from '../../shared/api/http'
import { initials } from '../../shared/format'
import { Icon, ICONS } from '../../shared/ui/Icon'
import { useIsMobile } from '../../shared/useIsMobile'
import { searchPatients, type PatientRow } from './api'
import { PatientPage } from './Records'
import './patients.css'

export const SEX: Record<string, string> = { laki_laki: 'Laki-laki', perempuan: 'Perempuan' }
export const PAYER: Record<string, string> = { umum: 'Umum', asuransi: 'Asuransi', bpjs: 'BPJS' }
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

// Labels for patient.status (MySQL default 'aktif'; postgres target adds meninggal/diarsip). Unknown values show raw.
const STATUS: Record<string, string> = { aktif: 'Aktif', tidak_aktif: 'Tidak aktif', meninggal: 'Meninggal', diarsip: 'Diarsip' }
// No mrn / last-visit data in the list API yet: say so instead of inventing values.
const Missing = () => <><span aria-hidden="true">—</span><span className="sr-only">Belum ada</span></>

export function PatientList({ canCreate, canChart = false, initialQ = '' }: { canCreate: boolean; canChart?: boolean; initialQ?: string }) {
  const [q, setQ] = useState(initialQ)
  const [status, setStatus] = useState('')
  const { rows, next, error, loading, more } = usePatientSearch(q)
  const mobile = useIsMobile()
  // Counts cover only the loaded results (no totals endpoint).
  const counts: Record<string, number> = {}
  for (const p of rows ?? []) if (p.status) counts[p.status] = (counts[p.status] ?? 0) + 1
  const active = counts[status] ? status : ''
  const shown = active ? rows?.filter((p) => p.status === active) : rows
  const filters: [string, string, number][] = [['', 'Semua', rows?.length ?? 0], ...Object.entries(counts).map(([k, n]): [string, string, number] => [k, STATUS[k] ?? k, n])]
  return (
    <>
      <div className="page-head"><h1>Daftar Pasien</h1></div>
      <div className="card">
        <div className="pl-toolbar">
          <label className="pl-search">Cari pasien
            <span className="pl-search-box"><Icon d={ICONS.search} size={18} />
              <input type="search" placeholder="Awalan nama, atau NIK / no. HP lengkap" value={q} onChange={(e) => setQ(e.target.value)} /></span>
          </label>
          {canCreate && <a className="btn btn-primary" href="#/pasien/baru">Pasien baru</a>}
        </div>
        {rows && rows.length > 0 && (
          <div className="pl-filters" role="group" aria-label="Saring status pasien">
            {filters.map(([k, label, n]) => (
              <button key={k} type="button" aria-pressed={active === k} onClick={() => setStatus(k)}>{label} <span className="pl-count">{n}</span></button>
            ))}
          </div>
        )}
        {error ? <p className="state-card error">{error}</p>
          : !rows || !shown ? <p className="state-card muted">Memuat…</p>
          : rows.length === 0 ? <p className="state-card muted">{q ? `Tidak ada pasien yang cocok dengan “${q}”.` : 'Belum ada pasien.'}</p>
          : mobile ? (
            // Mobile: one card per patient instead of the wide table; same row/link rules.
            <ul className={'pl-cards' + (loading ? ' is-loading' : '')} aria-label="Daftar pasien">
              {shown.map((p) => (
                <li key={p.id} onClick={() => (location.hash = '/pasien/' + p.id)}>
                  <span className="avatar" aria-hidden="true">{initials(p.name) || '?'}</span>
                  <div className="pl-card-body">
                    <a href={'#/pasien/' + p.id} className="strong pl-name-text">{p.name}</a>
                    <span className="muted small">{[age(p.dob), p.sex && (SEX[p.sex] ?? p.sex), PAYER[p.payer_type] ?? p.payer_type].filter(Boolean).join(' · ')}</span>
                    {p.status && <span><span className={'chip ' + (p.status === 'aktif' ? 'chip-aktif' : 'chip-neutral')}>{STATUS[p.status] ?? p.status}</span></span>}
                    {canChart && <a className="btn-link row-action" href={'#/rekam-medis/' + p.id}
                      aria-label={'Rekam Medis ' + p.name} onClick={(e) => e.stopPropagation()}>Rekam Medis</a>}
                  </div>
                  <span className="pl-chevron" aria-hidden="true"><Icon d={ICONS.right} size={18} /></span>
                </li>
              ))}
            </ul>
          ) : (
            <table className={'table pl-table' + (loading ? ' is-loading' : '')}>
              <thead><tr><th className="pl-col-name">Pasien</th><th>No. RM</th><th>Umur</th><th>Kunjungan terakhir</th><th>Status</th><th><span className="sr-only">Aksi</span></th></tr></thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id} onClick={() => (location.hash = '/pasien/' + p.id)}>
                    <td><div className="pl-name">
                      <span className="avatar" aria-hidden="true">{initials(p.name) || '?'}</span>
                      <span><a href={'#/pasien/' + p.id} className="strong pl-name-text">{p.name}</a>
                        <span className="muted small pl-payer">{PAYER[p.payer_type] ?? p.payer_type}</span></span>
                    </div></td>
                    <td className="muted"><Missing /></td>
                    <td title={p.dob ? 'Lahir ' + dob(p.dob) : undefined}>{age(p.dob) || <Missing />}</td>
                    <td className="muted"><Missing /></td>
                    <td>{p.status ? <span className={'chip ' + (p.status === 'aktif' ? 'chip-aktif' : 'chip-neutral')}>{STATUS[p.status] ?? p.status}</span> : <Missing />}</td>
                    <td className="cell-action">
                      {canChart && <a className="btn-link row-action" href={'#/rekam-medis/' + p.id}
                        aria-label={'Rekam Medis ' + p.name} onClick={(e) => e.stopPropagation()}>Rekam Medis</a>}
                      <span className="pl-chevron" aria-hidden="true"><Icon d={ICONS.right} size={18} /></span>
                    </td>
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
