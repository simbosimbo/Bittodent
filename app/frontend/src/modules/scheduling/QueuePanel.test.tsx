import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../../shared/session'
import { QueuePanel } from './QueuePanel'

const me = (permissions: string[]): Me => ({
  user: { id: 'u1', name: 'Front Desk Uji', email: 'fd@uji.test' }, roles: ['front_desk'], permissions,
  active: { tenant_id: 't1', tenant_name: 'Klinik Uji', branch_id: 'b1', branch_name: 'Cabang Uji', timezone: 'Asia/Jakarta' },
  branches: [{ id: 'b1', name: 'Cabang Uji', timezone: 'Asia/Jakarta' }],
})
const appt = (id: string, status: string, patient: string, at: string, dentist = 'd1', extra = {}) => ({ id, chair_id: 'c1',
  starts_at: `2026-11-14T${at}:00+07:00`, ends_at: `2026-11-14T${at}:30+07:00`, status, reason: null, source: 'staff', booking_code: null,
  patient: { id: 'p-' + id, name: patient }, dentist: { id: dentist, name: dentist === 'd1' ? 'drg. Satu' : 'drg. Dua' }, ...extra })
const schedule = {
  branch: { id: 'b1', name: 'Cabang Uji', timezone: 'Asia/Jakarta' }, date: '2026-11-14',
  dentists: [{ id: 'd1', name: 'drg. Satu' }, { id: 'd2', name: 'drg. Dua' }],
  chairs: [{ id: 'c1', label: 'Kursi 1', appointments: [
    appt('a1', 'checked_in', 'Budi Contoh', '08:00'), appt('a2', 'in_treatment', 'Sari Sintetis', '08:30', 'd2'),
    appt('a3', 'done', 'Dina Utang', '07:00', 'd1', { visit_id: 'v3' }), appt('a4', 'done', 'Lunas Contoh', '07:30', 'd1', { visit_id: 'v4' }),
    appt('a5', 'booked', 'Putri Nanti', '17:30'), appt('a6', 'cancelled', 'Batal Contoh', '10:00'),
  ] }],
}
const mount = (perms: string[]) => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
    url.startsWith('/api/schedule') ? schedule : { statuses: { v3: 'terbuka', v4: 'lunas' } }), { status: 200 })))
  render(<QueuePanel me={me(perms)} />)
}
const group = async (label: string) => (await screen.findByRole('heading', { name: new RegExp('^' + label) })).closest('div') as HTMLElement

afterEach(() => vi.unstubAllGlobals())

test('groups today by visit step; cancelled never shows; links follow the chart rule', async () => {
  mount(['appointment.read', 'note.read', 'note.write'])
  expect(await screen.findByRole('heading', { name: 'Antrean hari ini' })).toBeInTheDocument()
  expect(within(await group('Menunggu')).getByRole('link', { name: /Budi Contoh/ })).toHaveAttribute('href', '#/rekam-medis/p-a1/janji/a1')
  expect(within(await group('Dirawat')).getByText('Sari Sintetis')).toBeInTheDocument()
  expect(within(await group('Belum datang')).getByText('17.30')).toBeInTheDocument()
  expect(screen.queryByText('Batal Contoh')).toBeNull()
  expect(screen.queryByRole('heading', { name: /^Siap bayar/ })).toBeNull() // no billing.read: no payment status
})

test('billing reader: only the unpaid finished visit is "Siap bayar", with Bayar to its invoice', async () => {
  mount(['appointment.read', 'billing.read', 'patient.read'])
  const pay = await group('Siap bayar')
  expect(within(pay).getByRole('link', { name: 'Bayar Dina Utang' })).toHaveAttribute('href', '#/tagihan/v3')
  expect(within(pay).queryByText('Lunas Contoh')).toBeNull()
  expect(within(await group('Menunggu')).getByRole('link', { name: /Budi Contoh/ })).toHaveAttribute('href', '#/pasien/p-a1')
})

test('dentist filter narrows every group', async () => {
  mount(['appointment.read'])
  const select = await screen.findByRole('combobox', { name: 'Saring dokter' })
  fireEvent.change(select, { target: { value: 'd2' } })
  expect(screen.queryByText('Budi Contoh')).toBeNull()
  expect(screen.getByText('Sari Sintetis')).toBeInTheDocument()
})
