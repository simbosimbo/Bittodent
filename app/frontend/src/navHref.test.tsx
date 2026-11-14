import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App, { NAV } from './App'
import { PatientPage } from './modules/patients'
import { setActivePatient } from './shared/activePatient'
import { clinicSubtitle, pageTitle, Shell, withActivePatientHref } from './shared/layout/Shell'
import type { Me } from './shared/session'

// Synthetic data only.
const me: Me = {
  user: { id: 'u1', name: 'drg. Uji Sintetis', email: 'dokter@uji.test' }, roles: ['owner'],
  permissions: ['patient.read', 'patient.create', 'note.read', 'appointment.read', 'appointment.create', 'billing.read'],
  active: { tenant_id: 't1', tenant_name: 'Klinik Gigi Senyum Sehat', branch_id: 'b1', branch_name: 'Cabang Tebet', timezone: 'Asia/Jakarta' },
  branches: [{ id: 'b1', name: 'Cabang Tebet', timezone: 'Asia/Jakarta' }, { id: 'b2', name: 'Cabang Uji Dua', timezone: 'Asia/Jakarta' }],
}
const dentist: Me = { ...me, roles: ['dentist'], permissions: ['patient.read', 'note.read', 'appointment.read'], branches: [me.branches[0]] }
const visible = (m: Me) => NAV.filter((n) => n.perm === null || m.permissions.includes(n.perm))
const hrefs = (patient: { id: string } | null) =>
  Object.fromEntries(withActivePatientHref(NAV, patient).map((n) => [n.label, n.href ?? n.path]))
const shell = (m: Me, patient: { id: string } | null = null, path?: string, onSwitchBranch = () => {}, onLogout = () => {}) => {
  const nav = withActivePatientHref(visible(m), patient)
  const active = nav.find((n) => n.path === path)
  return render(<Shell me={m} nav={nav} active={active} title={path ? pageTitle(path, active) : ''} onSwitchBranch={onSwitchBranch} onLogout={onLogout}><p>isi</p></Shell>)
}
const viewport = (w: number) => vi.stubGlobal('matchMedia', (q: string) => ({ media: q, matches: w <= 720, addEventListener() {}, removeEventListener() {} }))

afterEach(() => { act(() => setActivePatient(null)); vi.unstubAllGlobals(); location.hash = '' })

test('NAV: eight items; Rekam Medis leads to the patient list without a patient, to /rekam-medis/p1 with one; no Keluarga / Riwayat Medis', () => {
  expect(hrefs(null)).toEqual({ Beranda: '/', Jadwal: '/jadwal', Antrean: '/antrean', Pasien: '/pasien',
    'Rekam Medis': '/pasien', Resep: '/resep', Kasir: '/kasir', Laporan: '/laporan' })
  expect(hrefs({ id: 'p1' })['Rekam Medis']).toBe('/rekam-medis/p1')
  expect(NAV.map((n) => n.path)).not.toContain('/keluarga')
  expect(NAV.map((n) => n.path)).not.toContain('/riwayat-medis')
  // Kasir/Laporan need billing.read: a dentist does not see them.
  expect(visible(dentist).map((n) => n.label)).toEqual(['Beranda', 'Jadwal', 'Antrean', 'Pasien', 'Rekam Medis', 'Resep'])
})

test('clinicSubtitle: synthetic address for the two demo clinics, branch name otherwise', () => {
  expect(clinicSubtitle(me)).toBe('Jl. Tebet Raya No. 21, Jakarta Selatan')
  expect(clinicSubtitle({ ...me, active: { ...me.active, tenant_name: 'Klinik Gigi Ceria' } })).toBe('Jl. Ir. H. Djuanda, Dago, Bandung')
  expect(clinicSubtitle({ ...me, active: { ...me.active, tenant_name: 'Klinik Lain' } })).toBe('Cabang Tebet')
})

