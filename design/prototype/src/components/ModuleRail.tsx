import { useStore } from '../state/store'
import { Icon, type IconName } from './Icon'

export const MODULES: { path: string; label: string; short: string; icon: IconName; secondary?: boolean }[] = [
  { path: '/jadwal', label: 'Jadwal', short: 'Jadwal', icon: 'jadwal' },
  { path: '/keluarga', label: 'Keluarga / Profil', short: 'Profil', icon: 'keluarga' },
  { path: '/tagihan', label: 'Tagihan (Akun)', short: 'Tagihan', icon: 'tagihan' },
  { path: '/rencana', label: 'Rencana Perawatan', short: 'Rencana', icon: 'rencana' },
  { path: '/charting', label: 'Charting', short: 'Charting', icon: 'charting' },
  { path: '/gambar', label: 'Gambar / Rontgen', short: 'Gambar', icon: 'gambar', secondary: true },
  { path: '/kelola', label: 'Kelola', short: 'Kelola', icon: 'kelola', secondary: true },
]

export function ModuleRail({ path }: { path: string }) {
  const { s } = useStore()
  const mods = MODULES.filter((m) => !(s.simple && m.secondary))
  const on = (p: string) => path === p || path.startsWith(p + '/')
  return (
    <nav className="rail" aria-label="Modul utama">
      <ul>
        {mods.map((m) => (
          <li key={m.path}>
            <a href={'#' + m.path} className={on(m.path) ? 'on' : ''} aria-current={on(m.path) ? 'page' : undefined}>
              <Icon name={m.icon} size={22} /><span className="rail-label">{m.label}</span><span className="rail-short">{m.short}</span>
            </a>
          </li>
        ))}
      </ul>
      <ul className="rail-foot">
        <li><a href="#/alur" className={on('/alur') ? 'on' : ''}><Icon name="alur" size={22} /><span className="rail-label">Alur kunjungan pertama</span><span className="rail-short">Alur</span></a></li>
        {!s.simple && <li><a href="#/desain" className={on('/desain') ? 'on' : ''}><Icon name="desain" size={22} /><span className="rail-label">Sistem desain</span><span className="rail-short">Desain</span></a></li>}
      </ul>
      {s.simple && <p className="rail-note">Mode sederhana: modul Gambar & Kelola disembunyikan.</p>}
    </nav>
  )
}
