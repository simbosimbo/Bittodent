import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useActivePatient } from '../activePatient'
import { initials } from '../format'
import { ROLE_LABELS, type Me } from '../session'
import { Icon, ICONS } from '../ui/Icon'
import { Menu } from '../ui/Menu'
import { useScrollHints } from '../ui/scrollHint'
import { useDialog } from '../ui/Sheet'
import { useIsMobile } from '../useIsMobile'

// Mobile bottom tabs: the first 4 of these the user may open, in order (no Rekam Medis -> Kasir: front desk / kasir);
// every other nav item goes in the "Lainnya" sheet (with branch + Keluar).
const TABS = ['/', '/jadwal', '/pasien', '/rekam-medis', '/kasir']
export const SECTIONS = ['KLINIK', 'KLINIS', 'KEUANGAN'] as const

// section = sidebar caption. group 'pasien' = screen of the active patient (href points at that patient; without one it leads to the patient list).
export type NavItem = { path: string; label: string; icon: string; section: typeof SECTIONS[number]; group?: 'pasien'; href?: string }

export const withActivePatientHref = <T extends NavItem>(nav: T[], patient: { id: string } | null): T[] =>
  nav.map((n) => n.group === 'pasien' ? { ...n, href: patient ? `${n.path}/${patient.id}` : '/pasien' } : n)

// Prototype copy only, NOT real clinic addresses: /api/me has no address field. Unknown tenants get the branch name (never an invented street).
const ADDRESSES: Record<string, string> = {
  'Klinik Gigi Senyum Sehat': 'Jl. Tebet Raya No. 21, Jakarta Selatan',
  'Klinik Gigi Ceria': 'Jl. Ir. H. Djuanda, Dago, Bandung',
}
export const clinicSubtitle = (me: Me) => ADDRESSES[me.active.tenant_name] ?? me.active.branch_name ?? ''

// Top bar title: the nav label, except the patient area reads "Daftar Pasien" (and the new-patient form "Pasien Baru").
export const pageTitle = (hash: string, active: NavItem | undefined) =>
  hash === '/pasien/baru' ? 'Pasien Baru' : active?.path === '/pasien' ? 'Daftar Pasien' : active?.label ?? ''

