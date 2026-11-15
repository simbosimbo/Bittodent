import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { AuditPage, IntegrityReport } from './api'

const zero = { external: 0, external_pending: 0, external_rejected: 0, rp0: 0, rp0_pending: 0, discounts: 0, discount_total_rp: 0, full_discounts: 0,
  self_approved: 0, unbilled_visits: 0, batal: 0, closed_without_invoice: 0 }
const report: IntegrityReport = { from: '2026-11-01', to: '2026-11-14', timezone: 'Asia/Jakarta',
  dentists: [{ dentist_id: 'd1', name: 'drg. Andi Contoh', ...zero, self_approved: 1, unbilled_visits: 2 }], totals: zero, average: zero,
  alerts: [
    { kind: 'tanpa_tagihan', at: '2026-11-14T04:20:00Z', dentist_id: 'd1', dentist_name: 'drg. Andi Contoh', patient_id: 'p1', patient_name: 'Pasien Sintetis', visit_id: 'v1', ref_id: 'v1', detail: {} },
    { kind: 'batal_tanpa_tagihan', at: '2026-11-13T04:20:00Z', dentist_id: 'd1', dentist_name: 'drg. Andi Contoh', patient_id: 'p2', patient_name: 'Pasien Dua', visit_id: 'v2', ref_id: 'v2', detail: {} },
  ] }
const audit: AuditPage = { page: 1, last_page: 1, total: 1, per_page: 50,
  data: [{ id: 'e1', occurred_at: '2026-11-14T03:18:00Z', actor_type: 'user', actor_id: 'u1', actor_name: 'Front Desk Contoh', action: 'konfirmasi_tindakan_luar',
    entity_type: 'procedure_record', entity_id: 'abcdef12-0000', branch_id: null, detail: null }] }
vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()),
  integrityReport: () => Promise.resolve(report), auditEvents: () => Promise.resolve(audit) }))
const { default: ReportPage } = await import('./ReportPage')

test('owner page shows per-dentist counts, alerts with batal as an exception, and a read-only audit log', async () => {
  render(<ReportPage />)
  expect(await screen.findByText('drg. Andi Contoh', { selector: 'td' })).toBeInTheDocument()
  expect(screen.getByText('Tanpa tagihan', { selector: 'strong' })).toBeInTheDocument()
  expect(screen.getByText('Batal (tanpa tagihan, pengecualian)')).toBeInTheDocument()
  expect(await screen.findByText('konfirmasi_tindakan_luar')).toBeInTheDocument()
  expect(screen.getByText(/Tidak dapat dihapus atau diubah/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /hapus|ubah/i })).toBeNull()
})
