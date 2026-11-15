import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { Me } from '../../shared/session'
import type { Invoice } from './api'

const inv: Invoice = { id: 'i1', visit_id: 'v1', lines_rp: 100000, adjustments_rp: 0, balance_rp: 100000,
  lines: [{ id: 'l1', procedure_code: '23.2', procedure_name: 'Tumpatan', tooth: 16, price_rp: 100000 }],
  adjustments: [{ id: 'a1', kind: 'discount', amount_rp: 100000, reason: 'Diskon penuh', created_at: '', status: 'pending', self_approved_sole_owner: false }] }
vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()), invoiceForVisit: () => Promise.resolve(inv) }))
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
