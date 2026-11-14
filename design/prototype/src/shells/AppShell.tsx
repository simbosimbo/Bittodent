import { type ReactNode, useEffect, useRef, useState } from 'react'
import { BRANCHES, CLINIC, CURRENT_USER } from '../data/mock'
import type { BranchId } from '../data/types'
import { ageOf, maskNik, maskPhone } from '../lib/format'
import { useActive, useStore } from '../state/store'
import { FlowStepper, OfflineBanner, Toast } from '../components/Chrome'
import { Icon, type IconName } from '../components/Icon'
import { MODULES } from '../components/ModuleRail'
import { ActivePatientSelector } from '../components/ActivePatientSelector'
import { Switch } from '../components/ui'

const CLINIC_ADDR: Record<BranchId, string> = {
  menteng: 'Jl. Contoh Teuku Umar No. 10, Menteng',
  'kelapa-gading': 'Jl. Contoh Boulevard Raya, Kelapa Gading',
}

const GROUPS: { label: string; paths: string[] }[] = [
  { label: 'Klinik', paths: ['/jadwal', '/keluarga', '/charting', '/rencana', '/gambar'] },
  { label: 'Keuangan', paths: ['/tagihan'] },
]
const FOOT_PATHS = ['/kelola', '/alur']

export function pageMeta(path: string): { title: string; subtitle?: string } {
  if (path.startsWith('/jadwal')) return { title: 'Jadwal', subtitle: 'Hari ini di cabang yang dipilih. Waktu dalam WIB.' }
  if (path === '/keluarga/baru') return { title: 'Registrasi', subtitle: 'Pasien baru — data palsu di prototipe.' }
  if (path.startsWith('/keluarga')) return { title: 'Keluarga / Profil', subtitle: 'Cari pasien, lalu buka profil keluarga.' }
  if (path.startsWith('/charting/soap')) return { title: 'Catatan SOAP', subtitle: 'Bagian dari Charting. Disusun dari dikte dokter; AI tidak mendiagnosis.' }
  if (path.startsWith('/charting')) return { title: 'Charting', subtitle: 'Odontogram di atas, daftar tindakan di bawah.' }
  if (path.startsWith('/rencana/presentasi')) return { title: 'Presentasi ke pasien', subtitle: 'Tampilkan rencana dalam bahasa yang mudah dipahami.' }
  if (path.startsWith('/rencana')) return { title: 'Rencana Perawatan', subtitle: 'Tindakan yang direncanakan dan disetujui.' }
  if (path.startsWith('/tagihan')) return { title: 'Tagihan', subtitle: 'Akun pasien aktif. Mode offline hanya tunai.' }
  if (path.startsWith('/gambar')) return { title: 'Gambar / Rontgen', subtitle: 'Foto dan radiograf pasien aktif.' }
  if (path.startsWith('/kelola')) return { title: 'Kelola', subtitle: 'Pengaturan kursi dan cabang.' }
  if (path.startsWith('/desain')) return { title: 'Sistem desain', subtitle: 'Token, warna, dan komponen Bitto.' }
  if (path.startsWith('/alur')) return { title: 'Alur kunjungan pertama', subtitle: 'Registrasi → jadwal → periksa → SOAP → bayar.' }
  return { title: 'Bitto' }
}

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--sh-accent)" />
      <path d="M10 9c-2 0-3 2-3 4 0 3 1 5 2 8 .5 2 1 3 2 3s1.3-1.5 1.7-3c.4-1.4.8-2.5 1.3-2.5h2c.5 0 .9 1.1 1.3 2.5.4 1.5.7 3 1.7 3s1.5-1 2-3c1-3 2-5 2-8 0-2-1-4-3-4-1.6 0-2.6 1-4 1s-2.4-1-4-1z" fill="#fff" />
    </svg>
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

