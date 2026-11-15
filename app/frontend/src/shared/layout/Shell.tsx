import { useState, type FormEvent, type ReactNode } from 'react'
import { setActivePatient, useActivePatient } from '../activePatient'
import { ROLE_LABELS, type Me } from '../session'
import { Icon, ICONS } from '../ui/Icon'
import { ImpersonationBanner } from './ImpersonationBanner'

// group 'pasien' = screens of the active patient (href points at that patient; without one they lead to the patient list).
export type NavItem = { path: string; label: string; icon: string; group?: 'klinik' | 'pasien'; href?: string }

// Shell A (design/prototype shells.css): sidebar (brand, branch, nav; icon rail <=1100px), top bar with search + "Pasien aktif" pill,
// medical-alert ribbon (slot, owned by the patients module) whenever a patient is active, white cards on tinted bg.
export function Shell({ me, nav, active, ribbon, onSwitchBranch, onLogout, children }: {
  me: Me
  nav: NavItem[]
  active: NavItem | undefined
  ribbon?: ReactNode
  onSwitchBranch: (id: string) => void
  onLogout: () => void
  children: ReactNode
}) {
  const patient = useActivePatient()
  const [q, setQ] = useState('')
  const search = (e: FormEvent) => {
    e.preventDefault()
    location.hash = '/pasien?q=' + encodeURIComponent(q.trim())
    setQ('')
  }
  const group = (g: NavItem['group'], caption: string) => {
    const items = nav.filter((n) => (n.group ?? 'klinik') === g)
    return items.length > 0 && (
      <>
        <span className="shell-nav-caption shell-nav-group">{caption}</span>
        {items.map((n) => (
          <a key={n.path} href={'#' + (n.href ?? n.path)} title={n.label} className={n === active ? 'on' : undefined} aria-current={n === active ? 'page' : undefined}>
            <Icon d={n.icon} /> <span className="shell-nav-label">{n.label}</span>
          </a>
        ))}
      </>
    )
  }
  return (
    <div className="app-shell">
      <aside className="shell-side">
        <a className="shell-brand" href="#/"><span className="brand-mark">◡</span> <span>EHR Gigi</span></a>
        <label className="shell-branch">
          <span className="shell-nav-caption">Cabang aktif</span>
          <select value={me.active.branch_id ?? ''} onChange={(e) => onSwitchBranch(e.target.value)} disabled={me.branches.length < 2}>
            {me.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <nav className="shell-nav" aria-label="Modul utama">
          {group('klinik', 'Klinik')}
          {group('pasien', 'Pasien aktif')}
        </nav>
      </aside>
      <div className="shell-col">
        {/* top bar + ribbon stay pinned while the page scrolls: alerts must never scroll out of view */}
        <div className="shell-sticky">
        <ImpersonationBanner me={me} />
        <header className="shell-top">
          <div className="shell-title">
            <strong>{me.active.tenant_name}</strong>
            <small className="muted">{me.active.branch_name}</small>
          </div>
          {me.permissions.includes('patient.read') && (
            <form className="shell-search" role="search" onSubmit={search}>
              <Icon d={ICONS.search} size={18} />
              <input type="search" placeholder="Cari pasien (nama, NIK, no. HP)" aria-label="Pencarian cepat pasien" value={q} onChange={(e) => setQ(e.target.value)} />
            </form>
          )}
          <div className="aps">
          <a className={'aps-trigger' + (patient ? '' : ' is-empty')} href={patient ? '#/pasien/' + patient.id : '#/pasien'}>
            <Icon d={ICONS.user} />
            <span className="aps-text">
              <small>Pasien aktif</small>
              <strong>{patient ? patient.name : 'Belum dipilih'}</strong>
            </span>
            {!patient && <span className="aps-action">Pilih pasien</span>}
          </a>
          {patient && <button className="aps-clear" onClick={() => setActivePatient(null)} aria-label="Tutup pasien aktif" title="Tutup pasien aktif">×</button>}
          </div>
          <span className="badge-synthetic">DATA SINTETIS - PROTOTIPE</span>
          <div className="shell-user">
            <span className="avatar" aria-hidden="true">{me.user.name.replace(/^drg\.?\s*/i, '').charAt(0)}</span>
            <span className="shell-user-text">
              <strong>{me.user.name}</strong>
              <small>{me.roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')}</small>
            </span>
          </div>
          <button className="btn btn-ghost" onClick={onLogout}>Keluar</button>
        </header>
        {patient && ribbon}
        </div>
        <main className="shell-main" key={me.active.branch_id}>{children}</main>
      </div>
    </div>
  )
}
