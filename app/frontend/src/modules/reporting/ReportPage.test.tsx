import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { num, rp } from '../../shared/format'
import type { AuditPage, IntegrityReport } from './api'

const zero = { external: 0, external_pending: 0, external_rejected: 0, rp0: 0, rp0_pending: 0, discounts: 0, discount_total_rp: 0, full_discounts: 0,
  self_approved: 0, unbilled_visits: 0, batal: 0, closed_without_invoice: 0, full_discount_rp: 0, tariff_zero: 0, tariff_zero_pending: 0,
  corr_salah_kode: 0, corr_salah_situs: 0, corr_salah_provider: 0, corr_tidak_dikerjakan: 0, corr_total_rp: 0, corr_pending: 0, corr_rejected: 0,
  corr_outside_window: 0, corr_owner_approved: 0, corr_self_approved: 0, cn_partial: 0, cn_partial_rp: 0, cn_full: 0, cn_full_rp: 0, cn_pending: 0,
  cn_pending_rp: 0, cn_approved: 0, refunds: 0, refund_rp: 0, refund_pending: 0, refund_pending_rp: 0, voids: 0, void_rp: 0, void_pending: 0,
  void_pending_rp: 0, reversal_self_approved: 0 }
const report: IntegrityReport = { from: '2026-11-01', to: '2026-11-14', timezone: 'Asia/Jakarta',
  dentists: [{ dentist_id: 'd1', name: 'drg. Andi Contoh', ...zero, self_approved: 1, unbilled_visits: 2, cn_full: 1, cn_full_rp: 250000 }], totals: zero, average: zero,
  alerts: [
    { kind: 'tanpa_tagihan', at: '2026-11-14T04:20:00Z', dentist_id: 'd1', dentist_name: 'drg. Andi Contoh', patient_id: 'p1', patient_name: 'Pasien Sintetis', visit_id: 'v1', ref_id: 'v1', detail: {} },
    { kind: 'pembalikan_menunggu', at: '2026-11-13T05:00:00Z', dentist_id: 'd1', dentist_name: 'drg. Andi Contoh', patient_id: 'p3', patient_name: 'Pasien Tiga', visit_id: 'v3', ref_id: 'n1', detail: { type: 'nota_kredit' } },
    { kind: 'batal_tanpa_tagihan', at: '2026-11-13T04:20:00Z', dentist_id: 'd1', dentist_name: 'drg. Andi Contoh', patient_id: 'p2', patient_name: 'Pasien Dua', visit_id: 'v2', ref_id: 'v2', detail: {} },
  ] }
const audit: AuditPage = { page: 1, last_page: 1, total: 1, per_page: 50,
  data: [{ id: 'e1', occurred_at: '2026-11-14T03:18:00Z', actor_type: 'user', actor_id: 'u1', actor_name: 'Front Desk Contoh', action: 'konfirmasi_tindakan_luar',
    entity_type: 'procedure_record', entity_id: 'abcdef12-0000', branch_id: null, detail: null }] }
const calls = vi.hoisted(() => ({ integrity: null as null | (() => Promise<unknown>), audit: null as null | (() => Promise<unknown>) }))
vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()),
  integrityReport: () => calls.integrity?.() ?? Promise.resolve(report), auditEvents: () => calls.audit?.() ?? Promise.resolve(audit) }))
vi.mock('../clinical', () => ({ CorrectionApprovals: () => null }))
vi.mock('../billing', () => ({ ReversalApprovals: () => null }))
const { default: ReportPage } = await import('./ReportPage')

test('owner page shows per-dentist counts, alerts with batal as an exception, and a read-only audit log', async () => {
  render(<ReportPage />)
  expect(await screen.findAllByText('drg. Andi Contoh', { selector: 'td' })).toHaveLength(2)
  expect(screen.getByText('Tanpa tagihan', { selector: 'strong' })).toBeInTheDocument()
  expect(screen.getByText('Batal (tanpa tagihan, pengecualian)')).toBeInTheDocument()
  // unit D: credit notes in their own group, never under Rp0
  expect(screen.getByRole('heading', { name: 'Koreksi & pembalikan' })).toBeInTheDocument()
  expect(screen.getByText(/250\.000/)).toBeInTheDocument()
  expect(screen.getByText('Nota kredit/void/refund menunggu')).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'Buka tagihan' })).toHaveLength(1)
  expect(await screen.findByText('konfirmasi_tindakan_luar')).toBeInTheDocument()
  expect(screen.getByText(/Tidak dapat dihapus atau diubah/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /hapus|ubah/i })).toBeNull()
})

