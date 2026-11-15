import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import { useActivePatient } from '../activePatient'
import { initials } from '../format'
import { barRole, homePath, MODE_HINT, MODE_LABEL, tabOrder, useWorkMode, type WorkMode } from '../mode'
import { ROLE_LABELS, type Me } from '../session'
import { discardForms, prepareModeSwitch, saveFormsAndContinue } from '../unsaved'
import { Icon, ICONS } from '../ui/Icon'
import { Menu } from '../ui/Menu'
import { PageStage, Presence, usePresenceClass } from '../ui/presence'
import { useScrollHints } from '../ui/scrollHint'
import { useDialog } from '../ui/Sheet'
import { say, ToastHost } from '../ui/Toast'
import { useIsMobile } from '../useIsMobile'

export { tabOrder, barRole, homePath } from '../mode'

export const SECTIONS = ['KLINIK', 'KLINIS', 'KEUANGAN'] as const
const MODE_ICON: Record<WorkMode, string> = { dokter: ICONS.tooth, depan: ICONS.monitor, pemilik: ICONS.crown }

// section = sidebar caption. group 'pasien' = screen of the active patient (href points at that patient; without one it leads to the patient list).
export type NavItem = { path: string; label: string; icon: string; section: typeof SECTIONS[number] | 'SISTEM'; group?: 'pasien'; href?: string }

export const withActivePatientHref = <T extends NavItem>(nav: T[], patient: { id: string } | null): T[] =>
  nav.map((n) => n.group === 'pasien' ? { ...n, href: patient ? `${n.path}/${patient.id}` : '/pasien' } : n)

// Clinic subtitle: the address from Pengaturan Klinik (/api/me active.address); the branch name until one is filled in.
export const clinicSubtitle = (me: Me) => me.active.address || me.active.branch_name || ''

// Top bar title: the nav label, except the patient area reads "Daftar Pasien" (and the new-patient form "Pasien Baru").
export const pageTitle = (hash: string, active: NavItem | undefined) =>
  hash === '/pasien/baru' ? 'Pasien Baru' : hash.startsWith('/pengaturan') ? 'Pengaturan'
    : active?.path === '/pasien' ? 'Daftar Pasien' : active?.label ?? ''

