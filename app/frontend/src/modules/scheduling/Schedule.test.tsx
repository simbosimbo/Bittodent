import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import stylesCss from '../../shared/ui/styles.css?raw'
import legacyBaseCss from '../../shared/ui/legacy-base.css?raw'
const baseCss = legacyBaseCss + stylesCss
import type { Me } from '../../shared/session'
import Schedule, { usePendingConfirm } from './Schedule'

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
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear() })
const openWeek = async () => {
  const b = await screen.findByRole('button', { name: 'Pilih hari minggu ini' })
  if (b.getAttribute('aria-expanded') !== 'true') fireEvent.click(b)
}

test('janji online menunggu: kartu jadwal tanpa tombol, daftar "Perlu konfirmasi" memanggil transisi', async () => {
  let list = [appt('a1', 'pending_confirmation', 'online', 'Sinta Contoh', '09:00'), appt('a2', 'booked', 'staff', 'Budi Contoh', '10:00')]
  const posts = mockFetch(() => list)
  const { container } = render(<Schedule me={ME} />)

  const panel = (await screen.findByRole('heading', { name: /Perlu konfirmasi/ })).closest('.confirm-card') as HTMLElement
  expect(within(panel).getByText('Sinta Contoh')).toBeInTheDocument()
  expect(within(panel).queryByText('Budi Contoh')).toBeNull()
  expect(within(panel).getByText('Online')).toBeInTheDocument()

  // Grid card: time + badge + name, no action buttons
  const block = container.querySelector('.appt-pending_confirmation') as HTMLElement
  expect(within(block).getByText('Online')).toBeInTheDocument()
  expect(within(block).getByText('Sinta Contoh')).toBeInTheDocument()
  expect(within(block).queryByRole('button')).toBeNull()

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
  // Jadwal is per dentist (DEVIATIONS #68): Kursi n is used by drg. n here, so the dentist columns line up with the chairs.
  const doc = (c: string) => ({ c1: { id: 'd1', name: 'drg. Satu' }, c2: { id: 'd2', name: 'drg. Dua' }, c3: { id: 'd3', name: 'drg. Tiga' } })[c]!
  const a = (id: string, chair: string, name: string, h: string) => ({ ...appt(id, 'booked', 'staff', name, '09:00'), chair_id: chair, dentist: doc(chair), starts_at: at(h), ends_at: at(h.slice(0, 3) + '30') })
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/api/schedule')) return json({
      ...sched([]), date: date(), dentists: [doc('c1'), doc('c2'), doc('c3')],
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

test('desktop: satu kolom per dokter (judul = nama dokter), kursi sebagai label kartu, tanpa garis sekarang; chip dokter (#70) menyaring ke satu kolom', async () => {
  viewport(1280)
  mockChairs(() => '2030-01-07')
  const { container } = render(<Schedule me={ME} />)
  await screen.findByText('Budi Contoh')
  expect(container.querySelectorAll('.sched-col')).toHaveLength(2) // review-2: "Semua" hides the empty column (drg. Tiga · 0)
  expect([...container.querySelectorAll('.sched-head')].map((h) => h.textContent)).toEqual(['', 'drg. Satu · 1', 'drg. Dua · 2'])
  expect(screen.getByText('Budi Contoh').closest('.appt')!.querySelector('.appt-chair')).toHaveTextContent('Kursi 2')
  expect(container.querySelector('.sched-now')).toBeNull()
  expect(container.querySelector('.sched-bar')).toBeNull()
  expect(screen.getByRole('button', { name: 'Hari sebelumnya' })).toHaveTextContent('‹')
  const pills = within(screen.getByRole('group', { name: 'Pilih dokter' }))
  expect(pills.getByRole('button', { name: /^Semua/ })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(pills.getByRole('button', { name: /^drg\. Dua/ }))
  expect([...container.querySelectorAll('.sched-head')].map((h) => h.textContent)).toEqual(['', 'drg. Dua · 2'])
  expect(sessionStorage.getItem('jadwal-dokter:b1')).toBeTruthy() // remembered per branch for this tab
  fireEvent.click(pills.getByRole('button', { name: /^drg\. Tiga/ }))
  expect([...container.querySelectorAll('.sched-head')].map((h) => h.textContent)).toEqual(['', 'drg. Tiga · 0']) // picked: shown even when empty
  expect(pills.getByRole('button', { name: /^drg\. Tiga/ })).toHaveTextContent(/^Tiga · 0$/) // short visible label, full name in aria-label
  fireEvent.click(pills.getByRole('button', { name: /^Semua/ }))
  expect(container.querySelectorAll('.sched-col')).toHaveLength(2)
})

test('HP Grid: pil dokter + satu kolom; default dokter dengan janji berikutnya, pil mengganti dokter', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2030-01-07T05:00:00Z')) // 12:00 WIB: Ani (09:00) sudah lewat, berikutnya Budi di Kursi 2
  viewport(412)
  mockChairs(() => '2030-01-07')
  const { container } = render(<Schedule me={ME} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Tampilan grid' }))
  const pills = await screen.findByRole('group', { name: 'Pilih dokter' })
  expect(within(pills).getAllByRole('button')).toHaveLength(3) // no "Semua" in the one-column grid
  expect(within(pills).getByRole('button', { name: /drg\. Dua/ })).toHaveAttribute('aria-pressed', 'true')
  expect(container.querySelectorAll('.sched-col')).toHaveLength(1)
  expect(screen.getByText('Budi Contoh')).toBeInTheDocument()
  expect(screen.queryByText('Ani Contoh')).toBeNull()
  fireEvent.click(within(pills).getByRole('button', { name: /drg\. Satu/ }))
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
  fireEvent.click(await screen.findByRole('button', { name: 'Tampilan grid' }))
  expect(await screen.findByRole('img', { name: 'Sekarang 10:30' })).toBeInTheDocument()
  expect(container.querySelector('.sched-now-label')).toHaveTextContent('10:30')
  date = '2030-01-08'
  await openWeek() // review-2: the week strip is folded behind the calendar button
  fireEvent.click(screen.getByRole('button', { name: /^Selasa, 8 Januari 2030/ }))
  await vi.waitFor(() => expect(container.querySelector('.sched-now')).toBeNull())
  expect(container.querySelector('.sched-now-label')).toBeNull()
})

test('HP Grid: hari kosong menampilkan pesan, grid tetap bisa diklik', async () => {
  viewport(412)
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/api/schedule')) return json(sched([]))
    if (url.startsWith('/api/planned-appointments')) return json({ data: [] })
    if (url.startsWith('/api/patients')) return json({ data: [] })
    throw new Error('unexpected ' + url)
  }))
  const { container } = render(<Schedule me={ME} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Tampilan grid' }))
  expect((await screen.findByText('Belum ada janji.')).closest('[role=status]')).not.toBeNull()
  fireEvent.click(container.querySelector('.sched-slot.clickable') as HTMLElement)
  expect(await screen.findByRole('dialog', { name: 'Buat Janji' })).toBeInTheDocument()
})

test('"Buat janji" from the RM (?baru=<patient>) opens the booking form with that patient already chosen', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/api/schedule')) return json(sched([]))
    if (url.startsWith('/api/planned-appointments')) return json({ data: [] })
    if (url === '/api/patients/p9') return json({ id: 'p9', name: 'Bayu Contoh' })
    throw new Error('unexpected ' + url)
  }))
  render(<Schedule me={ME} newFor="p9" />)
  const dlg = await screen.findByRole('dialog', { name: 'Buat Janji' })
  expect(await within(dlg).findByText('Bayu Contoh')).toBeInTheDocument()
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

