import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { Shift } from './api'

const open: Shift = { id: 's1', opening_cash_rp: 1000000, opened_at: '2026-11-15T01:00:00Z', closed_at: null, counted_cash_rp: null, difference_rp: null,
  reason: null, cash_in_rp: 1250000, expected_cash_rp: 2250000, total_rp: 2050000,
  methods: [{ kind: 'tunai', bank_name: null, amount_rp: 1250000, count: 3 }, { kind: 'edc', bank_name: 'BCA', amount_rp: 300000, count: 1 },
    { kind: 'bpjs', bank_name: null, amount_rp: 500000, count: 1 }] }
const closeShift = vi.fn((_id: string, b: { counted_cash_rp: number; reason?: string }) =>
  Promise.resolve({ shift: { ...open, closed_at: 'x', counted_cash_rp: b.counted_cash_rp, difference_rp: b.counted_cash_rp - open.expected_cash_rp, reason: b.reason ?? null } }))
vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()), currentShift: () => Promise.resolve({ shift: open }),
  closeShift: (id: string, b: { counted_cash_rp: number; reason?: string }) => closeShift(id, b) }))
const { default: ShiftPage } = await import('./ShiftPage')

test('KL06: expected cash, non-cash per bank; a difference needs a reason; cashier closes alone and sees the recap', async () => {
  render(<ShiftPage />)
  expect(await screen.findByText('Rp2.250.000')).toBeInTheDocument() // seharusnya di laci
  expect(screen.getByText('Debit BCA')).toBeInTheDocument()
  expect(screen.getByText('BPJS')).toBeInTheDocument()
  const close = screen.getByRole('button', { name: 'Tutup shift' })
  fireEvent.change(screen.getByLabelText('Kas dihitung (Rp)'), { target: { value: '2240000' } })
  expect(screen.getByRole('status')).toHaveTextContent('Selisih kurang Rp10.000')
  expect(close).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Alasan selisih'), { target: { value: 'Kembalian salah hitung' } })
  fireEvent.click(close)
  expect(closeShift).toHaveBeenCalledWith('s1', { counted_cash_rp: 2240000, reason: 'Kembalian salah hitung' })
  const done = await screen.findByRole('region', { name: 'Shift ditutup' })
  expect(within(done).getByText('- Rp10.000')).toBeInTheDocument()
})
