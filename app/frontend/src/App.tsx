// Composition root: routes + shell. Imports modules only through their index.ts.
import { useCallback, useEffect, useState } from 'react'
import { Card } from '@heroui/react'
import { ApiError, hasCsrfCookie } from './shared/api/http'
import { clearActivePatients, useActivePatient } from './shared/activePatient'
import { pageTitle, Shell, withActivePatientHref, type NavItem } from './shared/layout/Shell'
import type { Me } from './shared/session'
import { PageSkeleton } from './shared/ui/Skeleton'
import { ICONS } from './shared/ui/Icon'
import { useIsMobile } from './shared/useIsMobile'
import { ribbonPatientId } from './shared/ribbonRoute'
import { getMe, Login, logout as apiLogout, switchBranch as apiSwitchBranch } from './modules/auth'
import { AlertRibbon, FamilyPage, MedicalHistoryPage, PatientDetail, PatientForm, PatientList } from './modules/patients'
import { Home, QueuePanel, Schedule, usePendingConfirm } from './modules/scheduling'
import { ChartPage, SettingsRmPage } from './modules/clinical'
import { InvoicePage, KasirPage, ShiftPage } from './modules/billing'
import { ReportPage, RevenuePage } from './modules/reporting'
import { BookingPage, ManagePage } from './modules/booking'
import { ClinicSettingsPage, SETTINGS_PERMS } from './modules/settings'

