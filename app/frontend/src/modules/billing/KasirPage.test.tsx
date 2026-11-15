import { render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { KasirRow } from './api'

const row = (id: string, status: KasirRow['status'], balance: number, name: string | null): KasirRow => ({ id, visit_id: `v-${id}`, patient_id: `p-${id}`,
  patient_name: name, status, created_at: '2026-11-15T03:00:00Z', lines_rp: 150000, adjustments_rp: 0, credit_notes_rp: 0,
  payments_rp: 150000 - balance, refunds_rp: 0, balance_rp: balance })
const list = vi.fn()
vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()), kasirList: () => list() }))
const { default: KasirPage } = await import('./KasirPage')

test('Kasir (#69): open invoices first with Bayar to their tagihan; today\'s paid ones open the kwitansi', async () => {
  list.mockResolvedValue({ date: '2026-11-15', branch_id: 'b1', invoices: [row('a', 'terbuka', 150000, 'Sari Contoh'), row('b', 'lunas', 0, 'Budi Contoh')] })
  render(<KasirPage />)
  const open = await screen.findByRole('region', { name: 'Belum lunas (1)' })
  expect(open).toHaveTextContent('Sari Contoh')
  expect(open).toHaveTextContent('Sisa Rp150.000')
  expect(within(open).getByRole('link', { name: 'Bayar' })).toHaveAttribute('href', '#/tagihan/v-a')
  const done = screen.getByRole('region', { name: 'Lunas / void hari ini (1)' })
  expect(done).toHaveTextContent('Lunas')
  expect(within(done).getByRole('link', { name: 'Lihat / kwitansi' })).toHaveAttribute('href', '#/tagihan/v-b')
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
