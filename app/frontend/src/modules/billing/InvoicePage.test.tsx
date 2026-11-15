import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { Me } from '../../shared/session'
import type { Invoice, PaymentAccount } from './api'

const inv: Invoice = { id: 'i1', visit_id: 'v1', branch_id: 'b1', status: 'terbuka', lines_rp: 100000, adjustments_rp: 0, payments_rp: 0, balance_rp: 100000,
  lines: [{ id: 'l1', procedure_code: '23.2', procedure_name: 'Tumpatan', tooth: 16, price_rp: 100000 }],
  adjustments: [{ id: 'a1', kind: 'discount', amount_rp: 100000, reason: 'Diskon penuh', created_at: '', status: 'pending', self_approved_sole_owner: false }],
  payments: [] }
const acc = (id: string, name: string, kind: PaymentAccount['kind'], branch_id: string | null, is_active = true): PaymentAccount =>
  ({ id, name, kind, branch_id, is_active, bank_name: null, account_last4: null })
const accounts = [acc('k1', 'Kas Kemang', 'tunai', 'b1'), acc('q1', 'QRIS klinik', 'qris', null), acc('k2', 'Kas Rawamangun', 'tunai', 'b2'),
  acc('e1', 'EDC lama', 'edc', null, false)]
const addPayment = vi.fn((_id: string, body: { amount_rp: number }) => Promise.resolve({ ...inv, balance_rp: inv.balance_rp - body.amount_rp }))
vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()), invoiceForVisit: () => Promise.resolve(inv),
  paymentAccounts: () => Promise.resolve(accounts), addPayment: (id: string, body: { amount_rp: number }) => addPayment(id, body) }))
const { default: InvoicePage } = await import('./InvoicePage')
const me = (permissions: string[]) => ({ permissions } as unknown as Me)

test('pending Rp0 adjustment: only the owner (billing.approve_zero) sees approve/reject', async () => {
  const { unmount } = render(<InvoicePage visitId="v1" me={me(['billing.read', 'billing.adjust'])} />)
  expect(await screen.findByText('Menunggu pemilik')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Setujui' })).toBeNull()
  unmount()
  render(<InvoicePage visitId="v1" me={me(['billing.read', 'billing.approve_zero'])} />)
  expect(await screen.findByRole('button', { name: 'Setujui' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tolak' })).toBeInTheDocument()
})

test('payment methods are only active clinic accounts of this branch; split posts one payment per row', async () => {
  render(<InvoicePage visitId="v1" me={me(['billing.read', 'billing.adjust'])} />)
  const m1 = await screen.findByRole('combobox', { name: 'Metode 1' })
  await screen.findByRole('option', { name: /Kas Kemang/ })
  expect(within(m1).getAllByRole('option').map((o) => o.textContent)).toEqual(['Pilih akun klinik…', 'Kas Kemang (Tunai)', 'QRIS klinik (QRIS)'])
  expect(screen.queryByRole('textbox', { name: /rekening/i })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Tambah metode (split)' }))
  fireEvent.change(m1, { target: { value: 'k1' } })
  fireEvent.change(screen.getByLabelText('Jumlah 1 (Rp)'), { target: { value: '40000' } })
  fireEvent.change(screen.getByRole('combobox', { name: 'Metode 2' }), { target: { value: 'q1' } })
  fireEvent.change(screen.getByLabelText('Jumlah 2 (Rp)'), { target: { value: '60000' } })
  fireEvent.click(screen.getByRole('button', { name: 'Terima pembayaran' }))
  await waitFor(() => expect(addPayment).toHaveBeenCalledTimes(2))
  expect(addPayment.mock.calls.map(([, b]) => [(b as unknown as { payment_account_id: string }).payment_account_id, b.amount_rp])).toEqual([['k1', 40000], ['q1', 60000]])
})