// One switcher for the avatar menu and the mobile "Lainnya" sheet: a select with 2+ branches, plain text with one.
function Branch({ me, onSwitchBranch }: { me: Me; onSwitchBranch: (id: string) => void }) {
  return me.branches.length < 2
    ? <p className="menu-branch"><small>Cabang</small> <strong>{me.active.branch_name}</strong></p>
    : <label className="menu-branch"><small>Cabang aktif</small>
        <select value={me.active.branch_id ?? ''} onChange={(e) => onSwitchBranch(e.target.value)}>
          {me.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
}

// Shell A: sidebar (brand, clinic block, KLINIK/KLINIS/KEUANGAN nav; icon rail <=1100px; bottom nav instead at <=720px),
// top bar (page title, search, + quick actions, bell, user menu), medical-alert ribbon slot whenever a patient is active.
export function Shell({ me, nav, active, title = '', ribbon, badges, onSwitchBranch, onLogout, children }: {
  me: Me
  nav: NavItem[]
  /** phone bottom-nav count per path (e.g. Jadwal: online bookings waiting); the label is read by screen readers */
  badges?: Record<string, { count: number; label: string }>
  active: NavItem | undefined
  title?: string
  ribbon?: ReactNode
  onSwitchBranch: (id: string) => void
  onLogout: () => void
  children: ReactNode
}) {
  const patient = useActivePatient()
  const mobile = useIsMobile()
  useScrollHints(mobile)
  const [q, setQ] = useState('')
  const [more, setMore] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  useDialog(moreRef, () => setMore(false), mobile && more) // modal: focus in/trapped/back to Lainnya, Escape, no page scroll
  // Pinned top bar height -> --shell-sticky-h, so the chart's sticky patient header (allergies) sits right below it.
  const sticky = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sticky.current
    if (!el || typeof ResizeObserver !== 'function') return
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--shell-sticky-h', el.offsetHeight + 'px'))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const can = (p: string) => me.permissions.includes(p)
  const tabs = TABS.flatMap((p) => nav.filter((n) => n.path === p)).slice(0, 4)
  const rest = nav.filter((n) => !tabs.includes(n))
  const role = me.roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')
  const search = (e: FormEvent) => {
    e.preventDefault()
    location.hash = '/pasien?q=' + encodeURIComponent(q.trim())
    setQ('')
  }
  const quick = (can('patient.create') || can('appointment.create')) && (
    <Menu label="Aksi cepat" className="icon-btn icon-btn-primary" trigger={<Icon d={ICONS.plus} />}>
      {(close) => <>
        {can('patient.create') && <a href="#/pasien/baru" onClick={close}>Daftarkan pasien</a>}
        {can('appointment.create') && <a href="#/jadwal" onClick={close}>Buat janji</a>}
      </>}
    </Menu>
  )
  const bell = <button type="button" className="icon-btn" disabled aria-label="Notifikasi (segera hadir)"><Icon d={ICONS.bell} /></button>
  // App re-renders on hashchange, so reading the hash here stays current.
  const route = location.hash.slice(1).split('?')[0] || '/'
  const user = (
    <Menu label={`Akun ${me.user.name}`} className="shell-user" trigger={<>
      <span className="avatar" aria-hidden="true">{initials(me.user.name.replace(/^drg\.?\s*/i, ''))}</span>
      {!mobile && <span className="shell-user-text"><strong>{me.user.name}</strong><small>{role}</small></span>}
    </>}>
      {(close) => <>
        {mobile && <p className="menu-branch"><strong>{me.user.name}</strong> <small>{role}</small></p>}
        <Branch me={me} onSwitchBranch={(id) => { close(); onSwitchBranch(id) }} />
        <button type="button" onClick={() => { close(); onLogout() }}>Keluar</button>
      </>}
    </Menu>
  )
  const link = (n: NavItem, extra?: ReactNode) => (
    <a key={n.path} href={'#' + (n.href ?? n.path)} title={mobile ? undefined : n.label} className={n === active ? 'on' : undefined} aria-current={n === active ? 'page' : undefined}
      onClick={() => setMore(false)}>{extra}</a>
  )
  return (
    <div className="app-shell">
      {!mobile && <aside className="shell-side">
        <a className="shell-brand" href="#/" aria-label="Bittodent"><span className="brand-mark"><Icon d={ICONS.tooth} /></span> <span>Bittodent</span></a>
        <div className="shell-clinic">
          <strong title={me.active.tenant_name}>{me.active.tenant_name}</strong>
          {clinicSubtitle(me) && <span className="shell-clinic-sub">{clinicSubtitle(me)}</span>}
          <span className="badge-synthetic">DATA SINTETIS</span>
        </div>
        <nav className="shell-nav" aria-label="Modul utama">
          {SECTIONS.map((s) => {
            const items = nav.filter((n) => n.section === s)
            return items.length > 0 && <Fragment key={s}>
              <span className="shell-nav-caption shell-nav-group">{s}</span>
              {items.map((n) => link(n, <><Icon d={n.icon} /> <span className="shell-nav-label">{n.label}</span></>))}
            </Fragment>
          })}
        </nav>
      </aside>}
      <div className="shell-col">
        {/* top bar + ribbon stay pinned while the page scrolls: alerts must never scroll out of view */}
        <div className="shell-sticky" ref={sticky}>
        {mobile ? (
          // Mobile header per screen (sketch): Rekam Medis = back + title; patient list = "Pasien" (+ is a FAB there); else clinic + bell + avatar.
          route.startsWith('/rekam-medis/') ? (
            <header className="shell-top">
              <a className="icon-btn" href="#/pasien" aria-label="Kembali ke daftar pasien"><Icon d={ICONS.left} /></a>
              <strong className="shell-top-title">Rekam Medis</strong>
              <span className="badge-synthetic shell-top-synthetic">DATA SINTETIS</span>
            </header>
          ) : route === '/pasien' ? (
            <header className="shell-top">
              <strong className="shell-top-title" aria-hidden="true">Pasien</strong>
              <span className="badge-synthetic shell-top-synthetic">DATA SINTETIS</span>
            </header>
          ) : (
            <header className="shell-top">
              <span className="brand-mark" aria-hidden="true"><Icon d={ICONS.tooth} /></span>
              <span className="shell-top-clinic"><strong title={me.active.tenant_name}>{me.active.tenant_name}</strong><span className="badge-synthetic">DATA SINTETIS</span></span>
              {quick}
              {bell}
              {user}
            </header>
          )
        ) : (
          <header className="shell-top">
            {/* visual title only: each page keeps its own (screen-reader) h1, so there is exactly one heading */}
            {title && <p className="shell-title" aria-hidden="true">{active && <Icon d={active.icon} size={22} />}{title}</p>}
            {can('patient.read') && (
              <form className="shell-search" role="search" onSubmit={search}>
                <Icon d={ICONS.search} size={18} />
                <input type="search" placeholder="Cari pasien atau No. RM…" aria-label="Pencarian cepat pasien" value={q} onChange={(e) => setQ(e.target.value)} />
              </form>
            )}
            {/* the sidebar badge hides in the icon rail (<=1100px); this short chip keeps the prototype warning visible there */}
            <span className="badge-synthetic shell-top-synthetic">DATA SINTETIS</span>
            {quick}
            {bell}
            {user}
          </header>
        )}
        {patient && ribbon}
        </div>
        <main className="shell-main" key={me.active.branch_id}>{children}</main>
      </div>
      {mobile && (
        <nav className="bottom-nav" aria-label="Navigasi utama">
          {tabs.map((n) => link(n, <>
            <Icon d={n.icon} />
            {!!badges?.[n.path]?.count && <><span className="nav-badge" aria-hidden="true">{badges[n.path].count}</span><span className="sr-only">{badges[n.path].label}</span></>}
            <span>{n.label}</span>
          </>))}
          <button type="button" className={active && rest.includes(active) ? 'on' : undefined} aria-expanded={more} aria-haspopup="dialog" onClick={() => setMore(!more)}>
            <Icon d={ICONS.more} /><span>Lainnya</span>
          </button>
        </nav>
      )}
      {mobile && more && (
        <>
          <div className="sheet-backdrop" onClick={() => setMore(false)} />
          <div ref={moreRef} className="sheet more-sheet" role="dialog" aria-modal="true" aria-label="Menu lainnya">
            {rest.map((n) => link(n, <><Icon d={n.icon} /> {n.label}</>))}
            <Branch me={me} onSwitchBranch={(id) => { setMore(false); onSwitchBranch(id) }} />
            <button type="button" className="btn" onClick={() => { setMore(false); onLogout() }}>Keluar</button>
            <button type="button" className="btn btn-ghost" autoFocus onClick={() => setMore(false)}>Tutup</button>
          </div>
        </>
      )}
    </div>
  )
}
