import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import BookingPage from './BookingPage'
import ManagePage from './ManagePage'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const BASE = '/api/public/booking/senyum'
const INFO = {
  clinic: { name: 'Klinik Gigi Senyum Sehat', online_booking_enabled: true },
  branches: [{ id: 'b1', name: 'Kemang', timezone: 'Asia/Jakarta' }],
  dentists: [{ id: 'd1', name: 'drg. Bunga Contoh' }, { id: 'd2', name: 'drg. Raka Contoh' }],
  services: [{ id: 's1', name: 'Konsultasi', duration_minutes: 30 }],
}
const SLOTS = { slots: [
  { starts_at: '2030-01-07T06:00:00Z', ends_at: '2030-01-07T06:30:00Z', time: '13:00', branch_id: 'b1' },
  { starts_at: '2030-01-07T06:30:00Z', ends_at: '2030-01-07T07:00:00Z', time: '13:30', branch_id: 'b1' },
] }
const MANAGE = { clinic: { name: 'Klinik Gigi Senyum Sehat' }, code: 'BK-ABC234', status: 'pending_confirmation', starts_at: SLOTS.slots[1].starts_at,
  ends_at: SLOTS.slots[1].ends_at, branch: INFO.branches[0], dentist: INFO.dentists[0], service: INFO.services[0], can_change: true }

function mockFetch(routes: Record<string, (body: any) => Response>) {
  const calls: { key: string; body: any }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/sanctum/csrf-cookie') { document.cookie = 'XSRF-TOKEN=abc'; return new Response(null, { status: 204 }) }
    const key = `${init?.method ?? 'GET'} ${url.split('?')[0]}`
    const body = init?.body ? JSON.parse(init.body as string) : null
    calls.push({ key, body })
    if (!routes[key]) throw new Error('unexpected ' + key)
    return routes[key](body)
  }))
  return calls
}
afterEach(() => vi.unstubAllGlobals())

test('dokter -> layanan -> jam -> data -> OTP -> konfirmasi', async () => {
  const calls = mockFetch({
    [`GET ${BASE}`]: () => json(INFO),
    [`GET ${BASE}/slots`]: () => json(SLOTS),
    [`POST ${BASE}/start`]: () => json({ challenge_id: 'c1', phone_masked: '+62899****777', expires_in: 300, resend_in: 60 }, 201),
    [`POST ${BASE}/verify`]: (b) => b.code === '123456'
      ? json({ code: 'BK-ABC234', manage_token: 'tok123', status: 'pending_confirmation', ...SLOTS.slots[1] }, 201)
      : json({ error: 'otp_wrong', message: 'Kode salah.', attempts_left: 4 }, 422),
  })
  render(<BookingPage slug="senyum" />)

  fireEvent.click(await screen.findByRole('button', { name: /drg\. Bunga Contoh/ }))
  expect(screen.getByRole('heading', { name: 'Pilih layanan' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Konsultasi/ }))
  const next = screen.getByRole('button', { name: 'Lanjut' })
  expect(next).toBeDisabled()
  fireEvent.click(await screen.findByRole('button', { name: '13:30' }))
  expect(screen.getByRole('button', { name: '13:30' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(next)

  fireEvent.change(screen.getByLabelText('Nama lengkap'), { target: { value: 'Rani Uji Contoh' } })
  fireEvent.change(screen.getByLabelText('Nomor WhatsApp'), { target: { value: '0899-0100-0777' } })
  fireEvent.change(screen.getByLabelText('Keluhan (opsional)'), { target: { value: 'Ngilu' } })
  fireEvent.click(screen.getByRole('button', { name: 'Kirim kode' }))

  expect(await screen.findByText('Dikirim ke WhatsApp +62899****777')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Kirim ulang \(60\)/ })).toBeDisabled()
  const otp = screen.getByLabelText('Kode 6 angka')
  fireEvent.change(otp, { target: { value: '000000' } })
  fireEvent.click(screen.getByRole('button', { name: 'Verifikasi' }))
  expect(await screen.findByText('Kode salah. Sisa 4 kali.')).toBeInTheDocument()
  fireEvent.change(otp, { target: { value: '123456' } })
  fireEvent.click(screen.getByRole('button', { name: 'Verifikasi' }))

  expect(await screen.findByRole('heading', { name: 'Booking terkirim' })).toBeInTheDocument()
  expect(screen.getByText('BK-ABC234')).toBeInTheDocument()
  expect(screen.getByText('Menunggu konfirmasi')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Kelola' })).toHaveAttribute('href', '#/book/senyum/manage/tok123')
  expect(calls.find((c) => c.key.endsWith('/start'))!.body).toEqual({ dentist_id: 'd1', service_id: 's1', starts_at: SLOTS.slots[1].starts_at,
    name: 'Rani Uji Contoh', phone: '0899-0100-0777', complaint: 'Ngilu' })
})

test('booking off shows a closed state', async () => {
  mockFetch({ [`GET ${BASE}`]: () => json({ ...INFO, clinic: { ...INFO.clinic, online_booking_enabled: false }, dentists: [], services: [] }) })
  render(<BookingPage slug="senyum" />)
  expect(await screen.findByRole('heading', { name: 'Booking online belum dibuka' })).toBeInTheDocument()
})

test('manage page: cancel after confirming', async () => {
  const calls = mockFetch({
    [`GET ${BASE}/manage/tok123`]: () => json(MANAGE),
    [`POST ${BASE}/manage/tok123/cancel`]: () => json({ ...MANAGE, status: 'cancelled', can_change: false }),
  })
  render(<ManagePage slug="senyum" token="tok123" />)
  expect(await screen.findByText('BK-ABC234')).toBeInTheDocument()
  expect(screen.queryByText(/Ngilu/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Batalkan' }))
  fireEvent.click(screen.getByRole('button', { name: 'Ya, batalkan' }))
  expect(await screen.findByText('Booking dibatalkan.')).toBeInTheDocument()
  expect(screen.getByText('Dibatalkan')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Jadwal ulang' })).not.toBeInTheDocument()
  expect(calls.map((c) => c.key)).toEqual([`GET ${BASE}/manage/tok123`, `POST ${BASE}/manage/tok123/cancel`])
})

test('manage page: expired link', async () => {
  mockFetch({ [`GET ${BASE}/manage/old`]: () => json({ error: 'link_expired', message: 'Tautan sudah kedaluwarsa.' }, 410) })
  render(<ManagePage slug="senyum" token="old" />)
  expect(await screen.findByRole('heading', { name: 'Tautan sudah kedaluwarsa.' })).toBeInTheDocument()
})
