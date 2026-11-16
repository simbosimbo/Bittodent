import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../../shared/session'
import Home from './Home'

const me = (permissions: string[], roles = ['dentist']): Me => ({
  user: { id: 'u1', name: 'drg. Uji Sintetis', email: 'dokter@uji.test' }, roles, permissions,
  active: { tenant_id: 't1', tenant_name: 'Klinik Uji', branch_id: 'b1', branch_name: 'Cabang Uji', timezone: 'Asia/Jakarta' },
  branches: [{ id: 'b1', name: 'Cabang Uji', timezone: 'Asia/Jakarta' }],
})
const appt = (id: string, status: string, patient: string, at: string) => ({ id, chair_id: 'c1', starts_at: `2026-11-14T${at}:00+07:00`,
  ends_at: `2026-11-14T${at}:30+07:00`, status, reason: 'Kontrol', patient: { id: 'p-' + id, name: patient }, dentist: { id: 'd1', name: 'drg. Sintetis' } })
const schedule = {
  branch: { id: 'b1', name: 'Cabang Uji', timezone: 'Asia/Jakarta' }, date: '2026-11-14', dentists: [{ id: 'd1', name: 'drg. Sintetis' }],
  chairs: [{ id: 'c1', label: 'Kursi 1', appointments: [
    appt('a1', 'booked', 'Sari Sintetis', '09:00'), appt('a2', 'checked_in', 'Budi Contoh', '08:00'),
    appt('a3', 'cancelled', 'Batal Contoh', '10:00'), appt('a4', 'no_show', 'Absen Contoh', '11:00'),
    appt('a5', 'done', 'Dina Selesai', '12:00'),
  ] }],
}
const revenue = { date: '2026-11-14', branch_id: 'b1', amount_rp: 450000, payment_count: 2 }
const home = (perms: string[], sched: object = schedule, roles?: string[]) => {
  const fetch = vi.fn(async (url: string) =>
    new Response(JSON.stringify(url.startsWith('/api/billing/daily-revenue') ? revenue : sched), { status: 200 }))
  vi.stubGlobal('fetch', fetch)
  render(<Home me={me(perms, roles)} />)
  return fetch
}
const region = (name: string) => screen.findByRole('region', { name })
const hrefs = (el: HTMLElement) => within(el).queryAllByRole('link', { name: /^Buka Rekam Medis/ }).map((a) => a.getAttribute('href'))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

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

test('without note.read there are no chart links', async () => {
  home([])
  expect(hrefs(await region('Janji hari ini'))).toEqual([])
})

test('Pasien hari ini adds walk-in patients without an appointment', async () => {
  home([], { ...schedule, walk_in_patients: 2 })
  const kpi = within(await region('Pasien hari ini'))
  expect(kpi.getByText('5')).toBeInTheDocument()
  expect(kpi.getByText('3 dengan janji · 2 tanpa janji')).toBeInTheDocument()
})

const atWib = (hhmm: string) => {
  vi.useFakeTimers({ toFake: ['Date'] }) // only the clock; RTL's async polling keeps real timers
  vi.setSystemTime(new Date(`2026-11-14T${hhmm}:00+07:00`))
}

test('four KPI cards derive their numbers from the schedule; revenue is hidden without billing.read', async () => {
  const fetch = home([])
  const kpi = async (name: string) => within(await region(name))
  expect((await kpi('Pasien hari ini')).getByText('3')).toBeInTheDocument()
  expect((await kpi('Pasien hari ini')).getByText('3 dengan janji')).toBeInTheDocument()
  expect((await kpi('Janji temu')).getByText('3')).toBeInTheDocument()
  expect((await kpi('Janji temu')).getByText('1 selesai · 2 tersisa')).toBeInTheDocument()
  expect((await kpi('Antrean')).getByText('1')).toBeInTheDocument()
  expect((await kpi('Antrean')).getByText('0 sedang dirawat · 1 menunggu')).toBeInTheDocument()
  const revenue = await kpi('Pendapatan hari ini')
  expect(revenue.getByText('—')).toBeInTheDocument()
  expect(revenue.getByText('Tidak ditampilkan untuk peran ini')).toBeInTheDocument()
  expect(revenue.queryByText(/Rp/)).toBeNull()
  expect(fetch.mock.calls.some(([url]) => String(url).includes('/api/billing'))).toBe(false)
})

test('with billing.read the revenue card shows payments collected today from the API', async () => {
  const fetch = home(['billing.read'])
  const card = within(await region('Pendapatan hari ini'))
  expect(await card.findByText(/^Rp\s?450\.000$/)).toBeInTheDocument()
  expect(card.getByText('Dari 2 transaksi lunas')).toBeInTheDocument()
  expect(card.queryByText(/,00/)).toBeNull()
  expect(fetch).toHaveBeenCalledWith('/api/billing/daily-revenue', expect.anything())
})

