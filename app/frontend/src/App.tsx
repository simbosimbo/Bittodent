// Composition root: routes + shell. Imports modules only through their index.ts.
import { useCallback, useEffect, useState } from 'react'
import { ApiError, hasCsrfCookie } from './shared/api/http'
import { clearActivePatients, useActivePatient } from './shared/activePatient'
import { pageTitle, Shell, withActivePatientHref, type NavItem } from './shared/layout/Shell'
import type { Me } from './shared/session'
import { ComingSoon } from './shared/ui/ComingSoon'
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

// Permissions: existing names only. Resep reuses note.read (no prescription permission yet);
// Kasir + Laporan use billing.read (no report permission), so dentists/assistants do not see them; owner/front_desk/kasir do.
// Keluarga and Riwayat Medis are not in the nav: they live in the patient header menu (PatientPage).
export const NAV: (NavItem & { perm: string | null })[] = [
  { path: '/', label: 'Beranda', perm: null, icon: ICONS.home, section: 'KLINIK' },
  { path: '/jadwal', label: 'Jadwal', perm: 'appointment.read', icon: ICONS.calendar, section: 'KLINIK' },
  { path: '/antrean', label: 'Antrean', perm: 'appointment.read', icon: ICONS.queue, section: 'KLINIK' },
  { path: '/pasien', label: 'Pasien', perm: 'patient.read', icon: ICONS.users, section: 'KLINIK' },
  { path: '/rekam-medis', label: 'Rekam Medis', perm: 'note.read', icon: ICONS.tooth, section: 'KLINIS', group: 'pasien' },
  { path: '/resep', label: 'Resep', perm: 'note.read', icon: ICONS.receipt, section: 'KLINIS' },
  { path: '/kasir', label: 'Kasir', perm: 'billing.read', icon: ICONS.card, section: 'KEUANGAN' },
  { path: '/laporan', label: 'Laporan', perm: 'billing.read', icon: ICONS.chart, section: 'KEUANGAN' },
]

export default function App() {
  const [me, setMe] = useState<Me | null>(null)
  const [state, setState] = useState<'loading' | 'guest' | 'ready' | 'no2fa' | 'error'>('loading')
  const [hash, query = ''] = useHash().split('?')
  const patient = useActivePatient()

  const load = useCallback(async () => {
    // No XSRF-TOKEN → never had a session here; skip /api/me so a fresh guest visit logs no 401.
    if (!hasCsrfCookie()) { setMe(null); setState('guest'); return }
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
    const out = () => { setMe(null); clearActivePatients(); setState('guest') }
    addEventListener('ehr:unauthorized', out)
    return () => removeEventListener('ehr:unauthorized', out)
  }, [load])

  async function logout() {
    await apiLogout().catch(() => null)
    setMe(null)
    clearActivePatients()
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
  const nav = withActivePatientHref(NAV.filter((n) => can(n.perm)), patient)
  // Keluarga / Riwayat Medis are patient screens without a nav item: they count as Pasien.
  const navHash = hash.replace(/^\/(keluarga|riwayat-medis)\//, '/pasien/')
  const active = nav.find((n) => n.path === '/' ? hash === '/' : navHash === n.path || navHash.startsWith(n.path + '/'))
  const soon = nav.find((n) => ['/antrean', '/resep', '/kasir', '/laporan'].includes(n.path) && hash === n.path)
  const sub = hash.match(/^\/(keluarga|riwayat-medis)\/([\w-]+)$/)

  let page
  const chart = hash.match(/^\/rekam-medis\/([\w-]+)(?:\/janji\/([\w-]+))?$/)
  if (chart && can('note.read')) page = <ChartPage key={hash} patientId={chart[1]} appointmentId={chart[2]} me={me} />
  else if (sub?.[1] === 'keluarga' && can('patient.read')) page = <FamilyPage key={hash} id={sub[2]} canChart={can('note.read')} />
  else if (sub?.[1] === 'riwayat-medis' && can('note.read')) page = <MedicalHistoryPage key={hash} id={sub[2]} canChart={can('note.read')} canEdit={can('note.write')} />
  else if (hash === '/pasien/baru' && can('patient.create')) page = <PatientForm />
  else if (hash.startsWith('/pasien/') && can('patient.read')) page = <PatientDetail key={hash} id={hash.slice(8)} canChart={can('note.read')} />
  else if (hash === '/pasien' && can('patient.read')) page = <PatientList key={query} canCreate={can('patient.create')} canChart={can('note.read')} initialQ={new URLSearchParams(query).get('q') ?? ''} />
  else if (hash === '/jadwal' && can('appointment.read')) page = <Schedule me={me} />
  else if (soon) page = <ComingSoon title={soon.label} />
  else page = <Home me={me} />

  return <Shell me={me} nav={nav} active={active} title={pageTitle(hash, active)} ribbon={patient && can('patient.read') && !/^\/rekam-medis\//.test(hash) && <AlertRibbon patientId={patient.id} />}
    onSwitchBranch={switchBranch} onLogout={logout}>{page}</Shell>
}