test('pageTitle: patient area reads Daftar Pasien, the form Pasien Baru, others the nav label', () => {
  const nav = withActivePatientHref(NAV, null)
  const at = (p: string) => nav.find((n) => n.path === p)
  expect(pageTitle('/', at('/'))).toBe('Beranda')
  expect(pageTitle('/pasien', at('/pasien'))).toBe('Daftar Pasien')
  expect(pageTitle('/pasien/p1', at('/pasien'))).toBe('Daftar Pasien')
  expect(pageTitle('/pasien/baru', at('/pasien'))).toBe('Pasien Baru')
  expect(pageTitle('/rekam-medis/p1', at('/rekam-medis'))).toBe('Rekam Medis')
  expect(pageTitle('/kasir', at('/kasir'))).toBe('Kasir')
})

test('1280px sidebar: Bittodent brand, clinic block, KLINIK / KLINIS / KEUANGAN groups, no branch picker, no bottom nav', () => {
  viewport(1280)
  act(() => setActivePatient({ id: 'p1', name: 'Sari Sintetis' }))
  shell(me, { id: 'p1' }, '/rekam-medis')
  expect(screen.queryByRole('navigation', { name: 'Navigasi utama' })).toBeNull()
  const side = document.querySelector('.shell-side') as HTMLElement
  expect(within(side).getByRole('link', { name: 'Bittodent' })).toHaveAttribute('href', '#/')
  expect(side).not.toHaveTextContent('EHR Gigi')
  expect(within(side).getByText('Klinik Gigi Senyum Sehat')).toBeInTheDocument()
  expect(within(side).getByText('Jl. Tebet Raya No. 21, Jakarta Selatan')).toBeInTheDocument()
  expect(within(side).getByText('DATA SINTETIS')).toBeInTheDocument()
  expect(side).not.toHaveTextContent('PROTOTIPE')
  expect(within(side).queryByRole('combobox')).toBeNull()
  expect(side).not.toHaveTextContent('Cabang aktif')
  const nav = screen.getByRole('navigation', { name: 'Modul utama' })
  expect([...nav.children].map((c) => c.textContent?.trim())).toEqual(
    ['KLINIK', 'Beranda', 'Jadwal', 'Antrean', 'Pasien', 'KLINIS', 'Rekam Medis', 'Resep', 'KEUANGAN', 'Kasir', 'Laporan'])
  expect(nav).not.toHaveTextContent('Pasien aktif')
  expect(within(nav).getByRole('link', { name: 'Rekam Medis' })).toHaveAttribute('href', '#/rekam-medis/p1')
  expect(within(nav).getByRole('link', { name: 'Rekam Medis' })).toHaveAttribute('aria-current', 'page')
})