test('greeting uses the WIB time of day and the user name; Sekarang line shows inside the axis', async () => {
  atWib('10:20')
  home([])
  expect(await screen.findByText('Selamat pagi, drg. Uji Sintetis')).toBeInTheDocument()
  expect(screen.getByText('Sekarang 10.20')).toBeInTheDocument()
})

test('Sekarang line is hidden outside the visible axis', async () => {
  atWib('21:30')
  home([])
  expect(await screen.findByText('Selamat sore, drg. Uji Sintetis')).toBeInTheDocument()
  expect(screen.queryByText(/^Sekarang/)).toBeNull()
})

test('header actions follow permissions', async () => {
  home([])
  await region('Janji hari ini')
  expect(screen.queryByRole('link', { name: 'Daftarkan pasien' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'Buat janji' })).toBeNull()
  cleanup()
  home(['patient.create', 'appointment.create'])
  expect(await screen.findByRole('link', { name: 'Daftarkan pasien' })).toHaveAttribute('href', '#/pasien/baru')
  expect(screen.getByRole('link', { name: 'Buat janji' })).toHaveAttribute('href', '#/jadwal')
})

test('timeline has a dentist row; blocks link to the chart; cancelled/no_show are not chart links', async () => {
  home(['note.read', 'note.write'])
  const board = await region('Jadwal hari ini per dokter')
  expect(within(board).getByText('drg. Sintetis')).toBeInTheDocument()
  expect(within(board).getByText('3 janji · 2 tersisa')).toBeInTheDocument()
  expect(within(board).getByRole('link', { name: 'Buka Rekam Medis Sari Sintetis' })).toHaveAttribute('href', '#/rekam-medis/p-a1/janji/a1')
  expect(hrefs(board)).toEqual(['#/rekam-medis/p-a2/janji/a2', '#/rekam-medis/p-a1/janji/a1', '#/rekam-medis/p-a5/janji/a5'])
  expect(within(board).queryByRole('link', { name: /Batal Contoh|Absen Contoh/ })).toBeNull()
})

test('timeline blocks are static without note.read', async () => {
  home([])
  const board = await region('Jadwal hari ini per dokter')
  expect(within(board).getByText('Sari Sintetis')).toBeInTheDocument()
  expect(hrefs(board)).toEqual([])
})

test('"Belum selesai" hides done appointments; "Semua" shows them', async () => {
  home([])
  const today = await region('Janji hari ini')
  expect(within(today).getByRole('button', { name: 'Belum selesai' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(today).queryByText('Dina Selesai')).toBeNull()
  fireEvent.click(within(today).getByRole('button', { name: 'Semua' }))
  expect(within(today).getByText('Dina Selesai')).toBeInTheDocument()
  expect(within(today).queryByText('Batal Contoh')).toBeNull()
  expect(within(today).getByText('3 janji ditampilkan · urut berdasarkan jam')).toBeInTheDocument()
})

test('390px: greeting and KPIs open the page; Daftarkan pasien / Buat janji leave the top toolbar and sit after the KPI tiles', async () => {
  vi.stubGlobal('matchMedia', (q: string) => ({ media: q, matches: true, addEventListener() {}, removeEventListener() {} }))
  home(['patient.create', 'appointment.create'], schedule, ['owner'])
  const kpi = await region('Pasien hari ini')
  expect(screen.getByText(/^Selamat (pagi|siang|sore), drg\. Uji Sintetis$/)).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Beranda' })).toHaveClass('sr-only')
  const head = document.querySelector('.home-head') as HTMLElement
  expect(within(head).queryByRole('link', { name: 'Buat janji' })).toBeNull()
  expect(within(head).queryByRole('link', { name: 'Daftarkan pasien' })).toBeNull()
  const cta = screen.getByRole('link', { name: 'Buat janji' })
  expect(kpi.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Daftarkan pasien' })).toHaveAttribute('href', '#/pasien/baru')
})

test('desktop: the CTAs stay in the header toolbar', async () => {
  home(['patient.create', 'appointment.create'])
  await region('Pasien hari ini')
  expect(within(document.querySelector('.home-head') as HTMLElement).getByRole('link', { name: 'Buat janji' })).toHaveAttribute('href', '#/jadwal')
})

test('#70 phone, Dokter mode: Beranda is "Pasien saya" (no KPI/revenue); a desk role keeps the KPI Beranda', async () => {
  vi.stubGlobal('matchMedia', (q: string) => ({ media: q, matches: true, addEventListener() {}, removeEventListener() {} }))
  home(['appointment.read', 'note.read', 'note.write', 'billing.read'])
  expect(await screen.findByRole('heading', { level: 1, name: 'Pasien saya' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Pasien hari ini' })).toBeNull()
  cleanup()
  home(['appointment.read', 'note.read', 'billing.read'], schedule, ['owner'])
  expect(await region('Pasien hari ini')).toBeInTheDocument()
})
