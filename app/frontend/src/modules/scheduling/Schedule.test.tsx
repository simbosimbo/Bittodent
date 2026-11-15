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

// ---- Mobile (≤720px): chair switcher, now-line ----
const viewport = (w: number) => vi.stubGlobal('matchMedia', (q: string) => ({ media: q, matches: w <= 720, addEventListener() {}, removeEventListener() {} }))
function mockChairs(date: () => string) {
  const at = (h: string) => `${date()}T${h}:00+07:00`
  const a = (id: string, chair: string, name: string, h: string) => ({ ...appt(id, 'booked', 'staff', name, '09:00'), chair_id: chair, starts_at: at(h), ends_at: at(h.slice(0, 3) + '30') })
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/api/schedule')) return json({
      ...sched([]), date: date(),
      chairs: [
        { id: 'c1', label: 'Kursi 1', appointments: [a('a1', 'c1', 'Ani Contoh', '09:00')] },
        { id: 'c2', label: 'Kursi 2', appointments: [a('a2', 'c2', 'Budi Contoh', '15:00'), a('a3', 'c2', 'Cici Contoh', '16:00')] },
        { id: 'c3', label: 'Kursi 3', appointments: [] },
      ],
    })
    if (url.startsWith('/api/planned-appointments')) return json({ data: [] })
    throw new Error('unexpected ' + url)
  }))
}
afterEach(() => vi.useRealTimers())

test('desktop: semua kursi tampil, tanpa pil kursi dan tanpa garis sekarang', async () => {
  viewport(1280)
  mockChairs(() => '2030-01-07')
  const { container } = render(<Schedule me={ME} />)
  await screen.findByText('Budi Contoh')
  expect(container.querySelectorAll('.sched-col')).toHaveLength(3)
  expect(screen.queryByRole('group', { name: 'Pilih kursi' })).toBeNull()
  expect(container.querySelector('.sched-now')).toBeNull()
  expect(container.querySelector('.sched-bar')).toBeNull()
  expect(screen.getByRole('button', { name: 'Hari sebelumnya' })).toHaveTextContent('‹')
})

test('HP: pil kursi + satu kolom; default kursi dengan janji berikutnya, pil mengganti kursi', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2030-01-07T05:00:00Z')) // 12:00 WIB: Ani (09:00) sudah lewat, berikutnya Budi di Kursi 2
  viewport(412)
  mockChairs(() => '2030-01-07')
  const { container } = render(<Schedule me={ME} />)
  const pills = await screen.findByRole('group', { name: 'Pilih kursi' })
  expect(within(pills).getAllByRole('button')).toHaveLength(3)
  expect(within(pills).getByRole('button', { name: /Kursi 2/ })).toHaveAttribute('aria-pressed', 'true')
  expect(container.querySelectorAll('.sched-col')).toHaveLength(1)
  expect(screen.getByText('Budi Contoh')).toBeInTheDocument()
  expect(screen.queryByText('Ani Contoh')).toBeNull()
  fireEvent.click(within(pills).getByRole('button', { name: /Kursi 1/ }))
  expect(screen.getByText('Ani Contoh')).toBeInTheDocument()
  expect(container.querySelectorAll('.sched-col')).toHaveLength(1)
  // Toolbar: Buat Janji on its own row
  expect(container.querySelector('.sched-bar .btn-primary')).toHaveTextContent('+ Buat Janji')
})

test('HP: garis sekarang hanya pada tanggal hari ini', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2030-01-07T03:30:00Z')) // 10:30 WIB
  viewport(412)
  let date = '2030-01-07'
  mockChairs(() => date)
  const { container } = render(<Schedule me={ME} />)
  expect(await screen.findByRole('img', { name: 'Sekarang 10:30' })).toBeInTheDocument()
  expect(container.querySelector('.sched-now-label')).toHaveTextContent('10:30')
  date = '2030-01-08'
  fireEvent.click(screen.getByRole('button', { name: 'Hari berikutnya' }))
  await vi.waitFor(() => expect(container.querySelector('.sched-now')).toBeNull())
  expect(container.querySelector('.sched-now-label')).toBeNull()
})

test('HP: hari kosong menampilkan pesan, grid tetap bisa diklik', async () => {
  viewport(412)
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/api/schedule')) return json(sched([]))
    if (url.startsWith('/api/planned-appointments')) return json({ data: [] })
    if (url.startsWith('/api/patients')) return json({ data: [] })
    throw new Error('unexpected ' + url)
  }))
  const { container } = render(<Schedule me={ME} />)
  expect(await screen.findByRole('status')).toHaveTextContent(/Tidak ada janji/)
  fireEvent.click(container.querySelector('.sched-slot.clickable') as HTMLElement)
  expect(await screen.findByRole('dialog', { name: 'Buat Janji' })).toBeInTheDocument()
})