test('HP Check-in (papan 08): kartu -> sheet -> Check-in; kartu Memproses (tak bisa diketuk ulang) -> ke Menunggu dengan Hadir -> toast "{nama} hadir" + Batalkan memanggil undo-checkin', async () => {
  viewport(360)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2030-01-07T03:00:00Z')) // 10:00 WIB
  let status = 'booked'
  let release = () => {}
  const posts: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/sanctum/csrf-cookie') { document.cookie = 'XSRF-TOKEN=abc'; return new Response(null, { status: 204 }) }
    if (url.startsWith('/api/schedule')) return json(sched([appt('a2', status, 'staff', 'Budi Contoh', '10:00')]))
    if (url.startsWith('/api/planned-appointments')) return json({ data: [] })
    if (init?.method === 'POST') {
      posts.push(url)
      if (url.endsWith('/transition')) { await new Promise<void>((r) => { release = r }); status = 'checked_in' }
      if (url.endsWith('/undo-checkin')) status = 'booked'
      return json({})
    }
    throw new Error('unexpected ' + url)
  }))
  const { container } = render(<Schedule me={ME} />)
  fireEvent.click(await screen.findByRole('button', { name: /^10\.00.*Budi Contoh/ }))
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Budi Contoh' })).getByRole('button', { name: 'Check-in' }))
  const busy = await screen.findByRole('button', { name: 'Memproses Budi Contoh' })
  expect(busy).toHaveAttribute('aria-busy', 'true')
  expect(busy).toBeDisabled()
  expect(busy).toHaveTextContent('Memproses')
  fireEvent.click(busy)
  release()
  await vi.waitFor(() => expect(screen.getByText(/Budi Contoh hadir/)).toBeInTheDocument())
  expect(posts).toEqual(['/api/appointments/a2/transition']) // one tap, one request
  await vi.waitFor(() => expect([...container.querySelectorAll('.agenda-sec h2')].map((h) => h.textContent)).toContain('Menunggu · 1'))
  expect(container.querySelector('.agenda-item.appt-checked_in [data-status="checked_in"]')).toHaveTextContent('Hadir')
  expect(screen.getByText(/Budi Contoh hadir/).closest('.sched-toast')).toHaveAttribute('role', 'status')
  fireEvent.click(screen.getByRole('button', { name: 'Batalkan' }))
  await vi.waitFor(() => expect(posts).toEqual(['/api/appointments/a2/transition', '/api/appointments/a2/undo-checkin']))
  expect(await screen.findByRole('button', { name: /^10\.00.*Budi Contoh, Terjadwal/ })).toBeEnabled()
})

test('desktop: kartu tetap punya tombol Check-in + Buka Rekam Medis inline, tanpa sheet', async () => {
  viewport(1280)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2030-01-07T01:00:00Z'))
  mockOne(() => [appt('a2', 'booked', 'staff', 'Budi Contoh', '10:00')])
  const { container } = render(<Schedule me={ME_CHART} />)
  await screen.findByText('Budi Contoh')
  const block = container.querySelector('div.appt-booked') as HTMLElement
  expect(within(block).getByRole('button', { name: 'Check-in' })).toHaveClass('button--sm') // HeroUI small size: fits the 30-minute block
  expect(within(block).getByRole('link', { name: 'Buka Rekam Medis' })).toHaveAttribute('href', '#/rekam-medis/p-a2/janji/a2')
  expect(container.querySelector('button.appt')).toBeNull()
})

test('desktop (#69): a finished visit card links to its Tagihan for billing readers only', async () => {
  viewport(1280)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2030-01-07T01:00:00Z'))
  mockOne(() => [{ ...appt('a3', 'done', 'staff', 'Sari Contoh', '09:00'), visit_id: 'v3' }])
  const { container, unmount } = render(<Schedule me={{ ...ME_CHART, permissions: [...ME_CHART.permissions, 'billing.read'] }} />)
  await screen.findByText('Sari Contoh')
  expect(within(container.querySelector('div.appt-done') as HTMLElement).getByRole('link', { name: 'Tagihan' })).toHaveAttribute('href', '#/tagihan/v3')
  unmount()
  const r = render(<Schedule me={ME_CHART} />)
  await screen.findByText('Sari Contoh')
  expect(within(r.container.querySelector('div.appt-done') as HTMLElement).queryByRole('link', { name: 'Tagihan' })).toBeNull()
})