export function Shell({ me, nav, active, title = '', ribbon, badges, onSwitchBranch, onLogout, children }: {
  me: Me
  nav: NavItem[]
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
  const { mode, setMode, modes, multi } = useWorkMode(me)
  useScrollHints(mobile)
  const [q, setQ] = useState('')
  const [more, setMore] = useState(false)
  const [sheet, setSheet] = useState<'mode' | 'branch' | null>(null)
  const [pendingMode, setPendingMode] = useState<WorkMode | null>(null)
  const moreRef = useRef<HTMLDivElement>(null)
  const extraRef = useRef<HTMLDivElement>(null)
  useDialog(moreRef, () => setMore(false), mobile && more && !sheet)
  useDialog(extraRef, () => { setSheet(null); setPendingMode(null) }, mobile && (!!sheet || !!pendingMode))
  const sticky = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sticky.current
    if (!el || typeof ResizeObserver !== 'function') return
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--shell-sticky-h', el.offsetHeight + 'px'))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const can = (p: string) => me.permissions.includes(p)
  const order = tabOrder(me.roles, mode)
  const tabs = order.flatMap((p) => nav.filter((n) => n.path === p))
  const rest = nav.filter((n) => !tabs.some((t) => t.path === n.path))
  const role = me.roles.map((r) => ROLE_LABELS[r] ?? r).join(' · ')
  const search = (e: FormEvent) => {
    e.preventDefault()
    location.hash = '/pasien?q=' + encodeURIComponent(q.trim())
    setQ('')
  }
  const commitMode = (next: WorkMode, prev = mode) => {
    setMode(next)
    setSheet(null)
    setMore(false)
    setPendingMode(null)
    const bar = barRole(me.roles, next)
    const path = (location.hash.slice(1).split('?')[0] || '/')
    const still = nav.some((n) => n.path === '/' ? path === '/' : path === n.path || path.startsWith(n.path + '/'))
    if (!still) location.hash = homePath(bar)
    say(`Mode ${MODE_LABEL[next]}`, () => setMode(prev))
  }
  const requestMode = async (next: WorkMode) => {
    if (next === mode) { setSheet(null); return }
    const result = await prepareModeSwitch()
    if (result === 'confirm') { setPendingMode(next); return }
    commitMode(next)
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
  const route = location.hash.slice(1).split('?')[0] || '/'
  const avatar = <>
    <span className="avatar" aria-hidden="true">{initials(me.user.name.replace(/^drg\.\?\s*/i, ''))}</span>
    {multi && <span className="avatar-mode" aria-hidden="true" />}
    {!mobile && <span className="shell-user-text"><strong>{me.user.name}</strong><small>{multi ? `Mode ${MODE_LABEL[mode]} · ${me.active.branch_name ?? ''}` : role}</small></span>}
  </>
  const user = mobile && multi ? (
    <button type="button" className="shell-user has-mode" aria-label={`Akun ${me.user.name}`} onClick={() => { setMore(true); setSheet('mode') }}>{avatar}</button>
  ) : (
    <Menu label={`Akun ${me.user.name}`} className={`shell-user${multi ? ' has-mode' : ''}`} trigger={avatar}>
      {(close) => <>
        {mobile && <p className="menu-branch"><strong>{me.user.name}</strong> <small>{role}</small></p>}
        {multi && !mobile && <ModeRadios modes={modes} mode={mode} onPick={(m) => { close(); void requestMode(m) }} />}
        <BranchRows me={me} onSwitchBranch={(id) => { close(); onSwitchBranch(id) }} />
        <button type="button" onClick={() => { close(); onLogout() }}>Keluar</button>
      </>}
    </Menu>
  )
  const link = (n: NavItem, extra?: ReactNode) => (
    <a key={n.path} href={'#' + (n.href ?? n.path)} title={mobile ? undefined : n.label} className={n === active || (n.path === '/pengaturan' && route.startsWith('/pengaturan')) ? 'on' : undefined}
      aria-current={n === active || (n.path === '/pengaturan' && route.startsWith('/pengaturan')) ? 'page' : undefined}
      onClick={() => setMore(false)}>{extra}</a>
  )
  const settings = nav.find((n) => n.path === '/pengaturan')
  const sideNav = nav.filter((n) => n.path !== '/pengaturan')
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
            const items = sideNav.filter((n) => n.section === s)
            return items.length > 0 && <Fragment key={s}>
              <span className="shell-nav-caption shell-nav-group">{s}</span>
              {items.map((n) => link(n, <><Icon d={n.icon} /> <span className="shell-nav-label">{n.label}</span></>))}
            </Fragment>
          })}
        </nav>
        {settings && <div className="shell-side-foot">{link(settings, <><Icon d={settings.icon} /> <span className="shell-nav-label">{settings.label}</span></>)}</div>}
      </aside>}
      <div className="shell-col">
        <div className="shell-sticky" ref={sticky}>
        {mobile ? (
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
          ) : route.startsWith('/pengaturan') ? (
            <header className="shell-top">
              {route !== '/pengaturan' && <a className="icon-btn" href="#/pengaturan" aria-label="Kembali ke pengaturan"><Icon d={ICONS.left} /></a>}
              <strong className="shell-top-title">{title || 'Pengaturan'}</strong>
              <span className="badge-synthetic shell-top-synthetic">DATA SINTETIS</span>
            </header>
          ) : (
            <header className="shell-top">
              <span className="brand-mark" aria-hidden="true"><Icon d={ICONS.tooth} /></span>
              <span className="shell-top-clinic"><strong title={me.active.tenant_name}>{me.active.tenant_name}</strong>
                {me.active.branch_name && <small className="shell-top-date">{me.active.branch_name}</small>}
                <span className="badge-synthetic">DATA SINTETIS</span></span>
              {quick}
              {bell}
              {user}
            </header>
          )
        ) : (
          <header className="shell-top">
            {title && <p className="shell-title" aria-hidden="true">{active && <Icon d={active.icon} size={22} />}{title}</p>}
            {can('patient.read') && (
              <form className="shell-search" role="search" onSubmit={search}>
                <Icon d={ICONS.search} size={18} />
                <input type="search" placeholder="Cari pasien atau No. RM…" aria-label="Pencarian cepat pasien" value={q} onChange={(e) => setQ(e.target.value)} />
              </form>
            )}
            <span className="badge-synthetic shell-top-synthetic">DATA SINTETIS</span>
            {quick}
            {bell}
            {user}
          </header>
        )}
        {patient && ribbon}
        </div>
        <main className="shell-main" key={me.active.branch_id}><PageStage route={route}>{children}</PageStage></main>
      </div>
      {mobile && (
        <nav className="bottom-nav" aria-label="Navigasi utama">
          {tabs.map((n) => link(n, <>
            <Icon d={n.icon} />
            {!!badges?.[n.path]?.count && <><span className="nav-badge" aria-hidden="true">{badges[n.path].count}</span><span className="sr-only">{badges[n.path].label}</span></>}
            <span>{n.label === 'Rekam Medis' ? 'RM' : n.label}</span>
          </>))}
          <button type="button" className={(active && rest.includes(active)) || route.startsWith('/pengaturan') ? 'on' : undefined}
            aria-expanded={more} aria-haspopup="dialog" onClick={() => setMore(!more)}>
            <Icon d={ICONS.more} /><span>Lainnya</span>
          </button>
        </nav>
      )}
      {mobile && (
        <Presence open={more} exitMs={200}>
          <LainnyaSheet sheetRef={moreRef} rest={rest} link={link} me={me} mode={mode} multi={multi}
            onOpenMode={() => setSheet('mode')} onOpenBranch={() => setSheet('branch')}
            onLogout={() => { setMore(false); onLogout() }}
            onClose={() => setMore(false)} />
        </Presence>
      )}
      {mobile && (
        <Presence open={sheet === 'mode' || sheet === 'branch' || !!pendingMode} exitMs={200}>
          {pendingMode ? (
            <ConfirmSwitch sheetRef={extraRef} onSave={async () => { await saveFormsAndContinue(); commitMode(pendingMode) }}
              onDiscard={() => { discardForms(); commitMode(pendingMode) }} onCancel={() => setPendingMode(null)} />
          ) : sheet === 'mode' ? (
            <ModeSheet sheetRef={extraRef} me={me} modes={modes} mode={mode} onPick={requestMode} onOpenBranch={() => setSheet('branch')}
              onClose={() => setSheet(null)} />
          ) : sheet === 'branch' ? (
            <BranchSheet sheetRef={extraRef} me={me} onPick={(id) => {
              const b = me.branches.find((x) => x.id === id)
              setSheet(null); setMore(false); onSwitchBranch(id)
              if (b) say(`Cabang ${shortBranch(b.name)}`)
            }} onClose={() => setSheet(null)} />
          ) : null}
        </Presence>
      )}
      <ToastHost />
    </div>
  )
}

