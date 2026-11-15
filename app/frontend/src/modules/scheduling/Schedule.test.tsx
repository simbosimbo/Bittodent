import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import baseCss from '../../shared/ui/styles.css?raw'
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
  // No full-width Buat Janji on a phone: the FAB replaces it
  expect(screen.queryByRole('button', { name: '+ Buat Janji' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Buat janji' })).toHaveClass('fab')
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
  fireEvent.click(screen.getByRole('button', { name: /^Selasa, 8 Januari 2030/ }))
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

// ---- Mobile action sheet ----
function mockOne(list: () => unknown[]) {
  const posts: { url: string; body: any }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/sanctum/csrf-cookie') { document.cookie = 'XSRF-TOKEN=abc'; return new Response(null, { status: 204 }) }
    if (url.startsWith('/api/schedule')) return json(sched(list()))
    if (url.startsWith('/api/planned-appointments')) return json({ data: [] })
    if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(init.body as string) }); return json({}) }
    throw new Error('unexpected ' + url)
  }))
  return posts
}
const ME_CHART: Me = { ...ME, permissions: [...ME.permissions, 'note.read', 'note.write'] }

test('desktop: kartu tetap punya tombol Check-in + Buka Rekam Medis inline, tanpa sheet', async () => {
  viewport(1280)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2030-01-07T01:00:00Z'))
  mockOne(() => [appt('a2', 'booked', 'staff', 'Budi Contoh', '10:00')])
  const { container } = render(<Schedule me={ME_CHART} />)
  await screen.findByText('Budi Contoh')
  const card = container.querySelector('div.appt-booked') as HTMLElement
  expect(within(card).getByRole('button', { name: 'Check-in' })).toHaveClass('btn', 'btn-xs')
  expect(within(card).getByRole('link', { name: 'Buka Rekam Medis' })).toHaveAttribute('href', '#/rekam-medis/p-a2/janji/a2')
  expect(container.querySelector('button.appt')).toBeNull()
})

