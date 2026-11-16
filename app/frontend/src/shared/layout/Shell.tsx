import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Select } from '../ui/Select'
import { Avatar, Button, buttonVariants } from '@heroui/react'
import { useActivePatient } from '../activePatient'
import { initials } from '../format'
import { ROLE_LABELS, type Me } from '../session'
import { Icon, ICONS } from '../ui/Icon'
import { Menu } from '../ui/Menu'
import { PageStage, Presence } from '../ui/presence'
import { useScrollHints } from '../ui/scrollHint'
import { Sheet } from '../ui/Sheet'
import { useIsMobile, useMedia } from '../useIsMobile'

// Mobile bottom tabs: the first 4 of these the user may open, in order; every other nav item goes in the "Lainnya" sheet (with
// branch + Keluar). Role-based: whoever takes payments but does not write the chart (kasir, front desk, pemilik) gets Kasir in
// one tap instead of Rekam Medis (#71); dentists and assistants keep Rekam Medis.
const TABS = ['/', '/jadwal', '/pasien', '/rekam-medis', '/kasir']
const CASH_TABS = ['/', '/jadwal', '/pasien', '/kasir', '/rekam-medis']
export const tabOrder = (perms: string[]) => perms.includes('billing.read') && !perms.includes('note.write') ? CASH_TABS : TABS
export const SECTIONS = ['KLINIK', 'KLINIS', 'KEUANGAN'] as const

// section = sidebar caption. group 'pasien' = screen of the active patient (href points at that patient; without one it leads to the patient list).
export type NavItem = { path: string; label: string; icon: string; section: typeof SECTIONS[number]; group?: 'pasien'; href?: string }

export const withActivePatientHref = <T extends NavItem>(nav: T[], patient: { id: string } | null): T[] =>
  nav.map((n) => n.group === 'pasien' ? { ...n, href: patient ? `${n.path}/${patient.id}` : '/pasien' } : n)

// Clinic subtitle: the address from Pengaturan Klinik (/api/me active.address); the branch name until one is filled in.
export const clinicSubtitle = (me: Me) => me.active.address || me.active.branch_name || ''

// Top bar title: the nav label, except the patient area reads "Daftar Pasien" (and the new-patient form "Pasien Baru").
export const pageTitle = (hash: string, active: NavItem | undefined) =>
  hash === '/pasien/baru' ? 'Pasien Baru' : active?.path === '/pasien' ? 'Daftar Pasien' : active?.label ?? ''