test('HP: ketuk kartu membuka sheet aksi; aksi memanggil transisi yang sama; Escape/Tutup menutup dan fokus kembali', async () => {
  viewport(412)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2030-01-07T01:00:00Z')) // 08:00 WIB
  const posts = mockOne(() => [appt('a2', 'booked', 'staff', 'Budi Contoh', '10:00'), appt('a1', 'pending_confirmation', 'online', 'Sinta Contoh', '09:00')])
  render(<Schedule me={ME_CHART} />)
  const card = await screen.findByRole('button', { name: /^10\.00.*Budi Contoh/ })
  // Gaya ringkas HP: the card has no buttons; name + status dot, then "10.00 › 10.30" + meta
  expect(card.closest('li')!.querySelectorAll('button, a')).toHaveLength(1)
  expect(within(card).getByText('Terjadwal').closest('[data-status]')).toHaveAttribute('data-status', 'booked')
  expect(card).toHaveTextContent('10.00 › 10.30 · Konsultasi')

  card.focus()
  fireEvent.click(card)
  const dialog = screen.getByRole('dialog', { name: 'Budi Contoh' })
  await vi.waitFor(() => expect(screen.queryByRole('button', { name: /^10\.00.*Budi Contoh/ })).toBeNull()) // modal (HeroUI Sheet): React Aria hides the board behind from assistive tech
  await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true)) // React Aria moves focus in after mount
  expect(document.documentElement.style.overflow).toBe('hidden') // React Aria locks scroll on <html>
  expect(within(dialog).getByRole('link', { name: 'Buka RM' })).toHaveAttribute('href', '#/rekam-medis/p-a2/janji/a2')
  expect(within(dialog).getByRole('button', { name: 'Check-in' })).toHaveClass('button--primary') // the one full-width main action
  expect(dialog).toHaveTextContent('Keluhan / tindakanKonsultasi')
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
  await vi.waitFor(() => expect(document.activeElement).toBe(card)) // focus back to the card (React Aria restores it a frame later)
  expect(document.documentElement.style.overflow).toBe('')

  fireEvent.click(card)
  const keluhan = within(screen.getByRole('dialog')).getByLabelText('Keluhan')
  expect(keluhan).toHaveValue('Konsultasi') // starts as the appointment's Keperluan: the desk only edits (audit P1-1)
  fireEvent.change(keluhan, { target: { value: 'Gigi berlubang, ngilu' } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Check-in' }))
  await vi.waitFor(() => expect(posts).toEqual([{ url: '/api/appointments/a2/transition', body: { to: 'checked_in', complaint: 'Gigi berlubang, ngilu' } }]))
  expect(screen.queryByRole('dialog')).toBeNull()

  // Online request: Konfirmasi / Tolak in the sheet, same transition as the "Perlu konfirmasi" list
  fireEvent.click(screen.getByRole('button', { name: /Sinta Contoh.*Perlu konfirmasi/ }))
  const d2 = screen.getByRole('dialog', { name: 'Sinta Contoh' })
  expect(within(d2).queryByRole('link', { name: 'Buka RM' })).toBeNull()
  fireEvent.click(within(d2).getByRole('button', { name: 'Konfirmasi' }))
  await vi.waitFor(() => expect(posts[1]).toEqual({ url: '/api/appointments/a1/transition', body: { to: 'booked' } }))

  fireEvent.click(await screen.findByRole('button', { name: /^10\.00.*Budi Contoh/ }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tutup' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('HP: Tab tetap di dalam sheet; klik latar menutup', async () => {
  viewport(412)
  mockOne(() => [appt('a2', 'booked', 'staff', 'Budi Contoh', '10:00')])
  const { container } = render(<Schedule me={ME_CHART} />)
  fireEvent.click(await screen.findByRole('button', { name: /^10\.00.*Budi Contoh/ }))
  const dialog = screen.getByRole('dialog')
  const controls = [...dialog.querySelectorAll<HTMLElement>('a[href], button')]
  expect(controls.length).toBeGreaterThan(1)
  controls[controls.length - 1].focus()
  fireEvent.keyDown(document, { key: 'Tab' })
  expect(document.activeElement).toBe(controls[0])
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
  expect(document.activeElement).toBe(controls[controls.length - 1])
  const backdrop = container.ownerDocument.querySelector('.sheet__backdrop') as HTMLElement // HeroUI Sheet backdrop
  fireEvent.pointerDown(backdrop) // outside press = pointerdown + click (React Aria)
  fireEvent.click(backdrop)
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

test.each([[390, '44px', '16px'], [1280, '40px', '']])('%ipx: form fields min-height %s (legacy-base.css + styles.css)', (w, minH, font) => {
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

test('HP (review-2): week strip terlipat; ‹ › geser 1 hari; tombol kalender membuka strip dan panah jadi per minggu', async () => {
  today9()
  viewport(360)
  mockWeek({ '2030-01-10': 1 })
  render(<Schedule me={ME} />)
  const toggle = await screen.findByRole('button', { name: 'Pilih hari minggu ini' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('group', { name: 'Pilih hari' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Tanggal berikutnya' }))
  expect(await screen.findByText('1 janji')).toBeInTheDocument()
  expect(screen.getByLabelText('Tanggal')).toHaveValue('2030-01-10')
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(await screen.findByRole('group', { name: 'Pilih hari' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Minggu berikutnya' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Tanggal berikutnya' })).toBeNull()
})

test('HP: week strip Sen–Min dengan titik jumlah janji; ketuk hari memilih tanggal', async () => {
  today9()
  viewport(412)
  const calls = mockWeek({ '2030-01-07': 1, '2030-01-09': 2, '2030-01-12': 5 })
  render(<Schedule me={ME} />)
  await openWeek() // review-2: the week strip is folded behind the calendar button
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
  await openWeek() // review-2: the week strip is folded behind the calendar button
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
  await openWeek() // review-2: the week strip is folded behind the calendar button
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

// ---- Agenda (default on a phone), toggle, chips, empty gaps ----
function mockAgenda(list: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/api/schedule')) return json({
      ...sched([]), date: new URL(url, 'http://x').searchParams.get('date'),
      chairs: [
        { id: 'c1', label: 'Kursi 1', appointments: (list as any[]).filter((a) => a.chair_id === 'c1') },
        { id: 'c2', label: 'Kursi 2', appointments: (list as any[]).filter((a) => a.chair_id === 'c2') },
      ],
    })
    if (url.startsWith('/api/planned-appointments')) return json({ data: [] })
    if (url.startsWith('/api/patients')) return json({ data: [] })
    throw new Error('unexpected ' + url)
  }))
}
const at9 = (id: string, chair: string, name: string, from: string, to: string, status = 'booked') =>
  ({ ...appt(id, status, 'staff', name, '09:00'), chair_id: chair, starts_at: `2030-01-09T${from}:00+07:00`, ends_at: `2030-01-09T${to}:00+07:00` })

test('HP: memuat hari lain menampilkan status memuat, bukan agenda hari sebelumnya', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2030-01-09T01:00:00Z'))
  viewport(412)
  let release = () => {}
  mockAgenda([at9('b', 'c1', 'Budi Contoh', '10:00', '10:30')])
  const base = globalThis.fetch as any
  render(<Schedule me={ME} />)
  await screen.findByText('Budi Contoh')
  vi.stubGlobal('fetch', vi.fn((url: string) => url.includes('date=2030-01-10') ? new Promise((r) => { release = () => r(base(url)) }) : base(url)))
  await openWeek() // review-2: the week strip is folded behind the calendar button
  fireEvent.click(screen.getByRole('button', { name: /^Kamis, 10 Januari 2030/ }))
  expect(await screen.findByText('Memuat jadwal…')).toBeInTheDocument()
  expect(screen.queryByText('Budi Contoh')).toBeNull()
  release()
  expect(await screen.findByText('Budi Contoh')).toBeInTheDocument()
})

// ---- Role modes (Meja depan | Dokter), sections, one primary per card ----
const PERMS = {
  owner: ['patient.read', 'patient.create', 'appointment.read', 'appointment.create', 'appointment.transition', 'appointment.confirm', 'note.read', 'billing.read', 'billing.adjust'],
  dentist: ['patient.read', 'patient.create', 'appointment.read', 'appointment.create', 'appointment.transition', 'appointment.confirm', 'note.read', 'note.write', 'note.sign'],
  front_desk: ['patient.read', 'patient.create', 'appointment.read', 'appointment.create', 'appointment.transition', 'appointment.confirm', 'billing.read', 'billing.adjust', 'appointment.refer'],
  kasir: ['patient.read', 'patient.create', 'appointment.read', 'appointment.create', 'appointment.transition', 'appointment.confirm', 'billing.read', 'billing.adjust', 'appointment.refer'], // #67, #68
}
const who = (roles: (keyof typeof PERMS)[], id = 'd1'): Me => ({
  ...ME, user: { id, name: 'Staf Contoh', email: `${id}@contoh.test` }, roles, permissions: [...new Set(roles.flatMap((r) => PERMS[r]))],
})
const DAY = '2030-01-09'
const LAIN = { id: 'd2', name: 'drg. Lain Contoh' }
const ap = (id: string, status: string, from: string, o: Record<string, unknown> = {}) => ({
  ...appt(id, status, 'staff', `Pasien ${id}`, '09:00'), starts_at: `${DAY}T${from}:00+07:00`, ends_at: `${DAY}T${from.slice(0, 3)}30:00+07:00`, ...o,
})
/** /api/schedule (list per date), invoices by visit id, daily revenue; records POSTs. */
function mockApi(list: (date: string) => any[], o: { invoices?: Record<string, string>; failSchedule?: () => boolean } = {}) {
  const posts: { url: string; body: any }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/sanctum/csrf-cookie') { document.cookie = 'XSRF-TOKEN=abc'; return new Response(null, { status: 204 }) }
    if (url.startsWith('/api/schedule')) {
      if (o.failSchedule?.()) return json({ message: 'x' }, 500)
      const d = new URL(url, 'http://x').searchParams.get('date')!
      const l = list(d)
      return json({ ...sched([]), date: d, dentists: [{ id: 'd1', name: 'drg. Bunga Contoh' }, LAIN], chairs: [
        { id: 'c1', label: 'Kursi 1', appointments: l.filter((a) => a.chair_id !== 'c2') },
        { id: 'c2', label: 'Kursi 2', appointments: l.filter((a) => a.chair_id === 'c2') }] })
    }
    if (url.startsWith('/api/visits/')) throw new Error('per-visit invoice call: use the batch endpoint ' + url)
    if (url.startsWith('/api/billing/invoice-status')) {
      const ids = (new URL(url, 'http://x').searchParams.get('visit_ids') ?? '').split(',')
      return json({ statuses: Object.fromEntries(ids.filter((v) => o.invoices?.[v]).map((v) => [v, o.invoices![v]])) })
    }
    if (url.startsWith('/api/billing/daily-revenue')) return json({ date: DAY, branch_id: 'b1', amount_rp: 350000, payment_count: 2 })
    if (url.startsWith('/api/planned-appointments')) return json({ data: [] })
    if (url.startsWith('/api/patients')) return json({ data: [] })
    if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(init.body as string) }); return json({}) }
    throw new Error('unexpected ' + url)
  }))
  return posts
}
const phoneToday = () => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2030-01-09T03:00:00Z')); viewport(412) } // 10:00 WIB
afterEach(() => { localStorage.clear(); sessionStorage.clear() })

