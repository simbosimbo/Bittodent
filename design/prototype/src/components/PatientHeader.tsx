import { useState } from 'react'
import { useActive, useStore } from '../state/store'
import { ageOf, maskNik, maskPhone } from '../lib/format'
import { Icon } from './Icon'
import { Badge } from './ui'

// Fakta pasien yang "ikut" ke setiap modul. Alergi SELALU terlihat.
export function PatientHeader() {
  const p = useActive()
  const { a } = useStore()
  const [show, setShow] = useState(false)
  if (!p) return (
    <div className="pt-header is-empty">
      <span>Belum ada pasien aktif.</span>
      <button className="btn btn-primary btn-sm" onClick={() => a.openSelector(true)}><Icon name="search" size={16} />Pilih pasien</button>
    </div>
  )
  return (
    <div className="pt-header" aria-label="Ringkasan pasien aktif">
      <div className="pt-id">
        <span className="avatar lg">{p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
        <div>
          <h1 className="pt-name">{p.name}</h1>
          <div className="pt-meta"><span>{p.rm}</span><span>{ageOf(p.dob)} th</span><span>{p.sex === 'P' ? 'Perempuan' : 'Laki-laki'}</span><span>{p.insurance ? `${p.insurance.insurer}` : 'Umum'}</span></div>
        </div>
      </div>
      <div className="pt-allergy">
        {p.allergies.length
          ? <span className="allergy-chip"><Icon name="alert" size={16} />Alergi: {p.allergies.join(', ')}</span>
          : <span className="allergy-chip none">Tidak ada alergi tercatat</span>}
        {(p.alerts ?? []).map((al) => <span key={al} className="alert-chip"><Icon name="alert" size={16} />Peringatan: {al}</span>)}
      </div>
      <dl className="pt-sens">
        <div><dt>NIK</dt><dd>{show ? p.nik : maskNik(p.nik)}</dd></div>
        <div><dt>HP</dt><dd>{show ? p.phone : maskPhone(p.phone)}</dd></div>
        <button className="icon-btn" onClick={() => setShow(!show)} aria-pressed={show} aria-label={show ? 'Sembunyikan NIK dan HP' : 'Tampilkan NIK dan HP'} title={show ? 'Sembunyikan' : 'Tampilkan (tercatat di audit)'}>
          <Icon name={show ? 'eyeOff' : 'eye'} />
        </button>
      </dl>
      {p.consentPdp ? null : <Badge tone="danger">Belum ada persetujuan UU PDP</Badge>}
    </div>
  )
}