function ShellNav({ path }: { path: string }) {
  const { s } = useStore()
  const mods = MODULES.filter((m) => !(s.simple && m.secondary))
  const byPath = Object.fromEntries(mods.map((m) => [m.path, m]))
  const on = (p: string) => path === p || path.startsWith(p + '/')
  const render = (modPath: string) => {
    const m = byPath[modPath]
    if (!m) return null
    const active = on(modPath)
    return (
      <li key={modPath}>
        <a href={'#' + modPath} className={active ? 'on' : ''} aria-current={active ? 'page' : undefined} title={m.label}>
          <Icon name={m.icon as IconName} size={20} />
          <span className="shell-nav-label">{m.label}</span>
        </a>
      </li>
    )
  }
  return (
    <nav className="shell-nav" aria-label="Modul utama">
      {GROUPS.map((g) => (
        <div key={g.label} className="shell-nav-group">
          <div className="shell-nav-caption">{g.label}</div>
          <ul>{g.paths.map(render)}</ul>
        </div>
      ))}
      <div className="shell-nav-group shell-nav-foot">
        <ul>
          {FOOT_PATHS.map(render)}
          {!s.simple && (
            <li>
              <a href="#/desain" className={on('/desain') ? 'on' : ''} title="Sistem desain">
                <Icon name="desain" size={20} />
                <span className="shell-nav-label">Sistem desain</span>
              </a>
            </li>
          )}
        </ul>
      </div>
      {s.simple && <p className="rail-note">Mode sederhana: modul Gambar & Kelola disembunyikan.</p>}
    </nav>
  )
}

function SafetyStrip() {
  const p = useActive()
  const [show, setShow] = useState(false)
  if (!p) return null
  return (
    <div className="shell-safety" aria-label="Peringatan pasien aktif">
      <div className="shell-safety-chips">
        {p.allergies.length
          ? <span className="allergy-chip"><Icon name="alert" size={16} />Alergi: {p.allergies.join(', ')}</span>
          : <span className="allergy-chip none">Tidak ada alergi tercatat</span>}
        {(p.alerts ?? []).map((al) => <span key={al} className="alert-chip"><Icon name="alert" size={16} />Peringatan: {al}</span>)}
      </div>
      <div className="muted shell-safety-meta">{p.rm} · {ageOf(p.dob)} th · {p.sex === 'P' ? 'Perempuan' : 'Laki-laki'}{p.insurance ? ` · ${p.insurance.insurer}` : ' · Umum'}</div>
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


function UserMenu() {
  const { s, a } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div className="shell-user-wrap" ref={ref}>
      <button type="button" className="shell-user" aria-expanded={open} aria-haspopup="menu" title="Menu pengguna" onClick={() => setOpen(!open)}>
        <span className="avatar">BS</span>
        <span className="shell-user-text"><strong>{CURRENT_USER.name}</strong><small>{CURRENT_USER.role}</small></span>
      </button>
      {open && (
        <div className="shell-user-menu" role="menu">
          <Switch checked={s.simple} onChange={a.setSimple} label="Mode sederhana" />
          <Switch checked={s.offline} onChange={a.setOffline} label="Mode offline" />
        </div>
      )}
    </div>
  )
}

export function AppShell({ path, children }: { path: string; children: ReactNode }) {
  const { s, a } = useStore()
  const { title, subtitle } = pageMeta(path)
  return (
    <div className={`app app-shell ${s.offline ? 'is-offline' : ''}`} data-shell="a">
      <a href="#main" className="skip" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>Lewati ke konten</a>
      <aside className="shell-side">
        <a className="shell-brand" href="#/jadwal" aria-label={`${CLINIC}, ke Jadwal`}>
          <BrandMark />
          <span>Bitto</span>
        </a>
        <BranchSwitcher />
        <ShellNav path={path} />
        <div className="shell-side-foot">
          <a className="shell-help" href="#/alur"><Icon name="help" size={18} />Bantuan & alur</a>
        </div>
      </aside>
      <div className="shell-col">
        <OfflineBanner />
        <header className="shell-top">
          <button className="shell-search" onClick={() => a.openSelector(true)}>
            <Icon name="search" size={18} />
            <span>Cari pasien atau janji</span>
          </button>
          <ActivePatientSelector />
          <button className="icon-btn shell-bell" aria-label="Pemberitahuan sistem (2)" title="Pemberitahuan sistem">
            <Icon name="bell" />
            <span className="shell-bell-dot" aria-hidden>2</span>
          </button>
          <UserMenu />
        </header>
        <SafetyStrip />
        <div className="shell-main" id="main" tabIndex={-1}>
          <header className="shell-pagehead">
            <h1>{title}</h1>
            {subtitle && <p className="muted">{subtitle}</p>}
          </header>
          {path !== '/alur' && <FlowStepper path={path} />}
          <div className="shell-card">{children}</div>
        </div>
      </div>
      <Toast />
    </div>
  )
}