test.each([
  [['dentist'], 'Pasien saya', false, false],
  [['front_desk'], 'Jadwal', false, false],
  [['kasir'], 'Jadwal', false, false],
  [['owner'], 'Jadwal', false, true],
  [['owner', 'dentist'], 'Jadwal', true, true],
] as const)('HP peran %j: judul "%s", saklar mode %s, ringkasan pemilik %s', async (roles, title, toggle, summary) => {
  phoneToday()
  mockApi(() => [ap('a', 'booked', '11:00')])
  render(<Schedule me={who([...roles])} />)
  expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  expect(!!screen.queryByRole('radiogroup', { name: 'Mode' })).toBe(toggle)
  if (summary) await vi.waitFor(() => expect(screen.getByLabelText('Ringkasan hari')).toHaveTextContent(/^Janji1Hadir0TerbayarRp\s?350\s?rb$/))
  else expect(screen.queryByLabelText('Ringkasan hari')).toBeNull()
})

test('HP multi-peran: mode diingat per pengguna; storage gagal -> mode bawaan peran', async () => {
  phoneToday()
  mockApi(() => [])
  const { unmount } = render(<Schedule me={who(['owner', 'dentist'])} />)
  const group = await screen.findByRole('radiogroup', { name: 'Mode' })
  expect(within(group).getByRole('radio', { name: 'Meja depan' })).toBeChecked()
  fireEvent.click(within(group).getByRole('radio', { name: 'Dokter' }))
  expect(screen.getByRole('heading', { level: 1, name: 'Pasien saya' })).toBeInTheDocument()
  expect(localStorage.getItem('jadwal-mode:d1')).toBe('dokter')
  unmount()
  const again = render(<Schedule me={who(['owner', 'dentist'])} />)
  expect(within(await screen.findByRole('radiogroup')).getByRole('radio', { name: 'Dokter' })).toBeChecked()
  again.unmount()
  render(<Schedule me={who(['owner', 'dentist'], 'd9')} />) // another user: own default
  expect(within(await screen.findByRole('radiogroup')).getByRole('radio', { name: 'Meja depan' })).toBeChecked()
  cleanupAll()
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  render(<Schedule me={who(['owner', 'dentist'])} />)
  expect(within(await screen.findByRole('radiogroup')).getByRole('radio', { name: 'Meja depan' })).toBeChecked()
  vi.restoreAllMocks()
})
const cleanupAll = () => document.body.replaceChildren()
const tutup = () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tutup' }))

