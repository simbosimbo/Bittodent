import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { Me } from '../../shared/session'
import type { Period, RevenueReport } from './api'

const report = (period: Period): RevenueReport => ({ period, from: '2026-11-01', to: '2026-11-15', branch: { id: 'b1', name: 'Kemang' },
  revenue_rp: 18400000, prev_revenue_rp: 17000000, transactions: 86, receivable_rp: 2100000, receivable_patients: 3,
  daily: ['09', '10', '11', '12', '13', '14', '15'].map((d, i) => ({ date: `2026-11-${d}`, amount_rp: i * 100000 })),
  by_method: [{ kind: 'edc', bank_name: 'BCA', amount_rp: 300000, count: 1 }],
  by_doctor: [{ doctor_id: 'd1', name: 'drg. Andi Contoh', procedures: 52, patients: 41, amount_rp: 11200000 }],
  by_procedure: [{ name: 'Scaling', count: 10, amount_rp: 1500000 }],
  receivables: [{ patient_name: 'Rina Contoh', days: 12, items: ['Mahkota'], amount_rp: 1700000 }],
  shift_differences: [{ user_name: 'Kasir Contoh', closed_at: '2026-11-15T07:00:00Z', difference_rp: -10000, reason: 'Kembalian salah' }] })
const revenueReport = vi.fn((p: Period) => Promise.resolve(report(p)))
vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()), revenueReport: (p: Period) => revenueReport(p) }))
const { default: RevenuePage } = await import('./RevenuePage')
const me = { user: { id: 'u', name: 'Pemilik Contoh', email: '' }, active: { tenant_name: 'Klinik Contoh' } } as unknown as Me

test('KL07: KPI with delta, 7 bars, cash difference; period chips reload', async () => {
  render(<RevenuePage me={me} />)
  expect(await screen.findByText('Rp 18,4 jt')).toBeInTheDocument()
  expect(screen.getByText('+8% vs periode sebelumnya')).toBeInTheDocument()
  const bars = screen.getByRole('heading', { name: 'Pendapatan 7 hari' }).nextElementSibling!
  expect(bars.querySelectorAll('li')).toHaveLength(7)
  expect(bars).toHaveTextContent('Rp600.000') // sr-only exact value per day (direct labels show the short form)
  expect(screen.getByRole('region', { name: 'Selisih kas' })).toHaveTextContent('- Rp10.000')
  fireEvent.click(screen.getByRole('radio', { name: '7 hari' }))
  expect(revenueReport).toHaveBeenLastCalledWith('7d')
})

test('KL08/KL09: kinds -> per dokter cards; PDF prints the A4 page with the clinic letterhead', async () => {
  const print = vi.spyOn(window, 'print').mockImplementation(() => {})
  render(<RevenuePage me={me} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Jenis' }))
  expect(screen.getByRole('link', { name: /Integritas/ })).toHaveAttribute('href', '#/laporan/integritas')
  fireEvent.click(screen.getByRole('button', { name: /Per dokter/ }))
  expect(screen.getByRole('heading', { name: 'Pendapatan per dokter' })).toBeInTheDocument()
  expect(screen.getByText('52 tindakan · 41 pasien')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Unduh' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Unduh PDF' }))
  expect(print).toHaveBeenCalled()
  expect(document.querySelector('.a4')).toHaveTextContent('Klinik Contoh')
  expect(document.querySelector('.a4')).toHaveTextContent('drg. Andi Contoh')
})
