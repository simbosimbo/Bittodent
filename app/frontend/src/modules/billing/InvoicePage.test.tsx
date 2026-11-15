import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Me } from '../../shared/session'
import type { Invoice, PaymentAccount } from './api'

const line = { id: 'l1', procedure_code: '23.2', procedure_name: 'Tumpatan', tooth: 16, price_rp: 100000, credited_rp: 0, credit_note_numbers: [],
  tariff_zero: null, correction_reviews: [] }
const inv: Invoice = { id: 'i1', visit_id: 'v1', branch_id: 'b1', status: 'terbuka', lines_rp: 100000, adjustments_rp: 0, credit_notes_rp: 0, payments_rp: 0,
  refunds_rp: 0, balance_rp: 100000, overpaid_rp: 0, lines: [line], credit_notes: [], voids: [], refunds: [],
  adjustments: [{ id: 'a1', kind: 'discount', amount_rp: 100000, reason: 'Diskon penuh', created_at: '', status: 'pending', self_approved_sole_owner: false }],
  payments: [] }
let current: Invoice = inv
const acc = (id: string, name: string, kind: PaymentAccount['kind'], branch_id: string | null, is_active = true): PaymentAccount =>
  ({ id, name, kind, branch_id, is_active, bank_name: null, account_last4: null })
const accounts = [acc('k1', 'Kas Kemang', 'tunai', 'b1'), acc('q1', 'QRIS klinik', 'qris', null), acc('k2', 'Kas Rawamangun', 'tunai', 'b2'),
  acc('e1', 'EDC lama', 'edc', null, false)]
const addPayment = vi.fn((_id: string, body: { amount_rp: number }) => Promise.resolve({ ...inv, balance_rp: inv.balance_rp - body.amount_rp }))
vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()), invoiceForVisit: () => Promise.resolve(current),
  addCreditNote: (id: string, body: object) => addCreditNote(id, body), billFromCorrection: (id: string, c: string) => billFromCorrection(id, c),
  addRefund: (id: string, body: object) => addRefund(id, body),
  paymentAccounts: () => Promise.resolve(accounts), addPayment: (id: string, body: { amount_rp: number }) => addPayment(id, body) }))
const addCreditNote = vi.fn((_id: string, _b: object) => Promise.resolve({ ...inv, credit_notes: [{ id: 'n1', number: 'NK-2026-000001', invoice_line_id: 'l1',
  procedure_correction_id: null, amount_rp: 100000, is_full: true, reason_type: 'salah_tarif', reason: 'Tarif salah', created_at: '', status: 'pending' as const,
  self_approved_sole_owner: false }] }))
const addRefund = vi.fn((_id: string, _b: object) => Promise.resolve(current))
const billFromCorrection = vi.fn((_id: string, _c: string) => Promise.resolve(inv))
const { default: InvoicePage } = await import('./InvoicePage')
beforeEach(() => { current = inv })
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

test('corrected line shows its credit note, never as Rp0; flagged line offers "Tagih kode yang benar"', async () => {
  current = { ...inv, credit_notes_rp: 100000, balance_rp: 0, adjustments: [],
    lines: [{ ...line, credited_rp: 100000, credit_note_numbers: ['NK-2026-000001'],
      correction_reviews: [{ id: 'r1', procedure_correction_id: 'c1', reason_type: 'salah_kode', new_procedure_id: 'p2', billable_code: '23.3', status: 'perlu_tinjau' }] }] }
  render(<InvoicePage visitId="v1" me={me(['billing.read', 'billing.adjust'])} />)
  expect(await screen.findByText('Dikoreksi — lihat NK-2026-000001')).toBeInTheDocument()
  expect(screen.getByText('Dikoreksi — lihat NK-2026-000001').closest('li')).toHaveTextContent('Rp100.000') // original price stays
  expect(screen.queryByRole('button', { name: 'Nota kredit' })).toBeNull() // nothing left to credit
  fireEvent.click(screen.getByRole('button', { name: 'Tagih kode yang benar' }))
  await waitFor(() => expect(billFromCorrection).toHaveBeenCalledWith('i1', 'c1'))
})

test('kasir creates a full credit note: shows the number waiting for the owner; void only while unpaid', async () => {
  render(<InvoicePage visitId="v1" me={me(['billing.read', 'billing.adjust'])} />)
  expect(await screen.findByRole('button', { name: 'Void tagihan' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Nota kredit' }))
  expect(screen.getByLabelText('Jumlah nota kredit (Rp)')).toHaveValue(100000)
  fireEvent.change(screen.getByLabelText('Alasan koreksi'), { target: { value: 'Tarif salah' } })
  fireEvent.click(screen.getByRole('button', { name: 'Buat nota kredit' }))
  await waitFor(() => expect(addCreditNote).toHaveBeenCalledWith('i1', { invoice_line_id: 'l1', amount_rp: 100000, reason_type: 'salah_tarif',
    reason: 'Tarif salah', procedure_correction_id: null }))
  expect(await screen.findByText(/NK-2026-000001 dibuat/)).toBeInTheDocument()
  expect(screen.getByText('Menunggu persetujuan')).toBeInTheDocument()
})

test('paid invoice: no void form', async () => {
  current = { ...inv, payments: [{ id: 'p1', payment_account_id: 'k1', amount_rp: 1000, paid_at: '', refunded_rp: 0, account: { name: 'Kas', kind: 'tunai', bank_name: null, account_last4: null } }] }
  render(<InvoicePage visitId="v1" me={me(['billing.read', 'billing.adjust'])} />)
  await screen.findByText('Tumpatan', { exact: false })
  expect(screen.queryByRole('button', { name: 'Void tagihan' })).toBeNull()
})

test('overpaid after a credit note: "kelebihan bayar", refund to the original account (locked), waits for the owner', async () => {
  const note = { id: 'n1', number: 'NK-2026-000001', invoice_line_id: 'l1', procedure_correction_id: null, amount_rp: 100000, is_full: true,
    reason_type: 'tidak_dikerjakan', reason: 'Tidak dikerjakan', created_at: '', status: 'approved' as const, self_approved_sole_owner: false, refunded_rp: 0 }
  current = { ...inv, adjustments: [], credit_notes_rp: 100000, payments_rp: 100000, balance_rp: -100000, overpaid_rp: 100000, credit_notes: [note],
    payments: [{ id: 'p1', payment_account_id: 'q1', amount_rp: 100000, paid_at: '', refunded_rp: 0, account: { name: 'QRIS klinik', kind: 'qris', bank_name: null, account_last4: null } }] }
  render(<InvoicePage visitId="v1" me={me(['billing.read', 'billing.adjust'])} />)
  expect(await screen.findByText(/Kelebihan bayar Rp100\.000 — buat refund/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Refund' }))
  expect(screen.getByLabelText('Akun refund')).toBeDisabled()
  expect(screen.getByLabelText('Akun refund')).toHaveValue('QRIS klinik (QRIS)')
  expect(screen.getByLabelText('Jumlah refund (Rp)')).toHaveValue(100000)
  fireEvent.change(screen.getByLabelText('Alasan refund'), { target: { value: 'Tindakan tidak dikerjakan, uang kembali' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ajukan refund' }))
  await waitFor(() => expect(addRefund).toHaveBeenCalledWith('i1', { payment_id: 'p1', credit_note_id: 'n1', amount_rp: 100000,
    reason: 'Tindakan tidak dikerjakan, uang kembali' }))
  expect(await screen.findByText(/Refund diajukan/)).toBeInTheDocument()
})
