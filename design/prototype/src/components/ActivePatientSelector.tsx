import { useEffect, useRef, useState } from 'react'
import { patientOf, useStore } from '../state/store'
import { ageOf } from '../lib/format'
import { go } from '../lib/router'
import { Icon } from './Icon'

// Pemilih "Pasien aktif" di top bar: cari + terakhir dibuka. Semua modul membaca pasien aktif dari store.
export function ActivePatientSelector() {
  const { s, a } = useStore()
  const [q, setQ] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const active = patientOf(s, s.activeId)
  const open = s.selectorOpen
  useEffect(() => { if (open) input.current?.focus() }, [open])
  useEffect(() => {
    const f = (e: MouseEvent) => { if (open && box.current && !box.current.contains(e.target as Node)) a.openSelector(false) }
    document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f)
  }, [open, a])
  const term = q.trim().toLowerCase()
  const results = term ? s.patients.filter((p) => p.name.toLowerCase().includes(term) || p.rm.toLowerCase().includes(term)) : s.recent.map((id) => patientOf(s, id)!).filter(Boolean)
  return (
    <div className="aps" ref={box}>
      <button className={`aps-trigger ${active ? '' : 'is-empty'}`} onClick={() => a.openSelector(!open)} aria-expanded={open} aria-haspopup="listbox">
        {active
          ? <span className="avatar">{active.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
          : <Icon name="user" />}
        <span className="aps-text">
          <small>Pasien aktif</small>
          <strong className="aps-id">
            {active
              ? <><span className="aps-name">{active.name}</span><span className="aps-sep"> · </span><span className="aps-rm">{active.rm}</span></>
              : 'Belum ada pasien aktif'}
          </strong>
        </span>
        {active ? <Icon name="down" size={16} /> : <span className="aps-action">Pilih pasien</span>}
      </button>
      {active && <button className="icon-btn aps-clear" onClick={() => a.setActive(null)} aria-label="Kosongkan pasien aktif" title="Kosongkan pasien aktif"><Icon name="x" size={18} /></button>}
      {open && (
        <div className="aps-pop" role="dialog" aria-label="Pilih pasien aktif">
          <div className="aps-search"><Icon name="search" size={18} /><input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau no. RM" aria-label="Cari pasien" /></div>
          <div className="aps-caption">{term ? `${results.length} hasil` : 'Terakhir dibuka'}</div>
          <ul role="listbox" aria-label="Daftar pasien">
            {results.map((p) => (
              <li key={p.id}>
                <button role="option" aria-selected={p.id === s.activeId} onClick={() => { a.setActive(p.id); setQ('') }}>
                  <span className="avatar">{p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                  <span><strong>{p.name}</strong><small>{p.rm} · {ageOf(p.dob)} th</small></span>
                  {p.allergies.length > 0 && <span className="mini-allergy">Alergi</span>}
                </button>
              </li>
            ))}
            {!results.length && <li className="aps-empty">Tidak ditemukan.</li>}
          </ul>
          <button className="aps-new" onClick={() => { a.openSelector(false); go('/keluarga/baru') }}><Icon name="plus" size={18} />Daftarkan pasien baru</button>
        </div>
      )}
    </div>
  )
}
