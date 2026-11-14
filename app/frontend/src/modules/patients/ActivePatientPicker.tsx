import { useEffect, useRef, useState } from 'react'
import { setActivePatient, useActivePatient, useRecentPatients } from '../../shared/activePatient'
import { Icon, ICONS } from '../../shared/ui/Icon'
import { dob, usePatientSearch } from './Patients'

type Pick = { id: string; name: string; dob?: string | null }

// Top-bar "Pasien aktif" pill (design/prototype ActivePatientSelector): popover with search (name/NIK/HP) or "Terakhir dibuka".
export function ActivePatientPicker() {
  const patient = useActivePatient()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const out = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', out)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc) }
  }, [open])
  const pick = (p: Pick) => { setActivePatient({ id: p.id, name: p.name }); setOpen(false) }
  return (
    <div className="aps" ref={box}>
      <button type="button" className={'aps-trigger' + (patient ? '' : ' is-empty')} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog">
        <Icon d={ICONS.user} />
        <span className="aps-text">
          <small>Pasien aktif</small>
          <strong className="aps-name">{patient ? patient.name : 'Belum dipilih'}</strong>
        </span>
        {patient ? <Icon d={ICONS.down} size={16} /> : <span className="aps-action">Pilih pasien</span>}
      </button>
      {patient && <button type="button" className="aps-clear" onClick={() => setActivePatient(null)} aria-label="Tutup pasien aktif" title="Tutup pasien aktif">×</button>}
      {open && <Popover activeId={patient?.id} onPick={pick} />}
    </div>
  )
}

function Popover({ activeId, onPick }: { activeId?: string; onPick: (p: Pick) => void }) {
  const [q, setQ] = useState('')
  const recent = useRecentPatients()
  return (
    <div className="aps-pop" role="dialog" aria-label="Pilih pasien aktif">
      <div className="aps-search">
        <Icon d={ICONS.search} size={18} />
        <input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, NIK, atau no. HP" aria-label="Cari pasien aktif" />
      </div>
      {q.trim() ? <Results q={q} activeId={activeId} onPick={onPick} /> : (
        <>
          <div className="aps-caption">Terakhir dibuka</div>
          <List rows={recent} activeId={activeId} onPick={onPick} empty="Belum ada pasien yang dibuka." />
        </>
      )}
    </div>
  )
}

function Results({ q, activeId, onPick }: { q: string; activeId?: string; onPick: (p: Pick) => void }) {
  const { rows, error } = usePatientSearch(q)
  return (
    <>
      <div className="aps-caption">{rows ? `${rows.length} hasil` : 'Mencari…'}</div>
      {error ? <p className="aps-empty error">{error}</p>
        : rows && <List rows={rows.slice(0, 8)} activeId={activeId} onPick={onPick} empty="Tidak ada pasien yang cocok." />}
    </>
  )
}

const List = ({ rows, activeId, onPick, empty }: { rows: Pick[]; activeId?: string; onPick: (p: Pick) => void; empty: string }) => (
  <ul aria-label="Daftar pasien">
    {rows.map((p) => (
      <li key={p.id}>
        <button type="button" aria-current={p.id === activeId || undefined} onClick={() => onPick(p)}>
          <strong>{p.name}</strong>
          {p.dob !== undefined && <small className="muted">{dob(p.dob)}</small>}
        </button>
      </li>
    ))}
    {rows.length === 0 && <li className="aps-empty muted">{empty}</li>}
  </ul>
)
