import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

const decideCreditNote = vi.fn((_id: string, _d: string) => Promise.resolve({}))
vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()),
  pendingReversals: () => Promise.resolve({ voids: [], credit_notes: [{ id: 'n1', number: 'NK-2026-000003', invoice_id: 'i1', visit_id: 'v1',
    amount_rp: 250000, reason_type: 'tidak_dikerjakan', reason: 'Koreksi klinis: tindakan tidak dikerjakan.', created_at: '2026-11-15T03:00:00Z',
    line: { procedure_code: '23.2', procedure_name: 'Tumpatan', tooth: 26, price_rp: 250000 } }] }),
  decideCreditNote: (id: string, d: string) => decideCreditNote(id, d) }))
const { ReversalApprovals } = await import('./ReversalApprovals')

test('owner sees pending full credit notes and approves one', async () => {
  render(<ReversalApprovals />)
  expect(await screen.findByText('NK-2026-000003')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Setujui' }))
  await waitFor(() => expect(decideCreditNote).toHaveBeenCalledWith('n1', 'approve'))
})
