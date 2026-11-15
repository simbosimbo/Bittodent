import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

const decideCreditNote = vi.fn((_id: string, _d: string) => Promise.resolve({}))
const decideRefund = vi.fn((_id: string, _d: string) => Promise.resolve({}))
vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()),
  pendingReversals: () => Promise.resolve({ voids: [], refunds: [{ id: 'r1', invoice_id: 'i1', visit_id: 'v1', amount_rp: 250000,
    reason: 'Uang kembali ke pasien', created_at: '2026-11-15T04:00:00Z', credit_note_number: 'NK-2026-000003',
    account: { name: 'QRIS klinik', kind: 'qris', bank_name: null, account_last4: null } }], credit_notes: [{ id: 'n1', number: 'NK-2026-000003', invoice_id: 'i1', visit_id: 'v1',
    amount_rp: 250000, reason_type: 'tidak_dikerjakan', reason: 'Koreksi klinis: tindakan tidak dikerjakan.', created_at: '2026-11-15T03:00:00Z',
    line: { procedure_code: '23.2', procedure_name: 'Tumpatan', tooth: 26, price_rp: 250000 } }] }),
  decideCreditNote: (id: string, d: string) => decideCreditNote(id, d), decideRefund: (id: string, d: string) => decideRefund(id, d) }))
const { ReversalApprovals } = await import('./ReversalApprovals')

test('owner sees pending full credit notes and approves one', async () => {
  render(<ReversalApprovals />)
  expect(await screen.findByText('NK-2026-000003')).toBeInTheDocument()
  fireEvent.click(screen.getAllByRole('button', { name: 'Setujui' })[0])
  await waitFor(() => expect(decideCreditNote).toHaveBeenCalledWith('n1', 'approve'))
})

test('owner sees pending refunds in the same list and approves one', async () => {
  render(<ReversalApprovals />)
  expect(await screen.findByText(/ke QRIS klinik · NK-2026-000003/)).toBeInTheDocument()
  fireEvent.click(screen.getAllByRole('button', { name: 'Setujui' })[1])
  await waitFor(() => expect(decideRefund).toHaveBeenCalledWith('r1', 'approve'))
})
