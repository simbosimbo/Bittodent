// Composition root: routes + shell. Imports modules only through their index.ts.
import { useCallback, useEffect, useState } from 'react'
import { ApiError } from './shared/api/http'
import { setActivePatient, useActivePatient } from './shared/activePatient'
import { Shell, type NavItem } from './shared/layout/Shell'
import type { Me } from './shared/session'
import { ICONS } from './shared/ui/Icon'
import { getMe, Login, logout as apiLogout, switchBranch as apiSwitchBranch } from './modules/auth'
import { AlertRibbon, FamilyPage, MedicalHistoryPage, PatientDetail, PatientForm, PatientList } from './modules/patients'
import { Home, Schedule } from './modules/scheduling'
import { ChartPage } from './modules/clinical'

const useHash = () => {
  const [hash, setHash] = useState(location.hash.slice(1) || '/')
  useEffect(() => {
    const on = () => setHash(location.hash.slice(1) || '/')
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return hash
}

const NAV: (NavItem & { perm: string | null })[] = [
  { path: '/', label: 'Beranda', perm: null, icon: ICONS.home },
  { path: '/pasien', label: 'Pasien', perm: 'patient.read', icon: ICONS.users },
  { path: '/jadwal', label: 'Jadwal', perm: 'appointment.read', icon: ICONS.calendar },
  { path: '/rekam-medis', label: 'Rekam Medis', perm: 'note.read', icon: ICONS.tooth, group: 'pasien' },
  { path: '/keluarga', label: 'Keluarga', perm: 'patient.read', icon: ICONS.users, group: 'pasien' },
  { path: '/riwayat-medis', label: 'Riwayat Medis', perm: 'note.read', icon: ICONS.heart, group: 'pasien' },
]

export default function App() {
  const [me, setMe] = useState<Me | null>(null)
  const [state, setState] = useState<'loading' | 'guest' | 'ready' | 'no2fa' | 'error'>('loading')
  const [hash, query = ''] = useHash().split('?')
  const patient = useActivePatient()

  const load = useCallback(async () => {
    try {
      setMe(await getMe())
      setState('ready')
    } catch (e) {
      setMe(null)
      setState(e instanceof ApiError && e.status === 401 ? 'guest'
        : e instanceof ApiError && e.data?.error === 'two_factor_required' ? 'no2fa' : 'error')
    }
  }, [])

  useEffect(() => {
    load()
    const out = () => { setMe(null); setActivePatient(null); setState('guest') }
    addEventListener('ehr:unauthorized', out)
    return () => removeEventListener('ehr:unauthorized', out)
  }, [load])

  async function logout() {
    await apiLogout().catch(() => null)
    setMe(null)
    setActivePatient(null)
    setState('guest')
    location.hash = '/'
  }

  async function switchBranch(branchId: string) {
    await apiSwitchBranch(branchId)
    await load()
  }

  if (state === 'loading') return <div className="center muted">Memuat…</div>
  if (state === 'guest') return <Login onLoggedIn={load} />
  if (state === 'no2fa' || state === 'error' || !me)
    return (
      <div className="center">
        <div className="card state-card">
          <p>{state === 'no2fa' ? 'Akun ini wajib memakai autentikasi dua langkah. Hubungi pemilik klinik untuk mengaktifkannya.' : 'Tidak bisa terhubung ke server.'}</p>
          <button className="btn" onClick={state === 'no2fa' ? logout : load}>{state === 'no2fa' ? 'Keluar' : 'Coba lagi'}</button>
        </div>
      </div>
    )

  const can = (p: string | null) => p === null || me.permissions.includes(p)
  const nav = NAV.filter((n) => can(n.perm)).map((n) => n.group === 'pasien' ? { ...n, href: patient ? `${n.path}/${patient.id}` : '/pasien' } : n)
  const active = nav.find((n) => n.path === '/' ? hash === '/' : hash === n.path || hash.startsWith(n.path + '/'))
  const sub = hash.match(/^\/(keluarga|riwayat-medis)\/([\w-]+)$/)

  let page
  const chart = hash.match(/^\/rekam-medis\/([\w-]+)(?:\/janji\/([\w-]+))?$/)
  if (chart && can('note.read')) page = <ChartPage key={hash} patientId={chart[1]} appointmentId={chart[2]} me={me} />
  else if (sub?.[1] === 'keluarga' && can('patient.read')) page = <FamilyPage key={hash} id={sub[2]} canChart={can('note.read')} />
  else if (sub?.[1] === 'riwayat-medis' && can('note.read')) page = <MedicalHistoryPage key={hash} id={sub[2]} canChart={can('note.read')} canEdit={can('note.write')} />
  else if (hash === '/pasien/baru' && can('patient.create')) page = <PatientForm />
  else if (hash.startsWith('/pasien/') && can('patient.read')) page = <PatientDetail key={hash} id={hash.slice(8)} canChart={can('note.read')} />
  else if (hash === '/pasien' && can('patient.read')) page = <PatientList key={query} canCreate={can('patient.create')} initialQ={new URLSearchParams(query).get('q') ?? ''} />
  else if (hash === '/jadwal' && can('appointment.read')) page = <Schedule me={me} />
  else page = <Home me={me} />

  return <Shell me={me} nav={nav} active={active} ribbon={patient && can('patient.read') && <AlertRibbon patientId={patient.id} />} onSwitchBranch={switchBranch} onLogout={logout}>{page}</Shell>
}
