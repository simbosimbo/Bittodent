import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { NAV } from './App'
import { setActivePatient } from './shared/activePatient'
import { Shell, withActivePatientHref } from './shared/layout/Shell'
import type { Me } from './shared/session'

const me: Me = {
  user: { id: 'u1', name: 'drg. Uji Sintetis', email: 'dokter@uji.test' }, roles: ['dentist'],
  permissions: ['patient.read', 'note.read', 'appointment.read'],
  active: { tenant_id: 't1', tenant_name: 'Klinik Uji', branch_id: 'b1', branch_name: 'Cabang Uji', timezone: 'Asia/Jakarta' },
  branches: [{ id: 'b1', name: 'Cabang Uji', timezone: 'Asia/Jakarta' }],
}
const hrefs = (patient: { id: string } | null) =>
  Object.fromEntries(withActivePatientHref(NAV, patient).map((n) => [n.label, n.href ?? n.path]))
const shell = (patient: { id: string } | null) =>
  render(<Shell me={me} nav={withActivePatientHref(NAV, patient)} active={undefined} onSwitchBranch={() => {}} onLogout={() => {}}><p>isi</p></Shell>)
const link = (label: string) => screen.getAllByRole('link').find((a) => a.getAttribute('title') === label)

afterEach(() => act(() => setActivePatient(null)))

test('without an active patient the Pasien aktif items lead to the patient list', () => {
  expect(hrefs(null)).toEqual({ Beranda: '/', Pasien: '/pasien', Jadwal: '/jadwal', 'Rekam Medis': '/pasien', Keluarga: '/pasien', 'Riwayat Medis': '/pasien' })
})

test('with active patient p1 the Pasien aktif items point at that patient; Klinik items unchanged', () => {
  expect(hrefs({ id: 'p1' })).toEqual({ Beranda: '/', Pasien: '/pasien', Jadwal: '/jadwal',
    'Rekam Medis': '/rekam-medis/p1', Keluarga: '/keluarga/p1', 'Riwayat Medis': '/riwayat-medis/p1' })
})

test('Shell renders the hash hrefs, with and without an active patient', () => {
  const { unmount } = shell(null)
  for (const l of ['Rekam Medis', 'Keluarga', 'Riwayat Medis', 'Pasien']) expect(link(l)).toHaveAttribute('href', '#/pasien')
  unmount()
  act(() => setActivePatient({ id: 'p1', name: 'Sari Sintetis' }))
  shell({ id: 'p1' })
  expect(link('Rekam Medis')).toHaveAttribute('href', '#/rekam-medis/p1')
  expect(link('Keluarga')).toHaveAttribute('href', '#/keluarga/p1')
  expect(link('Riwayat Medis')).toHaveAttribute('href', '#/riwayat-medis/p1')
  expect(link('Beranda')).toHaveAttribute('href', '#/')
  expect(link('Pasien')).toHaveAttribute('href', '#/pasien')
  expect(link('Jadwal')).toHaveAttribute('href', '#/jadwal')
})
