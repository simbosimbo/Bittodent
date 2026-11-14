import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BRANCHES, CLINIC, CURRENT_USER } from '../data/mock'
import type { BranchId } from '../data/types'
import { ageOf, maskNik, maskPhone } from '../lib/format'
import { go } from '../lib/router'
import { patientOf, useActive, useStore } from '../state/store'
import { OfflineBanner, Toast } from '../components/Chrome'
import { Icon, type IconName } from '../components/Icon'
import { MODULES } from '../components/ModuleRail'
import { ActivePatientSelector } from '../components/ActivePatientSelector'
import { Button, Switch } from '../components/ui'
import { APPT_STATUS } from '../components/Schedule'
import { ApptFacts, Jadwal } from '../screens/Jadwal'

export type ShellId = 'a' | 'b' | 'c'
export const isShellId = (v: string | null | undefined): v is ShellId => v === 'a' || v === 'b' || v === 'c'

const CLINIC_ADDR: Record<BranchId, string> = {
  menteng: 'Jl. Contoh Teuku Umar No. 10, Menteng',
  'kelapa-gading': 'Jl. Contoh Boulevard Raya, Kelapa Gading',
}

const GROUPS: { label: string; paths: string[] }[] = [
  { label: 'Klinik', paths: ['/jadwal', '/keluarga', '/charting', '/rencana', '/gambar'] },
  { label: 'Keuangan', paths: ['/tagihan'] },
]
const FOOT_PATHS = ['/kelola', '/alur']

function hrefFor(path: string, shell: ShellId) {
  return path === '/jadwal' ? `#/jadwal?shell=${shell}` : `#${path}`
}

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--sh-accent)" />
      <path d="M10 9c-2 0-3 2-3 4 0 3 1 5 2 8 .5 2 1 3 2 3s1.3-1.5 1.7-3c.4-1.4.8-2.5 1.3-2.5h2c.5 0 .9 1.1 1.3 2.5.4 1.5.7 3 1.7 3s1.5-1 2-3c1-3 2-5 2-8 0-2-1-4-3-4-1.6 0-2.6 1-4 1s-2.4-1-4-1z" fill="#fff" />
    </svg>
  )
}

function DirectionSwitcher({ current }: { current: ShellId }) {
  return (
    <nav className="shell-dirs" aria-label="Arah tampilan cangkang (hanya Jadwal)">
      <span>Arah</span>
      {(['a', 'b', 'c'] as const).map((id) => (
        <a key={id} href={`#/jadwal?shell=${id}`} aria-current={current === id ? 'page' : undefined} className={current === id ? 'on' : ''}>{id.toUpperCase()}</a>
      ))}
    </nav>
  )
}

function BranchSwitcher() {
  const { s, a } = useStore()
  const b = s.branches.find((x) => x.id === s.branchId)
  return (
    <label className="shell-branch">
      <span className="sr-only">Cabang klinik</span>
      <select className="input" value={s.branchId} onChange={(e) => a.setBranch(e.target.value as BranchId)}>
        {BRANCHES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      {b && <small>{CLINIC_ADDR[b.id]}</small>}
    </label>
  )
}

function ShellNav({ shell, iconOnly }: { shell: ShellId; iconOnly?: boolean }) {
  const { s } = useStore()
  const mods = MODULES.filter((m) => !(s.simple && m.secondary))
  const byPath = Object.fromEntries(mods.map((m) => [m.path, m]))
  const render = (path: string) => {
    const m = byPath[path]
    if (!m) return null
    const on = path === '/jadwal'
    return (
      <li key={path}>
        <a href={hrefFor(path, shell)} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} title={m.label}>
          <Icon name={m.icon as IconName} size={20} />
          <span className="shell-nav-label">{m.label}</span>
        </a>
      </li>
    )
  }
  return (
    <nav className={`shell-nav ${iconOnly ? 'is-icons' : ''}`} aria-label="Modul utama">
      {GROUPS.map((g) => (
        <div key={g.label} className="shell-nav-group">
          <div className="shell-nav-caption">{g.label}</div>
          <ul>{g.paths.map(render)}</ul>
        </div>
      ))}
      <div className="shell-nav-group shell-nav-foot">
        <ul>
          {FOOT_PATHS.map(render)}
          {!s.simple && shell !== 'c' && (
            <li>
              <a href="#/desain" title="Sistem desain">
                <Icon name="desain" size={20} />
                <span className="shell-nav-label">Sistem desain</span>
              </a>
            </li>
          )}
        </ul>
      </div>
    </nav>
  )
}

