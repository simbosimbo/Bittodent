import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { KasirRow } from './api'

const row = (id: string, status: KasirRow['status'], balance: number, name: string | null, extra: Partial<KasirRow> = {}): KasirRow => ({ id, visit_id: `v-${id}`,
  patient_id: `p-${id}`, patient_name: name, status, created_at: '2026-11-15T03:00:00Z', lines_rp: 150000, adjustments_rp: 0, credit_notes_rp: 0,
  payments_rp: 150000 - balance, refunds_rp: 0, balance_rp: balance, payer_type: 'umum', items: ['Tumpatan 26'], ...extra })
const list = vi.fn()
vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()), kasirList: () => list(),
  getDailyRevenue: () => Promise.resolve({ date: '2026-11-15', branch_id: 'b1', amount_rp: 2150000, payment_count: 4 }) }))
const { default: KasirPage } = await import('./KasirPage')

test('Kasir (KL01): cards with KPI; open ones first, each card opens its tagihan; filters BPJS and Tempo', async () => {
  list.mockResolvedValue({ date: '2026-11-15', branch_id: 'b1', invoices: [row('a', 'terbuka', 150000, 'Sari Contoh'),
    row('h', 'terbuka', 400000, 'Hendra Contoh', { payer_type: 'bpjs', items: ['Scaling'] }),
    row('t', 'terbuka', 250000, 'Budi Contoh', { created_at: '2026-11-10T03:00:00Z' }), row('b', 'lunas', 0, 'Dewi Contoh')] })
  render(<KasirPage />)
  const open = await screen.findByRole('region', { name: 'Belum bayar (3)' })
  expect(await screen.findByText('Rp2.150.000')).toBeInTheDocument() // diterima hari ini
  const sari = within(open).getByRole('link', { name: /Sari Contoh, belum bayar, Rp150.000/ })
  expect(sari).toHaveAttribute('href', '#/tagihan/v-a')
  expect(sari).toHaveTextContent('Tumpatan 26')
  expect(within(screen.getByRole('region', { name: 'Lunas / void hari ini (1)' })).getByRole('link', { name: /Dewi Contoh/ })).toHaveAttribute('href', '#/tagihan/v-b')
  fireEvent.click(screen.getByRole('radio', { name: 'BPJS' }))
  expect(screen.getAllByRole('listitem').map((l) => l.textContent)).toEqual([expect.stringContaining('Hendra Contoh')])
  fireEvent.click(screen.getByRole('radio', { name: 'Tempo' }))
  expect(screen.getAllByRole('listitem').map((l) => l.textContent)).toEqual([expect.stringContaining('Budi Contoh')])
})

test('Kasir: empty list explains where invoices come from; an error offers retry', async () => {
  list.mockResolvedValueOnce({ date: '2026-11-15', branch_id: 'b1', invoices: [] })
  const { unmount } = render(<KasirPage />)
  expect(await screen.findByText(/Tagihan muncul setelah dokter menekan Selesai/)).toBeInTheDocument()
  unmount()
  list.mockRejectedValueOnce(new Error('x'))
  render(<KasirPage />)
  expect(await screen.findByRole('button', { name: 'Coba lagi' })).toBeInTheDocument()
})
