import { render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../../shared/session'
import Home from './Home'

const me = (permissions: string[]): Me => ({
  user: { id: 'u1', name: 'drg. Uji Sintetis', email: 'dokter@uji.test' }, roles: ['dentist'], permissions,
  active: { tenant_id: 't1', tenant_name: 'Klinik Uji', branch_id: 'b1', branch_name: 'Cabang Uji', timezone: 'Asia/Jakarta' },
  branches: [{ id: 'b1', name: 'Cabang Uji', timezone: 'Asia/Jakarta' }],
})
const appt = (id: string, status: string, patient: string, at: string) => ({ id, chair_id: 'c1', starts_at: `2026-11-14T${at}:00+07:00`,
  ends_at: `2026-11-14T${at}:30+07:00`, status, reason: 'Kontrol', patient: { id: 'p-' + id, name: patient }, dentist: { id: 'd1', name: 'drg. Sintetis' } })
const schedule = {
  branch: { id: 'b1', name: 'Cabang Uji', timezone: 'Asia/Jakarta' }, date: '2026-11-14', dentists: [],
  chairs: [{ id: 'c1', label: 'Kursi 1', appointments: [
    appt('a1', 'booked', 'Sari Sintetis', '09:00'), appt('a2', 'checked_in', 'Budi Contoh', '08:00'),
    appt('a3', 'cancelled', 'Batal Contoh', '10:00'), appt('a4', 'no_show', 'Absen Contoh', '11:00'),
  ] }],
}
const home = (perms: string[]) => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(schedule), { status: 200 })))
  render(<Home me={me(perms)} />)
}
const region = (name: string) => screen.findByRole('region', { name })
const hrefs = (el: HTMLElement) => within(el).queryAllByRole('link', { name: /^Buka Rekam Medis/ }).map((a) => a.getAttribute('href'))

afterEach(() => vi.unstubAllGlobals())

test("today's list shows only active appointments; with note.write the chart opens with the visit", async () => {
  home(['note.read', 'note.write'])
  const today = await region('Janji hari ini')
  expect(within(today).queryByText('Batal Contoh')).toBeNull()
  expect(within(today).queryByText('Absen Contoh')).toBeNull()
  expect(hrefs(today)).toEqual(['#/rekam-medis/p-a2/janji/a2', '#/rekam-medis/p-a1/janji/a1'])
  expect(within(today).getByRole('link', { name: 'Buka Rekam Medis Sari Sintetis' })).toBeInTheDocument()
})

test('with only note.read the link points at the chart without a visit', async () => {
  home(['note.read'])
  expect(hrefs(await region('Janji hari ini'))).toEqual(['#/rekam-medis/p-a2', '#/rekam-medis/p-a1'])
})

test('queue items link to the chart with the same rule', async () => {
  home(['note.read', 'note.write'])
  const queue = await region('Antrean (sudah datang)')
  expect(hrefs(queue)).toEqual(['#/rekam-medis/p-a2/janji/a2'])
  expect(within(queue).getByText('Sudah datang')).toBeInTheDocument()
})

test('without note.read there are no chart links', async () => {
  home([])
  expect(hrefs(await region('Janji hari ini'))).toEqual([])
  expect(hrefs(await region('Antrean (sudah datang)'))).toEqual([])
})