test('HP: ketuk kartu membuka sheet aksi; aksi memanggil transisi yang sama; Escape/Tutup menutup dan fokus kembali', async () => {
  viewport(412)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2030-01-07T01:00:00Z')) // 08:00 WIB
  const posts = mockOne(() => [appt('a2', 'booked', 'staff', 'Budi Contoh', '10:00'), appt('a1', 'pending_confirmation', 'online', 'Sinta Contoh', '09:00')])
  render(<Schedule me={ME_CHART} />)
  const card = await screen.findByRole('button', { name: /Budi Contoh/ })
  expect(within(card).queryByRole('button')).toBeNull() // card itself is the only control
  expect(card).toHaveTextContent('Terjadwal')

  card.focus()
  fireEvent.click(card)
  const dialog = screen.getByRole('dialog', { name: 'Budi Contoh' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog.contains(document.activeElement)).toBe(true)
  expect(document.body.style.overflow).toBe('hidden')
  expect(within(dialog).getByRole('link', { name: 'Buka Rekam Medis' })).toHaveAttribute('href', '#/rekam-medis/p-a2/janji/a2')
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(card)
  expect(document.body.style.overflow).toBe('')

  fireEvent.click(card)
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Check-in' }))
  await vi.waitFor(() => expect(posts).toEqual([{ url: '/api/appointments/a2/transition', body: { to: 'checked_in' } }]))
  expect(screen.queryByRole('dialog')).toBeNull()

  // Online request: Konfirmasi / Tolak in the sheet, same transition as the "Perlu konfirmasi" list
  fireEvent.click(screen.getByRole('button', { name: /Menunggu konfirmasi.*Sinta Contoh/ }))
  const d2 = screen.getByRole('dialog', { name: 'Sinta Contoh' })
  expect(within(d2).queryByRole('link', { name: 'Buka Rekam Medis' })).toBeNull()
  fireEvent.click(within(d2).getByRole('button', { name: 'Konfirmasi' }))
  await vi.waitFor(() => expect(posts[1]).toEqual({ url: '/api/appointments/a1/transition', body: { to: 'booked' } }))

  fireEvent.click(card)
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tutup' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('HP: Tab tetap di dalam sheet; klik latar menutup', async () => {
  viewport(412)
  mockOne(() => [appt('a2', 'booked', 'staff', 'Budi Contoh', '10:00')])
  const { container } = render(<Schedule me={ME_CHART} />)
  fireEvent.click(await screen.findByRole('button', { name: /Budi Contoh/ }))
  const dialog = screen.getByRole('dialog')
  const controls = [...dialog.querySelectorAll<HTMLElement>('a[href], button')]
  expect(controls.length).toBeGreaterThan(1)
  controls[controls.length - 1].focus()
  fireEvent.keyDown(document, { key: 'Tab' })
  expect(document.activeElement).toBe(controls[0])
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
  expect(document.activeElement).toBe(controls[controls.length - 1])
  fireEvent.click(container.ownerDocument.querySelector('.sheet-backdrop') as HTMLElement)
  expect(screen.queryByRole('dialog')).toBeNull()
})

// ---- Stage 5: Buat Janji as a modal bottom sheet on a phone ----
test.each([[412, true], [1280, false]])('%ipx: Buat Janji Escape/scroll-lock only on a phone', async (w, modal) => {
  viewport(w)
  mockOne(() => [])
  render(<Schedule me={ME_CHART} />)
  fireEvent.click(await screen.findByRole('button', { name: modal ? 'Buat janji' : '+ Buat Janji' }))
  const dialog = screen.getByRole('dialog', { name: 'Buat Janji' })
  expect(dialog.contains(document.activeElement)).toBe(modal)
  expect(document.body.style.overflow).toBe(modal ? 'hidden' : '')
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(!screen.queryByRole('dialog')).toBe(modal)
})

test.each([[390, '44px', '16px'], [1280, '40px', '']])('%ipx: form fields min-height %s (styles.css)', (w, minH, font) => {
  const style = document.head.appendChild(document.createElement('style'))
  style.textContent = baseCss.replace(/@media[^{]+/g, (m) => m.replace(/(\d+)px/g, (_, n) => `${Number(n) - (w - 1024)}px`))
  try {
    const { container } = render(<form><select aria-label="x"><option>a</option></select><input aria-label="y" /><label className="check"><input type="checkbox" /> z</label></form>)
    for (const el of container.querySelectorAll<HTMLElement>('select, input:not([type=checkbox])')) {
      expect(getComputedStyle(el).minHeight).toBe(minH)
      if (font) expect(getComputedStyle(el).fontSize).toBe(font)
    }
    expect(getComputedStyle(container.querySelector('input[type=checkbox]')!).minHeight).not.toBe('44px')
    expect(getComputedStyle(container.querySelector('label.check')!).minHeight).toBe(w <= 720 ? '44px' : 'auto')
  } finally { style.remove() }
})

// ---- Jadwal mobile rebuild: week strip, toolbar, FAB ----
/** /api/schedule per requested date: `perDay[date]` appointments in Kursi 1 (09:00, 10:00, …), Kursi 2 empty. */
function mockWeek(perDay: Record<string, number>, opts: { failWeek?: () => boolean } = {}) {
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/api/schedule')) {
      const d = new URL(url, 'http://x').searchParams.get('date')!
      calls.push(d)
      if (opts.failWeek?.() && calls.length > 1) return json({ message: 'x' }, 500)
      const list = Array.from({ length: perDay[d] ?? 0 }, (_, i) => {
        const h = String(9 + i).padStart(2, '0')
        return { ...appt('w' + d + i, 'booked', 'staff', `Pasien ${d} ${i}`, '09:00'), starts_at: `${d}T${h}:00:00+07:00`, ends_at: `${d}T${h}:30:00+07:00` }
      })
      return json({ ...sched([]), date: d, chairs: [{ id: 'c1', label: 'Kursi 1', appointments: list }, { id: 'c2', label: 'Kursi 2', appointments: [] }] })
    }
    if (url.startsWith('/api/planned-appointments')) return json({ data: [] })
    if (url.startsWith('/api/patients')) return json({ data: [] })
    throw new Error('unexpected ' + url)
  }))
  return calls
}
const today9 = () => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2030-01-09T01:00:00Z')) } // Rabu 9 Jan 2030, 08:00 WIB

