import { useEffect, useState } from 'react'
import { errorText } from '../../shared/api/http'
import { initials, TZ } from '../../shared/format'
import { Icon, ICONS } from '../../shared/ui/Icon'
import { useIsMobile } from '../../shared/useIsMobile'
import { getDentists, searchPatients, type ListFilter, type PatientRow } from './api'
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
// Same year formula as age(), long unit for the patient header ("42 tahun"); '' when the DOB is missing/unparseable.
export const ageTahun = (d: string | null) => { const t = birthDate(d); return t ? Math.floor((Date.now() - t.getTime()) / 31_557_600_000) + ' tahun' : '' }

/** Debounced patient search against the API; stale responses are dropped. */
export function usePatientSearch(q: string, delay = 300, filter: ListFilter = {}) {
  const { care_status, dentist_id } = filter
  const [rows, setRows] = useState<PatientRow[] | null>(null)
  const [next, setNext] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    let live = true
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await searchPatients(q, undefined, { care_status, dentist_id })
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
  }, [q, delay, care_status, dentist_id])

  async function more() {
    if (!next) return
    const res = await searchPatients(q, next, { care_status, dentist_id })
    setRows((r) => [...(r ?? []), ...res.data])
    setNext(res.next_cursor)
  }
  return { rows, next, error, loading, more }
}

// Care status (derived server-side by Patients\Domain\CareStatus); admin patient.status is not shown on the list.
const CARE: Record<string, [string, string]> = {
  dalam_perawatan: ['Dalam perawatan', 'chip-aktif'], perlu_kontrol: ['Perlu kontrol', 'chip-kontrol'], tidak_aktif: ['Tidak aktif', 'chip-neutral'],
}
// Value not in the API (no visit yet; mrn on old draft rows): say so instead of inventing values.
const Missing = () => <><span aria-hidden="true">—</span><span className="sr-only">Belum ada</span></>
const day = (iso: string) => new Intl.DateTimeFormat('id-ID', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
const Care = ({ s }: { s?: string }) => s ? <span className={'chip ' + (CARE[s]?.[1] ?? 'chip-neutral')}>{CARE[s]?.[0] ?? s}</span> : null
const Allergies = ({ a }: { a?: string[] }) => a?.length
  ? <span className="pl-allergies"><span className="sr-only">Alergi: </span>{a.map((x) => <span key={x} className="chip chip-alergi">{x}</span>)}</span>
  : null

export function PatientList({ canCreate, canChart = false, initialQ = '' }: { canCreate: boolean; canChart?: boolean; initialQ?: string }) {
  const [q, setQ] = useState(initialQ)
  const [care, setCare] = useState('')
  const [dentist, setDentist] = useState('')
  const [dentists, setDentists] = useState<{ id: string; name: string }[]>([])
  const { rows, next, error, loading, more } = usePatientSearch(q, 300, { care_status: care, dentist_id: dentist })
  const mobile = useIsMobile()
  useEffect(() => { getDentists().then((r) => setDentists(r.data), () => setDentists([])) }, [])
  // Filters run on the server (whole list, not just the loaded page): no counts, the API has no totals.
  const filters: [string, string][] = [['', 'Semua'], ...Object.entries(CARE).map(([k, [label]]): [string, string] => [k, label])]
  const filtered = !!(care || dentist)
  return (
    <>
      <div className="page-head"><h1 className="shell-dup-title">Daftar Pasien</h1></div>
      <div className="card">
        <div className="pl-toolbar">
          <label className="pl-search">Cari pasien
            <span className="pl-search-box"><Icon d={ICONS.search} size={18} />
              <input type="search" placeholder="Awalan nama, No. RM, atau NIK / no. HP lengkap" value={q} onChange={(e) => setQ(e.target.value)} /></span>
          </label>
          <label className="pl-dentist">Dokter
            <select value={dentist} onChange={(e) => setDentist(e.target.value)}>
              <option value="">Semua dokter</option>
              {dentists.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          {canCreate && <a className="btn btn-primary" href="#/pasien/baru">Pasien baru</a>}
        </div>
        <div className="pl-filters" role="group" aria-label="Saring status perawatan">
          {filters.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={care === k} onClick={() => setCare(k)}>{label}</button>
          ))}
        </div>
        {error ? <p className="state-card error">{error}</p>
          : !rows ? <p className="state-card muted">Memuat…</p>
          : rows.length === 0 ? <p className="state-card muted">{q ? `Tidak ada pasien yang cocok dengan “${q}”.` : filtered ? 'Tidak ada pasien dengan saringan ini.' : 'Belum ada pasien.'}</p>
          : mobile ? (
            // Mobile: one card per patient instead of the wide table; same row/link rules.
            <ul className={'pl-cards' + (loading ? ' is-loading' : '')} aria-label="Daftar pasien">
              {rows.map((p) => (
                <li key={p.id} onClick={() => (location.hash = '/pasien/' + p.id)}>
                  <span className="avatar" aria-hidden="true">{initials(p.name) || '?'}</span>
                  <div className="pl-card-body">
                    <a href={'#/pasien/' + p.id} className="strong pl-name-text">{p.name}</a>
                    <span className="muted small">{[p.mrn, age(p.dob), p.sex && (SEX[p.sex] ?? p.sex), PAYER[p.payer_type] ?? p.payer_type].filter(Boolean).join(' · ')}</span>
                    <span className="muted small">{p.last_visit_at ? `Terakhir ${day(p.last_visit_at)}${p.last_dentist_name ? ' · ' + p.last_dentist_name : ''}` : 'Belum ada kunjungan'}</span>
                    {(p.care_status || p.allergies?.length) ? <span className="pl-chips"><Care s={p.care_status} /><Allergies a={p.allergies} /></span> : null}
                    {canChart && <a className="btn-link row-action" href={'#/rekam-medis/' + p.id}
                      aria-label={'Rekam Medis ' + p.name} onClick={(e) => e.stopPropagation()}>Rekam Medis</a>}
                  </div>
                  <span className="pl-chevron" aria-hidden="true"><Icon d={ICONS.right} size={18} /></span>
                </li>
              ))}
            </ul>
          ) : (
            <table className={'table pl-table' + (loading ? ' is-loading' : '')}>
              <thead><tr><th className="pl-col-name">Pasien</th><th>No. RM</th><th>Umur</th><th>Kunjungan terakhir</th><th>Dokter</th><th>Status</th><th><span className="sr-only">Aksi</span></th></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} onClick={() => (location.hash = '/pasien/' + p.id)}>
                    <td><div className="pl-name">
                      <span className="avatar" aria-hidden="true">{initials(p.name) || '?'}</span>
                      <span><a href={'#/pasien/' + p.id} className="strong pl-name-text">{p.name}</a>
                        <span className="muted small pl-payer">{PAYER[p.payer_type] ?? p.payer_type}</span>
                        <Allergies a={p.allergies} /></span>
                    </div></td>
                    <td className={p.mrn ? undefined : 'muted'}>{p.mrn ?? <Missing />}</td>
                    <td title={p.dob ? 'Lahir ' + dob(p.dob) : undefined}>{age(p.dob) || <Missing />}</td>
                    <td className={p.last_visit_at ? undefined : 'muted'}>{p.last_visit_at ? day(p.last_visit_at) : <Missing />}</td>
                    <td className={p.last_dentist_name ? undefined : 'muted'}>{p.last_dentist_name ?? <Missing />}</td>
                    <td>{p.care_status ? <Care s={p.care_status} /> : <Missing />}</td>
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