// One switcher for the avatar menu and the mobile "Lainnya" sheet: a select with 2+ branches, plain text with one.
function Branch({ me, onSwitchBranch }: { me: Me; onSwitchBranch: (id: string) => void }) {
  return me.branches.length < 2
    ? <p className="menu-branch"><small>Cabang</small> <strong>{me.active.branch_name}</strong></p>
    : <label className="menu-branch"><small>Cabang aktif</small>
        <Select value={me.active.branch_id ?? ''} onChange={(e) => onSwitchBranch(e.target.value)}>
          {me.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </label>
}

// Shell A: sidebar (brand, clinic block, KLINIK/KLINIS/KEUANGAN nav; icon rail <=1100px; bottom nav instead at <=720px),
// top bar (page title, search, + quick actions, bell, user menu), medical-alert ribbon slot whenever a patient is active.
export function Shell({ me, nav, active, title = '', ribbon, badges, queue, queueRail = true, onSwitchBranch, onLogout, children }: {
  me: Me
  nav: NavItem[]
  /** phone bottom-nav count per path (e.g. Jadwal: online bookings waiting); the label is read by screen readers */
  badges?: Record<string, { count: number; label: string }>
  active: NavItem | undefined
  title?: string
  ribbon?: ReactNode
  /** "Antrean hari ini" on desk pages: a rail on the right at ≥1281px, behind a top-bar button (sheet) below that */
  queue?: (where: 'rail' | 'sheet') => ReactNode
  /** false: the page needs its full width (patient table), so the queue stays behind the button even on a wide screen */
  queueRail?: boolean
  onSwitchBranch: (id: string) => void
  onLogout: () => void
  children: ReactNode
}) {
  const patient = useActivePatient()
  const mobile = useIsMobile()
  useScrollHints(mobile)
  const [q, setQ] = useState('')
  const [more, setMore] = useState(false)
  const wide = useMedia('(min-width: 1281px)') && queueRail
  const [queueOpen, setQueueOpen] = useState(false)
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
  const tabs = tabOrder(me.permissions).flatMap((p) => nav.filter((n) => n.path === p)).slice(0, 4)
  const rest = nav.filter((n) => !tabs.includes(n))
  const role = me.roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')
  const search = (e: FormEvent) => {
    e.preventDefault()
    location.hash = '/pasien?q=' + encodeURIComponent(q.trim())
    setQ('')
  }
  const quick = (can('patient.create') || can('appointment.create')) && (
    <Menu label="Aksi cepat" variant="primary" isIconOnly className="shell-quick shell-icon" trigger={<Icon d={ICONS.plus} />}>
      {(close) => <>
        {can('patient.create') && <a href="#/pasien/baru" onClick={close}>Daftarkan pasien</a>}
        {can('appointment.create') && <a href="#/jadwal" onClick={close}>Buat janji</a>}
      </>}
    </Menu>
  )
  const queueBtn = queue && !wide && (
    // phone: icon only, so the clinic name keeps its room
    <Button variant="ghost" isIconOnly={mobile} className={mobile ? 'shell-icon' : 'queue-toggle'} aria-label={mobile ? 'Antrean hari ini' : undefined}
      aria-haspopup="dialog" aria-expanded={queueOpen} onPress={() => setQueueOpen(true)}>
      <Icon d={ICONS.queue} size={mobile ? undefined : 18} />{!mobile && 'Antrean'}
    </Button>
  )
  const bell = <Button variant="ghost" isIconOnly className="shell-icon" isDisabled aria-label="Notifikasi (segera hadir)"><Icon d={ICONS.bell} /></Button>
  // App re-renders on hashchange, so reading the hash here stays current.
  const route = location.hash.slice(1).split('?')[0] || '/'
  useEffect(() => setQueueOpen(false), [route]) // the queue sheet never follows the user to another page
  const user = (
    <Menu label={`Akun ${me.user.name}`} className="shell-user" trigger={<>
      <Avatar size="sm" color="accent" variant="soft" className="shell-avatar" aria-hidden="true">
        <Avatar.Fallback>{initials(me.user.name.replace(/^drg\.?\s*/i, ''))}</Avatar.Fallback>
      </Avatar>
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
          // Mobile header (kanvas MP02): detail pages = back + title; every tab = the same clinic + actions bar.
          route.startsWith('/rekam-medis/') ? (
            <header className="shell-top">
              <a className={buttonVariants({ variant: 'ghost', isIconOnly: true }) + ' shell-icon'} href="#/pasien" aria-label="Kembali ke daftar pasien"><Icon d={ICONS.left} /></a>
              <strong className="shell-top-title">Rekam Medis</strong>
              <span className="badge-synthetic shell-top-synthetic">DATA SINTETIS</span>
            </header>
          ) : (
            <header className="shell-top">
              <span className="shell-top-clinic"><strong title={me.active.tenant_name}>{me.active.tenant_name}</strong><span className="badge-synthetic">DATA SINTETIS</span></span>
              {queueBtn}
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
            {queueBtn}
            {quick}
            {bell}
            {user}
          </header>
        )}
        {patient && ribbon}
        </div>
        <main className="shell-main" key={me.active.branch_id}><PageStage route={route}>{children}</PageStage></main>
      </div>
      {queue && wide && <aside className="queue-rail" key={me.active.branch_id}>{queue('rail')}</aside>}
      {queue && !wide && queueOpen && (
        <Sheet title="Antrean hari ini" className="queue-drawer" onClose={() => setQueueOpen(false)}>
          {/* following a link (chart, invoice, schedule) leaves the sheet behind */}
          <div onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setQueueOpen(false) }}>{queue('sheet')}</div>
        </Sheet>
      )}
      {mobile && (
        <nav className="bottom-nav" aria-label="Navigasi utama">
          {tabs.map((n) => link(n, <>
            <Icon d={n.icon} />
            {!!badges?.[n.path]?.count && <><span className="nav-badge" aria-hidden="true">{badges[n.path].count}</span><span className="sr-only">{badges[n.path].label}</span></>}
            {/* one-line labels: "Rekam Medis" reads "RM" on the tab, full name for screen readers */}
            {n.path === '/rekam-medis' ? <><span aria-hidden="true">RM</span><span className="sr-only">{n.label}</span></> : <span>{n.label}</span>}
          </>))}
          <button type="button" className={active && rest.includes(active) ? 'on' : undefined} aria-expanded={more} aria-haspopup="dialog" onClick={() => setMore(!more)}>
            <Icon d={ICONS.more} /><span>Lainnya</span>
          </button>
        </nav>
      )}
      {mobile && (
        <Presence open={more} exitMs={200}>
          <LainnyaSheet rest={rest} link={link} me={me}
            onSwitchBranch={(id) => { setMore(false); onSwitchBranch(id) }}
            onLogout={() => { setMore(false); onLogout() }}
            onClose={() => setMore(false)} />
        </Presence>
      )}
    </div>
  )
}

function LainnyaSheet({ rest, link, me, onSwitchBranch, onLogout, onClose }: {
  rest: NavItem[]
  link: (n: NavItem, extra?: ReactNode) => ReactNode
  me: Me
  onSwitchBranch: (id: string) => void
  onLogout: () => void
  onClose: () => void
}) {
  return (
    <Sheet title="Menu lainnya" className="more-sheet" onClose={onClose}>
      {rest.map((n) => link(n, <><Icon d={n.icon} /> {n.label}</>))}
      <Branch me={me} onSwitchBranch={onSwitchBranch} />
      <Button variant="secondary" fullWidth onPress={onLogout}>Keluar</Button>
    </Sheet>
  )
}