test('HP: week strip Sen–Min dengan titik jumlah janji; ketuk hari memilih tanggal', async () => {
  today9()
  viewport(412)
  const calls = mockWeek({ '2030-01-07': 1, '2030-01-09': 2, '2030-01-12': 5 })
  render(<Schedule me={ME} />)
  const strip = await screen.findByRole('group', { name: 'Pilih hari' })
  await vi.waitFor(() => expect(strip).toHaveAttribute('aria-busy', 'false'))
  const days = within(strip).getAllByRole('button')
  expect(days.map((b) => b.querySelector('.week-wd')!.textContent)).toEqual(['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'])
  expect(days.map((b) => b.querySelectorAll('.week-dots i').length)).toEqual([1, 0, 2, 0, 0, 3, 0]) // max 3 dots
  expect(days[2]).toHaveAttribute('aria-pressed', 'true')
  expect(days[2]).toHaveAttribute('aria-current', 'date')
  expect(days[5]).toHaveAccessibleName('Sabtu, 12 Januari 2030, 5 janji')
  expect(new Set(calls)).toEqual(new Set(['2030-01-07', '2030-01-08', '2030-01-09', '2030-01-10', '2030-01-11', '2030-01-12', '2030-01-13']))

  fireEvent.click(days[5])
  expect(days[5]).toHaveAttribute('aria-pressed', 'true')
  expect(await screen.findByText('5 janji')).toBeInTheDocument()
  // Week arrows move 7 days and load the next week's dots
  fireEvent.click(screen.getByRole('button', { name: 'Minggu berikutnya' }))
  expect(await screen.findByRole('button', { name: /^Sabtu, 19 Januari 2030/ })).toHaveAttribute('aria-pressed', 'true')
  await vi.waitFor(() => expect(calls).toContain('2030-01-14'))
})

test('HP: "Hari ini" hanya muncul bila tanggal terpilih bukan hari ini', async () => {
  today9()
  viewport(412)
  mockWeek({})
  render(<Schedule me={ME} />)
  const strip = await screen.findByRole('group', { name: 'Pilih hari' })
  expect(screen.queryByRole('button', { name: 'Hari ini' })).toBeNull()
  fireEvent.click(within(strip).getByRole('button', { name: /^Kamis, 10 Januari 2030/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Hari ini' }))
  expect(within(strip).getByRole('button', { name: /^Rabu, 9 Januari 2030/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('button', { name: 'Hari ini' })).toBeNull()
})

test('HP: titik minggu gagal dimuat -> pesan + Coba lagi', async () => {
  today9()
  viewport(412)
  let fail = true
  mockWeek({ '2030-01-08': 1 }, { failWeek: () => fail })
  render(<Schedule me={ME} />)
  const alert = await screen.findByText(/Jumlah janji per hari gagal dimuat/)
  fail = false
  fireEvent.click(within(alert).getByRole('button', { name: 'Coba lagi' }))
  await vi.waitFor(() => expect(screen.getByRole('button', { name: /^Selasa, 8 Januari 2030, 1 janji/ })).toBeInTheDocument())
  expect(screen.queryByText(/gagal dimuat/)).toBeNull()
})

test('HP: FAB "Buat janji" membuka dialog Buat Janji', async () => {
  today9()
  viewport(360)
  mockWeek({})
  render(<Schedule me={ME} />)
  const fab = await screen.findByRole('button', { name: 'Buat janji' })
  expect(fab).toHaveClass('fab')
  fireEvent.click(fab)
  expect(await screen.findByRole('dialog', { name: 'Buat Janji' })).toBeInTheDocument()
})

test('desktop: tanpa week strip, FAB, atau toolbar HP', async () => {
  viewport(1280)
  const calls = mockWeek({})
  const { container } = render(<Schedule me={ME} />)
  await screen.findByRole('button', { name: '+ Buat Janji' })
  expect(container.querySelector('.sched-top, .week-strip, .fab')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Jadwal' })).toHaveClass('shell-dup-title')
  expect(calls).toHaveLength(1) // no week fetch on desktop
})