test('HP Dokter: hanya janji sendiri; Sedang dirawat -> Berikutnya -> Selesai; primer Mulai kunjungan / Buka RM; tanpa Konfirmasi/Bayar', async () => {
  phoneToday()
  mockApi(() => [
    ap('t', 'in_treatment', '09:00'), ap('c', 'checked_in', '10:30'), ap('b', 'booked', '11:00'),
    ap('o', 'booked', '12:00', { dentist: { id: 'd2', name: 'drg. Lain Contoh' } }), ap('p', 'pending_confirmation', '13:00', { source: 'online' }),
    ap('f', 'done', '08:00', { visit_id: 'vf' }),
  ], { invoices: { vf: 'terbuka' } })
  const { container } = render(<Schedule me={who(['dentist'])} />)
  await screen.findByText('Pasien t')
  expect([...container.querySelectorAll('.agenda-sec h2')].map((h) => h.textContent)).toEqual(['Sedang dirawat · 1', 'Berikutnya · 3', 'Selesai · 1'])
  expect(screen.queryByText('Pasien o')).toBeNull()
  expect(container.querySelectorAll('.agenda-item a, .agenda-item button:not(.agenda-open)')).toHaveLength(0) // cards without buttons
  fireEvent.click(screen.getByRole('button', { name: /^09\.00.*Pasien t/ }))
  expect(within(screen.getByRole('dialog', { name: 'Pasien t' })).getByRole('link', { name: 'Buka RM' })).toHaveAttribute('href', '#/rekam-medis/p-t/janji/t')
  tutup()
  fireEvent.click(await screen.findByRole('button', { name: /^10\.30.*Pasien c/ }))
  const sc = screen.getByRole('dialog', { name: 'Pasien c' })
  expect(within(sc).getByRole('button', { name: 'Mulai kunjungan' })).toHaveClass('button--primary')
  expect(within(sc).queryByRole('button', { name: /^(Konfirmasi|Check-in|Bayar)/ })).toBeNull()
  tutup()
  await screen.findByRole('button', { name: /^10\.30.*Pasien c/ })
  expect(screen.queryByRole('button', { name: /^(Konfirmasi|Check-in|Bayar)/ })).toBeNull()
  expect(screen.queryByRole('link', { name: /^Bayar/ })).toBeNull()
  expect(screen.queryByRole('heading', { name: /Perlu konfirmasi|Belum bayar/ })).toBeNull()
  expect(screen.getByText('Sekarang')).toBeInTheDocument()
})

