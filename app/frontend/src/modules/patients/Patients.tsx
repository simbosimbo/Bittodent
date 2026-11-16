import { useEffect, useState } from 'react'
import { StateCard } from '../../shared/ui/StateCard'
import { Avatar, Button, buttonVariants, Card, Chip, Label, SearchField } from '@heroui/react'
import { FilterChips } from '../../shared/ui/FilterChips'
import { Select } from '../../shared/ui/Select'
import { PageSkeleton } from '../../shared/ui/Skeleton'
import { errorText } from '../../shared/api/http'
import { initials, TZ } from '../../shared/format'
import { Icon, ICONS } from '../../shared/ui/Icon'
import { useIsMobile } from '../../shared/useIsMobile'
import { StatusDot } from '../../shared/ui/StatusDot'
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
const CARE: Record<string, string> = { dalam_perawatan: 'Dalam perawatan', perlu_kontrol: 'Perlu kontrol', tidak_aktif: 'Tidak aktif' }
// Value not in the API (no visit yet; mrn on old draft rows): say so instead of inventing values.
const Missing = () => <><span aria-hidden="true">—</span><span className="sr-only">Belum ada</span></>
const day = (iso: string) => new Intl.DateTimeFormat('id-ID', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
const Care = ({ s }: { s?: string }) => s ? <StatusDot status={s}>{CARE[s] ?? s}</StatusDot> : null
const Allergies = ({ a }: { a?: string[] }) => a?.length
  ? <span className="pl-allergies"><span className="sr-only">Alergi: </span>{a.map((x) => <Chip key={x} size="sm" variant="soft" color="danger" className="pl-chip pl-alergi">{x}</Chip>)}</span>
  : null
const Initials = ({ name }: { name: string }) => (
  <Avatar size="sm" color="accent" variant="soft" className="pl-avatar" aria-hidden="true"><Avatar.Fallback>{initials(name) || '?'}</Avatar.Fallback></Avatar>
)

/** `meId`: the signed-in user; when they are a dentist the phone list offers "Pasien saya" (PD08) and starts there. */
export function PatientList({ canCreate, canChart = false, initialQ = '', meId }: { canCreate: boolean; canChart?: boolean; initialQ?: string; meId?: string }) {
  const [q, setQ] = useState(initialQ)
  useEffect(() => { setQ(initialQ) }, [initialQ])
  const [care, setCare] = useState('')
  const [picked, setDentist] = useState<string | null>(null) // null = not chosen yet
  const [dentists, setDentists] = useState<{ id: string; name: string }[]>([])
  const mobile = useIsMobile()
  const mine = !!meId && dentists.some((d) => d.id === meId)
  const dentist = picked ?? (mobile && mine ? meId! : '')
  const { rows, next, error, loading, more } = usePatientSearch(q, 300, { care_status: care, dentist_id: dentist })
  useEffect(() => { getDentists().then((r) => setDentists(r.data), () => setDentists([])) }, [])
  // Filters run on the server (whole list, not just the loaded page): no counts, the API has no totals.
  const filters: [string, string][] = [['', 'Semua'], ...Object.entries(CARE)]
  const filtered = !!(care || dentist)
  const chips = (label: string, items: [string, string][], value: string, set: (k: string) => void) =>
    <FilterChips label={label} value={value} onChange={set} options={items} />
  const body = (
    <>
      <div className="pl-toolbar">
        <SearchField className="pl-search" value={q} onChange={setQ} variant={mobile ? 'primary' : 'secondary'}>
          <Label className={mobile ? 'sr-only' : 'pl-label'}>Cari pasien</Label>
          <SearchField.Group className="pl-field"><SearchField.SearchIcon />
            <SearchField.Input placeholder={mobile ? 'Cari nama atau No. RM' : 'Awalan nama, No. RM, atau NIK / no. HP lengkap'} /></SearchField.Group>
        </SearchField>
        {!(mobile && mine) && (
          <div className="pl-dentist">
            <Label htmlFor="pl-dentist" className="pl-label">Dokter</Label>
            <Select id="pl-dentist" value={dentist} onChange={(e) => setDentist(e.target.value)}>
              <option value="">Semua dokter</option>
              {dentists.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>
        )}
        {/* Phone: Pasien baru is "Daftarkan pasien" in the top bar "+" menu (no FAB repeating it). */}
        {canCreate && !mobile && <a className={buttonVariants({ variant: 'primary' }) + ' pl-new'} href="#/pasien/baru">Pasien baru</a>}
      </div>
      {mobile && mine && chips('Saring dokter', [[meId!, 'Pasien saya'], ['', 'Semua dokter']], dentist, setDentist)}
      {chips('Saring status perawatan', filters, care, setCare)}
      {/* Loaded rows only (the API has no total): "+" when more pages exist. */}
      {mobile && rows && rows.length > 0 && <p className="pl-sum" aria-live="polite">{rows.length}{next ? '+' : ''} pasien</p>}
      {error ? <StateCard error={error} />
        : !rows ? <PageSkeleton variant="list" />
        : rows.length === 0 ? <StateCard>{q ? `Tidak ada pasien yang cocok dengan “${q}”.` : filtered ? 'Tidak ada pasien dengan saringan ini.' : 'Belum ada pasien.'}</StateCard>
        : mobile ? (
          // Phone (Gaya ringkas HP): one card per patient = one link to the patient page (Rekam Medis is one more tap from there).
          <ul className={'pl-cards' + (loading ? ' is-loading' : '')} aria-label="Daftar pasien">
            {rows.map((p) => (
              <li key={p.id} onClick={() => (location.hash = '/pasien/' + p.id)}>
                <Card className="pl-hit">
                  <a href={'#/pasien/' + p.id} className="pl-hit-main" aria-labelledby={'pl-n-' + p.id} aria-describedby={'pl-m-' + p.id}>
                    <span className="pl-card-body">
                      <span className="pl-card-top"><span id={'pl-n-' + p.id} className="pl-name-text">{p.name}</span><Care s={p.care_status} /></span>
                      <span id={'pl-m-' + p.id} className="pl-meta">
                        <span><span className="pl-mrn">{p.mrn ? `No. RM ${p.mrn}` : 'No. RM belum ada'}</span>
                          {[age(p.dob), p.sex && (SEX[p.sex] ?? p.sex), PAYER[p.payer_type] ?? p.payer_type].filter(Boolean).map((x) => ' · ' + x)}</span>
                        <span>{p.last_visit_at ? `Terakhir: ${day(p.last_visit_at)}${p.last_dentist_name ? ' · ' + p.last_dentist_name : ''}` : 'Belum ada kunjungan'}</span>
                      </span>
                      {!!p.allergies?.length && <span className="pl-chips"><Allergies a={p.allergies} /></span>}
                    </span>
                    <span className="pl-chevron" aria-hidden="true"><Icon d={ICONS.right} size={18} /></span>
                  </a>
                </Card>
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
                    <Initials name={p.name} />
                    <span><a href={'#/pasien/' + p.id} className="strong pl-name-text">{p.name}</a>
                      <span className="muted small pl-payer">{PAYER[p.payer_type] ?? p.payer_type}</span>
                      <Allergies a={p.allergies} /></span>
                  </div></td>
                  <td className={p.mrn ? 'nowrap' : 'muted'}>{p.mrn ?? <Missing />}</td>
                  <td title={p.dob ? 'Lahir ' + dob(p.dob) : undefined}>{age(p.dob) || <Missing />}</td>
                  <td className={p.last_visit_at ? undefined : 'muted'}>{p.last_visit_at ? day(p.last_visit_at) : <Missing />}</td>
                  <td className={p.last_dentist_name ? undefined : 'muted'}>{p.last_dentist_name ?? <Missing />}</td>
                  <td>{p.care_status ? <Care s={p.care_status} /> : <Missing />}</td>
                  <td className="cell-action">
                    {canChart && <a className={buttonVariants({ variant: 'tertiary', size: 'sm' })} href={'#/rekam-medis/' + p.id}
                      aria-label={'Rekam Medis ' + p.name} onClick={(e) => e.stopPropagation()}>Rekam Medis</a>}
                    <span className="pl-chevron" aria-hidden="true"><Icon d={ICONS.right} size={18} /></span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      {next && <Button variant="secondary" fullWidth className="pl-more" onPress={more}>Muat lebih banyak</Button>}
    </>
  )
  return (
    <div className={mobile ? 'pl-page' : undefined}>
      <div className="page-head pl-head">
        <h1 className="shell-dup-title">{mobile ? 'Pasien' : 'Daftar Pasien'}</h1>
      </div>
      {/* Phone: no outer card (PD08), the patient cards sit on the page. Desktop keeps the one card around toolbar + table. */}
      {mobile ? body : <Card className="pl-panel">{body}</Card>}
    </div>
  )
}

export function PatientDetail({ id, canChart = false }: { id: string; canChart?: boolean }) {
  return (
    <PatientPage id={id} tab="pasien" canChart={canChart}
      actions={canChart ? <a className={buttonVariants({ variant: 'primary' })} href={`#/rekam-medis/${id}`}>Rekam Medis</a> : undefined}>
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
        return <Card className="pt-card"><dl className="details">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className={k.startsWith('NIK') ? 'mono' : ''}>{v}</dd></div>)}</dl></Card>
      }}
    </PatientPage>
  )
}

/** Search-and-pick a patient (used by "Buat Janji"). */
export function PatientPicker({ value, onChange }: { value: { id: string; name: string } | null; onChange: (p: { id: string; name: string } | null) => void }) {
  const [q, setQ] = useState('')
  const { rows, loading } = usePatientSearch(q)
  if (value) return (
    <div className="picked"><span>Pasien: <b>{value.name}</b></span><Button variant="ghost" size="sm" onPress={() => onChange(null)}>Ganti</Button></div>
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