function SafetyStrip({ dense }: { dense?: boolean }) {
  const p = useActive()
  const { a } = useStore()
  const [show, setShow] = useState(false)
  if (!p) {
    return (
      <div className={`shell-safety is-empty ${dense ? 'is-dense' : ''}`}>
        <span>Belum ada pasien aktif.</span>
        <Button size="sm" variant="primary" onClick={() => a.openSelector(true)}><Icon name="search" size={16} />Pilih pasien</Button>
      </div>
    )
  }
  return (
    <div className={`shell-safety ${dense ? 'is-dense' : ''}`} aria-label="Ringkasan pasien aktif">
      <div className="shell-safety-id">
        <span className="avatar">{p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
        <div>
          <strong>{p.name}</strong>
          <div className="muted">{p.rm} · {ageOf(p.dob)} th · {p.sex === 'P' ? 'Perempuan' : 'Laki-laki'}{p.insurance ? ` · ${p.insurance.insurer}` : ' · Umum'}</div>
        </div>
      </div>
      <div className="shell-safety-chips">
        {p.allergies.length
          ? <span className="allergy-chip"><Icon name="alert" size={16} />Alergi: {p.allergies.join(', ')}</span>
          : <span className="allergy-chip none">Tidak ada alergi tercatat</span>}
        {(p.alerts ?? []).map((al) => <span key={al} className="alert-chip"><Icon name="alert" size={16} />Peringatan: {al}</span>)}
      </div>
      <dl className="shell-safety-sens">
        <div><dt>NIK</dt><dd>{show ? p.nik : maskNik(p.nik)}</dd></div>
        <div><dt>HP</dt><dd>{show ? p.phone : maskPhone(p.phone)}</dd></div>
        <button className="icon-btn" onClick={() => setShow(!show)} aria-pressed={show} aria-label={show ? 'Sembunyikan NIK dan HP' : 'Tampilkan NIK dan HP'}>
          <Icon name={show ? 'eyeOff' : 'eye'} />
        </button>
      </dl>
    </div>
  )
}

function UserBlock({ compact }: { compact?: boolean }) {
  return (
    <div className={`shell-user ${compact ? 'is-compact' : ''}`} title="Pengguna masuk">
      <span className="avatar">BS</span>
      <span className="shell-user-text"><strong>{CURRENT_USER.name}</strong><small>{CURRENT_USER.role}</small></span>
    </div>
  )
}

function ModeToggles({ dense }: { dense?: boolean }) {
  const { s, a } = useStore()
  return (
    <div className={`shell-toggles ${dense ? 'is-dense' : ''}`}>
      <Switch checked={s.simple} onChange={a.setSimple} label="Mode sederhana" />
      <Switch checked={s.offline} onChange={a.setOffline} label="Mode offline" />
    </div>
  )
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { s, a } = useStore()
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) { setQ(''); requestAnimationFrame(() => input.current?.focus()) } }, [open])
  const term = q.trim().toLowerCase()
  const patients = s.patients.filter((p) => !term || p.name.toLowerCase().includes(term) || p.rm.toLowerCase().includes(term)).slice(0, 6)
  const mods = MODULES.filter((m) => !(s.simple && m.secondary) && (!term || m.label.toLowerCase().includes(term)))
  if (!open) return null
  return (
    <div className="shell-cmd" role="dialog" aria-label="Palet perintah" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="shell-cmd-box">
        <div className="shell-cmd-search">
          <Icon name="search" size={18} />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari pasien, modul, atau perintah…" aria-label="Cari perintah" />
          <kbd>Esc</kbd>
        </div>
        <div className="shell-cmd-body">
          <div className="shell-cmd-caption">Pasien</div>
          <ul>
            {patients.map((p) => (
              <li key={p.id}>
                <button onClick={() => { a.setActive(p.id); onClose() }}>
                  <Icon name="user" size={16} />
                  <span>{p.name} · {p.rm}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="shell-cmd-caption">Modul</div>
          <ul>
            {mods.map((m) => (
              <li key={m.path}>
                <button onClick={() => { go(m.path === '/jadwal' ? '/jadwal?shell=b' : m.path); onClose() }}>
                  <Icon name={m.icon} size={16} />
                  <span>{m.label}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="shell-cmd-caption">Perintah</div>
          <ul>
            <li><button onClick={() => { a.setSimple(!s.simple); onClose() }}><Icon name="eye" size={16} /><span>{s.simple ? 'Matikan' : 'Aktifkan'} Mode sederhana</span></button></li>
            <li><button onClick={() => { a.setOffline(!s.offline); onClose() }}><Icon name="wifiOff" size={16} /><span>{s.offline ? 'Matikan' : 'Aktifkan'} Mode offline</span></button></li>
            <li><button onClick={() => { go('/keluarga/baru'); onClose() }}><Icon name="plus" size={16} /><span>Pasien baru</span></button></li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function ShellA({ children }: { children: ReactNode }) {
  const { a } = useStore()
  return (
    <>
      <aside className="shell-side">
        <a className="shell-brand" href="#/jadwal?shell=a" aria-label={`${CLINIC}, ke Jadwal`}>
          <BrandMark />
          <span>Bitto</span>
        </a>
        <BranchSwitcher />
        <ShellNav shell="a" />
        <div className="shell-side-foot">
          <a className="shell-help" href="#/alur"><Icon name="help" size={18} />Bantuan & alur</a>
          <DirectionSwitcher current="a" />
        </div>
      </aside>
      <div className="shell-col">
        <OfflineBanner />
        <header className="shell-top">
          <div className="shell-title">
            <h1>Jadwal</h1>
            <p className="muted">Hari ini di cabang yang dipilih. Waktu dalam WIB.</p>
          </div>
          <button className="shell-search" onClick={() => a.openSelector(true)}>
            <Icon name="search" size={18} />
            <span>Cari pasien atau janji</span>
          </button>
          <button className="icon-btn shell-bell" aria-label="Pemberitahuan sistem (2)" title="Pemberitahuan sistem">
            <Icon name="bell" />
            <span className="shell-bell-dot" aria-hidden>2</span>
          </button>
          <ModeToggles />
          <UserBlock />
        </header>
        <SafetyStrip />
        <div className="shell-main" id="main" tabIndex={-1}>
          <div className="shell-card">{children}</div>
        </div>
      </div>
    </>
  )
}

function ShellB({ children }: { children: ReactNode }) {
  const [cmd, setCmd] = useState(false)
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd((v) => !v) }
      if (e.key === 'Escape') setCmd(false)
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])
  return (
    <>
      <aside className="shell-side">
        <a className="shell-brand" href="#/jadwal?shell=b" aria-label={`${CLINIC}, ke Jadwal`}>
          <BrandMark size={28} />
          <span>Bitto</span>
        </a>
        <ShellNav shell="b" />
        <div className="shell-side-foot">
          <UserBlock compact />
          <DirectionSwitcher current="b" />
        </div>
      </aside>
      <div className="shell-col">
        <OfflineBanner />
        <header className="shell-top">
          <button className="shell-search is-cmd" onClick={() => setCmd(true)}>
            <Icon name="search" size={16} />
            <span>Cari pasien, janji, atau perintah…</span>
            <kbd>Ctrl+K</kbd>
          </button>
          <ActivePatientSelector />
          <ModeToggles dense />
        </header>
        <SafetyStrip dense />
        <div className="shell-main" id="main" tabIndex={-1}>{children}</div>
      </div>
      <CommandPalette open={cmd} onClose={() => setCmd(false)} />
    </>
  )
}

function ShellC({ children, detail }: { children: ReactNode; detail: ReactNode }) {
  return (
    <>
      <aside className="shell-side">
        <a className="shell-brand" href="#/jadwal?shell=c" aria-label={`${CLINIC}, ke Jadwal`}>
          <BrandMark size={32} />
        </a>
        <ShellNav shell="c" iconOnly />
        <div className="shell-side-foot">
          <DirectionSwitcher current="c" />
        </div>
      </aside>
      <div className="shell-col">
        <header className="shell-top">
          <div className="shell-title">
            <h1>Jadwal</h1>
          </div>
          <BranchSwitcher />
          <ActivePatientSelector />
          <ModeToggles dense />
          <UserBlock />
        </header>
        <OfflineBanner />
        <SafetyStrip />
        <div className="shell-main is-split" id="main" tabIndex={-1}>
          <div className="shell-split-board">{children}</div>
          <aside className="shell-panel" aria-label="Detail janji">{detail}</aside>
        </div>
      </div>
    </>
  )
}

export function JadwalShell({ variant }: { variant: ShellId }) {
  const { s, a } = useStore()
  const defaultAppt = useMemo(() => {
    const ofActive = s.appts.find((x) => x.patientId === s.activeId && x.branchId === s.branchId)
    return ofActive?.id ?? s.appts.find((x) => x.branchId === s.branchId)?.id ?? null
  }, [s.appts, s.activeId, s.branchId])
  const [open, setOpen] = useState<string | null>(variant === 'c' ? defaultAppt : null)
  const appt = s.appts.find((x) => x.id === open)
  const p = appt ? patientOf(s, appt.patientId) : null

  const board = (
    <Jadwal
      compact={variant === 'b'}
      selectedId={variant === 'c' ? open : undefined}
      onSelect={variant === 'c' ? setOpen : undefined}
      hideModal={variant === 'c'}
    />
  )

  const detail = appt && p ? (
    <div className="shell-panel-body">
      <header className="shell-panel-head">
        <div>
          <h2>Janji: {p.name}</h2>
          <p className="muted">{APPT_STATUS[appt.status]} · {p.rm}</p>
        </div>
        <button className="icon-btn" onClick={() => setOpen(null)} aria-label="Tutup detail"><Icon name="x" /></button>
      </header>
      {p.allergies.length
        ? <span className="allergy-chip"><Icon name="alert" size={16} />Alergi: {p.allergies.join(', ')}</span>
        : <span className="allergy-chip none">Tidak ada alergi tercatat</span>}
      {(p.alerts ?? []).map((al) => <span key={al} className="alert-chip"><Icon name="alert" size={16} />Peringatan: {al}</span>)}
      <ApptFacts apptId={appt.id} />
      <div className="shell-panel-actions">
        {appt.where === 'grid' && <Button onClick={() => a.moveAppt(appt.id, 'papan')}>Ke papan tunggu</Button>}
        <Button variant="primary" onClick={() => { a.setActive(p.id); go('/charting') }}>Jadikan pasien aktif & buka Charting</Button>
      </div>
    </div>
  ) : (
    <div className="shell-panel-empty">
      <Icon name="jadwal" size={32} />
      <h2>Pilih janji atau slot</h2>
      <p>Ketuk janji di kisi untuk melihat detail di panel ini, tanpa menutup jadwal.</p>
    </div>
  )

  return (
    <div className={`app app-shell ${s.offline ? 'is-offline' : ''}`} data-shell={variant}>
      <a href="#main" className="skip" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>Lewati ke konten</a>
      {variant === 'a' && <ShellA>{board}</ShellA>}
      {variant === 'b' && <ShellB>{board}</ShellB>}
      {variant === 'c' && <ShellC detail={detail}>{board}</ShellC>}
      <Toast />
    </div>
  )
}