test('1280px top bar: title, search, + menu, disabled bell, user menu with branch switcher + Keluar', () => {
  viewport(1280)
  const switchBranch = vi.fn(), logout = vi.fn()
  shell(me, null, '/pasien', switchBranch, logout)
  const top = document.querySelector('header.shell-top') as HTMLElement
  expect(top).toHaveTextContent('Daftar Pasien')
  expect(within(top).getByRole('searchbox', { name: 'Pencarian cepat pasien' })).toHaveAttribute('placeholder', 'Cari pasien atau No. RM…')
  expect(within(top).getByRole('button', { name: 'Notifikasi (segera hadir)' })).toBeDisabled()
  expect(within(top).queryByRole('button', { name: /Pasien aktif/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Keluar' })).toBeNull()

  fireEvent.click(within(top).getByRole('button', { name: 'Aksi cepat' }))
  expect(within(top).getByRole('link', { name: 'Daftarkan pasien' })).toHaveAttribute('href', '#/pasien/baru')
  expect(within(top).getByRole('link', { name: 'Buat janji' })).toHaveAttribute('href', '#/jadwal')

  const user = within(top).getByRole('button', { name: 'Akun drg. Uji Sintetis' })
  expect(user).toHaveTextContent('US')
  expect(user).toHaveTextContent('Pemilik')
  fireEvent.click(user)
  const branch = within(top).getByRole('combobox', { name: 'Cabang aktif' })
  fireEvent.change(branch, { target: { value: 'b2' } })
  expect(switchBranch).toHaveBeenCalledWith('b2')
  fireEvent.click(user)
  fireEvent.click(within(top).getByRole('button', { name: 'Keluar' }))
  expect(logout).toHaveBeenCalled()
})

test('1280px: one branch shows as text; no + button without create permissions; no search without patient.read', () => {
  viewport(1280)
  shell({ ...dentist, permissions: ['note.read'] })
  const top = document.querySelector('header.shell-top') as HTMLElement
  expect(within(top).queryByRole('button', { name: 'Aksi cepat' })).toBeNull()
  expect(within(top).queryByRole('search')).toBeNull()
  fireEvent.click(within(top).getByRole('button', { name: /^Akun/ }))
  expect(within(top).queryByRole('combobox')).toBeNull()
  expect(top).toHaveTextContent('Cabang Tebet')
})

test('390px: no sidebar; header has clinic + DATA SINTETIS; bottom nav 4 tabs + Lainnya with the rest, branch, Keluar', () => {
  viewport(390)
  const logout = vi.fn()
  shell(me, { id: 'p1' }, '/pasien', () => {}, logout)
  expect(screen.queryByRole('navigation', { name: 'Modul utama' })).toBeNull()
  const top = document.querySelector('header.shell-top') as HTMLElement
  expect(top).toHaveTextContent('Klinik Gigi Senyum Sehat')
  expect(within(top).getByText('DATA SINTETIS')).toBeInTheDocument()
  expect(within(top).queryByRole('search')).toBeNull()
  expect(within(top).getByRole('button', { name: 'Aksi cepat' })).toBeInTheDocument()

  const bottom = screen.getByRole('navigation', { name: 'Navigasi utama' })
  expect(within(bottom).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
    ['Beranda', '#/'], ['Jadwal', '#/jadwal'], ['Pasien', '#/pasien'], ['Rekam Medis', '#/rekam-medis/p1']])
  expect(within(bottom).getByRole('link', { name: 'Pasien' })).toHaveAttribute('aria-current', 'page')

  fireEvent.click(within(bottom).getByRole('button', { name: 'Lainnya' }))
  const sheet = screen.getByRole('dialog', { name: 'Menu lainnya' })
  expect(within(sheet).getAllByRole('link').map((a) => a.textContent?.trim())).toEqual(['Antrean', 'Resep', 'Kasir', 'Laporan'])
  expect(sheet).not.toHaveTextContent(/Keluarga|Riwayat Medis/)
  expect(within(sheet).getByRole('combobox', { name: 'Cabang aktif' })).toBeInTheDocument()
  fireEvent.click(within(sheet).getByRole('button', { name: 'Keluar' }))
  expect(logout).toHaveBeenCalled()
})

test('390px without an active patient: Rekam Medis tab leads to the patient list', () => {
  viewport(390)
  shell(dentist)
  expect(within(screen.getByRole('navigation', { name: 'Navigasi utama' })).getByRole('link', { name: 'Rekam Medis' })).toHaveAttribute('href', '#/pasien')
})

test('placeholder routes render "Segera hadir"', async () => {
  viewport(1280)
  document.cookie = 'XSRF-TOKEN=abc'
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url === '/api/me' ? me : {}), { status: url === '/api/me' ? 200 : 404 })))
  location.hash = '/kasir'
  render(<App />)
  expect(await screen.findByText('Segera hadir')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Kasir' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Kasir' })).toHaveAttribute('aria-current', 'page')
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

test('patient header menu without chart permission: Profil / Keluarga / Riwayat Medis only', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'p1', name: 'Sari Sintetis', dob: null, sex: null, payer_type: 'umum' }), { status: 200 })))
  render(<PatientPage id="p1" tab="keluarga" canChart={false}>{() => <p>isi</p>}</PatientPage>)
  fireEvent.click(await screen.findByRole('button', { name: 'Menu pasien' }))
  const links = screen.getAllByRole('link').filter((a) => a.closest('.menu-pop'))
  expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([['Profil', '#/pasien/p1'], ['Keluarga', '#/keluarga/p1'], ['Riwayat Medis', '#/riwayat-medis/p1']])
  expect(screen.getByRole('link', { name: 'Keluarga' })).toHaveAttribute('aria-current', 'page')
  expect(screen.queryByRole('navigation', { name: 'Data pasien' })).toBeNull()
})