function shortBranch(name: string) {
  return name.replace(/^Senyum Sehat\s+/i, '').replace(/^Cabang\s+/i, '') || name
}

function LainnyaSheet({ sheetRef, rest, link, me, mode, multi, onOpenMode, onOpenBranch, onLogout, onClose }: {
  sheetRef: RefObject<HTMLDivElement | null>
  rest: NavItem[]
  link: (n: NavItem, extra?: ReactNode) => ReactNode
  me: Me
  mode: WorkMode
  multi: boolean
  onOpenMode: () => void
  onOpenBranch: () => void
  onLogout: () => void
  onClose: () => void
}) {
  const phase = usePresenceClass()
  const role = me.roles.map((r) => ROLE_LABELS[r] ?? r).join(' · ')
  const many = me.branches.length >= 2
  return (
    <>
      <div className={`sheet-backdrop ${phase}`} onClick={onClose} />
      <div ref={sheetRef} className={`sheet more-sheet more-sheet-v2 ${phase}`} role="dialog" aria-modal="true" aria-label="Menu lainnya">
        <div className="sheet-handle" aria-hidden="true" />
        <div className="lain-profile">
          <span className="avatar" aria-hidden="true">{initials(me.user.name.replace(/^drg\.?\s*/i, ''))}</span>
          <div>
            <strong>{me.user.name}</strong>
            <small>{role}</small>
          </div>
        </div>
        <div className="lain-card">
          {multi && <button type="button" className="lain-row" onClick={onOpenMode}>
            <span className="lain-ico"><Icon d={ICONS.monitor} /></span>
            <span className="lain-row-text">Mode</span>
            <span className="lain-row-val">{MODE_LABEL[mode]}</span>
            <Icon d={ICONS.right} />
          </button>}
          {many ? <button type="button" className="lain-row" onClick={onOpenBranch}>
            <span className="lain-ico"><Icon d={ICONS.mapPin} /></span>
            <span className="lain-row-text">Cabang</span>
            <span className="lain-row-val">{shortBranch(me.active.branch_name ?? '')}</span>
            <Icon d={ICONS.right} />
          </button> : <p className="lain-row lain-row-static">
            <span className="lain-ico"><Icon d={ICONS.mapPin} /></span>
            <span className="lain-row-text">Cabang</span>
            <span className="lain-row-val">{shortBranch(me.active.branch_name ?? '')}</span>
          </p>}
        </div>
        {rest.length > 0 && <div className="lain-card">
          {rest.map((n) => link(n, <><span className="lain-ico"><Icon d={n.icon} /></span> <span className="lain-row-text">{n.label}</span> <Icon d={ICONS.right} /></>))}
        </div>}
        <button type="button" className="btn btn-danger-soft" onClick={onLogout}><Icon d={ICONS.logOut} /> Keluar</button>
      </div>
    </>
  )
}