test('every wide table sits in a .table-scroll wrapper (sideways scroll on a phone)', async () => {
  const { container } = render(<ReportPage />)
  await screen.findByText('konfirmasi_tindakan_luar')
  const tables = container.querySelectorAll('table.table')
  expect(tables.length).toBe(3)
  tables.forEach((t) => expect(t.parentElement).toHaveClass('table-scroll'))
})

const viewport = (w: number) => vi.stubGlobal('matchMedia', (q: string) => ({ media: q, matches: w <= 720, addEventListener() {}, removeEventListener() {} }))
afterEach(() => { vi.unstubAllGlobals(); calls.integrity = null; calls.audit = null })

test('rupiah/number formatter: id-ID thousands, 0 and -0 read as zero', () => {
  expect(rp(1250000)).toBe('Rp1.250.000')
  expect(rp(0)).toBe('Rp0')
  expect(rp(-0)).toBe('Rp0')
  expect(rp(Math.round(-0.4))).toBe('Rp0')
  expect(rp(-5000)).toBe('Rp-5.000')
  expect(num(0.5)).toBe('0,5')
  expect(num(NaN)).toBe('0')
})

test('1280px: tables, no cards', async () => {
  viewport(1280)
  const { container } = render(<ReportPage />)
  await screen.findByText('konfirmasi_tindakan_luar')
  expect(container.querySelectorAll('table.table')).toHaveLength(3)
  expect(container.querySelector('.report-cards, .report-kpis')).toBeNull()
  expect(container.querySelector('.date-field-desk')).not.toBeNull() // review-3: "15 Nov 2026" on desktop too
})

test('390px: KPIs, per-dentist cards (key figure first), audit cards, 44px pager; no tables', async () => {
  viewport(390)
  const { container } = render(<ReportPage />)
  await screen.findByText('konfirmasi_tindakan_luar')
  expect(container.querySelector('table')).toBeNull()
  const kpis = screen.getByLabelText('Ringkasan klinik')
  expect(within(kpis).getByText('Tanpa tagihan').previousSibling).toHaveTextContent('0')
  const cards = within(screen.getByRole('list', { name: 'Per dokter' })).getAllByRole('listitem')
  expect(cards).toHaveLength(2) // dentist + clinic average
  expect(cards[0].querySelector('.report-card-head')).toHaveTextContent('drg. Andi ContohRp0total diskon')
  expect(within(cards[0]).getByText('Tanpa tagihan').nextSibling).toHaveTextContent('2')
  const corr = within(screen.getByRole('list', { name: 'Koreksi per dokter' })).getAllByRole('listitem')[0]
  expect(within(corr).getByText('Rp penuh').nextSibling).toHaveTextContent('Rp250.000')
  expect(within(screen.getByRole('list', { name: 'Audit log' })).getByText('konfirmasi_tindakan_luar')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Berikutnya' })).not.toHaveClass('btn-xs')
  // date range in Indonesian format over the native input
  expect(screen.getByLabelText(/^Dari/)).toHaveAttribute('type', 'date')
  expect(container.querySelector('.date-field-text')).toHaveTextContent(/^1 Nov 2026$|^\d{1,2} \w{3} \d{4}$/)
})

test('section errors show a retry; retry reloads only that section', async () => {
  let fail = true
  calls.integrity = () => fail ? Promise.reject(new Error('boom')) : Promise.resolve(report)
  render(<ReportPage />)
  expect(await screen.findByText('konfirmasi_tindakan_luar')).toBeInTheDocument() // audit still loads
  const alerts = await screen.findAllByRole('alert')
  expect(alerts.length).toBeGreaterThan(0)
  fail = false
  fireEvent.click(within(alerts[0]).getByRole('button', { name: 'Coba lagi' }))
  expect(await screen.findAllByText('drg. Andi Contoh', { selector: 'td' })).toHaveLength(2)
  expect(screen.queryByRole('button', { name: 'Coba lagi' })).toBeNull()
})
