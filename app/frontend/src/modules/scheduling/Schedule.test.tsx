import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../../shared/session'
import Schedule from './Schedule'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const ME: Me = {
  user: { id: 'u1', name: 'Resepsionis Contoh', email: 'staf@contoh.test' }, roles: ['front_desk'],
  permissions: ['appointment.create', 'appointment.transition', 'appointment.confirm'],
  active: { tenant_id: 't1', tenant_name: 'Klinik Contoh', branch_id: 'b1', branch_name: 'Kemang', timezone: 'Asia/Jakarta' },
  branches: [{ id: 'b1', name: 'Kemang', timezone: 'Asia/Jakarta' }],
}
const appt = (id: string, status: string, source: 'online' | 'staff', name: string, start: string) => ({
  id, chair_id: 'c1', starts_at: `2030-01-07T${start}:00+07:00`, ends_at: `2030-01-07T${start.slice(0, 3)}30:00+07:00`, status, source,
  booking_code: null, reason: 'Konsultasi', patient: { id: 'p-' + id, name }, dentist: { id: 'd1', name: 'drg. Bunga Contoh' },
})
const sched = (appointments: unknown[]) => ({
  branch: { id: 'b1', name: 'Kemang', timezone: 'Asia/Jakarta' }, date: '2030-01-07',
  chairs: [{ id: 'c1', label: 'Kursi 1', appointments }], dentists: [{ id: 'd1', name: 'drg. Bunga Contoh' }],
})

function mockFetch(appointments: () => unknown[]) {
  const posts: { url: string; body: any }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/sanctum/csrf-cookie') { document.cookie = 'XSRF-TOKEN=abc'; return new Response(null, { status: 204 }) }
    if (url.startsWith('/api/schedule')) return json(sched(appointments()))
    if (url.startsWith('/api/planned-appointments')) return json({ data: [] })
    if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(init.body as string) }); return json({}) }
    throw new Error('unexpected ' + url)
  }))
  return posts
}
afterEach(() => vi.unstubAllGlobals())

test('janji online menunggu: kartu jadwal tanpa tombol, daftar "Perlu konfirmasi" memanggil transisi', async () => {
  let list = [appt('a1', 'pending_confirmation', 'online', 'Sinta Contoh', '09:00'), appt('a2', 'booked', 'staff', 'Budi Contoh', '10:00')]
  const posts = mockFetch(() => list)
  const { container } = render(<Schedule me={ME} />)

  const panel = (await screen.findByRole('heading', { name: /Perlu konfirmasi/ })).closest('.card') as HTMLElement
  expect(within(panel).getByText('Sinta Contoh')).toBeInTheDocument()
  expect(within(panel).queryByText('Budi Contoh')).toBeNull()
  expect(within(panel).getByText('Online')).toBeInTheDocument()

  // Grid card: time + badge + name, no action buttons
  const card = container.querySelector('.appt-pending_confirmation') as HTMLElement
  expect(within(card).getByText('Online')).toBeInTheDocument()
  expect(within(card).getByText('Sinta Contoh')).toBeInTheDocument()
  expect(within(card).queryByRole('button')).toBeNull()

  fireEvent.click(within(panel).getByRole('button', { name: /Konfirmasi/ }))
  await vi.waitFor(() => expect(posts).toEqual([{ url: '/api/appointments/a1/transition', body: { to: 'booked' } }]))

  list = [{ ...list[0], status: 'booked' }, list[1]]
  fireEvent.click(within(panel).getByRole('button', { name: /Tolak/ }))
  await vi.waitFor(() => expect(posts[1]).toEqual({ url: '/api/appointments/a1/transition', body: { to: 'rejected' } }))
  await vi.waitFor(() => expect(screen.queryByRole('heading', { name: /Perlu konfirmasi/ })).toBeNull())
})