function ModeRadios({ modes, mode, onPick }: { modes: WorkMode[]; mode: WorkMode; onPick: (m: WorkMode) => void }) {
  return (
    <div className="mode-radios" role="radiogroup" aria-label="Mode">
      {modes.map((m) => (
        <label key={m} className={m === mode ? 'on' : undefined}>
          <span className="lain-ico"><Icon d={MODE_ICON[m]} /></span>
          <span className="mode-radio-text"><strong>{MODE_LABEL[m]}</strong><small>{MODE_HINT[m]}</small></span>
          <input type="radio" name="work-mode" value={m} checked={m === mode} onChange={() => onPick(m)} />
        </label>
      ))}
    </div>
  )
}

function ModeSheet({ sheetRef, me, modes, mode, onPick, onOpenBranch, onClose }: {
  sheetRef: RefObject<HTMLDivElement | null>
  me: Me
  modes: WorkMode[]
  mode: WorkMode
  onPick: (m: WorkMode) => void
  onOpenBranch: () => void
  onClose: () => void
}) {
  const phase = usePresenceClass()
  const role = me.roles.map((r) => ROLE_LABELS[r] ?? r).join(' · ')
  const many = me.branches.length >= 2
  return (
    <>
      <div className={`sheet-backdrop ${phase}`} onClick={onClose} />
      <div ref={sheetRef} className={`sheet more-sheet more-sheet-v2 ${phase}`} role="dialog" aria-modal="true" aria-label="Mode">
        <div className="sheet-handle" aria-hidden="true" />
        <div className="lain-profile">
          <span className="avatar" aria-hidden="true">{initials(me.user.name.replace(/^drg\.?\s*/i, ''))}</span>
          <div>
            <strong>{me.user.name}</strong>
            <small>{role}</small>
          </div>
        </div>
        <ModeRadios modes={modes} mode={mode} onPick={onPick} />
        {many ? <button type="button" className="lain-row lain-branch-foot" onClick={onOpenBranch}>
          <span className="lain-ico"><Icon d={ICONS.mapPin} /></span>
          <span className="lain-row-text">Cabang</span>
          <span className="lain-row-val">{shortBranch(me.active.branch_name ?? '')}</span>
          <Icon d={ICONS.right} />
        </button> : <p className="lain-row lain-row-static lain-branch-foot">
          <span className="lain-ico"><Icon d={ICONS.mapPin} /></span>
          <span className="lain-row-text">Cabang</span>
          <span className="lain-row-val">{shortBranch(me.active.branch_name ?? '')}</span>
        </p>}
      </div>
    </>
  )
}

