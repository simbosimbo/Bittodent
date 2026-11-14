import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useActivePatient } from '../activePatient'
import { ROLE_LABELS, type Me } from '../session'
import { Icon, ICONS } from '../ui/Icon'
import { useIsMobile } from '../useIsMobile'

// Mobile bottom tabs, in order; every other nav item (and Keluar) goes in the "Lainnya" sheet.
const TABS = ['/', '/jadwal', '/pasien', '/rekam-medis']

// group 'pasien' = screens of the active patient (href points at that patient; without one they lead to the patient list).
export type NavItem = { path: string; label: string; icon: string; group?: 'klinik' | 'pasien'; href?: string }

export const withActivePatientHref = <T extends NavItem>(nav: T[], patient: { id: string } | null): T[] =>
  nav.map((n) => n.group === 'pasien' ? { ...n, href: patient ? `${n.path}/${patient.id}` : '/pasien' } : n)

// Shell A (design/prototype shells.css): sidebar (brand, clinic name + synthetic-data badge, branch, nav; icon rail <=1100px; bottom nav instead at <=720px), top bar with search + "Pasien aktif" pill,
// medical-alert ribbon (slot, owned by the patients module) whenever a patient is active, white cards on tinted bg.
// The pill itself is a slot too (patientPicker, from the patients module): shared/ imports no module.
export function Shell({ me, nav, active, ribbon, patientPicker, onSwitchBranch, onLogout, children }: {
  me: Me
  nav: NavItem[]
  active: NavItem | undefined
  ribbon?: ReactNode
  patientPicker?: ReactNode
  onSwitchBranch: (id: string) => void
  onLogout: () => void
  children: ReactNode
}) {
  const patient = useActivePatient()
  const mobile = useIsMobile()
  const [q, setQ] = useState('')
  const [more, setMore] = useState(false)
  // Pinned top bar height -> --shell-sticky-h, so the chart's sticky patient header (allergies) sits right below it.
  const sticky = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sticky.current
    if (!el || typeof ResizeObserver !== 'function') return
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--shell-sticky-h', el.offsetHeight + 'px'))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const tabs = TABS.flatMap((p) => nav.filter((n) => n.path === p))
  const rest = nav.filter((n) => !TABS.includes(n.path))
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
      {!mobile && <aside className="shell-side">
        <a className="shell-brand" href="#/"><span className="brand-mark">◡</span> <span>EHR Gigi</span></a>
        <div className="shell-clinic">
          <strong title={me.active.tenant_name}>{me.active.tenant_name}</strong>
          <span className="badge-synthetic">DATA SINTETIS - PROTOTIPE</span>
        </div>
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
      </aside>}
      <div className="shell-col">
        {/* top bar + ribbon stay pinned while the page scrolls: alerts must never scroll out of view */}
        <div className="shell-sticky" ref={sticky}>
        <header className="shell-top">
          {mobile && me.permissions.includes('patient.read') && (
            <a className="shell-search-icon" href="#/pasien" aria-label="Cari pasien"><Icon d={ICONS.search} /></a>
          )}
          {!mobile && me.permissions.includes('patient.read') && (
            <form className="shell-search" role="search" onSubmit={search}>
              <Icon d={ICONS.search} size={18} />
              <input type="search" placeholder="Cari pasien (nama, NIK, no. HP)" aria-label="Pencarian cepat pasien" value={q} onChange={(e) => setQ(e.target.value)} />
            </form>
          )}
          {patientPicker}
          {/* the sidebar badge hides in the icon rail (<=1100px); this short chip keeps the prototype warning visible there */}
          <span className="badge-synthetic shell-top-synthetic">DATA SINTETIS</span>
          <div className="shell-user">
            <span className="avatar" aria-hidden="true">{me.user.name.replace(/^drg\.?\s*/i, '').charAt(0)}</span>
            <span className="shell-user-text">
              <strong>{me.user.name}</strong>
              <small>{me.roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')}</small>
            </span>
          </div>
          {!mobile && <button className="btn btn-ghost shell-logout" onClick={onLogout}>Keluar</button>}
        </header>
        {patient && ribbon}
        </div>
        <main className="shell-main" key={me.active.branch_id}>{children}</main>
      </div>
      {mobile && (
        <nav className="bottom-nav" aria-label="Navigasi utama">
          {tabs.map((n) => (
            <a key={n.path} href={'#' + (n.href ?? n.path)} className={n === active ? 'on' : undefined} aria-current={n === active ? 'page' : undefined}>
              <Icon d={n.icon} /><span>{n.label}</span>
            </a>
          ))}
          <button type="button" className={active && rest.includes(active) ? 'on' : undefined} aria-expanded={more} aria-haspopup="dialog" onClick={() => setMore(!more)}>
            <Icon d={ICONS.more} /><span>Lainnya</span>
          </button>
        </nav>
      )}
      {mobile && more && (
        <>
          <div className="sheet-backdrop" onClick={() => setMore(false)} />
          <div className="sheet more-sheet" role="dialog" aria-label="Menu lainnya" onKeyDown={(e) => e.key === 'Escape' && setMore(false)}>
            {rest.map((n) => (
              <a key={n.path} href={'#' + (n.href ?? n.path)} aria-current={n === active ? 'page' : undefined} onClick={() => setMore(false)}>
                <Icon d={n.icon} /> {n.label}
              </a>
            ))}
            <button type="button" className="btn" onClick={() => { setMore(false); onLogout() }}>Keluar</button>
            <button type="button" className="btn btn-ghost" autoFocus onClick={() => setMore(false)}>Tutup</button>
          </div>
        </>
      )}
    </div>
  )
}