test('HP Meja depan: Perlu tindakan sekarang (Check-in jatuh tempo, Bayar, Konfirmasi) -> Berikutnya -> Selesai (terlipat); kartu tanpa tombol, aksi utama di sheet', async () => {
  phoneToday()
  mockApi(() => [
    ap('p', 'pending_confirmation', '13:00', { source: 'online' }), ap('u', 'done', '08:00', { visit_id: 'vu' }), ap('l', 'done', '08:30', { visit_id: 'vl', chair_id: 'c2', dentist: LAIN }),
    ap('b', 'booked', '10:15'), ap('f', 'booked', '11:00'), ap('c', 'checked_in', '09:30', { chair_id: 'c2', dentist: LAIN }), ap('x', 'cancelled', '15:00'),
  ], { invoices: { vu: 'terbuka', vl: 'lunas' } })
  const { container } = render(<Schedule me={who(['front_desk'])} />)
  await screen.findByText('Belum bayar')
  expect([...container.querySelectorAll('.agenda-sec h2')].map((h) => h.textContent))
    .toEqual(['Perlu tindakan sekarang · 3', 'Menunggu · 1', 'Berikutnya · 1', 'Selesai · 2']) // board 08: checked in -> Menunggu
  const folds = [...container.querySelectorAll('details.agenda-sec')].filter((d) => !d.querySelector('h2')!.textContent!.startsWith('Menunggu'))
  expect(folds.map((d) => d.hasAttribute('open'))).toEqual([true, true, false]) // Selesai collapsed
  const first = [...folds[0].querySelectorAll('.agenda-open')]
  expect(first.map((b) => b.querySelector('.agenda-name')!.textContent)).toEqual(['Pasien b', 'Pasien u', 'Pasien p']) // check-in due first (10:15 at 10:00)
  expect(first.map((b) => b.querySelector('[data-status]')!.getAttribute('data-status'))).toEqual(['booked', 'unpaid', 'pending_confirmation'])
  expect(within(folds[1] as HTMLElement).getByRole('button', { name: /^11\.00.*Pasien f/ })).toBeInTheDocument() // 11:00 not due yet
  expect(container.querySelectorAll('.agenda-item a, .agenda-item button:not(.agenda-open)')).toHaveLength(0) // no buttons on cards
  const main = async (name: string) => {
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^\\d\\d\\.\\d\\d.*${name},`) }))
    const el = screen.getByRole('dialog', { name }).querySelector('.appt-sheet-actions:not(.sheet-rows) > *') as HTMLElement
    const r = [el.textContent, el.getAttribute('href')]
    tutup()
    return r
  }
  expect(await main('Pasien b')).toEqual(['Check-in', null])
  expect(await main('Pasien u')).toEqual(['Bayar', '#/tagihan/vu'])
  expect(await main('Pasien p')).toEqual(['Konfirmasi', null])
  fireEvent.click(await screen.findByRole('button', { name: /^09\.30.*Pasien c/ })) // Hadir, no note.write: no main action, only the rows
  expect(screen.getByRole('dialog', { name: 'Pasien c' }).querySelector('.appt-sheet-actions:not(.sheet-rows)')).toBeNull()
  tutup()
  await screen.findByRole('button', { name: /^09\.30.*Pasien c/ })
  // dentist chip filter (DEVIATIONS #68); the chair stays on the card
  expect(screen.getByRole('button', { name: /^09\.30.*Pasien c/ })).toHaveTextContent('Konsultasi · drg. Lain Contoh · Kursi 2')
  fireEvent.click(within(screen.getByRole('group', { name: 'Pilih dokter' })).getByRole('button', { name: /drg\. Lain/ }))
  expect(screen.queryByText('Pasien b')).toBeNull()
  expect(screen.getByText('Pasien c')).toBeInTheDocument()
})

test('HP Kasir (#67/#68 kasir = meja depan): Konfirmasi, Check-in, FAB, Ubah jadwal, Ganti kursi, Rujuk; tanpa Buka RM', async () => {
  phoneToday()
  mockApi(() => [ap('p', 'pending_confirmation', '13:00', { source: 'online' }), ap('u', 'done', '08:00', { visit_id: 'vu' }), ap('b', 'booked', '11:00')],
    { invoices: { vu: 'terbuka' } })
  render(<Schedule me={who(['kasir'], 'k1')} />)
  expect(await screen.findByText('Belum bayar')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Perlu tindakan sekarang · 2' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Buat janji' })).toHaveClass('fab')
  fireEvent.click(screen.getByRole('button', { name: /^08\.00.*Pasien u/ }))
  expect(within(screen.getByRole('dialog', { name: 'Pasien u' })).getByRole('link', { name: /Bayar/ })).toHaveAttribute('href', '#/tagihan/vu')
  tutup()
  fireEvent.click(await screen.findByRole('button', { name: /^13\.00.*Pasien p/ }))
  expect(within(screen.getByRole('dialog', { name: 'Pasien p' })).getByRole('button', { name: 'Konfirmasi' })).toHaveClass('button--primary')
  tutup()
  await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: /^11\.00.*Pasien b/ }))
  const sheet = screen.getByRole('dialog', { name: 'Pasien b' })
  expect(within(sheet).getAllByRole('button').map((b) => b.textContent)).toEqual(['Tutup', 'Check-in', 'Ubah jadwal', 'Ganti kursi', 'Rujuk ke dokter lain', 'No-show', 'Batalkan'])
  expect(within(sheet).queryByRole('link', { name: /Buka RM/ })).toBeNull()
})

test('HP: Ganti kursi kirim /chair (dokter tetap); Rujuk hanya untuk dokter janji itu / pemilik, alasan wajib, kirim /refer', async () => {
  phoneToday()
  const posts = mockApi(() => [ap('b', 'booked', '11:00')]) // dentist d1, Kursi 1
  const desk = render(<Schedule me={who(['front_desk'])} />)
  fireEvent.click(await screen.findByRole('button', { name: /^11\.00.*Pasien b/ }))
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Pasien b' })).getByRole('button', { name: 'Ganti kursi' }))
  let form = screen.getByRole('dialog', { name: 'Ganti kursi' })
  expect(within(form).getByText(/dokter tetap/)).toBeInTheDocument()
  expect(within(form).getByRole('combobox', { name: 'Kursi' })).toHaveValue('c2')
  fireEvent.click(within(form).getByRole('button', { name: 'Simpan' }))
  await vi.waitFor(() => expect(posts.at(-1)).toEqual({ url: '/api/appointments/b/chair', body: { chair_id: 'c2' } }))
  desk.unmount()

  const doc = render(<Schedule me={{ ...who(['dentist']), permissions: [...PERMS.dentist, 'appointment.refer'] }} />) // d1 = this appointment's dentist
  fireEvent.click(await screen.findByRole('button', { name: /^11\.00.*Pasien b/ }))
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Pasien b' })).getByRole('button', { name: 'Rujuk ke dokter lain' }))
  form = screen.getByRole('dialog', { name: 'Rujuk ke dokter lain' })
  expect(within(form).getByRole('combobox', { name: 'Dokter gigi tujuan' })).toHaveValue('d2')
  fireEvent.click(within(form).getByRole('button', { name: 'Rujuk' }))
  expect(within(form).getByRole('alert')).toHaveTextContent('Tulis alasan rujukan')
  expect(posts.filter((p) => p.url.endsWith('/refer'))).toEqual([])
  fireEvent.change(within(form).getByRole('textbox', { name: 'Alasan rujukan' }), { target: { value: ' Perlu bedah mulut ' } })
  fireEvent.click(within(form).getByRole('button', { name: 'Rujuk' }))
  await vi.waitFor(() => expect(posts.at(-1)).toEqual({ url: '/api/appointments/b/refer', body: { dentist_id: 'd2', reason: 'Perlu bedah mulut' } }))
  doc.unmount()

  // another dentist: no Rujuk on someone else's appointment (dentists refer only their own)
  // (dentist + assistant: sees the desk agenda through the mode toggle, but assistant is not front desk)
  render(<Schedule me={{ ...who(['dentist'], 'd2'), roles: ['dentist', 'assistant'], permissions: [...PERMS.dentist, 'appointment.refer'] }} />)
  fireEvent.click(within(await screen.findByRole('radiogroup', { name: 'Mode' })).getByRole('radio', { name: /Meja depan/ }))
  fireEvent.click(await screen.findByRole('button', { name: /^11\.00.*Pasien b/ }))
  expect(within(screen.getByRole('dialog', { name: 'Pasien b' })).queryByRole('button', { name: 'Rujuk ke dokter lain' })).toBeNull()
})

test.each([['front_desk'], ['kasir']] as const)('HP %s: Rujuk "Dokter berhalangan" (preset aktif) + keterangan -> /refer', async (role) => {
  phoneToday()
  const posts = mockApi(() => [ap('b', 'booked', '11:00')]) // drg. Bunga (d1)
  render(<Schedule me={who([role], 'k9')} />)
  fireEvent.click(await screen.findByRole('button', { name: /^11\.00.*Pasien b/ }))
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Pasien b' })).getByRole('button', { name: 'Rujuk ke dokter lain' }))
  const form = screen.getByRole('dialog', { name: 'Rujuk ke dokter lain' })
  expect(within(form).getByRole('button', { name: 'Dokter berhalangan' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.change(within(form).getByRole('textbox', { name: 'Keterangan (opsional)' }), { target: { value: 'sakit' } })
  fireEvent.click(within(form).getByRole('button', { name: 'Rujuk' }))
  await vi.waitFor(() => expect(posts.at(-1)).toEqual({ url: '/api/appointments/b/refer', body: { dentist_id: 'd2', reason: 'Dokter berhalangan: sakit' } }))
})

test('HP Rujuk: preset dimatikan & alasan kosong -> galat, tanpa kirim', async () => {
  phoneToday()
  const posts = mockApi(() => [ap('b', 'booked', '11:00')])
  render(<Schedule me={who(['front_desk'], 'k9')} />)
  fireEvent.click(await screen.findByRole('button', { name: /^11\.00.*Pasien b/ }))
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Pasien b' })).getByRole('button', { name: 'Rujuk ke dokter lain' }))
  const form = screen.getByRole('dialog', { name: 'Rujuk ke dokter lain' })
  fireEvent.click(within(form).getByRole('button', { name: 'Dokter berhalangan' }))
  fireEvent.click(within(form).getByRole('button', { name: 'Rujuk' }))
  expect(within(form).getByRole('alert')).toHaveTextContent('Tulis alasan rujukan')
  expect(posts).toEqual([])
})

test('HP: aksi diblokir sesi impersonasi disembunyikan (bukan dinonaktifkan)', async () => {
  phoneToday()
  mockApi(() => [ap('b', 'booked', '11:00')])
  render(<Schedule me={{ ...who(['front_desk']), impersonation: { blocked_actions: ['appointment.transition', 'appointment.create'] } }} />)
  fireEvent.click(await screen.findByRole('button', { name: /^11\.00.*Pasien b/ }))
  expect(within(screen.getByRole('dialog', { name: 'Pasien b' })).queryByRole('button', { name: /^Check-in|^No-show|^Batalkan/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Buat janji' })).toBeNull()
})

test('HP: kartu -> sheet -> Konfirmasi -> toast "Dikonfirmasi" + Urungkan mengembalikan ke menunggu konfirmasi', async () => {
  phoneToday()
  const posts = mockApi(() => [ap('p', 'pending_confirmation', '13:00', { source: 'online' })])
  render(<Schedule me={who(['front_desk'])} />)
  fireEvent.click(await screen.findByRole('button', { name: /^13\.00.*Pasien p/ }))
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Pasien p' })).getByRole('button', { name: 'Konfirmasi' }))
  const toast = await screen.findByText(/^Dikonfirmasi/)
  fireEvent.click(within(toast.closest('.sched-toast') as HTMLElement).getByRole('button', { name: 'Urungkan' }))
  await vi.waitFor(() => expect(posts.map((p) => p.body.to)).toEqual(['booked', 'pending_confirmation']))
})

test('HP: sheet Meja depan – Ubah jadwal kirim reschedule; Batalkan perlu konfirmasi; Tidak datang', async () => {
  phoneToday()
  const posts = mockApi(() => [ap('b', 'booked', '11:00')])
  render(<Schedule me={who(['front_desk'])} />)
  const open = async () => { fireEvent.click(await screen.findByRole('button', { name: /^11\.00.*Pasien b/ })); return screen.getByRole('dialog', { name: 'Pasien b' }) }
  let sheet = await open()
  expect(within(sheet).getAllByRole('button').map((b) => b.textContent)).toEqual(['Tutup', 'Check-in', 'Ubah jadwal', 'Ganti kursi', 'Rujuk ke dokter lain', 'No-show', 'Batalkan'])
  fireEvent.click(within(sheet).getByRole('button', { name: 'Batalkan' }))
  expect(posts).toEqual([])
  fireEvent.click(within(sheet).getByRole('button', { name: 'Ya, batalkan' }))
  await vi.waitFor(() => expect(posts.at(-1)).toEqual({ url: '/api/appointments/b/transition', body: { to: 'cancelled' } }))
  sheet = await open()
  fireEvent.click(within(sheet).getByRole('button', { name: 'Ubah jadwal' }))
  const form = screen.getByRole('dialog', { name: 'Ubah jadwal' })
  fireEvent.change(within(form).getByRole('combobox', { name: 'Jam mulai' }), { target: { value: String(14 * 60) } })
  fireEvent.change(within(form).getByRole('combobox', { name: 'Kursi' }), { target: { value: 'c2' } })
  fireEvent.click(within(form).getByRole('button', { name: 'Simpan' }))
  await vi.waitFor(() => expect(posts.at(-1)).toEqual({ url: '/api/appointments/b/reschedule',
    body: { starts_at: `${DAY}T14:00:00+07:00`, ends_at: `${DAY}T14:30:00+07:00`, chair_id: 'c2' } }))
  sheet = await open()
  fireEvent.click(within(sheet).getByRole('button', { name: 'No-show' }))
  await vi.waitFor(() => expect(posts.at(-1)!.body).toEqual({ to: 'no_show' }))
})

test('HP multi-peran: Mulai kunjungan (Meja depan) -> mode Dokter + langsung RM (#70)', async () => {
  phoneToday()
  let status = 'checked_in'
  const posts = mockApi(() => [ap('c', status, '09:30')])
  render(<Schedule me={who(['owner', 'dentist'])} />)
  fireEvent.click(await screen.findByRole('button', { name: /^09\.30.*Pasien c/ }))
  status = 'in_treatment'
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mulai kunjungan' }))
  await vi.waitFor(() => expect(location.hash).toMatch(/^#\/rekam-medis\/p-c/))
  expect(posts.map((x) => x.body)).toEqual([{ to: 'in_treatment' }])
  expect(screen.getByRole('radio', { name: 'Dokter' })).toBeChecked()
  location.hash = ''
})

test('HP Dokter: kartu Terjadwal hari ini -> sheet "Mulai kunjungan" = check-in + merawat + RM (2 ketuk); tanpa FAB', async () => {
  phoneToday()
  let status = 'booked'
  const posts = mockApi(() => [ap('c', status, '09:30')])
  localStorage.setItem('jadwal-mode:d1', 'dokter')
  render(<Schedule me={who(['owner', 'dentist'])} />)
  fireEvent.click(await screen.findByRole('button', { name: /^09\.30.*Pasien c/ }))
  const cta = within(screen.getByRole('dialog', { name: 'Pasien c' })).getByRole('button', { name: 'Mulai kunjungan' })
  expect(cta).toHaveClass('button--primary')
  expect(screen.queryByRole('button', { name: 'Buat janji' })).toBeNull()
  status = 'in_treatment'
  fireEvent.click(cta)
  await vi.waitFor(() => expect(location.hash).toMatch(/^#\/rekam-medis\/p-c/))
  expect(posts.map((x) => x.body)).toEqual([{ to: 'checked_in', complaint: 'Konsultasi' }, { to: 'in_treatment' }])
  location.hash = ''
})

test('HP Dokter: Selesai -> tanpa prompt Bayar, toast "masuk antrean bayar"; pasien muncul di Belum bayar Meja depan', async () => {
  phoneToday()
  let status = 'in_treatment'
  mockApi(() => [ap('c', status, '09:30', status === 'done' ? { visit_id: 'v1' } : {})], { invoices: { v1: 'terbuka' } })
  localStorage.setItem('jadwal-mode:d1', 'dokter')
  render(<Schedule me={who(['owner', 'dentist'])} />)
  fireEvent.click(await screen.findByRole('button', { name: /^09\.30.*Pasien c/ }))
  status = 'done'
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Selesai' }))
  expect(await screen.findByText('Selesai · masuk antrean bayar')).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: 'Lanjut ke Bayar?' })).toBeNull()
  expect(screen.getByRole('radio', { name: 'Dokter' })).toBeChecked()
  fireEvent.click(screen.getByRole('radio', { name: 'Meja depan' }))
  const now = await screen.findByRole('heading', { name: /^Perlu tindakan sekarang/ })
  expect(within(now.closest('details') as HTMLElement).getByText('Belum bayar')).toBeInTheDocument()
})

test('HP kosong: Meja depan "Belum ada janji.", pil dokter tanpa janji, Dokter + "Hari berikutnya" ke tanggal terdekat', async () => {
  phoneToday()
  mockApi((d) => d === '2030-01-12' ? [{ ...ap('n', 'booked', '09:00'), starts_at: '2030-01-12T09:00:00+07:00', ends_at: '2030-01-12T09:30:00+07:00' }]
    : d === DAY ? [ap('b', 'booked', '11:00', { dentist: { id: 'd2', name: 'drg. Lain Contoh' } })] : [])
  const desk = render(<Schedule me={who(['front_desk'])} />)
  fireEvent.click(within(await screen.findByRole('group', { name: 'Pilih dokter' })).getByRole('button', { name: /drg\. Bunga/ }))
  expect(within(screen.getByRole("group", { name: "Pilih dokter" })).getByRole("button", { name: /drg\. Bunga/ }).textContent).not.toMatch(/drg\./) // review-2: no truncated "drg." prefix on the chip
  expect(screen.getByText('drg. Bunga Contoh: belum ada janji hari ini.')).toBeInTheDocument()
  desk.unmount()
  render(<Schedule me={who(['dentist'])} />)
  expect(await screen.findByText('Tidak ada pasien hari ini.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Hari berikutnya' }))
  expect(await screen.findByText('Pasien n')).toBeInTheDocument()
  await openWeek() // review-2: the week strip is folded behind the calendar button
  expect(screen.getByRole('button', { name: /^Sabtu, 12 Januari 2030/ })).toHaveAttribute('aria-pressed', 'true')
})

test('HP galat: "Gagal memuat." + Coba lagi', async () => {
  phoneToday()
  let fail = true
  mockApi(() => [ap('b', 'booked', '11:00')], { failSchedule: () => fail })
  render(<Schedule me={who(['front_desk'])} />)
  const alert = (await screen.findByText('Gagal memuat.')).closest('[role=alert]') as HTMLElement
  fail = false
  fireEvent.click(within(alert).getByRole('button', { name: 'Coba lagi' }))
  expect(await screen.findByText('Pasien b')).toBeInTheDocument()
})

test('usePendingConfirm: jumlah booking online menunggu hari ini; dibaca ulang saat Jadwal berubah; mati = 0 tanpa fetch', async () => {
  phoneToday()
  let list = [ap('p', 'pending_confirmation', '13:00', { source: 'online' }), ap('q', 'pending_confirmation', '14:00', { source: 'online' }), ap('b', 'booked', '11:00')]
  mockApi(() => list)
  const { result } = renderHook(() => usePendingConfirm('b1', true))
  await vi.waitFor(() => expect(result.current).toBe(2))
  list = list.slice(1)
  act(() => { dispatchEvent(new Event('jadwal:changed')) })
  await vi.waitFor(() => expect(result.current).toBe(1))
  const off = renderHook(() => usePendingConfirm('b1', false))
  expect(off.result.current).toBe(0)
})

test('HP: geser kiri/kanan di konten ganti hari; geser vertikal & baris chip diabaikan; klik akhir geser tidak membuka kartu', async () => {
  phoneToday()
  mockApi((d) => d === DAY ? [ap('b', 'booked', '11:00')] : [])
  const { container } = render(<Schedule me={who(['front_desk'])} />)
  const card = await screen.findByRole('button', { name: /^11\.00.*Pasien b/ })
  const area = container.querySelector('.sched-swipe') as HTMLElement
  const day = (n: number) => screen.getByRole('button', { name: new RegExp(`^\\w+, ${n} Januari 2030`) })
  const drag = (el: Element, dx: number, dy: number) => {
    fireEvent.pointerDown(el, { clientX: 200, clientY: 300, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 200 + dx, clientY: 300 + dy, pointerId: 1 })
  }
  await openWeek() // review-2: the week strip is folded behind the calendar button
  drag(card, -50, 120) // mostly vertical: a scroll, not a swipe
  expect(day(9)).toHaveAttribute('aria-pressed', 'true')
  drag(card, -120, 10)
  fireEvent.click(card) // the click that ends the gesture
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(day(10)).toHaveAttribute('aria-pressed', 'true')
  await screen.findByText('Belum ada janji.')
  drag(area, 120, 0)
  expect(day(9)).toHaveAttribute('aria-pressed', 'true')
  drag(within(await screen.findByRole('group', { name: 'Pilih dokter' })).getAllByRole('button')[0], -150, 0) // chip row scrolls itself
  expect(day(9)).toHaveAttribute('aria-pressed', 'true')
})

test('Pasien datang (audit P1-6): the desk registers a walk-in with dentist + keluhan, no time or chair; hidden without visit.register', async () => {
  viewport(1280)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2030-01-07T01:00:00Z'))
  const posts: { url: string; body: any }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/sanctum/csrf-cookie') { document.cookie = 'XSRF-TOKEN=abc'; return new Response(null, { status: 204 }) }
    if (url.startsWith('/api/schedule')) return json(sched([]))
    if (url.startsWith('/api/planned-appointments')) return json({ data: [] })
    if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(init.body as string) }); return json({ id: 'v7' }, 201) }
    if (url.startsWith('/api/patients')) return json({ data: [{ id: 'p7', name: 'Rina Contoh', dob: '1990-05-12' }] })
    throw new Error('unexpected ' + url)
  }))
  const r = render(<Schedule me={ME} />)
  await screen.findByRole('button', { name: '+ Buat Janji' })
  expect(screen.queryByRole('button', { name: 'Pasien datang' })).toBeNull()
  r.unmount()

  render(<Schedule me={{ ...ME, permissions: [...ME.permissions, 'visit.register'] }} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Pasien datang' }))
  const dlg = screen.getByRole('dialog', { name: 'Pasien datang' })
  expect(within(dlg).queryByLabelText(/Jam|Kursi/)).toBeNull()
  fireEvent.change(within(dlg).getByLabelText('Pasien'), { target: { value: 'Rina' } })
  fireEvent.click(await within(dlg).findByRole('button', { name: /Rina Contoh/ }))
  expect(within(dlg).getByLabelText('Dokter gigi')).toHaveValue('d1') // the branch's only dentist
  fireEvent.change(within(dlg).getByLabelText('Keluhan (opsional)'), { target: { value: 'Gusi bengkak' } })
  fireEvent.click(within(dlg).getByRole('button', { name: 'Daftarkan datang' }))
  await vi.waitFor(() => expect(posts).toEqual([{ url: '/api/patients/p7/visits/walk-in', body: { dentist_id: 'd1', complaint: 'Gusi bengkak' } }]))
  expect((await screen.findByText('Pasien Rina Contoh terdaftar datang')).closest('[role="status"]')).not.toBeNull()
  await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})