function BranchSheet({ sheetRef, me, onPick, onClose }: {
  sheetRef: RefObject<HTMLDivElement | null>
  me: Me
  onPick: (id: string) => void
  onClose: () => void
}) {
  const phase = usePresenceClass()
  return (
    <>
      <div className={`sheet-backdrop ${phase}`} onClick={onClose} />
      <div ref={sheetRef} className={`sheet more-sheet more-sheet-v2 ${phase}`} role="dialog" aria-modal="true" aria-label="Cabang">
        <div className="sheet-handle" aria-hidden="true" />
        <h2 className="lain-sheet-title">Cabang</h2>
        <div className="mode-radios" role="radiogroup" aria-label="Pilih cabang">
          {me.branches.map((b) => (
            <label key={b.id} className={b.id === me.active.branch_id ? 'on' : undefined}>
              <span className="lain-ico"><Icon d={ICONS.building} /></span>
              <span className="mode-radio-text"><strong>{b.name}</strong></span>
              <input type="radio" name="branch" value={b.id} checked={b.id === me.active.branch_id} onChange={() => onPick(b.id)} />
            </label>
          ))}
        </div>
      </div>
    </>
  )
}

function BranchRows({ me, onSwitchBranch }: { me: Me; onSwitchBranch: (id: string) => void }) {
  return me.branches.length < 2
    ? <p className="menu-branch"><small>Cabang</small> <strong>{me.active.branch_name}</strong></p>
    : <label className="menu-branch"><small>Cabang aktif</small>
        <select value={me.active.branch_id ?? ''} onChange={(e) => onSwitchBranch(e.target.value)}>
          {me.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
}

function ConfirmSwitch({ sheetRef, onSave, onDiscard, onCancel }: {
  sheetRef: RefObject<HTMLDivElement | null>
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}) {
  const phase = usePresenceClass()
  const [busy, setBusy] = useState(false)
  return (
    <>
      <div className={`sheet-backdrop ${phase}`} onClick={onCancel} />
      <div ref={sheetRef} className={`sheet more-sheet more-sheet-v2 ${phase}`} role="dialog" aria-modal="true" aria-label="Simpan isian dulu?">
        <div className="sheet-handle" aria-hidden="true" />
        <h2 className="lain-sheet-title">Simpan isian dulu?</h2>
        <p className="muted">Isian belum disimpan. Pilih Simpan dan ganti agar tidak hilang.</p>
        <div className="lain-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => { setBusy(true); void onSave() }}>Simpan dan ganti</button>
          <button type="button" className="btn" onClick={onCancel}>Batal</button>
          <button type="button" className="btn btn-ghost" onClick={onDiscard}>Buang isian</button>
        </div>
      </div>
    </>
  )
}