const useHash = () => {
  const [hash, setHash] = useState(location.hash.slice(1) || '/')
  useEffect(() => {
    const on = () => setHash(location.hash.slice(1) || '/')
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return hash
}

// Permissions: existing names only; 'a|b' = either. Kasir uses billing.read
// (owner/front_desk/kasir); Laporan = owner report (reporting.read, unit 6); Pengaturan RM = Selesai PIN / clinic settings (#55).
// Keluarga and Riwayat Medis are not in the nav: they live in the patient header menu (PatientPage).
export const NAV: (NavItem & { perm: string | null })[] = [
  { path: '/', label: 'Beranda', perm: null, icon: ICONS.home, section: 'KLINIK' },
  { path: '/jadwal', label: 'Jadwal', perm: 'appointment.read', icon: ICONS.calendar, section: 'KLINIK' },
  { path: '/pasien', label: 'Pasien', perm: 'patient.read', icon: ICONS.users, section: 'KLINIK' },
  { path: '/rekam-medis', label: 'Rekam Medis', perm: 'note.read', icon: ICONS.tooth, section: 'KLINIS', group: 'pasien' },
  { path: '/pengaturan-rm', label: 'Pengaturan RM', perm: 'note.sign|settings.manage', icon: ICONS.user, section: 'KLINIS' },
  { path: '/kasir', label: 'Kasir', perm: 'billing.read', icon: ICONS.card, section: 'KEUANGAN' },
  { path: '/pengaturan-klinik', label: 'Pengaturan Klinik', perm: SETTINGS_PERMS, icon: ICONS.settings, section: 'KEUANGAN' },
  { path: '/laporan', label: 'Laporan', perm: 'reporting.read', icon: ICONS.chart, section: 'KEUANGAN' },
]

/** A route this user may not open (or an unknown one): show Beranda and make the URL say so (replace, no extra history entry). */
function ToHome() {
  useEffect(() => {
    history.replaceState(history.state, '', '#/')
    dispatchEvent(new HashChangeEvent('hashchange')) // replaceState fires no hashchange; useHash re-reads '/' and renders Home
  }, [])
  return null
}

// Public patient pages (no login): #/book/{slug} and #/book/{slug}/manage/{token}.
const QUEUE_PAGES = ['/', '/pasien', '/kasir']

export default function App() {
  const hash = useHash().split('?')[0]
  const book = hash.match(/^\/book\/([\w-]+)(?:\/manage\/([\w-]+))?$/)
  if (book) return book[2] ? <ManagePage key={hash} slug={book[1]} token={book[2]} /> : <BookingPage key={book[1]} slug={book[1]} />
  return <StaffApp />
}

function StaffApp() {
  const [me, setMe] = useState<Me | null>(null)
  const [state, setState] = useState<'loading' | 'guest' | 'ready' | 'no2fa' | 'error'>('loading')
  const [hash, query = ''] = useHash().split('?')
  const patient = useActivePatient()
  const mobile = useIsMobile()
  // Jadwal badge on the phone bottom nav: online bookings waiting today, for desk roles (Meja depan / Pemilik) only.
  const desk = !!me?.roles.some((r) => ['owner', 'front_desk', 'kasir'].includes(r)) && !!me?.permissions.includes('appointment.read')
  const pendingCount = usePendingConfirm(me?.active.branch_id ?? null, mobile && desk)

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

  if (state === 'loading') return <PageSkeleton variant="app" />
  if (state === 'guest') return <Login onLoggedIn={load} />
  if (state === 'no2fa' || state === 'error' || !me)
    return (
      <div className="center">
        <Card className="state-card items-center">
          <p>{state === 'no2fa' ? 'Akun ini wajib memakai autentikasi dua langkah. Hubungi pemilik klinik untuk mengaktifkannya.' : 'Tidak bisa terhubung ke server.'}</p>
          <button className="btn" onClick={state === 'no2fa' ? logout : load}>{state === 'no2fa' ? 'Keluar' : 'Coba lagi'}</button>
        </Card>
      </div>
    )

  const can = (p: string | null) => p === null || p.split('|').some((x) => me.permissions.includes(x)) // a|b = either
  const nav = withActivePatientHref(NAV.filter((n) => can(n.perm)), patient)
  // Keluarga / Riwayat Medis are patient screens without a nav item: they count as Pasien.
  const navHash = hash.replace(/^\/(keluarga|riwayat-medis)\//, '/pasien/')
  const active = nav.find((n) => n.path === '/' ? hash === '/' : navHash === n.path || navHash.startsWith(n.path + '/'))
  const sub = hash.match(/^\/(keluarga|riwayat-medis)\/([\w-]+)$/)

  const ribbonId = ribbonPatientId(hash)
  let page
  const chart = hash.match(/^\/rekam-medis\/([\w-]+)(?:\/janji\/([\w-]+))?$/)
  if (chart && can('note.read')) page = <ChartPage patientId={chart[1]} appointmentId={chart[2]} me={me} />
  else if (hash.startsWith('/tagihan/') && can('billing.read')) page = <InvoicePage visitId={hash.slice(9)} me={me} />
  else if (sub?.[1] === 'keluarga' && can('patient.read')) page = <FamilyPage id={sub[2]} canChart={can('note.read')} />
  else if (sub?.[1] === 'riwayat-medis' && can('note.read')) page = <MedicalHistoryPage id={sub[2]} canChart={can('note.read')} canEdit={can('note.write')} />
  else if (hash === '/pasien/baru' && can('patient.create')) page = <PatientForm />
  else if (hash.startsWith('/pasien/') && can('patient.read')) page = <PatientDetail id={hash.slice(8)} canChart={can('note.read')} />
  else if (hash === '/pasien' && can('patient.read')) page = <PatientList meId={me.user.id} canCreate={can('patient.create')} canChart={can('note.read')} initialQ={new URLSearchParams(query).get('q') ?? ''} />
  else if (hash === '/jadwal' && can('appointment.read')) page = <Schedule me={me} newFor={new URLSearchParams(query).get('baru')} />
  else if (hash === '/kasir' && can('billing.read')) page = <KasirPage />
  else if (hash === '/shift' && can('billing.adjust')) page = <ShiftPage />
  else if (hash === '/laporan' && can('reporting.read')) page = <RevenuePage me={me} />
  else if (hash === '/laporan/integritas' && can('reporting.read')) page = <ReportPage />
  else if (/^\/pengaturan-klinik(\/(harga|pembayaran))?$/.test(hash) && can(SETTINGS_PERMS)) page = <ClinicSettingsPage me={me} tab={hash.split('/')[2] ?? ''} onChanged={load} />
  else if (hash === '/pengaturan-rm' && can('note.sign|settings.manage')) page = <SettingsRmPage me={me} onChanged={load} />
  else page = hash === '/' ? <Home me={me} /> : <ToHome />

  // Desk pages keep today's queue in view (KlinikMe pattern); the chart and settings need the full width.
  const queue = can('appointment.read') && QUEUE_PAGES.includes(hash) ? (where: 'rail' | 'sheet') => <QueuePanel me={me} where={where} /> : undefined
  return <Shell me={me} nav={nav} active={active} title={pageTitle(hash, active)} queue={queue} queueRail={hash !== '/pasien'}
    badges={{ '/jadwal': { count: pendingCount, label: `${pendingCount} janji online perlu konfirmasi` } }} ribbon={ribbonId && can('patient.read') && <AlertRibbon key={ribbonId} patientId={ribbonId} />}
    onSwitchBranch={switchBranch} onLogout={logout}>{page}</Shell>
}
