import { BRANCHES } from '../data/mock'
import type { BranchId } from '../data/types'
import { useStore } from '../state/store'
import { ActivePatientSelector } from './ActivePatientSelector'
import { Switch } from './ui'

export function TopBar() {
  const { s, a } = useStore()
  return (
    <header className="topbar">
      <a className="brand" href="#/jadwal" aria-label="Bitto, ke Jadwal">
        <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="9" fill="var(--color-primary-700)" /><path d="M10 9c-2 0-3 2-3 4 0 3 1 5 2 8 .5 2 1 3 2 3s1.3-1.5 1.7-3c.4-1.4.8-2.5 1.3-2.5h2c.5 0 .9 1.1 1.3 2.5.4 1.5.7 3 1.7 3s1.5-1 2-3c1-3 2-5 2-8 0-2-1-4-3-4-1.6 0-2.6 1-4 1s-2.4-1-4-1z" fill="#fff" /></svg>
        <span>Bitto</span>
      </a>
      <label className="branch">
        <span className="sr-only">Cabang</span>
        <select className="input" value={s.branchId} onChange={(e) => a.setBranch(e.target.value as BranchId)}>
          {BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
      <ActivePatientSelector />
      <div className="topbar-toggles">
        <Switch checked={s.simple} onChange={a.setSimple} label="Mode sederhana" />
        <Switch checked={s.offline} onChange={a.setOffline} label="Mode offline" />
      </div>
      <div className="topbar-user" title="Pengguna masuk">
        <span className="avatar">BS</span>
        <span className="topbar-user-text"><strong>drg. Budi Santoso</strong><small>Dokter gigi</small></span>
      </div>
    </header>
  )
}
